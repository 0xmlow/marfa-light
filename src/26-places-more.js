  // =====================================================================
  // EIGHT MORE PLACES around Marfa and the Big Bend
  //   Railroad Depot   a Spanish revival depot across the tracks, freight on the siding
  //   Arroyo           a dry creek bed between cut banks, cottonwoods, a low water crossing
  //   Rodeo Arena      pipe fence, chutes, an announcer stand, lights that come on at dusk
  //   Ghost Town       after Shafter: roofless stone, a small church, a headframe on the hill
  //   Aerostat Field   a mooring mast, a tether that runs up out of frame, a fence
  //   Drive-In Lot     a white screen, speaker posts on gravel humps, Marfa time after dark
  //   Empty Pool       a drained public pool; small clocks stand in the deep end
  //   Hot Springs      stone tubs that steam into the wind, cabins, palms, the river bottom
  // Every top-level name here starts plc2_ because every src file shares one
  // scope. The plc_ helpers (frame, kit, drape) come from 25-places-new.js.
  // All coordinates are in the plc_frame: +z toward the camera, -z past the clock.
  // =====================================================================

  // pool tile: 15 cm squares with grout, for the triplanar detail system
  DETAIL_KINDS.plc2_tile = function (u, v) {
    var fu = (u * 8) % 1, fv = (v * 8) % 1, n = pfbm(u, v, 8, 151, 2), t = hash2(Math.floor(u * 8), Math.floor(v * 8), 152);
    if (fu < 0.06 || fv < 0.06) return [0.62, 0.8, 0.3];
    return [0.48 + t * 0.12 + (n - 0.5) * 0.1, 0.3 + (n - 0.5) * 0.2, 0.62];
  };
  // raked arena dirt: long furrows, one way
  DETAIL_KINDS.plc2_rake = function (u, v) {
    var n = pfbm(u, v, 6, 161, 3), w = Math.sin((v + (n - 0.5) * 0.08) * Math.PI * 28);
    return [0.5 + w * 0.07 + (n - 0.5) * 0.25, 0.6, 0.5 + w * 0.3 + (n - 0.5) * 0.2];
  };

  // ------------------------------------------------------------ shared helpers
  // the ground height makeGround draws: flat within 90 m of the clock
  function plc2_flatH(W, rel) {
    var s = W.P.seed, k = rel || 26;
    return function (x, z) { return (fbm(x / 520, z / 520, s, 4) - 0.45) * k * sstep(90, 900, Math.sqrt(x * x + z * z)); };
  }
  function plc2_base(W, hex, far, near, opts) {
    var gm = makeGround(W, hex, opts);
    makeRidges(W, 3100, false, far); makeRidges(W, 1400, true, near);
    W.groundAt = plc2_flatH(W, opts && opts.relief);
    var F = plc_frame(W); F.ground = gm;
    return F;
  }
  // cut a rectangular hole in the ground (world centre, unit axes, half extents):
  // the triplanar ground shader discards what falls inside it
  function plc2_hole(ground, c, u, v, e) {
    var mat = ground.material, uni = { holeC: { value: new THREE.Vector2(c.x, c.z) }, holeU: { value: new THREE.Vector2(u.x, u.z) }, holeV: { value: new THREE.Vector2(v.x, v.z) }, holeE: { value: new THREE.Vector2(e[0], e[1]) } };
    mat.onBeforeCompile = function (shader) {
      TRIPLANAR.call(this, shader);
      for (var k in uni) shader.uniforms[k] = uni[k];
      shader.fragmentShader = shader.fragmentShader
        .replace('varying vec3 vTpW; varying vec3 vTpN;', 'varying vec3 vTpW; varying vec3 vTpN;\nuniform vec2 holeC; uniform vec2 holeU; uniform vec2 holeV; uniform vec2 holeE;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n{ vec2 hq = vTpW.xz - holeC; if (abs(dot(hq, holeU)) < holeE.x && abs(dot(hq, holeV)) < holeE.y) discard; }');
    };
    mat.customProgramCacheKey = function () { return 'triplanar-plc2-hole'; };
    mat.needsUpdate = true;
  }
  // half the width of the frame at local depth z, a little inside the edge
  function plc2_view(F, z) { return (F.D - z) * 0.44; }
  var plc2_UP = null;
  // a unit cylinder (radius 1, height 1) stretched between two points
  function plc2_seg(ax, ay, az, bx, by, bz, rad) {
    if (!plc2_UP) plc2_UP = new THREE.Vector3(0, 1, 0);
    var d = new THREE.Vector3(bx - ax, by - ay, bz - az), L = d.length() || 1;
    var q = new THREE.Quaternion().setFromUnitVectors(plc2_UP, d.divideScalar(L));
    return new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(rad, L, rad));
  }
  function plc2_line(parent, pts, hex) {
    var l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C(hex || '#2A2622') }));
    parent.add(l); return l;
  }
  // chain link: a strip along a polyline, uv in metres, the mesh reads as haze far off
  var plc2_chainT = null;
  function plc2_chainMat() {
    if (!plc2_chainT) {
      plc2_chainT = canvasTex(64, 64, function (g) {
        g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(214,218,220,1)'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
      }, { repeat: [1 / 0.11, 1 / 0.11] });
    }
    return new THREE.MeshStandardMaterial({ color: C('#BFC4C6'), map: plc2_chainT, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.55 });
  }
  function plc2_chain(parent, pts, h, y0, mat) {
    var pos = [], uv = [], idx = [], L = 0;
    for (var i = 0; i < pts.length; i++) {
      if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      var yb = (y0 && y0[i]) || 0;
      pos.push(pts[i][0], yb + 0.04, pts[i][1], pts[i][0], yb + h, pts[i][1]);
      uv.push(L, 0, L, h);
      if (i) { var a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, mat || plc2_chainMat()); m.renderOrder = 2; parent.add(m);
    return m;
  }
  // plain boards with words on them: a sign face, sized in metres
  function plc2_board(lines, w, h, bg, fg, o) {
    o = o || {};
    var px = 256, W2 = Math.round(px * w / h);
    var tex = canvasTex(W2, px, function (g) {
      g.fillStyle = bg; g.fillRect(0, 0, W2, px);
      if (o.border) { g.strokeStyle = o.border; g.lineWidth = px * 0.06; g.strokeRect(px * 0.05, px * 0.05, W2 - px * 0.1, px - px * 0.1); }
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      var n = lines.length, fs = (o.size || 0.62) * px / n;
      g.font = '700 ' + fs + 'px ' + (o.font || FONT_SANS);
      lines.forEach(function (l, i) { g.fillText(l, W2 / 2, px * (i + 0.5) / n + (o.dy || 0) * px, W2 * 0.92); });
    });
    return new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
  }
  // claim a local rectangle only while the common scatter runs
  function plc2_scatterOut(W, F, rects, opts, hw) {
    var n0 = W.occupied.length;
    rects.forEach(function (q) { F.claimRect(q[0], q[1], q[2], q[3], q[4] || 4); });
    plc_scatter(W, opts, hw);
    W.occupied.splice(n0, W.occupied.length - n0);
  }
  // how dark it is for lights that come on at dusk rather than at full night
  function plc2_dusk(ctx) { return Math.max(ctx.night, sstep(8, -1, ctx.sun.el)); }
  // an arch-topped opening as a Path (for holes) or Shape
  function plc2_arch(P, x0, y0, w, h, n) {
    var r = w / 2, yc = y0 + h - r;
    P.moveTo(x0, y0); P.lineTo(x0 + w, y0); P.lineTo(x0 + w, yc);
    for (var i = 1; i < (n || 12); i++) { var a = Math.PI * i / (n || 12); P.lineTo(x0 + r + r * Math.cos(a), yc + r * Math.sin(a)); }
    P.lineTo(x0, yc); P.lineTo(x0, y0);
    return P;
  }

  // =====================================================================
  // 1. RAILROAD DEPOT
  // The Southern Pacific ran its Sunset Route straight through Marfa. Here a
  // Spanish revival depot stands across the tracks: cream stucco, a red tile
  // roof, a curved Mission parapet and an arcade. The main line and a siding
  // run across the view on ballast, a string of freight cars waits on the
  // siding to one side, and at the road crossing the signal's two red lights
  // take turns after dark. The cars carry no names.
  // =====================================================================
  var PLC2_CARS = ['#7A3B2A', '#6B3226', '#5E4A3A', '#8C4A2F', '#56604A', '#A88A3A', '#3F4A55', '#9A9488', '#B4AFA4', '#2A2A2B'];
  function plc2_depot(W) {
    W.shadowExtent = 52;
    var F = plc2_base(W, '#A8916C', '#6C6772', '#8A785F'), g = F.g, D = F.D, R = F.R, r = W.r, i, k;
    var s = W.P.seed % 2 ? 1 : -1, V = function (z) { return plc2_view(F, z); };
    var zM = -(R + rf(r, 5.5, 7)), zP0 = zM - 1.9, zP1 = zM - 7.4, zD0 = zP1, zD1 = zP1 - 9.5, zN = zD1 - rf(r, 4.5, 6.5), LT = 340;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1), CYL = new THREE.CylinderBufferGeometry(1, 1, 1, 12);
    var winLit = std('#2A2622', 0.15, 0.4); winLit.emissive = C('#FFC985'); W.glow(winLit, 0, 0.9);
    var kit = plc_kit()
      .def('stucco', BOX, plc_tex('#E4D3B4', 'plaster', 0.95, 0, 1.6, 0.3, 0.35))
      .def('trim', BOX, mtl('#5A3524', 'wood', 0.8, 0, 0.7))
      .def('door', BOX, mtl('#4E2F1F', 'wood', 0.7, 0, 0.6))
      .def('win', BOX, winLit)
      .def('conc', BOX, mtl('#B7AFA2', 'concrete', 0.92, 0, 1.8))
      .def('brick', BOX, plc_tex('#9C5A42', 'plc_brick', 0.9, 0, 0.9, 0.5, 0.5))
      .def('tie', BOX, mtl('#4A3B2E', 'wood', 1, 0, 0.8))
      .def('rail', BOX, std('#5E5550', 0.6, 0.7))
      .def('head', BOX, std('#B8B6B2', 0.22, 1), { cast: false })
      .def('car', BOX, std('#FFFFFF', 0.82, 0.2))
      .def('under', BOX, std('#2B2927', 0.8, 0.4))
      .def('wheel', new THREE.CylinderBufferGeometry(0.43, 0.43, 0.14, 14), std('#3B3634', 0.55, 0.6))
      .def('tank', new THREE.CylinderBufferGeometry(1, 1, 1, 20), std('#FFFFFF', 0.5, 0.35))
      .def('tankEnd', new THREE.SphereBufferGeometry(1, 16, 10), std('#FFFFFF', 0.5, 0.35))
      .def('hop', new THREE.ConeBufferGeometry(1, 1, 4), std('#FFFFFF', 0.8, 0.25))
      .def('pipe', CYL, std('#9DA3A6', 0.4, 0.8))
      .def('black', BOX, std('#151517', 0.6, 0.2))
      .def('pole', new THREE.CylinderBufferGeometry(0.12, 0.15, 1, 7), mtl('#5B4B3B', 'wood', 1, 0, 1.2))
      .def('lamp', new THREE.SphereBufferGeometry(0.2, 12, 8), plc_glow(W, '#FFD9A0', 0.05, 2.4), { cast: false });

    // ballast, ties and rails: the siding, then the main line
    var bs = new THREE.Shape(); bs.moveTo(-2.5, 0); bs.lineTo(2.5, 0); bs.lineTo(1.65, 0.34); bs.lineTo(-1.65, 0.34); bs.lineTo(-2.5, 0);
    var bgeo = new THREE.ExtrudeBufferGeometry(bs, { depth: LT, bevelEnabled: false }); bgeo.rotateY(Math.PI / 2); bgeo.translate(-LT / 2, 0, 0);
    var ballM = std('#8E8981', 1, 0, { flatShading: true, tex: 'stone', tile: 0.35 });
    [zN, zM].forEach(function (z) {
      var b = new THREE.Mesh(bgeo, ballM); b.position.z = z; b.receiveShadow = true; g.add(b);
      for (var x = -LT / 2; x < LT / 2; x += 0.6) kit.box('tie', x + rf(r, -0.03, 0.03), 0.4, z, 0.23, 0.15, 2.6, rf(r, -0.03, 0.03), r() < 0.2 ? '#6E6258' : null);
      [-0.72, 0.72].forEach(function (o) { kit.box('rail', 0, 0.53, z + o, LT, 0.13, 0.08); kit.box('head', 0, 0.605, z + o, LT, 0.03, 0.075); });
    });
    F.claimRect(-LT / 2, LT / 2, zM - 3, zM + 3, 3); F.claimRect(-LT / 2, LT / 2, zN - 3, zN + 3, 3);

    // the depot: across the tracks, a little to one side; the road passes its end
    var L = rf(r, 24, 30), o = rf(r, 2, 5), xc = s * (L / 2 - o), H = 5.4, dep = zD0 - zD1, zc = (zD0 + zD1) / 2;
    var rw2 = 3.2, xR = -s * Math.max(R + 4.6, o + rw2 + 1.6);
    // the platform, from the road to past the arcade
    var pA = xR + s * (rw2 + 0.4), pB = s * (L + 16), pc = (pA + pB) / 2, pL = Math.abs(pB - pA);
    kit.box('conc', pc, 0.2, (zP0 + zP1) / 2, pL, 0.4, zP0 - zP1);
    kit.box('brick', pc, 0.2, zP0 + 0.25, pL, 0.42, 0.5);
    kit.box('conc', pc, 0.405, zP0 + 0.62, pL, 0.01, 0.06, 0, '#E3C44A');
    var DM = plc_m4(xc, 0.4, zc, 1, 1, 1, 0, 0, 0);
    var db = function (key, x, y, z, sx, sy, sz, col) { kit.box(key, x, y, z, sx, sy, sz, 0, col, DM); };
    db('stucco', 0, H / 2, 0, L, H, dep);
    db('conc', 0, 0.2, 0, L + 0.3, 0.4, dep + 0.3);
    // arched windows and doors on the track side, framed in dark wood
    var nb = Math.floor(L / 3.2), bay = L / nb, zf = dep / 2;
    for (i = 0; i < nb; i++) {
      var bx = -L / 2 + bay * (i + 0.5), isDoor = (i === Math.floor(nb / 2) - 1 || i === nb - 2);
      if (isDoor) { db('door', bx, 1.3, zf + 0.02, 1.7, 2.6, 0.08); db('win', bx, 2.95, zf + 0.02, 1.5, 0.6, 0.06); }
      else { db('win', bx, 2.15, zf + 0.02, 1.25, 2.2, 0.06); db('trim', bx, 2.15, zf + 0.05, 0.08, 2.2, 0.04); db('trim', bx, 2.5, zf + 0.05, 1.25, 0.06, 0.04); }
      db('trim', bx, 0.95, zf + 0.08, isDoor ? 1.9 : 1.45, 0.1, 0.14);
      db('trim', bx, isDoor ? 3.35 : 3.35, zf + 0.06, isDoor ? 1.9 : 1.45, 0.12, 0.1);
    }
    // the operator's bay, pushed out toward the rails
    var bxO = -s * L * 0.18;
    db('stucco', bxO, H * 0.42, zf + 0.9, 3.2, H * 0.84, 1.8);
    [-1, 0, 1].forEach(function (e) { db('win', bxO + e * 1.0, 2.2, zf + 1.81, 0.7, 1.8, 0.05); });
    db('trim', bxO, H * 0.84 + 0.1, zf + 0.9, 3.5, 0.2, 2.1);
    // red tile roof: a long gable, with deep eaves on brackets over the platform
    var tileT = canvasTex(64, 64, function (gc) {
      gc.fillStyle = '#8E3A24'; gc.fillRect(0, 0, 64, 64);
      for (var x = 0; x < 64; x += 16) { var gr = gc.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#6E2A1A'); gr.addColorStop(0.5, '#B85A38'); gr.addColorStop(1, '#6E2A1A'); gc.fillStyle = gr; gc.fillRect(x, 0, 16, 64); }
      gc.fillStyle = 'rgba(40,14,8,0.55)'; gc.fillRect(0, 60, 64, 4);
    }, { repeat: [L * 2, 6] });
    var rh = 2.6, ov = 1.6, rw = dep / 2 + ov;
    var roofS = new THREE.Shape(); roofS.moveTo(-rw, 0); roofS.lineTo(rw, 0); roofS.lineTo(0, rh); roofS.lineTo(-rw, 0);
    var rgeo = new THREE.ExtrudeBufferGeometry(roofS, { depth: L + 1.2, bevelEnabled: false }); rgeo.rotateY(Math.PI / 2); rgeo.translate(-(L + 1.2) / 2, 0, 0);
    var roof = new THREE.Mesh(rgeo, new THREE.MeshStandardMaterial({ color: C('#FFFFFF'), map: tileT, roughness: 0.85, flatShading: true }));
    roof.position.set(xc, 0.4 + H, zc); g.add(roof);
    for (i = 0; i <= nb; i++) { var bkx = xc - L / 2 + bay * i; kit.put('trim', plc_m4(bkx, 0.4 + H - 0.35, zD0 + 0.7, 0.14, 0.14, 1.5, 0.45, 0, 0)); }
    // the Mission parapet in the middle of the long side, with a round window
    var pw = rf(r, 7, 9), ph = H + rh + 1.3, ps = new THREE.Shape();
    ps.moveTo(-pw / 2, H - 0.5); ps.lineTo(pw / 2, H - 0.5); ps.lineTo(pw / 2, H + 0.6);
    ps.quadraticCurveTo(pw / 2 - 0.2, H + 1.3, pw / 2 - 1.1, H + 1.35); ps.quadraticCurveTo(pw * 0.22, H + 1.5, pw * 0.16, ph - 0.5);
    ps.quadraticCurveTo(0, ph + 0.25, -pw * 0.16, ph - 0.5); ps.quadraticCurveTo(-pw * 0.22, H + 1.5, -pw / 2 + 1.1, H + 1.35);
    ps.quadraticCurveTo(-pw / 2 + 0.2, H + 1.3, -pw / 2, H + 0.6); ps.lineTo(-pw / 2, H - 0.5);
    var oc = new THREE.Path(); oc.absarc(0, H + 1.9, 0.55, 0, Math.PI * 2, true); ps.holes.push(oc);
    var pgeo = new THREE.ExtrudeBufferGeometry(ps, { depth: 0.5, bevelEnabled: false, curveSegments: 10 });
    var parapet = new THREE.Mesh(pgeo, mtl('#E4D3B4', 'plaster', 0.95, 0, 1.6));
    var pX = s * L * 0.12;
    parapet.position.set(xc + pX, 0.4, zD0 - 0.1); g.add(parapet);
    kit.box('win', xc + pX, 0.4 + H + 1.9, zD0 + 0.1, 1.0, 1.0, 0.05);
    var cap = new THREE.Mesh(new THREE.ExtrudeBufferGeometry(ps, { depth: 0.14, bevelEnabled: false, curveSegments: 10 }), mtl('#C9B28E', 'plaster', 0.9, 0, 1.4));
    cap.scale.set(1.03, 1.012, 1); cap.position.set(xc + pX, 0.4, zD0 - 0.25); g.add(cap);
    var name = textPlane('MARFA', { color: '#4A2A1C', font: FONT_SERIF, height: 0.62, px: 90, spacing: 0.2, pad: 0.1 });
    name.position.set(xc + pX, 0.4 + H + 0.5, zD0 + 0.42); g.add(name);
    // the arcade at the far end: three arches, a tile roof of its own
    var ax = xc + s * (L / 2 + 3.2), aw = 6.2, as = new THREE.Shape();
    as.moveTo(-aw / 2 - 0.3, 0); as.lineTo(aw / 2 + 0.3, 0); as.lineTo(aw / 2 + 0.3, 3.9); as.lineTo(-aw / 2 - 0.3, 3.9); as.lineTo(-aw / 2 - 0.3, 0);
    [-2.05, 0, 2.05].forEach(function (x) { as.holes.push(plc2_arch(new THREE.Path(), x - 0.8, 0, 1.6, 3.1, 10)); });
    var ageo = new THREE.ExtrudeBufferGeometry(as, { depth: 0.45, bevelEnabled: false, curveSegments: 8 });
    var arc = new THREE.Mesh(ageo, mtl('#E4D3B4', 'plaster', 0.95, 0, 1.6)); arc.position.set(ax, 0.4, zD0 - 0.45); g.add(arc);
    var arcB = new THREE.Mesh(ageo, arc.material); arcB.position.set(ax, 0.4, zD1 + 2.5); g.add(arcB);
    kit.box('stucco', ax + s * (aw / 2 + 0.1), 0.4 + 1.95, zc, 0.5, 3.9, dep);
    kit.box('conc', ax, 0.4 + 4.0, zc + 0.3, aw + 1.4, 0.25, dep + 1.0);
    var aroof = new THREE.Mesh(rgeo, roof.material); aroof.scale.set((aw + 1.4) / (L + 1.2), 0.55, 1); aroof.position.set(ax, 0.4 + 4.1, zc); g.add(aroof);
    // benches, a baggage cart, lamp posts and the station sign on the platform
    var pl = [];
    for (i = -4; i <= 4; i++) {
      var lx = xc + i * 9 + s * 2, lz = zP1 + 1.2;
      kit.box('pipe', lx, 0.4 + 2.0, lz, 0.07, 4.0, 0.07);
      kit.put('pipe', plc2_seg(lx, 0.4 + 3.95, lz, lx, 0.4 + 4.1, lz + 0.7, 0.05));
      kit.box('black', lx, 0.4 + 4.05, lz + 0.8, 0.4, 0.14, 0.4);
      kit.box('lamp', lx, 0.4 + 3.88, lz + 0.8, 0.9, 0.5, 0.9);
      pl.push([lx, lz + 0.8]);
    }
    pl.sort(function (a, b) { return Math.abs(a[0]) - Math.abs(b[0]); });
    pl.slice(0, 3).forEach(function (p) { W.lamp('#FFCB8A', 1.3, 22, F.w(p[0], p[1], 3.9)); });
    [-6, 5].forEach(function (o, n) {
      var bx2 = xc + o, bz = zP1 + 2.6;
      kit.box('trim', bx2, 0.4 + 0.45, bz, 2.2, 0.06, 0.45); kit.box('trim', bx2, 0.4 + 0.75, bz - 0.22, 2.2, 0.5, 0.05);
      [-0.95, 0.95].forEach(function (e) { kit.box('black', bx2 + e, 0.4 + 0.25, bz, 0.06, 0.5, 0.45); });
      if (n === 0) {
        var cx = xc + s * 9, cz = zP1 + 3.6;
        kit.box('trim', cx, 0.4 + 0.8, cz, 3.2, 0.1, 1.3); kit.box('trim', cx, 0.4 + 1.1, cz - 0.6, 3.2, 0.5, 0.06);
        [-1.2, 1.2].forEach(function (e) { [-0.62, 0.62].forEach(function (f) { kit.put('wheel', plc_m4(cx + e, 0.4 + 0.42, cz + f, 1, 1, 0.8, Math.PI / 2, 0, 0)); }); });
        kit.box('trim', cx - 0.4, 0.4 + 1.1, cz, 0.9, 0.5, 0.6, 0, '#7A5C3E'); kit.box('trim', cx + 0.7, 0.4 + 1.05, cz + 0.1, 0.7, 0.4, 0.5, 0, '#6B4E36');
      }
    });
    var sx = xc - s * (L / 2 - 2), sgn = plc2_board(['MARFA'], 3.4, 0.7, '#F1ECE2', '#1E1C1A', { border: '#1E1C1A', font: FONT_SERIF });
    sgn.position.set(sx, 0.4 + 2.7, zP1 + 2.2 + 0.03); g.add(sgn);
    kit.box('black', sx, 0.4 + 2.7, zP1 + 2.2 - 0.02, 3.5, 0.8, 0.04);
    [-1.5, 1.5].forEach(function (e) { kit.box('black', sx + e, 0.4 + 1.4, zP1 + 2.2 - 0.02, 0.08, 2.8, 0.08); });
    F.claimRect(Math.min(ax, xc - L / 2) - 4, Math.max(ax, xc + L / 2) + 4, zD1 - 2, zP0, 4);

    // the road crossing: an asphalt lane that rises over the rails
    var rp = [], ri2 = [], nR = 0, dTr = function (z) { return Math.min(Math.abs(z - zN), Math.abs(z - zM)); };
    for (var z = D + 30; z > zD1 - 60; z -= 0.8) {
      var y = 0.03 + 0.55 * (1 - sstep(2.6, 6.5, dTr(z)));
      rp.push(xR - rw2, y, z, xR + rw2, y, z);
      if (nR) ri2.push((nR - 1) * 2, nR * 2, (nR - 1) * 2 + 1, (nR - 1) * 2 + 1, nR * 2, nR * 2 + 1);
      nR++;
    }
    var rgeo2 = new THREE.BufferGeometry(); rgeo2.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rgeo2.setIndex(ri2); rgeo2.computeVertexNormals();
    var road = new THREE.Mesh(rgeo2, mtl('#4A4845', 'concrete', 0.95, 0, 2.2)); road.receiveShadow = true; g.add(road);
    for (z = D + 20; z > zD1 - 50; z -= 5) F.claim(xR, z, 4);
    // the signal on the near side, facing the camera; a twin across the tracks
    var sigs = [];
    [[xR + s * (rw2 + 1.0), zM + 3.4, 0], [xR - s * (rw2 + 1.0), zM - 3.4, Math.PI]].forEach(function (q, n) {
      var G = new THREE.Group(); G.position.set(q[0], 0, q[1]); G.rotation.y = q[2]; g.add(G);
      var mast = cyl(0.09, 0.1, 4.6, 10, std('#B9BDC2', 0.45, 0.3)); mast.position.y = 2.3; G.add(mast);
      var base = box(0.7, 0.3, 0.7, mtl('#A9A39A', 'concrete', 0.95, 0, 1)); base.position.y = 0.15; G.add(base);
      var cb = canvasTex(512, 64, function (gc) { gc.fillStyle = '#F4F2EC'; gc.fillRect(0, 0, 512, 64); gc.strokeStyle = '#111'; gc.lineWidth = 5; gc.strokeRect(3, 3, 506, 58); gc.fillStyle = '#111'; gc.font = '700 40px ' + FONT_SANS; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText('RAILROAD CROSSING', 256, 34); });
      [-1, 1].forEach(function (e) {
        var b = new THREE.Mesh(new THREE.PlaneBufferGeometry(2.4, 0.3), new THREE.MeshStandardMaterial({ map: cb, roughness: 0.6, side: THREE.DoubleSide }));
        b.position.set(0, 4.15, 0.12 + (e > 0 ? 0.01 : 0)); b.rotation.z = e * 0.785; G.add(b);
      });
      var bar = box(1.9, 0.1, 0.1, std('#1C1C1E', 0.5, 0.4)); bar.position.set(0, 3.05, 0.1); G.add(bar);
      var pair = [];
      [-1, 1].forEach(function (e) {
        var bk = cyl(0.42, 0.42, 0.04, 20, std('#111113', 0.6, 0.2)); bk.rotation.x = Math.PI / 2; bk.position.set(e * 0.72, 3.05, 0.16); G.add(bk);
        var lm = W.glow(glowMat('#FF2A18', 0.05), 0.05, 2.6);
        var lens = cyl(0.15, 0.15, 0.06, 16, lm); lens.rotation.x = Math.PI / 2; lens.position.set(e * 0.72, 3.05, 0.2); G.add(lens);
        var hood = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.19, 0.19, 0.28, 16, 1, true, -Math.PI / 2, Math.PI), std('#111113', 0.6, 0.2, { side: THREE.DoubleSide }));
        hood.rotation.x = Math.PI / 2; hood.position.set(e * 0.72, 3.07, 0.33); G.add(hood);
        pair.push(lm);
      });
      var bell = sph(0.16, std('#1C1C1E', 0.5, 0.4), 12, 8); bell.position.set(0, 4.72, 0); G.add(bell);
      // the gate arm, standing up, striped
      var st = canvasTex(16, 128, function (gc) { for (var y = 0; y < 128; y += 32) { gc.fillStyle = '#C8231A'; gc.fillRect(0, y, 16, 16); gc.fillStyle = '#F2F0EA'; gc.fillRect(0, y + 16, 16, 16); } }, { repeat: [1, 3] });
      var arm = box(0.1, 7, 0.1, std('#FFFFFF', 0.5, 0, { map: st })); arm.position.set(-s * 0.4 * (n ? -1 : 1), 3.9, -0.25); G.add(arm);
      shade(G);
      sigs.push(pair);
    });
    var sigL = W.lamp('#FF3020', 1.1, 16, F.w(xR + s * (rw2 + 1.0), zM + 4.2, 3.1));
    W.onUpdate(function (ctx) {
      var ph = Math.floor(ctx.real * 1.6) % 2;
      sigs.forEach(function (p) { p[0].emissiveIntensity *= ph ? 1 : 0.05; p[1].emissiveIntensity *= ph ? 0.05 : 1; });
      sigL.intensity *= 0.6 + 0.4 * ph;
    });
    F.claim(xR + s * (rw2 + 1.0), zM + 3.4, 1.2);

    // freight cars on the siding, beyond the road
    var x0 = xR - s * (rw2 + 2.0), nCar = ri(r, 6, 10), xx = x0, carRoom = V(zN) * 1.6;
    for (var c = 0; c < nCar; c++) {
      var type = r(), Lc = type < 0.5 ? rf(r, 15, 17.5) : type < 0.8 ? rf(r, 16.5, 18.5) : rf(r, 14, 16), cxc = xx - s * Lc / 2, col = pick(r, PLC2_CARS);
      var CM = plc_m4(cxc, 0.61, zN, 1, 1, 1, 0, 0, 0), cb2 = function (key, x, y, z, sx2, sy, sz, cc) { kit.box(key, x, y, z, sx2, sy, sz, 0, cc, CM); };
      cb2('under', 0, 0.85, 0, Lc - 0.8, 0.35, 2.7);
      [-1, 1].forEach(function (e) {
        var tx = e * (Lc / 2 - 2.3);
        cb2('under', tx, 0.52, 0.78, 2.7, 0.42, 0.18); cb2('under', tx, 0.52, -0.78, 2.7, 0.42, 0.18);
        [-0.9, 0.9].forEach(function (f) { [-0.72, 0.72].forEach(function (h) { kit.put('wheel', plc_m4(tx + f, 0.43, h, 1, 1, 1, Math.PI / 2, 0, 0).premultiply(CM)); }); });
        cb2('under', e * (Lc / 2 - 0.1), 0.95, 0, 0.5, 0.2, 0.3);
      });
      if (type < 0.5) {
        cb2('car', 0, 2.6, 0, Lc, 3.2, 3.1, col); cb2('car', 0, 4.25, 0, Lc + 0.1, 0.12, 3.2, col);
        cb2('car', 0, 2.5, 1.58, 3.2, 2.9, 0.06, new THREE.Color(C(col)).multiplyScalar(0.8));
        cb2('under', 0, 4.02, 1.6, 3.6, 0.07, 0.07); cb2('under', 0, 1.1, 1.6, 3.6, 0.07, 0.07);
        for (k = -Lc / 2 + 0.7; k < Lc / 2 - 0.5; k += 0.95) if (Math.abs(k) > 1.9) cb2('car', k, 2.6, 0, 0.09, 3.1, 3.2, col);
      } else if (type < 0.8) {
        cb2('car', 0, 3.0, 0, Lc - 1.6, 2.4, 3.1, col); cb2('car', 0, 4.25, 0, Lc - 2.4, 0.1, 0.7, '#3A3836');
        [-1, 1].forEach(function (e) { kit.put('car', plc_m4(e * (Lc / 2 - 0.55), 2.85, 0, 0.1, 2.3, 3.1, 0, 0, e * 0.5).premultiply(CM), col); });
        for (k = -1; k <= 1; k++) kit.put('hop', plc_m4(k * (Lc - 5) / 3, 1.35, 0, 1.3, 0.9, 1.3, Math.PI, Math.PI / 4, 0).premultiply(CM), col);
        for (k = -Lc / 2 + 1.4; k < Lc / 2 - 1.2; k += 1.3) cb2('car', k, 3.0, 0, 0.1, 2.3, 3.2, col);
      } else {
        var tc = r() < 0.6 ? '#1E1E1F' : '#D8D6D0';
        kit.put('tank', plc_m4(0, 2.75, 0, 1.45, Lc - 2.4, 1.45, 0, 0, Math.PI / 2).premultiply(CM), tc);
        [-1, 1].forEach(function (e) { kit.put('tankEnd', plc_m4(e * (Lc / 2 - 1.2), 2.75, 0, 0.5, 1.45, 1.45).premultiply(CM), tc); });
        kit.put('tank', plc_m4(0, 4.3, 0, 0.45, 0.35, 0.45).premultiply(CM), tc);
        cb2('under', 0, 1.35, 0, Lc - 1, 0.25, 2.2);
      }
      xx -= s * (Lc + 1.1);
      if (Math.abs(xx - x0) > carRoom + 60) break;
    }
    var xFar = xx;
    F.claimRect(Math.min(x0, xFar), Math.max(x0, xFar), zN - 2, zN + 2, 2.5);

    // telegraph poles along the far side
    var tops = [];
    for (i = -6; i <= 6; i++) {
      var tx2 = i * 45 + s * 7, tz = zN - 6;
      kit.box('pole', tx2, 4.5, tz, 1, 9, 1); kit.box('trim', tx2, 8.5, tz, 2.4, 0.14, 0.14);
      tops.push([tx2, tz]);
    }
    for (i = 0; i < tops.length - 1; i++) [-1, 1].forEach(function (e) {
      var pts = [];
      for (k = 0; k <= 10; k++) { var t = k / 10; pts.push(new THREE.Vector3(lerp(tops[i][0], tops[i + 1][0], t) + e * 1.05, 8.55 - Math.sin(t * Math.PI) * 0.8, lerp(tops[i][1], tops[i + 1][1], t))); }
      plc2_line(g, pts);
    });

    kit.flush(g);
    shade(g, true, true);
    road.castShadow = false;
    plc2_scatterOut(W, F, [[-LT / 2, LT / 2, zN - 3, zM + 3.5, 4]], { grass: '#A99467', tufts: 1400, bushes: 300, rocks: 160, yucca: 6 });
  }

  // =====================================================================
  // 2. ARROYO
  // A dry creek bed after rain has come and gone: pale sand and cobbles on the
  // floor, banks cut straight down through layers of old flood silt, big
  // cottonwoods where the water is closest. Behind the clock a concrete low
  // water crossing takes a ranch road over the bed, with depth posts and a
  // warning sign whose amber lamps take turns after dark.
  // =====================================================================
  function plc2_arroyo(W) {
    W.shadowExtent = 50;
    var F = plc_frame(W), g = F.g, D = F.D, R = F.R, r = W.r, i, j, k, sd = W.P.seed;
    var s = W.P.seed % 2 ? 1 : -1;
    makeRidges(W, 3100, false, '#6F6A74'); makeRidges(W, 1400, true, '#8C7A62');
    var H0 = rf(r, 2.3, 3.4), w0 = Math.max(R + 5, 0.26 * D + 3, 8.5), A = s * rf(r, 10, 18), ph = r() * 6.28;
    var zc = -(R + rf(r, 9, 13)), rw = 3.3;
    var taper = function (z) { return z > 0 ? sstep(D + 6, D + 60, z) : sstep(R + 16, R + 90, -z); };
    var mid = function (z) { return A * Math.sin(z / 55 + ph) * taper(z) - A * Math.sin(ph) * 0; };
    var wid = function (z) { return w0 + 5 * (fbm(z / 40, 3, sd + 31, 3) - 0.5) * taper(z) + 3 * taper(z); };
    var bankH = function (z, side) { return H0 * (0.85 + 0.3 * fbm(z / 25, side * 7, sd + 32, 3)); };
    var road = function (z) { return 1 - sstep(rw + 0.4, rw + 5, Math.abs(z - zc)); };
    var far = plc2_flatH(W);
    // the height at a point given its z and its signed offset u from the bed's middle
    var prof = function (z, u) {
      var w = wid(z), a = Math.abs(u), t = a - w, side = u < 0 ? -1 : 1, Hb = bankH(z, side), kr = road(z);
      if (t <= 0) return -0.02 * sstep(w * 0.7, w, a) + 0.05 * (fbm(u / 6, z / 6, sd + 33, 2) - 0.5) * sstep(R + 1, R + 4, Math.sqrt(u * u + z * z));
      var face = Hb * sstep(0, 0.42, t) * (1 - kr) + kr * Hb * sstep(0, 18, t);
      return face + 0.25 * (fbm(u / 18, z / 18, sd + 34, 3) - 0.5) * sstep(1, 6, t);
    };
    var hL = function (x, z) {
      var rr = Math.sqrt(x * x + z * z), h = prof(z, x - mid(z)), f = sstep(420, 900, rr);
      return h * (1 - f) + far(x, z) * f;
    };
    var hW = function (wx, wz) { var q = F.loc(wx, wz); return hL(q[0], q[1]); };

    // the terrain: rows across the bed, dense where the camera looks
    var zs = [], us = [];
    for (i = 0; i <= 26; i++) zs.push(-1500 + (1500 - 170) * (1 - Math.pow(1 - i / 26, 2.2)));
    for (var zz = -168; zz <= D + 40; zz += 1.0) zs.push(zz);
    for (i = 1; i <= 22; i++) zs.push(D + 40 + (1500 - D - 40) * Math.pow(i / 22, 2.2));
    var inner = [], NB = 26;
    for (i = 0; i <= NB; i++) inner.push(-1 + 2 * i / NB);
    var faceT = [0.03, 0.09, 0.16, 0.24, 0.33, 0.42], faceF = [0.12, 0.3, 0.52, 0.72, 0.9, 1.0];
    var outT = [0.8, 1.6, 3, 5.5, 9, 15, 25, 42, 70, 120, 200, 330, 540, 900, 1500];
    var pos = [], col = [], idx = [], cc = new THREE.Color(), nCol = 0;
    var cSand = C('#CDBB98'), cWet = C('#A89272'), cTop = C('#A58D66'), cScrub = C('#7D7A52');
    var strata = [C('#C9AE88'), C('#D8C4A0'), C('#BC9C7A'), C('#E0CFAE'), C('#B8A084'), C('#CDB28C')];
    for (i = 0; i < zs.length; i++) {
      var z = zs[i], m = mid(z), w = wid(z), row = [];
      for (j = outT.length - 1; j >= 0; j--) row.push([-(w + outT[j]), 2]);
      for (j = faceT.length - 1; j >= 0; j--) row.push([-(w + faceT[j]), 1, faceF[j]]);
      for (j = 0; j < inner.length; j++) row.push([inner[j] * w, 0]);
      for (j = 0; j < faceT.length; j++) row.push([w + faceT[j], 1, faceF[j]]);
      for (j = 0; j < outT.length; j++) row.push([w + outT[j], 2]);
      nCol = row.length;
      for (j = 0; j < nCol; j++) {
        var u = row[j][0], jit = row[j][1] === 1 ? (fbm(z / 3, row[j][2] * 4, sd + 35, 2) - 0.5) * 0.5 : 0;
        var x = m + u + (u < 0 ? -jit : jit), h = hL(x, z);
        pos.push(x, h, z);
        if (row[j][1] === 0) {
          cc.copy(cSand).lerp(cWet, sstep(0.55, 0.8, fbm(x / 7, z / 7, sd + 36, 3)) * 0.8);
          cc.multiplyScalar(0.92 + 0.16 * fbm(x / 2, z / 2, sd + 37, 2));
        } else if (row[j][1] === 1) {
          var band = Math.floor(h * 2.6 + fbm(z / 30, 1, sd + 38, 2) * 2);
          cc.copy(strata[((band % strata.length) + strata.length) % strata.length]).multiplyScalar(0.9 + 0.2 * fbm(x, z / 2, sd + 39, 2));
        } else {
          cc.copy(cTop).lerp(cScrub, sstep(0.45, 0.75, fbm(x / 20, z / 20, sd + 40, 3)) * 0.6);
          cc.multiplyScalar(0.84 + 0.3 * fbm(x / 9, z / 9, sd + 41, 3));
        }
        col.push(cc.r, cc.g, cc.b);
      }
    }
    for (i = 0; i < zs.length - 1; i++) for (j = 0; j < nCol - 1; j++) {
      var a0 = i * nCol + j, b0 = a0 + 1, c0 = a0 + nCol, d0 = c0 + 1;
      idx.push(a0, b0, c0, b0, d0, c0);
    }
    var tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    tg.setIndex(idx); tg.computeVertexNormals();
    var terr = new THREE.Mesh(tg, detail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), 'stone', { tile: 1.8, albedo: 0.32, bump: 0.5 }));
    terr.receiveShadow = true; terr.castShadow = true; g.add(terr);
    W.groundColor = C('#B39E78');

    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    var kit = plc_kit()
      .def('cob', new THREE.DodecahedronBufferGeometry(1, 0), std('#FFFFFF', 0.9, 0, { flatShading: true }))
      .def('bark', new THREE.CylinderBufferGeometry(0.7, 1, 1, 7), mtl('#6A5E52', 'wood', 1, 0, 1.2))
      .def('leaf', new THREE.IcosahedronBufferGeometry(1, 1), std('#FFFFFF', 0.9, 0, { flatShading: true }))
      .def('conc', BOX, mtl('#B9B2A6', 'concrete', 0.92, 0, 1.8))
      .def('pipe', new THREE.CylinderBufferGeometry(1, 1, 1, 16, 1, true), std('#8A8C8E', 0.6, 0.6, { side: THREE.DoubleSide }))
      .def('dark', new THREE.CircleBufferGeometry(1, 16), std('#15130F', 1), { cast: false })
      .def('post', BOX, std('#F1EFE8', 0.6))
      .def('refl', BOX, plc_glow(W, '#FF4A2A', 0.2, 0.9), { cast: false })
      .def('drift', new THREE.CylinderBufferGeometry(1, 1, 1, 6), mtl('#8C7F70', 'wood', 1, 0, 0.8));

    // cobbles: bars of them on the bed, fewer near the middle of the flow
    var cCol = ['#8C8378', '#A69A8A', '#7A6E66', '#A8967E', '#9C7F6A', '#6E6A68', '#9E9282'];
    for (i = 0; i < 1100; i++) {
      var cz = lerp(-170, D + 10, Math.pow(r(), 0.8)), cw = wid(cz), cu = rf(r, -cw + 0.3, cw - 0.3), cx = mid(cz) + cu;
      var bar = fbm(cx / 9, cz / 9, sd + 42, 3);
      if (bar < 0.5 && r() < 0.8) continue;
      if (cx * cx + cz * cz < (R + 0.4) * (R + 0.4)) continue;
      if (Math.abs(cz - zc) < rw + 0.3) continue;
      var cs = rf(r, 0.05, 0.2) * (r() < 0.06 ? 2.4 : 1);
      kit.put('cob', plc_m4(cx, hL(cx, cz) + cs * 0.25, cz, cs * rf(r, 0.9, 1.4), cs * 0.55, cs, r(), r() * 6, r()), pick(r, cCol));
    }
    // driftwood: a few grey limbs left by the last flood
    for (i = 0; i < 9; i++) {
      var dz = rf(r, -120, D * 0.6), dwid = wid(dz), du = rf(r, 0.4, 0.9) * dwid * (r() < 0.5 ? 1 : -1), dx = mid(dz) + du, dl = rf(r, 1.5, 4.5);
      if (!F.free(dx, dz, dl / 2)) continue;
      kit.put('drift', plc_m4(dx, hL(dx, dz) + 0.08, dz, rf(r, 0.06, 0.13), dl, rf(r, 0.06, 0.13), Math.PI / 2 + rf(r, -0.1, 0.1), r() * 6, 0));
      F.claim(dx, dz, dl / 2);
    }

    // cottonwoods: on the bank tops and in the edges of the bed
    var trees = 0;
    var tree = function (x, z, sc) {
      var y = hL(x, z), tr = rf(r, 0.35, 0.5) * sc, th = rf(r, 3.2, 4.4) * sc, lean = rf(r, -0.12, 0.12);
      kit.put('bark', plc2_seg(x, y - 0.3, z, x + lean * th, y + th, z, tr));
      var cx2 = x + lean * th, cy = y + th, nl = ri(r, 2, 3);
      for (var b = 0; b < nl; b++) {
        var ba = r() * 6.28 + b * 2.1, bl = rf(r, 2.6, 4.2) * sc, bxe = cx2 + Math.cos(ba) * bl * 0.7, bze = z + Math.sin(ba) * bl * 0.7, bye = cy + bl * 0.75;
        kit.put('bark', plc2_seg(cx2, cy - 0.2, z, bxe, bye, bze, tr * 0.55));
        kit.put('bark', plc2_seg(bxe, bye, bze, bxe + Math.cos(ba + 0.8) * bl * 0.35, bye + bl * 0.4, bze + Math.sin(ba + 0.8) * bl * 0.35, tr * 0.3));
        for (var l = 0; l < 11; l++) {
          var ls = rf(r, 0.7, 1.35) * sc, la = r() * 6.28, lr = rf(r, 0.3, 2.4) * sc, lc = new THREE.Color().setHSL(rf(r, 0.16, 0.22), rf(r, 0.3, 0.45), rf(r, 0.2, 0.3));
          kit.put('leaf', plc_m4(bxe + Math.cos(la) * lr, bye + rf(r, -0.6, 1.9) * sc, bze + Math.sin(la) * lr, ls * 1.15, ls * 0.8, ls * 1.15, r(), r() * 6, 0), lc);
        }
      }
      for (l = 0; l < 6; l++) {
        var top = new THREE.Color().setHSL(rf(r, 0.16, 0.21), 0.38, rf(r, 0.24, 0.3)), ta = r() * 6.28;
        kit.put('leaf', plc_m4(cx2 + Math.cos(ta) * 1.4 * sc, cy + rf(r, 3.0, 4.4) * sc, z + Math.sin(ta) * 1.4 * sc, 1.3 * sc, 0.95 * sc, 1.3 * sc, r(), r() * 6, 0), top);
      }
      F.claim(x, z, 3 * sc); trees++;
    };
    for (i = 0; i < 60 && trees < 14; i++) {
      var tz2 = lerp(-150, D - 2, Math.pow(r(), 1.3)), tw = wid(tz2), side2 = r() < 0.5 ? 1 : -1;
      var onTop = r() < 0.55, tu = side2 * (onTop ? tw + rf(r, 2.5, 8) : tw - rf(r, 1.2, 2.6)), tx3 = mid(tz2) + tu;
      if (Math.abs(tz2 - zc) < rw + 4) continue;
      if (!F.free(tx3, tz2, 3.6)) continue;
      tree(tx3, tz2, rf(r, 0.85, 1.25));
    }

    // the low water crossing: a slab across the bed with culverts, the road climbing out
    var mc = mid(zc), wc = wid(zc), rp = [], rix = [], nr = 0;
    for (var xq = mc - 140; xq <= mc + 140; xq += 0.7) {
      var inBed = Math.abs(xq - mc) < wc + 0.3, yq = inBed ? 0.47 : Math.max(hL(xq, zc), 0.46 * (1 - sstep(wc, wc + 3, Math.abs(xq - mc)))) + 0.04;
      rp.push(xq, yq, zc - rw, xq, yq, zc + rw);
      if (nr) rix.push((nr - 1) * 2, (nr - 1) * 2 + 1, nr * 2, nr * 2, (nr - 1) * 2 + 1, nr * 2 + 1);
      nr++;
    }
    var rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rgeo.setIndex(rix); rgeo.computeVertexNormals();
    var roadM = new THREE.Mesh(rgeo, mtl('#9A938A', 'concrete', 0.95, 0, 2.0)); roadM.receiveShadow = true; g.add(roadM);
    kit.box('conc', mc, 0.19, zc, 2 * wc + 0.6, 0.5, 2 * rw);
    for (k = -wc + 1.5; k < wc - 1; k += 2.6) {
      kit.put('pipe', plc_m4(mc + k, 0.2, zc, 0.19, 2 * rw + 0.1, 0.19, Math.PI / 2, 0, 0));
      kit.put('dark', plc_m4(mc + k, 0.2, zc + rw + 0.02, 0.18, 0.18, 1));
      kit.put('dark', plc_m4(mc + k, 0.2, zc - rw - 0.02, 0.18, 0.18, 1, 0, Math.PI, 0));
    }
    for (k = -wc; k <= wc + 0.1; k += 3.2) [-1, 1].forEach(function (e) {
      kit.box('post', mc + k, 0.46 + 0.5, zc + e * (rw + 0.15), 0.1, 1.0, 0.1);
      kit.box('refl', mc + k, 0.46 + 0.88, zc + e * (rw + 0.2), 0.08, 0.12, 0.02);
    });
    // depth posts: white boards with feet marked, at both ends of the slab
    var gaugeT = canvasTex(64, 512, function (gc) {
      gc.fillStyle = '#F4F2EC'; gc.fillRect(0, 0, 64, 512); gc.fillStyle = '#111'; gc.font = '700 44px ' + FONT_SANS; gc.textAlign = 'center';
      for (var f = 1; f <= 4; f++) { var y = 512 - f * 110; gc.fillRect(0, y, 64, 8); gc.fillText(String(f), 32, y + 52); }
      for (f = 0; f < 20; f++) gc.fillRect(0, 512 - f * 27.5, 22, 3);
    });
    var gm = std('#FFFFFF', 0.6, 0, { map: gaugeT });
    [-1, 1].forEach(function (e) {
      var gx = mc + e * (wc - 0.6), gp = box(0.22, 2.0, 0.05, gm); gp.position.set(gx, 0.46 + 1.0, zc + rw + 0.35); g.add(gp);
    });
    // the warning sign, facing the camera side of the crossing
    var sx = mc - s * (wc + rf(r, 4, 7)), sz = zc + rw + 2.2, sy = hL(sx, sz);
    var sg = new THREE.Group(); sg.position.set(sx, sy, sz); g.add(sg);
    var sp = box(0.09, 3.3, 0.09, std('#8D9196', 0.4, 0.8)); sp.position.y = 1.65; sg.add(sp);
    var dia = plc2_board(['LOW WATER', 'CROSSING'], 1.25, 1.25, '#E3B23C', '#161412', { border: '#161412', size: 0.46 });
    dia.rotation.z = Math.PI / 4; dia.position.set(0, 2.75, 0.06); dia.scale.set(0.92, 0.92, 1); sg.add(dia);
    var dia2 = plc2_board(['WHEN FLOODED', 'TURN AROUND'], 1.3, 0.55, '#F4F2EC', '#161412', { border: '#161412', size: 0.6 }); dia2.position.set(0, 1.55, 0.06); sg.add(dia2);
    var amb = [];
    [-1, 1].forEach(function (e) {
      var am = W.glow(glowMat('#FFA01E', 0.05), 0.05, 2.4), lamp = sph(0.12, am, 12, 8); lamp.position.set(e * 0.55, 3.6, 0.08); sg.add(lamp); amb.push(am);
    });
    shade(sg);
    var ambL = W.lamp('#FFA040', 0.8, 14, F.w(sx, sz + 0.6, sy + 3.4));
    W.onUpdate(function (ctx) { var p = Math.floor(ctx.real * 1.4) % 2; amb[0].emissiveIntensity *= p ? 1 : 0.05; amb[1].emissiveIntensity *= p ? 0.05 : 1; });
    F.claim(sx, sz, 1.2);
    for (k = -60; k <= 60; k += 5) F.claim(mc + k, zc, rw + 0.5);

    kit.flush(g);
    shade(g, true, true);
    roadM.castShadow = false;
    W.groundAt = hW;
    plc_scatter(W, { grass: '#A8956A', tufts: 2200, bushes: 380, rocks: 120, yucca: 6, bush: '#5E6A42' }, hW);
    plc_drapeLate(W, hW);
  }

  // =====================================================================
  // 3. RODEO ARENA
  // A county arena: a pipe fence round raked dirt, bucking chutes along the
  // back with the announcer's stand above them, aluminum bleachers, a tractor
  // left with its drag in the corner, three barrels set for the pattern. The
  // lights on the tall poles come on at dusk, before it is fully dark.
  // =====================================================================
  function plc2_rodeo(W) {
    W.shadowExtent = 60;
    var F = plc2_base(W, '#A48B68', '#6C6772', '#8A785F'), g = F.g, D = F.D, R = F.R, r = W.r, i, k;
    var s = W.P.seed % 2 ? 1 : -1, V = function (z) { return plc2_view(F, z); };
    var zB = -(R + rf(r, 11, 15)), zF = D + rf(r, 6, 10), hw = Math.max(R + 12, 19, V(zB) * 0.72), cr = 9;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1), CYL = new THREE.CylinderBufferGeometry(1, 1, 1, 10);
    var fenceC = pick(r, ['#E6E4DC', '#E6E4DC', '#7A4A30', '#9EA3A5', '#3E5A48']);
    var winLit = std('#252A2E', 0.15, 0.4); winLit.emissive = C('#FFD39A'); W.glow(winLit, 0, 0.9);
    var lensM = glowMat('#FFF1D6', 0.05);
    var kit = plc_kit()
      .def('pipe', CYL, std(fenceC, 0.45, fenceC === '#9EA3A5' ? 0.8 : 0.3))
      .def('alu', BOX, std('#C9CDD2', 0.35, 0.85))
      .def('wood', BOX, mtl('#7A5C3E', 'wood', 0.9, 0, 0.8))
      .def('paint', BOX, std('#FFFFFF', 0.7))
      .def('dark', BOX, std('#24262A', 0.6, 0.4))
      .def('win', BOX, winLit)
      .def('pole', new THREE.CylinderBufferGeometry(0.16, 0.24, 1, 8), std('#8E9296', 0.5, 0.6))
      .def('lens', BOX, lensM, { cast: false })
      .def('tire', new THREE.CylinderBufferGeometry(1, 1, 1, 18), std('#18191B', 0.9))
      .def('barrel', new THREE.CylinderBufferGeometry(0.29, 0.29, 0.88, 18), std('#FFFFFF', 0.5, 0.3))
      .def('horn', new THREE.ConeBufferGeometry(0.22, 0.5, 12, 1, true), std('#D8D6D0', 0.5, 0.3, { side: THREE.DoubleSide }));

    // the arena floor: raked dirt, a rounded rectangle
    var sh = new THREE.Shape(), X0 = -hw, X1 = hw;
    sh.moveTo(X0 + cr, -zF); sh.lineTo(X1 - cr, -zF); sh.quadraticCurveTo(X1, -zF, X1, -zF + cr); sh.lineTo(X1, -zB - cr);
    sh.quadraticCurveTo(X1, -zB, X1 - cr, -zB); sh.lineTo(X0 + cr, -zB); sh.quadraticCurveTo(X0, -zB, X0, -zB - cr);
    sh.lineTo(X0, -zF + cr); sh.quadraticCurveTo(X0, -zF, X0 + cr, -zF);
    var fg = new THREE.ShapeBufferGeometry(sh, 12); fg.rotateX(-Math.PI / 2);
    var dirt = new THREE.Mesh(fg, detail(std('#9A7658', 1, 0), 'plc2_rake', { tile: 4.5, albedo: 0.55, rough: 0.3, bump: 0.8 }));
    dirt.position.y = 0.025; dirt.receiveShadow = true; g.add(dirt);
    // the fence: posts every 2.4 m, five pipe rails
    var path = sh.getSpacedPoints(Math.round(2 * (2 * hw + zF - zB) / 2.4)).map(function (p) { return [p.x, -p.y]; });
    var chX0 = s * rf(r, 1, 4), nCh = 6, chW = 1.15, chA = Math.min(chX0, chX0 + s * nCh * chW), chB = Math.max(chX0, chX0 + s * nCh * chW);
    for (i = 0; i < path.length - 1; i++) {
      var a = path[i], b = path[i + 1];
      if (Math.abs(a[1] - zB) < 0.3 && a[0] > chA - 0.5 && a[0] < chB + 0.5) continue;
      kit.box('pipe', a[0], 1.05, a[1], 0.06, 2.1, 0.06);
      [0.35, 0.75, 1.15, 1.55, 1.95].forEach(function (y) { kit.put('pipe', plc2_seg(a[0], y, a[1], b[0], y, b[1], 0.038)); });
      F.claim(a[0], a[1], 0.4);
    }
    // bucking chutes along the back fence, numbered gates, the announcer above
    for (i = 0; i <= nCh; i++) {
      var cx = chX0 + s * i * chW;
      kit.box('pipe', cx, 1.2, zB, 0.07, 2.4, 0.07);
      kit.box('pipe', cx, 1.2, zB - 3.2, 0.07, 2.4, 0.07);
      for (k = 0; k < 6; k++) kit.box('wood', cx, 0.35 + k * 0.36, zB - 1.6, 0.06, 0.24, 3.2);
      if (i < nCh) {
        var gx = cx + s * chW / 2;
        kit.box('paint', gx, 1.15, zB + 0.02, chW - 0.12, 1.8, 0.06, 0, pick(r, ['#E6E1D3', '#C8B79A', '#B5452F', '#2F5D50']));
        var num = plc2_board([String(i + 1)], 0.42, 0.42, '#F4F0E6', '#1A1A1A', { size: 0.85 });
        num.position.set(gx, 1.55, zB + 0.06); g.add(num);
        kit.box('pipe', gx, 2.45, zB - 1.6, chW, 0.05, 0.05);
      }
    }
    kit.box('wood', (chA + chB) / 2, 2.42, zB - 3.3, chB - chA + 0.3, 0.12, 0.2);
    var ax = (chA + chB) / 2 + s * 1.2, az = zB - 5.4, fl = 3.6;
    [[-2.2, -1.3], [2.2, -1.3], [-2.2, 1.3], [2.2, 1.3]].forEach(function (q) { kit.box('wood', ax + q[0], fl / 2, az + q[1], 0.22, fl, 0.22); });
    kit.box('wood', ax, fl, az, 5.2, 0.2, 3.2);
    kit.box('paint', ax, fl + 1.45, az, 4.6, 2.7, 2.6, 0, '#E9E4D8');
    kit.box('win', ax, fl + 1.75, az + 1.31, 4.0, 0.9, 0.04);
    [-1.33, 0, 1.33].forEach(function (e) { kit.box('paint', ax + e, fl + 1.75, az + 1.33, 0.08, 0.95, 0.04, 0, '#3A342E'); });
    kit.box('dark', ax, fl + 2.9, az + 0.3, 5.4, 0.18, 3.6);
    [-1, 1].forEach(function (e) { kit.put('horn', plc_m4(ax + e * 1.6, fl + 3.35, az + 1.2, 1, 1, 1, -1.35, e * 0.35, 0)); kit.box('dark', ax + e * 1.6, fl + 3.15, az + 1.0, 0.05, 0.3, 0.05); });
    for (k = 0; k < 12; k++) kit.box('wood', ax - s * (2.6 + k * 0.32), fl - k * 0.3, az - 1.0, 0.3, 0.06, 1.0);
    var boothL = W.lamp('#FFD39A', 0.9, 12, F.w(ax, az + 2.2, fl + 1.8));
    F.claim(ax, az, 3.5); F.claim((chA + chB) / 2, zB - 1.6, 3.5);

    // aluminum bleachers outside the side fence, near the back
    var bx0 = -s * (hw + 1.6), bz = zB + rf(r, 9, 13), bL = rf(r, 14, 20);
    for (k = 0; k < 7; k++) {
      var bxk = bx0 - s * k * 0.85, by = 0.45 + k * 0.42;
      kit.box('alu', bxk, by, bz, 0.32, 0.05, bL);
      kit.box('alu', bxk - s * 0.42, by - 0.22, bz, 0.26, 0.04, bL);
    }
    for (k = -bL / 2; k <= bL / 2 + 0.01; k += bL / 4) {
      kit.put('alu', plc2_seg(bx0 + s * 0.1, 0, bz + k, bx0 - s * 6 * 0.85, 0.45 + 6 * 0.42, bz + k, 0.05));
      kit.box('alu', bx0 - s * 6 * 0.85, (0.45 + 6 * 0.42) / 2, bz + k, 0.08, 0.45 + 6 * 0.42, 0.08);
      kit.box('alu', bx0 - s * 6.3 * 0.85, 0.45 + 6 * 0.42 + 0.5, bz + k, 0.05, 1.0, 0.05);
    }
    kit.box('alu', bx0 - s * 6.3 * 0.85, 0.45 + 6 * 0.42 + 1.0, bz, 0.05, 0.05, bL);
    F.claimRect(Math.min(bx0, bx0 - s * 6), Math.max(bx0, bx0 - s * 6), bz - bL / 2, bz + bL / 2, 3);

    // light poles round the arena; the heads face in
    var poles = [[-hw - 2.5, zB - 1], [hw + 2.5, zB - 1], [-hw - 2.5, (zB + zF) / 2], [hw + 2.5, (zB + zF) / 2], [-hw - 2.5, zF + 1], [hw + 2.5, zF + 1]];
    var lamps = [];
    poles.forEach(function (p, n) {
      var PH = 15, yaw = Math.atan2(-p[0], ((zB + zF) / 2) - p[1]);
      kit.box('pole', p[0], PH / 2, p[1], 1, PH, 1);
      var M = plc_m4(p[0], PH, p[1], 1, 1, 1, 0, yaw, 0);
      kit.box('dark', 0, 0.1, 0.2, 2.6, 0.1, 0.1, 0, null, M); kit.box('dark', 0, 0.9, 0.2, 2.6, 0.1, 0.1, 0, null, M);
      for (var e = -1; e <= 1; e += 2) for (var f = 0; f < 2; f++) {
        var hm = plc_m4(e * 0.7, 0.1 + f * 0.8 + 0.3, 0.45, 1, 1, 1, 0.45, 0, 0).premultiply(M);
        kit.box('dark', 0, 0, 0, 0.62, 0.5, 0.32, 0, null, hm);
        kit.box('lens', 0, 0, 0.17, 0.5, 0.4, 0.02, 0, null, hm);
      }
      F.claim(p[0], p[1], 0.8);
      if (n < 4) lamps.push(W.lamp('#FFF0D8', 1.1, 80, F.w(p[0] * 0.92, p[1] + (p[1] < 0 ? 1 : -1), PH - 1)));
    });
    W.onUpdate(function (ctx) {
      var dk = plc2_dusk(ctx);
      lensM.emissiveIntensity = lerp(0.03, 2.2, dk);
      for (var q = 0; q < lamps.length; q++) lamps[q].intensity = lamps[q].userData.full * dk;
    });

    // three barrels set for the cloverleaf, a tractor with its drag in a corner
    var bcol = pick(r, [['#2B5DAA', '#2B5DAA', '#2B5DAA'], ['#B5332A', '#E3E0D6', '#2B5DAA'], ['#D8A430', '#D8A430', '#D8A430'], ['#3C7A4A', '#3C7A4A', '#3C7A4A']]);
    [[-(R + rf(r, 4, 6)), rf(r, -3, 1)], [R + rf(r, 4, 6), rf(r, -3, 1)], [rf(r, -2, 2), zB + rf(r, 4, 6)]].forEach(function (q, n) {
      if (!F.free(q[0], q[1], 0.5)) return;
      kit.box('barrel', q[0], 0.46, q[1], 1, 1, 1, 0, bcol[n]); F.claim(q[0], q[1], 0.6);
    });
    var tx = -s * (hw - 5), tz = zB + 4.5, TM = plc_m4(tx, 0, tz, 1, 1, 1, 0, s * 0.5 + rf(r, -0.2, 0.2), 0), tcol = pick(r, ['#9E2B22', '#2F5E3A', '#C9A13A', '#3E6A8A']);
    if (F.free(tx, tz, 3)) {
      kit.box('paint', 0.3, 1.25, 0, 2.2, 0.8, 0.9, 0, tcol, TM); kit.box('paint', -0.9, 1.3, 0, 0.9, 1.0, 1.1, 0, tcol, TM);
      kit.box('dark', -0.8, 2.2, 0, 0.1, 0.9, 0.1, 0, null, TM); kit.box('dark', 1.2, 1.9, 0.2, 0.08, 0.6, 0.08, 0, null, TM);
      [[-1.1, 0.95, 0.85, 0.5], [-1.1, -0.95, 0.85, 0.5], [1.15, 0.8, 0.5, 0.3], [1.15, -0.8, 0.5, 0.3]].forEach(function (w) { kit.put('tire', plc_m4(w[0], w[2], w[1], w[2], w[3], w[2], Math.PI / 2, 0, 0).premultiply(TM)); });
      kit.box('dark', -3.4, 0.25, 0, 2.2, 0.12, 3.4, 0, null, TM);
      for (k = -1.4; k <= 1.41; k += 0.35) kit.box('dark', -3.4, 0.12, k, 2.0, 0.22, 0.03, 0, null, TM);
      F.claim(tx, tz, 3);
    }
    // horse trailers and pickups parked outside, beyond the chutes
    for (i = 0; i < 4; i++) {
      var px = s * (hw + rf(r, 8, 30)), pz = zB + rf(r, -18, 6);
      if (!F.free(px, pz, 4)) continue;
      var PM = plc_m4(px, 0, pz, 1, 1, 1, 0, rf(r, -0.3, 0.3) + Math.PI / 2, 0);
      kit.box('paint', 0, 1.55, 0, 7, 2.2, 2.3, 0, pick(r, ['#E8E6E0', '#C9CDD2', '#E2DCCD']), PM);
      for (k = -2.5; k <= 2.6; k += 1.25) kit.box('dark', k, 2.2, 1.16, 0.7, 0.35, 0.02, 0, null, PM);
      [-0.6, 0.6].forEach(function (e) { kit.put('tire', plc_m4(e, 0.38, 1.1, 0.38, 0.25, 0.38, Math.PI / 2, 0, 0).premultiply(PM)); kit.put('tire', plc_m4(e, 0.38, -1.1, 0.38, 0.25, 0.38, Math.PI / 2, 0, 0).premultiply(PM)); });
      F.claim(px, pz, 4);
    }

    kit.flush(g);
    shade(g, true, true);
    dirt.castShadow = false;
    plc2_scatterOut(W, F, [[-hw, hw, zB, zF, 4]], { grass: '#A89066', tufts: 1500, bushes: 320, rocks: 160, yucca: 8 });
  }

  // =====================================================================
  // 4. GHOST TOWN
  // After Shafter, the silver town in the Chinati Mountains south of Marfa:
  // stone and adobe houses with their roofs long gone, walls broken down to
  // uneven tops, a small whitewashed church that someone still keeps, crosses
  // in the yard beside it, the mine's headframe on the hill and pale tailings
  // spilling down below. After dark only the church is lit.
  // =====================================================================
  function plc2_ghost(W) {
    W.shadowExtent = 55;
    var F = plc2_base(W, '#A38A68', '#6E6A76', '#8C7A62'), g = F.g, D = F.D, R = F.R, r = W.r, i, j, k, sd = W.P.seed;
    var s = W.P.seed % 2 ? 1 : -1, flat = W.groundAt;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    // the hill: a long rise behind, the headframe near its top
    var zh = -(R + rf(r, 150, 200)), xh = s * Math.tan(rf(r, 16, 23) * D2R) * (D - zh), Hh = rf(r, 20, 30), Rh = rf(r, 55, 72);
    var hillH = function (x, z) {
      var dx = (x - xh) / 1.3, dz = z - zh, d2 = (dx * dx + dz * dz) / (Rh * Rh), e = Math.exp(-1.7 * d2);
      return Hh * e * (0.75 + 0.5 * fbm(x / 60, z / 60, sd + 51, 3)) + 5 * (fbm(x / 13, z / 13, sd + 54, 3) - 0.4) * sstep(0.05, 0.4, e);
    };
    var hW = function (wx, wz) { var q = F.loc(wx, wz); return flat(wx, wz) + hillH(q[0], q[1]); };
    W.groundAt = hW;
    var NR = 34, NA = 72, pos = [], col = [], idx = [], cc = new THREE.Color(), c0 = C('#948670'), c1 = C('#7E7466'), c2 = C('#66664A');
    for (i = 0; i <= NR; i++) for (j = 0; j < NA; j++) {
      var rr = 2.3 * Rh * Math.pow(i / NR, 1.3), a = j / NA * 6.2832, x = xh + Math.sin(a) * rr * 1.3, z = zh + Math.cos(a) * rr;
      var w = F.w(x, z), h = flat(w.x, w.z) + hillH(x, z) - 0.4 * sstep(0.75, 1, i / NR);
      pos.push(x, h, z);
      var n = fbm(x / 14, z / 14, sd + 52, 3);
      cc.copy(c0).lerp(c1, sstep(0.4, 0.7, n)).lerp(c2, 0.5 * sstep(0.55, 0.8, fbm(x / 40, z / 40, sd + 53, 2)) * sstep(0.2, 0.6, i / NR));
      cc.multiplyScalar(0.85 + 0.3 * n); col.push(cc.r, cc.g, cc.b);
    }
    for (i = 0; i < NR; i++) for (j = 0; j < NA; j++) { var a0 = i * NA + j, b0 = i * NA + (j + 1) % NA; idx.push(a0, b0, a0 + NA, b0, b0 + NA, a0 + NA); }
    var hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hg.setIndex(idx); hg.computeVertexNormals();
    var hill = new THREE.Mesh(hg, detail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 'stone', { tile: 3, albedo: 0.35, bump: 0.5 }));
    hill.receiveShadow = true; g.add(hill);
    var yAt = function (x, z) { var w2 = F.w(x, z); return flat(w2.x, w2.z) + hillH(x, z); };

    var kit = plc_kit()
      .def('stone', BOX, std('#FFFFFF', 0.95, 0, { tex: 'stone', tile: 0.9 }))
      .def('rub', new THREE.DodecahedronBufferGeometry(1, 0), std('#FFFFFF', 1, 0, { flatShading: true }))
      .def('wood', BOX, mtl('#5E4A38', 'wood', 1, 0, 0.8))
      .def('grey', BOX, mtl('#8C8680', 'wood', 1, 0, 0.8))
      .def('rust', BOX, mtl('#7A4A2E', 'rust', 0.85, 0.3, 1.4))
      .def('beam', new THREE.CylinderBufferGeometry(1, 1, 1, 6), mtl('#6B5644', 'wood', 1, 0, 0.8))
      .def('pole', new THREE.CylinderBufferGeometry(0.12, 0.15, 1, 7), mtl('#6B5A48', 'wood', 1, 0, 1.2))
      .def('tail', new THREE.CylinderBufferGeometry(0.62, 1, 1, 28, 3), std('#FFFFFF', 1, 0, { flatShading: true, tex: 'sand', tile: 1.2 }));

    // the headframe: two legs, back braces, a sheave wheel, the hoist house behind
    var hx = xh - s * rf(r, 6, 16), hz = zh + rf(r, 4, 14), hy = yAt(hx, hz), HF = rf(r, 13, 17);
    var HM = plc_m4(hx, hy, hz, 1, 1, 1, 0, Math.atan2(-hx, D - hz) + rf(r, -0.4, 0.4), 0);
    [-1, 1].forEach(function (e) {
      kit.put('beam', plc2_seg(e * 1.3, 0, 0, e * 0.8, HF, 0, 0.2).premultiply(HM));
      kit.put('beam', plc2_seg(e * 1.6, 0, -7, e * 0.8, HF - 0.6, -0.2, 0.17).premultiply(HM));
      for (k = 1; k < 5; k++) { var y0 = HF * k / 5; kit.put('beam', plc2_seg(e * lerp(1.3, 0.8, y0 / HF), y0, 0, e * lerp(1.3, 0.8, (y0 + HF / 5) / HF), y0 + HF / 5, 0, 0.07).premultiply(HM)); }
    });
    for (k = 1; k <= 5; k++) { var yk = HF * k / 5.2; kit.put('beam', plc2_seg(-lerp(1.3, 0.8, yk / HF), yk, 0, lerp(1.3, 0.8, yk / HF), yk, 0, 0.09).premultiply(HM)); }
    kit.box('wood', 0, HF + 0.1, -0.3, 2.4, 0.25, 1.4, 0, null, HM);
    var sheave = new THREE.Mesh(new THREE.TorusBufferGeometry(1.2, 0.09, 6, 28), mtl('#3A3330', 'rust', 0.7, 0.5, 1));
    sheave.position.set(0, HF + 1.3, -0.3); sheave.rotation.y = Math.PI / 2;
    var sp = new THREE.Group(); sp.add(sheave);
    for (k = 0; k < 6; k++) { var spk = box(0.06, 2.3, 0.06, sheave.material); spk.position.copy(sheave.position); spk.rotation.x = k * Math.PI / 6; sp.add(spk); }
    sp.applyMatrix4(HM); g.add(sp);
    kit.box('rust', 0, 2.6, -13, 6, 5.2, 7.5, 0, null, HM);
    kit.put('rust', plc_m4(0, 5.8, -13, 6.4, 0.2, 4.4, 0.45, 0, 0).premultiply(new THREE.Matrix4().makeTranslation(0, 0, -1.9)).premultiply(HM));
    kit.put('rust', plc_m4(0, 5.8, -13, 6.4, 0.2, 4.4, -0.45, 0, 0).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 1.9)).premultiply(HM));
    kit.box('grey', 1.8, 7.5, -14, 0.5, 5, 0.5, 0, null, HM);
    var hv = new THREE.Vector3(0, HF + 1.3, -1.5).applyMatrix4(HM), he = new THREE.Vector3(0, 4.2, -9.3).applyMatrix4(HM);
    plc2_line(g, [hv, he], '#2A2420');
    // tailings below: pale, flat topped, one rust coloured
    var tl = ri(r, 2, 3);
    for (i = 0; i < tl; i++) {
      var tx = xh - s * i * rf(r, 26, 36) + rf(r, -6, 6), tz = zh + Rh * rf(r, 1.0, 1.3), tr = rf(r, 10, 18), th = rf(r, 4, 7), ymin = 1e9;
      for (k = 0; k < 8; k++) ymin = Math.min(ymin, yAt(tx + Math.sin(k * 0.785) * tr, tz + Math.cos(k * 0.785) * tr));
      kit.put('tail', plc_m4(tx, ymin + th / 2 - 0.5, tz, tr, th, tr * rf(r, 0.6, 0.9), 0, r() * 6, 0), i === 1 ? '#B88A5E' : pick(r, ['#CFC8B8', '#C4BCA8', '#D6CDB6']));
      F.claim(tx, tz, tr);
    }
    F.claim(hx, hz, 8);

    // ruins: roofless houses with broken wall tops, doors and windows open
    var tones = ['#A08C72', '#AE9A7C', '#B58F6C', '#968774', '#BBA286'], ruins = 0;
    var ruin = function (x, z, big) {
      var wd = rf(r, 4, 7.5) * big, dp = rf(r, 3.8, 6.5) * big, hb = rf(r, 1.6, 3.3) * (big < 0.85 ? 0.55 : 1), T = 0.5, tone = pick(r, tones);
      var M = plc_m4(x, 0, z, 1, 1, 1, 0, Math.atan2(-x, D - z) + rf(r, -0.5, 0.5), 0);
      var walls = [[-wd / 2, -dp / 2, wd / 2, -dp / 2], [wd / 2, -dp / 2, wd / 2, dp / 2], [wd / 2, dp / 2, -wd / 2, dp / 2], [-wd / 2, dp / 2, -wd / 2, -dp / 2]];
      var door = ri(r, 0, 3), gone = r() < 0.35 ? ri(r, 0, 3) : -1;
      walls.forEach(function (wl, n) {
        var L = Math.hypot(wl[2] - wl[0], wl[3] - wl[1]), ns = Math.max(3, Math.round(L / 0.9)), sl = L / ns, ang = Math.atan2(wl[3] - wl[1], wl[2] - wl[0]);
        for (var q = 0; q < ns; q++) {
          var t = (q + 0.5) / ns, cxq = lerp(wl[0], wl[2], t), czq = lerp(wl[1], wl[3], t), edge = Math.min(q, ns - 1 - q);
          var h = hb * (edge === 0 ? rf(r, 0.8, 1.05) : rf(r, 0.3, 0.95));
          if (n === gone) h *= rf(r, 0.15, 0.4);
          if (n === door && Math.abs(q - (ns - 1) / 2) < 0.6) {
            if (h > 2.4) kit.put('stone', plc_m4(cxq, (2.15 + h) / 2, czq, sl + 0.02, h - 2.15, T, 0, -ang, 0).premultiply(M), tone);
            if (h > 2.4) kit.put('wood', plc_m4(cxq, 2.12, czq, sl + 0.5, 0.14, T + 0.05, 0, -ang, 0).premultiply(M));
            continue;
          }
          if (n !== door && n !== gone && q === Math.floor(ns / 2) && h > 2.0) {
            kit.put('stone', plc_m4(cxq, 0.5, czq, sl + 0.02, 1.0, T, 0, -ang, 0).premultiply(M), tone);
            kit.put('stone', plc_m4(cxq, (1.75 + h) / 2, czq, sl + 0.02, h - 1.75, T, 0, -ang, 0).premultiply(M), tone);
            continue;
          }
          kit.put('stone', plc_m4(cxq, h / 2, czq, sl + 0.02, h, T, 0, -ang, 0).premultiply(M), tone);
        }
      });
      for (var q2 = 0; q2 < 10; q2++) {
        var ra = r() * 6.28, rs = rf(r, 0.12, 0.4), rrx = Math.cos(ra) * wd * rf(r, 0.35, 0.65), rrz = Math.sin(ra) * dp * rf(r, 0.35, 0.65);
        kit.put('rub', plc_m4(rrx, rs * 0.3, rrz, rs, rs * 0.6, rs, r(), r() * 6, r()).premultiply(M), tone);
      }
      if (r() < 0.4) { var vy = hb * 0.9; for (var v = 0; v < 3; v++) kit.put('beam', plc2_seg(-wd / 2 + 1 + v * 1.2, vy - v * 0.3, -dp / 2 - 0.3, -wd / 2 + 1.4 + v * 1.2, vy - 0.8 - v * 0.2, dp * 0.1, 0.1).premultiply(M)); }
      F.claim(x, z, Math.max(wd, dp) * 0.62); ruins++;
    };
    for (i = 0; i < 90 && ruins < 13; i++) {
      var far = ruins < 9, ang2 = far ? rf(r, -30, 30) : rf(r, 16, 30) * (r() < 0.5 ? -1 : 1), dist = far ? rf(r, D + R + 6, D + 95) : rf(r, D * 0.5, D + R + 6);
      var p = W.inView(ang2, dist), q3 = F.loc(p.x, p.z);
      if (hillH(q3[0], q3[1]) > 0.8) continue;
      if (!F.free(q3[0], q3[1], 4.5)) continue;
      ruin(q3[0], q3[1], far ? rf(r, 0.9, 1.3) : 0.8);
    }
    // a wall fragment close behind the clock
    var fz = -(R + rf(r, 3, 5)), fx = s * rf(r, 1, 3);
    for (k = 0; k < 5; k++) kit.put('stone', plc_m4(fx + k * 0.95, 0.35 + (k === 2 ? 0.5 : 0.2 * r()), fz, 0.97, 0.7 + (k === 2 ? 1.0 : 0.4 * r()), 0.5, 0, 0.2 * s, 0), '#A48F74');

    // the church: whitewashed, a bell gable over the door, a tin roof
    var chP = W.inView(-s * rf(r, 12, 19), D + R + rf(r, 24, 36)), cq = F.loc(chP.x, chP.z), chx = cq[0], chz = cq[1];
    var CH = new THREE.Group(); CH.position.set(chx, 0, chz); CH.rotation.y = Math.atan2(-chx, D - chz) + s * rf(r, 0.2, 0.5); g.add(CH);
    var wash = mtl('#E6DECB', 'plaster', 0.95, 0, 1.4), NW = 5.6, NH = 4.4, NL = 10;
    var nave = box(NW, NH, NL, wash); nave.position.set(0, NH / 2, -NL / 2); CH.add(nave);
    var tin = canvasTex(16, 64, function (gc) { for (var y = 0; y < 16; y++) { var v = 120 + 50 * Math.sin(y / 16 * 6.28); gc.fillStyle = 'rgb(' + (v | 0) + ',' + ((v * 0.95) | 0) + ',' + ((v * 0.9) | 0) + ')'; gc.fillRect(y, 0, 1, 64); } }, { repeat: [NL * 3, 1] });
    var rs2 = new THREE.Shape(); rs2.moveTo(-NW / 2 - 0.4, 0); rs2.lineTo(NW / 2 + 0.4, 0); rs2.lineTo(0, 2.1); rs2.lineTo(-NW / 2 - 0.4, 0);
    var rg = new THREE.ExtrudeBufferGeometry(rs2, { depth: NL + 0.4, bevelEnabled: false }); rg.translate(0, 0, -NL - 0.4);
    var roof = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: C('#B7A99A'), map: tin, roughness: 0.6, metalness: 0.5, flatShading: true })); roof.position.y = NH; CH.add(roof);
    var fs = new THREE.Shape(), fw = NW / 2 + 0.3, ft = NH + 4.2;
    fs.moveTo(-fw, 0); fs.lineTo(fw, 0); fs.lineTo(fw, NH + 0.4); fs.quadraticCurveTo(fw * 0.4, NH + 1.2, 1.1, NH + 2.2); fs.lineTo(1.1, ft - 0.6);
    fs.quadraticCurveTo(1.1, ft, 0, ft); fs.quadraticCurveTo(-1.1, ft, -1.1, ft - 0.6); fs.lineTo(-1.1, NH + 2.2); fs.quadraticCurveTo(-fw * 0.4, NH + 1.2, -fw, NH + 0.4); fs.lineTo(-fw, 0);
    fs.holes.push(plc2_arch(new THREE.Path(), -0.55, NH + 2.35, 1.1, 1.5, 10));
    fs.holes.push(plc2_arch(new THREE.Path(), -0.8, 0, 1.6, 2.7, 10));
    var fgeo = new THREE.ExtrudeBufferGeometry(fs, { depth: 0.6, bevelEnabled: false, curveSegments: 10 });
    var fac = new THREE.Mesh(fgeo, wash); fac.position.z = -0.2; CH.add(fac);
    var bell = new THREE.Mesh(new THREE.LatheBufferGeometry([[0, 0.5], [0.12, 0.48], [0.2, 0.3], [0.32, 0.02], [0.34, 0]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 14, 0, 6.2832), std('#6E5A3A', 0.4, 0.9, { side: THREE.DoubleSide }));
    bell.position.set(0, NH + 2.7, 0.1); CH.add(bell);
    var cross = new THREE.Group(), cw = mtl('#4A3A2C', 'wood', 1, 0, 0.6);
    var c1 = box(0.12, 1.1, 0.12, cw); c1.position.y = 0.55; cross.add(c1); var c2b = box(0.6, 0.12, 0.12, cw); c2b.position.y = 0.72; cross.add(c2b);
    cross.position.set(0, ft, 0.1); CH.add(cross);
    var doorM = std('#1E1812', 0.8); doorM.emissive = C('#FFB060'); W.glow(doorM, 0, 0.55);
    var dr = box(1.5, 2.6, 0.08, doorM); dr.position.set(0, 1.3, -0.05); CH.add(dr);
    var dl = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.8, 2.3), mtl('#5A3B26', 'wood', 0.8, 0, 0.5)); dl.position.set(-0.78, 1.2, 0.95); dl.rotation.y = -1.1; CH.add(dl);
    [-1, 1].forEach(function (e) { for (var q = 0; q < 2; q++) { var wn = box(0.08, 1.1, 0.7, doorM); wn.position.set(e * (NW / 2 + 0.01), 2.6, -2.8 - q * 4); CH.add(wn); } });
    var stepM = mtl('#B8AE9C', 'stone', 0.9, 0, 1);
    for (k = 0; k < 2; k++) { var st = box(2.6 - k * 0.5, 0.18, 1.0 - k * 0.3, stepM); st.position.set(0, 0.09 + k * 0.18, 0.9 - k * 0.15); CH.add(st); }
    var candM = W.glow(glowMat('#FFB45A', 0.05), 0.05, 2.2);
    [-0.9, 0.85, 1.05].forEach(function (x2, n) { var cd = cyl(0.035, 0.035, 0.22, 8, std('#EFE6D2', 0.6)); cd.position.set(x2, 0.47, 1.05 - n * 0.05); CH.add(cd); var fl = sph(0.03, candM, 6, 4); fl.position.set(x2, 0.62, 1.05 - n * 0.05); CH.add(fl); });
    shade(CH);
    W.lamp('#FFB060', 1.2, 14, new THREE.Vector3(0, 1.3, 1.6), CH);
    W.lamp('#FFA050', 0.5, 9, new THREE.Vector3(0, 2.2, -5), CH);
    var candL = W.lamp('#FFB45A', 0.5, 5, new THREE.Vector3(0, 0.8, 1.4), CH);
    W.onUpdate(function (ctx) { candL.intensity *= 0.8 + 0.2 * Math.sin(ctx.real * 9.1) * Math.sin(ctx.real * 4.3); });
    F.claim(chx, chz - NL / 2 * Math.cos(CH.rotation.y), 7);
    // the churchyard: crosses in rows, some leaning, a low stone wall
    var yx = chx + s * 9 * Math.cos(CH.rotation.y), yz = chz - 2, YM = plc_m4(yx, 0, yz, 1, 1, 1, 0, CH.rotation.y, 0);
    for (i = 0; i < 16; i++) {
      var ox = (i % 4) * 2.1 - 3.1 + rf(r, -0.3, 0.3), oz = -Math.floor(i / 4) * 2.2 + rf(r, -0.3, 0.3), lean = rf(r, -0.2, 0.2), white = r() < 0.5, ch2 = rf(r, 0.8, 1.2);
      var CM = plc_m4(ox, 0, oz, 1, 1, 1, lean, rf(r, -0.2, 0.2), lean * 0.5).premultiply(YM);
      kit.put(white ? 'stone' : 'grey', plc_m4(0, ch2 / 2, 0, 0.09, ch2, 0.09).premultiply(CM), white ? '#EDE8DC' : null);
      kit.put(white ? 'stone' : 'grey', plc_m4(0, ch2 * 0.72, 0, 0.5, 0.08, 0.09).premultiply(CM), white ? '#EDE8DC' : null);
      if (r() < 0.4) kit.put('rub', plc_m4(0, 0.05, 0.5, 0.35, 0.12, 0.7).premultiply(CM), '#8E7E68');
    }
    [[0, 1.6, 10.4, 0], [0, -8.2, 10.4, 0], [-5.2, -3.3, 9.8, 1], [5.2, -3.3, 9.8, 1]].forEach(function (q) {
      kit.put('stone', plc_m4(q[0], 0.3, q[1], q[3] ? 0.4 : q[2], 0.6, q[3] ? q[2] : 0.4).premultiply(YM), '#A8977E');
    });
    F.claim(yx, yz - 3.3, 7);
    // telephone poles along the old road, leaning, no wires left
    var pa = rf(r, -20, 20) * D2R;
    for (i = 0; i < 7; i++) {
      var pp = W.inView(s * rf(r, 22, 30) - i * s * 4, D + 10 + i * 22), pq = F.loc(pp.x, pp.z);
      if (!F.free(pq[0], pq[1], 0.8)) continue;
      var lx = rf(r, -0.12, 0.12), lz = rf(r, -0.12, 0.12);
      kit.put('pole', plc_m4(pq[0], 3.8, pq[1], 1, 7.6, 1, lx, 0, lz)); kit.put('grey', plc_m4(pq[0] + lz * 7, 7.2, pq[1] - lx * 7, 1.8, 0.12, 0.12, lx, pa, lz));
      F.claim(pq[0], pq[1], 0.8);
    }

    kit.flush(g);
    shade(g, true, true);
    plc_scatter(W, { grass: '#A8926A', tufts: 1600, bushes: 420, rocks: 300, yucca: 9, ocotillo: 6, bush: '#66703F' }, hW);
  }

  // =====================================================================
  // 5. AEROSTAT FIELD
  // A tethered balloon mooring field on the flats, drawn plainly: a gravel
  // yard inside a chain link fence, a concrete pad with painted rings, a
  // lattice mooring mast with its boom swung downwind, and the tether going up
  // out of the frame. A low building, a windsock, floodlights on the fence.
  // Nothing is marked or lettered. After dark the lights on the mast and on
  // the tether blink.
  // =====================================================================
  function plc2_aerostat(W) {
    W.shadowExtent = 48;
    var F = plc2_base(W, '#AE9670', '#6C6772', '#8A785F'), g = F.g, D = F.D, R = F.R, r = W.r, i, k;
    var s = W.P.seed % 2 ? 1 : -1;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1), CYL = new THREE.CylinderBufferGeometry(1, 1, 1, 8);
    var wl = F.loc(W.windDir.x, W.windDir.z), wx = wl[0], wz = wl[1];
    var zf = -(R + rf(r, 6, 9)), zs = zf - rf(r, 32, 46), xs = s * Math.tan(rf(r, 6, 13) * D2R) * (D - zs), X0 = xs - 120, X1 = xs + 120, Z1 = zs - 90;
    var redM = W.glow(glowMat('#FF2A18', 0.3), 0.3, 2.6), whiteM = W.glow(glowMat('#FFFFFF', 0.2), 0.2, 3.0);
    var kit = plc_kit()
      .def('steel', CYL, std('#C4C8CC', 0.4, 0.8))
      .def('post', CYL, std('#9DA2A6', 0.45, 0.8))
      .def('conc', BOX, mtl('#B9B2A6', 'concrete', 0.92, 0, 2))
      .def('bldg', BOX, std('#FFFFFF', 0.7, 0.2))
      .def('dark', BOX, std('#2A2D31', 0.5, 0.4))
      .def('win', BOX, (function () { var m = std('#1F2528', 0.15, 0.5); m.emissive = C('#CFE6FF'); return W.glow(m, 0, 0.7); })())
      .def('head', BOX, std('#3A3D40', 0.5, 0.5))
      .def('lens', BOX, plc_glow(W, '#FFF6E0', 0.05, 2.4), { cast: false })
      .def('tire', new THREE.CylinderBufferGeometry(0.38, 0.38, 0.26, 14), std('#18191B', 0.9));

    // the yard: gravel inside the fence, the pad, the painted rings
    var yard = box(X1 - X0, 0.04, zf - Z1, mtl('#9E978B', 'stone', 1, 0, 0.8)); yard.position.set(xs, 0.0, (zf + Z1) / 2); yard.receiveShadow = true; g.add(yard);
    var PR = rf(r, 26, 32), pad = cyl(PR, PR, 0.12, 72, mtl('#C2BCB0', 'concrete', 0.9, 0, 2.4)); pad.position.set(xs, 0.04, zs); pad.receiveShadow = true; g.add(pad);
    [[PR - 1.2, '#E3B23C'], [PR * 0.55, '#F1EFE8'], [3.2, '#E3B23C']].forEach(function (q) {
      var rg = new THREE.Mesh(new THREE.RingBufferGeometry(q[0] - 0.25, q[0], 96), std(q[1], 0.7)); rg.rotation.x = -Math.PI / 2; rg.position.set(xs, 0.105, zs); g.add(rg);
    });
    // the mast: a three-legged lattice, a platform, a boom swung downwind
    var HM = rf(r, 24, 30), legs = [];
    for (i = 0; i < 3; i++) { var a = i / 3 * 6.2832; legs.push([Math.sin(a), Math.cos(a)]); }
    var rb = 2.2, rt = 0.8, nL = Math.round(HM / 2.2);
    for (i = 0; i < 3; i++) {
      var p = legs[i], q = legs[(i + 1) % 3];
      kit.put('steel', plc2_seg(xs + p[0] * rb, 0, zs + p[1] * rb, xs + p[0] * rt, HM, zs + p[1] * rt, 0.12));
      for (k = 0; k < nL; k++) {
        var y0 = HM * k / nL, y1 = HM * (k + 1) / nL, r0 = lerp(rb, rt, k / nL), r1 = lerp(rb, rt, (k + 1) / nL);
        kit.put('steel', plc2_seg(xs + p[0] * r0, y0, zs + p[1] * r0, xs + q[0] * r1, y1, zs + q[1] * r1, 0.04));
        kit.put('steel', plc2_seg(xs + p[0] * r1, y1, zs + p[1] * r1, xs + q[0] * r1, y1, zs + q[1] * r1, 0.04));
      }
    }
    var top = cyl(1.6, 1.6, 0.3, 24, std('#C4C8CC', 0.4, 0.8)); top.position.set(xs, HM, zs); g.add(top);
    var BL = rf(r, 16, 22), bdx = wx, bdz = wz, bl2 = Math.hypot(bdx, bdz) || 1; bdx /= bl2; bdz /= bl2;
    var bx = xs + bdx * BL, bz = zs + bdz * BL;
    [[0.5, 0], [-0.5, 0]].forEach(function (o) {
      kit.put('steel', plc2_seg(xs - bdz * o[0], HM + 0.6, zs + bdx * o[0], bx - bdz * o[0] * 0.4, HM + 0.6, bz + bdx * o[0] * 0.4, 0.09));
      kit.put('steel', plc2_seg(xs - bdz * o[0], HM + 1.8, zs + bdx * o[0], bx - bdz * o[0] * 0.4, HM + 0.6, bz + bdx * o[0] * 0.4, 0.06));
    });
    kit.put('steel', plc2_seg(bx, 0.1, bz, bx, HM + 0.6, bz, 0.1));
    kit.put('steel', plc2_seg(bx, HM + 0.6, bz, bx, HM + 3, bz, 0.07));
    var beacons = [];
    [[xs, HM + 2.3, zs], [bx, HM + 3.1, bz]].forEach(function (q) { var b = sph(0.25, redM, 10, 8); b.position.set(q[0], q[1], q[2]); g.add(b); });
    var hut = box(4, 2.6, 3, std('#E8E6E0', 0.7, 0.2)); hut.position.set(xs - bdx * 7, 1.3, zs - bdz * 7); g.add(hut);
    // the tether: a long sagging line up and a little downwind, lights along it
    var tip = new THREE.Vector3(xs + bdx * 380, 1500, zs + bdz * 380), tpts = [];
    for (k = 0; k <= 40; k++) {
      var t = k / 40, pt = new THREE.Vector3(lerp(xs, tip.x, t), lerp(HM + 0.5, tip.y, Math.pow(t, 1.25)), lerp(zs, tip.z, t));
      tpts.push(pt);
    }
    plc2_line(g, tpts, '#1E1F22');
    var tl = [];
    [0.035, 0.09, 0.18, 0.32, 0.5].forEach(function (t, n) {
      var q = tpts[Math.round(t * 40)], m = n % 2 ? redM.clone() : whiteM.clone(); W.glow(m, 0.1, n % 2 ? 2.6 : 3.2);
      var b = sph(0.5 + t * 6, m, 8, 6); b.position.copy(q); g.add(b); tl.push(m);
    });
    // the aerostat itself, far overhead where the tether ends
    var bal = new THREE.Group(), bm = std('#EDEBE6', 0.55, 0.1);
    var env = sph(1, bm, 32, 18); env.scale.set(7, 7, 18); bal.add(env);
    [0, 2.1, 4.2].forEach(function (a) { var fin = box(0.4, 6.5, 5, bm); fin.position.set(Math.sin(a) * 6.5, Math.cos(a) * 6.5, -14); fin.rotation.z = -a; bal.add(fin); });
    bal.position.copy(tip); bal.lookAt(tip.x - bdx, tip.y, tip.z - bdz); g.add(bal);
    W.onUpdate(function (ctx) {
      var ph = ctx.real % 2.2;
      redM.emissiveIntensity *= ph < 0.5 ? 1 : 0.12;
      for (var q2 = 0; q2 < tl.length; q2++) tl[q2].emissiveIntensity *= ((ctx.real + q2 * 0.25) % 1.8) < 0.18 ? 1 : 0.06;
    });
    F.claim(xs, zs, PR + 2);

    // the low building, a garage, two pickups
    var bxL = xs - s * rf(r, 44, 58), bzL = zs + rf(r, 14, 24), BW = rf(r, 26, 34), BD = rf(r, 10, 13), BH = 4.2;
    var rib = canvasTex(64, 16, function (gc) { for (var x = 0; x < 64; x++) { var v = 205 + 30 * Math.sin(x / 64 * 6.28 * 4); gc.fillStyle = 'rgb(' + (v | 0) + ',' + ((v - 4) | 0) + ',' + ((v - 12) | 0) + ')'; gc.fillRect(x, 0, 1, 16); } }, { repeat: [BW / 1.2, 1] });
    var shell = box(BW, BH, BD, std('#E2DBCB', 0.65, 0.25, { map: rib })); shell.position.set(bxL, BH / 2, bzL); g.add(shell);
    kit.box('conc', bxL, BH + 0.2, bzL, BW + 0.4, 0.4, BD + 0.4);
    for (k = -BW / 2 + 2; k < BW / 2 - 1.5; k += 2.6) kit.box('win', bxL + k, 2.3, bzL + BD / 2 + 0.02, 1.6, 1.0, 0.05);
    kit.box('dark', bxL + s * (BW / 2 - 3), 1.15, bzL + BD / 2 + 0.02, 1.2, 2.3, 0.06);
    [[-5, 1.5], [3, 2.4], [8, 1.2]].forEach(function (q) { kit.box('bldg', bxL + q[0], BH + 0.4 + q[1] / 2, bzL - 1, 2.4, q[1], 1.8, 0, '#C9CBC8'); });
    var gx = bxL + s * (BW / 2 + 9), gz = bzL - 2;
    kit.box('bldg', gx, 2.6, gz, 10, 5.2, 9, 0, '#D7D2C6'); kit.box('dark', gx, 2.0, gz + 4.52, 7, 4, 0.05);
    F.claim(bxL, bzL, BW / 2 + 1); F.claim(gx, gz, 6.5);
    for (i = 0; i < 2; i++) {
      var TM = plc_m4(bxL + rf(r, -8, 8), 0, bzL + BD / 2 + 5 + i * 3.2, 1, 1, 1, 0, rf(r, -0.2, 0.2), 0);
      kit.box('bldg', 0, 0.8, 0, 5.2, 0.75, 1.95, 0, '#EDEBE6', TM); kit.box('bldg', 0.5, 1.5, 0, 1.9, 0.72, 1.85, 0, '#EDEBE6', TM); kit.box('dark', 0.5, 1.52, 0, 1.55, 0.5, 1.9, 0, null, TM);
      [[1.6, 0.9], [1.6, -0.9], [-1.6, 0.9], [-1.6, -0.9]].forEach(function (w) { kit.put('tire', plc_m4(w[0], 0.38, w[1], 1, 1, 1, Math.PI / 2, 0, 0).premultiply(TM)); });
    }
    // the windsock, turned and filled by the wind
    var wsx = xs + s * (PR + rf(r, 8, 14)), wsz = zs + rf(r, 6, 16), sock = new THREE.Group();
    kit.box('post', wsx, 3.2, wsz, 0.07, 6.4, 0.07);
    var sockT = canvasTex(64, 16, function (gc) { for (var x = 0; x < 5; x++) { gc.fillStyle = x % 2 ? '#F2F0EA' : '#FF5A1F'; gc.fillRect(x * 12.8, 0, 12.8, 16); } });
    var sg2 = new THREE.CylinderBufferGeometry(0.42, 0.2, 3.2, 16, 1, true); sg2.rotateZ(-Math.PI / 2); sg2.translate(1.6, 0, 0);
    var sm = new THREE.Mesh(sg2, std('#FFFFFF', 0.8, 0, { map: sockT, side: THREE.DoubleSide })); sock.add(sm);
    var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(0.42, 0.03, 6, 20), std('#9DA2A6', 0.45, 0.8)); ring.rotation.y = Math.PI / 2; sock.add(ring);
    sock.position.set(wsx, 6.3, wsz); sock.rotation.y = Math.atan2(-bdz, bdx); g.add(sock);
    W.onUpdate(function (ctx) { var w = ctx.wind || 1; sock.rotation.z = -lerp(1.2, 0.08, clamp(w / 2, 0, 1)) + 0.05 * Math.sin(ctx.real * 3.1); });
    F.claim(wsx, wsz, 1);

    // the fence: chain link, three strands on outriggers, posts every 3 m
    var fence = [[X0, zf], [X1, zf], [X1, Z1], [X0, Z1], [X0, zf]], chain = plc2_chainMat(), pts = [], fl = [];
    for (i = 0; i < fence.length - 1; i++) {
      var a2 = fence[i], b2 = fence[i + 1], Ls = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]), n = Math.round(Ls / 3);
      for (k = 0; k < n; k++) { var t2 = k / n; pts.push([lerp(a2[0], b2[0], t2), lerp(a2[1], b2[1], t2)]); }
    }
    pts.push(fence[0]);
    plc2_chain(g, pts, 2.4, null, chain);
    pts.forEach(function (p2, n) {
      kit.box('post', p2[0], 1.3, p2[1], 0.05, 2.6, 0.05);
      kit.put('post', plc2_seg(p2[0], 2.55, p2[1], p2[0], 3.05, p2[1] + 0.4, 0.025));
      if (n % 13 === 6 && Math.abs(p2[1] - zf) < 0.1) fl.push(p2);
    });
    [2.7, 2.87, 3.03].forEach(function (y, n) { plc2_line(g, pts.map(function (p2) { return new THREE.Vector3(p2[0], y, p2[1] + 0.13 * (n + 1)); }), '#5A5D60'); });
    plc2_line(g, pts.map(function (p2) { return new THREE.Vector3(p2[0], 2.42, p2[1]); }), '#7A7E82');
    for (k = 0; k < pts.length; k += 3) F.claim(pts[k][0], pts[k][1], 1.2);
    // floodlights on the near fence
    fl.sort(function (a3, b3) { return Math.abs(a3[0]) - Math.abs(b3[0]); });
    fl.forEach(function (p2, n) {
      kit.box('post', p2[0], 4.5, p2[1] - 0.6, 0.09, 9, 0.09);
      kit.put('head', plc_m4(p2[0], 8.9, p2[1] - 0.4, 0.7, 0.35, 0.5, -0.5, 0, 0));
      kit.put('lens', plc_m4(p2[0], 8.78, p2[1] - 0.22, 0.56, 0.02, 0.36, -0.5, 0, 0));
      if (n < 3) W.lamp('#FFD9A8', 0.9, 30, F.w(p2[0], p2[1] - 4, 8.4));
    });

    kit.flush(g);
    shade(g, true, true);
    yard.castShadow = pad.castShadow = false;
    plc2_scatterOut(W, F, [[X0, X1, Z1, zf, 5]], { grass: '#AA9468', tufts: 1800, bushes: 340, rocks: 160, yucca: 7 });
  }

  // =====================================================================
  // 6. DRIVE-IN LOT
  // A drive-in on the edge of town: the big white screen on its steel frame,
  // gravel humps in arcs so the cars tip up toward it, speaker posts along
  // every row, the projection booth with its snack bar. After dark the screen
  // glows faintly, showing Marfa time in large type, and the booth throws a
  // pale beam across the lot.
  // =====================================================================
  function plc2_drivein(W) {
    W.shadowExtent = 50;
    var F = plc2_base(W, '#A08A6A', '#6C6772', '#8A785F'), g = F.g, D = F.D, R = F.R, r = W.r, i, k, sd = W.P.seed;
    var s = W.P.seed % 2 ? 1 : -1, flat = W.groundAt;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    // the screen, behind the clock and to one side, turned toward the lot
    var ang = s * rf(r, 11, 17) * D2R, dS = D + R + rf(r, 36, 50), sx = Math.sin(ang) * dS, sz = D - Math.cos(ang) * dS;
    var fz = D * 0.3, ry = Math.atan2(-sx, fz - sz), ax = Math.sin(ry), az = Math.cos(ry);
    var Ws = rf(r, 26, 32), Hs = Ws * 0.42, yb = rf(r, 4.6, 5.8);
    // rows: arcs round the screen, a gravel hump in front of each line of posts
    var rows = [], rho0 = rf(r, 24, 28);
    for (k = 0; k < 8; k++) rows.push(rho0 + k * 9.5);
    var lot = function (x, z) {
      var dx = x - sx, dz = z - sz, rho = Math.sqrt(dx * dx + dz * dz), th = Math.atan2(dx, dz) - ry;
      th = Math.atan2(Math.sin(th), Math.cos(th));
      if (rho < 10 || Math.abs(th) > 1.1) return 0;
      var h = 0;
      for (var q = 0; q < rows.length; q++) { var u = (rho - (rows[q] - 1.6)) / 2.0; if (Math.abs(u) < 1) h += 0.42 * (0.5 + 0.5 * Math.cos(u * Math.PI)); }
      var d0 = Math.sqrt(x * x + z * z);
      return h * sstep(1.1, 0.9, Math.abs(th)) * sstep(R + 0.6, R + 3.5, d0) * sstep(80 + rows.length * 9.5, 60 + rows.length * 9.5, rho);
    };
    var hL = function (x, z) { var w = F.w(x, z); return flat(w.x, w.z) + lot(x, z); };
    var hW = function (wx, wz) { var q = F.loc(wx, wz); return flat(wx, wz) + lot(q[0], q[1]); };
    W.groundAt = hW;
    // the lot surface: a polar patch in front of the screen
    var NRr = 190, NT = 110, pos = [], col = [], idx = [], cc = new THREE.Color(), cg = C('#8F887C'), cd2 = C('#7A6F60');
    for (i = 0; i <= NRr; i++) {
      var rho = 8 + i * 0.55;
      for (k = 0; k <= NT; k++) {
        var th = ry + (-1.15 + 2.3 * k / NT), x = sx + Math.sin(th) * rho, z = sz + Math.cos(th) * rho;
        pos.push(x, hL(x, z) + 0.03, z);
        var n = fbm(x / 6, z / 6, sd + 61, 3);
        cc.copy(cg).lerp(cd2, sstep(0.45, 0.75, n) * 0.7).multiplyScalar(0.85 + 0.3 * fbm(x / 1.5, z / 1.5, sd + 62, 2));
        col.push(cc.r, cc.g, cc.b);
      }
    }
    for (i = 0; i < NRr; i++) for (k = 0; k < NT; k++) { var a0 = i * (NT + 1) + k; idx.push(a0, a0 + NT + 1, a0 + 1, a0 + 1, a0 + NT + 1, a0 + NT + 2); }
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); lg.setIndex(idx); lg.computeVertexNormals();
    var lotM = new THREE.Mesh(lg, detail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 'stone', { tile: 0.5, albedo: 0.4, bump: 0.6 }));
    lotM.receiveShadow = true; g.add(lotM);

    var postLamp = W.glow(glowMat('#FFC070', 0.02), 0.02, 1.1);
    var tail = W.glow(glowMat('#FF2A1A', 0.05), 0.05, 0.9);
    var kit = plc_kit()
      .def('post', new THREE.CylinderBufferGeometry(0.045, 0.05, 1, 8), std('#6E7478', 0.5, 0.6))
      .def('spk', BOX, std('#4E5A52', 0.6, 0.3))
      .def('frame', BOX, std('#3A3F42', 0.6, 0.5))
      .def('paint', BOX, std('#FFFFFF', 0.8))
      .def('conc', BOX, mtl('#D9D1C1', 'concrete', 0.92, 0, 1.2))
      .def('plamp', new THREE.SphereBufferGeometry(0.07, 8, 6), postLamp, { cast: false })
      .def('car', BOX, std('#FFFFFF', 0.35, 0.35))
      .def('glass', BOX, std('#1A2026', 0.1, 0.7))
      .def('tire', new THREE.CylinderBufferGeometry(0.36, 0.36, 0.24, 14), std('#18191B', 0.9))
      .def('tail', BOX, tail, { cast: false })
      .def('chrome', BOX, std('#D0D4D8', 0.2, 1));

    // speaker posts along the rows, every car width
    var carSpots = [];
    rows.forEach(function (rho, q) {
      var n = Math.floor(2.1 * rho / 4.8);
      for (var j = 0; j <= n; j++) {
        var th = ry - 1.05 + 2.1 * j / n, px = sx + Math.sin(th) * rho, pz = sz + Math.cos(th) * rho;
        if (px * px + pz * pz < (R + 1.5) * (R + 1.5) || !F.free(px, pz, 0.3)) continue;
        var py = hL(px, pz), rr = th + Math.PI;
        kit.put('post', plc_m4(px, py + 0.65, pz, 1, 1.3, 1));
        [-1, 1].forEach(function (e) { kit.put('spk', plc_m4(px + Math.cos(rr) * e * 0.2, py + 1.02, pz - Math.sin(rr) * e * 0.2, 0.3, 0.22, 0.1, 0, rr, 0)); });
        kit.put('spk', plc_m4(px, py + 1.3, pz, 0.14, 0.08, 0.14));
        if (j % 2 === 0) kit.put('plamp', plc_m4(px, py + 1.38, pz, 1, 1, 1));
        F.claim(px, pz, 0.35);
        if (j < n) carSpots.push([sx + Math.sin(th + 1.05 / n) * (rho - 1.2), sz + Math.cos(th + 1.05 / n) * (rho - 1.2), th + 1.05 / n, q]);
      }
    });
    // a few cars, parked nose up the humps
    var ccol = ['#8FB9A8', '#E8DCC2', '#B5452F', '#2F4F6F', '#D9A441', '#C9CDD2', '#5E3A4A'], cars = 0;
    for (i = 0; i < 60 && cars < 4; i++) {
      var sp = pick(r, carSpots);
      if (!F.free(sp[0], sp[1], 2.7)) continue;
      var th2 = sp[2], cy = hL(sp[0], sp[1]), CM = plc_m4(sp[0], cy, sp[1], 1, 1, 1, 0, th2 + Math.PI, 0).multiply(plc_m4(0, 0, 0, 1, 1, 1, 0.07, 0, 0)), cc2 = pick(r, ccol);
      kit.box('car', 0, 0.62, 0, 1.95, 0.6, 5.2, 0, cc2, CM); kit.box('car', 0, 1.17, 0.25, 1.75, 0.55, 2.4, 0, cc2, CM);
      kit.box('glass', 0, 1.2, 0.25, 1.8, 0.4, 2.1, 0, null, CM); kit.box('chrome', 0, 0.45, -2.62, 2.0, 0.14, 0.08, 0, null, CM); kit.box('chrome', 0, 0.45, 2.62, 2.0, 0.14, 0.08, 0, null, CM);
      [-0.72, 0.72].forEach(function (e) { kit.box('tail', e, 0.72, 2.61, 0.3, 0.14, 0.03, 0, null, CM); });
      [[0.9, 1.6], [-0.9, 1.6], [0.9, -1.6], [-0.9, -1.6]].forEach(function (w) { kit.put('tire', plc_m4(w[0], 0.36, w[1], 1, 1, 1, 0, 0, Math.PI / 2).premultiply(CM)); });
      F.claim(sp[0], sp[1], 2.7); cars++;
    }

    // the screen tower
    var SG = new THREE.Group(); SG.position.set(sx, flat(F.w(sx, sz).x, F.w(sx, sz).z), sz); SG.rotation.y = ry; g.add(SG);
    var tcv = document.createElement('canvas'); tcv.width = 1024; tcv.height = 432;
    var ttex = new THREE.CanvasTexture(tcv); ttex.encoding = THREE.sRGBEncoding;
    var scrM = std('#E9E6DE', 0.92, 0); scrM.emissive = C('#E4EEFF'); scrM.emissiveMap = ttex; W.glow(scrM, 0, 0.75);
    var scr = new THREE.Mesh(new THREE.PlaneBufferGeometry(Ws, Hs), scrM); scr.position.set(0, yb + Hs / 2, 0.21); SG.add(scr);
    var lastM = -1, draw = function (t) {
      var c2 = tcv.getContext('2d'), h12 = t.h % 12 === 0 ? 12 : t.h % 12;
      c2.fillStyle = '#20242C'; c2.fillRect(0, 0, 1024, 432);
      c2.fillStyle = '#FFFFFF'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.font = '700 250px ' + FONT_SANS; c2.fillText(h12 + ':' + pad2(t.m), 512, 196);
      c2.font = '700 40px ' + FONT_SANS; c2.fillStyle = '#C9D6EA';
      var lab = 'MARFA TIME   ' + (t.h < 12 ? 'AM' : 'PM'), x0 = 512 - lab.length * 14;
      for (var q = 0; q < lab.length; q++) c2.fillText(lab[q], x0 + q * 28 + 14, 370);
      ttex.needsUpdate = true;
    };
    W.onUpdate(function (ctx) { if (ctx.t.m !== lastM) { lastM = ctx.t.m; draw(ctx.t); } });
    var back = box(Ws + 0.7, Hs + 0.7, 0.3, std('#56605A', 0.8, 0.2)); back.position.set(0, yb + Hs / 2, -0.5); SG.add(back);
    var fas = box(Ws + 0.7, yb, 0.5, mtl('#E7E1D2', 'plaster', 0.9, 0, 1.4)); fas.position.set(0, yb / 2, -0.4); SG.add(fas);
    [['#B5452F', 1.2], ['#2F5D50', 1.55]].forEach(function (q) { var st = box(Ws + 1.2, 0.18, 1.1, std(q[0], 0.7)); st.position.set(0, q[1], -0.4); SG.add(st); });
    var F2 = new THREE.Matrix4().makeTranslation(sx, 0, sz).multiply(new THREE.Matrix4().makeRotationY(ry));
    var fb = function (x, y, z, w2, h2, d2, rx) { kit.put('frame', plc_m4(x, y, z, w2, h2, d2, rx || 0, 0, 0).premultiply(F2)); };
    var top = yb + Hs + 0.35;
    for (k = 0; k <= 6; k++) {
      var xk = -Ws / 2 + Ws * k / 6;
      fb(xk, top / 2, -0.95, 0.3, top, 0.3);
      var bl = Math.hypot(top * 0.85, 6);
      kit.put('frame', plc2_seg(xk, 0, -6.8, xk, top * 0.85, -1.0, 0.12).premultiply(F2));
      fb(xk, 0.25, -6.8, 0.6, 0.5, 0.6);
    }
    for (k = 1; k <= 4; k++) fb(0, top * k / 4.4, -1.15, Ws, 0.18, 0.18);
    shade(SG);
    var spill = W.lamp('#BFD0FF', 0.9, 55, new THREE.Vector3(0, yb + 2, 14), SG);
    F.claim(sx, sz, Ws / 2 + 2); F.claim(sx - ax * 3, sz - az * 3, Ws / 2);
    for (k = -Ws / 2; k <= Ws / 2; k += 5) F.claim(sx + az * k, sz - ax * k, 4);

    // the booth: cinder block, a snack bar sign, a window toward the screen
    var bp = W.inView(-s * rf(r, 7, 13), D + R + rf(r, 9, 15)), bq = F.loc(bp.x, bp.z), bx = bq[0], bz = bq[1];
    var BG = new THREE.Group(); BG.position.set(bx, hL(bx, bz), bz); BG.rotation.y = Math.atan2(-bx, D - bz); g.add(BG);
    var block = mtl('#D8D0C0', 'concrete', 0.92, 0, 0.8), BWd = 7.5, BH = 3.2, BDp = 5.5;
    var body = box(BWd, BH, BDp, block); body.position.y = BH / 2; BG.add(body);
    var rf2 = box(BWd + 1.2, 0.25, BDp + 1.2, mtl('#E9E4D8', 'concrete', 0.8, 0, 1.2)); rf2.position.y = BH + 0.12; BG.add(rf2);
    var snack = textPlane('SNACK BAR', { color: '#FFE6D0', font: FONT_SANS, height: 0.55, px: 90, spacing: 0.12, pad: 0.25, glow: '#FF4A3A', bg: '#2A1C1A' });
    W.glow(snack.material, 0.15, 1.1); snack.position.set(0, BH + 0.62, BDp / 2 + 0.62); BG.add(snack);
    var lit = std('#2A2622', 0.2, 0.3); lit.emissive = C('#FFD9A0'); W.glow(lit, 0, 0.85);
    var sw = box(3.2, 1.1, 0.06, lit); sw.position.set(-1.2, 1.6, BDp / 2 + 0.01); BG.add(sw);
    var dr = box(1.0, 2.1, 0.06, std('#6E3A2E', 0.6)); dr.position.set(2.2, 1.05, BDp / 2 + 0.01); BG.add(dr);
    var awn = box(4.2, 0.08, 1.4, std('#B5452F', 0.7)); awn.position.set(-1.2, 2.45, BDp / 2 + 0.65); awn.rotation.x = 0.2; BG.add(awn);
    shade(BG);
    // the projector's window faces the screen; the beam lights up after dark
    BG.updateMatrixWorld(true);
    var sLoc = new THREE.Vector3(sx, SG.position.y + yb + Hs / 2, sz), bLoc = new THREE.Vector3(bx, BG.position.y + 2.6, bz);
    var dirB = sLoc.clone().sub(bLoc), lenB = dirB.length(); dirB.normalize();
    var pwin = box(0.9, 0.5, 0.9, lit); pwin.position.copy(bLoc).addScaledVector(dirB, 0.05); g.add(pwin);
    var cg2 = new THREE.ConeBufferGeometry(Hs * 0.55, lenB, 28, 1, true); cg2.translate(0, -lenB / 2, 0);
    var beamM = new THREE.MeshBasicMaterial({ color: C('#B8C8FF'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    var beam = new THREE.Mesh(cg2, beamM); beam.position.copy(bLoc);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirB); beam.scale.set(Ws / Hs * 0.8, 1, 1); g.add(beam);
    beam.scale.set(1, 1, 1);
    W.onUpdate(function (ctx) { beamM.opacity = 0.05 * ctx.night; beam.visible = ctx.night > 0.05; });
    W.lamp('#FFC98A', 1.0, 16, new THREE.Vector3(0, 2.6, BDp / 2 + 2.5), BG);
    F.claim(bx, bz, 5.5);

    kit.flush(g);
    shade(g, true, true);
    lotM.castShadow = false;
    var n0 = W.occupied.length;
    for (k = 0; k < rows.length; k++) for (var t = -1.1; t <= 1.1; t += 0.12) F.claim(sx + Math.sin(ry + t) * rows[k], sz + Math.cos(ry + t) * rows[k], 4.5);
    plc_scatter(W, { grass: '#A69068', tufts: 1200, bushes: 300, rocks: 140, yucca: 6 }, hW);
    W.occupied.splice(n0, W.occupied.length - n0);
    plc_drapeLate(W, hW);
  }

  // =====================================================================
  // 7. EMPTY POOL
  // The town pool, drained years ago: pale blue tile gone chalky, lane lines
  // running down into the deep end, chrome ladders, a diving board, sun
  // bleached loungers, a chain link fence and a lifeguard chair no one sits
  // in. A small clock stands on the floor of the deep end and the camera
  // looks down at it from the deck; a tall one stands on the deck beyond the
  // pool. One pool light still works after dark.
  // =====================================================================
  function plc2_pool(W) {
    W.shadowExtent = 48;
    var F = plc2_base(W, '#A99070', '#6C6772', '#8A785F'), g = F.g, D = F.D, R = F.R, r = W.r, i, k, sd = W.P.seed;
    var s = W.P.seed % 2 ? 1 : -1, flat = W.groundAt;
    var hero = null; (W.picks || []).forEach(function (p) { if (!hero && p.name === W.P.clock) hero = p.obj; });
    var cH = (CLOCK_DEFS[W.P.clock] && CLOCK_DEFS[W.P.clock].height) || plc_heroTop(W);
    var dd = rf(r, 3.3, 3.8), Lp, Wp, O, rot, uDeep, mode;
    if (hero && cH <= 5.3 && R <= 5.6 && D - 1.0 >= R + 1.2) {
      mode = 'deep'; Wp = 2 * Math.max(R + 2.2, rf(r, 6.5, 7.5)); var zA = Math.max(R + 1.2, Math.min(D - 1.0, R + rf(r, 3.5, 5.5)));
      Lp = Math.max(rf(r, 25, 30), zA + R + 13); O = [0, zA]; rot = 0; uDeep = zA + R + 1.5;
    } else {
      // a tall clock stands on the deck; the pool lies behind it, deep end away
      mode = 'deck'; Lp = rf(r, 25, 30); uDeep = Lp * 0.3; Wp = rf(r, 12, 15);
      O = [s * rf(r, 0, 4), -(R + 1.6 + Lp)]; rot = Math.PI;
    }
    // the pool's own frame: u runs from the deep end wall down the length (local -z), v across (local x)
    var cr = Math.cos(rot), sr = Math.sin(rot);
    var P2F = function (u, v) { return [O[0] + v * cr - u * sr, O[1] - v * sr - u * cr]; };
    var F2P = function (x, z) { var dx = x - O[0], dz = z - O[1]; return [-(dx * sr + dz * cr), dx * cr - dz * sr]; };
    var dep = function (u) { return u < uDeep ? dd : u < uDeep + 6.5 ? lerp(dd, 1.05, sstep(uDeep, uDeep + 6.5, u)) : lerp(1.05, 0.9, (u - uDeep - 6.5) / Math.max(1, Lp - uDeep - 6.5)); };
    var inPool = function (x, z) { var q = F2P(x, z); return q[0] > 0 && q[0] < Lp && Math.abs(q[1]) < Wp / 2; };
    var hL = function (x, z) { if (inPool(x, z)) return -dep(F2P(x, z)[0]); var w = F.w(x, z); return flat(w.x, w.z); };
    var hW = function (wx, wz) { var q = F.loc(wx, wz); return hL(q[0], q[1]); };
    if (mode === 'deep') { hero.position.y = -dd; W.cam.lookY = W.cam.lookY - dd + 0.5; }

    var PG = new THREE.Group(); PG.position.set(O[0], 0, O[1]); PG.rotation.y = rot; g.add(PG);
    var hc = P2F(Lp / 2, 0), h0 = F.w(0, 0), hu = F.w(P2F(1, 0)[0] - O[0], P2F(1, 0)[1] - O[1]).sub(h0), hv2 = F.w(P2F(0, 1)[0] - O[0], P2F(0, 1)[1] - O[1]).sub(h0);
    plc2_hole(F.ground, F.w(hc[0], hc[1]), hu, hv2, [Lp / 2, Wp / 2]);
    var tileM = detail(std('#A9D3DB', 0.55, 0, { side: THREE.DoubleSide }), 'plc2_tile', { tile: 1.2, albedo: 0.45, rough: 0.3, bump: 0.15 });
    var bandM = detail(std('#2F5F86', 0.4, 0, { side: THREE.DoubleSide }), 'plc2_tile', { tile: 1.2, albedo: 0.4, rough: 0.3, bump: 0.15 });
    var laneM = std('#23456B', 0.5, 0, { side: THREE.DoubleSide });
    var strip = function (pts, mat, parent) {
      // pts: [[x0,y0,z0, x1,y1,z1], ...] pairs along a strip
      var p = [], ix = [];
      pts.forEach(function (q, n) { p.push(q[0], q[1], q[2], q[3], q[4], q[5]); if (n) { var a = (n - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      var ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); ge.setIndex(ix); ge.computeVertexNormals();
      var m = new THREE.Mesh(ge, mat); m.receiveShadow = true; m.castShadow = true; (parent || PG).add(m); return m;
    };
    var NU = 70, us = [];
    for (i = 0; i <= NU; i++) us.push(Lp * i / NU);
    var hv = Wp / 2;
    // floor, the two long walls, the two end walls, the dark tile band at the top
    strip(us.map(function (u) { return [hv, -dep(u), -u, -hv, -dep(u), -u]; }), tileM);
    strip(us.map(function (u) { return [-hv, -dep(u), -u, -hv, 0, -u]; }), tileM);
    strip(us.map(function (u) { return [hv, 0, -u, hv, -dep(u), -u]; }), tileM);
    strip([[-hv, 0, 0, -hv, -dep(0), 0], [hv, 0, 0, hv, -dep(0), 0]], tileM);
    strip([[-hv, -dep(Lp), -Lp, -hv, 0, -Lp], [hv, -dep(Lp), -Lp, hv, 0, -Lp]], tileM);
    var bd = 0.24;
    strip(us.map(function (u) { return [-hv + 0.004, -bd, -u, -hv + 0.004, 0, -u]; }), bandM);
    strip(us.map(function (u) { return [hv - 0.004, 0, -u, hv - 0.004, -bd, -u]; }), bandM);
    strip([[-hv, 0, -0.004, -hv, -bd, -0.004], [hv, 0, -0.004, hv, -bd, -0.004]], bandM);
    strip([[-hv, -bd, -Lp + 0.004, -hv, 0, -Lp + 0.004], [hv, -bd, -Lp + 0.004, hv, 0, -Lp + 0.004]], bandM);
    // lane lines down the floor with their T ends, a target on each end wall
    var nl = Math.max(3, Math.round(Wp / 2.4)), lw = 0.25;
    for (k = 0; k < nl; k++) {
      var v = -hv + Wp * (k + 0.5) / nl, lu = us.filter(function (u) { return u > 2 && u < Lp - 2; });
      strip(lu.map(function (u) { return [v + lw / 2, -dep(u) + 0.012, -u, v - lw / 2, -dep(u) + 0.012, -u]; }), laneM);
      [2.05, Lp - 2.05].forEach(function (u) { strip([[v + 0.5, -dep(u) + 0.013, -u - 0.12, v - 0.5, -dep(u) + 0.013, -u - 0.12], [v + 0.5, -dep(u) + 0.013, -u + 0.12, v - 0.5, -dep(u) + 0.013, -u + 0.12]], laneM); });
      [[0.006, 1], [Lp - 0.006, -1]].forEach(function (q) {
        var zz = -q[0], y0 = -dep(q[0]) + 0.3, y1 = -0.5;
        strip([[v - lw / 2, y0, zz, v - lw / 2, y1, zz], [v + lw / 2, y0, zz, v + lw / 2, y1, zz]].map(function (p) { return q[1] > 0 ? p : [p[3], p[4], p[5], p[0], p[1], p[2]]; }), laneM);
      });
    }
    // coping round the rim, the deck with a hole for the pool, cracks and stains
    var cop = mtl('#E4DDCC', 'concrete', 0.85, 0, 1.2);
    [[-hv - 0.2, -Lp / 2, 0.4, Lp + 0.8], [hv + 0.2, -Lp / 2, 0.4, Lp + 0.8], [0, 0.2, Wp, 0.4], [0, -Lp - 0.2, Wp, 0.4]].forEach(function (q) {
      var c = box(q[2], 0.12, q[3], cop); c.position.set(q[0], 0.06, q[1]); c.castShadow = c.receiveShadow = true; PG.add(c);
    });
    // pool rectangle and deck rectangle, in the place frame
    var cs = [P2F(0, -hv), P2F(0, hv), P2F(Lp, -hv), P2F(Lp, hv)];
    var px0 = Math.min.apply(null, cs.map(function (q) { return q[0]; })) - 0.4, px1 = Math.max.apply(null, cs.map(function (q) { return q[0]; })) + 0.4;
    var pz0 = Math.min.apply(null, cs.map(function (q) { return q[1]; })) - 0.4, pz1 = Math.max.apply(null, cs.map(function (q) { return q[1]; })) + 0.4;
    var dx0 = Math.min(px0 - 5, -R - 2.5), dx1 = Math.max(px1 + 5, R + 2.5), dz0 = Math.min(pz0 - 5.5, -R - 2.5), dz1 = Math.max(pz1 + 4.5, D + 3, R + 2.5);
    var deckM = detail(std('#D6CFC0', 0.9, 0), 'cracks', { tile: 3.5, albedo: 0.4, rough: 0.3, bump: 0.2 });
    [[dx0, dx1, pz1, dz1], [dx0, dx1, dz0, pz0], [dx0, px0, pz0, pz1], [px1, dx1, pz0, pz1]].forEach(function (q) {
      if (q[1] - q[0] < 0.05 || q[3] - q[2] < 0.05) return;
      var d = box(q[1] - q[0], 0.06, q[3] - q[2], deckM); d.position.set((q[0] + q[1]) / 2, -0.01, (q[2] + q[3]) / 2); d.receiveShadow = true; g.add(d);
    });

    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    var kit = plc_kit()
      .def('chrome', new THREE.CylinderBufferGeometry(1, 1, 1, 10), std('#D8DCE0', 0.18, 1))
      .def('white', BOX, std('#EDEAE2', 0.6, 0.05))
      .def('lounge', BOX, std('#FFFFFF', 0.7, 0))
      .def('leaf', BOX, std('#FFFFFF', 0.9, 0), { cast: false })
      .def('post', new THREE.CylinderBufferGeometry(1, 1, 1, 8), std('#9DA2A6', 0.45, 0.8))
      .def('lens', BOX, plc_glow(W, '#FFB060', 0.04, 2.2), { cast: false });
    // a second kit for things placed in the pool's own frame
    var pk = plc_kit()
      .def('chrome', new THREE.CylinderBufferGeometry(1, 1, 1, 10), std('#D8DCE0', 0.18, 1))
      .def('white', BOX, std('#EDEAE2', 0.6, 0.05))
      .def('board', BOX, std('#D9E4E2', 0.5, 0.1))
      .def('leaf', BOX, std('#FFFFFF', 0.9, 0), { cast: false });
    // ladders: two rails over the coping, rungs down the wall
    var ladder = function (u, side) {
      var x = side * (hv - 0.02);
      [-0.28, 0.28].forEach(function (o) {
        var path = new THREE.CatmullRomCurve3([[side * (hv + 0.55), 0.02, -u - o], [side * (hv + 0.5), 0.75, -u - o], [side * (hv + 0.15), 0.95, -u - o], [side * (hv - 0.12), 0.6, -u - o], [side * (hv - 0.16), -0.2, -u - o], [side * (hv - 0.06), -1.3, -u - o], [side * (hv - 0.01), -1.4, -u - o]].map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
        var tb = new THREE.Mesh(new THREE.TubeBufferGeometry(path, 24, 0.025, 7), std('#D8DCE0', 0.18, 1)); tb.castShadow = true; PG.add(tb);
      });
      for (var q = 0; q < 3; q++) pk.box('white', x - side * 0.09, -0.35 - q * 0.33, -u, 0.16, 0.04, 0.5);
    };
    ladder(1.6, -1); ladder(1.6, 1); ladder(Lp - 1.6, s); if (Lp > 26) ladder(uDeep + 3, -s);
    // the diving board, off the deep end wall and to one side of the camera's line
    var bv = mode === 'deep' ? s * Math.min(hv - 1.6, Math.max(R + 0.9, hv * 0.55)) : -s * hv * 0.3, bdL = 4.6, bh = mode === 'deep' ? 0.98 : 3.1;
    if (mode === 'deep') pk.box('white', bv, 0.45, 1.3, 0.9, 0.9, 1.2);
    else {
      [[-0.55, 0.5], [0.55, 0.5], [-0.55, 2.4], [0.55, 2.4]].forEach(function (q) { pk.box('white', bv + q[0], bh / 2, q[1], 0.16, bh, 0.16); });
      pk.box('white', bv, bh - 0.1, 1.45, 1.3, 0.14, 2.3);
      [-0.3, 0.3].forEach(function (o) { pk.put('chrome', plc2_seg(bv + o, 0, 4.0, bv + o, bh + 0.9, 2.4, 0.03)); });
      for (k = 1; k < 8; k++) pk.box('white', bv, k * (bh + 0.9) / 8, 4.0 - 1.6 * k / 8, 0.6, 0.04, 0.14);
      // a low board beside the high one
      pk.box('white', bv + s * 3.2, 0.45, 1.3, 0.9, 0.9, 1.2);
      pk.put('board', plc_m4(bv + s * 3.2, 0.98, 0.8 - bdL / 2, 0.52, 0.07, bdL, 0.03, 0, 0));
    }
    pk.put('board', plc_m4(bv, bh + 0.02, 0.8 - bdL / 2, 0.52, 0.07, bdL, 0.03, 0, 0));
    [-0.3, 0.3].forEach(function (o) { pk.put('chrome', plc2_seg(bv + o, bh - 0.9 + (mode === 'deep' ? 0.9 : 0), 1.9, bv + o, bh + 0.55, 1.9, 0.025)); pk.put('chrome', plc2_seg(bv + o, bh + 0.55, 1.9, bv + o, bh + 0.25, 0.9, 0.025)); });
    // leaves and grit on the floor, a stagnant puddle in a corner of the deep end
    for (i = 0; i < 260; i++) {
      var u2 = Math.pow(r(), 0.7) * Lp, v2 = rf(r, -hv + 0.2, hv - 0.2), fq = P2F(u2, v2);
      if (fq[0] * fq[0] + fq[1] * fq[1] < (R + 0.3) * (R + 0.3)) continue;
      var ls = rf(r, 0.05, 0.12);
      pk.put('leaf', plc_m4(v2, -dep(u2) + 0.012, -u2, ls, 0.008, ls * 0.6, 0, r() * 6, 0), pick(r, ['#8A6A3E', '#6E5A3A', '#A08058', '#5E5040']));
    }
    var pv = -s * (hv - 1.6), pu = Math.max(1.8, uDeep - 2.2), pq = P2F(pu, pv);
    if (pq[0] * pq[0] + pq[1] * pq[1] > (R + 1.8) * (R + 1.8)) {
      var pud = new THREE.Mesh(new THREE.CircleBufferGeometry(1, 28), std('#5E6446', 0.12, 0.1)); pud.scale.set(1.2, 0.8, 1); pud.rotation.x = -Math.PI / 2; pud.position.set(pv, -dep(pu) + 0.014, -pu); PG.add(pud);
    }
    var drain = new THREE.Mesh(new THREE.CircleBufferGeometry(0.28, 16), std('#15181A', 0.6)); drain.rotation.x = -Math.PI / 2; drain.position.set(-s * 1.2, -dep(uDeep * 0.5) + 0.015, -uDeep * 0.5); PG.add(drain);
    // one pool light still works, low on the deep end wall
    var plM = W.glow(glowMat('#7FF0E6', 0.1), 0.1, 2.4), pl = cyl(0.22, 0.22, 0.05, 20, plM); pl.rotation.x = Math.PI / 2;
    pl.position.set(-s * hv * 0.5, -dd + 0.9, -0.03); PG.add(pl);
    var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(0.24, 0.03, 6, 20), std('#D8DCE0', 0.2, 1)); ring.position.copy(pl.position); PG.add(ring);
    W.lamp('#7FE8E0', 1.1, 16, new THREE.Vector3(-s * hv * 0.5, -dd + 1.2, -1.2), PG);
    pk.flush(PG);
    shade(PG, true, true);

    // loungers along the far deck, sun-bleached, one knocked over
    var lcol = ['#E8E4DA', '#C9DCD8', '#E6DDC0', '#D9C9C4', '#DCE6E0'];
    var lounger = function (x, z, yaw, over) {
      var M = plc_m4(x, over ? 0.33 : 0, z, 1, 1, 1, 0, yaw, over ? Math.PI / 2 : 0), c = pick(r, lcol);
      kit.box('lounge', 0, 0.36, 0.2, 0.68, 0.05, 1.35, 0, c, M);
      kit.put('lounge', plc_m4(0, 0.62, -0.72, 0.68, 0.05, 0.8, 0.95, 0, 0).premultiply(M), c);
      [[-0.3, 0.8], [0.3, 0.8], [-0.3, -0.4], [0.3, -0.4]].forEach(function (q) { kit.box('lounge', q[0], 0.17, q[1], 0.05, 0.34, 0.05, 0, c, M); });
    };
    var nL = 0;
    for (i = 0; i < 30 && nL < 9; i++) {
      var side = r() < 0.5 ? 1 : -1, along = rf(r, 1.5, Lp - 1.5), off = hv + rf(r, 1.4, 2.6), lq = P2F(along, side * off);
      if (!F.free(lq[0], lq[1], 1.0)) continue;
      lounger(lq[0], lq[1], rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + rf(r, -0.25, 0.25), r() < 0.12);
      F.claim(lq[0], lq[1], 1.0); nL++;
    }
    // the lifeguard chair, halfway down one side, its umbrella faded
    var gq = P2F(Lp * 0.55, -s * (hv + 1.6));
    if (F.free(gq[0], gq[1], 1.2)) {
      var GM = plc_m4(gq[0], 0, gq[1], 1, 1, 1, 0, rot - s * Math.PI / 2, 0);
      [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(function (q) { kit.put('white', plc2_seg(q[0] * 1.5, 0, q[1] * 1.5, q[0], 2.2, q[1], 0.05).premultiply(GM)); });
      kit.box('white', 0, 2.25, 0, 0.9, 0.08, 0.9, 0, null, GM); kit.box('white', 0, 2.75, -0.42, 0.9, 1.0, 0.06, 0, null, GM);
      for (k = 0; k < 4; k++) kit.box('white', 0, 0.5 + k * 0.45, 0.6 + k * 0.03, 0.7, 0.05, 0.14, 0, null, GM);
      var um = new THREE.Mesh(new THREE.ConeBufferGeometry(1.3, 0.5, 8, 1, true), std('#E7C8A8', 0.8, 0, { side: THREE.DoubleSide }));
      um.position.set(gq[0], 3.9, gq[1]); g.add(um); kit.put('white', plc2_seg(gq[0], 2.3, gq[1], gq[0], 3.9, gq[1], 0.03));
      F.claim(gq[0], gq[1], 1.3);
    }
    // the fence round the deck, a quoted sign on it, two lamp posts
    var fp = [[dx0, dz1], [dx1, dz1], [dx1, dz0], [dx0, dz0], [dx0, dz1]], pts = [];
    for (i = 0; i < 4; i++) { var a = fp[i], b = fp[i + 1], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3); for (k = 0; k < n; k++) pts.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); }
    pts.push(fp[0]);
    plc2_chain(g, pts, 1.85);
    pts.forEach(function (p) { kit.box('post', p[0], 0.95, p[1], 0.04, 1.9, 0.04); F.claim(p[0], p[1], 0.8); });
    plc2_line(g, pts.map(function (p) { return new THREE.Vector3(p[0], 1.86, p[1]); }), '#8A8E92');
    var sgnX = rf(r, -0.3, 0.3) * (dx1 - dx0) / 2 + (dx0 + dx1) / 2, sgn = plc2_board(['"POOL CLOSED"'], 2.2, 0.5, '#F4F2EC', '#111111', { size: 0.62 });
    sgn.position.set(sgnX, 1.25, dz0 + 0.04); g.add(sgn);
    var lampP = [[px0 - 2.5, (pz0 + pz1) / 2], [px1 + 2.5, pz0 - 2.5]];
    lampP.forEach(function (p) {
      kit.box('post', p[0], 3.2, p[1], 0.06, 6.4, 0.06);
      kit.box('white', p[0], 6.4, p[1], 0.5, 0.18, 0.5);
      kit.box('lens', p[0], 6.3, p[1], 0.4, 0.02, 0.4);
      W.lamp('#FFB060', 1.3, 24, F.w(p[0], p[1], 6.0));
      F.claim(p[0], p[1], 0.6);
    });
    // the bathhouse beyond the fence
    var bhx = (dx0 + dx1) / 2 + s * rf(r, 4, 10), bhz = dz0 - 6;
    var bh = box(16, 3.2, 6, mtl('#CFE0DA', 'plaster', 0.9, 0, 1.4)); bh.position.set(bhx, 1.6, bhz); g.add(bh);
    var bhr = box(17, 0.3, 7, mtl('#E8E2D4', 'concrete', 0.9, 0, 1.4)); bhr.position.set(bhx, 3.35, bhz); g.add(bhr);
    [-4, 4].forEach(function (e) { var d2 = box(1.1, 2.2, 0.06, std('#2F5D50', 0.6)); d2.position.set(bhx + e, 1.1, bhz + 3.02); g.add(d2); });
    for (k = -6; k <= 6; k += 2) { var bw = box(1.1, 0.4, 0.06, std('#2A3036', 0.2, 0.4)); bw.position.set(bhx + k, 2.6, bhz + 3.02); g.add(bw); }
    shade(bh); shade(bhr);
    F.claim(bhx, bhz, 8.5);

    kit.flush(g);
    shade(g, true, true);
    plc2_scatterOut(W, F, [[dx0, dx1, dz0, dz1, 4]], { grass: '#A89066', tufts: 1400, bushes: 320, rocks: 150, yucca: 6 }, null);
    plc_drapeLate(W, hW);
  }

  // =====================================================================
  // 8. HOT SPRINGS
  // Down on the river bottom where warm water comes up out of the rock:
  // stone soaking tubs round a flagstone terrace, steam that rises and leans
  // with the wind, a few adobe cabins, fan palms and cane, the river running
  // across the view and low cliffs on the far side. Lanterns and cabin
  // windows after dark.
  // =====================================================================
  var plc2_steamVS = [
    'attribute vec3 ofs; attribute vec2 sa; varying vec2 vUv; varying float vA;',
    'void main() { vUv = uv; vA = sa.y; vec4 mv = modelViewMatrix * vec4(ofs, 1.0); mv.xy += position.xy * sa.x; gl_Position = projectionMatrix * mv; }'
  ].join('\n');
  var plc2_steamFS = [
    'uniform vec3 col; varying vec2 vUv; varying float vA;',
    'void main() { float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(col, a * a * vA); }'
  ].join('\n');
  function plc2_steam(W, F, parent, src, per) {
    var N = src.length * per, base = new THREE.PlaneBufferGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    var ofs = new Float32Array(N * 3), sa = new Float32Array(N * 2), r = seedRng(W.P.seed ^ 0x57EA);
    var aO = new THREE.InstancedBufferAttribute(ofs, 3), aS = new THREE.InstancedBufferAttribute(sa, 2);
    aO.setUsage(THREE.DynamicDrawUsage); aS.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('ofs', aO); geo.setAttribute('sa', aS); geo.instanceCount = N;
    var col = new THREE.Color(), cDay = C('#F1EFEA'), cNight = C('#59606E');
    var mat = new THREE.ShaderMaterial({ uniforms: { col: { value: col } }, vertexShader: plc2_steamVS, fragmentShader: plc2_steamFS, transparent: true, depthWrite: false });
    var mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; parent.add(mesh);
    var P = [];
    for (var i = 0; i < N; i++) { var sp = src[Math.floor(i / per)]; P.push({ s: sp, jx: rf(r, -1, 1), jz: rf(r, -1, 1), life: rf(r, 3.5, 6.5), age: 0, ph: r() * 6.28, k: rf(r, 0.7, 1.2) }); P[i].age = r() * P[i].life; }
    var wl = F.loc(W.windDir.x, W.windDir.z);
    W.onUpdate(function (ctx) {
      var ws = 0.35 + 0.75 * (ctx.wind || 1), wx = wl[0] * ws, wz = wl[1] * ws, dt = Math.min(ctx.dt || 0, 0.1);
      col.copy(cDay).lerp(cNight, ctx.night);
      var cool = 0.24 + 0.1 * sstep(20, 0, ctx.sun.el) + 0.04 * ctx.night, hr = (W.heroR || 3), cd = F.D;
      for (var i = 0; i < N; i++) {
        var p = P[i]; p.age += dt;
        if (p.age > p.life) { p.age -= p.life; p.jx = rf(r, -1, 1); p.jz = rf(r, -1, 1); }
        var a = p.age / p.life, t = p.age, sw = Math.sin(t * 1.3 + p.ph) * 0.25 * a;
        ofs[i * 3] = p.s[0] + p.jx * p.s[3] + wx * Math.pow(t, 1.3) * 0.55 + sw;
        ofs[i * 3 + 1] = p.s[1] + 0.05 + t * 0.55 * p.k;
        ofs[i * 3 + 2] = p.s[2] + p.jz * p.s[4] + wz * Math.pow(t, 1.3) * 0.55 + Math.cos(t * 1.1 + p.ph) * 0.2 * a;
        var sz = lerp(0.7, 3.6, Math.sqrt(a)) * p.k, ox = ofs[i * 3], oz = ofs[i * 3 + 2], hw2 = hr * clamp((cd - oz) / cd, 0, 1) + sz * 0.5 + 0.3;
        var clr = oz > -hr * 0.3 && oz < cd ? sstep(hw2 * 0.8, hw2 + 1.2, Math.abs(ox)) : 1;
        sa[i * 2] = sz;
        sa[i * 2 + 1] = Math.pow(Math.sin(Math.PI * a), 1.4) * cool * clr;
      }
      aO.needsUpdate = true; aS.needsUpdate = true;
    });
    return mesh;
  }
  function plc2_springs(W) {
    W.shadowExtent = 46;
    var F = plc2_base(W, '#A7946E', '#6C6772', '#8A785F'), g = F.g, D = F.D, R = F.R, r = W.r, i, k, sd = W.P.seed;
    var s = W.P.seed % 2 ? 1 : -1, flat = W.groundAt;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    var kit = plc_kit()
      .def('stone', BOX, std('#FFFFFF', 0.92, 0, { tex: 'stone', tile: 0.7 }))
      .def('adobe', BOX, plc_tex('#FFFFFF', 'plaster', 0.95, 0, 1.4, 0.3, 0.35))
      .def('wood', BOX, mtl('#6B5238', 'wood', 0.9, 0, 0.8))
      .def('trunk', new THREE.CylinderBufferGeometry(0.8, 1, 1, 8), std('#7A6A58', 0.95, 0, { tex: 'wood', tile: 0.4 }))
      .def('skirt', new THREE.CylinderBufferGeometry(1, 0.75, 1, 10, 2), std('#8A7458', 1, 0, { flatShading: true }))
      .def('stem', new THREE.CylinderBufferGeometry(1, 1, 1, 4), std('#6E7440', 0.9, 0))
      .def('frond', new THREE.CircleBufferGeometry(1, 12, -1.35, 2.7), std('#FFFFFF', 0.8, 0, { side: THREE.DoubleSide }))
      .def('bush', new THREE.IcosahedronBufferGeometry(1, 1), std('#FFFFFF', 0.95, 0, { flatShading: true }))
      .def('cane', new THREE.ConeBufferGeometry(0.03, 1, 3, 1), std('#9AA05A', 0.85, 0), { cast: false })
      .def('lamp', BOX, plc_glow(W, '#FFC070', 0.05, 2.0), { cast: false })
      .def('win', BOX, (function () { var m = std('#2A2622', 0.2, 0.3); m.emissive = C('#FFC985'); return W.glow(m, 0, 0.9); })());

    // the river: across the view, meandering, sand bars on both banks
    var zr = -(R + rf(r, 26, 36)), wr = rf(r, 16, 24), ph = r() * 6.28;
    var rz = function (x) { return zr + 7 * Math.sin(x / 45 + ph) + 3 * Math.sin(x / 17 + ph * 2); };
    var ribbon = function (o0, o1, y, mat) {
      var p = [], ix = [], n = 0;
      for (var x = -700; x <= 700; x += 3) { var z0 = rz(x); p.push(x, y, z0 + o0, x, y, z0 + o1); if (n) ix.push((n - 1) * 2, n * 2, (n - 1) * 2 + 1, (n - 1) * 2 + 1, n * 2, n * 2 + 1); n++; }
      var ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); ge.setIndex(ix); ge.computeVertexNormals();
      var m = new THREE.Mesh(ge, mat); m.receiveShadow = true; g.add(m); return m;
    };
    ribbon(-wr / 2 - 7, wr / 2 + 6, 0.02, mtl('#C8B896', 'sand', 1, 0, 2));
    var water = ribbon(-wr / 2, wr / 2, 0.06, std('#56767A', 0.03, 0.7));
    for (var x = -400; x <= 400; x += 4) F.claim(x, rz(x), wr / 2 + 3);
    // cane along both banks
    for (i = 0; i < 1400; i++) {
      var cx = rf(r, -260, 260), side = r() < 0.5 ? 1 : -1, cz = rz(cx) + side * (wr / 2 + rf(r, 0.5, 6));
      if (!F.free(cx, cz, 0.3)) continue;
      var clump = ri(r, 4, 9);
      for (k = 0; k < clump; k++) { var chh = rf(r, 1.8, 3.6); kit.put('cane', plc_m4(cx + rf(r, -0.7, 0.7), chh / 2, cz + rf(r, -0.7, 0.7), 1, chh, 1, rf(r, -0.12, 0.12), 0, rf(r, -0.12, 0.12)), new THREE.Color().setHSL(rf(r, 0.15, 0.2), rf(r, 0.3, 0.45), rf(r, 0.28, 0.4))); }
    }
    // salt cedar and mesquite in a green band along the river
    for (i = 0; i < 260; i++) {
      var bx2 = rf(r, -300, 300), bz2 = rz(bx2) + (r() < 0.5 ? 1 : -1) * (wr / 2 + rf(r, 4, 22));
      if (bx2 * bx2 + bz2 * bz2 < (R + 16) * (R + 16) || !F.free(bx2, bz2, 1.2)) continue;
      var bs = rf(r, 0.6, 1.5);
      kit.put('bush', plc_m4(bx2, bs * 0.7, bz2, bs * 1.3, bs, bs * 1.3, 0, r() * 6, 0), new THREE.Color().setHSL(rf(r, 0.18, 0.26), rf(r, 0.25, 0.4), rf(r, 0.16, 0.24)));
    }
    // low cliffs across the river
    var strata = ['#B98A68', '#C9A07C', '#A8765A', '#D2B08E'];
    for (i = 0; i < 3; i++) {
      var ca = rf(r, -28, 28) + (i - 1) * 16, cp = W.inView(ca, D + rf(r, 330, 480)), cq = F.loc(cp.x, cp.z), mesa = new THREE.Group(), RR = rf(r, 60, 110), hh = 0;
      for (var j = 0; j < 3; j++) {
        var sh = new THREE.Shape(), nn = 14, rr = RR * (1 - j * 0.1);
        for (k = 0; k < nn; k++) { var a = k / nn * 6.2832, q = rr * (0.7 + 0.4 * vnoise(k * 0.8, j + i * 5, sd)); if (k === 0) sh.moveTo(Math.cos(a) * q * 1.6, Math.sin(a) * q * 0.6); else sh.lineTo(Math.cos(a) * q * 1.6, Math.sin(a) * q * 0.6); }
        var th = rf(r, 5, 9), geo = new THREE.ExtrudeBufferGeometry(sh, { depth: th, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
        var m = new THREE.Mesh(geo, std(strata[(i + j) % 4], 1, 0, { flatShading: true, tex: 'stone', tile: 7 })); m.position.y = hh - 2; hh += th; mesa.add(m);
      }
      mesa.position.set(cq[0], 0, cq[1]); g.add(mesa);
    }

    // the terrace: flagstones round the clock and the tubs
    var TR = R + rf(r, 7.5, 10), tsh = new THREE.Shape();
    for (k = 0; k < 40; k++) { var ta = k / 40 * 6.2832, tq = TR * (0.88 + 0.2 * vnoise(k * 0.6, 3, sd + 71)); if (k) tsh.lineTo(Math.cos(ta) * tq, Math.sin(ta) * tq * 0.85); else tsh.moveTo(tq, 0); }
    var terr = new THREE.Mesh(new THREE.ShapeBufferGeometry(tsh, 4), detail(std('#B7A88E', 0.85, 0), 'plc_ashlar', { tile: 1.4, albedo: 0.4, bump: 0.3 }));
    terr.rotation.x = -Math.PI / 2; terr.position.set(0, 0.03, -2); terr.receiveShadow = true; g.add(terr);
    // the tubs: stone rims, water, a lantern beside each
    var waterM = std('#5E9A8E', 0.05, 0.25), rimM = std('#9C8C76', 0.9, 0, { tex: 'stone', tile: 0.6 }), steamSrc = [], lanterns = [];
    var spots = [[-s * (R + rf(r, 3, 4.5)), rf(r, -3, 0.5)], [s * (R + rf(r, 3.5, 5)), rf(r, -5, -1)], [rf(r, -2, 2), -(R + rf(r, 4.5, 6.5))], [-s * (R + rf(r, 5, 8)), -(R + rf(r, 4, 7))]];
    var nT = ri(r, 3, 4), tubs = 0;
    spots.forEach(function (p, n) {
      if (tubs >= nT) return;
      var round = r() < 0.45, rad = round ? rf(r, 1.4, 1.9) : 0, tw = rf(r, 2.6, 3.4), td = rf(r, 2.0, 2.6), ext = round ? rad : Math.max(tw, td) / 2;
      if (!F.free(p[0], p[1], ext + 0.4)) return;
      var TG = new THREE.Group(); TG.position.set(p[0], 0, p[1]); TG.rotation.y = rf(r, -0.5, 0.5); g.add(TG);
      if (round) {
        var lat = new THREE.LatheBufferGeometry([[rad - 0.35, 0.3], [rad - 0.35, 0.55], [rad - 0.05, 0.62], [rad + 0.05, 0.55], [rad + 0.08, 0]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 28);
        var rim = new THREE.Mesh(lat, rimM); TG.add(rim);
        var wd = new THREE.Mesh(new THREE.CircleBufferGeometry(rad - 0.34, 28), waterM); wd.rotation.x = -Math.PI / 2; wd.position.y = 0.42; TG.add(wd);
        steamSrc.push([p[0], 0.42, p[1], rad * 0.6, rad * 0.6]);
      } else {
        [[0, -td / 2, tw + 0.6, 0.3], [0, td / 2, tw + 0.6, 0.3], [-tw / 2, 0, 0.3, td], [tw / 2, 0, 0.3, td]].forEach(function (q) { var b = box(q[2], 0.6, q[3], rimM); b.position.set(q[0], 0.3, q[1]); TG.add(b); });
        var wp = new THREE.Mesh(new THREE.PlaneBufferGeometry(tw - 0.3, td - 0.3), waterM); wp.rotation.x = -Math.PI / 2; wp.position.y = 0.44; TG.add(wp);
        for (k = 0; k < 2; k++) { var st = box(0.6, 0.2, 0.35, rimM); st.position.set(-tw / 4 + k * 0.1, 0.1 + k * 0.2, td / 2 + 0.35 - k * 0.12); TG.add(st); }
        steamSrc.push([p[0], 0.44, p[1], tw * 0.35, td * 0.35]);
      }
      shade(TG);
      var lx = p[0] + (ext + 0.7) * (n % 2 ? 1 : -1), lz = p[1] + ext * 0.4;
      if (F.free(lx, lz, 0.2)) { kit.box('wood', lx, 0.55, lz, 0.1, 1.1, 0.1); kit.box('lamp', lx, 1.2, lz, 0.22, 0.26, 0.22); kit.box('wood', lx, 1.36, lz, 0.3, 0.05, 0.3); lanterns.push([lx, lz]); }
      F.claim(p[0], p[1], ext + 0.5); tubs++;
    });
    lanterns.slice(0, 3).forEach(function (p) { W.lamp('#FFB870', 0.8, 9, F.w(p[0], p[1], 1.3)); });
    plc2_steam(W, F, g, steamSrc, 34);

    // adobe cabins beyond the terrace, a porch and a lit window each
    var cabins = 0;
    for (i = 0; i < 40 && cabins < 4; i++) {
      var ang = rf(r, 9, 30) * (r() < 0.5 ? 1 : -1), cp2 = W.inView(ang, D + R + rf(r, 12, 34)), q2 = F.loc(cp2.x, cp2.z);
      if (!F.free(q2[0], q2[1], 4.5)) continue;
      var CM = plc_m4(q2[0], 0, q2[1], 1, 1, 1, 0, Math.atan2(-q2[0], D - q2[1]) + rf(r, -0.4, 0.4), 0), cc = pick(r, ['#CDA47E', '#D8B48E', '#E4DAC6', '#C49A74']);
      var cw = rf(r, 4.2, 5.4), ch = rf(r, 2.7, 3.1), cdp = rf(r, 3.6, 4.4);
      kit.box('adobe', 0, ch / 2, 0, cw, ch, cdp, 0, cc, CM);
      kit.box('adobe', 0, ch + 0.2, 0, cw + 0.1, 0.4, cdp + 0.1, 0, cc, CM);
      for (k = -cw / 2 + 0.5; k < cw / 2; k += 0.8) kit.put('wood', plc_m4(k, ch - 0.25, cdp / 2 + 0.2, 0.14, 0.14, 0.5).premultiply(CM));
      kit.box('wood', -cw * 0.22, 1.05, cdp / 2 + 0.02, 0.95, 2.1, 0.06, 0, pick(r, ['#2E6F8E', '#6B3A2E', '#3F5E4A']), CM);
      kit.box('win', cw * 0.22, 1.5, cdp / 2 + 0.02, 0.9, 0.8, 0.06, 0, null, CM);
      kit.box('wood', 0, 2.4, cdp / 2 + 1.1, cw + 0.4, 0.1, 2.0, 0, null, CM);
      [-1, 1].forEach(function (e) { kit.box('wood', e * (cw / 2), 1.2, cdp / 2 + 2.0, 0.14, 2.4, 0.14, 0, null, CM); });
      kit.box('wood', cw * 0.2, 0.45, cdp / 2 + 1.0, 1.4, 0.08, 0.4, 0, null, CM);
      if (cabins < 1) W.lamp('#FFC080', 0.8, 10, F.w(q2[0], q2[1], 2.2).add(new THREE.Vector3(0, 0, 0)));
      F.claim(q2[0], q2[1], 4.5); cabins++;
    }
    // fan palms: tall trunks, a skirt of dead fronds, a crown of fans
    var palms = 0;
    var palm = function (x, z) {
      var H = rf(r, 7, 13), lean = rf(r, -0.08, 0.08), lz2 = rf(r, -0.08, 0.08), tx = x + lean * H, tz = z + lz2 * H, tr = rf(r, 0.26, 0.34);
      kit.put('trunk', plc2_seg(x, 0, z, tx, H, tz, tr));
      kit.put('skirt', plc_m4(tx, H - 1.4, tz, tr * 2.3, 2.8, tr * 2.3));
      var nf = ri(r, 28, 36), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();
      for (var f = 0; f < nf; f++) {
        var fa = f * 2.39996 + r() * 0.3, el = lerp(-0.85, 1.05, (f % 7) / 6) + rf(r, -0.12, 0.12), pl = rf(r, 1.4, 2.2), fl = rf(r, 0.7, 0.95);
        X.set(Math.cos(el) * Math.sin(fa), Math.sin(el), Math.cos(el) * Math.cos(fa));
        Y.set(Math.cos(fa), 0, -Math.sin(fa)); Z.crossVectors(X, Y).normalize(); Y.crossVectors(Z, X);
        var bx = tx + X.x * pl, by = H + 0.1 + X.y * pl, bz = tz + X.z * pl;
        kit.put('stem', plc2_seg(tx, H + 0.1, tz, bx, by, bz, 0.035));
        M.makeBasis(X, Y, Z).scale(new THREE.Vector3(fl, fl, 1)).setPosition(bx - X.x * 0.1, by - X.y * 0.1, bz - X.z * 0.1);
        kit.put('frond', M.clone(), new THREE.Color().setHSL(rf(r, 0.2, 0.26), rf(r, 0.3, 0.42), el < -0.5 ? rf(r, 0.34, 0.42) : rf(r, 0.26, 0.34)));
      }
      F.claim(x, z, 2); palms++;
    };
    for (i = 0; i < 50 && palms < 7; i++) {
      var pa = rf(r, 12, 32) * (r() < 0.5 ? 1 : -1), pp = W.inView(pa, rf(r, D * 0.7, D + R + 30)), pq = F.loc(pp.x, pp.z);
      if (!F.free(pq[0], pq[1], 2.2)) continue;
      palm(pq[0], pq[1]);
    }

    kit.flush(g);
    shade(g, true, true);
    water.castShadow = terr.castShadow = false;
    var n0 = W.occupied.length;
    F.claim(0, -2, TR + 1);
    plc_scatter(W, { grass: '#9FA06A', tufts: 2400, bushes: 360, rocks: 150, yucca: 4, bush: '#5E6E40' });
    W.occupied.splice(n0, W.occupied.length - n0);
  }

  // ------------------------------------------------------------ register
  // All eight stand under the open sky, so they take every clock.
  [
    ['Railroad Depot', 11, plc2_depot, null],
    ['Arroyo', 11, plc2_arroyo, [['Clear', 30], ['Scattered', 28], ['Monsoon', 24], ['Dust', 9], ['Blue Norther', 9]]],
    ['Rodeo Arena', 11, plc2_rodeo, [['Clear', 40], ['Scattered', 28], ['Monsoon', 10], ['Dust', 15], ['Blue Norther', 7]]],
    ['Ghost Town', 11, plc2_ghost, [['Clear', 36], ['Scattered', 22], ['Monsoon', 9], ['Dust', 23], ['Blue Norther', 10]]],
    ['Aerostat Field', 10, plc2_aerostat, [['Clear', 50], ['Scattered', 28], ['Monsoon', 6], ['Dust', 8], ['Blue Norther', 8]]],
    ['Drive-In Lot', 11, plc2_drivein, [['Clear', 52], ['Scattered', 26], ['Monsoon', 8], ['Dust', 6], ['Blue Norther', 8]]],
    ['Empty Pool', 11, plc2_pool, [['Clear', 50], ['Scattered', 30], ['Monsoon', 8], ['Dust', 6], ['Blue Norther', 6]]],
    ['Hot Springs', 11, plc2_springs, [['Clear', 40], ['Scattered', 26], ['Monsoon', 10], ['Dust', 6], ['Blue Norther', 18]]]
  ].forEach(function (q) { definePlace(q[0], { w: q[1], eggs: [], build: q[2], skies: q[3] || undefined }); });
