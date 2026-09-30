  // =====================================================================
  // CLOCKS: three sundials, two flap clocks, four clocks from later
  // =====================================================================

  // ------------------------------------------------------------ the Blossom grammar
  // Six shapes on one grid: petal, disc, spark, quarter, scoop, lens.
  function arcPts(cx, cy, r, a0, a1, n) {
    var out = [];
    for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * D2R; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  function primPts(kind) {
    var S = 8;
    if (kind === 0) return [[0, 0]].concat(arcPts(0.5, 0.5, 0.5, -90, 180, S * 3));
    if (kind === 1) return arcPts(0.5, 0.5, 0.5, 0, 360, S * 4).slice(0, -1);
    if (kind === 2) return arcPts(1, 0, 0.5, 180, 90, S).concat(arcPts(1, 1, 0.5, 270, 180, S), arcPts(0, 1, 0.5, 360, 270, S), arcPts(0, 0, 0.5, 90, 0, S));
    if (kind === 3) return [[0, 0]].concat(arcPts(0, 0, 1, 0, 90, S * 2));
    if (kind === 4) return [[1, 0], [1, 1]].concat(arcPts(0, 0, 1, 90, 0, S * 2));
    return [[0, 0]].concat(arcPts(0.5, 0.5, 0.5, -90, 0, S), [[1, 1]], arcPts(0.5, 0.5, 0.5, 90, 180, S));
  }
  // points of one shape, turned q quarters, optionally mirrored, scaled to a
  // cell of side s whose lower left corner is (x, y), shrunk by `inset`
  function primAt(kind, q, x, y, s, inset, mirror) {
    var p = primPts(kind), out = [];
    for (var i = 0; i < p.length; i++) {
      var u = p[i][0] - 0.5, v = p[i][1] - 0.5, t;
      for (var k = 0; k < q; k++) { t = u; u = -v; v = t; }
      if (mirror) u = -u;
      out.push(new THREE.Vector2(x + (0.5 + u * inset) * s, y + (0.5 + v * inset) * s));
    }
    return out;
  }
  function blossomPlate(r, W0, H0, n, inset, skip) {
    var sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(W0, 0), new THREE.Vector2(W0, H0), new THREE.Vector2(0, H0)]);
    var cw = W0 / n, chh = H0 / n, s = Math.min(cw, chh);
    for (var gy = 0; gy < n; gy++) for (var gx = 0; gx < n / 2; gx++) {
      var kind = ri(r, 0, 5), q = ri(r, 0, 3);
      if (r() < skip) continue;
      var ox = (cw - s) / 2, oy = (chh - s) / 2;
      sh.holes.push(new THREE.Path(primAt(kind, q, gx * cw + ox, gy * chh + oy, s, inset, false)));
      sh.holes.push(new THREE.Path(primAt(kind, q, (n - 1 - gx) * cw + ox, gy * chh + oy, s, inset, true)));
    }
    return sh;
  }
  function primShape(kind, q, s) { return new THREE.Shape(primAt(kind, q, -s / 2, -s / 2, s, 1, false)); }

  // ------------------------------------------------------------ split flaps
  var FLAP_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-+/%°\'';
  var _atlas = null;
  function flapAtlas() {
    if (_atlas) return _atlas;
    var cols = 8, rows = Math.ceil(FLAP_CHARS.length / cols), cw = 128, ch = 176;
    var tex = canvasTex(cols * cw, rows * ch, function (g) {
      g.fillStyle = '#050607'; g.fillRect(0, 0, cols * cw, rows * ch);
      for (var i = 0; i < FLAP_CHARS.length; i++) {
        var x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        g.fillStyle = '#17191C'; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
        var gr = g.createLinearGradient(0, y, 0, y + ch);
        gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.04)');
        g.fillStyle = gr; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
        g.fillStyle = '#F1EEE4'; g.font = '700 128px ' + FONT_SANS; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(FLAP_CHARS[i], x + cw / 2, y + ch / 2 + 8);
        g.fillStyle = '#030304'; g.fillRect(x + 4, y + ch / 2 - 2, cw - 8, 4);
      }
    });
    tex.userData = { shared: true };
    _atlas = { tex: tex, cols: cols, rows: rows };
    return _atlas;
  }
  function flapIndex(ch) { var i = FLAP_CHARS.indexOf(String(ch).toUpperCase()); return i < 0 ? 0 : i; }
  function setUV(mesh, ci, half) {
    var a = flapAtlas(), col = ci % a.cols, row = Math.floor(ci / a.cols), e = 0.003;
    var u0 = col / a.cols + e, u1 = (col + 1) / a.cols - e, vt = 1 - row / a.rows - e, vb = 1 - (row + 1) / a.rows + e, vm = (vt + vb) / 2;
    var v0 = half === 'top' ? vm : vb, v1 = half === 'top' ? vt : vm;
    var arr = mesh.geometry.attributes.uv.array;
    arr[0] = u0; arr[1] = v1; arr[2] = u1; arr[3] = v1; arr[4] = u0; arr[5] = v0; arr[6] = u1; arr[7] = v0;
    mesh.geometry.attributes.uv.needsUpdate = true;
  }
  function FlapCell(w, h, mat) {
    var half = function () { return new THREE.PlaneBufferGeometry(w, h / 2); };
    this.g = new THREE.Group();
    this.top = new THREE.Mesh(half(), mat); this.top.position.y = h / 4;
    this.bot = new THREE.Mesh(half(), mat); this.bot.position.y = -h / 4;
    this.pivot = new THREE.Group(); this.pivot.position.z = 0.006;
    this.ff = new THREE.Mesh(half(), mat); this.ff.position.y = h / 4;
    this.fb = new THREE.Mesh(half(), mat); this.fb.rotation.x = Math.PI; this.fb.position.set(0, h / 4, -0.002);
    this.pivot.add(this.ff); this.pivot.add(this.fb); this.pivot.visible = false;
    this.g.add(this.top); this.g.add(this.bot); this.g.add(this.pivot);
    this.cur = 0; this.target = 0; this.next = 0; this.anim = -1; this.dur = 0.075;
    setUV(this.top, 0, 'top'); setUV(this.bot, 0, 'bot');
  }
  FlapCell.prototype.snap = function (ci) {
    this.cur = this.target = ci; this.anim = -1; this.pivot.visible = false;
    setUV(this.top, ci, 'top'); setUV(this.bot, ci, 'bot');
  };
  FlapCell.prototype.update = function (dt, jump) {
    if (this.anim < 0) {
      if (this.cur === this.target) return;
      // digits turn on their own ring of ten, the way a clock's drum does;
      // letters run the whole alphabet, the way a departures board does
      var D0 = FLAP_CHARS.indexOf('0'), isD = function (i) { return i >= D0 && i < D0 + 10; };
      if (jump) this.next = this.target;
      else if (isD(this.cur) && isD(this.target)) this.next = D0 + (this.cur - D0 + 1) % 10;
      else this.next = (this.cur + 1) % FLAP_CHARS.length;
      setUV(this.top, this.next, 'top'); setUV(this.ff, this.cur, 'top'); setUV(this.fb, this.next, 'bot');
      this.pivot.rotation.x = 0; this.pivot.visible = true; this.anim = 0;
    }
    this.anim += dt / this.dur;
    var t = Math.min(this.anim, 1);
    this.pivot.rotation.x = Math.PI * t * t;
    if (t >= 1) { setUV(this.bot, this.next, 'bot'); this.cur = this.next; this.pivot.visible = false; this.anim = -1; }
  };
  function FlapRow(n, w, h, gap, mat, parent, x0, y0, z) {
    this.cells = [];
    for (var i = 0; i < n; i++) {
      var c = new FlapCell(w, h, mat);
      c.g.position.set(x0 + i * (w + gap) + w / 2, y0, z);
      parent.add(c.g); this.cells.push(c);
    }
  }
  FlapRow.prototype.set = function (s, snap) {
    s = String(s);
    for (var i = 0; i < this.cells.length; i++) {
      var ci = flapIndex(i < s.length ? s[i] : ' ');
      if (snap) this.cells[i].snap(ci); else this.cells[i].target = ci;
    }
  };
  FlapRow.prototype.update = function (dt, jump) {
    for (var i = 0; i < this.cells.length; i++) {
      var c = this.cells[i];
      c.dur = 0.07 + (i % 3) * 0.006;
      c.update(dt, jump);
    }
  };
  function fit(s, n) { s = String(s).toUpperCase(); return s.length > n ? s.slice(0, n) : s + new Array(n - s.length + 1).join(' '); }
  function lr(a, b, n) { a = String(a); b = String(b); var sp = Math.max(1, n - a.length - b.length); return fit(a + new Array(sp + 1).join(' ') + b, n); }
  function flapMaterial(W) {
    var m = new THREE.MeshStandardMaterial({ map: flapAtlas().tex, roughness: 0.55, metalness: 0.1, emissive: new THREE.Color(1, 1, 1), emissiveMap: flapAtlas().tex, emissiveIntensity: 0 });
    W.glow(m, 0.0, 0.32);
    return m;
  }
  // what the boards say. Rotates every few seconds.
  function boardPages(ctx) {
    var t = ctx.t, ev = sunEvents(t), sun = ctx.sun, moon = ctx.moon;
    return [
      [lr('SUNRISE', ev.rise, 18), lr('SUNSET', ev.set, 18), lr('SUN', (sun.el < 0 ? '-' : '') + Math.abs(Math.round(sun.el)) + '° ' + (sun.el > 0 ? 'UP' : 'DOWN'), 18), lr('MOON', Math.round(moon.illum * 100) + '%', 18)],
      [fit('NOW SERVING 317', 18), fit('MLOW.XYZ', 18), fit('MLOW.NYC', 18), fit('N3WYORKERS.COM', 18)],
      [fit('5000+ NYC TAXIS', 18), fit('10+ COUNTRIES', 18), fit('7541 NEW YORKERS', 18), fit('ONE ARTIST', 18)],
      [fit('PRADA MARFA', 18), fit('VALENTINE TX', 18), fit('MARFA LIGHTS', 18), fit('EAST ON US 90', 18)],
      [lr(MONTHS[t.mo - 1] + ' ' + t.d, t.y, 18), fit('SOFT CONSPIRACY', 18), fit('FLOWERS', 18), fit('STILL WAITING', 18)],
      [fit('TRIPPERS', 18), fit('IMPERMANENT LOSS', 18), fit('UNCHAINED BTC', 18), fit('TOKENIZED GARBAGE', 18)],
      [fit('WE LOVE THE ART', 18), fit('AI WINNER 2024', 18), fit('CLAIRE SILVER', 18), fit('FINALIST 2023', 18)],
      [fit('BEEPLE STUDIOS', 18), fit('NYT MY HOMETOWN', 18), fit('THE MLOW SHOW', 18), fit('MLOW.XYZ', 18)],
      [fit(moonName(moon), 18), lr('LAT', '30.31N', 18), lr('LON', '104.02W', 18), lr('ZONE', t.zone, 18)]
    ];
  }

  // ------------------------------------------------------------ variation helpers
  // Flap colours. Black is the original atlas; the others share its layout so
  // setUV() works on them unchanged.
  var var_FLAP_STYLES = {
    'Black': { bg: '#17191C', ink: '#F1EEE4', hinge: '#030304', night: 0.32 },
    'Cream': { bg: '#E4DCC8', ink: '#17181B', hinge: '#6E685C', night: 0.12 },
    'Amber': { bg: '#131210', ink: '#FFB547', hinge: '#030303', night: 0.6 },
    'Blue':  { bg: '#1E4FD4', ink: '#F4F7FB', hinge: '#0A1E5A', night: 0.28 }
  };
  var var_atlases = {};
  function var_flapAtlas(style) {
    if (!style || style === 'Black' || !var_FLAP_STYLES[style]) return flapAtlas();
    if (var_atlases[style]) return var_atlases[style];
    var s = var_FLAP_STYLES[style], base = flapAtlas(), cols = base.cols, rows = base.rows, cw = 128, ch = 176;
    var tex = canvasTex(cols * cw, rows * ch, function (g) {
      g.fillStyle = '#050607'; g.fillRect(0, 0, cols * cw, rows * ch);
      for (var i = 0; i < FLAP_CHARS.length; i++) {
        var x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        g.fillStyle = s.bg; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
        var gr = g.createLinearGradient(0, y, 0, y + ch);
        gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
        g.fillStyle = gr; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
        g.fillStyle = s.ink; g.font = '700 128px ' + FONT_SANS; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(FLAP_CHARS[i], x + cw / 2, y + ch / 2 + 8);
        g.fillStyle = s.hinge; g.fillRect(x + 4, y + ch / 2 - 2, cw - 8, 4);
      }
    });
    tex.userData = { shared: true };
    return (var_atlases[style] = { tex: tex, cols: cols, rows: rows });
  }
  function var_flapMaterial(W, style) {
    var a = var_flapAtlas(style), s = var_FLAP_STYLES[style] || var_FLAP_STYLES.Black;
    var m = new THREE.MeshStandardMaterial({ map: a.tex, roughness: 0.55, metalness: 0.1, emissive: new THREE.Color(1, 1, 1), emissiveMap: a.tex, emissiveIntensity: 0 });
    W.glow(m, 0.0, s.night);
    return m;
  }
  // a departures board with nowhere to depart to: real Marfa minutes, towns
  // down the road, and a few places no bus goes
  var var_DESTS = ['VALENTINE', 'ALPINE', 'FORT DAVIS', 'PRESIDIO', 'NOWHERE', 'VAN HORN', 'SHAFTER', 'EL PASO', 'LATER',
    'TERLINGUA', 'LOBO', 'MARATHON', 'THE LIGHTS', 'BALMORHEA', 'RUIDOSA', 'HOME', 'CANDELARIA', 'SIERRA BLANCA', 'BIG BEND', 'ELSEWHERE'];
  var var_STATUS = ['ON TIME', 'ON TIME', 'DELAYED', 'ON TIME', 'BOARDING', 'CANCELLED', 'ON TIME', 'WAIT', 'DELAYED', 'ON TIME', 'GONE'];
  function var_lr(a, b, n) { a = String(a); b = String(b); return lr(a.slice(0, Math.max(1, n - b.length - 1)), b, n); }
  function var_departurePages(ctx) {
    var t = ctx.t, start = Math.ceil((t.h * 60 + t.m + 1) / 5) * 5, pages = [], k, i, when;
    for (var p = 0; p < 3; p++) {
      var times = [], stat = [];
      for (k = 0; k < 4; k++) {
        i = p * 4 + k; when = start + Math.round(i * 2.4) * 5;
        var dest = var_DESTS[(i + t.days) % var_DESTS.length];
        times.push(fit(pad2(Math.floor(when / 60) % 24) + ':' + pad2(when % 60) + ' ' + dest, 18));
        stat.push(var_lr(dest, var_STATUS[(i * 7 + t.days * 3 + t.h) % var_STATUS.length], 18));
      }
      pages.push(times, stat);
    }
    return pages;
  }
  function var_almanacPages(ctx) {
    var t = ctx.t, ev = sunEvents(t), me = moonEvents(t), sun = ctx.sun, moon = ctx.moon;
    var deg = function (v) { return (v < 0 ? '-' : '') + Math.abs(Math.round(v)) + '°'; };
    var dl = '--:--';
    if (ev.rise.indexOf('-') < 0 && ev.set.indexOf('-') < 0) {
      var d = (+ev.set.slice(0, 2) * 60 + +ev.set.slice(3)) - (+ev.rise.slice(0, 2) * 60 + +ev.rise.slice(3));
      dl = pad2(Math.floor(d / 60)) + ':' + pad2(d % 60);
    }
    return [
      [lr('SUNRISE', ev.rise, 18), lr('SUNSET', ev.set, 18), lr('MOONRISE', me.rise, 18), lr('MOONSET', me.set, 18)],
      [lr('SUN AZ', deg(sun.az), 18), lr('SUN ALT', deg(sun.el), 18), lr('MOON AZ', deg(moon.az), 18), lr('MOON ALT', deg(moon.el), 18)],
      [fit(moonName(moon), 18), lr('LIT', Math.round(moon.illum * 100) + '%', 18), lr('AGE', Math.round(moon.age * 29.53) + ' DAYS', 18), lr('DAY OF YEAR', dayOfYear(t), 18)],
      [lr('DAYLIGHT', dl, 18), lr('LAT', '30.31N', 18), lr('LON', '104.02W', 18), lr('ZONE', t.zone, 18)]
    ];
  }
  var var_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  // the equation of time in minutes: sundial time minus clock time
  function var_eot(utc) {
    var n = jd(utc) - 2451545.0, L = ((280.46 + 0.9856474 * n) % 360 + 360) % 360, e = L - sunEq(utc).ra * R2D;
    e = ((e % 360) + 540) % 360 - 180;
    return 4 * e;
  }
  function var_rectPath(x0, y0, x1, y1) {
    return new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  }
  // a square plate with the numerals cut clean through, stencil style: the
  // seven segments keep their bridges so no counter falls out
  var var_SEGS = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
  function var_stencilPlate(s, txt) {
    var sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(s, 0), new THREE.Vector2(s, s), new THREE.Vector2(0, s)]);
    var n = txt.length, dh = s * 0.74, dw = dh * 0.54, gd = dh * 0.14, th = dh * 0.2, br = dh * 0.04;
    var x0 = (s - (n * dw + (n - 1) * gd)) / 2, y0 = (s - dh) / 2 + s * 0.02, h2 = dh / 2;
    for (var i = 0; i < n; i++) {
      var X = x0 + i * (dw + gd), seg = var_SEGS[txt[i]] || '';
      var R = {
        a: [th + br, dh - th, dw - th - br, dh], g: [th + br, h2 - th / 2, dw - th - br, h2 + th / 2], d: [th + br, 0, dw - th - br, th],
        f: [0, h2 + th / 2 + br, th, dh - br], b: [dw - th, h2 + th / 2 + br, dw, dh - br],
        e: [0, br, th, h2 - th / 2 - br], c: [dw - th, br, dw, h2 - th / 2 - br]
      };
      for (var k = 0; k < seg.length; k++) { var q = R[seg[k]]; sh.holes.push(var_rectPath(X + q[0], y0 + q[1], X + q[2], y0 + q[3])); }
    }
    return sh;
  }
  // a plate perforated as a halftone of the sun: the disc climbs through the
  // morning plates and sets through the evening ones
  function var_perfPlate(s, frac) {
    var sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(s, 0), new THREE.Vector2(s, s), new THREE.Vector2(0, s)]);
    var n = 7, cell = s * 0.86 / n, m0 = s * 0.07, cx = 0.5, cy = 0.18 + 0.6 * Math.sin(Math.PI * frac);
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var u = (i + 0.5) / n, v = (j + 0.5) / n, d = Math.sqrt((u - cx) * (u - cx) + (v - cy) * (v - cy));
      var f = clamp(1.25 - d * 2.1, 0, 1), rad = cell * 0.44 * f;
      if (rad < cell * 0.1) continue;
      var p = new THREE.Path(); p.absarc(m0 + (i + 0.5) * cell, m0 + (j + 0.5) * cell, rad, 0, Math.PI * 2, true);
      sh.holes.push(p);
    }
    return sh;
  }

  // ------------------------------------------------------------ dial helpers
  function arcText(g, text, cx, cy, rad, mid, bottom) {
    var n = text.length, step = (g.measureText('M').width * 0.92) / rad, span = step * (n - 1);
    for (var i = 0; i < n; i++) {
      var a = bottom ? mid + span / 2 - i * step : mid - span / 2 + i * step;
      g.save(); g.translate(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
      g.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
      g.fillText(text[i], 0, 0); g.restore();
    }
  }
  function speckle(g, S, r, n, a) {
    for (var i = 0; i < n; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + a + ')';
      g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3);
    }
  }

  // =====================================================================
  // 1. HORIZONTAL SUNDIAL
  // A true dial for latitude 30.3. The hour lines are corrected for Marfa's
  // longitude, so the shadow reads Central Time to within the equation of
  // time. At night the moon casts the same shadow, and reads wrong.
  // =====================================================================
  function clockHorizontal(W, matName) {
    var r = W.r, g = new THREE.Group(), md = MATERIALS[matName], dst = W.dst;
    var T = W.P.clockTraits, R = rf(r, 2.5, 3.1), ph = rf(r, 0.55, 0.85);
    var seg = { 'Round': 72, 'Octagon': 8, 'Dodecagon': 12 }[T['Plinth']], pierced = T['Gnomon'] === 'Pierced';
    var stone = (md.metal > 0.5) ? mtl('#BDB3A4', 'stone', 0.9, 0, 1.2) : heroMat(matName);
    var step = cyl(R * 1.42, R * 1.48, 0.16, seg, mtl('#A99F90', 'concrete', 0.95, 0, 1.6)); step.position.y = 0.08; g.add(step);
    var pl = cyl(R * 1.05, R * 1.1, ph, seg, stone); pl.position.y = 0.16 + ph / 2; g.add(pl);
    var top = 0.16 + ph;
    // The noon mark. A bead on the style (the nodus) throws a point of shadow.
    // At one clock time on every day of the year that point walks a figure
    // eight: the analemma, drawn here from the sun model, so the dial corrects
    // for the equation of time. Date lines are the bead's path on the
    // solstices and the equinox. The trait comes from its own stream, so the
    // builder's draws are unchanged.
    var mark = T['Noon Mark'] || 'None', Lb0 = R * 0.66, nu = Lb0 * 0.55, nh = nu * Math.tan(PHI);
    function nodusShadow(el, az) {
      var sv = dirAzEl(az, el);
      return [-sv.x * nh / sv.y, -nu - sv.z * nh / sv.y];
    }
    function noonMark(gc, cx, k) {
      var lim = R * 0.86, y0 = daysFromCivil(2027, 1, 1), hours = mark === 'Every Hour' ? [9, 10, 11, 12, 13, 14, 15] : [12];
      function on(p) { return p[0] * p[0] + p[1] * p[1] < lim * lim; }
      gc.save(); gc.strokeStyle = md.trim; gc.fillStyle = md.trim; gc.lineJoin = 'round';
      hours.forEach(function (H) {
        var pts = [], d, p, sp;
        for (d = 0; d <= 365; d += 2) {
          sp = sunPos((y0 + d) * 86400 + (H + 6) * 3600);
          if (sp.el < 4) { pts.push(null); continue; }
          p = nodusShadow(sp.el, sp.az); pts.push(on(p) ? p : null);
        }
        gc.lineWidth = H === 12 ? 6 : 4; gc.beginPath();
        var pen = false;
        pts.forEach(function (q) {
          if (!q) { pen = false; return; }
          if (pen) gc.lineTo(cx + q[0] * k, cx + q[1] * k); else gc.moveTo(cx + q[0] * k, cx + q[1] * k);
          pen = true;
        });
        gc.stroke();
        // a dot on the first of every month
        for (var mo = 1; mo <= 12; mo++) {
          sp = sunPos(daysFromCivil(2027, mo, 1) * 86400 + (H + 6) * 3600);
          if (sp.el < 4) continue;
          p = nodusShadow(sp.el, sp.az);
          if (on(p)) { gc.beginPath(); gc.arc(cx + p[0] * k, cx + p[1] * k, H === 12 ? 11 : 7, 0, 6.2832); gc.fill(); }
        }
      });
      if (mark === 'Date Lines') {
        gc.lineWidth = 4; gc.font = '400 28px ' + FONT_MONO; gc.textBaseline = 'middle'; gc.textAlign = 'center';
        [[23.44, 'JUN 21'], [0, 'EQUINOX'], [-23.44, 'DEC 21']].forEach(function (L) {
          var dec = L[0] * D2R, last = null, first = null; gc.beginPath();
          for (var ha = -110; ha <= 110; ha += 2) {
            var a = altAz(0, dec, ha * D2R);
            if (a.el < 6) continue;
            var q = nodusShadow(a.el, a.az);
            if (!on(q)) continue;
            if (last) gc.lineTo(cx + q[0] * k, cx + q[1] * k); else { gc.moveTo(cx + q[0] * k, cx + q[1] * k); first = q; }
            last = q;
          }
          gc.stroke();
          if (last) gc.fillText(L[1], cx + last[0] * k - 70, cx + last[1] * k + 26);
        });
      }
      // the label sits past the winter end of the noon figure, the far end from the gnomon
      var ws = sunPos((y0 + 354) * 86400 + 18 * 3600), tip = nodusShadow(ws.el, ws.az);
      gc.font = '700 30px ' + FONT_MONO; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      gc.fillText(mark === 'Every Hour' ? 'CLOCK TIME' : 'NOON', cx + tip[0] * k, cx + tip[1] * k - 44);
      gc.restore();
    }
    var dtex = canvasTex(2048, 2048, function (gc, S) {
      var k = S / 2 / R, cx = S / 2, rr = seedRng(W.P.seed + 11);
      gc.fillStyle = md.color; gc.fillRect(0, 0, S, S);
      speckle(gc, S, rr, 9000, 0.06);
      gc.strokeStyle = md.trim; gc.fillStyle = md.trim;
      gc.lineWidth = 10; gc.beginPath(); gc.arc(cx, cx, R * 0.965 * k, 0, 6.2832); gc.stroke();
      gc.lineWidth = 3; gc.beginPath(); gc.arc(cx, cx, R * 0.88 * k, 0, 6.2832); gc.stroke();
      for (var H = 5; H <= 20.001; H += 0.25) {
        var ha = haForClock(H);
        if (Math.abs(ha) > 118) continue;
        var th = Math.atan2(SPHI * Math.sin(ha * D2R), Math.cos(ha * D2R));
        var q = Math.round(H * 4) % 4, full = q === 0, halfH = q === 2;
        var r0 = full ? 0.14 : halfH ? 0.6 : 0.76, r1 = 0.88;
        gc.lineWidth = full ? 9 : halfH ? 5 : 3;
        gc.beginPath();
        gc.moveTo(cx + Math.sin(th) * r0 * R * k, cx - Math.cos(th) * r0 * R * k);
        gc.lineTo(cx + Math.sin(th) * r1 * R * k, cx - Math.cos(th) * r1 * R * k);
        gc.stroke();
        if (full) {
          var lab = String((Math.round(H) + (dst ? 1 : 0)) % 24);
          gc.save(); gc.translate(cx + Math.sin(th) * 0.925 * R * k, cx - Math.cos(th) * 0.925 * R * k); gc.rotate(th);
          gc.font = '700 76px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText(lab, 0, 0); gc.restore();
        }
      }
      if (mark !== 'None') noonMark(gc, cx, k);
      gc.font = '700 44px ' + FONT_SERIF; gc.textBaseline = 'middle';
      arcText(gc, T['Motto'], cx, cx, R * 0.995 * k - 40, Math.PI / 2, true);
      gc.font = '400 30px ' + FONT_MONO;
      arcText(gc, 'MARFA  30°18\'N 104°01\'W  MLOW.XYZ', cx, cx, R * 0.36 * k, Math.PI / 2, true);
      // a noon mark fills the north side, so the zone moves under the coordinates
      if (mark === 'None') arcText(gc, dst ? 'CENTRAL DAYLIGHT TIME' : 'CENTRAL STANDARD TIME', cx, cx, R * 0.36 * k, -Math.PI / 2, false);
      else arcText(gc, dst ? 'CENTRAL DAYLIGHT TIME' : 'CENTRAL STANDARD TIME', cx, cx, R * 0.28 * k, Math.PI / 2, true);
      gc.font = '700 90px ' + FONT_SERIF; gc.textAlign = 'center'; gc.fillText('N', cx, cx - R * 0.965 * k + 70);
    });
    var dial = new THREE.Mesh(new THREE.CircleBufferGeometry(R, 96), detail(new THREE.MeshStandardMaterial({ map: dtex, roughness: md.rough, metalness: md.metal * 0.8 }), md.tex, { tile: md.tile, albedo: 0.35 }));
    dial.rotation.x = -Math.PI / 2; dial.position.y = top + 0.002; g.add(dial);
    // the gnomon: its sloping edge points at the celestial pole
    var Lb = R * 0.66, hmax = Lb * Math.tan(PHI), t = pick(r, [0.04, 0.07, 0.12]);
    var sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(Lb, 0), new THREE.Vector2(Lb, hmax)]);
    if (pierced) {
      for (var i = 0; i < 5; i++) {
        var s = hmax * rf(r, 0.16, 0.24), u = rf(r, 0.42, 0.86) * Lb, vmax = u * Math.tan(PHI);
        var v = rf(r, 0.06, 0.5) * vmax;
        if (u + s / 2 > Lb - 0.05 || v - s / 2 < 0.04 || v + s / 2 > (u - s / 2) * Math.tan(PHI) - 0.04) continue;
        var clash = sh.holes.some(function (hh) { return hh.userData && Math.abs(hh.userData[0] - u) < (hh.userData[2] + s) / 2 + 0.03 && Math.abs(hh.userData[1] - v) < (hh.userData[2] + s) / 2 + 0.03; });
        if (clash) continue;
        var hole = new THREE.Path(primAt(ri(r, 0, 5), ri(r, 0, 3), u - s / 2, v - s / 2, s, 0.9, false));
        hole.userData = [u, v, s];
        sh.holes.push(hole);
      }
    }
    var gg = new THREE.ExtrudeBufferGeometry(sh, { depth: t, bevelEnabled: false });
    gg.translate(0, 0, -t / 2);
    var gm = new THREE.Mesh(gg, md.metal > 0.5 ? heroMat(matName) : std('#2E2A26', 0.4, 0.8));
    gm.rotation.y = Math.PI / 2; gm.position.y = top + 0.002; g.add(gm);
    var boss = cyl(0.09, 0.12, 0.05, 16, gm.material); boss.position.y = top + 0.02; g.add(boss);
    if (mark !== 'None') {
      var bead = new THREE.Mesh(new THREE.SphereBufferGeometry(Math.max(0.05, t * 0.9), 16, 12), gm.material);
      bead.position.set(0, top + 0.002 + nh, -nu); g.add(bead);
    }
    shade(g);
    return { group: g, R: R * 1.5, lookY: top * 0.4, dist: rf(r, 6.4, 7.6), camH: [4.4, 5.8], face: false, gnomon: pierced ? 'Pierced' : 'Solid' };
  }

  // =====================================================================
  // 2. ANALEMMATIC SUNDIAL
  // The gnomon is a person. They stand on today's date and their own shadow
  // points at the hour. Here the person is a New Yorker.
  // =====================================================================
  function clockAnalemmatic(W, matName) {
    var r = W.r, g = new THREE.Group(), md = MATERIALS[matName], dst = W.dst;
    var T = W.P.clockTraits || {}, pv = T['Pavement'] || 'Rings', mk = T['Hour Markers'] || 'Stones', fig = T['Date Scale'] === 'Figure Eight';
    var M = rf(r, 4.2, 5.0), minor = M * SPHI, Rp = M + 1.4;
    var ptex = canvasTex(2048, 2048, function (gc, S) {
      var k = S / 2 / Rp, cx = S / 2, rr = seedRng(W.P.seed + 12), i;
      gc.fillStyle = md.color; gc.fillRect(0, 0, S, S);
      speckle(gc, S, rr, 12000, 0.07);
      if (pv === 'Flagstones') {
        // random ashlar: courses of flags in running bond, each its own tone
        var row;
        for (var y = 0; y < S; y += row) {
          row = (0.45 + rr() * 0.4) * k;
          var x = -rr() * 0.8 * k;
          while (x < S) {
            var w = (0.55 + rr() * 0.7) * k, tone = rr();
            gc.fillStyle = tone < 0.5 ? 'rgba(40,30,20,' + (0.03 + tone * 0.16) + ')' : 'rgba(255,250,240,' + ((tone - 0.5) * 0.22) + ')';
            gc.fillRect(x, y, w, row);
            gc.strokeStyle = 'rgba(0,0,0,0.3)'; gc.lineWidth = 4; gc.strokeRect(x, y, w, row);
            x += w;
          }
        }
      } else if (pv === 'Compass Rose') {
        // a 32 point rose under the whole dial, shaded half and half
        gc.save(); gc.translate(cx, cx);
        for (i = 31; i >= 0; i--) {
          var a = i / 32 * 6.2832, L = (i % 8 === 0 ? 0.97 : i % 4 === 0 ? 0.7 : i % 2 === 0 ? 0.5 : 0.36) * Rp * k, hw = L * 0.11;
          var ux = Math.sin(a), uy = -Math.cos(a), px = -uy, py = ux;
          gc.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.2)';
          gc.beginPath(); gc.moveTo(0, 0); gc.lineTo(ux * L, uy * L); gc.lineTo(ux * L * 0.16 + px * hw, uy * L * 0.16 + py * hw); gc.closePath(); gc.fill();
          gc.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)';
          gc.beginPath(); gc.moveTo(0, 0); gc.lineTo(ux * L, uy * L); gc.lineTo(ux * L * 0.16 - px * hw, uy * L * 0.16 - py * hw); gc.closePath(); gc.fill();
        }
        gc.strokeStyle = 'rgba(0,0,0,0.22)'; gc.lineWidth = 3;
        [0.36, 0.72, 0.86].forEach(function (f) { gc.beginPath(); gc.arc(0, 0, Rp * k * f, 0, 6.2832); gc.stroke(); });
        gc.restore();
      } else {
        gc.strokeStyle = 'rgba(0,0,0,0.18)'; gc.lineWidth = 2;
        for (var ring = 1; ring < 6; ring++) { gc.beginPath(); gc.arc(cx, cx, Rp * k * ring / 6, 0, 6.2832); gc.stroke(); }
      }
      gc.strokeStyle = md.trim; gc.lineWidth = 8;
      gc.beginPath(); gc.ellipse(cx, cx, M * k, minor * k, 0, 0, 6.2832); gc.stroke();
      // the date scale, north up
      var zlo = M * CPHI * Math.tan(-23.44 * D2R), zhi = M * CPHI * Math.tan(23.44 * D2R);
      gc.lineWidth = 16; gc.strokeStyle = md.trim;
      gc.beginPath(); gc.moveTo(cx, cx - zlo * k); gc.lineTo(cx, cx - zhi * k); gc.stroke();
      gc.fillStyle = md.trim; gc.font = '700 40px ' + FONT_MONO; gc.textBaseline = 'middle';
      // with the figure eight the month names stand clear of its loops, on leaders
      var eK = 0.06 * k, lx = fig ? 16.5 * eK + 70 : 40;
      for (var mo = 1; mo <= 12; mo++) {
        var dec = sunEq(marfaUtc(2027, mo, 1, 12, 0)).dec, z = M * CPHI * Math.tan(dec);
        var yy = cx - z * k, left = mo >= 7;
        gc.fillRect(cx - 26, yy - 3, 52, 6);
        if (fig) { gc.fillRect(left ? cx - lx + 10 : cx + 26, yy - 1.5, lx - 36, 3); }
        gc.textAlign = left ? 'right' : 'left';
        gc.fillText(MONTHS[mo - 1], cx + (left ? -lx : lx), yy);
      }
      if (fig) {
        // the equation of time as a figure eight: each day's point sits at its
        // date, pushed east by the minutes the sun runs fast, west when slow
        var y0 = marfaUtc(2027, 1, 1, 12, 0), pts = [], d, u;
        for (d = 0; d <= 366; d += 2) {
          u = y0 + d * 86400;
          pts.push([cx + var_eot(u) * eK, cx - M * CPHI * Math.tan(sunEq(u).dec) * k]);
        }
        gc.lineWidth = 7; gc.lineJoin = 'round'; gc.beginPath();
        pts.forEach(function (p, j) { if (j) gc.lineTo(p[0], p[1]); else gc.moveTo(p[0], p[1]); });
        gc.stroke();
        for (mo = 1; mo <= 12; mo++) {
          u = marfaUtc(2027, mo, 1, 12, 0);
          gc.beginPath(); gc.arc(cx + var_eot(u) * eK, cx - M * CPHI * Math.tan(sunEq(u).dec) * k, 12, 0, 6.2832); gc.fill();
        }
        gc.font = '700 28px ' + FONT_MONO; gc.textAlign = 'center';
        var yb = cx - zlo * k + 40;
        gc.fillText('SUN SLOW', cx - 10 * eK, yb); gc.fillText('SUN FAST', cx + 10 * eK, yb);
      }
      gc.font = '700 46px ' + FONT_SERIF; gc.textAlign = 'center';
      arcText(gc, 'STAND ON TODAY. YOUR SHADOW IS THE HAND.', cx, cx, Rp * 0.93 * k, Math.PI / 2, true);
      gc.font = '400 34px ' + FONT_MONO;
      arcText(gc, 'NEW YORKERS  N3WYORKERS.COM  MLOW.XYZ', cx, cx, Rp * 0.93 * k, -Math.PI / 2, false);
      gc.font = '700 80px ' + FONT_SERIF; gc.fillText('N', cx, cx - (minor + 0.55) * k);
    });
    var base = cyl(Rp, Rp + 0.1, 0.12, 96, std('#A79D8E', 0.95)); base.position.y = 0.06; g.add(base);
    var pave = new THREE.Mesh(new THREE.CircleBufferGeometry(Rp, 96), detail(new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.9 }), 'stone', { tile: 1.4, albedo: 0.3 }));
    pave.rotation.x = -Math.PI / 2; pave.position.y = 0.121; g.add(pave);
    var stoneM = heroMat(matName), bronze = mtl('#A07A45', 'brushed', 0.5, 0.55, 0.6);
    for (var H = 6; H <= 19; H++) {
      var ha = haForClock(H);
      if (Math.abs(ha) > 112) continue;
      var x = M * Math.sin(ha * D2R), z = -minor * Math.cos(ha * D2R), txt = String((H + (dst ? 1 : 0)) % 24);
      var inward = Math.atan2(-x, -z), lab;
      if (mk === 'Posts') {
        // square posts turned to the centre, a pyramid cap, the hour on both faces
        var post = box(0.22, 1.0, 0.22, stoneM); post.position.set(x, 0.12 + 0.5, z); post.rotation.y = inward; g.add(post);
        var capP = new THREE.Mesh(new THREE.ConeBufferGeometry(0.2, 0.18, 4), stoneM);
        capP.position.set(x, 0.12 + 1.09, z); capP.rotation.y = inward + Math.PI / 4; g.add(capP);
        var foot = cyl(0.3, 0.33, 0.06, 20, std('#8E8577', 0.95)); foot.position.set(x, 0.15, z); g.add(foot);
        [0, Math.PI].forEach(function (flip) {
          var pl = textPlane(txt, { color: md.trim, height: 0.24, px: 110, pad: 0.1 });
          pl.rotation.y = inward + flip; pl.position.set(x + Math.sin(inward + flip) * 0.112, 0.12 + 0.76, z + Math.cos(inward + flip) * 0.112); g.add(pl);
        });
      } else if (mk === 'Plaques') {
        // bronze plaques set flush in the paving, the hour cast in relief
        var pq = box(0.66, 0.03, 0.66, bronze); pq.position.set(x, 0.126, z); pq.rotation.y = inward; g.add(pq);
        var rim = box(0.74, 0.012, 0.74, std('#3B3026', 0.6, 0.5)); rim.position.set(x, 0.122, z); rim.rotation.y = inward; g.add(rim);
        lab = textPlane(txt, { color: '#E9D3A0', height: 0.44, px: 110, pad: 0.1 });
        lab.rotation.set(-Math.PI / 2, 0, inward + Math.PI); lab.position.set(x, 0.143, z); g.add(lab);
      } else {
        var st = cyl(0.36, 0.4, 0.26, 20, stoneM); st.position.set(x, 0.12 + 0.13, z); g.add(st);
        lab = textPlane(txt, { color: md.trim, height: 0.42, px: 110, pad: 0.1 });
        lab.rotation.x = -Math.PI / 2; lab.position.set(x, 0.12 + 0.262, z); g.add(lab);
      }
    }
    var who = newYorker(r, W);
    who.position.set(0, 0.12, 0); g.add(who);
    shade(g);
    return {
      group: g, R: Rp + 0.4, lookY: 0.9, dist: rf(r, 10, 12.5), camH: [3.6, 5.2], face: false,
      update: function (ctx) {
        var dec = sunEq(ctx.utc).dec;
        who.position.z = -M * CPHI * Math.tan(dec);
        who.userData.update(ctx);
      }
    };
  }

  // =====================================================================
  // 3. ARMILLARY SPHERE
  // An equatorial dial. The rod points at the pole; its shadow falls on the
  // inside of the equator band, where the hours are.
  // =====================================================================
  var var_ZODIAC = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
  function clockArmillary(W, matName) {
    var r = W.r, g = new THREE.Group(), m = heroMat(matName), Ra = rf(r, 1.45, 1.8);
    var T = W.P.clockTraits || {}, rings = T['Rings'] || 'Classic', baseK = T['Base'] || 'Drum';
    var mdb = std('#A89F92', 0.9), plaque = textPlane(['MARFA  30.3° N', 'MLOW.XYZ'], { color: '#2A2520', height: 0.2, px: 60, font: FONT_MONO, pad: 0.1 });
    if (baseK === 'Stepped') {
      // three octagonal steps and a turned baluster
      [[1.42, 1.48, 0.26, 0.13], [1.08, 1.13, 0.2, 0.36], [0.76, 0.8, 0.18, 0.55]].forEach(function (q) {
        var st = cyl(q[0], q[1], q[2], 8, mdb); st.rotation.y = Math.PI / 8; st.position.y = q[3]; g.add(st);
      });
      var prof = [[0.001, 0], [0.34, 0], [0.34, 0.06], [0.25, 0.1], [0.2, 0.17], [0.27, 0.32], [0.29, 0.44], [0.23, 0.62], [0.15, 0.8], [0.12, 0.94], [0.17, 1.0], [0.17, 1.06], [0.12, 1.1], [0.12, 1.17], [0.001, 1.17]];
      var lathe = new THREE.Mesh(new THREE.LatheBufferGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 28), m);
      lathe.position.y = 0.64; g.add(lathe);
      plaque.scale.setScalar(0.85); plaque.position.set(0, 0.13, 1.375); g.add(plaque);
    } else if (baseK === 'Tripod') {
      // three S-curved legs on a stone disc, a collar where they pass
      var disc = cyl(1.4, 1.46, 0.12, 48, mdb); disc.position.y = 0.06; g.add(disc);
      var collarR = 0, collarY = 0;
      for (var l = 0; l < 3; l++) {
        var a = l * 2.0944 + Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
        var P = function (rad, y) { return new THREE.Vector3(ca * rad, y, sa * rad); };
        var curve = new THREE.CatmullRomCurve3([P(0.1, 1.8), P(0.26, 1.5), P(0.62, 1.05), P(0.72, 0.6), P(0.98, 0.3), P(1.08, 0.2)]);
        var leg = new THREE.Mesh(new THREE.TubeBufferGeometry(curve, 40, 0.045, 8, false), m); g.add(leg);
        var ball = sph(0.09, m, 16, 12); ball.position.copy(P(1.1, 0.2)); g.add(ball);
        var mid = curve.getPointAt(0.5); collarR = Math.sqrt(mid.x * mid.x + mid.z * mid.z); collarY = mid.y;
      }
      var collar = new THREE.Mesh(new THREE.TorusBufferGeometry(collarR, 0.035, 8, 48), m); collar.rotation.x = Math.PI / 2; collar.position.y = collarY; g.add(collar);
      var hub = cyl(0.16, 0.12, 0.22, 20, m); hub.position.y = 1.72; g.add(hub);
      var pb = box(plaque.userData.w + 0.08, 0.035, plaque.userData.h + 0.06, m); pb.position.set(0, 0.16, 1.08); pb.rotation.x = 0.5; g.add(pb);
      plaque.rotation.x = -Math.PI / 2 + 0.5; plaque.position.set(0, 0.16 + 0.02 * Math.cos(0.5), 1.08 + 0.02 * Math.sin(0.5)); g.add(plaque);
    } else {
      var base = cyl(0.85, 1.0, 0.4, 24, mdb); base.position.y = 0.2; g.add(base);
      var col = cyl(0.14, 0.22, 1.4, 20, m); col.position.y = 1.1; g.add(col);
      plaque.position.set(0, 0.3, 1.01); g.add(plaque);
    }
    var cy = 1.8 + Ra * 0.92;
    var yoke = new THREE.Mesh(new THREE.TorusBufferGeometry(Ra * 0.55, 0.045, 10, 40, Math.PI), m);
    yoke.rotation.z = Math.PI; yoke.rotation.y = Math.PI / 2; yoke.position.y = 1.8 + Ra * 0.55 + 0.05 - Ra * 0.1; g.add(yoke);
    var s = new THREE.Group(); s.position.y = cy; g.add(s);
    var mer = new THREE.Mesh(new THREE.TorusBufferGeometry(Ra, 0.05, 10, 96), m); mer.rotation.y = Math.PI / 2; s.add(mer);
    if (rings !== 'Equatorial') { var hor = new THREE.Mesh(new THREE.TorusBufferGeometry(Ra, 0.04, 10, 96), m); hor.rotation.x = Math.PI / 2; s.add(hor); }
    var P3 = new THREE.Vector3(0, SPHI, -CPHI), up = new THREE.Vector3(0, 1, 0);
    var bandM = heroMat(matName); bandM.side = THREE.DoubleSide;
    var band = new THREE.Mesh(new THREE.CylinderBufferGeometry(Ra * 0.97, Ra * 0.97, 0.3, 128, 1, true), bandM);
    band.quaternion.setFromUnitVectors(up, P3); s.add(band);
    if (rings !== 'Equatorial') [-23.44, 23.44].forEach(function (lat) {
      var tr = new THREE.Mesh(new THREE.TorusBufferGeometry(Ra * Math.cos(lat * D2R), 0.022, 8, 96), m);
      tr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), P3);
      tr.position.copy(P3).multiplyScalar(Ra * Math.sin(lat * D2R)); s.add(tr);
    });
    // Celestial: the ecliptic and the solstitial colure turn with the stars.
    // In the sky group, +Y is the pole and +X the spring equinox; the group is
    // set from sidereal time every frame, so the bead on the ecliptic at the
    // sun's longitude lies on the line from the centre to the real sun.
    var sky = null, sunBead = null, EPS = 23.44 * D2R, Re = Ra * 0.9;
    if (rings === 'Celestial') {
      sky = new THREE.Group(); s.add(sky);
      // 4096 x 96 keeps the letters square on a band 0.21 m tall and about 8 m round
      var ink = MATERIALS[matName].trim, zt = canvasTex(4096, 96, function (gc, Wd, Hd) {
        gc.fillStyle = MATERIALS[matName].color; gc.fillRect(0, 0, Wd, Hd);
        gc.fillStyle = 'rgba(0,0,0,0.12)'; gc.fillRect(0, 0, Wd, 6); gc.fillRect(0, Hd - 6, Wd, 6);
        gc.fillStyle = ink; gc.textAlign = 'center'; gc.textBaseline = 'middle';
        for (var z = 0; z < 12; z++) {
          var u = (((z * 30 + 15 + 90) / 360) % 1) * Wd, name = var_ZODIAC[z];
          gc.font = '700 48px ' + FONT_SERIF;
          var tw = gc.measureText(name).width, seg = Wd / 12 - 60;
          gc.save(); gc.translate(u, Hd / 2 + 2); if (tw > seg) gc.scale(seg / tw, 1); gc.fillText(name, 0, 0); gc.restore();
          var ub = (((z * 30 + 90) / 360) % 1) * Wd;
          gc.fillRect(ub - 3, 0, 6, Hd);
        }
        for (var dg = 0; dg < 360; dg += 5) { var ut = (((dg + 90) / 360) % 1) * Wd; gc.fillRect(ut - 1.5, 0, 3, dg % 10 ? 12 : 20); }
      });
      var ecM = new THREE.MeshStandardMaterial({ map: zt, roughness: MATERIALS[matName].rough, metalness: MATERIALS[matName].metal * 0.8, side: THREE.DoubleSide });
      var ecl = new THREE.Mesh(new THREE.CylinderBufferGeometry(Re, Re, 0.21, 128, 1, true), ecM);
      ecl.rotation.x = EPS; sky.add(ecl);
      var colure = new THREE.Mesh(new THREE.TorusBufferGeometry(Ra * 0.94, 0.022, 8, 96), m); colure.rotation.y = Math.PI / 2; sky.add(colure);
      sunBead = sph(0.075, W.glow(glowMat('#FFC766', 0.9), 0.9, 1.6), 16, 12); sky.add(sunBead);
    }
    var rodL = Ra * 2.5, rod = cyl(0.026, 0.026, rodL, 10, m); rod.quaternion.setFromUnitVectors(up, P3); s.add(rod);
    var tip = new THREE.Mesh(new THREE.ConeBufferGeometry(0.09, 0.3, 12), m);
    tip.quaternion.setFromUnitVectors(up, P3); tip.position.copy(P3).multiplyScalar(rodL / 2 + 0.12); s.add(tip);
    for (var f = 0; f < 3; f++) {
      var fl = box(0.02, 0.28, 0.16, m); fl.quaternion.setFromUnitVectors(up, P3);
      fl.rotateOnAxis(up, f * 2.094); fl.translateZ(0.08);
      fl.position.add(P3.clone().multiplyScalar(-rodL / 2 + 0.16)); s.add(fl);
    }
    var earth = sph(0.1, std(BRAND.blue, 0.4, 0.2)); s.add(earth);
    // hour numerals inside the band
    var Q0 = new THREE.Vector3(0, CPHI, SPHI), Wd = new THREE.Vector3(-1, 0, 0), ink2 = MATERIALS[matName].trim;
    for (var H = 5; H <= 20.01; H += 0.5) {
      var ha = haForClock(H) * D2R;
      if (Math.abs(ha) > 120 * D2R) continue;
      var sdir = Q0.clone().multiplyScalar(-Math.cos(ha)).addScaledVector(Wd, -Math.sin(ha)).normalize();
      var n = sdir.clone().negate(), xAxis = P3.clone().cross(n).normalize();
      var basis = new THREE.Matrix4().makeBasis(xAxis, P3, n);
      var full = Math.abs(H - Math.round(H)) < 0.01;
      var tick = box(0.012, full ? 0.28 : 0.14, 0.012, std(ink2, 0.5));
      tick.quaternion.setFromRotationMatrix(basis); tick.position.copy(sdir).multiplyScalar(Ra * 0.955); s.add(tick);
      if (full) {
        var lab = textPlane(String((Math.round(H) + (W.dst ? 1 : 0)) % 24), { color: ink2, height: 0.12, px: 90, pad: 0.05 });
        lab.quaternion.setFromRotationMatrix(basis);
        lab.position.copy(sdir).multiplyScalar(Ra * 0.95).addScaledVector(P3, 0.085); s.add(lab);
      }
    }
    shade(g);
    var vx = new THREE.Vector3(), vz = new THREE.Vector3(), mb = new THREE.Matrix4();
    return {
      group: g, R: Ra + 0.8, lookY: cy * 0.82, dist: rf(r, 6.2, 8), camH: [1.9, 3.3], face: false,
      update: sky ? function (ctx) {
        var L = lst(ctx.utc), lam = sunEq(ctx.utc).lon;
        vx.copy(Q0).multiplyScalar(Math.cos(L)).addScaledVector(Wd, Math.sin(L));
        vz.copy(vx).cross(P3);
        mb.makeBasis(vx, P3, vz); sky.quaternion.setFromRotationMatrix(mb);
        // the ecliptic at longitude lam, in the sky group's frame
        sunBead.position.set(Math.cos(lam) * Re, Math.sin(lam) * Math.sin(EPS) * Re, -Math.sin(lam) * Math.cos(EPS) * Re);
      } : undefined
    };
  }

  // =====================================================================
  // 4. SPLIT-FLAP BOARD
  // A departures board with nowhere to depart to. The big row is Marfa time.
  // =====================================================================
  function clockFlapBoard(W, matName) {
    var r = W.r, g = new THREE.Group(), hm = heroMat(matName), dark = std('#0C0D0F', 0.7, 0.2);
    var T = W.P.clockTraits || {}, nRows = { 'Two Rows': 2, 'Four Rows': 4, 'Six Rows': 6 }[T['Board']] || 4;
    var src = T['Pages'] === 'Departures' ? var_departurePages : T['Pages'] === 'Almanac' ? var_almanacPages : boardPages;
    var cols = 18, cw = 0.34, ch = 0.46, gap = 0.035, Wb = cols * (cw + gap) + 0.5;
    var bw = 0.78, bh = 1.06, legH = rf(r, 1.2, 2.0);
    // six rows stand on shorter legs so the board stays under its 7 m
    if (nRows === 6) legH = 0.85 + (legH - 1.2) * 0.4;
    if (nRows === 2) legH += 0.5;
    var Hb = 0.45 + bh + 0.3 + nRows * (ch + 0.06) + 0.35;
    var y0 = legH + Hb / 2;
    var housing = box(Wb + 0.34, Hb + 0.34, 0.62, hm); housing.position.y = y0; g.add(housing);
    var panel = box(Wb, Hb, 0.04, dark); panel.position.set(0, y0, 0.32); g.add(panel);
    var hood = box(Wb + 0.6, 0.12, 1.1, hm); hood.position.set(0, y0 + Hb / 2 + 0.23, 0.2); g.add(hood);
    var strip = W.glow(glowMat('#FFF2D6', 0), 0, 1.4), lampS = box(Wb, 0.03, 0.05, strip); lampS.position.set(0, y0 + Hb / 2 + 0.16, 0.7); g.add(lampS);
    [-1, 1].forEach(function (sd) {
      var leg = box(0.3, legH + 0.2, 0.42, hm); leg.position.set(sd * (Wb / 2 - 0.9), legH / 2, 0); g.add(leg);
      var foot = box(0.9, 0.12, 0.9, dark); foot.position.set(sd * (Wb / 2 - 0.9), 0.06, 0); g.add(foot);
    });
    var fm = var_flapMaterial(W, T['Flaps']), z = 0.36, top = y0 + Hb / 2;
    var head = textPlane(T['Pages'] === 'Departures' ? 'DEPARTURES' : 'MARFA · TEXAS', { color: '#ECE8DD', height: 0.3, px: 90, font: FONT_SANS, spacing: 0.12, pad: 0.1 });
    head.position.set(-Wb / 2 + 0.25 + head.userData.w / 2, top - 0.27, z); g.add(head);
    var head2 = textPlane(T['Pages'] === 'Almanac' ? 'ALMANAC' : 'LOCAL TIME', { color: '#9AA3AD', height: 0.22, px: 80, font: FONT_MONO, pad: 0.1 });
    head2.position.set(Wb / 2 - 0.25 - head2.userData.w / 2, top - 0.27, z); g.add(head2);
    var bigW = 8 * (bw * 0.86) + 7 * gap;
    var big = new FlapRow(8, bw * 0.86, bh, gap, fm, g, -bigW / 2, top - 0.45 - bh / 2, z);
    var rows = [], yy = top - 0.45 - bh - 0.3 - ch / 2;
    for (var i = 0; i < nRows; i++) { rows.push(new FlapRow(cols, cw, ch, gap, fm, g, -Wb / 2 + 0.25, yy, z)); yy -= ch + 0.06; }
    var foot2 = textPlane('MLOW · MARFA LIGHT · MLOW.XYZ', { color: '#7F8893', height: 0.16, px: 70, font: FONT_MONO, pad: 0.08 });
    foot2.position.set(0, y0 - Hb / 2 + 0.17, z); g.add(foot2);
    W.lamp('#FFE9C4', 1.6, 14, new THREE.Vector3(0, y0 + Hb / 2, 2.4), g);
    shade(g);
    var lastKey = '', lines = [];
    return {
      group: g, R: Wb / 2 + 0.8, lookY: y0 * 0.85, dist: rf(r, 12, 15), camH: [1.6, 2.6], face: true,
      update: function (ctx) {
        var t = ctx.t, snap = ctx.snap;
        big.set(pad2(t.h) + ':' + pad2(t.m) + ':' + pad2(t.s), snap);
        // two rows show half a page at a time; six add the day and the moon
        var pages = src(ctx), np = nRows === 2 ? pages.length * 2 : pages.length;
        var p = Math.floor(ctx.real / (nRows === 2 ? 4 : 8)) % np;
        if (snap) p = Math.floor(ctx.t.m / 3) % np;
        if (nRows === 2) { var pg = pages[p >> 1], hf = (p & 1) * 2; lines = [pg[hf], pg[hf + 1]]; }
        else if (nRows === 6) {
          lines = pages[p].concat([var_lr(var_DAYS[weekday(t.days)], MONTHS[t.mo - 1] + ' ' + t.d, 18),
            fit(moonName(ctx.moon), 18)]);
        } else lines = pages[p];
        var key = p + lines.join('');
        if (key !== lastKey || snap) { rows.forEach(function (row, k) { row.set(lines[k], snap); }); lastKey = key; }
        big.update(ctx.dt, ctx.fast); rows.forEach(function (row) { row.update(ctx.dt, ctx.fast); });
      }
    };
  }

  // =====================================================================
  // 5. FLIP MONUMENT
  // A bedside flip clock the size of a trailer, standing in the desert.
  // =====================================================================
  function clockFlipMonument(W, matName) {
    var r = W.r, g = new THREE.Group(), hm = heroMat(matName);
    var T = W.P.clockTraits || {}, h12 = T['Hours'] === '12 Hour', stance = T['Stance'] || 'Upright';
    // the whole clock is built in b, which the stance then props or buries
    var b = new THREE.Group(), pv = new THREE.Group(); pv.add(b); g.add(pv);
    var Wm = 6.9, Hm = 3.3, D = 2.4, rad = 1.0, legH = 0.35;
    var sh = new THREE.Shape(), x0 = -Wm / 2, y0 = -Hm / 2;
    sh.moveTo(x0 + rad, y0); sh.lineTo(x0 + Wm - rad, y0); sh.quadraticCurveTo(x0 + Wm, y0, x0 + Wm, y0 + rad);
    sh.lineTo(x0 + Wm, y0 + Hm - rad); sh.quadraticCurveTo(x0 + Wm, y0 + Hm, x0 + Wm - rad, y0 + Hm);
    sh.lineTo(x0 + rad, y0 + Hm); sh.quadraticCurveTo(x0, y0 + Hm, x0, y0 + Hm - rad);
    sh.lineTo(x0, y0 + rad); sh.quadraticCurveTo(x0, y0, x0 + rad, y0);
    var geo = new THREE.ExtrudeBufferGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 4, curveSegments: 18 });
    geo.translate(0, 0, -D / 2);
    var body = new THREE.Mesh(geo, hm); body.position.y = legH + Hm / 2 + 0.12; b.add(body);
    var cy = body.position.y, z = D / 2 + 0.13;
    var win = box(Wm - 0.7, Hm - 1.0, 0.06, std('#08090A', 0.3, 0.3)); win.position.set(0, cy - 0.1, z); b.add(win);
    var glass = new THREE.Mesh(new THREE.PlaneBufferGeometry(Wm - 0.7, Hm - 1.0), new THREE.MeshStandardMaterial({ color: C('#FFFFFF'), roughness: 0.05, metalness: 1, transparent: true, opacity: 0.08 }));
    glass.position.set(0, cy - 0.1, z + 0.12); b.add(glass);
    var fm = var_flapMaterial(W, T['Flaps']), bw = 1.02, bh = 1.62, gap = 0.07, zz = z + 0.05;
    var xs = -(Wm - 0.7) / 2 + 0.22, xS = xs + 4 * (bw + gap) + 0.38;
    var H = new FlapRow(2, bw, bh, gap, fm, b, xs, cy - 0.1, zz);
    var Mn = new FlapRow(2, bw, bh, gap, fm, b, xs + 2 * (bw + gap) + 0.22, cy - 0.1, zz);
    var S = new FlapRow(2, 0.44, 0.66, 0.05, fm, b, xS, cy - 0.1 - 0.44, zz);
    var AP = h12 ? new FlapRow(2, 0.44, 0.66, 0.05, fm, b, xS, cy - 0.1 + 0.44, zz) : null;
    var lab = textPlane('MARFA TIME', { color: MATERIALS[matName].trim, height: 0.26, px: 80, font: FONT_MONO, spacing: 0.15, pad: 0.06 });
    lab.position.set(0, cy + Hm / 2 - 0.25, z); b.add(lab);
    var mk = textPlane('MLOW.XYZ', { color: MATERIALS[matName].trim, height: 0.2, px: 70, font: FONT_MONO, pad: 0.06 });
    mk.position.set(Wm / 2 - 0.9, cy - Hm / 2 + 0.2, z); b.add(mk);
    if (stance !== 'Tipped Back') [-1, 1].forEach(function (sd) {
      var ft = cyl(0.22, 0.3, legH + 0.14, 16, std('#1A1B1E', 0.5, 0.6)); ft.position.set(sd * (Wm / 2 - 1.1), (legH + 0.14) / 2, 0); b.add(ft);
    });
    var top = cy + Hm / 2 + 0.12, look = cy * 0.8;
    if (stance === 'Tipped Back') {
      // fallen onto its back edge and propped on two boulders, face to the sky
      var tilt = 0.44, zb = -D / 2 - 0.12, Lf = D + 0.24 - 0.4;
      pv.position.z = zb; b.position.set(0, -legH, -zb); pv.rotation.x = -tilt;
      var rock = mtl('#9A8C78', 'stone', 0.95, 0, 1.2), yTop = Lf * Math.sin(tilt), zf = zb + Lf * Math.cos(tilt);
      [[-1, 0.82, 0.3], [1, 0.7, -0.5]].forEach(function (q) {
        var bo = new THREE.Mesh(new THREE.DodecahedronBufferGeometry(q[1], 0), rock);
        bo.scale.set(1.25, 1, 1.05); bo.rotation.set(q[2], q[2] * 2, 0.2);
        bo.position.set(q[0] * (Wm / 2 - 1.3), yTop - q[1] * 0.95, zf); g.add(bo);
      });
      look = (cy - legH) * 0.72;
    } else if (stance === 'Half Buried') {
      // sunk in a drift of sand banked up one side, leaning a little
      b.position.y = -0.55; pv.rotation.set(-0.05, 0, -0.045);
      var sand = mtl('#D6BF95', 'sand', 0.97, 0, 2.2);
      [[-1.2, -0.5, 4.0, 1.05, 2.3], [2.6, 1.2, 1.6, 0.35, 1.1], [0.8, -1.6, 3.2, 0.8, 1.4]].forEach(function (q) {
        var dn = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 40, 14, 0, 6.2832, 0, Math.PI / 2), sand);
        dn.scale.set(q[2], q[3], q[4]); dn.position.set(q[0], 0, q[1]); g.add(dn);
      });
      look = (cy - 0.55) * 0.8;
    }
    shade(g);
    return {
      group: g, R: Wm / 2 + 0.6, lookY: look, dist: rf(r, 11, 14), camH: [1.5, 2.4], face: true,
      update: function (ctx) {
        var t = ctx.t, hh = t.h;
        if (h12) { hh = t.h % 12 || 12; AP.set(t.h < 12 ? 'AM' : 'PM', ctx.snap); AP.update(ctx.dt, ctx.fast); }
        H.set(h12 && hh < 10 ? ' ' + hh : pad2(hh), ctx.snap); Mn.set(pad2(t.m), ctx.snap); S.set(pad2(t.s), ctx.snap);
        H.update(ctx.dt, ctx.fast); Mn.update(ctx.dt, ctx.fast); S.update(ctx.dt, true);
      }
    };
  }

  // =====================================================================
  // 6. ORBITAL
  // Three rings, three beads, and the evil eye at the centre watching the sun.
  // =====================================================================
  function clockOrbital(W, matName) {
    var r = W.r, g = new THREE.Group(), hm = heroMat(matName);
    var T = W.P.clockTraits || {}, rs = T['Rings'] || 'Wire', nMoons = { 'One': 1, 'Two': 2, 'Three': 3 }[T['Moons']] || 0;
    var pool = new THREE.Mesh(new THREE.CylinderBufferGeometry(5.4, 5.6, 0.3, 64), std('#0B0C0E', 0.08, 0.9)); pool.position.y = 0.15; g.add(pool);
    var rim = new THREE.Mesh(new THREE.TorusBufferGeometry(5.5, 0.08, 8, 96), hm); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; g.add(rim);
    var Hc = 4.7, rig = new THREE.Group(); rig.position.y = Hc; g.add(rig);
    var gate = new THREE.Mesh(new THREE.TorusBufferGeometry(3.6, 0.17, 20, 128), hm); rig.add(gate);
    var tickM = W.glow(glowMat('#E8F4FF', 0.2), 0.25, 2.0);
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * 6.2832, tk = box(i % 3 === 0 ? 0.16 : 0.1, i % 3 === 0 ? 0.52 : 0.34, 0.14, tickM);
      tk.position.set(Math.sin(a) * 3.25, Math.cos(a) * 3.25, 0); tk.rotation.z = -a; rig.add(tk);
    }
    var cols = [BRAND.blue, BRAND.cyan, BRAND.green], instM = rs === 'Graduated' ? hm.clone() : null;
    var mtx = new THREE.Matrix4(), qq = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3(1, 1, 1), zAx = new THREE.Vector3(0, 0, 1);
    var rings = [[2.85, 0.045, 0.25], [2.3, 0.04, 0.18], [1.75, 0.03, 0.12]].map(function (q, k) {
      var ring = new THREE.Group(); rig.add(ring);
      if (rs === 'Blade') {
        // flat washers, edge-bevelled, the beads riding their faces
        var w = [0.14, 0.13, 0.1][k], ann = new THREE.Shape(), hole = new THREE.Path();
        ann.absarc(0, 0, q[0] + w, 0, Math.PI * 2, false); hole.absarc(0, 0, q[0] - w, 0, Math.PI * 2, true); ann.holes.push(hole);
        var ag = new THREE.ExtrudeBufferGeometry(ann, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 128 });
        ag.translate(0, 0, -0.015); ring.add(new THREE.Mesh(ag, hm));
      } else {
        ring.add(new THREE.Mesh(new THREE.TorusBufferGeometry(q[0], q[1], 8, 128), hm));
        if (rs === 'Graduated') {
          // hours on the outer ring, sixty on the minute and second rings
          var n = k === 0 ? 12 : 60, tg = k === 0 ? new THREE.BoxBufferGeometry(0.05, 0.3, 0.07) : new THREE.BoxBufferGeometry(0.018, 0.13, 0.035);
          var im = new THREE.InstancedMesh(tg, instM, n);
          for (var j = 0; j < n; j++) {
            var aj = j / n * 6.2832, big = k > 0 && j % 5 === 0;
            vp.set(Math.sin(aj) * q[0], Math.cos(aj) * q[0], 0); qq.setFromAxisAngle(zAx, -aj); vs.set(big ? 1.8 : 1, big ? 1.5 : 1, 1);
            im.setMatrixAt(j, mtx.compose(vp, qq, vs));
          }
          im.instanceMatrix.needsUpdate = true; ring.add(im);
        }
      }
      var bm = W.glow(glowMat(cols[k], 1.2), 1.4, 3.0), bead = sph(q[2], bm, 20, 14);
      ring.add(bead);
      return { g: ring, bead: bead, R: q[0], ph: r() * 6.28 };
    });
    var coreKind = (W.P.clockTraits && W.P.clockTraits['Core']) || 'Evil Eye', eye, moonCore = null;
    if (coreKind === 'Moon') {
      // the core is the moon, lit from the sun's real direction: its phase is tonight's
      eye = makeMoon(); eye.scale.setScalar(0.8); eye.renderOrder = 0; eye.material.depthWrite = true; eye.material.fog = false;
      moonCore = eye;
    } else if (coreKind === 'Crystal') {
      eye = new THREE.Group();
      var cm = W.glow(mtl('#9FDFFF', 'crystal', 0.15, 0, 0.4), 0.25, 1.4); cm.emissive = C('#7FD4FF');
      for (var ci = 0; ci < 11; ci++) {
        var cr = new THREE.Mesh(new THREE.OctahedronBufferGeometry(0.22, 0), cm);
        cr.scale.set(0.6, rf(r, 1.6, 3.2), 0.6);
        cr.position.set(rf(r, -0.2, 0.2), rf(r, -0.2, 0.2), rf(r, -0.2, 0.2));
        cr.rotation.set(rf(r, -1, 1), rf(r, 0, 6), rf(r, -1, 1));
        eye.add(cr);
      }
    } else {
      eye = sph(0.78, new THREE.MeshStandardMaterial({ map: eyeTexture(), roughness: 0.25, metalness: 0.05, emissive: C('#FFFFFF'), emissiveMap: eyeTexture(), emissiveIntensity: 0.05 }), 48, 32);
      W.glow(eye.material, 0.05, 0.55);
    }
    rig.add(eye);
    // Calendar moons, each on its own tilted orbit inside the rings: the first
    // goes round once a week, the second once a month, the third once a year.
    var moons = [], moonM = mtl('#E6E1D6', 'stone', 0.75, 0, 0.3), orbM = W.glow(glowMat('#BFD8FF', 0.25), 0.25, 1.1);
    for (var mi = 0; mi < nMoons; mi++) {
      var og = new THREE.Group(), Rk = [1.12, 1.33, 1.54][mi], tl = [[1.15, 0.35], [0.45, -0.95], [1.45, 1.25]][mi];
      og.rotation.set(tl[0], tl[1], 0); rig.add(og);
      og.add(new THREE.Mesh(new THREE.TorusBufferGeometry(Rk, 0.009, 6, 128), orbM));
      var mb = sph([0.13, 0.11, 0.095][mi], moonM, 20, 14); og.add(mb);
      moons.push({ m: mb, R: Rk });
    }
    W.lamp('#8FD8FF', 2.4, 18, new THREE.Vector3(0, Hc, 0));
    shade(g);
    var look = new THREE.Vector3(), tgt = new THREE.Vector3(0, 0, 1), wp = new THREE.Vector3(), cam = new THREE.Vector3();
    return {
      group: g, R: 5.8, lookY: Hc * 0.72, dist: rf(r, 15, 18), camH: [1.6, 3.2], face: true,
      update: function (ctx) {
        var t = ctx.t, sec = t.sec % 60;
        var ang = [((t.h % 12) + t.m / 60 + sec / 3600) / 12, (t.m + sec / 60) / 60, sec / 60];
        rig.position.y = Hc + Math.sin(ctx.real * 0.7) * 0.06;
        rings.forEach(function (q, k) {
          var a = ang[k] * 6.2832;
          q.bead.position.set(Math.sin(a) * q.R, Math.cos(a) * q.R, 0);
          q.g.rotation.y = Math.sin(ctx.real * (0.13 + k * 0.05) + q.ph) * 0.28;
          q.g.rotation.x = Math.cos(ctx.real * (0.09 + k * 0.04) + q.ph) * 0.12;
        });
        if (nMoons) {
          var dim = t.mo === 12 ? 31 : daysFromCivil(t.y, t.mo + 1, 1) - daysFromCivil(t.y, t.mo, 1);
          var yl = daysFromCivil(t.y + 1, 1, 1) - daysFromCivil(t.y, 1, 1);
          var fr = [(weekday(t.days) + t.hours / 24) / 7, (t.d - 1 + t.hours / 24) / dim, (dayOfYear(t) - 1 + t.hours / 24) / yl];
          for (var k = 0; k < nMoons; k++) { var am = fr[k] * 6.2832; moons[k].m.position.set(Math.sin(am) * moons[k].R, Math.cos(am) * moons[k].R, 0); }
        }
        // the eye looks at the sun by day and the moon by night
        var body = ctx.sun.el > -3 ? ctx.sun : ctx.moon;
        dirAzEl(body.az, Math.max(body.el, -2), look);
        eye.getWorldPosition(wp);
        // mostly at you, partly at the sun: it keeps an eye on both
        look.multiplyScalar(0.4).add(cam.copy(ctx.camera.position).sub(wp).normalize().multiplyScalar(0.6)).normalize();
        tgt.lerp(look, ctx.snap ? 1 : Math.min(1, ctx.dt * 1.5));
        if (moonCore) moonCore.material.uniforms.sunDir.value.copy(dirAzEl(ctx.sun.az, ctx.sun.el));
        else if (coreKind === 'Crystal') eye.rotation.y += ctx.dt * 0.3;
        else eye.lookAt(wp.x + tgt.x * 50, wp.y + tgt.y * 50, wp.z + tgt.z * 50);
      }
    };
  }

  // =====================================================================
  // 7. BLOSSOM BINARY
  // A monolith that counts in binary with the six Blossom shapes.
  // Columns: tens and units of hours, minutes, seconds. Rows: 1, 2, 4, 8.
  // =====================================================================
  var var_SHAPE_IDX = { 'Petal': 0, 'Disc': 1, 'Spark': 2, 'Quarter': 3, 'Scoop': 4, 'Lens': 5 };
  var var_LIT = { 'Amber': '#FFA82E', 'White': '#EEF4FF', 'Pink': BRAND.pink };
  function clockBinary(W, matName) {
    var r = W.r, g = new THREE.Group(), hm = heroMat(matName);
    var T = W.P.clockTraits || {}, byRows = T['Grid'] === 'Binary Rows', one = var_SHAPE_IDX[T['Shape']];
    // the twenty shapes are drawn up front in the original order, so the
    // stream after them is the same whatever the grid
    var draws = [];
    for (var d0 = 0; d0 < 20; d0++) { var kd = ri(r, 0, 5), qd = ri(r, 0, 3); draws.push([one == null ? kd : one, qd]); }
    var pitch = 0.74, c = 0.58, gapG = 0.46, baseY = 1.15, i, b;
    // Decimal Columns: tens and units of h, m, s, rows 1 2 4 8.
    // Binary Rows: one row each for h, m, s, columns 32 down to 1.
    var bits = byRows ? [5, 6, 6] : [2, 4, 3, 4, 3, 4], nG = bits.length;
    var xs = [], x = 0, width, off, Hs;
    if (byRows) { for (i = 0; i < 6; i++) xs.push(i * pitch); width = 6 * pitch; Hs = 3 * pitch + 2.3 + 0.3; }
    else { for (i = 0; i < 6; i++) { xs.push(x); x += pitch + (i % 2 === 1 ? gapG : 0); } width = xs[5] + pitch; Hs = 4 * pitch + 2.3; }
    off = -width / 2 + pitch / 2 + (byRows ? 0.2 : 0);
    var plinth = box(width + 1.8, 0.4, 1.9, std('#9E978C', 0.95)); plinth.position.y = 0.2; g.add(plinth);
    var slab = box(width + 1.0 + (byRows ? 0.4 : 0), Hs, 0.55, hm); slab.position.y = 0.4 + Hs / 2; g.add(slab);
    var offM = std('#26292E', 0.5, 0.3), lit = var_LIT[T['Lit']];
    var grpCol = byRows ? [BRAND.blue, BRAND.cyan, BRAND.green] : [BRAND.blue, BRAND.blue, BRAND.cyan, BRAND.cyan, BRAND.green, BRAND.green];
    var onM = grpCol.map(function (h) { return W.glow(glowMat(lit || h, 1.4), lit === '#EEF4FF' ? 1.1 : 1.6, 3.2); });
    var tiles = [], n = 0, tileX = function (gi, bi) { return byRows ? off + xs[5 - bi] : off + xs[gi]; };
    var tileY = function (gi, bi) { return 0.4 + baseY + (byRows ? (2 - gi) * pitch + 0.3 : bi * pitch) + pitch / 2; };
    for (i = 0; i < nG; i++) {
      tiles.push([]);
      for (b = 0; b < bits[i]; b++) {
        var sh = primShape(draws[n][0], draws[n][1], c); n++;
        var geo = new THREE.ExtrudeBufferGeometry(sh, { depth: 0.09, bevelEnabled: false });
        var tm = new THREE.Mesh(geo, offM);
        tm.position.set(tileX(i, b), tileY(i, b), 0.28);
        g.add(tm); tiles[i].push(tm);
      }
    }
    var ink = MATERIALS[matName].trim, lab = function (s, px, py) {
      var l = textPlane(s, { color: ink, height: 0.26, px: 80, font: FONT_MONO, pad: 0.05 }); l.position.set(px, py, 0.281); g.add(l);
    };
    if (byRows) {
      ['H', 'M', 'S'].forEach(function (s, k) { lab(s, off - pitch * 0.95, tileY(k, 0)); });
      ['32', '16', '8', '4', '2', '1'].forEach(function (s, k) { lab(s, off + xs[k], 0.4 + baseY); });
    } else {
      ['1', '2', '4', '8'].forEach(function (s, k) { lab(s, off - pitch * 0.95, tileY(0, k)); });
      ['H', 'H', 'M', 'M', 'S', 'S'].forEach(function (s, k) { lab(s, off + xs[k], 0.4 + baseY - 0.3); });
    }
    var ttl = textPlane(['MARFA', 'LOCAL TIME'], { color: ink, height: 0.62, px: 80, font: FONT_SERIF, pad: 0.05 });
    ttl.position.set(0, 0.4 + Hs - 0.62, 0.281); g.add(ttl);
    var url = textPlane('MLOW.XYZ', { color: ink, height: 0.16, px: 60, font: FONT_MONO, pad: 0.05 });
    url.position.set(0, 0.4 + 0.35, 0.281); g.add(url);
    shade(g);
    var last = -1;
    return {
      group: g, R: width / 2 + 1.2, lookY: (0.4 + Hs) * 0.5, dist: rf(r, 10, 12.5), camH: [1.5, 2.4], face: true,
      update: function (ctx) {
        var t = ctx.t, key = t.h * 3600 + t.m * 60 + t.s;
        if (key === last) return;
        last = key;
        var d = byRows ? [t.h, t.m, t.s] : [Math.floor(t.h / 10), t.h % 10, Math.floor(t.m / 10), t.m % 10, Math.floor(t.s / 10), t.s % 10];
        for (var i = 0; i < nG; i++) for (var b = 0; b < tiles[i].length; b++) tiles[i][b].material = (d[i] >> b) & 1 ? onM[i] : offM;
      }
    };
  }

  // =====================================================================
  // 8. SOLAR HENGE
  // Twelve pierced plates in a ring, twelve at north. The plate of the hour
  // lights from inside; sixty tiles on the ground count the minutes. The
  // obelisk in the middle keeps the other time, the sun's.
  // =====================================================================
  function clockHenge(W, matName) {
    var r = W.r, g = new THREE.Group(), hm = heroMat(matName), Rh = rf(r, 6.8, 8.2), S = 2.5;
    var T = W.P.clockTraits || {}, N = T['Plates'] === 'Twenty-Four' ? 24 : 12, lay = T['Arrangement'] || 'Ring', cut = T['Cut'] || 'Blossom';
    if (N === 24) { S = 1.75; Rh += 1.3; }
    var glowM = W.glow(glowMat(pick(r, [BRAND.blue, BRAND.cyan, '#FFD9A0']), 0.6), 0.6, 2.4);
    var plates = [];
    for (var i = 0; i < N; i++) {
      var az = i * 360 / N, txt = String(N === 24 ? (i === 0 ? 24 : i) : (i === 0 ? 12 : i));
      // Rising: the plates climb with the hours, a spiral round the ring
      var s = lay === 'Rising' ? S * (0.6 + 0.55 * i / (N - 1)) : S;
      var sh = cut === 'Stencil Numeral' ? var_stencilPlate(s, txt) : cut === 'Perforated' ? var_perfPlate(s, i / N) : blossomPlate(r, s, s, 4, 0.82, 0.2);
      var geo = new THREE.ExtrudeBufferGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 10 });
      geo.translate(-s / 2, 0, -0.1);
      var pm = new THREE.Mesh(geo, hm), pg = new THREE.Group();
      pg.add(pm);
      var panel = new THREE.Mesh(new THREE.PlaneBufferGeometry(s * 0.97, s * 0.97), glowM);
      panel.position.set(0, s / 2, 0); panel.visible = false; pg.add(panel);
      var panel2 = panel.clone(); panel2.rotation.y = Math.PI; pg.add(panel2);
      if (cut !== 'Stencil Numeral') {
        var num = textPlane(txt, { color: MATERIALS[matName].trim, height: N === 24 ? 0.28 : 0.34, px: 90, pad: 0.05 });
        num.position.set(0, s + 0.26, 0.11); pg.add(num);
      }
      var cap = box(s + 0.1, 0.1, 0.3, hm); cap.position.y = s + 0.05; pg.add(cap);
      var sa = Math.sin(az * D2R), ca = Math.cos(az * D2R);
      if (lay === 'Square') {
        // on the four sides of a square court, each plate parallel to its wall
        var e = Math.max(Math.abs(sa), Math.abs(ca)), Rq = Rh * 0.84;
        pg.position.set(sa / e * Rq, 0, -ca / e * Rq);
        pg.rotation.y = Math.abs(Math.abs(sa) - Math.abs(ca)) < 0.01 ? -az * D2R : -Math.round(az / 90) * Math.PI / 2;
      } else {
        pg.position.set(sa * Rh, 0, -ca * Rh);
        pg.rotation.y = -az * D2R;
      }
      g.add(pg); plates.push([panel, panel2]);
    }
    var ob = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.28, 0.5, 5.4, 4), hm); ob.rotation.y = Math.PI / 4; ob.position.y = 2.7; g.add(ob);
    var pyr = new THREE.Mesh(new THREE.ConeBufferGeometry(0.4, 0.55, 4), hm); pyr.rotation.y = Math.PI / 4; pyr.position.y = 5.67; g.add(pyr);
    var offT = mtl('#57524B', 'concrete', 0.9, 0, 1), onT = W.glow(glowMat(BRAND.cyan, 0.8), 0.8, 2.2), secT = W.glow(glowMat('#FFFFFF', 1.1), 1.1, 2.6);
    var tiles = [], Rt = (lay === 'Square' ? Rh * 0.84 : Rh) - 2.0;
    for (i = 0; i < 60; i++) {
      var a = i / 60 * 6.2832, t = box(i % 5 === 0 ? 0.34 : 0.2, 0.06, 0.5, offT);
      t.position.set(Math.sin(a) * Rt, 0.03, -Math.cos(a) * Rt); t.rotation.y = -a; g.add(t); tiles.push(t);
    }
    var sign = textPlane('MLOW.XYZ', { color: MATERIALS[matName].trim, height: 0.2, px: 60, font: FONT_MONO, pad: 0.05 });
    sign.position.set(0, 0.9, 0.51); g.add(sign);
    shade(g);
    var lastH = -1, lastM = -1, lastS = -1;
    return {
      group: g, R: Rh + 1.6, lookY: 1.4, dist: rf(r, 19, 23) * (N === 24 ? 1.1 : 1), camH: [2.4, 4.4], face: false,
      update: function (ctx) {
        var t = ctx.t, hk = N === 24 ? t.h : t.h % 12;
        if (hk !== lastH) { plates.forEach(function (p, k) { p[0].visible = p[1].visible = (k === hk); }); lastH = hk; }
        if (t.m !== lastM || t.s !== lastS) {
          for (var i = 0; i < 60; i++) tiles[i].material = i === t.s ? secT : (i <= t.m ? onT : offT);
          lastM = t.m; lastS = t.s;
        }
      }
    };
  }

  // =====================================================================
  // 9. CONCOURSE CLOCK
  // After the four-faced clock on the information booth in Grand Central,
  // which the NEW YORKERS museum sends you to see. Here the vault above it is
  // the real sky, the right way round.
  // =====================================================================
  function clockConcourse(W, matName) {
    var r = W.r, g = new THREE.Group(), brass = heroMat('Brass');
    var T = W.P.clockTraits || {}, nF = { 'Two': 2, 'Three': 3, 'Four': 4 }[T['Faces']] || 4, fin = T['Finial'] || 'Acorn', stand = T['Stand'] || 'Booth';
    var marble = std('#DCD4C6', 0.35), glass = std('#1E2B30', 0.08, 0.7), i;
    var cy = 4.2, gold = '#D9B878';
    if (stand === 'Column') {
      // a street clock: two-tier plinth and a turned brass column
      var p1 = box(1.5, 0.34, 1.5, marble); p1.position.y = 0.17; g.add(p1);
      var p2 = box(1.16, 0.5, 1.16, marble); p2.position.y = 0.59; g.add(p2);
      var pb = box(1.2, 0.07, 1.2, brass); pb.position.y = 0.87; g.add(pb);
      var prof = [[0.001, 0], [0.4, 0], [0.4, 0.08], [0.3, 0.14], [0.3, 0.2], [0.22, 0.3], [0.2, 0.5], [0.24, 0.56], [0.24, 0.62], [0.17, 0.7],
        [0.14, 1.6], [0.19, 1.66], [0.19, 1.72], [0.14, 1.78], [0.12, 2.0], [0.16, 2.08], [0.26, 2.22], [0.36, 2.34], [0.36, 2.4], [0.001, 2.4]];
      var col = new THREE.Mesh(new THREE.LatheBufferGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 32), brass);
      col.position.y = 0.905; g.add(col);
      var pl = textPlane(['MARFA', 'MLOW.XYZ'], { color: '#3A2A14', height: 0.26, px: 60, font: FONT_SERIF, pad: 0.05 });
      pl.position.set(0, 0.6, 0.581); g.add(pl);
    } else if (stand === 'Plinth') {
      // a marble pedestal, brass cornice, the lettering cut in the front
      var b1 = box(2.0, 0.3, 2.0, marble); b1.position.y = 0.15; g.add(b1);
      var b2 = box(1.5, 2.5, 1.5, marble); b2.position.y = 0.3 + 1.25; g.add(b2);
      var co = box(1.72, 0.16, 1.72, brass); co.position.y = 2.88; g.add(co);
      var co2 = box(1.56, 0.1, 1.56, marble); co2.position.y = 3.01; g.add(co2);
      var pd = cyl(0.3, 0.42, 0.26, 32, brass); pd.position.y = 3.19; g.add(pd);
      var bandP = box(1.53, 0.06, 1.53, brass); bandP.position.y = 0.36; g.add(bandP);
      var cut1 = textPlane('INFORMATION', { color: '#8C7F6C', height: 0.2, px: 80, font: FONT_SERIF, spacing: 0.12, pad: 0.05 });
      cut1.position.set(0, 2.35, 0.751); g.add(cut1);
      var cut2 = textPlane(['MARFA', 'TEXAS'], { color: '#8C7F6C', height: 0.5, px: 80, font: FONT_SERIF, pad: 0.05 });
      cut2.position.set(0, 1.55, 0.751); g.add(cut2);
      var cut3 = textPlane('MLOW.XYZ  ·  N3WYORKERS.COM', { color: '#8C7F6C', height: 0.12, px: 60, font: FONT_MONO, pad: 0.05 });
      cut3.position.set(0, 0.62, 0.751); g.add(cut3);
    } else {
      var k1 = cyl(2.45, 2.55, 1.05, 48, marble); k1.position.y = 0.525; g.add(k1);
      var band = cyl(2.5, 2.5, 0.12, 48, brass); band.position.y = 1.1; g.add(band);
      var gl = cyl(2.32, 2.32, 0.95, 48, glass); gl.position.y = 1.64; g.add(gl);
      for (i = 0; i < 16; i++) {
        var a = i / 16 * 6.2832, mull = box(0.07, 0.95, 0.07, brass);
        mull.position.set(Math.sin(a) * 2.34, 1.64, Math.cos(a) * 2.34); g.add(mull);
      }
      var corn = cyl(2.65, 2.4, 0.2, 48, brass); corn.position.y = 2.2; g.add(corn);
      var dome = new THREE.Mesh(new THREE.SphereBufferGeometry(1.5, 32, 12, 0, 6.2832, 0, Math.PI / 2), brass);
      dome.scale.y = 0.35; dome.position.y = 2.3; g.add(dome);
      var ped = cyl(0.16, 0.26, 0.9, 20, brass); ped.position.y = 2.75 + 0.45; g.add(ped);
      var info = textPlane('INFORMATION', { color: gold, height: 0.2, px: 70, font: FONT_SERIF, spacing: 0.1, pad: 0.05 });
      info.position.set(0, 1.64, 2.36); g.add(info);
      var info2 = textPlane('MLOW.XYZ  ·  N3WYORKERS.COM', { color: gold, height: 0.14, px: 60, font: FONT_MONO, pad: 0.05 });
      info2.position.set(0, 0.55, 2.56); g.add(info2);
    }
    var house = sph(0.9, brass, 40, 24); house.position.y = cy; g.add(house);
    var stem = cyl(0.04, 0.06, 0.2, 10, brass); stem.position.y = cy + 0.88; g.add(stem);
    var vane = null, rose = null;
    if (fin === 'Weathervane') {
      // the arrow turns into the real wind; the letters stay on true north
      var rod = cyl(0.022, 0.022, 0.8, 8, brass); rod.position.y = cy + 1.3; g.add(rod);
      var knob = sph(0.07, brass, 16, 12); knob.position.y = cy + 1.02; g.add(knob);
      rose = new THREE.Group(); rose.position.y = cy + 1.25; g.add(rose);
      var ns = box(0.9, 0.022, 0.022, brass); ns.rotation.y = Math.PI / 2; rose.add(ns);
      var ew = box(0.9, 0.022, 0.022, brass); rose.add(ew);
      [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]].forEach(function (L) {
        var t = textPlane(L[0], { color: '#C9A45C', height: 0.2, px: 90, font: FONT_SERIF, pad: 0.04, double: true });
        t.position.set(L[1] * 0.52, 0, L[2] * 0.52); t.rotation.y = L[1] ? 0 : Math.PI / 2; rose.add(t);
      });
      vane = new THREE.Group(); vane.position.y = cy + 1.62; g.add(vane);
      var shaft = box(1.1, 0.03, 0.03, brass); vane.add(shaft);
      var head = new THREE.Mesh(new THREE.ConeBufferGeometry(0.08, 0.24, 4), brass); head.rotation.z = -Math.PI / 2; head.position.x = 0.64; vane.add(head);
      // the tail is a Blossom petal, cut from sheet
      var fg = new THREE.ExtrudeBufferGeometry(primShape(0, 1, 0.42), { depth: 0.014, bevelEnabled: false });
      fg.translate(0, 0, -0.007); var fin2 = new THREE.Mesh(fg, brass); fin2.position.x = -0.55; vane.add(fin2);
      var cap = sph(0.045, brass, 12, 8); cap.position.y = 0.02; vane.add(cap);
    } else if (fin === 'Blossom Spark') {
      var sg = new THREE.ExtrudeBufferGeometry(primShape(2, 0, 0.62), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
      sg.translate(0, 0, -0.035);
      var spark = new THREE.Mesh(sg, brass); spark.position.y = cy + 1.36; g.add(spark);
      var neck = sph(0.1, brass, 16, 12); neck.position.y = cy + 1.0; g.add(neck);
    } else {
      var acorn = sph(0.13, brass); acorn.position.y = cy + 1.02; g.add(acorn);
      var spire = new THREE.Mesh(new THREE.ConeBufferGeometry(0.06, 0.3, 12), brass); spire.position.y = cy + 1.22; g.add(spire);
    }
    var faceTex = canvasTex(512, 512, function (gc) {
      var cx = 256;
      var gr = gc.createRadialGradient(cx, cx, 30, cx, cx, 256);
      gr.addColorStop(0, '#FFF9EC'); gr.addColorStop(1, '#EDE0C4');
      gc.fillStyle = gr; gc.fillRect(0, 0, 512, 512);
      gc.fillStyle = '#1A1512';
      for (var m = 0; m < 60; m++) {
        gc.save(); gc.translate(cx, cx); gc.rotate(m / 60 * 6.2832);
        if (m % 5 === 0) gc.fillRect(-6, -236, 12, 40); else gc.fillRect(-2, -236, 4, 16);
        gc.restore();
      }
      gc.font = '700 64px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      [[12, 0, -150], [3, 150, 0], [6, 0, 150], [9, -150, 0]].forEach(function (q) { gc.fillText(String(q[0]), cx + q[1], cx + q[2]); });
      gc.font = '400 26px ' + FONT_MONO; gc.fillText('MARFA', cx, cx + 70);
    });
    var faceM = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.3, emissive: C('#FFF4DC'), emissiveMap: faceTex, emissiveIntensity: 0.1 });
    W.glow(faceM, 0.12, 1.5);
    var handM = std('#15110E', 0.4, 0.5), faces = [];
    for (i = 0; i < nF; i++) {
      var fg0 = new THREE.Group(); fg0.position.y = cy; fg0.rotation.y = i * 6.2832 / nF;
      var face = new THREE.Mesh(new THREE.CircleBufferGeometry(0.62, 64), faceM); face.position.z = 0.93; fg0.add(face);
      var drum = cyl(0.66, 0.66, 0.26, 48, brass); drum.rotation.x = Math.PI / 2; drum.position.z = 0.76; fg0.add(drum);
      var bez = new THREE.Mesh(new THREE.TorusBufferGeometry(0.66, 0.06, 10, 64), brass); bez.position.z = 0.93; fg0.add(bez);
      var mk = (function (fgx) { return function (w, l, z) { var geo = new THREE.BoxBufferGeometry(w, l, 0.015); geo.translate(0, l / 2 - 0.06, 0); var m = new THREE.Mesh(geo, handM); m.position.z = z; fgx.add(m); return m; }; })(fg0);
      faces.push([mk(0.05, 0.36, 0.945), mk(0.034, 0.53, 0.96), mk(0.012, 0.55, 0.975)]);
      g.add(fg0);
    }
    W.lamp('#FFE7BE', 1.8, 16, new THREE.Vector3(0, cy, 0));
    shade(g);
    return {
      group: g, R: 3.2, lookY: (stand === 'Booth' ? 2.7 : 3.0) + (fin === 'Weathervane' ? 0.25 : 0), dist: rf(r, 10, 12.5), camH: [1.6, 2.6], face: true,
      update: function (ctx) {
        var t = ctx.t, sec = t.sec % 60;
        var ah = ((t.h % 12) + t.m / 60) / 12 * 6.2832, am = (t.m + sec / 60) / 60 * 6.2832, as = Math.floor(sec) / 60 * 6.2832;
        faces.forEach(function (f) { f[0].rotation.z = -ah; f[1].rotation.z = -am; f[2].rotation.z = -as; });
        if (vane) {
          // the group is turned to face the camera, so undo that turn
          var gy = g.rotation.y, wd = ctx.windDir;
          rose.rotation.y = -gy;
          vane.rotation.y = Math.atan2(wd.z, -wd.x) - gy + Math.sin(ctx.real * 1.7) * 0.04 * (ctx.wind || 1);
        }
      }
    };
  }

  var MOTTOS = ['I COUNT ONLY THE SUNNY HOURS', 'HORAS NON NUMERO NISI SERENAS', 'IT IS LATER THAN YOU THINK', 'TEMPUS FUGIT', 'LIGHT IS THE MEASURE', 'WAIT FOR THE SHADOW'];
  defineClock('Horizontal Sundial', { w: 11, keeps: 'Shadow', solar: true, build: clockHorizontal,
    line: 'A true sundial for latitude 30.3°. Its hour lines are corrected for Marfa’s longitude, so the shadow reads Central Time. Some carry a bead on the gnomon whose shadow walks a figure eight through the year, the equation of time drawn by the sun.',
    mats: ['Travertine', 'Brass', 'Weathering Steel', 'Mill Aluminum', 'Concrete', 'Desert Sandstone', 'Terrazzo', 'Obsidian'],
    traits: function (r) { return { 'Gnomon': pick(r, ['Solid', 'Pierced']), 'Plinth': pick(r, ['Round', 'Octagon', 'Dodecagon']), 'Motto': pick(r, MOTTOS), 'Noon Mark': pickW(r, [['None', 35], ['Noon', 35], ['Date Lines', 20], ['Every Hour', 10]]) }; } });
  var var_FLAPS = [['Black', 45], ['Cream', 20], ['Amber', 20], ['Blue', 15]];
  defineClock('Analemmatic Sundial', { w: 9, keeps: 'Shadow', solar: true, build: clockAnalemmatic, eggs: ['New Yorker'],
    line: 'The gnomon is a person standing on today’s date. Their own shadow points at the hour. Some draw the equation of time beside the dates, a figure eight of minutes fast and slow.',
    mats: ['Travertine', 'Concrete', 'Caliche Stone', 'Desert Sandstone', 'Terrazzo'],
    traits: function (r) { return { 'Pavement': pickW(r, [['Rings', 40], ['Flagstones', 35], ['Compass Rose', 25]]), 'Hour Markers': pickW(r, [['Stones', 40], ['Posts', 35], ['Plaques', 25]]), 'Date Scale': pickW(r, [['Line', 55], ['Figure Eight', 45]]) }; } });
  defineClock('Armillary Sphere', { w: 9, keeps: 'Shadow', solar: true, build: clockArmillary,
    line: 'The rod points at the celestial pole. Its shadow falls on the hours inside the equator band. On the celestial spheres the zodiac band turns with the stars, and its bead lies on the line to the sun.',
    mats: ['Brass', 'Weathering Steel', 'Mill Aluminum', 'Patinated Copper'],
    traits: function (r) { return { 'Rings': pickW(r, [['Equatorial', 30], ['Classic', 40], ['Celestial', 30]]), 'Base': pickW(r, [['Drum', 40], ['Stepped', 35], ['Tripod', 25]]) }; } });
  defineClock('Split-Flap Board', { w: 10, keeps: 'Flaps', build: clockFlapBoard,
    line: 'A departures board with nowhere to depart to. Between the times it flips through Marfa and the work, the buses that are not coming, or the sky.',
    mats: ['Ink Black', 'Mill Aluminum', 'Blossom Blue', 'Cherokee Red'],
    traits: function (r) { return { 'Board': pickW(r, [['Two Rows', 25], ['Four Rows', 50], ['Six Rows', 25]]), 'Flaps': pickW(r, var_FLAPS), 'Pages': pickW(r, [['Marfa and the Work', 45], ['Departures', 30], ['Almanac', 25]]) }; } });
  defineClock('Flip Monument', { w: 9, keeps: 'Flaps', build: clockFlipMonument,
    line: 'A bedside flip clock the size of a trailer. The seconds flip too.',
    mats: ['Blossom Blue', 'Bone White', 'Ink Black', 'Mill Aluminum', 'Cherokee Red', 'Terrazzo'],
    traits: function (r) { return { 'Hours': pickW(r, [['24 Hour', 55], ['12 Hour', 45]]), 'Flaps': pickW(r, var_FLAPS), 'Stance': pickW(r, [['Upright', 55], ['Tipped Back', 25], ['Half Buried', 20]]) }; } });
  defineClock('Orbital', { w: 9, keeps: 'Orbit', build: clockOrbital,
    line: 'Three rings for hours, minutes and seconds around a core that keeps watch on the sky. Small moons, where there are any, go round once a week, once a month and once a year.',
    mats: ['Mill Aluminum', 'Bone White', 'Blossom Blue', 'Obsidian', 'Selenite'],
    traits: function (r) { return { 'Core': pickW(r, [['Evil Eye', 50], ['Moon', 30], ['Crystal', 20]]), 'Rings': pickW(r, [['Wire', 45], ['Blade', 30], ['Graduated', 25]]), 'Moons': pickW(r, [['None', 40], ['One', 25], ['Two', 20], ['Three', 15]]) }; } });
  defineClock('Blossom Binary', { w: 9, keeps: 'Binary', build: clockBinary,
    line: 'Hours, minutes and seconds counted in binary with the six Blossom shapes. Add up the lit tiles.',
    mats: ['Concrete', 'Ink Black', 'Mill Aluminum', 'Obsidian', 'Terrazzo'],
    traits: function (r) { return { 'Grid': pickW(r, [['Decimal Columns', 60], ['Binary Rows', 40]]), 'Lit': pickW(r, [['Blossom', 45], ['Amber', 20], ['White', 20], ['Pink', 15]]), 'Shape': pickW(r, [['Mixed', 46], ['Petal', 9], ['Disc', 9], ['Spark', 9], ['Quarter', 9], ['Scoop', 9], ['Lens', 9]]) }; } });
  defineClock('Solar Henge', { w: 9, keeps: 'Light and Shadow', build: clockHenge,
    line: 'Pierced plates in a ring or a court, twelve or twenty-four of them. The plate of the hour lights from inside; sixty tiles count the minutes.',
    mats: ['Weathering Steel', 'Concrete', 'Mill Aluminum', 'Cherokee Red', 'Selenite'],
    traits: function (r) { return { 'Plates': pickW(r, [['Twelve', 70], ['Twenty-Four', 30]]), 'Arrangement': pickW(r, [['Ring', 45], ['Rising', 30], ['Square', 25]]), 'Cut': pickW(r, [['Blossom', 50], ['Stencil Numeral', 30], ['Perforated', 20]]) }; } });
  defineClock('Concourse Clock', { w: 7, keeps: 'Hands', build: clockConcourse, mats: ['Brass', 'Patinated Copper'],
    line: 'After the four-faced clock in Grand Central, which the NEW YORKERS museum sends you to see. Here the vault above it is the real sky, the right way round.',
    traits: function (r) { return { 'Faces': pickW(r, [['Four', 55], ['Three', 25], ['Two', 20]]), 'Finial': pickW(r, [['Acorn', 45], ['Weathervane', 35], ['Blossom Spark', 20]]), 'Stand': pickW(r, [['Booth', 50], ['Column', 30], ['Plinth', 20]]) }; } });
