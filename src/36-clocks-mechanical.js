  // =====================================================================
  // MECHANICAL CLOCKS: a skeleton clock, an astronomical clock, a motel
  // sign and a water tower. Every top-level name in this file starts with
  // mech_ so nothing collides with the files written beside it.
  // =====================================================================
  var mech_TAU = Math.PI * 2;
  function mech_v2(rad, a) { return new THREE.Vector2(rad * Math.cos(a), rad * Math.sin(a)); }
  function mech_frac(x) { return x - Math.floor(x); }

  // an extruded plate centred on z = 0. The bevel grows the outline by `bev`.
  function mech_extrude(shape, depth, bev, curveSeg) {
    var b = bev || 0, d = Math.max(depth - 2 * b, 0.0005);
    var geo = new THREE.ExtrudeBufferGeometry(shape, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: curveSeg || 12 });
    geo.translate(0, 0, -d / 2);
    return geo;
  }
  function mech_rrect(w, h, rad) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    rad = Math.min(rad, w / 2 - 0.001, h / 2 - 0.001);
    s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad);
    s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad);
    s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
    return s;
  }
  // a box with chamfered edges that catch the low sun
  function mech_bbox(w, h, d, mat, b) {
    b = b == null ? Math.min(0.03, w * 0.1, h * 0.1, d * 0.1) : b;
    var s = new THREE.Shape([new THREE.Vector2(-w / 2 + b, -h / 2 + b), new THREE.Vector2(w / 2 - b, -h / 2 + b), new THREE.Vector2(w / 2 - b, h / 2 - b), new THREE.Vector2(-w / 2 + b, h / 2 - b)]);
    return new THREE.Mesh(mech_extrude(s, d, b), mat);
  }
  function mech_circle(rad, n) { var p = []; for (var i = 0; i < n; i++) p.push(mech_v2(rad, i / n * mech_TAU)); return p; }
  function mech_ring(ro, ri, n) { var s = new THREE.Shape(mech_circle(ro, n || 64)); s.holes.push(new THREE.Path(mech_circle(ri, n || 64).reverse())); return s; }
  function mech_star(n, ro, ri, rot) {
    var p = [];
    for (var i = 0; i < n * 2; i++) p.push(mech_v2(i % 2 ? ri : ro, Math.PI / 2 + (rot || 0) + i / (n * 2) * mech_TAU));
    return new THREE.Shape(p);
  }
  // a cylinder along z
  function mech_zcyl(rad, len, mat, seg, rad2) {
    var geo = new THREE.CylinderBufferGeometry(rad, rad2 == null ? rad : rad2, len, seg || 16);
    geo.rotateX(Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  }
  // a round rod from a to b
  function mech_rod(a, b, rad, mat, seg) {
    var d = new THREE.Vector3().subVectors(b, a), L = d.length();
    var m = new THREE.Mesh(new THREE.CylinderBufferGeometry(rad, rad, L, seg || 8), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  // a flat bar in the xy plane from p to q, at depth z
  function mech_bar(p, q, z, w, d, mat) {
    var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy);
    var m = mech_bbox(L, w, d, mat, Math.min(0.008, w * 0.2, d * 0.2));
    m.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z); m.rotation.z = Math.atan2(dy, dx);
    return m;
  }
  // a night lamp that turns with the clock: W.lamp, re-parented into our group
  function mech_lamp(W, parent, hex, inten, dist, pos) { var l = W.lamp(hex, inten, dist, pos); parent.add(l); return l; }
  // bake the static meshes directly under g into one mesh per material, to
  // save draw calls. Textured and transparent materials are left alone.
  function mech_mergeStatic(g) {
    var by = {}, list = g.children.slice();
    list.forEach(function (o) {
      if (!o.isMesh || o.isInstancedMesh || !o.material || o.material.map || o.material.transparent || Array.isArray(o.material)) return;
      var k = o.material.uuid; (by[k] = by[k] || []).push(o);
    });
    Object.keys(by).forEach(function (k) {
      var ms = by[k]; if (ms.length < 3) return;
      var geos = ms.map(function (o) { o.updateMatrix(); var c = o.geometry.clone(); c.applyMatrix4(o.matrix); if (c.attributes.uv) c.deleteAttribute('uv'); return c; });
      var merged = new THREE.Mesh(mergeGeos(geos), ms[0].material);
      ms.forEach(function (o) { g.remove(o); o.geometry.dispose(); });
      g.add(merged);
    });
    return g;
  }
  function mech_dome(rad, mat) { var m = sph(rad, mat, 12, 6); m.scale.z = 0.45; return m; }

  // ------------------------------------------------------------ gears
  // Clock wheels: trapezoid teeth with a flank bend at the pitch circle and a
  // flat tip, which reads as involute from any distance. `ratchet` gives the
  // undercut, forward-leaning teeth of a Graham escape wheel. Spokes are cut
  // as holes, straight or curved like the crossings of an English wheel.
  function mech_gearShape(z, m, o) {
    o = o || {};
    var rp = m * z / 2, ra = rp + m * (o.add == null ? 0.95 : o.add), rd = rp - m * 1.25, p = mech_TAU / z, pts = [], i, a, h = ra - rd;
    for (i = 0; i < z; i++) {
      a = i * p;
      if (o.ratchet) pts.push(mech_v2(ra, a), mech_v2(ra - 0.1 * h, a + 0.07 * p), mech_v2(rd + 0.42 * h, a + 0.45 * p), mech_v2(rd, a + 0.72 * p), mech_v2(rd, a + 1.1 * p));
      else {
        var tw = o.leaf ? 0.19 : 0.23;
        pts.push(mech_v2(rd, a - 0.5 * p), mech_v2(rd + 0.1 * h, a - 0.35 * p), mech_v2(rp, a - tw * p), mech_v2(ra - 0.22 * h, a - (tw - 0.07) * p),
          mech_v2(ra, a - 0.08 * p), mech_v2(ra, a + 0.08 * p), mech_v2(ra - 0.22 * h, a + (tw - 0.07) * p), mech_v2(rp, a + tw * p), mech_v2(rd + 0.1 * h, a + 0.35 * p));
      }
    }
    var sh = new THREE.Shape(pts);
    if (o.spokes) {
      var ri = o.rim || rd - Math.max(1.6 * m, 0.1 * rp), rh = o.hub || Math.max(0.2 * rp, 0.03), n = o.spokes;
      var sw = o.sw || Math.max(0.04 * rp, 0.01), cv = o.curve || 0;
      var ang = function (k, rr) { return k / n * mech_TAU + (o.rot || 0) + cv * Math.sin(Math.PI * (rr - rh) / (ri - rh)); };
      for (i = 0; i < n; i++) {
        var hp = [], k, rr, N = 16;
        var a0 = ang(i, ri) + Math.asin(sw / ri), a1 = ang(i + 1, ri) - Math.asin(sw / ri);
        var b0 = ang(i + 1, rh) - Math.asin(sw / rh), b1 = ang(i, rh) + Math.asin(sw / rh);
        if (a1 - a0 < 0.05 || b0 - b1 < 0.02) continue;
        for (k = 0; k <= 6; k++) { rr = rh + (ri - rh) * k / 6; hp.push(mech_v2(rr, ang(i, rr) + Math.asin(sw / rr))); }
        for (k = 1; k < N; k++) hp.push(mech_v2(ri, a0 + (a1 - a0) * k / N));
        for (k = 6; k >= 0; k--) { rr = rh + (ri - rh) * k / 6; hp.push(mech_v2(rr, ang(i + 1, rr) - Math.asin(sw / rr))); }
        for (k = 1; k < 5; k++) hp.push(mech_v2(rh, b0 + (b1 - b0) * k / 5));
        sh.holes.push(new THREE.Path(hp));
      }
    }
    return sh;
  }
  // tooth phase: a wheel meshing with `mate` gets the offset that puts one
  // of its gaps on the line of centres where the mate has a tooth. Because
  // every arbor turns at the ratio its tooth counts imply, they stay meshed.
  function mech_meshPhase(px, py, z, mate) {
    if (!mate) return 0;
    var a = Math.atan2(py - mate.y, px - mate.x), pA = mech_frac((a - mate.phi) * mate.z / mech_TAU);
    return a + Math.PI - (0.5 - pA) * mech_TAU / z;
  }

  // ------------------------------------------------------------ hands
  // a hand along +y from its arbor. Styles: baton, breguet, spade, arrow.
  function mech_hand(o, mat) {
    var L = o.L, w = o.w, tail = o.tail || 0, th = o.th || 0.02, grp = new THREE.Group();
    var add = function (sh) { grp.add(new THREE.Mesh(mech_extrude(sh, th, 0, 24), mat)); };
    var P = function (a) { return new THREE.Shape(a.map(function (q) { return new THREE.Vector2(q[0], q[1]); })); };
    var st = o.style || 'baton';
    if (st === 'breguet') {
      var yM = L * 0.7, rO = o.moon || w * 2.3;
      add(P([[-w / 2, -tail], [w / 2, -tail], [w * 0.3, yM - rO * 0.8], [-w * 0.3, yM - rO * 0.8]]));
      var ring = new THREE.Shape(mech_circle(rO, 40)); ring.holes.push(new THREE.Path(mech_circle(rO * 0.6, 40).reverse()));
      var rm = new THREE.Mesh(mech_extrude(ring, th, 0, 24), mat); rm.position.y = yM; grp.add(rm);
      add(P([[-w * 0.34, yM + rO * 0.75], [w * 0.34, yM + rO * 0.75], [0, L]]));
    } else if (st === 'spade') {
      var y0 = L * 0.6, sw = o.spade || w * 2.4;
      add(P([[-w / 2, -tail], [w / 2, -tail], [w * 0.32, y0 + 0.02], [-w * 0.32, y0 + 0.02]]));
      var sp = P([[0, y0], [sw, y0 + sw * 0.9], [sw * 0.7, y0 + sw * 2.0], [0, y0 + sw * 2.6], [-sw * 0.7, y0 + sw * 2.0], [-sw, y0 + sw * 0.9]]);
      sp.holes.push(new THREE.Path([[0, y0 + sw * 0.7], [-sw * 0.45, y0 + sw * 1.3], [0, y0 + sw * 2.0], [sw * 0.45, y0 + sw * 1.3]].map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
      add(sp);
      add(P([[-w * 0.3, y0 + sw * 2.4], [w * 0.3, y0 + sw * 2.4], [0, L]]));
    } else if (st === 'arrow') {
      var hw = o.head || w * 2.6, hl = hw * 2.2;
      add(P([[-w / 2, -tail], [w / 2, -tail], [w * 0.4, L - hl * 0.8], [-w * 0.4, L - hl * 0.8]]));
      add(P([[-hw, L - hl], [0, L - hl * 0.7], [hw, L - hl], [0, L]]));
    } else {
      add(P([[-w / 2, -tail], [w / 2, -tail], [w * 0.42, L - w * 1.2], [0, L], [-w * 0.42, L - w * 1.2]]));
    }
    if (o.disc) { var d = new THREE.Mesh(mech_extrude(new THREE.Shape(mech_circle(o.disc, 28)), th, 0), mat); d.position.y = -tail * 0.82; grp.add(d); }
    if (o.boss) { var bo = new THREE.Mesh(mech_extrude(new THREE.Shape(mech_circle(o.boss, 28)), th * 1.6, 0), mat); grp.add(bo); }
    return grp;
  }

  // a centreline widened into two edges. hw is a number or f(s), s in 0..1
  function mech_offsetLine(pts, hw) {
    var L = [], R = [], n = pts.length, tot = 0, acc = [0], i;
    for (i = 1; i < n; i++) { tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(tot); }
    for (i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      var w = typeof hw === 'function' ? hw(acc[i] / tot) : hw;
      L.push([pts[i][0] - ty / tl * w, pts[i][1] + tx / tl * w]); R.push([pts[i][0] + ty / tl * w, pts[i][1] - tx / tl * w]);
    }
    return { L: L, R: R, len: tot };
  }
  function mech_arcPts(cx, cy, rx, ry, a0, a1, n) {
    var o = []; n = n || 14;
    for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * D2R; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return o;
  }
  // evenly spaced points round a closed polygon, pushed `inset` toward its inside
  function mech_alongOutline(poly, step, inset) {
    var n = poly.length, area = 0, i, out = [];
    for (i = 0; i < n; i++) { var p = poly[i], q = poly[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    var sgn = area > 0 ? 1 : -1, carry = 0;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      var nx = -dy / L * sgn, ny = dx / L * sgn, t = carry;
      while (t < L) { out.push([a[0] + dx * t / L + nx * inset, a[1] + dy * t / L + ny * inset]); t += step; }
      carry = t - L;
    }
    return out;
  }

  // =====================================================================
  // 1. SKELETON CLOCK
  // A monumental open movement. The train is real: the great wheel of 96
  // turns once in twelve hours and drives the centre pinion of 8; the centre
  // wheel of 64 turns once an hour and carries the minute hand; it drives a
  // third pinion of 8, whose wheel of 60 drives the escape pinion of 8, so
  // the escape arbor turns once a minute and carries the seconds. The motion
  // work under the dial is 12 over 36, then 10 over 40: the hour hand turns
  // once in twelve hours. The pendulum beats seconds on a 0.994 m rod.
  // =====================================================================
  function mech_skeleton(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var escK = Tt['Escapement'] || 'Anchor', trainK = Tt['Train'] || 'Brass', dialK = Tt['Dial'] || 'Roman';
    var md = MATERIALS[matName] || MATERIALS['Ink Black'], frameM = heroMat(matName);
    var wheelM = trainK === 'Blued Steel' ? mtl('#2B4A96', 'brushed', 0.22, 0.9, 0.35) : trainK === 'Rust' ? mtl('#8A4A27', 'rust', 0.8, 0.45, 0.5) : mtl('#CFA451', 'brushed', 0.24, 1, 0.35);
    var steelM = mtl('#CDD1D6', 'brushed', 0.18, 1, 0.3), darkM = std('#17181C', 0.4, 0.7);
    var gilt = mtl('#D8B868', 'brushed', 0.2, 1, 0.3);
    var screwM = std(trainK === 'Blued Steel' ? '#C9A24E' : '#1E2F72', 0.22, 0.9);
    var handM = std(trainK === 'Blued Steel' ? '#D2AD5C' : '#152062', 0.26, 0.9, { emissive: C('#BFF7DA'), emissiveIntensity: 0 });
    W.glow(handM, 0, 0.55);
    var rubyM = std('#9B1030', 0.12, 0.2);
    var stoneM = mtl('#8C867D', 'stone', 0.86, 0, 1.1), capM = mtl('#2A292C', 'marble', 0.28, 0.1, 1.2);

    // ---- the pedestal
    var p1 = mech_bbox(5.0, 0.24, 2.4, stoneM, 0.03); p1.position.y = 0.12; g.add(p1);
    var p2 = mech_bbox(4.5, 0.36, 1.95, stoneM, 0.03); p2.position.y = 0.42; g.add(p2);
    var p3 = mech_bbox(4.75, 0.1, 2.15, capM, 0.02); p3.position.y = 0.65; g.add(p3);
    var Y0 = 0.7;
    var plq = textPlane(['MARFA TIME', '30.31 N  104.02 W'], { color: '#D9C08A', bg: '#2A2521', height: 0.22, px: 56, font: FONT_SERIF, spacing: 0.12, pad: 0.35 });
    plq.position.set(1.35, 0.42, 0.98); g.add(plq);

    // ---- where the arbors stand (metres). E escape, A pallets, C centre,
    // T third, G great wheel, M minute wheel of the motion work.
    var E = [0, 1.66], A = [0, 2.08], Cp = [0, 3.3];
    var mC = 0.026, mT = 0.028, mG = 0.018;
    var dCT = mC * (64 + 8) / 2, dTE = mT * (60 + 8) / 2, dCE = Cp[1] - E[1];
    var dd = (dCT * dCT - dTE * dTE + dCE * dCE) / (2 * dCE), hh = Math.sqrt(Math.max(0, dCT * dCT - dd * dd));
    var Tp = [hh, Cp[1] - dd];
    var dCG = mG * (96 + 8) / 2, Gp = [Cp[0] + dCG * Math.cos(186 * D2R), Cp[1] + dCG * Math.sin(186 * D2R)];
    var Mp = [Cp[0] + 0.48 * Math.cos(42 * D2R), Cp[1] + 0.48 * Math.sin(42 * D2R)];
    var Gv = [0, E[1] + 0.33];
    var zBack = -0.40, zBr = 0.32;

    // ---- back frame: an arched band with struts to the back pivots
    var FR = 1.92, FC = 3.0;
    var arch = function (R, yb) { var s = new THREE.Shape(); s.moveTo(-R, yb); s.lineTo(R, yb); s.lineTo(R, FC); s.absarc(0, FC, R, 0, Math.PI, false); s.lineTo(-R, yb); return s; };
    var backS = arch(FR, Y0); backS.holes.push(new THREE.Path(arch(FR - 0.15, Y0 + 0.15).getPoints(40).reverse()));
    var back = new THREE.Mesh(mech_extrude(backS, 0.07, 0.014, 40), frameM); back.position.z = zBack; g.add(back);
    [[[-FR + 0.1, E[1]], [FR - 0.1, E[1]]], [E, Tp], [Tp, Cp], [Cp, Gp], [Cp, [0, FC + FR - 0.1]], [Gp, [-FR + 0.1, Gp[1]]], [Tp, [FR - 0.1, Tp[1] - 0.2]], [[0, Y0 + 0.1], E]].forEach(function (q) {
      g.add(mech_bar(q[0], q[1], zBack, 0.1, 0.05, frameM));
    });
    // ---- front frame: two turned columns and an arch
    var colProf = [[0, 0], [0.16, 0], [0.16, 0.06], [0.12, 0.1], [0.1, 0.16], [0.085, 0.4], [0.075, 1.2], [0.07, 1.9], [0.085, 2.0], [0.1, 2.08], [0.13, 2.14], [0.13, 2.22], [0, 2.22]];
    var colGeo = new THREE.LatheBufferGeometry(colProf.map(function (q) { return new THREE.Vector2(q[0], q[1] * (FC - Y0) / 2.22); }), 20);
    [-1, 1].forEach(function (sd) { var c = new THREE.Mesh(colGeo, frameM); c.position.set(sd * (FR - 0.1), Y0, zBr); g.add(c); });
    var frontS = new THREE.Shape(); frontS.absarc(0, FC, FR - 0.02, 0, Math.PI, false); frontS.lineTo(-FR + 0.16, FC); frontS.absarc(0, FC, FR - 0.16, Math.PI, 0, true); frontS.lineTo(FR - 0.02, FC);
    var front = new THREE.Mesh(mech_extrude(frontS, 0.06, 0.012, 48), frameM); front.position.z = zBr; g.add(front);
    // the pillars that hold the frames apart, with nuts
    [[-FR + 0.1, Y0 + 0.2], [FR - 0.1, Y0 + 0.2], [-FR + 0.1, FC], [FR - 0.1, FC], [(FR - 0.09) * Math.cos(1.05), FC + (FR - 0.09) * Math.sin(1.05)], [-(FR - 0.09) * Math.cos(1.05), FC + (FR - 0.09) * Math.sin(1.05)], [0, FC + FR - 0.09]].forEach(function (q) {
      var pl = mech_zcyl(0.035, zBr - zBack, steelM, 12); pl.position.set(q[0], q[1], (zBr + zBack) / 2); g.add(pl);
      [zBack - 0.05, zBr + 0.045].forEach(function (zz) { var nut = mech_zcyl(0.06, 0.04, gilt, 6); nut.position.set(q[0], q[1], zz); g.add(nut); });
    });
    // ---- front bridges, with jewels and blued screws
    [[Cp, Tp], [Tp, [FR - 0.1, Tp[1]]], [Cp, Gp], [Gp, [-FR + 0.1, Gp[1]]], [[0, Y0], [0, A[1] + 0.07]], [[-0.55, Y0 + 0.06], [0, Y0 + 0.5]], [[0.55, Y0 + 0.06], [0, Y0 + 0.5]]].forEach(function (q) {
      g.add(mech_bar(q[0], q[1], zBr, 0.085, 0.04, frameM));
    });
    [Cp, Tp, Gp, E, A].forEach(function (q) {
      var bo = mech_zcyl(0.085, 0.05, frameM, 24); bo.position.set(q[0], q[1], zBr); g.add(bo);
      var jewel = mech_zcyl(0.028, 0.02, rubyM, 12); jewel.position.set(q[0], q[1], zBr + 0.03); g.add(jewel);
      for (var k = 0; k < 2; k++) { var sc = mech_dome(0.02, screwM); sc.position.set(q[0] + Math.cos(0.8 + k * Math.PI) * 0.06, q[1] + Math.sin(0.8 + k * Math.PI) * 0.06, zBr + 0.026); g.add(sc); }
    });
    // ---- arbors
    var arb = function (p, z0, z1, rad) { var a = mech_zcyl(rad || 0.02, z1 - z0, steelM, 10); a.position.set(p[0], p[1], (z0 + z1) / 2); g.add(a); };
    arb(Cp, zBack, 0.66, 0.024); arb(Tp, zBack, zBr); arb(E, zBack, 0.44, 0.018); arb(Gp, zBack, zBr, 0.03); arb(A, 0.16, 0.52, 0.018); arb(Mp, zBr, 0.49, 0.018);
    if (escK === 'Gravity') arb(Gv, 0.16, 0.47, 0.015);

    // ---- the train. rate is turns per second of the escapement's count
    var arbors = {
      E: { p: E, rate: -1 / 60 }, T: { p: Tp, rate: 1 / 450 }, C: { p: Cp, rate: -1 / 3600 }, G: { p: Gp, rate: 1 / 43200 },
      M: { p: Mp, rate: 1 / 10800 }, H: { p: Cp, rate: -1 / 43200 }, V: { p: Gv, rate: 1 / 6 }
    };
    var parts = [];
    function wheel(ak, z, m, zp, th, mat, o, mate, phi0) {
      var a = arbors[ak], mesh = new THREE.Mesh(mech_extrude(mech_gearShape(z, m, o), th, Math.min(0.0035, th * 0.12)), mat);
      mesh.position.set(a.p[0], a.p[1], zp); g.add(mesh);
      var phi = phi0 != null ? phi0 : mech_meshPhase(a.p[0], a.p[1], z, mate);
      var q = { mesh: mesh, a: a, ak: ak, x: a.p[0], y: a.p[1], z: z, m: m, phi: phi };
      parts.push(q);
      var col = mech_zcyl(Math.max(0.035, m * 1.6), th + 0.03, o && o.leaf ? steelM : mat, 16); col.position.set(a.p[0], a.p[1], zp); g.add(col);
      return q;
    }
    // escape arbor first: a tooth locked on the entry pallet at 135 degrees
    var escPin = wheel('E', 8, mT, 0.12, 0.07, steelM, { leaf: true }, null, 0);
    var secW = null;
    if (escK === 'Gravity') secW = wheel('E', 60, 0.01, 0.22, 0.02, wheelM, { spokes: 5, curve: 0.25 }, null, 0);
    else wheel('E', 30, 0.02, 0.22, 0.02, wheelM, escK === 'Anchor' ? { ratchet: true, spokes: 6, curve: 0.3, add: 0.9 } : { spokes: 6, curve: 0.3 }, null, 135.5 * D2R);
    wheel('T', 60, mT, 0.12, 0.026, wheelM, { spokes: 5, curve: 0.35 }, escPin);
    var thPin = wheel('T', 8, mC, 0.0, 0.07, steelM, { leaf: true }, null, 0);
    wheel('C', 64, mC, 0.0, 0.028, wheelM, { spokes: 5, curve: -0.35 }, thPin);
    var cPin = wheel('C', 8, mG, -0.12, 0.06, steelM, { leaf: true }, null, 0);
    wheel('G', 96, mG, -0.12, 0.03, wheelM, { spokes: 5, curve: 0.3, hub: 0.2 }, cPin);
    var cannon = wheel('C', 12, 0.02, 0.4, 0.04, steelM, { leaf: true }, null, 0);
    wheel('M', 36, 0.02, 0.4, 0.022, wheelM, { spokes: 4, curve: 0.3 }, cannon);
    var minPin = wheel('M', 10, 0.48 * 2 / 50, 0.455, 0.04, steelM, { leaf: true }, null, 0);
    wheel('H', 40, 0.48 * 2 / 50, 0.455, 0.022, wheelM, { spokes: 4, curve: -0.3, hub: 0.07 }, minPin);
    if (secW) wheel('V', 6, 0.01, 0.22, 0.04, steelM, { leaf: true }, secW);
    // the barrel: an open drum behind the great wheel, the mainspring inside
    var drum = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.62, 0.62, 0.2, 48, 1, true), wheelM); drum.rotation.x = Math.PI / 2; drum.position.set(Gp[0], Gp[1], -0.23); g.add(drum);
    var drumBack = mech_zcyl(0.63, 0.02, wheelM, 48); drumBack.position.set(Gp[0], Gp[1], -0.33); g.add(drumBack);
    var sp = [], spIn = [], turns = 9, r0 = 0.07, r1 = 0.58, kk = (r1 - r0) / (turns * mech_TAU), N = turns * 40, i;
    for (i = 0; i <= N; i++) { var ang = i / N * turns * mech_TAU; sp.push(mech_v2(r0 + kk * ang + 0.011, ang)); spIn.push(mech_v2(r0 + kk * ang, ang)); }
    var spring = new THREE.Mesh(mech_extrude(new THREE.Shape(sp.concat(spIn.reverse())), 0.12, 0), std('#243A7A', 0.3, 0.85));
    spring.position.set(Gp[0], Gp[1], -0.23); g.add(spring);
    // ratchet and click keep the spring wound
    var ratchet = new THREE.Mesh(mech_extrude(mech_gearShape(24, 0.016, { ratchet: true }), 0.025, 0.003), steelM); ratchet.position.set(Gp[0], Gp[1], -0.07); g.add(ratchet);
    g.add(mech_bar([Gp[0] - 0.36, Gp[1] - 0.12], [Gp[0] - 0.17, Gp[1] - 0.09], -0.07, 0.035, 0.025, steelM));

    // ---- the escapement
    var esc = new THREE.Group(); esc.position.set(A[0], A[1], 0.22); g.add(esc);
    var raE = 0.3 + 0.02 * 0.9, dy = E[1] - A[1];
    var palL = [raE * Math.cos(135 * D2R), dy + raE * Math.sin(135 * D2R)], palR = [raE * Math.cos(45 * D2R), dy + raE * Math.sin(45 * D2R)];
    var armsL = null, armsR = null, gArms = null;
    if (escK === 'Anchor') {
      var ctr = [palL, [palL[0] * 0.8, palL[1] * 0.35], [-0.08, 0.03], [0, 0.05], [0.08, 0.03], [palR[0] * 0.8, palR[1] * 0.35], palR];
      var ol = mech_offsetLine(ctr, 0.032), anc = new THREE.Shape(ol.L.concat(ol.R.reverse()).map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
      esc.add(new THREE.Mesh(mech_extrude(anc, 0.03, 0.005), steelM));
      var ahub = mech_zcyl(0.05, 0.05, gilt, 20); esc.add(ahub);
      [palL, palR].forEach(function (q) {
        var pal = box(0.03, 0.075, 0.03, rubyM); pal.position.set(q[0], q[1], 0.004);
        pal.rotation.z = Math.atan2(q[1] - dy, q[0]) - Math.PI / 2; esc.add(pal);
      });
    } else if (escK === 'Grasshopper') {
      esc.add(mech_bar([-0.2, 0.02], [0.2, 0.02], 0, 0.05, 0.03, wheelM));
      var mk = function (pv, tip) {
        var arm = new THREE.Group(); arm.position.set(pv[0], pv[1], 0.02);
        arm.add(mech_bar([0, 0], [tip[0] - pv[0], tip[1] - pv[1]], 0, 0.022, 0.018, steelM));
        var hook = box(0.035, 0.05, 0.03, rubyM); hook.position.set(tip[0] - pv[0], tip[1] - pv[1], 0); arm.add(hook);
        var cw = sph(0.03, wheelM, 10, 8); cw.position.set((pv[0] - tip[0]) * 0.35, (pv[1] - tip[1]) * 0.35 + 0.04, 0); arm.add(cw);
        arm.add(mech_zcyl(0.02, 0.06, gilt, 10));
        esc.add(arm); return arm;
      };
      armsL = mk([-0.17, 0.02], palL); armsR = mk([0.17, 0.02], palR);
    } else {
      // double three-legged gravity escapement: two gravity arms hang
      // either side of the pendulum; the legs lift them one beat at a time
      gArms = [];
      [-1, 1].forEach(function (sd) {
        var arm = new THREE.Group(); arm.position.set(sd * 0.13, 0.03, 0.22);
        arm.add(mech_bar([0, 0], [-sd * 0.09, -0.5], 0, 0.028, 0.02, gilt));
        var st2 = box(0.05, 0.03, 0.03, rubyM); st2.position.set(-sd * 0.045, -0.25, 0.01); arm.add(st2);
        arm.add(mech_zcyl(0.03, 0.05, gilt, 12));
        esc.add(arm); gArms.push(arm);
      });
    }
    var legs = null;
    if (escK === 'Gravity') {
      legs = new THREE.Group(); legs.position.set(Gv[0], Gv[1], 0.41); g.add(legs);
      [0, 1].forEach(function (k) {
        for (var j = 0; j < 3; j++) {
          var a = j * mech_TAU / 3 + k * Math.PI / 3;
          legs.add(mech_bar([0, 0], [Math.cos(a) * 0.16, Math.sin(a) * 0.16], k * 0.04, 0.026, 0.014, gilt));
          var pin = mech_zcyl(0.012, 0.06, steelM, 8); pin.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.025); legs.add(pin);
        }
      });
      var lh = mech_zcyl(0.03, 0.07, gilt, 14); lh.position.z = 0.025; legs.add(lh);
    }
    // the crutch drops from the pallet arbor to the pendulum rod
    esc.add(mech_bar([0, 0], [0, -0.2], 0.245, 0.014, 0.014, steelM));
    esc.add(mech_bar([-0.03, -0.2], [0.03, -0.2], 0.25, 0.02, 0.02, steelM));

    // ---- the pendulum, in front, on a seconds rod
    var PL = 0.994, pend = new THREE.Group(); pend.position.set(0, A[1] + 0.035, 0.5); g.add(pend);
    var cock = mech_bbox(0.16, 0.12, 0.2, frameM, 0.01); cock.position.set(0, A[1] + 0.08, 0.42); g.add(cock);
    var susp = box(0.028, 0.06, 0.004, steelM); susp.position.y = -0.03; pend.add(susp);
    var rod = cyl(0.009, 0.009, PL + 0.2, 8, steelM); rod.position.y = -(PL + 0.2) / 2 - 0.05; pend.add(rod);
    var bob = sph(0.16, gilt, 36, 20); bob.scale.z = 0.3; bob.position.y = -PL; pend.add(bob);
    var bobRim = new THREE.Mesh(new THREE.TorusBufferGeometry(0.158, 0.008, 8, 48), wheelM); bobRim.position.y = -PL; pend.add(bobRim);
    var nut = cyl(0.03, 0.03, 0.05, 6, darkM); nut.position.y = -PL - 0.2; pend.add(nut);
    var amp = escK === 'Grasshopper' ? 0.14 : escK === 'Gravity' ? 0.07 : 0.095;

    // ---- the seconds ring round the escape arbor
    var secTex = canvasTex(512, 512, function (gc, S) {
      var k = S / 2 / 0.2, cx = S / 2;
      gc.fillStyle = '#E6E2D8'; gc.fillRect(0, 0, S, S);
      gc.fillStyle = '#16161A'; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '700 44px ' + FONT_SERIF;
      for (var s = 0; s < 60; s++) {
        var big = s % 5 === 0;
        gc.save(); gc.translate(cx, cx); gc.rotate(s / 60 * mech_TAU); gc.fillRect(big ? -4 : -2, -0.195 * k, big ? 8 : 4, (big ? 0.035 : 0.018) * k); gc.restore();
      }
      [[15, 90], [30, 180], [45, 270], [60, 0]].forEach(function (q) { var a = q[1] * D2R; gc.fillText(String(q[0]), cx + Math.sin(a) * 0.135 * k, cx - Math.cos(a) * 0.135 * k); });
    });
    var secRing = new THREE.Mesh(new THREE.RingBufferGeometry(0.075, 0.2, 64, 1), new THREE.MeshStandardMaterial({ map: secTex, roughness: 0.4, metalness: 0.5 }));
    secRing.position.set(E[0], E[1], 0.38); g.add(secRing);
    var secT = new THREE.Mesh(new THREE.TorusBufferGeometry(0.202, 0.008, 6, 64), gilt); secT.position.copy(secRing.position); g.add(secT);
    var secHand = mech_hand({ style: 'baton', L: 0.19, w: 0.012, tail: 0.06, th: 0.008, disc: 0.02, boss: 0.02 }, handM);
    secHand.position.set(E[0], E[1], 0.42); g.add(secHand);

    // ---- the chapter ring
    var RO = 1.18, RI = 0.9, roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    var drawRing = function (gc, S, lum) {
      var k = S / 2 / RO, cx = S / 2;
      gc.fillStyle = lum ? '#000000' : '#E3DFD4'; gc.fillRect(0, 0, S, S);
      if (!lum) for (var j = 0; j < 90; j++) { gc.strokeStyle = j % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)'; gc.lineWidth = 2; gc.beginPath(); gc.arc(cx, cx, (RI + (RO - RI) * j / 90) * k, 0, mech_TAU); gc.stroke(); }
      var ink = lum ? '#FFFFFF' : '#141418';
      gc.strokeStyle = ink; gc.fillStyle = ink;
      [RO - 0.035, RO - 0.095, RI + 0.02].forEach(function (rr, q) { gc.lineWidth = q === 2 ? 2 : 3; gc.beginPath(); gc.arc(cx, cx, rr * k, 0, mech_TAU); gc.stroke(); });
      for (var m = 0; m < 60; m++) {
        gc.save(); gc.translate(cx, cx); gc.rotate(m / 60 * mech_TAU);
        if (m % 5 === 0) gc.fillRect(-4, -(RO - 0.035) * k, 8, 0.06 * k); else gc.fillRect(-1.6, -(RO - 0.035) * k, 3.2, 0.06 * k);
        gc.restore();
      }
      if (dialK === 'Blossom') return;
      gc.textAlign = 'center'; gc.textBaseline = 'middle';
      for (var hr = 0; hr < 12; hr++) {
        var a = hr / 12 * mech_TAU, rr = (RI + RO - 0.095) / 2 * k;
        gc.save(); gc.translate(cx + Math.sin(a) * rr, cx - Math.cos(a) * rr);
        if (dialK === 'Roman') { gc.rotate(a); gc.font = '400 ' + Math.round(0.15 * k) + 'px ' + FONT_SERIF; gc.scale(0.82, 1); gc.fillText(roman[hr], 0, 0); }
        else { gc.font = '700 ' + Math.round(0.16 * k) + 'px ' + FONT_SANS; gc.fillText(String(hr === 0 ? 12 : hr), 0, 0); }
        gc.restore();
      }
    };
    var ringTex = canvasTex(1024, 1024, function (gc, S) { drawRing(gc, S, false); });
    var lumTex = canvasTex(1024, 1024, function (gc, S) { drawRing(gc, S, true); });
    var ringM = detail(new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.36, metalness: 0.55, emissive: C('#D8FFE8'), emissiveMap: lumTex, emissiveIntensity: 0 }), 'brushed', { tile: 0.35, albedo: 0.08, bump: 0.1 });
    W.glow(ringM, 0, 0.75);
    var chapter = new THREE.Mesh(new THREE.RingBufferGeometry(RI, RO, 128, 1), ringM); chapter.position.set(Cp[0], Cp[1], 0.56); g.add(chapter);
    var ringBack = new THREE.Mesh(mech_extrude(mech_ring(RO, RI, 96), 0.03, 0), darkM); ringBack.position.set(Cp[0], Cp[1], 0.54); g.add(ringBack);
    [RO + 0.012, RI - 0.012].forEach(function (rr) { var t = new THREE.Mesh(new THREE.TorusBufferGeometry(rr, 0.018, 8, 128), gilt); t.position.set(Cp[0], Cp[1], 0.56); g.add(t); });
    if (dialK === 'Blossom') {
      var bm = W.glow(std(BRAND.blue, 0.35, 0.3, { emissive: C(BRAND.cyan), emissiveIntensity: 0 }), 0, 0.9), bm2 = std(md.trim === '#F0F4F8' ? '#1A1C20' : md.trim, 0.4, 0.4);
      for (var hr = 0; hr < 12; hr++) {
        var ha = hr / 12 * mech_TAU, hr2 = (RI + RO - 0.095) / 2, hs = hr % 3 === 0 ? 0.17 : 0.12;
        var tile = new THREE.Mesh(mech_extrude(primShape(hr % 6, hr % 4, hs), 0.02, 0.003), hr % 3 === 0 ? bm : bm2);
        tile.position.set(Cp[0] + Math.sin(ha) * hr2, Cp[1] + Math.cos(ha) * hr2, 0.575); tile.rotation.z = -ha; g.add(tile);
      }
    }
    // the ring hangs from the front arch on four brackets
    [35, 145, 215, 325].forEach(function (d) {
      var a = d * D2R, p = [Cp[0] + Math.cos(a) * (RO - 0.05), Cp[1] + Math.sin(a) * (RO - 0.05)];
      var dx = p[0], dyy = p[1] - FC, rr = Math.hypot(dx, dyy), q = [dx / rr * (FR - 0.09), FC + dyy / rr * (FR - 0.09)];
      if (d > 180) q = [p[0] * 1.35, p[1] - 0.05];
      g.add(mech_bar(p, q, 0.45, 0.05, 0.03, frameM));
    });
    // ---- hands
    var hourH = mech_hand({ style: 'breguet', L: 0.78, w: 0.05, tail: 0.14, th: 0.014, moon: 0.1, disc: 0.05, boss: 0.055 }, handM);
    hourH.position.set(Cp[0], Cp[1], 0.61); g.add(hourH);
    var minH = mech_hand({ style: 'breguet', L: 1.12, w: 0.036, tail: 0.24, th: 0.012, moon: 0.075, disc: 0.06, boss: 0.045 }, handM);
    minH.position.set(Cp[0], Cp[1], 0.645); g.add(minH);
    var capC = mech_dome(0.03, gilt); capC.position.set(Cp[0], Cp[1], 0.665); g.add(capC);
    // ---- crest
    var crB = mech_bbox(0.34, 0.14, 0.34, frameM, 0.02); crB.position.set(0, FC + FR + 0.05, (zBr + zBack) / 2); g.add(crB);
    var orb = sph(0.13, gilt, 24, 16); orb.position.set(0, FC + FR + 0.26, (zBr + zBack) / 2); g.add(orb);
    var spire = new THREE.Mesh(new THREE.ConeBufferGeometry(0.03, 0.3, 10), gilt); spire.position.set(0, FC + FR + 0.52, (zBr + zBack) / 2); g.add(spire);
    mech_lamp(W, g, '#FFE3BC', 1.2, 11, new THREE.Vector3(0, 4.9, 3.0));
    shade(g);

    // the train moves together, a step each second, and the hands ride it
    function tickS(sec) {
      var s0 = Math.floor(sec), f = sec - s0, u = Math.min(1, f / 0.09), e = 1 - Math.pow(1 - u, 3);
      if (escK === 'Grasshopper') e -= 0.07 * Math.sin(Math.PI * clamp((f - 0.09) / 0.3, 0, 1));
      return s0 - 1 + e;
    }
    return {
      group: g, R: 2.6, lookY: 2.6, dist: rf(r, 9.4, 11), camH: [1.6, 2.6], face: true, close: { zoom: 0.55, el: 0.02, look: 0.15 },
      train: { arbors: arbors, parts: parts },
      update: function (ctx) {
        var sec = ctx.t.sec, S = ctx.snap ? Math.floor(sec) : tickS(sec);
        for (var j = 0; j < parts.length; j++) { var q = parts[j]; q.mesh.rotation.z = q.a.rate * S * mech_TAU + q.phi; }
        var sm = S % 43200;
        hourH.rotation.z = -sm / 43200 * mech_TAU;
        minH.rotation.z = -(sm % 3600) / 3600 * mech_TAU;
        secHand.rotation.z = -(S % 60) / 60 * mech_TAU;
        var th = amp * Math.sin(Math.PI * (sec - 0.12));
        pend.rotation.z = th;
        if (escK !== 'Gravity') esc.rotation.z = th;
        var odd = Math.floor(sec) % 2;
        if (armsL) { armsL.rotation.z = odd ? 0.12 : 0; armsR.rotation.z = odd ? 0 : -0.12; }
        if (gArms) { gArms[0].rotation.z = Math.min(0, th + 0.02) * 1.1; gArms[1].rotation.z = Math.max(0, th - 0.02) * 1.1; }
        if (legs) legs.rotation.z = arbors.V.rate * S * mech_TAU;
      }
    };
  }

  // =====================================================================
  // 2. ASTRONOMICAL CLOCK
  // After the Prague orloj, drawn for latitude 30.3. The dial is the sky
  // projected from the south celestial pole: the pole at the centre, the
  // horizon and the three twilights as the circles they really are. The sun
  // hand points at the sun's true hour angle and the sun rides it at its
  // declination; the zodiac ring turns with sidereal time; the moon is a
  // ball, half silver, that turns to show the phase. Death rings the hour.
  // =====================================================================
  function mech_stereo(Req, dec) { return Req * Math.tan((Math.PI / 2 - dec) / 2); }
  // a circle of equal altitude on the dial: [centre y, radius]
  function mech_altCircle(Req, alt) {
    var y1 = mech_stereo(Req, PHI - Math.PI / 2 + alt), y2 = -mech_stereo(Req, Math.PI / 2 - PHI + alt);
    return [(y1 + y2) / 2, (y1 - y2) / 2];
  }
  var mech_EPS = 23.4393 * D2R;
  // where ecliptic longitude lam sits on the dial when sidereal time is zero
  function mech_eclPoint(Req, lam) {
    var ra = Math.atan2(Math.cos(mech_EPS) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(mech_EPS) * Math.sin(lam)), rr = mech_stereo(Req, dec);
    return [-rr * Math.sin(ra), rr * Math.cos(ra)];
  }
  // hour angle and declination from altitude and azimuth
  function mech_haDec(el, az) {
    var e = el * D2R, a = az * D2R;
    return { H: Math.atan2(-Math.sin(a) * Math.cos(e), CPHI * Math.sin(e) - SPHI * Math.cos(e) * Math.cos(a)), dec: Math.asin(SPHI * Math.sin(e) + CPHI * Math.cos(e) * Math.cos(a)) };
  }
  var mech_ZOD = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
  var mech_ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

  function mech_astro(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {}, towerK = Tt['Tower'] || 'Gothic Stone', skyK = Tt['Sky Disc'] || 'Enamel';
    var metalM = heroMat(matName);
    var goldM = mtl('#D8B35C', 'brushed', 0.22, 1, 0.35), silverM = mtl('#DADDE2', 'brushed', 0.2, 1, 0.35), darkM = std('#131418', 0.4, 0.6);
    var blueSteel = std('#1C2B66', 0.25, 0.9), boneM = std('#E6DDC7', 0.7, 0), bronzeM = mtl('#8C6B38', 'brushed', 0.38, 0.95, 0.4);
    var gothic = towerK === 'Gothic Stone', adobe = towerK === 'Adobe', brut = towerK === 'Concrete Brutalist';
    var wallM = adobe ? mtl('#C99E76', 'plaster', 0.95, 0, 1.6) : brut ? mtl('#A9A49B', 'concrete', 0.95, 0, 1.9) : mtl('#B4A68F', 'stone', 0.88, 0, 1.3);
    var trimM = adobe ? mtl('#B68860', 'plaster', 0.95, 0, 1.4) : brut ? mtl('#8E8A83', 'concrete', 0.95, 0, 1.6) : mtl('#9B8E78', 'stone', 0.9, 0, 1.1);
    var TW = 4.8, TD = 2.4, TH = 8.9, zF = TD / 2, yD = 5.0, yCal = 1.95, yTc = 7.85;
    var Req = 0.78, rD = mech_stereo(Req, -mech_EPS), rH0 = rD + 0.005, rH1 = rD + 0.33;

    // ---- the tower
    var plinth = mech_bbox(TW + 0.6, 0.45, TD + 0.6, trimM, 0.04); plinth.position.y = 0.225; g.add(plinth);
    var body = mech_bbox(TW, TH - 0.45, TD, wallM, adobe ? 0.16 : 0.03); body.position.y = 0.45 + (TH - 0.45) / 2; g.add(body);
    var cornice = mech_bbox(TW + (brut ? 0.9 : 0.36), brut ? 0.5 : 0.26, TD + (brut ? 0.9 : 0.36), trimM, adobe ? 0.1 : 0.03); cornice.position.y = TH + (brut ? 0.25 : 0.13); g.add(cornice);
    var topY = TH + (brut ? 0.5 : 0.26), k;
    if (gothic) {
      [3.25, 6.95].forEach(function (y) { var s = mech_bbox(TW + 0.16, 0.14, TD + 0.16, trimM, 0.02); s.position.y = y; g.add(s); });
      [-1, 1].forEach(function (sd) {
        var b1 = mech_bbox(0.5, 3.6, 0.7, trimM, 0.03); b1.position.set(sd * (TW / 2 + 0.05), 2.25, zF - 0.1); g.add(b1);
        var b2 = mech_bbox(0.38, TH - 4.05, 0.55, trimM, 0.03); b2.position.set(sd * (TW / 2 + 0.05), 4.05 + (TH - 4.05) / 2, zF - 0.12); g.add(b2);
        var pb = mech_bbox(0.44, 0.7, 0.5, trimM, 0.03); pb.position.set(sd * (TW / 2 + 0.05), topY + 0.35, zF - 0.12); g.add(pb);
        var pin = new THREE.Mesh(new THREE.ConeBufferGeometry(0.3, 1.5, 4), trimM); pin.rotation.y = Math.PI / 4; pin.position.set(sd * (TW / 2 + 0.05), topY + 1.45, zF - 0.12); g.add(pin);
        var fin = sph(0.07, goldM); fin.position.set(sd * (TW / 2 + 0.05), topY + 2.25, zF - 0.12); g.add(fin);
        for (var j = 0; j < 3; j++) { var cr = sph(0.06, trimM, 6, 4); cr.position.set(sd * (TW / 2 + 0.05) + 0.17 * (j % 2 ? 1 : -1), topY + 0.95 + j * 0.35, zF - 0.12 + 0.17); g.add(cr); }
      });
      // a pointed gable round the little tower clock
      var gab = new THREE.Shape(), gw = 0.95, gy = 7.05, gh = 1.9;
      gab.moveTo(-gw, gy); gab.lineTo(gw, gy); gab.quadraticCurveTo(gw, gy + gh * 0.6, 0, gy + gh); gab.quadraticCurveTo(-gw, gy + gh * 0.6, -gw, gy);
      var gabIn = new THREE.Path(), gi = gw - 0.13;
      gabIn.moveTo(-gi, gy + 0.12); gabIn.lineTo(gi, gy + 0.12); gabIn.quadraticCurveTo(gi, gy + 0.12 + (gh - 0.25) * 0.6, 0, gy + gh - 0.16); gabIn.quadraticCurveTo(-gi, gy + 0.12 + (gh - 0.25) * 0.6, -gi, gy + 0.12);
      gab.holes.push(gabIn);
      var gm = new THREE.Mesh(mech_extrude(gab, 0.2, 0.02, 20), trimM); gm.position.z = zF + 0.1; g.add(gm);
    } else if (adobe) {
      for (k = 0; k < 7; k++) { var vg = mech_zcyl(0.1, 0.9, mtl('#6A5038', 'wood', 1, 0, 0.7), 8); vg.position.set(-TW / 2 + 0.45 + k * (TW - 0.9) / 6, TH - 0.5, zF); g.add(vg); }
    } else {
      [-1, 1].forEach(function (sd) { var fin2 = mech_bbox(0.3, TH - 0.45, 0.9, trimM, 0.01); fin2.position.set(sd * (TW / 2 - 0.15), 0.45 + (TH - 0.45) / 2, zF + 0.3); g.add(fin2); });
    }

    // ---- belfry, bell and hammer
    var bellG = new THREE.Group(), bellY, bellZ = gothic ? 0 : adobe ? zF - 0.35 : 0.1;
    var bellProf = [[0, 0.62], [0.12, 0.62], [0.2, 0.58], [0.24, 0.45], [0.26, 0.28], [0.32, 0.12], [0.42, 0.02], [0.45, 0], [0.4, 0.0], [0.31, 0.06], [0.22, 0.28], [0.2, 0.45], [0.1, 0.55], [0, 0.56]];
    bronzeM.side = THREE.DoubleSide;
    var bell = new THREE.Mesh(new THREE.LatheBufferGeometry(bellProf.map(function (q) { return new THREE.Vector2(q[0], q[1]); }).reverse(), 32), bronzeM);
    if (gothic) {
      bellY = topY + 0.45;
      var floor = mech_bbox(3.4, 0.2, 2.1, trimM, 0.02); floor.position.y = topY + 0.1; g.add(floor);
      [[-1.5, -0.85], [1.5, -0.85], [-1.5, 0.85], [1.5, 0.85]].forEach(function (q) { var p = mech_bbox(0.26, 2.0, 0.26, trimM, 0.02); p.position.set(q[0], topY + 1.2, q[1]); g.add(p); });
      [0.85, -0.85].forEach(function (zz) {
        var ab = new THREE.Shape(); ab.moveTo(-1.62, topY + 2.2); ab.lineTo(-1.62, topY + 1.2);
        ab.quadraticCurveTo(-1.4, topY + 1.95, 0, topY + 2.08); ab.quadraticCurveTo(1.4, topY + 1.95, 1.62, topY + 1.2); ab.lineTo(1.62, topY + 2.2); ab.lineTo(-1.62, topY + 2.2);
        var am = new THREE.Mesh(mech_extrude(ab, 0.2, 0.015, 16), trimM); am.position.z = zz; g.add(am);
      });
      var roof = new THREE.Mesh(new THREE.ConeBufferGeometry(1, 2.2, 4), metalM); roof.rotation.y = Math.PI / 4; roof.scale.set(1.8 / 0.707, 1, 1.12 / 0.707); roof.position.y = topY + 2.2 + 1.1; g.add(roof);
      var fin3 = sph(0.1, goldM); fin3.position.y = topY + 4.35; g.add(fin3);
      var sp3 = new THREE.Mesh(new THREE.ConeBufferGeometry(0.03, 0.5, 8), goldM); sp3.position.y = topY + 4.65; g.add(sp3);
    } else if (adobe) {
      bellY = topY + 0.55;
      var esp = new THREE.Shape(), ew = 1.55, eh = 2.7;
      esp.moveTo(-ew, topY); esp.lineTo(ew, topY); esp.lineTo(ew, topY + 1.0); esp.quadraticCurveTo(ew, topY + 1.5, ew * 0.55, topY + 1.7);
      esp.quadraticCurveTo(0.6, topY + 1.9, 0.5, topY + eh - 0.3); esp.quadraticCurveTo(0, topY + eh + 0.15, -0.5, topY + eh - 0.3);
      esp.quadraticCurveTo(-0.6, topY + 1.9, -ew * 0.55, topY + 1.7); esp.quadraticCurveTo(-ew, topY + 1.5, -ew, topY + 1.0); esp.lineTo(-ew, topY);
      var op = new THREE.Path(); op.moveTo(-0.55, topY + 0.15); op.lineTo(0.55, topY + 0.15); op.lineTo(0.55, topY + 1.1); op.absarc(0, topY + 1.1, 0.55, 0, Math.PI, false); op.lineTo(-0.55, topY + 0.15);
      esp.holes.push(op);
      var em = new THREE.Mesh(mech_extrude(esp, 0.45, 0.08, 20), wallM); em.position.z = bellZ; g.add(em);
      var beam = mech_zcyl(0.06, 1.3, mtl('#5E4630', 'wood', 1, 0, 0.6), 8); beam.rotation.set(0, Math.PI / 2, 0); beam.position.set(0, topY + 1.3, bellZ); g.add(beam);
      var fb = sph(0.12, trimM); fb.position.set(0, topY + eh + 0.12, bellZ); g.add(fb);
    } else {
      bellY = topY + 0.5;
      var slabT = mech_bbox(3.8, 0.45, 2.6, trimM, 0.01); slabT.position.set(0, topY + 2.35, 0.1); g.add(slabT);
      [-1, 1].forEach(function (sd) { var w2 = mech_bbox(0.35, 2.1, 2.2, trimM, 0.01); w2.position.set(sd * 1.55, topY + 1.05, 0); g.add(w2); });
      var bw2 = mech_bbox(2.8, 2.1, 0.3, trimM, 0.01); bw2.position.set(0, topY + 1.05, -0.95); g.add(bw2);
    }
    bellG.add(bell);
    var yoke = box(0.5, 0.1, 0.12, darkM); yoke.position.y = 0.66; bellG.add(yoke);
    var clap = sph(0.05, darkM); clap.position.y = 0.08; bellG.add(clap);
    bellG.position.set(0, bellY, bellZ); g.add(bellG);
    // the hammer swings from a pivot to the right of the bell
    var hamZ = adobe ? bellZ + 0.36 : bellZ, hamX = adobe ? 0.46 : 0.62;
    var ham = new THREE.Group(); ham.position.set(hamX, bellY + 0.55, hamZ); g.add(ham);
    var hArm = box(0.04, 0.5, 0.04, darkM); hArm.position.set(0, -0.25, 0); ham.add(hArm);
    var hHead = cyl(0.06, 0.06, 0.16, 12, darkM); hHead.rotation.z = Math.PI / 2; hHead.position.set(-0.08, -0.5, 0); ham.add(hHead);
    ham.add(mech_zcyl(0.04, 0.12, goldM, 12));
    var hBr = box(0.08, 0.6, 0.08, darkM); hBr.position.set(hamX, bellY + 0.3, hamZ - 0.08); g.add(hBr);
    // Death, as in Prague, pulls the rope
    var death = new THREE.Group();
    death.position.set(adobe ? 1.95 : 1.12, adobe ? topY : topY + (gothic ? 0.2 : 0), adobe ? zF - 0.15 : bellZ + 0.3); g.add(death);
    var head = new THREE.Group(); head.position.y = 1.02; death.add(head);
    var skull = sph(0.1, boneM, 14, 10); skull.scale.set(0.9, 1.05, 1); head.add(skull);
    [-1, 1].forEach(function (sd) { var eye = sph(0.025, darkM, 8, 6); eye.position.set(sd * 0.035, 0.01, 0.085); head.add(eye); });
    var jaw = box(0.08, 0.035, 0.06, boneM); jaw.position.set(0, -0.09, 0.03); head.add(jaw);
    var spine = cyl(0.018, 0.018, 0.5, 6, boneM); spine.position.y = 0.66; death.add(spine);
    for (k = 0; k < 4; k++) { var rib = new THREE.Mesh(new THREE.TorusBufferGeometry(0.09 - k * 0.01, 0.01, 6, 16), boneM); rib.rotation.x = Math.PI / 2; rib.scale.set(1.2, 0.8, 1); rib.position.y = 0.84 - k * 0.06; death.add(rib); }
    var pelvis = box(0.2, 0.06, 0.08, boneM); pelvis.position.y = 0.42; death.add(pelvis);
    [-1, 1].forEach(function (sd) { var lg = cyl(0.018, 0.015, 0.42, 6, boneM); lg.position.set(sd * 0.06, 0.2, 0); death.add(lg); });
    var armRope = new THREE.Group(); armRope.position.set(-0.13, 0.88, 0); death.add(armRope);
    var ar = cyl(0.015, 0.013, 0.38, 6, boneM); ar.position.y = 0.19; armRope.add(ar);
    var armGlass = new THREE.Group(); armGlass.position.set(0.13, 0.88, 0); armGlass.rotation.z = 0.25; death.add(armGlass);
    var al = cyl(0.015, 0.013, 0.38, 6, boneM); al.position.y = -0.19; armGlass.add(al);
    var glass = new THREE.Group(); glass.position.set(0, -0.38, 0.03); armGlass.add(glass);
    var sandM = std('#F2E3B6', 0.2, 0, { transparent: true, opacity: 0.8 });
    [1, -1].forEach(function (sd) { var cn = new THREE.Mesh(new THREE.ConeBufferGeometry(0.045, 0.07, 10), sandM); cn.rotation.x = sd > 0 ? Math.PI : 0; cn.position.y = sd * 0.036; glass.add(cn); });
    [1, -1].forEach(function (sd) { var pl = cyl(0.055, 0.055, 0.012, 12, darkM); pl.position.y = sd * 0.078; glass.add(pl); });
    var rope = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.008, 0.008, 1, 5), std('#8B7A5A', 1)); g.add(rope);

    // ---- the astronomical dial
    var dg = new THREE.Group(); dg.position.set(0, yD, zF + 0.02); g.add(dg);
    var fr = mech_rrect(3.78, 3.78, 0.12); fr.holes.push(new THREE.Path(mech_circle(rH1 + 0.04, 96).reverse()));
    var frame = new THREE.Mesh(mech_extrude(fr, 0.12, 0.02, 16), metalM); frame.position.z = 0.05; dg.add(frame);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (q, j) {
      var t = new THREE.Mesh(mech_extrude(primShape([0, 2, 5, 1][j], j, 0.34), 0.03, 0.004), goldM);
      t.position.set(q[0] * 1.55, q[1] * 1.55, 0.13); t.rotation.z = Math.atan2(q[1], q[0]) - Math.PI / 4; dg.add(t);
    });
    var skyTex = canvasTex(1024, 1024, function (gc, S) { mech_paintSky(gc, S, Req, rD, skyK, seedRng(W.P.seed + 41)); });
    var skyM = new THREE.MeshStandardMaterial({ map: skyTex, roughness: skyK === 'Gold Leaf' ? 0.3 : 0.45, metalness: skyK === 'Gold Leaf' ? 0.55 : 0.05, emissive: C('#FFFFFF'), emissiveMap: skyTex, emissiveIntensity: 0 });
    W.glow(skyM, 0.0, 0.35);
    dg.add(new THREE.Mesh(new THREE.CircleBufferGeometry(rD, 128), skyM));
    var ring24Tex = canvasTex(1024, 1024, function (gc, S) {
      var kk = S / 2 / rH1, cx = S / 2, bg = skyK === 'Gold Leaf' ? '#1C1A20' : skyK === 'Night Blue' ? '#0B1233' : '#15151B';
      gc.fillStyle = bg; gc.fillRect(0, 0, S, S);
      gc.strokeStyle = '#D9B865'; gc.fillStyle = '#E4C477'; gc.lineWidth = 3;
      [rH0 + 0.01, rH1 - 0.012].forEach(function (rr) { gc.beginPath(); gc.arc(cx, cx, rr * kk, 0, mech_TAU); gc.stroke(); });
      gc.textAlign = 'center'; gc.textBaseline = 'middle';
      for (var q = 0; q < 96; q++) {
        var Hs = q / 4, a = haForClock(Hs) * D2R, full = q % 4 === 0;
        gc.save(); gc.translate(cx, cx); gc.rotate(a);
        gc.fillRect(full ? -2.5 : -1.2, -(rH0 + 0.012) * kk - (full ? 0.05 : 0.025) * kk, full ? 5 : 2.4, (full ? 0.05 : 0.025) * kk);
        if (full) {
          var lab = mech_ROMAN[(Math.round(Hs) + (W.dst ? 1 : 0)) % 12];
          gc.translate(0, -(rH0 + rH1) / 2 * kk - 0.015 * kk); gc.font = '700 ' + Math.round(0.13 * kk) + 'px ' + FONT_SERIF; gc.scale(0.8, 1);
          gc.fillText(lab, 0, 0);
        }
        gc.restore();
      }
    });
    var ring24 = new THREE.Mesh(new THREE.RingBufferGeometry(rH0, rH1, 128, 1), new THREE.MeshStandardMaterial({ map: ring24Tex, roughness: 0.4, metalness: 0.3, emissive: C('#FFE6A8'), emissiveMap: ring24Tex, emissiveIntensity: 0 }));
    W.glow(ring24.material, 0, 0.5);
    ring24.position.z = 0.004; dg.add(ring24);
    [rH1 + 0.02, rH0].forEach(function (rr, j) { var t = new THREE.Mesh(new THREE.TorusBufferGeometry(rr, j ? 0.014 : 0.035, 8, 128), goldM); t.position.z = 0.02; dg.add(t); });
    var ttl = textPlane('MARFA  30.31 N', { color: '#E2C57C', height: 0.12, px: 60, font: FONT_SERIF, spacing: 0.2, pad: 0.05 });
    ttl.position.set(0, 1.78, 0.115); dg.add(ttl);
    // zodiac ring: the ecliptic, eccentric, turning with sidereal time
    var pC = mech_eclPoint(Req, Math.PI / 2), pK = mech_eclPoint(Req, 1.5 * Math.PI);
    var zc = [(pC[0] + pK[0]) / 2, (pC[1] + pK[1]) / 2], zR = Math.hypot(pC[0] - zc[0], pC[1] - zc[1]), zw = 0.075;
    var zodTex = canvasTex(1024, 1024, function (gc, S) {
      var kk = S / 2 / (zR + zw), cx = S / 2, j;
      gc.fillStyle = '#C9A351'; gc.fillRect(0, 0, S, S);
      gc.strokeStyle = '#3A2610'; gc.lineWidth = 3;
      [zR - zw + 0.006, zR + zw - 0.006].forEach(function (rr) { gc.beginPath(); gc.arc(cx, cx, rr * kk, 0, mech_TAU); gc.stroke(); });
      gc.fillStyle = '#2E1E0C'; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '700 26px ' + FONT_SERIF;
      for (j = 0; j < 12; j++) {
        var b = mech_eclPoint(Req, j * 30 * D2R), ang = -Math.atan2(b[1] - zc[1], b[0] - zc[0]);
        gc.beginPath(); gc.moveTo(cx + Math.cos(ang) * (zR - zw) * kk, cx + Math.sin(ang) * (zR - zw) * kk); gc.lineTo(cx + Math.cos(ang) * (zR + zw) * kk, cx + Math.sin(ang) * (zR + zw) * kk); gc.stroke();
        var mdp = mech_eclPoint(Req, (j * 30 + 15) * D2R), am = -Math.atan2(mdp[1] - zc[1], mdp[0] - zc[0]);
        arcText(gc, mech_ZOD[j], cx, cx, zR * kk, am, false);
      }
      for (j = 0; j < 72; j++) {
        var bb = mech_eclPoint(Req, j * 5 * D2R), a2 = -Math.atan2(bb[1] - zc[1], bb[0] - zc[0]);
        gc.beginPath(); gc.moveTo(cx + Math.cos(a2) * (zR + zw - 0.03) * kk, cx + Math.sin(a2) * (zR + zw - 0.03) * kk); gc.lineTo(cx + Math.cos(a2) * (zR + zw) * kk, cx + Math.sin(a2) * (zR + zw) * kk); gc.stroke();
      }
    });
    var zodG = new THREE.Group(); zodG.position.z = 0.03; dg.add(zodG);
    var zod = new THREE.Mesh(new THREE.RingBufferGeometry(zR - zw, zR + zw, 128, 1), new THREE.MeshStandardMaterial({ map: zodTex, roughness: 0.3, metalness: 0.7 }));
    zod.position.set(zc[0], zc[1], 0); zodG.add(zod);
    [zR - zw, zR + zw].forEach(function (rr) { var t = new THREE.Mesh(new THREE.TorusBufferGeometry(rr, 0.01, 6, 128), goldM); t.position.set(zc[0], zc[1], 0.005); zodG.add(t); });
    // hands: the star, the moon and the sun
    var starH = new THREE.Group(); starH.position.z = 0.055; dg.add(starH);
    starH.add(mech_hand({ style: 'baton', L: 1.02, w: 0.022, tail: 0.18, th: 0.01 }, blueSteel));
    var st = new THREE.Mesh(mech_extrude(mech_star(6, 0.075, 0.03), 0.014, 0), goldM); st.position.y = 1.08; starH.add(st);
    var moonH = new THREE.Group(); moonH.position.z = 0.075; dg.add(moonH);
    moonH.add(mech_hand({ style: 'arrow', L: rH0 + 0.12, w: 0.026, tail: 0.2, th: 0.012, head: 0.05 }, silverM));
    var moonBall = new THREE.Group(); moonH.add(moonBall);
    moonBall.add(new THREE.Mesh(new THREE.SphereBufferGeometry(0.075, 24, 16, 0, Math.PI), std('#E9ECF0', 0.18, 1)));
    moonBall.add(new THREE.Mesh(new THREE.SphereBufferGeometry(0.075, 24, 16, Math.PI, Math.PI), std('#08090B', 0.35, 0.3)));
    moonBall.add(new THREE.Mesh(new THREE.TorusBufferGeometry(0.077, 0.007, 6, 32), goldM));
    var sunH = new THREE.Group(); sunH.position.z = 0.1; dg.add(sunH);
    sunH.add(mech_hand({ style: 'spade', L: rH1 - 0.02, w: 0.034, tail: 0.3, th: 0.014, spade: 0.05, disc: 0.06 }, goldM));
    var sunD = new THREE.Group(); sunH.add(sunD);
    var rays = new THREE.Mesh(mech_extrude(mech_star(16, 0.15, 0.09), 0.012, 0), goldM); rays.position.z = 0.015; sunD.add(rays);
    var sunFace = sph(0.085, goldM, 24, 12); sunFace.scale.z = 0.35; sunFace.position.z = 0.025; sunD.add(sunFace);
    var hub = mech_dome(0.07, goldM); hub.position.z = 0.13; dg.add(hub);
    // sunrise and sunset, today's, drawn at the rim
    var evG = new THREE.Group(); evG.position.z = 0.13; dg.add(evG);
    var evDay = -1;

    // ---- the calendar dial below
    var cg = new THREE.Group(); cg.position.set(0, yCal, zF + 0.02); g.add(cg);
    var cfr = mech_rrect(2.3, 2.3, 0.1); cfr.holes.push(new THREE.Path(mech_circle(1.0, 80).reverse()));
    var cframe = new THREE.Mesh(mech_extrude(cfr, 0.1, 0.02, 12), metalM); cframe.position.z = 0.04; cg.add(cframe);
    var calTex = canvasTex(1024, 1024, function (gc, S) { mech_paintCalendar(gc, S, 0.97); });
    var cal = new THREE.Mesh(new THREE.CircleBufferGeometry(0.97, 96), new THREE.MeshStandardMaterial({ map: calTex, roughness: 0.5, metalness: 0.1 })); cg.add(cal);
    var cbz = new THREE.Mesh(new THREE.TorusBufferGeometry(0.985, 0.03, 8, 96), goldM); cbz.position.z = 0.02; cg.add(cbz);
    var ptr = new THREE.Mesh(mech_extrude(new THREE.Shape([new THREE.Vector2(-0.07, 0.16), new THREE.Vector2(0.07, 0.16), new THREE.Vector2(0, 0)]), 0.02, 0.003), goldM);
    ptr.position.set(0, 0.86, 0.06); cg.add(ptr);
    var chub = mech_dome(0.05, goldM); chub.position.z = 0.04; cg.add(chub);

    // ---- the plain tower clock in the gable
    var tg = new THREE.Group(); tg.position.set(0, yTc, zF + (gothic ? 0.16 : 0.03)); g.add(tg);
    var tcTex = canvasTex(512, 512, function (gc, S) {
      var cx = S / 2, kk = S / 2 / 0.5;
      gc.fillStyle = '#F2EEE3'; gc.fillRect(0, 0, S, S);
      gc.fillStyle = '#151518'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      for (var m = 0; m < 60; m++) { gc.save(); gc.translate(cx, cx); gc.rotate(m / 60 * mech_TAU); gc.fillRect(m % 5 ? -1.5 : -4, -0.47 * kk, m % 5 ? 3 : 8, m % 5 ? 10 : 22); gc.restore(); }
      for (var hr = 0; hr < 12; hr++) {
        var a = hr / 12 * mech_TAU; gc.save(); gc.translate(cx + Math.sin(a) * 0.35 * kk, cx - Math.cos(a) * 0.35 * kk); gc.rotate(a);
        gc.font = '400 46px ' + FONT_SERIF; gc.scale(0.8, 1); gc.fillText(mech_ROMAN[hr], 0, 0); gc.restore();
      }
    });
    var tcM = new THREE.MeshStandardMaterial({ map: tcTex, roughness: 0.3, emissive: C('#FFF3D8'), emissiveMap: tcTex, emissiveIntensity: 0 }); W.glow(tcM, 0.05, 0.6);
    tg.add(new THREE.Mesh(new THREE.CircleBufferGeometry(0.5, 64), tcM));
    tg.add(new THREE.Mesh(new THREE.TorusBufferGeometry(0.52, 0.045, 10, 64), metalM));
    var tcH = mech_hand({ style: 'spade', L: 0.3, w: 0.03, tail: 0.06, th: 0.012, spade: 0.035 }, darkM); tcH.position.z = 0.02; tg.add(tcH);
    var tcMn = mech_hand({ style: 'spade', L: 0.44, w: 0.022, tail: 0.08, th: 0.01, spade: 0.028 }, darkM); tcMn.position.z = 0.035; tg.add(tcMn);
    mech_lamp(W, g, '#FFE2B4', 1.7, 12, new THREE.Vector3(2.9, yD + 0.8, zF + 2.2));
    shade(g);
    rope.castShadow = false;

    function strike(t) {
      var e = t.sec - t.h * 3600, n = t.h % 12 || 12, per = 2.4, lift = 0, shake = 0;
      if (e < n * per) {
        var u = (e % per) / per;
        lift = u < 0.62 ? sstep(0, 0.62, u) * 0.75 : u < 0.68 ? (0.68 - u) / 0.06 * 0.75 : 0;
        if (u >= 0.68) shake = Math.sin((u - 0.68) * 60) * Math.exp(-(u - 0.68) * 9) * 0.05;
      }
      return { lift: lift, shake: shake };
    }
    var vUp = new THREE.Vector3(0, 1, 0), hand = new THREE.Vector3(), tail = new THREE.Vector3();
    return {
      group: g, R: TW / 2 + 1.0, lookY: 5.6, dist: rf(r, 19, 22), camH: [1.6, 2.6], face: true, close: { zoom: 0.42, el: 0.05, look: yD - 5.6 },
      astro: { Req: Req, zc: zc, zR: zR },
      update: function (ctx) {
        var L = lst(ctx.utc), sq = sunEq(ctx.utc), Hs = L - sq.ra, md2 = mech_haDec(ctx.moon.el, ctx.moon.az);
        sunH.rotation.z = -Hs; sunD.position.y = mech_stereo(Req, sq.dec);
        moonH.rotation.z = -md2.H; moonBall.position.set(0, mech_stereo(Req, md2.dec), 0.03);
        moonBall.rotation.y = Math.PI - ctx.moon.age * mech_TAU;
        zodG.rotation.z = -L; starH.rotation.z = -L;
        var t = ctx.t, doy = dayOfYear(t);
        cal.rotation.z = (doy - 1 + t.hours / 24) / 365.25 * mech_TAU;
        var sm = t.sec % 43200;
        tcH.rotation.z = -sm / 43200 * mech_TAU; tcMn.rotation.z = -(sm % 3600) / 3600 * mech_TAU;
        var s = strike(t);
        ham.rotation.z = s.lift; bellG.rotation.z = s.shake;
        armRope.rotation.z = 0.5 + s.lift * 0.9; head.rotation.x = s.lift * 0.35;
        // the rope from Death's hand to the hammer arm
        g.updateMatrixWorld(true);
        hand.set(0, 0.38, 0); armRope.localToWorld(hand); g.worldToLocal(hand);
        tail.set(0, -0.3, 0); ham.localToWorld(tail); g.worldToLocal(tail);
        rope.position.copy(hand).lerp(tail, 0.5); rope.scale.y = Math.max(0.01, hand.distanceTo(tail));
        rope.quaternion.setFromUnitVectors(vUp, tail.clone().sub(hand).normalize());
        if (t.days !== evDay) {
          evDay = t.days;
          while (evG.children.length) { var c = evG.children.pop(); c.geometry.dispose(); if (c.material.map) c.material.map.dispose(); c.material.dispose(); }
          var ev = sunEvents(t);
          [[ev.rise, 'SUNRISE'], [ev.set, 'SUNSET']].forEach(function (q) {
            if (q[0] === '--:--') return;
            var hm = q[0].split(':'), Hc = +hm[0] + hm[1] / 60 - (t.dst ? 1 : 0), a = haForClock(Hc) * D2R;
            var tri = new THREE.Mesh(mech_extrude(new THREE.Shape([new THREE.Vector2(-0.045, 0.1), new THREE.Vector2(0.045, 0.1), new THREE.Vector2(0, 0)]), 0.012, 0), goldM.clone());
            tri.position.set(Math.sin(a) * (rH1 + 0.02), Math.cos(a) * (rH1 + 0.02), 0); tri.rotation.z = -a; evG.add(tri);
            var lab = textPlane([q[1], q[0]], { color: '#F0D58E', height: 0.2, px: 48, font: FONT_MONO, pad: 0.08 });
            var rr = rH1 + 0.3; lab.position.set(Math.sin(a) * rr + (Math.sin(a) > 0 ? 0.05 : -0.05), Math.cos(a) * rr, 0); evG.add(lab);
          });
        }
      }
    };
  }
  // the painted sky: night, three twilights and the day, clipped to the tropic of Capricorn
  function mech_paintSky(gc, S, Req, rD, kind, rng) {
    var k = S / 2 / rD, cx = S / 2, X = function (x) { return cx + x * k; }, Y = function (y) { return cx - y * k; }, i;
    var pal = kind === 'Gold Leaf' ? { base: '#C9A24A', night: 'rgba(18,16,22,0.86)', t3: 'rgba(70,30,14,0.7)', t2: 'rgba(120,52,20,0.6)', t1: 'rgba(170,80,28,0.5)', day: 'rgba(70,130,205,0.55)', line: '#3B2A10', ink: '#2A1A08' }
      : kind === 'Night Blue' ? { base: '#060A22', night: '#060A22', t3: '#12173E', t2: '#262A5C', t1: '#4A3E72', day: '#8FB4DE', line: '#D9C27A', ink: '#F0E3B8' }
        : { base: '#0B0B10', night: '#0B0B10', t3: '#2C1A12', t2: '#5B2E17', t1: '#A0521F', day: '#3F7CC8', line: '#D9B865', ink: '#1A1206' };
    gc.save(); gc.beginPath(); gc.arc(cx, cx, rD * k, 0, mech_TAU); gc.clip();
    gc.fillStyle = pal.base; gc.fillRect(0, 0, S, S);
    if (kind === 'Gold Leaf') {
      for (i = 0; i < 900; i++) { gc.fillStyle = 'rgba(' + (rng() < 0.5 ? '255,240,190' : '120,80,20') + ',' + (0.05 + rng() * 0.08) + ')'; gc.fillRect(rng() * S, rng() * S, 6 + rng() * 30, 6 + rng() * 30); }
      gc.fillStyle = pal.night; gc.fillRect(0, 0, S, S);
    }
    if (kind === 'Night Blue') for (i = 0; i < 420; i++) { gc.fillStyle = 'rgba(255,245,215,' + (0.3 + rng() * 0.7) + ')'; var sz = rng() < 0.08 ? 3 : 1.5; gc.beginPath(); gc.arc(rng() * S, rng() * S, sz, 0, mech_TAU); gc.fill(); }
    [[-18, pal.t3], [-12, pal.t2], [-6, pal.t1], [0, pal.day]].forEach(function (q) {
      var c = mech_altCircle(Req, q[0] * D2R); gc.fillStyle = q[1]; gc.beginPath(); gc.arc(X(0), Y(c[0]), c[1] * k, 0, mech_TAU); gc.fill();
    });
    // the day is lighter toward the zenith
    var zy = mech_stereo(Req, PHI), hz = mech_altCircle(Req, 0);
    var gr = gc.createRadialGradient(X(0), Y(zy), 0, X(0), Y(zy), rD * k * 1.1);
    gr.addColorStop(0, kind === 'Gold Leaf' ? 'rgba(200,230,255,0.25)' : 'rgba(210,235,255,0.45)'); gr.addColorStop(1, 'rgba(210,235,255,0)');
    gc.save(); gc.beginPath(); gc.arc(X(0), Y(hz[0]), hz[1] * k, 0, mech_TAU); gc.clip(); gc.fillStyle = gr; gc.fillRect(0, 0, S, S);
    // the unequal hours of the day, twelve from sunrise to sunset whatever the season
    gc.strokeStyle = kind === 'Night Blue' ? 'rgba(20,30,70,0.8)' : pal.ink; gc.lineWidth = 2.2;
    var rs = function (d) { return mech_stereo(Req, d); }, tp = Math.tan(PHI), hq;
    for (hq = 1; hq < 12; hq++) {
      gc.beginPath();
      for (var dd = -23.44; dd <= 23.45; dd += 1.5) {
        var d = dd * D2R, H0 = Math.acos(-tp * Math.tan(d)), Hh = -H0 + hq * 2 * H0 / 12, rr = rs(d);
        if (dd === -23.44) gc.moveTo(X(rr * Math.sin(Hh)), Y(rr * Math.cos(Hh))); else gc.lineTo(X(rr * Math.sin(Hh)), Y(rr * Math.cos(Hh)));
      }
      gc.stroke();
    }
    gc.fillStyle = kind === 'Night Blue' ? '#16204A' : pal.ink; gc.font = '700 30px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
    for (hq = 1; hq <= 12; hq++) {
      var d2 = -18 * D2R, H02 = Math.acos(-tp * Math.tan(d2)), Hm = -H02 + (hq - 0.5) * 2 * H02 / 12, r2 = rs(d2);
      gc.fillText(String(hq), X(r2 * Math.sin(Hm)), Y(r2 * Math.cos(Hm)));
    }
    gc.restore();
    // circles: tropics, equator, horizon and twilight edges
    gc.strokeStyle = pal.line; gc.lineWidth = 3;
    [mech_EPS, 0, -mech_EPS].forEach(function (d) { gc.beginPath(); gc.arc(cx, cx, rs(d) * k - (d < 0 ? 2 : 0), 0, mech_TAU); gc.stroke(); });
    [[0, 5], [-6, 1.5], [-12, 1.5], [-18, 2]].forEach(function (q) { var c = mech_altCircle(Req, q[0] * D2R); gc.lineWidth = q[1]; gc.beginPath(); gc.arc(X(0), Y(c[0]), c[1] * k, 0, mech_TAU); gc.stroke(); });
    gc.lineWidth = 1.5; gc.beginPath(); gc.moveTo(cx, Y(rD)); gc.lineTo(cx, Y(-rD)); gc.stroke();
    // words along the horizon, after Prague
    var lab = function (txt, x, alt, col, size) {
      var c = mech_altCircle(Req, alt * D2R), y = c[0] - Math.sqrt(Math.max(0, c[1] * c[1] - x * x)), slope = x / Math.sqrt(Math.max(1e-6, c[1] * c[1] - x * x));
      gc.save(); gc.translate(X(x), Y(y)); gc.rotate(-Math.atan(slope)); gc.fillStyle = col; gc.font = '700 ' + size + 'px ' + FONT_SERIF; gc.fillText(txt, 0, 0); gc.restore();
    };
    var lc = kind === 'Night Blue' ? '#F0E3B8' : '#E9CF86', dayInk = kind === 'Night Blue' ? '#16204A' : lc;
    lab('ORTVS', -0.62 * rD, 3.2, dayInk, 34); lab('OCCASVS', 0.62 * rD, 3.2, dayInk, 34);
    lab('AVRORA', -0.58 * rD, -9, lc, 26); lab('CREPVSCVLVM', 0.58 * rD, -9, lc, 26);
    gc.fillStyle = lc; gc.font = '700 34px ' + FONT_SERIF; gc.fillText('NOX', cx, Y(-0.82 * rD));
    gc.restore();
  }
  // the calendar plate: months, days and the six seasons of the bloom
  function mech_paintCalendar(gc, S, R) {
    var k = S / 2 / R, cx = S / 2, i;
    var mcol = ['#5C7FA8', '#6E8FB2', '#8FAF7E', '#A9C47A', '#D2C46B', '#E1A94F', '#E08A3E', '#D0773A', '#B7803F', '#9C7B55', '#7E7A86', '#5F7196'];
    var mlen = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], d0 = 0;
    gc.fillStyle = '#EDE5D2'; gc.fillRect(0, 0, S, S);
    for (i = 0; i < 12; i++) {
      var a0 = d0 / 365 * mech_TAU - Math.PI / 2, a1 = (d0 + mlen[i]) / 365 * mech_TAU - Math.PI / 2;
      gc.fillStyle = mcol[i]; gc.beginPath(); gc.moveTo(cx, cx); gc.arc(cx, cx, 0.93 * R * k, a0, a1); gc.closePath(); gc.fill();
      gc.strokeStyle = '#2A2016'; gc.lineWidth = 3; gc.beginPath(); gc.moveTo(cx + Math.cos(a0) * 0.36 * R * k, cx + Math.sin(a0) * 0.36 * R * k); gc.lineTo(cx + Math.cos(a0) * R * k, cx + Math.sin(a0) * R * k); gc.stroke();
      gc.fillStyle = '#1E160C'; gc.font = '700 40px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      arcText(gc, MONTHS[i], cx, cx, 0.8 * R * k, (a0 + a1) / 2, false);
      d0 += mlen[i];
    }
    gc.fillStyle = '#F4EEDF'; gc.beginPath(); gc.arc(cx, cx, R * k, 0, mech_TAU); gc.arc(cx, cx, 0.93 * R * k, 0, mech_TAU, true); gc.fill();
    gc.strokeStyle = '#2A2016';
    for (i = 0; i < 365; i++) {
      var a = i / 365 * mech_TAU - Math.PI / 2, L = i % 7 === 0 ? 0.05 : 0.03;
      gc.lineWidth = 1.2; gc.beginPath(); gc.moveTo(cx + Math.cos(a) * (R - L) * k, cx + Math.sin(a) * (R - L) * k); gc.lineTo(cx + Math.cos(a) * R * k, cx + Math.sin(a) * R * k); gc.stroke();
    }
    var seas = [[0, 60, 'FROST', '#AFC3D6'], [60, 95, 'REGROWTH', '#B7CE8E'], [95, 130, 'BUD', '#D6CF83'], [130, 180, 'BLOOM', '#E8A7B8'], [180, 250, 'PEAK', '#E5845E'], [250, 320, 'WILT', '#B5946A'], [320, 365, 'FROST', '#AFC3D6']];
    seas.forEach(function (q) {
      var b0 = q[0] / 365 * mech_TAU - Math.PI / 2, b1 = q[1] / 365 * mech_TAU - Math.PI / 2;
      gc.fillStyle = q[3]; gc.beginPath(); gc.arc(cx, cx, 0.62 * R * k, b0, b1); gc.arc(cx, cx, 0.4 * R * k, b1, b0, true); gc.closePath(); gc.fill();
      gc.strokeStyle = '#2A2016'; gc.lineWidth = 2; gc.stroke();
      gc.fillStyle = '#2A2016'; gc.font = '700 26px ' + FONT_SANS; arcText(gc, q[2], cx, cx, 0.51 * R * k, (b0 + b1) / 2, false);
    });
    gc.fillStyle = '#1D2B4F'; gc.beginPath(); gc.arc(cx, cx, 0.38 * R * k, 0, mech_TAU); gc.fill();
    gc.strokeStyle = '#D9B865'; gc.lineWidth = 4; gc.stroke();
    gc.fillStyle = '#E9CF86'; gc.font = '700 46px ' + FONT_SERIF; gc.fillText('MARFA', cx, cx - 18);
    gc.font = '400 26px ' + FONT_MONO; gc.fillText('BLOOM CYCLE', cx, cx + 30);
  }

  // =====================================================================
  // 3. MOTEL SIGN
  // A West Texas roadside sign on a steel pole: a neon name bent from glass
  // tube, a feature shape outlined in chasing bulbs, a clock in the middle
  // and a VACANCY panel that fills up at ten. Every name is invented.
  // =====================================================================
  var mech_MOTELS = { 'THE 317 MOTEL': ['THE 317', 'MOTEL'], 'LAST LIGHT MOTOR INN': ['LAST LIGHT', 'MOTOR INN'], 'MOONRISE COURT': ['MOONRISE', 'COURT'], 'SLOW TIME LODGE': ['SLOW TIME', 'LODGE'] };
  var mech_FONT = null;
  // a single-stroke font, as a sign shop bends it. [width, strokes] per letter
  function mech_font() {
    if (mech_FONT) return mech_FONT;
    var A = mech_arcPts;
    mech_FONT = {
      A: [0.72, [[[0, 0], [0.36, 1], [0.72, 0]], [[0.15, 0.4], [0.57, 0.4]]]],
      C: [0.7, [A(0.37, 0.5, 0.36, 0.5, 42, 318, 22)]],
      D: [0.7, [[[0, 0], [0, 1], [0.3, 1]].concat(A(0.3, 0.5, 0.4, 0.5, 90, -90, 14), [[0, 0]])]],
      E: [0.6, [[[0.6, 1], [0, 1], [0, 0], [0.6, 0]], [[0, 0.52], [0.48, 0.52]]]],
      G: [0.74, [A(0.37, 0.5, 0.37, 0.5, 40, 360, 22).concat([[0.42, 0.5]])]],
      H: [0.68, [[[0, 0], [0, 1]], [[0.68, 0], [0.68, 1]], [[0, 0.52], [0.68, 0.52]]]],
      I: [0.12, [[[0.06, 0], [0.06, 1]]]],
      K: [0.64, [[[0, 0], [0, 1]], [[0.64, 1], [0, 0.38]], [[0.2, 0.55], [0.64, 0]]]],
      L: [0.56, [[[0, 1], [0, 0], [0.56, 0]]]],
      M: [0.86, [[[0, 0], [0, 1], [0.43, 0.3], [0.86, 1], [0.86, 0]]]],
      N: [0.68, [[[0, 0], [0, 1], [0.68, 0], [0.68, 1]]]],
      O: [0.78, [A(0.39, 0.5, 0.39, 0.5, 90, 450, 30)]],
      R: [0.66, [[[0, 0], [0, 1], [0.36, 1]].concat(A(0.36, 0.745, 0.28, 0.255, 90, -90, 12), [[0, 0.49]]), [[0.3, 0.49], [0.66, 0]]]],
      S: [0.64, [A(0.33, 0.75, 0.3, 0.25, 15, 270, 14).concat(A(0.33, 0.25, 0.32, 0.25, 90, -165, 14))]],
      T: [0.68, [[[0, 1], [0.68, 1]], [[0.34, 1], [0.34, 0]]]],
      U: [0.68, [[[0, 1], [0, 0.34]].concat(A(0.34, 0.34, 0.34, 0.34, 180, 360, 14), [[0.68, 1]])]],
      V: [0.72, [[[0, 1], [0.36, 0], [0.72, 1]]]],
      W: [0.96, [[[0, 1], [0.22, 0], [0.48, 0.7], [0.74, 0], [0.96, 1]]]],
      Y: [0.7, [[[0, 1], [0.35, 0.5], [0.7, 1]], [[0.35, 0.5], [0.35, 0]]]],
      '1': [0.38, [[[0.04, 0.8], [0.28, 1], [0.28, 0]]]],
      '3': [0.62, [A(0.3, 0.76, 0.3, 0.24, 155, -90, 12).concat(A(0.3, 0.27, 0.33, 0.27, 90, -155, 14))]],
      '7': [0.62, [[[0, 1], [0.62, 1], [0.18, 0]]]],
      ' ': [0.4, []]
    };
    return mech_FONT;
  }
  // a polyline with its corners rounded the way a glass bender does it
  function mech_fillet(pts, rad) {
    var out = [pts[0]], n = pts.length;
    for (var i = 1; i < n - 1; i++) {
      var p = pts[i], a = pts[i - 1], b = pts[i + 1];
      var la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      if (la < 1e-6 || lb < 1e-6) continue;
      var d = Math.min(rad, la * 0.45, lb * 0.45);
      var p0 = [p[0] + (a[0] - p[0]) * d / la, p[1] + (a[1] - p[1]) * d / la], p1 = [p[0] + (b[0] - p[0]) * d / lb, p[1] + (b[1] - p[1]) * d / lb];
      for (var k = 0; k <= 4; k++) { var t = k / 4, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]]); }
    }
    out.push(pts[n - 1]);
    return out;
  }
  function mech_tube(pts2, z, rad) {
    var v = [], last = null;
    pts2.forEach(function (p) { if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-4) { v.push(new THREE.Vector3(p[0], p[1], z)); last = p; } });
    if (v.length < 2) return null;
    var curve = new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0);
    var len = 0; for (var i = 1; i < v.length; i++) len += v[i].distanceTo(v[i - 1]);
    return new THREE.TubeBufferGeometry(curve, Math.min(600, Math.max(8, Math.ceil(len / (rad * 1.1)))), rad, 6, false);
  }
  // a word in neon: the tubes, and the dark sleeves where they turn back into the sign
  function mech_neonWord(text, h, rad, mat, sleeveM, backM) {
    var F = mech_font(), x = 0, geos = [], backs = [], ends = [], grp = new THREE.Group(), track = 0.2;
    for (var i = 0; i < text.length; i++) {
      var d = F[text[i]] || F[' '];
      d[1].forEach(function (stroke) {
        var pts = mech_fillet(stroke.map(function (p) { return [x + p[0] * h, p[1] * h]; }), h * 0.12);
        var tg = mech_tube(pts, 0, rad); if (tg) geos.push(tg);
        if (backM) { var bg = mech_tube(pts, 0, rad * 2.6); if (bg) backs.push(bg); }
        ends.push(pts[0], pts[pts.length - 1]);
      });
      x += (d[0] + track) * h;
    }
    var width = x - track * h;
    if (geos.length) { var m = new THREE.Mesh(mergeGeos(geos), mat); m.position.x = -width / 2; grp.add(m); }
    if (backs.length) { var bm = new THREE.Mesh(mergeGeos(backs), backM); bm.position.set(-width / 2, 0, -0.07); bm.scale.z = 0.2; grp.add(bm); }
    ends.forEach(function (p) { var s = mech_zcyl(rad * 1.25, 0.12, sleeveM, 8); s.position.set(p[0] - width / 2, p[1], -0.06); grp.add(s); });
    grp.userData.w = width;
    return grp;
  }
  function mech_neonMat(hex) {
    return new THREE.MeshStandardMaterial({ color: C(hex).lerp(C('#FFFFFF'), 0.18), roughness: 0.22, metalness: 0, emissive: C(hex), emissiveIntensity: 0.5 });
  }

  function mech_motel(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {}, i;
    var nameK = Tt['Name'] || 'THE 317 MOTEL', shapeK = Tt['Shape'] || 'Arrow', neonK = Tt['Neon'] || 'Pink and Blue';
    var lines = mech_MOTELS[nameK] || mech_MOTELS['THE 317 MOTEL'];
    var md = MATERIALS[matName] || MATERIALS['Blossom Blue'], hm = heroMat(matName);
    var cols = neonK === 'Green and Red' ? ['#39FF6E', '#FF3326', '#39FF6E', '#FF3326'] : neonK === 'Blossom Cyan' ? [BRAND.cyan, '#3D7BFF', BRAND.cyan, '#3D7BFF'] : ['#FF3FA4', '#3C86FF', '#3C86FF', '#FF3FA4'];
    var nA = mech_neonMat(cols[0]), nB = mech_neonMat(cols[1]), nV = mech_neonMat(cols[2]), nNo = mech_neonMat(cols[3]);
    var noLit = nNo.color.clone(), noDark = C('#34383E');
    var faceM = mtl(pick(r, ['#1B2A33', '#26192A', '#13262A', '#221D19', '#16213A']), 'paint', 0.5, 0.1, 1.0);
    var featHex = pick(r, ['#F2B33D', '#EFE6D2', '#E4572E', '#46B3C4', '#F4D35E']);
    if (featHex.toLowerCase() === md.color.toLowerCase()) featHex = '#EFE6D2';
    var featM = mtl(featHex, 'paint', 0.45, 0.1, 1.0), sleeveM = std('#121214', 0.5, 0.2);
    var poleM = mtl('#5D6167', 'paint', 0.55, 0.6, 1.2), boltM = std('#2A2C30', 0.4, 0.8);
    var PW = 7.2, PH = 2.5, yP = 5.95, yK = 8.35, RK = 1.22;

    // ---- the pole and its footing
    var foot = cyl(0.8, 0.9, 0.45, 24, mtl('#A7A197', 'concrete', 0.95, 0, 1.5)); foot.position.set(0, 0.225, -0.55); g.add(foot);
    var plate = cyl(0.42, 0.42, 0.05, 16, poleM); plate.position.set(0, 0.475, -0.55); g.add(plate);
    for (var b = 0; b < 6; b++) { var bt = cyl(0.03, 0.03, 0.1, 6, boltM); bt.position.set(Math.cos(b) * 0.34, 0.5, Math.sin(b) * 0.34 - 0.55); g.add(bt); }
    var pole = cyl(0.21, 0.24, yK + 0.4, 20, poleM); pole.position.set(0, (yK + 0.4) / 2, -0.55); g.add(pole);
    var ebox = mech_bbox(0.4, 0.55, 0.22, mtl('#7B8087', 'paint', 0.5, 0.5, 0.8), 0.02); ebox.position.set(0, 1.35, -0.2); g.add(ebox);
    var cond = cyl(0.025, 0.025, 1.0, 6, boltM); cond.position.set(0.1, 0.6, -0.28); g.add(cond);
    for (var s = 0; s < 9; s++) { var step = cyl(0.018, 0.018, 0.34, 6, boltM); step.rotation.z = Math.PI / 2; step.position.set((s % 2 ? 1 : -1) * 0.34, 1.9 + s * 0.3, -0.55); g.add(step); }
    // ---- the feature shape, outlined in bulbs
    var outline, t;
    if (shapeK === 'Star') {
      outline = [];
      for (i = 0; i < 10; i++) { var a = Math.PI / 2 + i / 10 * mech_TAU, rr = i % 2 ? 1.28 : 2.75; outline.push([Math.cos(a) * rr, yK + Math.sin(a) * rr]); }
    } else if (shapeK === 'Boomerang') {
      var cl = [];
      for (i = 0; i <= 24; i++) { t = i / 24; var x = -4.5 + 9.1 * t; cl.push([x, yK - 0.7 + 2.3 * Math.pow(Math.abs(x) / 4.5, 1.6) + (x > 0 ? 0.25 * x / 4.5 : 0)]); }
      var ob = mech_offsetLine(cl, function (sN) { return 0.36 + 0.42 * Math.sin(Math.PI * sN); });
      var dE = Math.atan2(cl[24][1] - cl[23][1], cl[24][0] - cl[23][0]) * R2D, dS = Math.atan2(cl[1][1] - cl[0][1], cl[1][0] - cl[0][0]) * R2D;
      outline = ob.L.concat(mech_arcPts(cl[24][0], cl[24][1], 0.36, 0.36, 90 + dE, -90 + dE, 8).slice(1, -1), ob.R.slice().reverse(), mech_arcPts(cl[0][0], cl[0][1], 0.36, 0.36, -90 + dS, -270 + dS, 8).slice(1, -1));
    } else {
      var ac = [[-4.7, yK + 1.05]], cxA = 2.9, cyA = yK - 0.5, rA = 1.55;
      for (i = 0; i <= 10; i++) { var aa = (90 - 90 * i / 10) * D2R; ac.push([cxA + rA * Math.cos(aa), cyA + rA * Math.sin(aa)]); }
      ac.push([cxA + rA, 4.2]);
      var oa = mech_offsetLine(ac, 0.46), end = ac[ac.length - 1], st0 = ac[0];
      outline = oa.L.concat([[end[0] + 1.0, end[1]], [end[0], end[1] - 1.25], [end[0] - 1.0, end[1]]], oa.R.slice().reverse(), [[st0[0] + 0.4, st0[1]]]);
    }
    var fs = new THREE.Shape(outline.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
    var feat = new THREE.Mesh(mech_extrude(fs, 0.36, 0.04, 8), featM); feat.position.z = -0.12; g.add(feat);
    // ---- the name panel
    var panel = new THREE.Mesh(mech_extrude(mech_rrect(PW, PH, 0.4), 0.5, 0.06, 10), hm); panel.position.y = yP; g.add(panel);
    var face = new THREE.Mesh(mech_extrude(mech_rrect(PW - 0.42, PH - 0.42, 0.26), 0.03, 0, 10), faceM); face.position.set(0, yP, 0.3); g.add(face);
    var h1 = Math.min(0.95, (PW - 1.0) / (lines[0].length * 0.86)), h2 = Math.min(0.62, (PW - 1.4) / (lines[1].length * 0.86));
    var w1 = mech_neonWord(lines[0], h1, 0.042, nA, sleeveM, mtl(C(cols[0]).convertLinearToSRGB().multiplyScalar(0.55).getStyle(), 'paint', 0.5, 0.1, 1)); w1.position.set(0, yP + 0.9 - h1, 0.38); g.add(w1);
    w1.scale.x = Math.min(1, (PW - 0.9) / w1.userData.w);
    var w2 = mech_neonWord(lines[1], h2, 0.036, nB, sleeveM, mtl(C(cols[1]).convertLinearToSRGB().multiplyScalar(0.55).getStyle(), 'paint', 0.5, 0.1, 1)); w2.position.set(0, yP - 0.96, 0.38); g.add(w2);
    w2.scale.x = Math.min(1, (PW - 1.2) / w2.userData.w);
    // ---- bulbs: round the feature and round the panel, three circuits that chase
    var bulbPos = [], inPanel = function (p) { return Math.abs(p[0]) < PW / 2 + 0.05 && Math.abs(p[1] - yP) < PH / 2 + 0.05; };
    var inClock = function (p) { return Math.hypot(p[0], p[1] - yK) < RK + 0.25; };
    mech_alongOutline(outline, 0.3, 0.2).forEach(function (p) { if (!inPanel(p) && !inClock(p)) bulbPos.push([p[0], p[1], 0.13]); });
    var pr = []; mech_rrect(PW - 0.2, PH - 0.2, 0.3).getPoints(6).forEach(function (v) { pr.push([v.x, v.y + yP]); });
    mech_alongOutline(pr, 0.3, 0).forEach(function (p) { bulbPos.push([p[0], p[1], 0.33]); });
    var bulbGeo = new THREE.SphereBufferGeometry(0.07, 10, 8), sockGeo = new THREE.CylinderBufferGeometry(0.055, 0.055, 0.08, 8); sockGeo.rotateX(Math.PI / 2);
    var bulbMats = [0, 1, 2].map(function () { return new THREE.MeshStandardMaterial({ color: C('#FFF1CF'), roughness: 0.2, emissive: C('#FFC266'), emissiveIntensity: 0.8 }); });
    var sockets = new THREE.InstancedMesh(sockGeo, std('#C9CCD0', 0.35, 0.9), bulbPos.length), m4 = new THREE.Matrix4();
    var bulbs = bulbMats.map(function (m, k) { return new THREE.InstancedMesh(bulbGeo, m, Math.max(1, Math.ceil((bulbPos.length - k) / 3))); });
    var cnt = [0, 0, 0];
    bulbPos.forEach(function (p, j) {
      m4.makeTranslation(p[0], p[1], p[2]); sockets.setMatrixAt(j, m4);
      m4.makeTranslation(p[0], p[1], p[2] + 0.07); bulbs[j % 3].setMatrixAt(cnt[j % 3]++, m4);
    });
    bulbs.forEach(function (bm, k) { bm.count = cnt[k]; g.add(bm); }); g.add(sockets);
    // ---- the clock
    var drum = cyl(RK + 0.1, RK + 0.1, 0.5, 64, hm); drum.rotation.x = Math.PI / 2; drum.position.set(0, yK, 0.25); g.add(drum);
    var bez = new THREE.Mesh(new THREE.TorusBufferGeometry(RK + 0.06, 0.07, 12, 72), mtl('#D9DCE0', 'brushed', 0.22, 1, 0.4)); bez.position.set(0, yK, 0.52); g.add(bez);
    var ckTex = canvasTex(1024, 1024, function (gc, S) {
      var cx = S / 2, k = S / 2 / RK;
      var gr = gc.createRadialGradient(cx, cx, 20, cx, cx, S / 2); gr.addColorStop(0, '#FFF8E6'); gr.addColorStop(1, '#EBDDBC');
      gc.fillStyle = gr; gc.fillRect(0, 0, S, S);
      gc.fillStyle = '#16171A';
      for (var m = 0; m < 60; m++) { gc.save(); gc.translate(cx, cx); gc.rotate(m / 60 * mech_TAU); if (m % 5) gc.fillRect(-3, -0.95 * RK * k, 6, 18); else gc.fillRect(-9, -0.95 * RK * k, 18, 50); gc.restore(); }
      gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '700 128px ' + FONT_SANS;
      for (var hr = 1; hr <= 12; hr++) { var a2 = hr / 12 * mech_TAU; gc.fillText(String(hr), cx + Math.sin(a2) * 0.68 * RK * k, cx - Math.cos(a2) * 0.68 * RK * k + 6); }
      gc.font = '700 40px ' + FONT_MONO; gc.fillStyle = '#B0302A'; gc.fillText('MARFA TIME', cx, cx + 0.34 * RK * k);
    });
    var ckM = new THREE.MeshStandardMaterial({ map: ckTex, roughness: 0.3, emissive: C('#FFF1D2'), emissiveMap: ckTex, emissiveIntensity: 0 }); W.glow(ckM, 0.06, 1.15);
    var ck = new THREE.Mesh(new THREE.CircleBufferGeometry(RK, 96), ckM); ck.position.set(0, yK, 0.505); g.add(ck);
    var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(RK + 0.26, 0.042, 8, 120), nB); ring.position.set(0, yK, 0.5); g.add(ring);
    for (i = 0; i < 8; i++) { var so = mech_zcyl(0.02, 0.2, sleeveM, 6), a3 = i / 8 * mech_TAU; so.position.set(Math.cos(a3) * (RK + 0.26), yK + Math.sin(a3) * (RK + 0.26), 0.4); g.add(so); }
    var handM = std('#141518', 0.35, 0.5);
    var hH = mech_hand({ style: 'arrow', L: 0.72, w: 0.075, tail: 0.14, th: 0.02, head: 0.13 }, handM); hH.position.set(0, yK, 0.53); g.add(hH);
    var hM = mech_hand({ style: 'arrow', L: 1.04, w: 0.055, tail: 0.18, th: 0.02, head: 0.1 }, handM); hM.position.set(0, yK, 0.555); g.add(hM);
    var hS = mech_hand({ style: 'baton', L: 1.08, w: 0.018, tail: 0.28, th: 0.01, disc: 0.05 }, std('#C8261E', 0.4, 0.2)); hS.position.set(0, yK, 0.575); g.add(hS);
    var cap = mech_dome(0.07, handM); cap.position.set(0, yK, 0.59); g.add(cap);
    // ---- VACANCY
    var yV = 3.72, vp = new THREE.Mesh(mech_extrude(mech_rrect(4.4, 0.95, 0.18), 0.24, 0.03, 8), hm); vp.position.set(0, yV, 0.05); g.add(vp);
    var vf = new THREE.Mesh(mech_extrude(mech_rrect(4.15, 0.72, 0.12), 0.02, 0, 8), mtl('#15181C', 'paint', 0.5, 0.1, 1)); vf.position.set(0, yV, 0.18); g.add(vf);
    [-1.5, 1.5].forEach(function (x) { var hg = cyl(0.03, 0.03, yP - PH / 2 - yV - 0.4, 6, boltM); hg.position.set(x, (yP - PH / 2 + yV + 0.45) / 2, 0.05); g.add(hg); });
    var no = mech_neonWord('NO', 0.42, 0.03, nNo, sleeveM), vac = mech_neonWord('VACANCY', 0.42, 0.03, nV, sleeveM);
    var tot = no.userData.w + 0.3 + vac.userData.w;
    no.position.set(-tot / 2 + no.userData.w / 2, yV - 0.21, 0.26); vac.position.set(tot / 2 - vac.userData.w / 2, yV - 0.21, 0.26); g.add(no); g.add(vac);
    [yP - 0.6, yP + 0.6, yK].forEach(function (y) { var br = box(0.16, 0.16, 0.5, poleM); br.position.set(0, y, -0.4); g.add(br); });
    mech_lamp(W, g, cols[0], 1.8, 16, new THREE.Vector3(0, yP, 2.6)); mech_lamp(W, g, '#FFCF8A', 1.2, 14, new THREE.Vector3(0, yK + 1.2, 1.8));
    shade(g);
    bulbs.forEach(function (bm) { bm.castShadow = false; });
    var steady = [nA, nB, nV];
    return {
      group: g, R: 5.2, lookY: 5.6, dist: rf(r, 19, 22), camH: [1.6, 2.6], face: true, close: { zoom: 0.45, el: 0.05, look: yK - 5.6 - 0.8 },
      update: function (ctx) {
        var t2 = ctx.t, base = lerp(0.32, 3.3, ctx.night), sec = t2.sec % 43200;
        hH.rotation.z = -sec / 43200 * mech_TAU; hM.rotation.z = -(sec % 3600) / 3600 * mech_TAU; hS.rotation.z = -(t2.sec % 60) / 60 * mech_TAU;
        var q = Math.floor(ctx.real * 12), flick = hash2(q, 7, 317) < 0.04 ? 0.12 : 1;
        steady.forEach(function (m, k) { m.emissiveIntensity = base * (k === 2 && hash2(q, 11, 90) < 0.015 ? 0.2 : 1); });
        var full = t2.hours >= 22 || t2.hours < 7;
        nNo.emissiveIntensity = full ? base * flick : 0;
        nNo.color.copy(full ? noLit : noDark);
        var stp = Math.floor(ctx.real * 5) % 3, on = lerp(0.9, 3.0, ctx.night), off = lerp(0.06, 0.12, ctx.night);
        bulbMats.forEach(function (m, k) { m.emissiveIntensity = k === stp ? on : off; });
      }
    };
  }

  // =====================================================================
  // 4. WATER TOWER CLOCK
  // A rural steel tower on battered legs with rod bracing, a catwalk, a
  // ladder, an overflow pipe, and a clock on the tank. MARFA is painted
  // round it. A beacon blinks at night and the anemometer turns in the wind.
  // =====================================================================
  function mech_water(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {}, tankK = Tt['Tank'] || 'Cylinder', paintK = Tt['Paint'] || 'Silver';
    var steel = heroMat(matName);
    var paint = { 'Silver': ['#BFC4C9', 0.45, 0.6, '#1D2836'], 'Sky Blue': ['#86BCE2', 0.55, 0.15, '#FFFFFF'], 'Cherokee Red': ['#8E3D2D', 0.7, 0.1, '#F2E7D3'] }[paintK] || ['#BFC4C9', 0.45, 0.6, '#1D2836'];
    var nLeg = r() < 0.55 ? 4 : 6, yA = 10.4, darkM = std('#1A1B1E', 0.45, 0.6);
    var concM = mtl('#A9A398', 'concrete', 0.95, 0, 1.6), rodM = mtl('#3E4146', 'rust', 0.6, 0.6, 0.8);
    // ---- the tank profile, bottom to top, then resampled by arc length
    var prof = [], i, a, R0, yClock, yText, yCat, yTop;
    if (tankK === 'Cylinder') {
      R0 = 4.3;
      for (i = 0; i <= 16; i++) { a = -Math.PI / 2 + i / 16 * Math.PI / 2; prof.push([R0 * Math.cos(a), yA + 1.6 * Math.sin(a)]); }
      for (i = 1; i <= 16; i++) prof.push([R0, yA + i / 16 * 6.4]);
      yCat = yA; yTop = yA + 6.4; yClock = yA + 4.4; yText = yA + 1.95;
    } else if (tankK === 'Pumpkin') {
      R0 = 5.1;
      for (i = 0; i <= 48; i++) { a = -Math.PI / 2 + i / 48 * Math.PI; prof.push([R0 * Math.pow(Math.max(Math.cos(a), 0), 0.72), yA + 0.3 + (a < 0 ? 3.1 : 3.2) * Math.sin(a)]); }
      yCat = yA + 0.3; yTop = yA + 3.5; yClock = yA - 1.05; yText = yA + 1.8;
    } else {
      R0 = 4.8;
      for (i = 0; i <= 48; i++) { a = -Math.PI / 2 + i / 48 * Math.PI; prof.push([R0 * Math.cos(a), yA + 3.9 * Math.sin(a)]); }
      yCat = yA; yTop = yA + 3.9; yClock = yA - 1.35; yText = yA + 2.0;
    }
    var dense = [], acc = [0], k;
    for (i = 0; i < prof.length - 1; i++) for (k = 0; k < 8; k++) { var f0 = k / 8; dense.push([lerp(prof[i][0], prof[i + 1][0], f0), lerp(prof[i][1], prof[i + 1][1], f0)]); }
    dense.push(prof[prof.length - 1]);
    for (i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    var PLEN = acc[acc.length - 1], NP = 72, pts = [];
    var atS = function (s) { var j = 1; while (j < acc.length - 1 && acc[j] < s) j++; var f = (s - acc[j - 1]) / (acc[j] - acc[j - 1] || 1); return [lerp(dense[j - 1][0], dense[j][0], f), lerp(dense[j - 1][1], dense[j][1], f)]; };
    var sAtY = function (y) { for (var j = 1; j < dense.length; j++) if (dense[j][1] >= y) { var f = (y - dense[j - 1][1]) / (dense[j][1] - dense[j - 1][1] || 1); return acc[j - 1] + f * (acc[j] - acc[j - 1]); } return PLEN; };
    var rAtY = function (y) { return atS(sAtY(y))[0]; };
    for (i = 0; i <= NP; i++) { var q = atS(i / NP * PLEN); pts.push(new THREE.Vector2(Math.max(q[0], 0.001), q[1])); }
    // ---- paint, seams, rivets, rust and the name
    var Rt = rAtY(yText), circ = mech_TAU * Rt, TWp = 2048, THp = 1024, kx = (TWp / circ) / (THp / PLEN);
    var tex = canvasTex(TWp, THp, function (gc) {
      var rng = seedRng(W.P.seed + 77), y, x, j;
      gc.fillStyle = paint[0]; gc.fillRect(0, 0, TWp, THp);
      var gr = gc.createLinearGradient(0, 0, 0, THp); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); gc.fillStyle = gr; gc.fillRect(0, 0, TWp, THp);
      var rows = Math.round(PLEN / 1.5), ph = THp / rows;
      for (j = 1; j < rows; j++) {
        y = j * ph; gc.fillStyle = 'rgba(0,0,0,0.16)'; gc.fillRect(0, y - 1.5, TWp, 3);
        for (x = 0; x < TWp; x += 9) { gc.fillStyle = 'rgba(0,0,0,0.22)'; gc.fillRect(x, y - 6, 3, 3); gc.fillRect(x + 4, y + 4, 3, 3); }
      }
      for (j = 0; j < rows; j++) for (var c2 = 0; c2 < 12; c2++) { x = (c2 + (j % 2) * 0.5) / 12 * TWp; gc.fillStyle = 'rgba(0,0,0,0.14)'; gc.fillRect(x - 1, j * ph, 2, ph); }
      var vy = function (yy) { return (1 - sAtY(yy) / PLEN) * THp; };
      var hPx = 1.55 * THp / PLEN;
      gc.fillStyle = paint[3]; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      var word = function (txt, u, px, spacing) {
        [0, TWp].forEach(function (off) {
          gc.save(); gc.translate(u * TWp + off, vy(yText)); gc.scale(kx, 1); gc.font = '900 ' + px + 'px ' + FONT_SANS;
          var tw = 0, ws = [], n; for (n = 0; n < txt.length; n++) { ws.push(gc.measureText(txt[n]).width); tw += ws[n] + (n < txt.length - 1 ? spacing * px : 0); }
          var xx = -tw / 2; for (n = 0; n < txt.length; n++) { gc.fillText(txt[n], xx + ws[n] / 2, 0); xx += ws[n] + spacing * px; }
          gc.restore();
        });
      };
      word('MARFA', 0, hPx * 1.3, 0.12);
      word('TEXAS', 0.5, hPx * 1.1, 0.12);
      word('EST 1883', 0.25, hPx * 0.55, 0.08); word('PRESIDIO COUNTY', 0.75, hPx * 0.5, 0.06);
      // rust runs down from the seams, over the paint and the letters
      for (j = 0; j < 90; j++) {
        x = rng() * TWp; y = (1 + Math.floor(rng() * (rows - 1))) * ph; var len = 30 + rng() * 190, w = 2 + rng() * 5;
        var sg = gc.createLinearGradient(0, y, 0, y + len); sg.addColorStop(0, 'rgba(112,50,20,' + (0.25 + rng() * 0.4) + ')'); sg.addColorStop(1, 'rgba(112,50,20,0)');
        gc.fillStyle = sg; gc.fillRect(x, y, w, len);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    var tankM = detail(new THREE.MeshStandardMaterial({ map: tex, roughness: paint[1], metalness: paint[2] }), 'rust', { tile: 1.4, albedo: 0.3, bump: 0.2 });
    var shellGeo = new THREE.LatheBufferGeometry(pts, 96);
    if (tankK === 'Pumpkin') {
      var pa = shellGeo.attributes.position;
      for (i = 0; i < pa.count; i++) { var px = pa.getX(i), pz = pa.getZ(i), f = 1 + 0.035 * Math.cos(16 * Math.atan2(px, pz)); pa.setX(i, px * f); pa.setZ(i, pz * f); }
      shellGeo.computeVertexNormals();
    }
    g.add(new THREE.Mesh(shellGeo, tankM));
    var roofM = mtl(paint[0], 'rust', paint[1], paint[2], 1.2);
    if (tankK === 'Cylinder') {
      var rp = [[R0 + 0.18, yTop - 0.02], [R0 + 0.18, yTop + 0.08], [R0 * 0.7, yTop + 0.75], [R0 * 0.35, yTop + 1.45], [0.35, yTop + 1.9], [0.001, yTop + 1.95]];
      g.add(new THREE.Mesh(new THREE.LatheBufferGeometry(rp.map(function (q2) { return new THREE.Vector2(q2[0], q2[1]); }), 96), roofM));
      var lip = new THREE.Mesh(new THREE.TorusBufferGeometry(R0 + 0.04, 0.06, 6, 96), steel); lip.rotation.x = Math.PI / 2; lip.position.y = yTop; g.add(lip);
      yTop += 1.95;
    }
    // ---- legs, struts and rod bracing
    var Rtop = (tankK === 'Cylinder' ? R0 * 0.94 : R0 + 0.05), Rbot = Rtop + 1.5, legTop = yCat, legs = [];
    for (i = 0; i < nLeg; i++) {
      a = (i + 0.5) / nLeg * mech_TAU;
      var pb = new THREE.Vector3(Math.sin(a) * Rbot, 0.55, Math.cos(a) * Rbot), pt = new THREE.Vector3(Math.sin(a) * Rtop, legTop, Math.cos(a) * Rtop);
      legs.push([pb, pt]);
      g.add(mech_rod(pb, pt, 0.19, steel, 12));
      var pier = cyl(0.5, 0.6, 0.6, 12, concM); pier.position.set(pb.x, 0.3, pb.z); g.add(pier);
      var bp = box(0.62, 0.05, 0.62, steel); bp.position.set(pb.x, 0.62, pb.z); bp.rotation.y = a; g.add(bp);
      var lcap = cyl(0.26, 0.26, 0.3, 12, steel); lcap.position.copy(pt); lcap.position.y -= 0.1; g.add(lcap);
    }
    var legAt = function (li, y) { var L = legs[li % nLeg], f = (y - L[0].y) / (L[1].y - L[0].y); return L[0].clone().lerp(L[1], f); };
    var tiers = [0.16, 0.42, 0.68, 0.93].map(function (f) { return 0.55 + (legTop - 0.55) * f; });
    for (i = 0; i < nLeg; i++) {
      for (var ti = 1; ti < tiers.length; ti++) g.add(mech_rod(legAt(i, tiers[ti]), legAt(i + 1, tiers[ti]), 0.075, steel, 8));
      for (ti = 0; ti < tiers.length - 1; ti++) {
        [[legAt(i, tiers[ti]), legAt(i + 1, tiers[ti + 1])], [legAt(i + 1, tiers[ti]), legAt(i, tiers[ti + 1])]].forEach(function (q2) {
          g.add(mech_rod(q2[0], q2[1], 0.028, rodM, 6));
          g.add(mech_rod(q2[0].clone().lerp(q2[1], 0.46), q2[0].clone().lerp(q2[1], 0.54), 0.05, darkM, 8));
        });
      }
    }
    var botY = pts[0].y;
    var riser = cyl(0.45, 0.45, botY + 0.2, 20, steel); riser.position.y = (botY + 0.2) / 2; g.add(riser);
    for (var fy = 1.2; fy < botY; fy += 2.4) { var fl = cyl(0.55, 0.55, 0.12, 20, steel); fl.position.y = fy; g.add(fl); }
    var vault = mech_bbox(1.8, 0.7, 1.8, concM, 0.04); vault.position.y = 0.35; g.add(vault);
    // ---- catwalk and railing
    var rIn = rAtY(yCat) + 0.02, rOut = rIn + 0.95;
    var deck = new THREE.Mesh(new THREE.RingBufferGeometry(rIn, rOut, 96, 1), mtl('#5F6368', 'brushed', 0.6, 0.7, 0.4)); deck.rotation.x = -Math.PI / 2; deck.position.y = yCat; deck.material.side = THREE.DoubleSide; g.add(deck);
    var bandM = heroMat(matName); bandM.side = THREE.DoubleSide;
    var band = new THREE.Mesh(new THREE.CylinderBufferGeometry(rOut, rOut, 0.14, 96, 1, true), bandM); band.position.y = yCat - 0.05; g.add(band);
    var nPost = Math.round(mech_TAU * rOut / 1.3);
    for (i = 0; i < nPost; i++) { a = i / nPost * mech_TAU; var po = box(0.05, 1.1, 0.05, steel); po.position.set(Math.sin(a) * (rOut - 0.04), yCat + 0.55, Math.cos(a) * (rOut - 0.04)); g.add(po); }
    [0.55, 1.1].forEach(function (h) { var rl = new THREE.Mesh(new THREE.TorusBufferGeometry(rOut - 0.04, 0.03, 6, 128), steel); rl.rotation.x = Math.PI / 2; rl.position.y = yCat + h; g.add(rl); });
    for (i = 0; i < nLeg * 2; i++) { a = i / (nLeg * 2) * mech_TAU; g.add(mech_rod(new THREE.Vector3(Math.sin(a) * rIn, yCat - 0.02, Math.cos(a) * rIn), new THREE.Vector3(Math.sin(a) * rOut, yCat - 0.02, Math.cos(a) * rOut), 0.05, steel, 6)); }
    // ---- ladders: up a leg to the catwalk, then up the tank
    var aL = 0.5 / nLeg * mech_TAU, lp0 = legs[0][0].clone(), lp1 = legs[0][1].clone(), outv = new THREE.Vector3(Math.sin(aL), 0, Math.cos(aL)), side = new THREE.Vector3(Math.cos(aL), 0, -Math.sin(aL));
    lp0.addScaledVector(outv, 0.42); lp1.addScaledVector(outv, 0.42); lp0.y = 0.6; lp1.y = yCat - 0.1;
    [-0.24, 0.24].forEach(function (sd) { g.add(mech_rod(lp0.clone().addScaledVector(side, sd), lp1.clone().addScaledVector(side, sd), 0.025, steel, 6)); });
    var nR = Math.floor(lp0.distanceTo(lp1) / 0.32);
    for (i = 1; i < nR; i++) { var pp = lp0.clone().lerp(lp1, i / nR); g.add(mech_rod(pp.clone().addScaledVector(side, -0.24), pp.clone().addScaledVector(side, 0.24), 0.014, steel, 5)); }
    var tl = [], s0 = sAtY(yCat + 0.2), s1 = sAtY(yTop - (tankK === 'Cylinder' ? 1.95 : 0.4));
    for (i = 0; i <= 20; i++) tl.push(atS(lerp(s0, s1, i / 20)));
    [-0.22, 0.22].forEach(function (sd) {
      var v = tl.map(function (q2) { var rr2 = q2[0] + 0.22; return new THREE.Vector3(Math.sin(aL) * rr2, q2[1], Math.cos(aL) * rr2).addScaledVector(side, sd); });
      g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(v), 48, 0.022, 5, false), steel));
    });
    for (i = 1; i < 20; i++) { var q3 = tl[i], rr3 = q3[0] + 0.22, c3 = new THREE.Vector3(Math.sin(aL) * rr3, q3[1], Math.cos(aL) * rr3); g.add(mech_rod(c3.clone().addScaledVector(side, -0.22), c3.clone().addScaledVector(side, 0.22), 0.013, steel, 5)); }
    // ---- overflow pipe down the side and the leg to a splash block
    var aO = -1.25, ov = [];
    for (i = 0; i <= 10; i++) { var q4 = atS(lerp(sAtY(yTop - (tankK === 'Cylinder' ? 2.2 : 0.8)), sAtY(yCat + 0.15), i / 10)), rr4 = q4[0] + 0.28; ov.push(new THREE.Vector3(Math.sin(aO) * rr4, q4[1], Math.cos(aO) * rr4)); }
    var rO = rOut + 0.25;
    ov.push(new THREE.Vector3(Math.sin(aO) * rO, yCat - 0.4, Math.cos(aO) * rO), new THREE.Vector3(Math.sin(aO) * rO, yCat - 1.0, Math.cos(aO) * rO));
    ov.push(new THREE.Vector3(Math.sin(aO) * (Rbot + 0.6), 1.5, Math.cos(aO) * (Rbot + 0.6)), new THREE.Vector3(Math.sin(aO) * (Rbot + 0.6), 0.55, Math.cos(aO) * (Rbot + 0.6)), new THREE.Vector3(Math.sin(aO) * (Rbot + 1.0), 0.4, Math.cos(aO) * (Rbot + 1.0)));
    g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(ov, false, 'centripetal'), 120, 0.1, 8, false), steel));
    var splash = box(0.8, 0.12, 1.1, concM); splash.position.set(Math.sin(aO) * (Rbot + 1.25), 0.06, Math.cos(aO) * (Rbot + 1.25)); splash.rotation.y = aO; g.add(splash);
    // ---- the clock, tangent to the tank on the front meridian
    var RC = tankK === 'Cylinder' ? 1.6 : 1.45, sC = sAtY(yClock), p0 = atS(sC), p1 = atS(sC - 0.05), p2 = atS(sC + 0.05);
    var tx = p2[0] - p1[0], ty = p2[1] - p1[1], tl2 = Math.hypot(tx, ty), nrm = [ty / tl2, -tx / tl2];
    var tilt = Math.atan2(nrm[1], nrm[0]), stand = tankK === 'Pumpkin' ? 0.45 : 0.3;
    var cg = new THREE.Group(); cg.position.set(0, p0[1] + nrm[1] * stand, p0[0] + nrm[0] * stand); cg.rotation.x = -tilt; g.add(cg); g.updateMatrixWorld(true);
    var drum = cyl(RC + 0.08, RC + 0.1, 0.3, 64, steel); drum.rotation.x = Math.PI / 2; drum.position.z = -0.12; cg.add(drum);
    var fcTex = canvasTex(1024, 1024, function (gc, S) {
      var cx = S / 2, kk = S / 2 / RC;
      gc.fillStyle = '#F4F1E8'; gc.fillRect(0, 0, S, S);
      gc.fillStyle = '#121316';
      for (var m = 0; m < 60; m++) { gc.save(); gc.translate(cx, cx); gc.rotate(m / 60 * mech_TAU); if (m % 5) gc.fillRect(-3, -0.95 * RC * kk, 6, 20); else gc.fillRect(-10, -0.95 * RC * kk, 20, 60); gc.restore(); }
      gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '800 140px ' + FONT_SANS;
      for (var hr = 1; hr <= 12; hr++) { var aa = hr / 12 * mech_TAU; gc.fillText(String(hr), cx + Math.sin(aa) * 0.68 * RC * kk, cx - Math.cos(aa) * 0.68 * RC * kk + 8); }
    });
    var fcM = new THREE.MeshStandardMaterial({ map: fcTex, roughness: 0.35, emissive: C('#FFF4DE'), emissiveMap: fcTex, emissiveIntensity: 0 }); W.glow(fcM, 0.04, 0.32);
    var fc = new THREE.Mesh(new THREE.CircleBufferGeometry(RC, 96), fcM); fc.position.z = 0.035; cg.add(fc);
    var bz = new THREE.Mesh(new THREE.TorusBufferGeometry(RC + 0.05, 0.08, 12, 96), steel); bz.position.z = 0.04; cg.add(bz);
    var handM = std('#131417', 0.4, 0.5);
    var hh = mech_hand({ style: 'spade', L: RC * 0.58, w: 0.09, tail: 0.2, th: 0.03, spade: 0.1 }, handM); hh.position.z = 0.07; cg.add(hh);
    var hm2 = mech_hand({ style: 'spade', L: RC * 0.86, w: 0.065, tail: 0.28, th: 0.03, spade: 0.075 }, handM); hm2.position.z = 0.11; cg.add(hm2);
    var hub = mech_dome(0.09, handM); hub.position.z = 0.13; cg.add(hub);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (q5) { var stn = mech_zcyl(0.05, stand + 0.2, steel, 8); stn.position.set(q5[0] * RC * 0.6, q5[1] * RC * 0.6, -stand / 2 - 0.12); cg.add(stn); });
    // ---- two floodlights on brackets either side of the face, for the night
    var bulbM = W.glow(glowMat('#FFE6B8', 0.2), 0.12, 2.4);
    [-1, 1].forEach(function (sd) {
      var fx = new THREE.Group(); fx.position.set(sd * (RC + 0.42), RC * 0.62, 0.5); cg.add(fx);
      fx.lookAt(cg.localToWorld(new THREE.Vector3(0, 0, 0)));
      var hsg = mech_bbox(0.3, 0.22, 0.3, darkM, 0.02); fx.add(hsg);
      var lens = new THREE.Mesh(new THREE.CircleBufferGeometry(0.1, 16), bulbM); lens.position.z = 0.152; fx.add(lens);
      cg.add(mech_rod(new THREE.Vector3(sd * (RC + 0.42), RC * 0.62, 0.36), new THREE.Vector3(sd * (RC + 0.42), RC * 0.62, -stand - 0.1), 0.035, darkM, 6));
    });
    mech_lamp(W, cg, '#FFE2B0', 0.95, 7, new THREE.Vector3(0, 0.4, 2.0));
    // ---- the top: vent, beacon and anemometer
    var vent = cyl(0.25, 0.3, 0.4, 12, steel); vent.position.y = yTop + 0.18; g.add(vent);
    var vcap = cyl(0.45, 0.2, 0.18, 12, steel); vcap.position.y = yTop + 0.47; g.add(vcap);
    var mast = cyl(0.03, 0.03, 1.6, 6, darkM); mast.position.y = yTop + 1.3; g.add(mast);
    var beaconM = new THREE.MeshStandardMaterial({ color: C('#FF3B2A'), roughness: 0.2, emissive: C('#FF2A1A'), emissiveIntensity: 0.2 });
    var beacon = sph(0.11, beaconM, 12, 8); beacon.position.y = yTop + 2.15; g.add(beacon);
    var anemo = new THREE.Group(); anemo.position.y = yTop + 1.85; g.add(anemo);
    var cupM = std('#1A1B1E', 0.45, 0.6); cupM.side = THREE.DoubleSide;
    for (i = 0; i < 3; i++) {
      a = i / 3 * mech_TAU; var arm = box(0.42, 0.02, 0.02, darkM); arm.position.set(Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21); arm.rotation.y = -a; anemo.add(arm);
      var cup = new THREE.Mesh(new THREE.SphereBufferGeometry(0.07, 10, 6, 0, mech_TAU, 0, Math.PI / 2), cupM);
      cup.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); cup.rotation.set(0, -a, Math.PI / 2); anemo.add(cup);
    }
    mech_lamp(W, g, '#FF3B2A', 0.8, 8, new THREE.Vector3(0, yTop + 2.15, 0));
    // ---- birds on the rail
    var birds = [], nb = ri(r, 2, 5), birdM = std('#2B2724', 0.8, 0), beakM = std('#C08A3A', 0.6, 0);
    for (i = 0; i < nb; i++) {
      a = rf(r, -0.9, 0.9); if (Math.abs(a) < 0.25) a += a < 0 ? -0.3 : 0.3;
      var bd = new THREE.Group(); bd.position.set(Math.sin(a) * (rOut - 0.04), yCat + 1.13, Math.cos(a) * (rOut - 0.04)); bd.rotation.y = a + (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      var bb = sph(0.075, birdM, 10, 8); bb.scale.set(0.8, 0.85, 1.35); bb.position.y = 0.07; bd.add(bb);
      var hd = new THREE.Group(); hd.position.set(0, 0.15, 0.08); bd.add(hd);
      hd.add(sph(0.045, birdM, 8, 6)); var bk = new THREE.Mesh(new THREE.ConeBufferGeometry(0.014, 0.05, 5), beakM); bk.rotation.x = Math.PI / 2; bk.position.z = 0.055; hd.add(bk);
      var btail = box(0.05, 0.015, 0.12, birdM); btail.position.set(0, 0.06, -0.13); btail.rotation.x = -0.3; bd.add(btail);
      g.add(bd); birds.push({ hd: hd, ph: r() * 10, sp: rf(r, 0.6, 1.6) });
    }
    mech_mergeStatic(g);
    shade(g);
    var cHeight = cg.position.y, lookY = tankK === 'Cylinder' ? 10.4 : 9.2;
    return {
      group: g, R: Rbot + 1.2, lookY: lookY, dist: tankK === 'Cylinder' ? rf(r, 31, 34) : rf(r, 27, 31), camH: [1.6, 2.6], face: true, shadowPad: 9,
      close: { zoom: 0.4, el: 0.12, look: cHeight - lookY },
      tank: { kind: tankK, legs: nLeg, clockY: cHeight },
      update: function (ctx) {
        var t = ctx.t, sec = t.sec % 43200;
        hh.rotation.z = -sec / 43200 * mech_TAU; hm2.rotation.z = -(sec % 3600) / 3600 * mech_TAU;
        anemo.rotation.y -= ctx.dt * (1.5 + (ctx.wind || 1) * 4.5);
        var blink = (Math.floor(ctx.real * 0.8) % 2 === 0) || ctx.snap;
        beaconM.emissiveIntensity = lerp(0.25, blink ? 3.2 : 0.15, ctx.night);
        birds.forEach(function (b, j) {
          var tt = ctx.real * b.sp + b.ph, asleep = ctx.night > 0.8;
          b.hd.rotation.x = asleep ? 0.6 : Math.max(0, Math.sin(tt * 2.1)) * 0.5 * (Math.sin(tt * 0.37) > 0.3 ? 1 : 0);
          b.hd.rotation.y = asleep ? 1.8 : Math.sin(tt * 0.23 + j) * 0.9;
        });
      }
    };
  }

  // ------------------------------------------------------------ register
  defineClock('Skeleton Clock', { w: 8, keeps: 'Gears', build: mech_skeleton,
    mats: ['Ink Black', 'Mill Aluminum', 'Weathering Steel', 'Patinated Copper', 'Bone White', 'Blossom Blue', 'Brass'],
    line: 'An open movement the size of a room. The escape wheel steps once a second, the pendulum beats seconds on a 0.994 m rod, and every wheel turns at the ratio its teeth imply.',
    traits: function (r) { return { 'Escapement': pick(r, ['Anchor', 'Grasshopper', 'Gravity']), 'Train': pick(r, ['Brass', 'Blued Steel', 'Rust']), 'Dial': pick(r, ['Roman', 'Arabic', 'Blossom']) }; } });
  defineClock('Astronomical Clock', { w: 8, keeps: 'Sky', build: mech_astro,
    mats: ['Brass', 'Patinated Copper', 'Ink Black', 'Weathering Steel', 'Obsidian'],
    line: 'After the orloj in Prague, drawn for latitude 30.3. The sun hand points at the sun, the zodiac turns with the stars, the moon shows its phase, and Death rings the hour.',
    traits: function (r) { return { 'Tower': pick(r, ['Gothic Stone', 'Adobe', 'Concrete Brutalist']), 'Sky Disc': pick(r, ['Enamel', 'Gold Leaf', 'Night Blue']) }; } });
  defineClock('Motel Sign', { w: 8, keeps: 'Neon', build: mech_motel,
    mats: ['Blossom Blue', 'Cherokee Red', 'Bone White', 'Ink Black', 'Mill Aluminum', 'Terrazzo'],
    line: 'A roadside sign on US 90 for a motel that is not there. The bulbs chase, the neon hums, and after ten the NO lights up.',
    traits: function (r) { return { 'Name': pick(r, ['THE 317 MOTEL', 'LAST LIGHT MOTOR INN', 'MOONRISE COURT', 'SLOW TIME LODGE']), 'Shape': pick(r, ['Arrow', 'Star', 'Boomerang']), 'Neon': pick(r, ['Pink and Blue', 'Green and Red', 'Blossom Cyan']) }; } });
  defineClock('Water Tower Clock', { w: 8, keeps: 'Hands', build: mech_water,
    mats: ['Mill Aluminum', 'Weathering Steel', 'Ink Black', 'Bone White', 'Patinated Copper'],
    line: 'The town tank, with a clock bolted to it and MARFA painted round it. A lamp comes on for the face at dusk; the birds stay on the rail.',
    traits: function (r) { return { 'Tank': pick(r, ['Spheroid', 'Cylinder', 'Pumpkin']), 'Paint': pick(r, ['Silver', 'Sky Blue', 'Cherokee Red']) }; } });
