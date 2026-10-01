  // =====================================================================
  // SOLAR ALIGNMENT and GROUND WORK
  //   Alignment    every token keeps one day and one minute of the year:
  //                a solstice, an equinox, or its own residency day, at a
  //                low sun after rising or before setting. The minute is
  //                found from the same sun model the dials read.
  //   Gate         a limestone gate stands on the line from a bronze marker
  //                to the sun at that minute: an oculus, a slot, or two
  //                stones. At the minute, real shadow mapping lets the sun
  //                through the opening and onto the marker, and the marker
  //                answers. Live, it happens once a year. A jumps to it.
  //   Ground Work  land art on the caliche: a stone line laid toward the
  //                alignment, a stone circle, raked rings, or cairns.
  // The plan draws only from hashRng(hash, 5201) and hashRng(hash, 5301) and
  // the build only from its own seeds, so no other trait moves. Prefix aln_.
  // =====================================================================

  var ALN_EVENTS = [['Summer Solstice', 6, 21, 22], ['Winter Solstice', 12, 21, 18], ['Spring Equinox', 3, 20, 16],
    ['Autumn Equinox', 9, 22, 16], ['Residency Day', 4, 0, 14]];
  var ALN_YEAR = 2027;
  // places whose roofs and walls keep a low sun off nearly all open ground
  var ALN_NOGATE = { 'Railroad Depot': 1 };

  // the minute on day (mo, d) when the sun crosses el degrees, rising or setting
  function aln_find(mo, d, el, rising) {
    var t0 = marfaUtc(ALN_YEAR, mo, d, 0, 0), prev = sunPos(t0).el;
    for (var m = 1; m <= 1440; m++) {
      var t = t0 + m * 60, cur = sunPos(t).el;
      if (rising ? (prev < el && cur >= el) : (prev > el && cur <= el)) return t;
      prev = cur;
    }
    return null;
  }

  function alnPlan(hash, place, stillUtc) {
    var r = hashRng(hash, 5201), indoor = !!GEN_INDOOR[place];
    var ev = pickW(r, ALN_EVENTS.map(function (e) { return [e[0], e[3]]; })), row = ALN_EVENTS.filter(function (e) { return e[0] === ev; })[0];
    var rising = r() < 0.5, el = rf(r, 3.5, 13), gateKind = pickW(r, [['Oculus', 40], ['Slot', 34], ['Twin Stones', 26]]);
    var gateRoll = r(), seed = Math.floor(r() * 4294967296) >>> 0;
    var mo = row[1], d = row[2];
    if (!d) { var st = marfaTime(stillUtc); mo = st.mo; d = st.d; }
    var utc = aln_find(mo, d, el, rising);
    var sun = sunPos(utc), mt = marfaTime(utc);
    var when = MONTHS[mt.mo - 1] + ' ' + mt.d + ' ' + pad2(mt.h) + ':' + pad2(mt.m);
    var gate = indoor || ALN_NOGATE[place] || gateRoll < 0.3 ? 'None' : gateKind;
    var g = hashRng(hash, 5301);
    var ground = pickW(g, indoor ? [['None', 1]] : [['None', 50], ['Stone Line', 18], ['Stone Circle', 14], ['Raked Rings', 11], ['Cairns', 7]]);
    var gseed = Math.floor(g() * 4294967296) >>> 0;
    return {
      event: ev, rising: rising, el: sun.el, az: sun.az, utc: utc, when: when, gate: gate, seed: seed, ground: ground, gseed: gseed,
      features: {
        'Alignment': ev + ' ' + (rising ? 'Sunrise' : 'Sunset') + ', ' + when,
        'Alignment Gate': gate,
        'Ground Work': ground
      }
    };
  }

  // ------------------------------------------------------------ build
  function alnBuild(W, hero) {
    var A = W.P.align;
    if (!A) return;
    var S = { W: W, hero: hero, R: hero.R, box: new THREE.Group() };
    S.box.userData.plcSkip = true; S.box.userData.alnSkip = true; W.add(S.box);
    W.root.updateMatrixWorld(true);
    var steps = [aln_gate, aln_ground];
    for (var i = 0; i < steps.length; i++) {
      try { steps[i](S, A); } catch (e) {
        if (root.MARFA_GEN_STRICT) throw e;
        if (root.console) console.warn('alignment layer', e);
      }
    }
  }
  function aln_gy(W, x, z) { return W.groundAt ? W.groundAt(x, z) : 0; }
  // true when nothing in the scene stands between p and the sun along u
  function aln_clear(W, p, u, far) {
    if (!W.alnSolids) {
      // solid meshes only: sprites and lines need a camera to raycast, glass and sky let light through
      W.alnSolids = [];
      W.root.traverse(function (o) {
        var mt = o.material;
        if (!o.isMesh || !o.visible || !mt || Array.isArray(mt)) return;
        if (mt.transparent || mt.side === THREE.BackSide || mt.depthWrite === false) return;
        for (var q = o; q; q = q.parent) if (q.userData.alnSkip || q.visible === false) return;
        W.alnSolids.push(o);
      });
    }
    var ray = new THREE.Raycaster(p.clone(), u.clone(), 0.05, far);
    return ray.intersectObjects(W.alnSolids, false).length === 0;
  }
  // the generative layer's own framing maths: the camera is not posed yet at build time
  function aln_onScreen(W, x, y, z) {
    if (!W.alnView) { var g = W.P.gen || {}; W.alnView = { W: W, fov: GEN_FOV[g.lens] || 38, shift: g.framing ? gen_shift(g) : 0 }; gen_basis(W.alnView); }
    var n = gen_ndc(W.alnView, x, y, z);
    return n.dep > 2 && Math.abs(n.x) < 0.88 && n.y > -0.92 && n.y < 0.9;
  }

  function aln_gate(S, A) {
    if (A.gate === 'None' || A.el <= 0) return;
    var W = S.W, r = seedRng(A.seed), u = dirAzEl(A.az, A.el), hz = new THREE.Vector3(u.x, 0, u.z).normalize();
    var stone = mtl('#CFC2A8', 'obs_limestone', 0.82, 0, 2.0), bronze = mtl('#8C6A3F', 'brushed', 0.34, 0.9, 0.6);
    var found = null;
    // three passes, each looser: in front and in view; anywhere in view; anywhere the sun reaches
    for (var i = 0; i < 540 && !found; i++) {
      var pass = i < 260 ? 0 : i < 420 ? 1 : 2;
      var ang = r() * Math.PI * 2, rad = S.R + rf(r, 1.2, pass < 2 ? 6 : 16), D = rf(r, 5.5, 12);
      var mx = Math.cos(ang) * rad, mz = Math.sin(ang) * rad, my = aln_gy(W, mx, mz);
      var gx = mx + hz.x * D * Math.cos(A.el * D2R), gz = mz + hz.z * D * Math.cos(A.el * D2R);
      var gy0 = aln_gy(W, gx, gz), hole = my + 0.03 + D * Math.sin(A.el * D2R);
      if (hole - gy0 < 0.4 || hole - gy0 > 3.6) continue;
      if (!W.free(mx, mz, 0.55) || !W.free(gx, gz, 1.4)) continue;
      if (pass < 2 && (!aln_onScreen(W, mx, my, mz) || !aln_onScreen(W, gx, gy0 + 0.5, gz))) continue;
      // the marker sits on the camera's side of the clock, in plain sight
      var cp = W.cam.pos, cl = Math.sqrt(cp.x * cp.x + cp.z * cp.z) || 1;
      if (pass < 1 && (mx * cp.x + mz * cp.z) / cl < -S.R * 0.3) continue;
      var M = new THREE.Vector3(mx, my + 0.03, mz);
      if (!aln_clear(W, M, u, 400)) continue;
      var toCam = new THREE.Vector3(cp.x - mx, cp.y - M.y - 0.05, cp.z - mz), dc = toCam.length();
      if (pass < 1 && !aln_clear(W, M.clone().setY(M.y + 0.08), toCam.normalize(), dc - 0.5)) continue;
      found = { M: M, G: new THREE.Vector3(gx, hole, gz), base: gy0, D: D };
    }
    if (!found) { A.built = false; return; }
    A.built = true; A.at = { M: [found.M.x, found.M.y, found.M.z], G: [found.G.x, found.G.y, found.G.z], cam: [W.cam.pos.x, W.cam.pos.y, W.cam.pos.z], R: S.R };
    var M = found.M, G = found.G, face = Math.atan2(hz.x, hz.z);
    W.claim(M.x, M.z, 0.55); W.claim(G.x, G.z, 1.6);
    W.shadowExtent = Math.max(W.shadowExtent || 0, Math.sqrt(G.x * G.x + G.z * G.z) + 2.5);

    // the gate: an opening at exactly the height where the line to the sun crosses it
    var g = new THREE.Group(); g.position.set(G.x, found.base, G.z); g.rotation.y = face; S.box.add(g);
    var h = G.y - found.base, ap = 0.17 + r() * 0.06, top = Math.max(h + rf(r, 1.1, 2.2), rf(r, 3, 4.2)), wide = rf(r, 1.7, 2.6), thick = 0.46;
    if (A.gate === 'Twin Stones') {
      [-1, 1].forEach(function (s) {
        var st = obsBevel(wide * 0.42, top + s * 0.15, thick * 1.4, stone, 0.05);
        st.position.set(s * (wide * 0.21 + 0.07), (top + s * 0.15) / 2, 0); g.add(st);
      });
    } else {
      var sh = new THREE.Shape(), w2 = wide / 2;
      sh.moveTo(-w2, 0); sh.lineTo(w2, 0); sh.lineTo(w2, top); sh.lineTo(-w2, top); sh.closePath();
      var hp = new THREE.Path();
      if (A.gate === 'Oculus') hp.absarc(0, h, ap, 0, Math.PI * 2, true);
      else { var sb = Math.max(0.1, h - 0.55); hp.moveTo(-0.055, sb); hp.lineTo(0.055, sb); hp.lineTo(0.055, h + 0.55); hp.lineTo(-0.055, h + 0.55); hp.closePath(); }
      sh.holes.push(hp);
      var geo = new THREE.ExtrudeBufferGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 40 });
      geo.translate(0, 0, -thick / 2);
      var slab = new THREE.Mesh(geo, stone); g.add(slab);
      // a bronze lining makes the opening read from a distance
      if (A.gate === 'Oculus') {
        var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(ap + 0.012, 0.018, 8, 48), bronze); ring.position.set(0, h, thick / 2 + 0.01); g.add(ring);
      }
    }
    var footing = obsBevel(wide + 0.4, 0.14, thick + 0.5, stone, 0.03); footing.position.y = 0.04; g.add(footing);
    shade(g);

    // the marker: a bronze disc set flush, an engraved ring, the day on a plate
    var mk = new THREE.Group(); mk.position.copy(M); S.box.add(mk);
    var disc = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.3, 0.32, 0.05, 48), mtl('#8C6A3F', 'brushed', 0.3, 0.9, 0.6)); disc.position.y = -0.005; mk.add(disc);
    var ringM = new THREE.Mesh(new THREE.TorusBufferGeometry(0.2, 0.008, 6, 48), mtl('#3A2E20', 'brushed', 0.6, 0.6, 0.6)); ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.022; mk.add(ringM);
    var plate = textPlane([A.event.toUpperCase(), A.when + (A.rising ? '  SUNRISE' : '  SUNSET')], { bg: '#7A5C36', color: '#F2E6CF', font: FONT_MONO, height: 0.11, px: 30, pad: 0.4 });
    plate.rotation.x = -Math.PI / 2; plate.rotation.z = -face; plate.position.set(-hz.x * 0.52, 0.026, -hz.z * 0.52); mk.add(plate);
    shade(mk, false, true);
    resAlignment(W, A, mk, g);

    // the marker answers the sun: a warm glow within a few minutes of the alignment
    var dm = disc.material; dm.emissive = C('#FFB869'); dm.emissiveIntensity = 0;
    var sd = new THREE.Vector3();
    W.onUpdate(function (ctx) {
      dirAzEl(ctx.sun.az, ctx.sun.el, sd);
      var off = Math.acos(clamp(sd.dot(u), -1, 1)) * R2D;
      var date = marfaTime(A.utc);
      dm.emissiveIntensity = ctx.sun.el > 0 && ctx.t.mo === date.mo && ctx.t.d === date.d ? 1.6 * (1 - sstep(0.15, 0.9, off)) : 0;
    });
    W.pick(g, 'Alignment Gate', 'On ' + A.event.toLowerCase() + ', at ' + A.when.slice(-5) + ' as the sun ' + (A.rising ? 'rises' : 'sets') +
      ', the light passes through this ' + (A.gate === 'Twin Stones' ? 'gap' : A.gate.toLowerCase()) + ' and lands on the bronze marker. It happens once a year. Press A to go to the minute.');
    W.pick(mk, 'Alignment Marker', A.event + ', ' + A.when + '. The marker glows when the sun lines up with the gate.');
  }

  // a small rough stone: a squashed, jittered icosahedron, instanced
  function aln_stoneGeo() {
    var geo = new THREE.IcosahedronBufferGeometry(1, 0), p = geo.attributes.position, rr = seedRng(5309);
    for (var i = 0; i < p.count; i++) { var k = 0.78 + rr() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k); }
    geo.computeVertexNormals(); return geo;
  }
  function aln_ground(S, A) {
    if (A.ground === 'None') return;
    var W = S.W, r = seedRng(A.gseed), pts = [], R = S.R, line = null;
    function tryAt(x, z, s, rot, rad) {
      if (!W.free(x, z, rad || 0.25)) return false;
      var c = W.cam.pos; if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < 4) return false;
      if (W.road && Math.abs((x - W.road.center.x) * W.road.across.x + (z - W.road.center.z) * W.road.across.z) < W.road.width / 2 + 1) return false;
      pts.push([x, aln_gy(W, x, z), z, s, rot]); return true;
    }
    var stoneCol = W.groundColor ? W.groundColor.clone().multiplyScalar(0.62) : C('#7A6A55');
    if (A.ground === 'Stone Line') {
      // laid toward the alignment: a walk that points at the token's own sunrise or sunset
      var hz = dirAzEl(A.az, 0), side = r() < 0.5 ? -1 : 1, ox = -hz.z * side * (R + 1.6), oz = hz.x * side * (R + 1.6);
      var L = rf(r, 12, 22);
      for (var t = 0; t < L; t += rf(r, 0.32, 0.5)) tryAt(ox + hz.x * t + rf(r, -0.08, 0.08), oz + hz.z * t + rf(r, -0.08, 0.08), rf(r, 0.11, 0.2), r() * 6.3);
      line = 'A line of stones laid toward the ' + A.event.toLowerCase() + (A.rising ? ' sunrise' : ' sunset') + ', after Richard Long.';
    } else if (A.ground === 'Stone Circle') {
      var cr = R + rf(r, 2.4, 4.2), n = Math.round(cr * 2 * Math.PI / rf(r, 0.42, 0.6));
      for (var j = 0; j < n; j++) { var a = j / n * Math.PI * 2 + rf(r, -0.02, 0.02); tryAt(Math.cos(a) * cr, Math.sin(a) * cr, rf(r, 0.12, 0.22), r() * 6.3); }
    } else if (A.ground === 'Raked Rings') {
      var rings = ri(r, 6, 10), r0 = R + 0.7, gap = rf(r, 0.26, 0.36), segs = [];
      for (var k = 0; k < rings; k++) {
        var rr0 = r0 + k * gap, m = Math.round(rr0 * 2 * Math.PI / 0.18);
        for (var q = 0; q < m; q++) {
          var aa = q / m * Math.PI * 2, x = Math.cos(aa) * rr0, z = Math.sin(aa) * rr0;
          if (W.free(x, z, 0.08)) segs.push([x, aln_gy(W, x, z), z, aa, rr0 * 2 * Math.PI / m]);
        }
      }
      if (!segs.length) return;
      var rg = new THREE.BoxBufferGeometry(1, 0.012, 0.045), rm = std(gen_hexOf(stoneCol.clone().multiplyScalar(1.15)), 0.95, 0);
      var im = new THREE.InstancedMesh(rg, rm, segs.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      segs.forEach(function (s, i) { e.set(0, -s[3] - Math.PI / 2, 0); qq.setFromEuler(e); sc.set(s[4] * 1.02, 1, 1); ps.set(s[0], s[1] + 0.004, s[2]); im.setMatrixAt(i, m4.compose(ps, qq, sc)); });
      im.receiveShadow = true; S.box.add(im);
      W.pick(im, 'Raked Rings', 'Rings raked into the caliche around the clock. Wind fills them back in.');
      return;
    } else if (A.ground === 'Cairns') {
      var nc = ri(r, 3, 6);
      for (var c = 0; c < nc * 30 && pts.length < nc * 5; c++) {
        var ca = r() * Math.PI * 2, cd = R + rf(r, 2, 7), cx = Math.cos(ca) * cd, cz = Math.sin(ca) * cd;
        if (!W.free(cx, cz, 0.6) || !aln_onScreen(W, cx, 0.3, cz)) continue;
        var levels = ri(r, 3, 6), base = aln_gy(W, cx, cz), yy = 0;
        for (var lv = 0; lv < levels; lv++) { var s2 = 0.26 * (1 - lv / (levels + 1.5)); pts.push([cx + rf(r, -0.03, 0.03), base + yy, cz + rf(r, -0.03, 0.03), s2, r() * 6.3]); yy += s2 * 1.05; }
        W.claim(cx, cz, 0.6);
      }
    }
    if (!pts.length) return;
    var geo = aln_stoneGeo(), mat = mtl(gen_hexOf(stoneCol), 'stone', 0.9, 0, 0.8);
    var inst = new THREE.InstancedMesh(geo, mat, pts.length), m = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    pts.forEach(function (p, i) {
      eu.set(0, p[4], 0); qt.setFromEuler(eu); sv.set(p[3] * rf(r, 0.85, 1.25), p[3], p[3] * rf(r, 0.85, 1.25));
      v.set(p[0], p[1] + p[3] * 0.35, p[2]); inst.setMatrixAt(i, m.compose(v, qt, sv));
    });
    inst.castShadow = inst.receiveShadow = true; S.box.add(inst);
    W.pick(inst, A.ground, line || (A.ground === 'Stone Circle' ? 'A ring of field stones around the clock.' : 'Cairns: stones stacked by visitors, one on another.'));
  }
