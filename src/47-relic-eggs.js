  // =====================================================================
  // RELIC EGGS: Daniel Arsham's fictional archaeology, from the practice's
  // design DNA. Objects from MLow's world, found a thousand years from now:
  // calcified, eroded on one side, blue calcite growing where they wore through.
  // The shapes are sculpted in Blender and packed in 06-relics.js.
  // =====================================================================
  function relic_crystals(W, geodes, scale, parent) {
    var cm = W.glow(mtl('#8FD9FF', 'crystal', 0.12, 0.05, 0.3), 0.28, 1.15);
    cm.emissive = C('#7FD4FF');
    var up = new THREE.Vector3(0, 1, 0), geo = new THREE.CylinderBufferGeometry(0, 1, 1, 6, 1);
    geo.translate(0, 0.5, 0);
    var body = new THREE.CylinderBufferGeometry(1, 1, 1, 6, 1); body.translate(0, 0.5, 0);
    var list = [];
    geodes.forEach(function (g, i) {
      var n = new THREE.Vector3(g[3], g[4], g[5]).normalize(), base = new THREE.Vector3(g[0], g[1], g[2]);
      var count = 3 + Math.floor(W.r() * 5);
      for (var k = 0; k < count; k++) {
        var tilt = new THREE.Vector3(n.x + rf(W.r, -0.5, 0.5), n.y + rf(W.r, -0.5, 0.5), n.z + rf(W.r, -0.5, 0.5)).normalize();
        var len = rf(W.r, 0.1, 0.34) * (0.6 + g[6]) * scale, rad = len * rf(W.r, 0.12, 0.2);
        var c = new THREE.Group();
        var shaft = new THREE.Mesh(body, cm); shaft.scale.set(rad, len * 0.7, rad); c.add(shaft);
        var tip = new THREE.Mesh(geo, cm); tip.scale.set(rad, len * 0.3, rad); tip.position.y = len * 0.7; c.add(tip);
        c.quaternion.setFromUnitVectors(up, tilt);
        c.position.copy(base).multiplyScalar(scale).addScaledVector(n, -0.03);
        parent.add(c); list.push(c);
      }
    });
    return list;
  }
  function relic_place(W, name, radius, scale, sink) {
    var p = placeInView(W, radius, 9, 26, W.cam.dist * 0.7, W.cam.dist * 1.6);
    if (!p) return null;
    var g = new THREE.Group(), d = RELIC_DATA[name];
    var stone = std('#E4DFD5', 0.92, 0, { tex: 'stone', tile: 0.8 });
    var m = new THREE.Mesh(relicGeometry(name), stone); m.scale.setScalar(scale); g.add(m);
    relic_crystals(W, d.geodes, scale, g);
    // a drift of sand banked against it
    var drift = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 24, 12, 0, 6.2832, 0, Math.PI / 2), std('#C9AE82', 1, 0, { tex: 'sand', tile: 1.5 }));
    drift.scale.set(radius * 0.9, 0.32, radius * 0.55); drift.position.set(rf(W.r, -0.4, 0.4), -0.02, 0.2); g.add(drift);
    g.position.set(p.x, -sink, p.z);
    W.face(g); g.rotation.y += rf(W.r, -0.6, 0.6);
    shade(g); W.add(g);
    var bs = blobShadow(radius * 2.2, radius * 1.4, 0.35); bs.position.set(p.x, 0.03, p.z); W.add(bs);
    return g;
  }
  defineEgg('Calcified Taxi', {
    w: 6, line: 'An NYC taxi calcified as if dug up a thousand years from now, after Daniel Arsham. Blue calcite grows where it wore through. MLow’s work rode 5,000+ of the living ones.',
    build: function (W) { relic_place(W, 'calcified_taxi', 3.2, 1, 0.12); }
  });
  defineEgg('Eroded Eye', {
    w: 5, line: 'The MLow evil eye as a standing stone, broken open at one edge. Crystal inside.',
    build: function (W) { relic_place(W, 'eroded_eye', 1.6, 1.15, 0.05); }
  });
