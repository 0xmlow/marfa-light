  // =====================================================================
  // SQUIGGLE FORMS, the woven tie, painted bloom, skywriting
  // Ideas taken from the works this series honours, with permission, and
  // made into Marfa things:
  //   Barrier Form  Squiggle types for the fluorescent barrier. Straight is
  //                 Flavin's row. Squiggle lays the row on a real Squiggle's
  //                 curve, so seen from above the barrier draws it. Slinky
  //                 makes hoops of light along that curve. Bold doubles the
  //                 tubes. Ribbed darkens every third bay.
  //   Label Tie     the safety orange zip tie, or with a borrowed palette a
  //                 friendship bracelet woven round the label post.
  //   Bloom Tint    with a borrowed palette, some of the wildflowers take it.
  //   Skywriting    rare: every hour, on the hour, a plane writes the token's
  //                 own Squiggle across the sky; the smoke spreads and is gone
  //                 by the next hour. Daylight only.
  // Draws only from hashRng(hash, 7401); builds from their own seeds.
  // =====================================================================

  function formsPlan(hash, gen, place, palette) {
    var r = hashRng(hash, 7401), indoor = !!GEN_INDOOR[place];
    var barrier = pickW(r, [['Straight', 40], ['Squiggle', 25], ['Slinky', 15], ['Bold', 10], ['Ribbed', 10]]);
    var sky = pickW(r, indoor || ALN_NOGATE[place] ? [['None', 1]] : [['None', 92], ['Squiggle', 8]]);
    var seed = Math.floor(r() * 4294967296) >>> 0;
    var tok = sqgPick(hash), pal = palette && palette.name !== 'Marfa' ? palette.name : null;
    var F = {};
    if (gen && gen.light === 'Fluorescent Barrier') F['Barrier Form'] = barrier;
    F['Label Tie'] = pal ? 'Woven, ' + pal : 'Safety Orange';
    if (pal && gen && gen.bloom !== 'None' && gen.bloom !== 'Cholla in Bloom') F['Bloom Tint'] = pal;
    if (sky !== 'None') F['Skywriting'] = 'Chromie Squiggle #' + tok.id;
    return { barrier: barrier, sky: sky, seed: seed, path: tok.hash, squiggle: tok.id, features: F };
  }

  // a real Squiggle's curve as y(t) in -1..1 over t 0..1: Snowfro's points and
  // Catmull-Rom basis, without his height scaling
  function sqgPathFn(hash) {
    var S = sqgState(hash), dp = S.dp, J = Math.max(1, Math.floor(S.segments) - 3);
    return function (t) {
      var f = clamp(t, 0, 1) * J, j = Math.min(J - 1, Math.floor(f)), lt = f - j;
      var y = sqg_curve(sqg_map(dp[j], 0, 255, -1, 1), sqg_map(dp[j + 1], 0, 255, -1, 1), sqg_map(dp[j + 2], 0, 255, -1, 1), sqg_map(dp[j + 3], 0, 255, -1, 1), lt);
      return clamp(y, -1, 1);
    };
  }

  // ------------------------------------------------------------ the label tie
  // returns true when it made a woven tie, so the plaque skips the zip tie
  function labelTie(W, g, y) {
    var p = pal_on(W); if (!p) return false;
    var strands = 3, rr = seedRng(p.seed ^ 0x51ED);
    for (var s = 0; s < strands; s++) {
      var pts = [];
      for (var k = 0; k <= 64; k++) {
        var a = k / 64 * Math.PI * 2, w = Math.sin(a * 6 + s * Math.PI * 2 / strands);
        pts.push(new THREE.Vector3(Math.cos(a) * (0.046 + w * 0.004), y + w * 0.009, Math.sin(a) * (0.046 + w * 0.004)));
      }
      var hex = palColor(W, s, strands, false), mat = std(hex, 0.85);
      var tube = new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0062, 5, true), mat);
      g.add(tube);
      // the knotted ends hang down
      var tail = new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.046, y, 0.004 * s), new THREE.Vector3(0.06, y - 0.03, 0.006 * s + 0.004), new THREE.Vector3(0.056 + rr() * 0.01, y - 0.075 - s * 0.006, 0.01 * s)]), 12, 0.005, 5, false), mat);
      g.add(tail);
    }
    return true;
  }

  // ------------------------------------------------------------ painted bloom
  function pal_bloom(S) {
    var W = S.W, p = pal_on(W), g = S.g;
    if (!p || g.bloom === 'None' || g.bloom === 'Cholla in Bloom') return;
    var r = seedRng(p.seed ^ 0xB100), c = W.cam, sd = g.seed % 991, pts = [];
    for (var i = 0; i < 6000 && pts.length < 420; i++) {
      var q = W.inView(rf(r, -34, 34), rf(r, 2, c.dist + 30)), x = q.x, z = q.z;
      var near = 1 - sstep(S.R, S.R + 16, Math.sqrt(x * x + z * z)), dens = fbm(x / 8, z / 8, sd, 3) + near * 0.18;
      if (dens < 0.52 || !gen_open(S, x, z, 0.08) || !gen_inside(S, x, z, 0.6) || gen_onFloor(S, x, z)) continue;
      pts.push([x, gen_gy(S, x, z), z, rf(r, 0.26, 0.44), r() * 6.28]);
    }
    if (!pts.length) return;
    var stem = gen_inst(new THREE.CylinderBufferGeometry(0.006, 0.008, 1, 4).translate(0, 0.5, 0), std('#5E7A3A', 0.8), pts.length, false);
    var headGeo = new THREE.IcosahedronBufferGeometry(0.045, 0); headGeo.scale(1, 0.42, 1);
    var head = gen_inst(headGeo, std('#FFFFFF', 0.7), pts.length, false), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    pts.forEach(function (t, j) {
      stem.setMatrixAt(j, m4.compose(v.set(t[0], t[1], t[2]), qq.setFromEuler(e.set(0, t[4], 0)), sc.set(1, t[3], 1)));
      head.setMatrixAt(j, m4.compose(v.set(t[0], t[1] + t[3], t[2]), qq, sc.set(1, 1, 1)));
      // a spectrum runs across the field from left to right; a palette is scattered
      var k = p.spectrum ? gen_ndc(S, t[0], t[1], t[2]).x * 0.5 + 0.5 : j;
      head.setColorAt(j, C(p.spectrum ? palColor(W, Math.round(clamp(k, 0, 1) * 20), 21, false) : palColor(W, k, 99, false)));
    });
    S.box.add(stem); S.box.add(head);
    W.pick(head, 'Bloom Tint', 'Some of the flowers have taken the token’s borrowed palette: ' + p.name + '.');
  }

  // ------------------------------------------------------------ skywriting
  function sky_write(S) {
    var W = S.W, F = W.P.forms;
    if (!F || F.sky !== 'Squiggle') return;
    var yAt = sqgPathFn(F.path), p = pal_on(W), N = 260, D = 300;
    var center = W.cam.pos.clone().addScaledVector(gen_dir(S, 0, 0.62), D);
    var right = S.rt.clone(), up = new THREE.Vector3(0, 1, 0), width = 2 * 0.5 * S.th * D;
    var base = [], im = gen_inst(new THREE.IcosahedronBufferGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0, fog: false }), N, false);
    im.renderOrder = 1;
    for (var i = 0; i < N; i++) {
      var u = i / (N - 1);
      base.push(center.clone().addScaledVector(right, (u - 0.5) * width).addScaledVector(up, yAt(u) * width * 0.16));
      im.setColorAt(i, p && p.spectrum ? C(palColor(W, i, N, true)) : new THREE.Color(1, 1, 1));
    }
    var plane = new THREE.Mesh(new THREE.BoxBufferGeometry(2.4, 0.5, 2.8), std('#2A2C30', 0.5, 0.4));
    S.box.add(im); S.box.add(plane);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), drift = new THREE.Vector3();
    var wind = dirAzEl(W.P.windAz || 0, 0);
    W.onUpdate(function (ctx) {
      var phase = (((ctx.utc % 3600) + 3600) % 3600) / 3600, write = clamp(phase / 0.12, 0, 1);
      var day = sstep(-2, 8, ctx.sun.el), fade = Math.pow(1 - phase, 1.4);
      im.material.opacity = 0.75 * day * fade;
      im.visible = plane.visible = day > 0.01;
      for (var i2 = 0; i2 < N; i2++) {
        var u2 = i2 / (N - 1), age = phase - u2 * 0.12, s2 = u2 <= write ? 1.6 + 14 * clamp(age, 0, 1) : 0;
        drift.copy(wind).multiplyScalar(60 * clamp(age, 0, 1));
        im.setMatrixAt(i2, m4.compose(drift.add(base[i2]), q, sc.set(s2, s2, s2)));
      }
      im.instanceMatrix.needsUpdate = true;
      var h = Math.min(N - 1, Math.floor(write * (N - 1)));
      plane.position.copy(base[h]); plane.visible = plane.visible && write < 1;
    });
    W.pick(im, 'Skywriting', 'Every hour, on the hour, a plane writes Chromie Squiggle #' + F.squiggle + ' across the sky over Marfa. The smoke spreads on the wind and is gone by the next hour.');
  }
