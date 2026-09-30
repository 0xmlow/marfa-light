  // =====================================================================
  // KINETIC CLOCKS: water, sand, words, pins
  // Four clocks that keep Marfa time by moving matter: a clepsydra, an
  // hourglass that turns itself over, a wall of letters, a field of pins.
  // Every top-level name in this file starts with kin_ so it can share the
  // one scope with the other src files.
  // =====================================================================

  // ------------------------------------------------------------ shared
  function kin_ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function kin_easeIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function kin_back(t) { t = clamp(t, 0, 1); var c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function kin_hour12(h) { return h % 12 === 0 ? 12 : h % 12; }
  // the fraction of the current hour that has gone, 0..1
  function kin_hourFrac(t) { return (t.m * 60 + (t.sec % 60)) / 3600; }
  var KIN_ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  // the hero material, a little rougher than the shared one: big curved and tilted
  // faces in polished brass or obsidian otherwise throw the sun into the bloom
  function kin_hero(name) { var m = heroMat(name); m.roughness = Math.max(m.roughness, 0.38); return m; }
  function kin_bronze() { return mtl('#8C6A3E', 'brushed', 0.52, 0.9, 0.45); }
  function kin_glass(op) {
    var m = new THREE.MeshStandardMaterial({ color: C('#B4C8CA'), roughness: 0.24, metalness: 0.1, transparent: true, opacity: op == null ? 0.2 : op, depthWrite: false, side: THREE.DoubleSide });
    m.envMapIntensity = 1.8;
    return m;
  }
  // a box with bevelled edges, centred on the origin
  function kin_bbox(w, h, d, b, mat) {
    var s = new THREE.Shape(), x = w / 2 - b, y = h / 2 - b;
    s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y);
    var geo = new THREE.ExtrudeBufferGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
    geo.translate(0, 0, -(d - 2 * b) / 2);
    return new THREE.Mesh(geo, mat);
  }
  // a lathe from [r, y] pairs
  function kin_lathe(pts, seg, mat) {
    return new THREE.Mesh(new THREE.LatheBufferGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48), mat);
  }
  // a rod from a to b (Vector3s)
  function kin_rod(a, b, rad, mat, seg) {
    var d = b.clone().sub(a), m = cyl(rad, rad, d.length(), seg || 10, mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  // text cut into a surface and gilded
  function kin_engrave(lines, o) {
    var g = new THREE.Group(), p = textPlane(lines, o);
    p.material.metalness = o.metal == null ? 0.6 : o.metal; p.material.roughness = 0.35;
    p.material.polygonOffset = true; p.material.polygonOffsetFactor = -2;
    g.add(p); g.userData.w = p.userData.w; g.userData.h = p.userData.h;
    return g;
  }
  // the four screw heads that hold a plate on
  function kin_bolts(parent, w, h, z, mat, inset) {
    var i = inset || 0.06;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
      var b = cyl(0.022, 0.022, 0.02, 10, mat); b.rotation.x = Math.PI / 2;
      b.position.set(q[0] * (w / 2 - i), q[1] * (h / 2 - i), z); parent.add(b);
    });
  }

  // =====================================================================
  // 1. WATER CLOCK
  // A clepsydra. Water runs from a spout into a glass column and lifts a
  // bronze float; its pointer reads the minutes on an engraved stele. On the
  // hour the column drains and one more cup of the twelve fills.
  // =====================================================================
  var KIN_WATER = { 'Clear': ['#5FB3BC', 0.5, '#B9F2F2', '#E2F6F4'], 'Indigo': ['#15206A', 0.86, '#6F8BFF', '#D6DCFF'], 'Emerald': ['#06563E', 0.84, '#57F0B8', '#DAF6E9'] };

  // the engraved scale on a stele: n divisions, a label every `every`
  function kin_scaleTex(n, every, strong, label, span, ticksLeft) {
    var pxm = 520, Wp = 384, Hp = Math.round((span + 0.36) * pxm);
    return canvasTex(Wp, Hp, function (g) {
      var y0 = Hp - 0.18 * pxm;
      var draw = function (dx, dy, col) {
        g.fillStyle = col;
        var xr = ticksLeft ? 10 : Wp - 16;
        g.fillRect(xr + dx, y0 - span * pxm + dy - 3, 6, span * pxm + 6);
        for (var k = 0; k <= n; k++) {
          var y = y0 - k / n * span * pxm + dy, maj = k % every === 0, big = k % strong === 0;
          var len = big ? 140 : maj ? 104 : 50, lw = big ? 11 : maj ? 8 : 4;
          var x0 = ticksLeft ? 10 : Wp - 10 - len;
          g.fillRect(x0 + dx, y - lw / 2, len, lw);
          if (maj && label(k) !== '') {
            g.font = '700 ' + (big ? 92 : 78) + 'px ' + FONT_SERIF; g.textBaseline = 'middle';
            g.textAlign = ticksLeft ? 'left' : 'right';
            g.fillText(label(k), (ticksLeft ? x0 + len + 22 : x0 - 22) + dx, y + 4);
          }
        }
      };
      draw(3, 4, 'rgba(0,0,0,0.55)');
      draw(0, 0, '#D9B66A');
    });
  }

  function kin_waterColumn(W, g, o) {
    var x = o.x, side = o.side, rc = o.rc, yb = o.yb, Hw = o.Hw, bronze = o.bronze, i;
    var Hc = Hw + 0.46, sw = 0.8, sd = 0.46, xs = x + side * (rc + 0.24 + sw / 2);
    // the drum it stands on, and its collars
    var drum = cyl(rc + 0.2, rc + 0.24, 0.16, 48, o.hero); drum.position.set(x, yb - 0.14, 0); g.add(drum);
    var col0 = cyl(rc + 0.1, rc + 0.15, 0.14, 48, bronze); col0.position.set(x, yb - 0.02, 0); g.add(col0);
    var glass = new THREE.Mesh(new THREE.CylinderBufferGeometry(rc, rc, Hc, 64, 1, true), o.glass);
    glass.position.set(x, yb + Hc / 2 - 0.04, 0); glass.renderOrder = 6; g.add(glass);
    var topY = yb - 0.04 + Hc;
    var rim = new THREE.Mesh(new THREE.TorusBufferGeometry(rc + 0.035, 0.05, 12, 64), bronze); rim.rotation.x = Math.PI / 2; rim.position.set(x, topY, 0); g.add(rim);
    var band = new THREE.Mesh(new THREE.CylinderBufferGeometry(rc + 0.05, rc + 0.05, 0.16, 64, 1, true), bronze); band.position.set(x, topY - 0.1, 0); g.add(band);
    var band2 = band.clone(); band2.position.y = yb + 0.1; g.add(band2);
    // a slot for the pointer, and two tie rods behind
    [-1, 1].forEach(function (k) {
      var a = Math.PI / 2 * side + k * 0.13;
      var st = box(0.035, Hc - 0.3, 0.03, bronze); st.position.set(x + Math.sin(a) * (rc + 0.012), yb + Hc / 2 - 0.04, Math.cos(a) * (rc + 0.012)); st.rotation.y = a; g.add(st);
      var b = Math.PI + k * 0.75, rod = cyl(0.022, 0.022, Hc, 8, bronze);
      rod.position.set(x + Math.sin(b) * (rc + 0.07), yb + Hc / 2 - 0.04, Math.cos(b) * (rc + 0.07)); g.add(rod);
    });
    // water, its surface, the float and its pointer
    var wgeo = new THREE.CylinderBufferGeometry(rc - 0.02, rc - 0.02, 1, 48, 1, true); wgeo.translate(0, 0.5, 0);
    var water = new THREE.Mesh(wgeo, o.waterM); water.position.set(x, yb, 0); water.renderOrder = 3; g.add(water);
    var sgeo = new THREE.RingBufferGeometry(0.001, rc - 0.021, 48, 7); sgeo.rotateX(-Math.PI / 2);
    var sp = sgeo.attributes.position, base = [];
    for (i = 0; i < sp.count; i++) base.push([sp.getX(i), sp.getZ(i), Math.sqrt(sp.getX(i) * sp.getX(i) + sp.getZ(i) * sp.getZ(i))]);
    var surf = new THREE.Mesh(sgeo, o.surfM); surf.position.set(x, yb, 0); surf.renderOrder = 4; g.add(surf);
    var fl = new THREE.Group(); fl.position.set(x, yb, 0); g.add(fl);
    var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(rc * 0.52, 0.055, 12, 40), bronze); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; fl.add(ring);
    for (i = 0; i < 3; i++) {
      var a3 = i / 3 * 6.2832 + Math.PI / 2 * side, pin = cyl(0.03, 0.03, 0.14, 8, bronze);
      pin.position.set(Math.sin(a3) * rc * 0.52, 0.08, Math.cos(a3) * rc * 0.52); fl.add(pin);
      var knob = sph(0.04, bronze, 10, 8); knob.position.copy(pin.position); knob.position.y = 0.16; fl.add(knob);
    }
    var ex = xs - side * (sw / 2 + 0.035), zf = sd / 2 + 0.05;
    fl.add(kin_rod(new THREE.Vector3(side * rc * 0.52, 0.02, 0), new THREE.Vector3(ex - x, 0.02, 0), 0.02, bronze));
    fl.add(kin_rod(new THREE.Vector3(ex - x, 0.02, 0), new THREE.Vector3(ex - x, 0.02, zf), 0.02, bronze));
    var hub = sph(0.04, bronze, 10, 8); hub.position.set(ex - x, 0.02, 0); fl.add(hub);
    var arrow = new THREE.Mesh(new THREE.ConeBufferGeometry(0.06, 0.3, 4), bronze);
    arrow.rotation.z = -Math.PI / 2 * side; arrow.scale.set(1, 1, 0.35);
    arrow.position.set(ex - x + side * 0.15, 0.02, zf); fl.add(arrow);
    // the stele and its scale
    var steleH = topY + 0.14 - (yb - 0.22);
    var stele = kin_bbox(sw, steleH, sd, 0.03, o.hero); stele.position.set(xs, yb - 0.22 + steleH / 2, 0); g.add(stele);
    var tex = kin_scaleTex(o.n, o.every, o.strong, o.label, Hw, side > 0);
    var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(sw - 0.06, Hw + 0.36), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.32, metalness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    face.position.set(xs, yb + 0.04 + Hw / 2, sd / 2 + 0.002); g.add(face);
    // the stream from the spout, and drops in it
    var smat = o.streamM, stream = cyl(0.016, 0.011, 1, 8, smat); stream.geometry.translate(0, -0.5, 0);
    var sx = x, sz = 0; stream.position.set(sx, topY + 0.26, sz); stream.renderOrder = 5; g.add(stream);
    var drops = [];
    for (i = 0; i < 5; i++) { var dr = sph(0.022, smat, 8, 6); dr.scale.y = 1.8; dr.renderOrder = 5; g.add(dr); drops.push(dr); }
    var col = {
      cur: 0, drain: 0, hours: false, x: x, xs: xs, sw: sw, topY: topY, Hw: Hw,
      set: function (L, drain, real) {
        var h = 0.04 + L * Hw, y = yb + h;
        water.scale.y = h; surf.position.y = y; fl.position.y = y - 0.01;
        var R = rc - 0.021;
        for (var i = 0; i < sp.count; i++) {
          var q = base[i], rr = q[2] / R, ang = Math.atan2(q[1], q[0]);
          var yy = 0.011 * Math.sin(q[2] * 42 - real * 7) * (1 - rr * 0.6) + 0.004 * Math.sin(ang * 3 + real * 1.8 + rr * 5);
          yy -= drain * 0.26 * (1 - rr) * (1 - rr) + drain * 0.012 * Math.sin(ang * 5 - real * 9 + rr * 8);
          sp.setY(i, yy);
        }
        sp.needsUpdate = true; sgeo.computeVertexNormals();
        var len = topY + 0.26 - y;
        stream.scale.y = Math.max(0.01, len);
        stream.scale.x = stream.scale.z = 1 + 0.18 * Math.sin(real * 23);
        for (var k = 0; k < drops.length; k++) {
          var u = (real * 1.35 + k / drops.length) % 1;
          drops[k].position.set(sx + Math.sin(real * 3 + k) * 0.004, topY + 0.26 - u * u * len, sz);
          drops[k].visible = u > 0.04 && u < 0.97;
        }
      }
    };
    col.set(0, 0, 0);
    return col;
  }

  // a glass cup of the twelve
  function kin_cup(parent, glassM, waterM, surfM, bronze, k) {
    k = k || 1;
    var c = new THREE.Group(), rw = 0.165 * k, hh = 0.5 * k;
    var gl = new THREE.Mesh(new THREE.CylinderBufferGeometry(rw + 0.02, rw, hh, 32, 1, true), glassM); gl.position.y = hh / 2 + 0.03; gl.renderOrder = 6; c.add(gl);
    var foot = cyl(rw + 0.035, rw + 0.05, 0.04, 32, bronze); foot.position.y = 0.02; c.add(foot);
    var lip = new THREE.Mesh(new THREE.TorusBufferGeometry(rw + 0.02, 0.018, 8, 32), bronze); lip.rotation.x = Math.PI / 2; lip.position.y = hh + 0.03; c.add(lip);
    var wg = new THREE.CylinderBufferGeometry(rw - 0.01, rw - 0.012, 1, 24, 1, true); wg.translate(0, 0.5, 0);
    var w = new THREE.Mesh(wg, waterM); w.position.y = 0.045; w.renderOrder = 3; c.add(w);
    var top = new THREE.Mesh(new THREE.CircleBufferGeometry(rw - 0.01, 24), surfM); top.rotation.x = -Math.PI / 2; top.renderOrder = 4; c.add(top);
    parent.add(c);
    var cup = { g: c, cur: 0, set: function (f) { var hgt = 0.004 + f * (hh - 0.07); w.scale.y = hgt; top.position.y = 0.045 + hgt; w.visible = top.visible = f > 0.004; } };
    cup.set(0);
    return cup;
  }

  function kin_clockWater(W, matName) {
    var r = W.r, g = new THREE.Group(), T = W.P.clockTraits || {};
    var vessel = T['Vessel'] || 'Column', wc = KIN_WATER[T['Water']] || KIN_WATER.Clear;
    var hero = kin_hero(matName), bronze = kin_bronze(), stone = mtl('#A89E8F', 'stone', 0.9, 0, 1.4);
    var glassM = kin_glass(0.17);
    var waterM = new THREE.MeshStandardMaterial({ color: C(wc[0]), roughness: 0.08, metalness: 0.05, transparent: true, opacity: wc[1], depthWrite: false, emissive: C(wc[2]), emissiveIntensity: 0, side: THREE.DoubleSide });
    var surfM = new THREE.MeshStandardMaterial({ color: C(wc[0]).lerp(C('#FFFFFF'), 0.25), roughness: 0.14, metalness: 0.2, transparent: true, opacity: Math.min(0.92, wc[1] + 0.25), depthWrite: false, emissive: C(wc[2]), emissiveIntensity: 0, side: THREE.DoubleSide });
    var streamM = new THREE.MeshStandardMaterial({ color: C(wc[0]).lerp(C('#FFFFFF'), 0.45), roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.8, depthWrite: false, emissive: C(wc[2]), emissiveIntensity: 0 });
    waterM.envMapIntensity = 0.35; surfM.envMapIntensity = 0.9; streamM.envMapIntensity = 0.6;
    W.glow(waterM, 0.03, 0.75); W.glow(surfM, 0.05, 1.0); W.glow(streamM, 0.05, 1.1);
    var cupGlass = kin_glass(0.3); cupGlass.color = C('#DDEBEC'); cupGlass.envMapIntensity = 1.2;
    // the cups hold brighter water, faintly lit, so a full cup reads from the road
    var cupW = new THREE.MeshStandardMaterial({ color: C(wc[2]).lerp(C(wc[0]), 0.35), roughness: 0.1, metalness: 0, transparent: true, opacity: 0.9, depthWrite: false, emissive: C(wc[2]), emissiveIntensity: 0 });
    cupW.envMapIntensity = 0.4; W.glow(cupW, 0.28, 1.1);
    var twin = vessel === 'Twin Columns', rc = twin ? 0.48 : 0.56, Hw = 3.3;
    var pl = 0.62, stepH = 0.22, yb = stepH + pl + 0.2;
    var minuteOpts = { n: 60, every: 5, strong: 15, label: function (k) { return String(k); } };
    var hourOpts = { n: 48, every: 4, strong: 12, label: function (k) { return String(k === 0 ? 12 : k / 4); } };
    var cols = [], common = { rc: rc, yb: yb, Hw: Hw, hero: hero, bronze: bronze, glass: glassM, waterM: waterM, surfM: surfM, streamM: streamM };
    function mk(x, side, o) { var q = {}, k; for (k in common) q[k] = common[k]; for (k in o) q[k] = o[k]; q.x = x; q.side = side; return kin_waterColumn(W, g, q); }
    var left, right;
    if (twin) {
      var hc = mk(-(rc + 0.26), -1, hourOpts); hc.hours = true;
      var mc = mk(rc + 0.26, 1, minuteOpts);
      cols.push(hc, mc);
      left = hc.xs - hc.sw / 2; right = mc.xs + mc.sw / 2;
    } else {
      var cx = vessel === 'Tiered Basins' ? 0.55 : -0.45;
      var c1 = mk(cx, 1, minuteOpts); cols.push(c1);
      var pw = 0.46, px = cx - rc - 0.26 - pw / 2, pH = c1.topY + 0.14 - (yb - 0.22);
      var pier = kin_bbox(pw, pH, 0.46, 0.03, hero); pier.position.set(px, yb - 0.22 + pH / 2, 0); g.add(pier);
      left = px - pw / 2; right = c1.xs + c1.sw / 2;
    }
    var topY = cols[0].topY, mid = (left + right) / 2, span = right - left;
    // the plinth
    var W0 = span + 0.7, D0 = 1.5;
    var step = kin_bbox(W0 + 0.7, stepH, D0 + 0.7, 0.03, stone); step.position.set(mid, stepH / 2, 0); g.add(step);
    var plinth = kin_bbox(W0, pl, D0, 0.04, hero); plinth.position.set(mid, stepH + pl / 2, 0); g.add(plinth);
    var trim = box(W0 + 0.04, 0.05, D0 + 0.04, bronze); trim.position.set(mid, stepH + pl - 0.06, 0); g.add(trim);
    var dais = kin_bbox(span + 0.2, 0.2, 0.9, 0.03, hero); dais.position.set(mid, stepH + pl + 0.1, 0); g.add(dais);
    // the lintel, its cornice, the reservoir urns and the spouts
    var lh = 0.46, ly = topY + 0.14 + lh / 2;
    var lintel = kin_bbox(span + 0.3, lh, 0.9, 0.04, hero); lintel.position.set(mid, ly, 0); g.add(lintel);
    var corn = kin_bbox(span + 0.5, 0.1, 1.08, 0.02, hero); corn.position.set(mid, ly + lh / 2 + 0.05, 0); g.add(corn);
    var lband = box(span + 0.32, 0.04, 0.92, bronze); lband.position.set(mid, ly - lh / 2 + 0.07, 0); g.add(lband);
    var ttl = kin_engrave(twin ? 'HORAE  ·  MINUTAE' : 'MARFA  ·  CLEPSYDRA', { color: '#D9B66A', height: 0.2, px: 90, font: FONT_SERIF, spacing: 0.14, pad: 0.05, metal: 0.7 });
    ttl.position.set(mid, ly + 0.02, 0.451); g.add(ttl);
    cols.forEach(function (c) {
      var urn = kin_lathe([[0.001, 0], [0.2, 0], [0.24, 0.06], [0.34, 0.2], [0.36, 0.34], [0.3, 0.44], [0.33, 0.47], [0.33, 0.5], [0.001, 0.5]], 40, bronze);
      urn.position.set(c.x, ly + lh / 2 + 0.1, 0); g.add(urn);
      var spout = kin_lathe([[0.001, 0], [0.05, 0], [0.05, -0.12], [0.075, -0.16], [0.075, -0.19], [0.04, -0.19], [0.001, -0.19]], 20, bronze);
      spout.position.set(c.x, ly - lh / 2, 0); g.add(spout);
    });
    // the hours, as cups
    var cups = [], i, a, num;
    if (vessel === 'Column') {
      var Rb = 3.3, a0 = -50, a1 = 50, sh = new THREE.Shape(), ri2 = Rb - 0.3, ro = Rb + 0.3, n = 40;
      for (i = 0; i <= n; i++) { a = (a0 + (a1 - a0) * i / n) * D2R; if (i === 0) sh.moveTo(Math.sin(a) * ro, -Math.cos(a) * ro); else sh.lineTo(Math.sin(a) * ro, -Math.cos(a) * ro); }
      for (i = n; i >= 0; i--) { a = (a0 + (a1 - a0) * i / n) * D2R; sh.lineTo(Math.sin(a) * ri2, -Math.cos(a) * ri2); }
      var bgeo = new THREE.ExtrudeBufferGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2 }); bgeo.rotateX(-Math.PI / 2);
      var benchM = kin_hero(matName); benchM.roughness = Math.max(benchM.roughness, 0.45);
      var bench = new THREE.Mesh(bgeo, benchM); bench.position.set(mid, 0.03, 0); g.add(bench);
      for (i = 0; i < 12; i++) {
        a = (a0 + 4 + (a1 - a0 - 8) * i / 11) * D2R;
        var cp = kin_cup(g, cupGlass, cupW, cupW, bronze, 1.1);
        cp.g.position.set(mid + Math.sin(a) * Rb, 0.58, Math.cos(a) * Rb); cups.push(cp);
        num = kin_engrave(KIN_ROMAN[i + 1], { color: '#D9B66A', height: 0.17, px: 80, font: FONT_SERIF, pad: 0.05 });
        num.position.set(mid + Math.sin(a) * (ro + 0.03), 0.3, Math.cos(a) * (ro + 0.03)); num.rotation.y = a; g.add(num);
      }
    } else if (vessel === 'Tiered Basins') {
      var sx = left - 1.4;
      for (var k = 0; k < 3; k++) {
        var th = 0.45 + k * 0.5, tz = 0.66 - k * 0.62, tier = kin_bbox(2.3, th, 0.62, 0.025, hero);
        tier.position.set(sx, th / 2, tz); g.add(tier);
        var tb = box(2.32, 0.03, 0.64, bronze); tb.position.set(sx, th - 0.03, tz); g.add(tb);
        for (var s = 0; s < 4; s++) {
          var cp2 = kin_cup(g, cupGlass, cupW, cupW, bronze, 1.1);
          cp2.g.position.set(sx + (s - 1.5) * 0.54, th, tz); cups.push(cp2);
          num = kin_engrave(String(k * 4 + s + 1), { color: '#D9B66A', height: 0.14, px: 80, font: FONT_SERIF, pad: 0.05 });
          num.position.set(sx + (s - 1.5) * 0.54, th - 0.14, tz + 0.315); g.add(num);
        }
      }
      left = sx - 1.15;
    }
    // a bronze plate on the plinth
    var plate = box(1.5, 0.3, 0.03, mtl('#B89150', 'brushed', 0.4, 0.8, 0.5)); plate.position.set(mid, stepH + pl / 2 - 0.02, D0 / 2 + 0.015); g.add(plate);
    kin_bolts(plate, 1.5, 0.3, 0.018, bronze, 0.05);
    var pt = kin_engrave(['MARFA  30.31 N  104.02 W', 'MLOW.XYZ'], { color: '#2A1D0E', height: 0.2, px: 60, font: FONT_MONO, pad: 0.04, metal: 0.2 });
    pt.position.set(mid, stepH + pl / 2 - 0.02, D0 / 2 + 0.032); g.add(pt);
    g.add(W.lamp(wc[3], 0.9, 10, new THREE.Vector3(mid, yb + 1.4, 3.0)));
    shade(g);
    // glass and water do not cast
    var wet = [glassM, cupGlass, cupW, waterM, surfM, streamM];
    g.traverse(function (o) { if (o.isMesh && wet.indexOf(o.material) >= 0) { o.castShadow = false; o.receiveShadow = false; } });
    // centre the whole composition on the origin, where the camera looks
    var outer = new THREE.Group(); g.position.x = -(left + right) / 2; outer.add(g);
    var R = (right - left) / 2 + 0.8;
    if (vessel === 'Column') R = Math.max(R, 3.5);
    var H = ly + lh / 2 + 0.6;
    return {
      group: outer, R: R, lookY: H * 0.46, dist: rf(r, 11.5, 13.5) + (twin ? 0.8 : 0) + (vessel === 'Tiered Basins' ? 0.7 : 0), camH: [1.6, 2.7], face: true,
      close: { zoom: 0.5, el: 0.1, look: 0.4 },
      update: function (ctx) {
        var t = ctx.t, L = kin_hourFrac(t), dt = ctx.dt, rate = ctx.fast ? 3 : 1 / 3;
        cols.forEach(function (c) {
          var target = c.hours ? ((t.h % 12) + L) / 12 : L;
          if (ctx.snap || target >= c.cur) c.cur = target;
          else c.cur = Math.max(target, c.cur - dt * rate);
          c.drain = clamp((c.cur - target) * 3, 0, 1);
          c.set(c.cur, c.drain, ctx.real);
        });
        var hk = kin_hour12(t.h);
        cups.forEach(function (cp, i) {
          var f = i < hk ? 1 : 0;
          if (ctx.snap) cp.cur = f; else cp.cur += clamp(f - cp.cur, -dt * rate, dt * rate);
          cp.set(cp.cur);
        });
      }
    };
  }

  // =====================================================================
  // 2. HOURGLASS
  // One hour of sand. At the top of every hour the glass turns itself over
  // on its pivot, and one more mark on the plinth lights.
  // =====================================================================
  var KIN_SAND = { 'White Gypsum': '#EEE8DA', 'Red Desert': '#B4532F', 'Crushed Turquoise': '#43B5AA' };
  var KIN_HG = { H: 1.45, neck: 0.045, R: 0.78, c: 0.52 };
  // inner radius of one bulb at u (0 at the neck, 1 at the end)
  function kin_hgR(u) {
    var q = (u - KIN_HG.c) / KIN_HG.c;
    return KIN_HG.neck + (KIN_HG.R - KIN_HG.neck) * Math.sqrt(Math.max(0, 1 - q * q * (u > KIN_HG.c ? 0.86 : 1)));
  }
  // cumulative volume from the neck, tabulated, so the sand moves linearly with time
  var kin_hgTab = null;
  function kin_hgVol() {
    if (kin_hgTab) return kin_hgTab;
    var N = 400, v = [0], acc = 0;
    for (var i = 1; i <= N; i++) { var rr = kin_hgR((i - 0.5) / N); acc += Math.PI * rr * rr * KIN_HG.H / N; v.push(acc); }
    return (kin_hgTab = v);
  }
  function kin_hgInv(vol) {
    var v = kin_hgVol(), N = v.length - 1;
    if (vol <= 0) return 0;
    for (var i = 1; i <= N; i++) if (v[i] >= vol) return (i - 1 + (vol - v[i - 1]) / (v[i] - v[i - 1])) / N;
    return 1;
  }
  // where the sand stands at fraction f of the hour: top level (u from the
  // neck) and bottom depth (u from the far end)
  function kin_sandAt(f) {
    var v = kin_hgVol(), N = v.length - 1, full = v[Math.round(N * 0.7)];
    var top = kin_hgInv(full * (1 - f));
    var want = full * f, bot = want <= 0 ? 0 : 1 - kin_hgInv(v[N] - want);
    return { top: top, bot: bot };
  }
  function kin_sandGeos(f) {
    var H = KIN_HG.H, s = kin_sandAt(f), top = [], bot = [], n = 18, i, u, pileTop = -H;
    if (s.top > 0.004) {
      top.push([0.001, 0.02]);
      for (i = 0; i <= n; i++) { u = s.top * i / n; top.push([Math.max(0.01, kin_hgR(u) * 0.965), u * H]); }
      var dip = Math.min(0.2, kin_hgR(s.top) * 0.32) * (f > 0.002 ? 1 : 0.35);
      top.push([kin_hgR(s.top) * 0.5, s.top * H - dip * 0.45]);
      top.push([0.001, Math.max(0.03, s.top * H - dip)]);
    }
    if (s.bot > 0.002) {
      var u0 = 1 - s.bot, peak = Math.min(0.34, kin_hgR(u0) * 0.42);
      bot.push([0.001, -H + 0.004]);
      for (i = 0; i <= n; i++) { u = 1 - s.bot * i / n; bot.push([kin_hgR(u) * 0.965, -u * H]); }
      bot.push([kin_hgR(u0) * 0.45, -u0 * H + peak * 0.5]);
      bot.push([0.001, -u0 * H + peak]);
      pileTop = -u0 * H + peak;
    }
    var mk = function (p) { return p.length ? new THREE.LatheBufferGeometry(p.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 40) : null; };
    return { top: mk(top), bot: mk(bot), s: s, pileTop: pileTop };
  }

  function kin_clockHourglass(W, matName) {
    var r = W.r, g = new THREE.Group(), T = W.P.clockTraits || {}, frame = T['Frame'] || 'Brass Posts';
    var sandHex = KIN_SAND[T['Sand']] || KIN_SAND['White Gypsum'];
    var hero = kin_hero(matName), bronze = kin_bronze(), stone = mtl('#A99F90', 'stone', 0.92, 0, 1.4);
    var brass = mtl('#B89150', 'brushed', 0.4, 1, 0.5), wood = mtl('#6E4B2C', 'wood', 0.78, 0, 0.7);
    var obs = std('#111216', 0.1, 0.3, { tex: 'marble', tile: 1.8 });
    var H = KIN_HG.H, mono = frame === 'Obsidian Monolith', i, u;
    var postM = frame === 'Timber' ? wood : mono ? hero : brass, plateM = postM;
    var pl = 0.6, stepH = 0.2, Py = stepH + pl + 2.02;
    // plinth
    var Wp = mono ? 6.9 : 4.2, Dp = mono ? 2.4 : 2.6;
    var step = kin_bbox(Wp + 0.6, stepH, Dp + 0.6, 0.03, stone); step.position.y = stepH / 2; g.add(step);
    // a metal hero would mirror the low sun off the plinth top, so metal frames stand on dark stone
    var plM = mono ? obs : (MATERIALS[matName] && MATERIALS[matName].metal > 0.5 ? mtl('#2E2A27', 'stone', 0.7, 0, 1.2) : hero);
    var plinth = kin_bbox(Wp, pl, Dp, 0.04, plM); plinth.position.y = stepH + pl / 2; g.add(plinth);
    var pband = box(Wp + 0.03, 0.04, Dp + 0.03, bronze); pband.position.y = stepH + pl - 0.07; g.add(pband);
    // the rotor: glass, plates, posts
    var rotor = new THREE.Group(); rotor.position.y = Py; g.add(rotor);
    var prof = [];
    for (i = 40; i >= 0; i--) { u = i / 40; prof.push([kin_hgR(u) + 0.018, u * H]); }
    for (i = 1; i <= 40; i++) { u = i / 40; prof.push([kin_hgR(u) + 0.018, -u * H]); }
    var glass = kin_lathe(prof, 64, kin_glass(0.16)); glass.renderOrder = 6; rotor.add(glass);
    var neckRing = new THREE.Mesh(new THREE.TorusBufferGeometry(0.07, 0.022, 10, 24), brass); neckRing.rotation.x = Math.PI / 2; rotor.add(neckRing);
    var ph = 0.12, py = H + 0.03 + ph / 2, pp = 0.7, endR = kin_hgR(1) + 0.03;
    [-1, 1].forEach(function (sd) {
      var plate;
      if (frame === 'Brass Posts') {
        plate = cyl(1.06, 1.06, ph, 64, plateM);
        var bead = new THREE.Mesh(new THREE.TorusBufferGeometry(1.06, 0.035, 8, 64), plateM); bead.rotation.x = Math.PI / 2; bead.position.y = py * sd; rotor.add(bead);
        var fin = kin_lathe([[0.001, 0], [0.16, 0], [0.12, 0.05], [0.07, 0.1], [0.09, 0.16], [0.001, 0.2]], 24, plateM);
        fin.position.y = sd * (py + ph / 2); if (sd < 0) fin.rotation.x = Math.PI; rotor.add(fin);
      } else plate = kin_bbox(1.9, ph, 1.9, 0.03, plateM);
      plate.position.y = py * sd; rotor.add(plate);
      var seat = cyl(endR + 0.05, endR + 0.08, 0.06, 40, brass); seat.position.y = sd * H; rotor.add(seat);
      // side bars and hubs on the pivot axis
      var bar = box(0.08, 0.1, 2 * pp + 0.1, postM); bar.position.set(sd * pp, 0, 0); rotor.add(bar);
      var hub = cyl(0.11, 0.11, 0.16, 20, brass); hub.rotation.z = Math.PI / 2; hub.position.set(sd * (pp + 0.1), 0, 0); rotor.add(hub);
    });
    var L = 2 * py - ph;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
      var post;
      if (frame === 'Brass Posts') {
        var pts = [], N = 36;
        for (var k = 0; k <= N; k++) {
          var y = -L / 2 + L * k / N, d1 = Math.abs(Math.abs(y) - (L / 2 - 0.16)), d0 = Math.abs(y);
          pts.push([0.042 + 0.045 * Math.exp(-d1 * d1 / 0.0025) + 0.03 * Math.exp(-d0 * d0 / 0.004) + 0.012 * Math.exp(-Math.pow(Math.abs(y) - L / 4, 2) / 0.01), y]);
        }
        post = kin_lathe(pts, 16, postM);
      } else if (frame === 'Timber') {
        post = kin_bbox(0.15, L, 0.15, 0.015, postM);
        [-1, 1].forEach(function (sd) {
          var bolt = cyl(0.03, 0.03, 0.02, 8, bronze); bolt.rotation.x = Math.PI / 2;
          bolt.position.set(q[0] * pp, sd * (L / 2 - 0.12), q[1] * pp + q[1] * 0.08); rotor.add(bolt);
        });
      } else post = kin_bbox(0.1, L, 0.1, 0.01, postM);
      post.position.set(q[0] * pp, 0, q[1] * pp); rotor.add(post);
    });
    // the sand lives in its own group, kept upright between turns
    var sandM = mtl(sandHex, 'sand', 0.96, 0, 0.25); sandM.side = THREE.DoubleSide;
    var sandG = new THREE.Group(); rotor.add(sandG);
    var topS = new THREE.Mesh(new THREE.BufferGeometry(), sandM), botS = new THREE.Mesh(new THREE.BufferGeometry(), sandM);
    sandG.add(topS); sandG.add(botS);
    var streamM = mtl(sandHex, 'sand', 0.9, 0, 0.1);
    var stream = cyl(0.012, 0.012, 1, 6, streamM); stream.geometry.translate(0, -0.5, 0); stream.position.y = 0.01; sandG.add(stream);
    var grains = [];
    for (i = 0; i < 8; i++) { var gr = box(0.018, 0.03, 0.018, streamM); sandG.add(gr); grains.push(gr); }
    // supports
    var ax = pp + 0.18;
    if (mono) {
      var Rh = 2.36, Wm = 2 * Rh + 1.5, Hm = Py - (stepH + pl) + Rh + 0.75, sh = new THREE.Shape();
      sh.moveTo(-Wm / 2, 0); sh.lineTo(Wm / 2, 0); sh.lineTo(Wm / 2, Hm); sh.lineTo(-Wm / 2, Hm); sh.lineTo(-Wm / 2, 0);
      var hole = new THREE.Path(); hole.absarc(0, Py - stepH - pl, Rh, 0, Math.PI * 2, true); sh.holes.push(hole);
      var mgeo = new THREE.ExtrudeBufferGeometry(sh, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 72 });
      mgeo.translate(0, 0, -0.3);
      var slab = new THREE.Mesh(mgeo, obs); slab.position.y = stepH + pl; g.add(slab);
      [-1, 1].forEach(function (sd) {
        var inl = new THREE.Mesh(new THREE.TorusBufferGeometry(Rh + 0.02, 0.035, 8, 96), brass); inl.position.set(0, Py, sd * 0.345); g.add(inl);
        var axle = cyl(0.06, 0.06, Rh - ax + 0.1, 16, brass); axle.rotation.z = Math.PI / 2; axle.position.set(sd * (ax + (Rh - ax) / 2), Py, 0); g.add(axle);
        var coll = cyl(0.14, 0.14, 0.12, 20, brass); coll.rotation.z = Math.PI / 2; coll.position.set(sd * (Rh - 0.02), Py, 0); g.add(coll);
      });
      var lab = kin_engrave(['ONE HOUR', 'OF MARFA'], { color: '#D9B66A', height: 0.34, px: 80, font: FONT_SERIF, spacing: 0.12, pad: 0.05, metal: 0.8 });
      lab.position.set(-Wm / 2 + 0.2 + lab.userData.w / 2, stepH + pl + Hm - 0.45, 0.345); g.add(lab);
    } else {
      [-1, 1].forEach(function (sd) {
        var xx = sd * 1.42, footY = stepH + pl, dz = 1.0, top = new THREE.Vector3(xx, Py, 0);
        [-1, 1].forEach(function (zz) {
          var a = new THREE.Vector3(xx, footY, zz * dz), dir = top.clone().sub(a), len = dir.length();
          var leg = kin_bbox(0.2, len + 0.1, 0.2, 0.02, hero);
          leg.position.copy(a).addScaledVector(dir, 0.5);
          leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); g.add(leg);
          var shoe = kin_bbox(0.34, 0.1, 0.34, 0.015, bronze); shoe.position.set(xx, footY + 0.05, zz * dz); g.add(shoe);
        });
        var tie = kin_bbox(0.14, 0.14, 1.05, 0.015, hero); tie.position.set(xx, footY + (Py - footY) * 0.42, 0); g.add(tie);
        var block = kin_bbox(0.34, 0.42, 0.42, 0.03, hero); block.position.set(xx, Py, 0); g.add(block);
        var brg = cyl(0.17, 0.17, 0.4, 24, bronze); brg.rotation.z = Math.PI / 2; brg.position.set(xx, Py, 0); g.add(brg);
        var cap = cyl(0.1, 0.12, 0.06, 20, brass); cap.rotation.z = Math.PI / 2; cap.position.set(xx + sd * 0.22, Py, 0); g.add(cap);
        var axle = cyl(0.055, 0.055, 1.42 - ax + 0.05, 14, brass); axle.rotation.z = Math.PI / 2; axle.position.set(sd * (ax + (1.42 - ax) / 2), Py, 0); g.add(axle);
      });
    }
    // the hours: twelve marks on the plinth front
    var marks = [], offM = std('#1A1714', 0.6, 0.3), onM = W.glow(glowMat('#FFC878', 0.9), 0.9, 2.2);
    var panel = box(3.3, 0.36, 0.03, bronze); panel.position.set(0, stepH + pl * 0.5, Dp / 2 + 0.015); g.add(panel);
    kin_bolts(panel, 3.3, 0.36, 0.018, bronze, 0.06);
    for (i = 0; i < 12; i++) {
      var mx = -1.21 + i * 0.22, mk = box(0.06, 0.2, 0.02, offM); mk.position.set(mx, stepH + pl * 0.5 + 0.03, Dp / 2 + 0.035); g.add(mk); marks.push(mk);
      var nn = kin_engrave(String(i + 1), { color: '#2A1D0E', height: 0.07, px: 60, font: FONT_MONO, pad: 0.02, metal: 0.2 });
      nn.position.set(mx, stepH + pl * 0.5 - 0.12, Dp / 2 + 0.032); g.add(nn);
    }
    var hl = kin_engrave('MARFA', { color: '#2A1D0E', height: 0.11, px: 70, font: FONT_SERIF, pad: 0.02, spacing: 0.1, metal: 0.2 });
    hl.position.set(-1.5, stepH + pl * 0.5 + 0.03, Dp / 2 + 0.032); g.add(hl);
    g.add(W.lamp('#FFD9A0', 1.1, 9, new THREE.Vector3(0, stepH + pl + 0.2, 3.2)));
    shade(g);
    glass.castShadow = false;
    var st = { key: '', flipT: -1, lastHour: null, hlit: -1, pileTop: -H };
    function setSand(f) {
      var q = kin_sandGeos(f);
      topS.geometry.dispose(); botS.geometry.dispose();
      topS.geometry = q.top || new THREE.BufferGeometry(); botS.geometry = q.bot || new THREE.BufferGeometry();
      topS.visible = !!q.top; botS.visible = !!q.bot;
      st.pileTop = q.pileTop;
    }
    return {
      group: g, R: mono ? 4.2 : 2.9, lookY: Py * 0.72, dist: mono ? rf(r, 14, 16) : rf(r, 11, 13), camH: [1.6, 2.6], face: true,
      close: { zoom: 0.5, el: 0.1, look: 0.6 },
      update: function (ctx) {
        var t = ctx.t, hourKey = t.days * 24 + t.h, f = kin_hourFrac(t), dur = ctx.fast ? 0.35 : 2.0;
        if (ctx.snap || st.lastHour === null || Math.abs(hourKey - st.lastHour) > 1) { st.flipT = -1; st.lastHour = hourKey; }
        else if (hourKey !== st.lastHour) { st.flipT = 0; st.lastHour = hourKey; }
        var par = ((hourKey % 2) + 2) % 2, e = 1, showF = f, sandPar = par;
        if (st.flipT >= 0) {
          st.flipT += ctx.dt / dur; e = kin_easeIO(st.flipT);
          if (st.flipT >= 1) { st.flipT = -1; e = 1; }
          else if (e < 0.5) { showF = 1; sandPar = 1 - par; }
          else showF = 0;
        }
        rotor.rotation.x = ((1 - par) + e) * Math.PI;
        sandG.rotation.x = sandPar * Math.PI;
        var key = sandPar + ':' + Math.round(showF * 1500);
        if (key !== st.key) { setSand(showF); st.key = key; }
        var flowing = st.flipT < 0 && f < 0.9995;
        stream.visible = flowing;
        if (flowing) {
          stream.scale.y = Math.max(0.02, 0.01 - st.pileTop);
          stream.scale.x = stream.scale.z = 0.8 + 0.3 * Math.sin(ctx.real * 31);
        }
        for (i = 0; i < grains.length; i++) {
          var uu = (ctx.real * 1.7 + i / grains.length) % 1;
          grains[i].visible = flowing;
          grains[i].position.set(Math.sin(i * 7.1 + ctx.real * 5) * 0.012, -uu * uu * Math.max(0.02, -st.pileTop), Math.cos(i * 3.3) * 0.012);
        }
        var hk = kin_hour12(t.h);
        if (hk !== st.hlit) { for (i = 0; i < 12; i++) marks[i].material = i < hk ? onM : offM; st.hlit = hk; }
      }
    };
  }

  // =====================================================================
  // 3. WORD CLOCK
  // A wall of letters. The words that tell the time light, to the nearest
  // five minutes; the four corner dots add the minutes between.
  // =====================================================================
  var KIN_WORDS = {
    English: {
      rows: ['ITLISASAMPM', 'ACQUARTERDC', 'TWENTYFIVEX', 'HALFSTENFTO', 'PASTERUNINE', 'ONESIXTHREE', 'FOURFIVETWO', 'EIGHTELEVEN', 'SEVENTWELVE', 'TENSEOCLOCK'],
      words: { IT: [0, 0, 2], IS: [0, 3, 2], A: [1, 0, 1], QUARTER: [1, 2, 7], TWENTY: [2, 0, 6], FIVE_M: [2, 6, 4], HALF: [3, 0, 4], TEN_M: [3, 5, 3], TO: [3, 9, 2],
        PAST: [4, 0, 4], NINE: [4, 7, 4], ONE: [5, 0, 3], SIX: [5, 3, 3], THREE: [5, 6, 5], FOUR: [6, 0, 4], FIVE: [6, 4, 4], TWO: [6, 8, 3], EIGHT: [7, 0, 5],
        ELEVEN: [7, 5, 6], SEVEN: [8, 0, 5], TWELVE: [8, 5, 6], TEN: [9, 0, 3], OCLOCK: [9, 5, 6] }
    },
    Spanish: {
      rows: ['ESONELASUNA', 'DOSITRESORE', 'CUATROCINCO', 'SEISASIETEN', 'OCHONUEVEYO', 'LADIEZSONCE', 'DOCELYMENOS', 'OVEINTEDIEZ', 'VEINTICINCO', 'MEDIACUARTO'],
      words: { ES: [0, 0, 2], SON: [0, 1, 3], LA: [0, 5, 2], LAS: [0, 5, 3], UNA: [0, 8, 3], DOS: [1, 0, 3], TRES: [1, 4, 4], CUATRO: [2, 0, 6], CINCO_H: [2, 6, 5],
        SEIS: [3, 0, 4], SIETE: [3, 5, 5], OCHO: [4, 0, 4], NUEVE: [4, 4, 5], DIEZ_H: [5, 2, 4], ONCE: [5, 7, 4], DOCE: [6, 0, 4], Y: [6, 5, 1], MENOS: [6, 6, 5],
        VEINTE: [7, 1, 6], DIEZ_M: [7, 7, 4], VEINTICINCO: [8, 0, 11], CINCO_M: [8, 6, 5], MEDIA: [9, 0, 5], CUARTO: [9, 5, 6] }
    }
  };
  // the words lit at h:m (24-hour input, read on a 12-hour face)
  function kin_wordsFor(lang, h, m) {
    var m5 = Math.floor(m / 5) * 5, out, hh;
    if (lang === 'Spanish') {
      var HS = ['DOCE', 'UNA', 'DOS', 'TRES', 'CUATRO', 'CINCO_H', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ_H', 'ONCE'];
      var menos = m5 >= 35;
      hh = (h + (menos ? 1 : 0)) % 12;
      out = hh === 1 ? ['ES', 'LA'] : ['SON', 'LAS'];
      out.push(HS[hh]);
      if (!menos) { if (m5 > 0) out.push('Y', { 5: 'CINCO_M', 10: 'DIEZ_M', 15: 'CUARTO', 20: 'VEINTE', 25: 'VEINTICINCO', 30: 'MEDIA' }[m5]); }
      else out.push('MENOS', { 35: 'VEINTICINCO', 40: 'VEINTE', 45: 'CUARTO', 50: 'DIEZ_M', 55: 'CINCO_M' }[m5]);
      return out;
    }
    var HE = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
    out = ['IT', 'IS'];
    if (m5 === 0) return out.concat([HE[h % 12], 'OCLOCK']);
    if (m5 <= 30) return out.concat({ 5: ['FIVE_M'], 10: ['TEN_M'], 15: ['A', 'QUARTER'], 20: ['TWENTY'], 25: ['TWENTY', 'FIVE_M'], 30: ['HALF'] }[m5], ['PAST', HE[h % 12]]);
    return out.concat({ 35: ['TWENTY', 'FIVE_M'], 40: ['TWENTY'], 45: ['A', 'QUARTER'], 50: ['TEN_M'], 55: ['FIVE_M'] }[m5], ['TO', HE[(h + 1) % 12]]);
  }
  // 110 flags, row by row, and the number of corner dots
  function kin_wordMask(lang, h, m) {
    var L = KIN_WORDS[lang] || KIN_WORDS.English, mask = [], i;
    for (i = 0; i < 110; i++) mask.push(0);
    kin_wordsFor(lang, h, m).forEach(function (w) {
      var p = L.words[w];
      for (var k = 0; k < p[2]; k++) mask[p[0] * 11 + p[1] + k] = 1;
    });
    return { mask: mask, dots: m % 5 };
  }
  // what the wall says, for tests: the lit letters, a space between runs
  function kin_wordRead(lang, h, m) {
    var L = KIN_WORDS[lang] || KIN_WORDS.English, q = kin_wordMask(lang, h, m), s = '';
    for (var row = 0; row < 10; row++) {
      for (var c = 0; c < 11; c++) {
        var i = row * 11 + c;
        if (q.mask[i]) { if (s && !(c > 0 && q.mask[i - 1])) s += ' '; s += L.rows[row][c]; }
      }
    }
    return s + (q.dots ? ' +' + q.dots : '');
  }
  var kin_letterAtlas = null;
  var KIN_ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function kin_atlas() {
    if (kin_letterAtlas) return kin_letterAtlas;
    var cols = 8, rows = 4, cw = 128;
    var tex = canvasTex(cols * cw, rows * cw, function (g) {
      g.clearRect(0, 0, cols * cw, rows * cw);
      g.fillStyle = '#FFFFFF'; g.font = '600 90px ' + FONT_SANS; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (var i = 0; i < KIN_ABC.length; i++) g.fillText(KIN_ABC[i], (i % cols) * cw + cw / 2, Math.floor(i / cols) * cw + cw / 2 + 4);
    });
    tex.userData = { shared: true };
    return (kin_letterAtlas = { tex: tex, cols: cols, rows: rows });
  }
  function kin_letterUV(geo, ch) {
    var a = kin_atlas(), i = Math.max(0, KIN_ABC.indexOf(ch)), col = i % a.cols, row = Math.floor(i / a.cols), e = 0.004;
    var u0 = col / a.cols + e, u1 = (col + 1) / a.cols - e, v1 = 1 - row / a.rows - e, v0 = 1 - (row + 1) / a.rows + e;
    var arr = geo.attributes.uv.array;
    arr[0] = u0; arr[1] = v1; arr[2] = u1; arr[3] = v1; arr[4] = u0; arr[5] = v0; arr[6] = u1; arr[7] = v0;
    geo.attributes.uv.needsUpdate = true;
  }
  var KIN_FACES = {
    'Ink':      { face: '#131417', rough: 0.6, metal: 0.1, tex: 'paint', off: '#565A62', seam: 'rgba(255,255,255,0.05)' },
    'Concrete': { face: '#55514B', rough: 0.95, metal: 0.0, tex: 'concrete', off: '#35332F', seam: 'rgba(0,0,0,0.22)' },
    'Mirror':   { face: '#9CA2AA', rough: 0.22, metal: 0.8, tex: 'brushed', off: '#3A3E45', seam: 'rgba(0,0,0,0.3)' }
  };
  function kin_clockWords(W, matName) {
    var r = W.r, g = new THREE.Group(), T = W.P.clockTraits || {};
    var lang = T['Language'] === 'Spanish' ? 'Spanish' : 'English', F = KIN_FACES[T['Face']] || KIN_FACES.Ink, L = KIN_WORDS[lang];
    var hero = kin_hero(matName), bronze = kin_bronze(), stone = mtl('#A39A8C', 'concrete', 0.95, 0, 1.8);
    var p = 0.46, gw = 11 * p, gh = 10 * p, fw = gw + 0.8, fh = gh + 0.9, sw = fw + 0.44, sh = fh + 0.44, sd = 0.55;
    var baseH = 0.55, cy = baseH + sh / 2;
    var plinth = kin_bbox(sw + 0.5, baseH, 1.5, 0.04, stone); plinth.position.y = baseH / 2; g.add(plinth);
    var slab = kin_bbox(sw, sh, sd, 0.05, hero); slab.position.y = cy; g.add(slab);
    // the face panel with its seams
    var seams = canvasTex(1100, 1000, function (c) {
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 1100, 1000);
      var ox = 0.4 / fw * 1100, oy = 0.45 / fh * 1000, cx = p / fw * 1100, cyy = p / fh * 1000;
      c.strokeStyle = F.seam; c.lineWidth = 2;
      for (var i = 0; i <= 11; i++) { c.beginPath(); c.moveTo(ox + i * cx, oy); c.lineTo(ox + i * cx, oy + 10 * cyy); c.stroke(); }
      for (i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(ox, oy + i * cyy); c.lineTo(ox + 11 * cx, oy + i * cyy); c.stroke(); }
    });
    var faceM = std(F.face, F.rough, F.metal, { tex: F.tex, tile: 1.0, map: seams });
    var face = box(fw, fh, 0.05, faceM); face.position.set(0, cy, sd / 2 + 0.02); g.add(face);
    var fz = sd / 2 + 0.05;
    // a thin bronze frame round the face
    [[0, fh / 2 + 0.02, fw + 0.08, 0.04], [0, -fh / 2 - 0.02, fw + 0.08, 0.04], [fw / 2 + 0.02, 0, 0.04, fh], [-fw / 2 - 0.02, 0, 0.04, fh]].forEach(function (q) {
      var b = box(q[2], q[3], 0.08, bronze); b.position.set(q[0], cy + q[1], sd / 2 + 0.03); g.add(b);
    });
    var atlas = kin_atlas(), tiles = [], warm = C('#FFE9C8'), offC = C(F.off), litC = C('#FFF4E2');
    for (var row = 0; row < 10; row++) for (var c = 0; c < 11; c++) {
      var geo = new THREE.PlaneBufferGeometry(p * 0.92, p * 0.92); kin_letterUV(geo, L.rows[row][c]);
      var m = new THREE.MeshStandardMaterial({ map: atlas.tex, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0, color: offC.clone(), emissive: warm, emissiveMap: atlas.tex, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
      var tm = new THREE.Mesh(geo, m);
      tm.position.set(-gw / 2 + p * (c + 0.5), cy + gh / 2 - p * (row + 0.5), fz);
      g.add(tm); tiles.push({ m: m, cur: 0, to: 0 });
    }
    var dots = [];
    [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(function (q) {
      var dm = new THREE.MeshStandardMaterial({ color: offC.clone(), roughness: 0.4, metalness: 0.2, emissive: warm, emissiveIntensity: 0 });
      var d = new THREE.Mesh(new THREE.CircleBufferGeometry(0.055, 24), dm);
      d.position.set(q[0] * (gw / 2 + 0.2), cy + q[1] * (gh / 2 + 0.22), fz); g.add(d);
      var ring = new THREE.Mesh(new THREE.RingBufferGeometry(0.062, 0.075, 24), bronze); ring.position.copy(d.position); ring.position.z -= 0.001; g.add(ring);
      dots.push({ m: dm, cur: 0, to: 0 });
    });
    var foot = kin_engrave(lang === 'Spanish' ? 'HORA DE MARFA  ·  30.31 N  104.02 W' : 'MARFA TIME  ·  30.31 N  104.02 W', { color: '#C9A35A', height: 0.11, px: 60, font: FONT_MONO, pad: 0.03, spacing: 0.08, metal: 0.7 });
    foot.position.set(-gw / 2 + foot.userData.w / 2, cy - gh / 2 - 0.27, fz); g.add(foot);
    var url = kin_engrave('MLOW.XYZ', { color: '#C9A35A', height: 0.11, px: 60, font: FONT_MONO, pad: 0.03, spacing: 0.08, metal: 0.7 });
    url.position.set(gw / 2 - url.userData.w / 2, cy - gh / 2 - 0.27, fz); g.add(url);
    // the slab stands in two bronze shoes
    [-1, 1].forEach(function (s2) {
      var shoe = kin_bbox(0.7, 0.34, sd + 0.24, 0.02, bronze); shoe.position.set(s2 * (sw / 2 - 0.8), baseH + 0.15, 0); g.add(shoe);
      kin_bolts(shoe, 0.7, 0.34, (sd + 0.24) / 2 + 0.005, bronze, 0.08);
    });
    g.add(W.lamp('#FFE2B8', 0.7, 9, new THREE.Vector3(0, 0.7, 3.4)));
    shade(g);
    var lastKey = '', Iday = 0.95, Inight = 1.7;
    function target(t) {
      var q = kin_wordMask(lang, t.h, t.m);
      for (var i = 0; i < 110; i++) tiles[i].to = q.mask[i];
      for (i = 0; i < 4; i++) dots[i].to = i < q.dots ? 1 : 0;
    }
    var all = tiles.concat(dots);
    return {
      group: g, R: sw / 2 + 0.6, lookY: cy * 0.78, dist: rf(r, 15, 17.5), camH: [1.7, 2.8], face: true,
      close: { zoom: 0.5, el: 0.12, look: 0.9 },
      update: function (ctx) {
        var t = ctx.t, key = t.h + ':' + t.m;
        if (key !== lastKey) { target(t); lastKey = key; }
        var step = ctx.snap ? 1 : (ctx.fast ? ctx.dt / 0.12 : ctx.dt / 0.6), I = lerp(Iday, Inight, ctx.night || 0);
        for (var i = 0; i < all.length; i++) {
          var o = all[i];
          if (ctx.snap) o.cur = o.to; else o.cur += clamp(o.to - o.cur, -step, step);
          o.m.color.copy(offC).lerp(litC, o.cur);
          // unlit letters keep a trace of light, as if the lamps behind them leak
          var base = i >= 110 ? 0 : lerp(0.09, 0.05, ctx.night || 0);
          o.m.emissiveIntensity = base + o.cur * (I * (i >= 110 ? 1.2 : 1) - base);
        }
      }
    };
  }

  // =====================================================================
  // 4. KINETIC PIN FIELD
  // Seven hundred and twenty pins in a steel deck. The raised ones spell
  // the time; each minute a wave runs across and the digits reform. A low
  // sun writes the time again in shadow. One pin at a time along the front
  // counts the seconds.
  // =====================================================================
  var KIN_FONT = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
  };
  var KIN_PC = 40, KIN_PR = 18, KIN_DIGX = [4, 11, 24, 31], KIN_COLX = 19, KIN_ROW0 = 2;
  // which pins stand for HH:MM, row 0 at the back. Glyph rows are doubled.
  // Values: 0 down, 1 hours, 2 colon, 3 minutes.
  function kin_pinMask(h, m) {
    var out = [], s = pad2(h) + pad2(m), i, k, row, col;
    for (i = 0; i < KIN_PC * KIN_PR; i++) out.push(0);
    for (k = 0; k < 4; k++) {
      var gl = KIN_FONT[s[k]];
      for (row = 0; row < 14; row++) for (col = 0; col < 5; col++)
        if (gl[row >> 1][col] === '1') out[(KIN_ROW0 + row) * KIN_PC + KIN_DIGX[k] + col] = k < 2 ? 1 : 3;
    }
    [4, 5, 8, 9].forEach(function (rr) { for (col = 0; col < 2; col++) out[(KIN_ROW0 + rr) * KIN_PC + KIN_COLX + col] = 2; });
    return out;
  }
  function kin_pinText(mask) {
    var s = '';
    for (var row = 0; row < KIN_PR; row++) { for (var c = 0; c < KIN_PC; c++) s += mask[row * KIN_PC + c] ? '#' : '.'; s += '\n'; }
    return s;
  }
  // the travelling seconds pin: height of pin k (0..59) at second sec
  function kin_secHeight(k, sec) {
    var si = Math.floor(sec) % 60, fr = sec - Math.floor(sec), pos = si + kin_ease(fr / 0.35);
    var d = Math.abs(k - pos); d = Math.min(d, 60 - d);
    return Math.max(0, 1 - d);
  }
  var KIN_PAL = {
    'Mono':       { lit: ['#F2EEE4', '#F2EEE4', '#F2EEE4'], off: '#77756F', sec: '#F2EEE4' },
    'Brand Tips': { lit: [BRAND.blue, BRAND.cyan, BRAND.green], off: '#1D1F23', sec: BRAND.pink },
    'Rust':       { lit: ['#E3E5E7', '#E3E5E7', '#E3E5E7'], off: '#4A2A1C', sec: '#FF8A3C' }
  };
  // a pin's cross section as geometry `hgt` tall, base at y = 0
  function kin_pinGeo(shape, kind, w, hgt) {
    var geo;
    if (shape === 'Round Rods') geo = new THREE.CylinderBufferGeometry(w / 2, w / 2, hgt, 14);
    else if (shape === 'Blossom Pins') {
      geo = new THREE.ExtrudeBufferGeometry(primShape(kind, 0, w), { depth: hgt, bevelEnabled: false, curveSegments: 6 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, -hgt / 2, 0);
    } else geo = new THREE.BoxBufferGeometry(w, hgt, w);
    geo.translate(0, hgt / 2, 0);
    return geo;
  }
  // tips take their colour, and their glow, from the instance colour
  function kin_tipMat() {
    var m = new THREE.MeshStandardMaterial({ color: C('#FFFFFF'), roughness: 0.35, metalness: 0.15, vertexColors: true, emissive: C('#FFFFFF'), emissiveIntensity: 0 });
    m.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif');
    };
    m.customProgramCacheKey = function () { return 'kin-tip-1'; };
    return m;
  }
  function kin_onesColor(geo) {
    var n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (var i = 0; i < a.length; i++) a[i] = 1;
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }

  function kin_clockPins(W, matName) {
    var r = W.r, g = new THREE.Group(), T = W.P.clockTraits || {};
    var shape = T['Pins'] || 'Square Rods', pal = KIN_PAL[T['Palette']] || KIN_PAL.Mono;
    var hero = kin_hero(matName), steel = mtl('#4B4E53', 'brushed', 0.45, 0.9, 0.6);
    var pinM = T['Palette'] === 'Rust' ? mtl('#8A4526', 'rust', 0.85, 0.25, 0.5) : kin_hero(matName);
    var tipM = W.glow(kin_tipMat(), 0, 0.7);
    var pitch = 0.14, pw = 0.118, NC = KIN_PC, NR = KIN_PR, fw = NC * pitch, fd = NR * pitch;
    var ph = 0.42, deckY = ph, front = 0.62, back = 0.3, side = 0.32, i, k;
    var PW = fw + 2 * side, PD = fd + front + back, pz = (front - back) / 2;
    // plinth, deck and its edge
    var step = kin_bbox(PW + 0.5, 0.12, PD + 0.5, 0.02, mtl('#9E968A', 'concrete', 0.95, 0, 1.6)); step.position.set(0, 0.06, pz); g.add(step);
    var plinth = kin_bbox(PW, ph - 0.12, PD, 0.03, hero); plinth.position.set(0, 0.12 + (ph - 0.12) / 2, pz); g.add(plinth);
    var holes = canvasTex(NC * 32, NR * 32, function (c) {
      c.fillStyle = '#9A9DA2'; c.fillRect(0, 0, NC * 32, NR * 32);
      for (var j = 0; j < NR; j++) for (var i = 0; i < NC; i++) {
        c.fillStyle = '#0B0C0E'; c.fillRect(i * 32 + 3, j * 32 + 3, 26, 26);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(i * 32 + 3, j * 32 + 29, 26, 2);
      }
    });
    var deck = new THREE.Mesh(new THREE.PlaneBufferGeometry(fw, fd), std('#FFFFFF', 0.62, 0.5, { map: holes, tex: 'brushed', tile: 0.6 }));
    deck.rotation.x = -Math.PI / 2; deck.position.set(0, deckY + 0.004, 0); g.add(deck);
    [[0, -fd / 2 - 0.03, fw + 0.12, 0.06], [0, fd / 2 + 0.03, fw + 0.12, 0.06], [-fw / 2 - 0.03, 0, 0.06, fd], [fw / 2 + 0.03, 0, 0.06, fd]].forEach(function (q) {
      var e = box(q[2], 0.05, q[3], steel); e.position.set(q[0], deckY + 0.025, q[1]); g.add(e);
    });
    // the seconds ledge
    var sz = fd / 2 + front * 0.52, spw = fw / 60;
    var ledgeTex = canvasTex(1920, 64, function (c) {
      c.fillStyle = '#2B2D31'; c.fillRect(0, 0, 1920, 64);
      for (var k = 0; k < 60; k++) {
        c.fillStyle = '#0A0B0C'; c.fillRect(k * 32 + 7, 14, 18, 36);
        c.fillStyle = k % 5 === 0 ? '#D8D2C4' : '#6A6C70'; c.fillRect(k * 32 + 14, k % 15 === 0 ? 0 : 4, 4, k % 5 === 0 ? 10 : 6);
      }
    });
    var ledge = new THREE.Mesh(new THREE.PlaneBufferGeometry(fw, 0.2), std('#FFFFFF', 0.7, 0.3, { map: ledgeTex }));
    ledge.rotation.x = -Math.PI / 2; ledge.position.set(0, deckY + 0.003, sz); g.add(ledge);
    var lab = kin_engrave('MARFA TIME', { color: '#C9A35A', height: 0.13, px: 70, font: FONT_MONO, spacing: 0.18, pad: 0.03, metal: 0.7 });
    lab.position.set(-fw / 2 + lab.userData.w / 2, 0.12 + (ph - 0.12) / 2, pz + PD / 2 + 0.002); g.add(lab);
    var lab2 = kin_engrave('MLOW.XYZ', { color: '#C9A35A', height: 0.13, px: 70, font: FONT_MONO, spacing: 0.18, pad: 0.03, metal: 0.7 });
    lab2.position.set(fw / 2 - lab2.userData.w / 2, 0.12 + (ph - 0.12) / 2, pz + PD / 2 + 0.002); g.add(lab2);
    // the pins, grouped by geometry (Blossom pins use all six shapes)
    var kinds = shape === 'Blossom Pins' ? 6 : 1, sets = [], pins = [];
    for (k = 0; k < kinds; k++) sets.push({ idx: [] });
    for (var row = 0; row < NR; row++) for (var col = 0; col < NC; col++) {
      var kind = kinds > 1 ? ((col * 7 + row * 3 + ((col * row) % 5)) % 6) : 0;
      var q = kinds > 1 ? (col + 2 * row) % 4 : 0;
      var pin = { x: -fw / 2 + pitch * (col + 0.5), z: -fd / 2 + pitch * (row + 0.5), col: col, row: row, set: kind, slot: sets[kind].idx.length,
        c: Math.cos(q * Math.PI / 2), s: Math.sin(q * Math.PI / 2), h: 0.1, from: 0.1, to: 0.1, t0: -1, v: 0, lit: 0 };
      sets[kind].idx.push(pins.length); pins.push(pin);
    }
    sets.forEach(function (st, k) {
      var sg = kin_pinGeo(shape, k, pw, 1), tg = kin_onesColor(kin_pinGeo(shape, k, pw * 1.03, 0.035));
      st.shaft = new THREE.InstancedMesh(sg, pinM, st.idx.length);
      st.tip = new THREE.InstancedMesh(tg, tipM, st.idx.length);
      st.shaft.instanceMatrix.setUsage(THREE.DynamicDrawUsage); st.tip.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(st.shaft); g.add(st.tip);
    });
    var secG = kin_pinGeo('Round Rods', 0, 0.05, 1), secTG = kin_onesColor(kin_pinGeo('Round Rods', 0, 0.056, 0.03));
    var secS = new THREE.InstancedMesh(secG, steel, 60), secT = new THREE.InstancedMesh(secTG, tipM, 60);
    g.add(secS); g.add(secT);
    var colTmp = new THREE.Color(), offCol = C(pal.off), litCols = pal.lit.map(function (h, k) { return C(k === 0 && matName === 'Blossom Blue' && pal === KIN_PAL['Brand Tips'] ? BRAND.cloud : h); }), secCol = C(pal.sec);
    function writePin(p) {
      var st = sets[p.set], a = st.shaft.instanceMatrix.array, b = st.tip.instanceMatrix.array, o = p.slot * 16, hh = p.h + 0.03;
      a[o] = p.c; a[o + 1] = 0; a[o + 2] = -p.s; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = hh; a[o + 6] = 0; a[o + 7] = 0;
      a[o + 8] = p.s; a[o + 9] = 0; a[o + 10] = p.c; a[o + 11] = 0; a[o + 12] = p.x; a[o + 13] = deckY - 0.03; a[o + 14] = p.z; a[o + 15] = 1;
      for (var j = 0; j < 16; j++) b[o + j] = a[o + j];
      b[o + 5] = 1; b[o + 13] = deckY + p.h;
    }
    function colorPin(p) {
      colTmp.copy(offCol);
      if (p.v) colTmp.copy(litCols[p.v - 1]).lerp(offCol, 1 - clamp((p.h - 0.1) / 0.8, 0, 1));
      sets[p.set].tip.setColorAt(p.slot, colTmp);
    }
    function flush() {
      sets.forEach(function (st) { st.shaft.instanceMatrix.needsUpdate = true; st.tip.instanceMatrix.needsUpdate = true; if (st.tip.instanceColor) st.tip.instanceColor.needsUpdate = true; });
    }
    var sm = new THREE.Matrix4(), sv = new THREE.Vector3(), sq = new THREE.Quaternion(), ss = new THREE.Vector3(1, 1, 1);
    function writeSeconds(sec) {
      for (var k = 0; k < 60; k++) {
        var e = kin_secHeight(k, sec), hh = 0.05 + 0.42 * e, x = -fw / 2 + spw * (k + 0.5);
        sv.set(x, deckY - 0.02, sz); ss.set(1, hh + 0.02, 1); sm.compose(sv, sq, ss); secS.setMatrixAt(k, sm);
        sv.set(x, deckY + hh, sz); ss.set(1, 1, 1); sm.compose(sv, sq, ss); secT.setMatrixAt(k, sm);
        colTmp.copy(offCol).lerp(secCol, e); secT.setColorAt(k, colTmp);
      }
      secS.instanceMatrix.needsUpdate = true; secT.instanceMatrix.needsUpdate = true; secT.instanceColor.needsUpdate = true;
    }
    for (i = 0; i < pins.length; i++) { writePin(pins[i]); colorPin(pins[i]); }
    flush(); writeSeconds(0);
    g.add(W.lamp('#FFE6C4', 0.9, 12, new THREE.Vector3(0, 4.5, 4.0)));
    shade(g);
    var lastKey = '', moving = false, UP = 0.9, DOWN = 0.1;
    return {
      group: g, R: Math.sqrt(PW * PW / 4 + PD * PD / 4) + 0.3, lookY: 0.3, dist: rf(r, 7.6, 8.4), camH: [6.0, 6.8], face: true, shadowPad: 9,
      close: { zoom: 0.55, el: -0.1, look: 0 },
      update: function (ctx) {
        var t = ctx.t, key = t.h + ':' + t.m, real = ctx.real, i, p;
        if (key !== lastKey) {
          var mask = kin_pinMask(t.h, t.m), jump = ctx.snap || !lastKey;
          for (i = 0; i < pins.length; i++) {
            p = pins[i]; p.lit = mask[i];
            var to = mask[i] ? UP : DOWN;
            if (jump) { p.h = p.from = p.to = to; p.v = mask[i]; p.t0 = -1; }
            else { p.from = p.h; p.to = to; p.t0 = real + p.col * (ctx.fast ? 0.004 : 0.034) + p.row * (ctx.fast ? 0.001 : 0.006); }
          }
          lastKey = key; moving = !jump;
          if (jump) { for (i = 0; i < pins.length; i++) { writePin(pins[i]); colorPin(pins[i]); } flush(); }
        }
        if (moving) {
          var dur = ctx.fast ? 0.18 : 0.85, busy = false;
          for (i = 0; i < pins.length; i++) {
            p = pins[i];
            if (p.t0 < 0) continue;
            var u = (real - p.t0) / dur;
            if (u < 0) { busy = true; continue; }
            if (u >= 1) { p.h = p.to; p.t0 = -1; p.v = p.lit; }
            else {
              busy = true;
              p.h = p.from + (p.to - p.from) * kin_back(u) + (Math.abs(p.from - p.to) < 1e-3 ? 0.07 * Math.sin(u * Math.PI) : 0);
              if (p.to > p.from) p.v = p.lit;
            }
            writePin(p); colorPin(p);
          }
          flush();
          moving = busy;
        }
        writeSeconds(t.sec % 60);
      }
    };
  }

  // ------------------------------------------------------------ register
  defineClock('Water Clock', { w: 8, keeps: 'Water', build: kin_clockWater,
    line: 'A clepsydra. Water rises through the hour against a scale of sixty minutes, drains on the hour, and a cup fills for each hour gone.',
    mats: ['Travertine', 'Caliche Stone', 'Desert Sandstone', 'Terrazzo', 'Bone White', 'Concrete', 'Obsidian'],
    traits: function (r) { return { 'Vessel': pickW(r, [['Column', 45], ['Twin Columns', 30], ['Tiered Basins', 25]]), 'Water': pickW(r, [['Clear', 40], ['Indigo', 30], ['Emerald', 30]]) }; },
    kin: { hourFrac: kin_hourFrac } });
  defineClock('Hourglass', { w: 8, keeps: 'Sand', build: kin_clockHourglass,
    line: 'One hour of sand. At the top of every hour the glass turns itself over, and one more mark lights on the plinth.',
    mats: ['Brass', 'Mill Aluminum', 'Weathering Steel', 'Travertine', 'Bone White', 'Cherokee Red', 'Concrete'],
    traits: function (r) { return { 'Frame': pickW(r, [['Brass Posts', 40], ['Timber', 35], ['Obsidian Monolith', 25]]), 'Sand': pickW(r, [['White Gypsum', 40], ['Red Desert', 32], ['Crushed Turquoise', 28]]) }; },
    kin: { sandAt: kin_sandAt, hgR: kin_hgR } });
  defineClock('Word Clock', { w: 8, keeps: 'Words', build: kin_clockWords,
    line: 'A wall of letters. The words that tell Marfa time light up to the nearest five minutes, and the corner dots count the minutes between.',
    mats: ['Ink Black', 'Mill Aluminum', 'Concrete', 'Bone White', 'Cherokee Red', 'Blossom Blue', 'Weathering Steel'],
    traits: function (r) { return { 'Language': pickW(r, [['English', 60], ['Spanish', 40]]), 'Face': pickW(r, [['Ink', 40], ['Concrete', 35], ['Mirror', 25]]) }; },
    kin: { words: kin_wordsFor, mask: kin_wordMask, read: kin_wordRead, grids: KIN_WORDS } });
  defineClock('Kinetic Pin Field', { w: 8, keeps: 'Pins', build: kin_clockPins,
    line: 'Seven hundred and twenty pins. The raised ones spell the time, a wave resets them every minute, and a low sun writes the time again in shadow.',
    mats: ['Mill Aluminum', 'Ink Black', 'Bone White', 'Brass', 'Concrete', 'Obsidian', 'Blossom Blue'],
    traits: function (r) { return { 'Pins': pickW(r, [['Square Rods', 40], ['Round Rods', 30], ['Blossom Pins', 30]]), 'Palette': pickW(r, [['Mono', 35], ['Brand Tips', 40], ['Rust', 25]]) }; },
    kin: { mask: kin_pinMask, text: kin_pinText, sec: kin_secHeight } });
