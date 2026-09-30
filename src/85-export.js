  // =====================================================================
  // EXPORT: save a still (PNG) or a loop (GIF) of what is on screen.
  // P saves a still at twice the screen size. G records three seconds as a
  // GIF. Shift G records the whole day, midnight to midnight, as a GIF.
  // The GIF encoder is written here (median cut palette per frame, LZW) so
  // nothing is loaded from anywhere.
  // =====================================================================
  function exp_name(api, ext) {
    var t = api.getTime();
    return 'marfa-light-' + api.plan.hash.slice(2, 10) + '-' + t.y + pad2(t.mo) + pad2(t.d) + '-' + pad2(t.h) + pad2(t.m) + '.' + ext;
  }
  function exp_download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 4000);
  }
  // the frame size for an export: the screen's shape, scaled, capped
  function exp_size(api, longSide) {
    var c = api.renderer.domElement, w = c.clientWidth || c.width, h = c.clientHeight || c.height, k = longSide / Math.max(w, h);
    return [Math.max(2, Math.round(w * k / 2) * 2), Math.max(2, Math.round(h * k / 2) * 2)];
  }

  // ---- still
  function exp_still(api, o) {
    o = o || {};
    var c = api.renderer.domElement, sz = exp_size(api, o.long || Math.min(4096, 2 * Math.max(c.clientWidth || c.width, c.clientHeight || c.height)));
    var cv = document.createElement('canvas'); cv.width = sz[0]; cv.height = sz[1];
    var running = api.running();
    api.beginCapture(sz[0], sz[1]);
    api.captureFrame(0, cv.getContext('2d'));
    api.endCapture(running);
    return new Promise(function (res) {
      cv.toBlob(function (b) { if (o.download !== false && b) exp_download(b, exp_name(api, 'png')); res({ blob: b, canvas: cv }); }, 'image/png');
    });
  }

  // ---- GIF: palette by median cut on a sample of the frame
  function exp_palette(px, n) {
    var step = Math.max(1, Math.floor(px.length / 4 / 24000)), pts = [], i;
    for (i = 0; i < px.length; i += 4 * step) pts.push((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    var boxes = [pts];
    while (boxes.length < n) {
      var bi = -1, best = -1, ch = 0;
      for (i = 0; i < boxes.length; i++) {
        var b = boxes[i]; if (b.length < 2) continue;
        var mn = [255, 255, 255], mx = [0, 0, 0];
        for (var j = 0; j < b.length; j++) {
          var v = b[j], rgb = [v >> 16, (v >> 8) & 255, v & 255];
          for (var q = 0; q < 3; q++) { if (rgb[q] < mn[q]) mn[q] = rgb[q]; if (rgb[q] > mx[q]) mx[q] = rgb[q]; }
        }
        for (q = 0; q < 3; q++) { var rng = (mx[q] - mn[q]) * Math.sqrt(b.length); if (rng > best) { best = rng; bi = i; ch = q; } }
      }
      if (bi < 0 || best <= 0) break;
      var sh = 16 - 8 * ch, box = boxes[bi].sort(function (a, b2) { return ((a >> sh) & 255) - ((b2 >> sh) & 255); });
      var mid = box.length >> 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    var pal = new Uint8Array(n * 3);
    boxes.forEach(function (b, k) {
      var s = [0, 0, 0];
      b.forEach(function (v) { s[0] += v >> 16; s[1] += (v >> 8) & 255; s[2] += v & 255; });
      for (var q = 0; q < 3; q++) pal[k * 3 + q] = b.length ? Math.round(s[q] / b.length) : 0;
    });
    return pal;
  }
  function exp_index(px, pal) {
    var n = px.length / 4, out = new Uint8Array(n), cache = new Int16Array(32768).fill(-1), np = pal.length / 3;
    for (var i = 0; i < n; i++) {
      var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), c = cache[key];
      if (c < 0) {
        var bd = 1e9;
        for (var k = 0; k < np; k++) {
          var dr = r - pal[k * 3], dg = g - pal[k * 3 + 1], db = b - pal[k * 3 + 2], d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
          if (d < bd) { bd = d; c = k; }
        }
        cache[key] = c;
      }
      out[i] = c;
    }
    return out;
  }
  // LZW with 8 bit minimum code size, written straight into GIF sub-blocks
  function exp_lzw(idx, bytes) {
    var clear = 256, eoi = 257, next = 258, size = 9, table = new Map(), cur = 0, shift = 0, block = [];
    function flushBlock(force) {
      while (block.length >= 255 || (force && block.length)) {
        var n = Math.min(255, block.length); bytes.push(n);
        for (var i = 0; i < n; i++) bytes.push(block[i]);
        block = block.slice(n);
      }
    }
    function emit(code) {
      cur |= code << shift; shift += size;
      while (shift >= 8) { block.push(cur & 255); cur >>>= 8; shift -= 8; }
      if (block.length >= 255) flushBlock(false);
    }
    bytes.push(8);
    emit(clear);
    var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = (prefix << 8) | k, c = table.get(key);
      if (c !== undefined) { prefix = c; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); next = 258; size = 9; table = new Map(); }
      else { if (next >= (1 << size)) size++; table.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (shift > 0) block.push(cur & 255);
    flushBlock(true);
    bytes.push(0);
  }
  function GifWriter(w, h) {
    var b = this.bytes = [];
    function s(str) { for (var i = 0; i < str.length; i++) b.push(str.charCodeAt(i)); }
    function u16(v) { b.push(v & 255, (v >> 8) & 255); }
    s('GIF89a'); u16(w); u16(h); b.push(0, 0, 0);
    b.push(0x21, 0xFF, 11); s('NETSCAPE2.0'); b.push(3, 1, 0, 0, 0);      // loop forever
    // shared: one palette for every frame, and a pixel that has not changed
    // since the last frame is written as transparent, so only motion costs
    var shared = null, prev = null;
    this.frame = function (px, delayCs, share) {
      var pal, idx, trans = share && prev;
      if (share) { if (!shared) shared = exp_palette(px, 255); pal = new Uint8Array(768); pal.set(shared); }
      else pal = exp_palette(px, 256);
      idx = exp_index(px, share ? shared : pal);
      if (trans) {
        var keep = idx.slice();
        for (var q = 0; q < idx.length; q++) if (idx[q] === prev[q]) idx[q] = 255;
        prev = keep;
      } else prev = share ? idx.slice() : null;
      b.push(0x21, 0xF9, 4, trans ? 0x05 : 0x04); u16(delayCs); b.push(trans ? 255 : 0, 0);
      b.push(0x2C); u16(0); u16(0); u16(w); u16(h); b.push(0x87);
      for (var i = 0; i < pal.length; i++) b.push(pal[i]);
      exp_lzw(idx, b);
    };
    this.finish = function () { b.push(0x3B); return new Blob([new Uint8Array(b)], { type: 'image/gif' }); };
  }

  // Record a GIF. o.seconds of Marfa time pass over o.frames frames; the loop
  // plays at o.fps. A moment: 3 s over 36 frames at 640 px. A day: 24 h over 48
  // frames at 540 px (every frame relit, so each needs its own palette).
  function exp_gif(api, o) {
    o = o || {};
    var day = o.day, frames = o.frames || (day ? 48 : 36), fps = o.fps || 12;
    var span = o.seconds != null ? o.seconds : day ? 86400 : frames / fps;
    var sz = exp_size(api, o.long || (day ? 540 : 640)), cv = document.createElement('canvas');
    cv.width = sz[0]; cv.height = sz[1];
    var g2 = cv.getContext('2d'), gif = new GifWriter(sz[0], sz[1]);
    var t0 = api.getTime(), mode = api.getMode(), running = api.running();
    var start = day ? marfaUtc(t0.y, t0.mo, t0.d, 0, 0) : t0.utc, dtSim = span / frames;
    if (o.onProgress) o.onProgress(0);
    api.beginCapture(sz[0], sz[1], true);
    api.setClock(start, true);
    return new Promise(function (res) {
      var i = 0;
      (function next() {
        api.setClock(start + i * dtSim, day);                           // a day jumps, a moment moves
        api.captureFrame(day ? 1 / fps : dtSim, g2);
        gif.frame(g2.getImageData(0, 0, sz[0], sz[1]).data, Math.round(100 / fps), !day);
        i++;
        if (o.onProgress) o.onProgress(i / frames);
        if (i < frames) { setTimeout(next, 0); return; }
        api.endCapture(running);
        if (mode === 'live' || mode === 'lapse') api.setMode(mode); else api.setClock(t0.utc, true);
        var blob = gif.finish();
        if (o.download !== false) exp_download(blob, exp_name(api, 'gif').replace('.gif', day ? '-day.gif' : '.gif'));
        res({ blob: blob, width: sz[0], height: sz[1], frames: frames });
      })();
    });
  }
