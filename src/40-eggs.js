  // =====================================================================
  // EASTER EGGS, and the life that moves through every scene
  // =====================================================================

  // ------------------------------------------------------------ a New Yorker
  // A generic figure in the spirit of NEW YORKERS (n3wyorkers.com), not any
  // one of the 7,541 painted characters. One per scene, at most.
  function newYorker(r, W) {
    var g = new THREE.Group();
    var coatC = pick(r, ['#1F2A44', '#8C2F39', '#2F4B3A', '#C8A15A', '#16171A', '#6B4E9B', '#2962FF']);
    var skinC = pick(r, ['#8D5524', '#C68642', '#E0AC69', '#F1C27D', '#FFDBAC', '#5C3A21']);
    var coat = std(coatC, 0.8), skin = std(skinC, 0.7), pants = std(pick(r, ['#22252B', '#3B3F46', '#4A3B2E', '#1D2B3A']), 0.9);
    var shoe = std('#111111', 0.5), acc = std(pick(r, [BRAND.blue, BRAND.cyan, '#F2E9D8', '#D1495B', '#EDAE49']), 0.7);
    [-1, 1].forEach(function (sd) {
      var leg = cyl(0.07, 0.065, 0.8, 10, pants); leg.position.set(sd * 0.1, 0.44, 0); g.add(leg);
      var sh = box(0.12, 0.08, 0.27, shoe); sh.position.set(sd * 0.1, 0.04, 0.05); g.add(sh);
    });
    var skirt = cyl(0.21, 0.29, 0.62, 16, coat); skirt.position.y = 0.95; g.add(skirt);
    var torso = cyl(0.2, 0.22, 0.5, 16, coat); torso.position.y = 1.48; g.add(torso);
    var sho = sph(0.21, coat); sho.scale.set(1.15, 0.5, 0.85); sho.position.y = 1.72; g.add(sho);
    var neck = cyl(0.05, 0.06, 0.1, 8, skin); neck.position.y = 1.8; g.add(neck);
    var head = sph(0.115, skin, 20, 16); head.position.y = 1.93; g.add(head);
    var hat = pick(r, ['beanie', 'cap', 'fedora', 'none', 'headphones']);
    if (hat === 'beanie') { var b = sph(0.125, acc, 16, 8); b.scale.y = 0.8; b.position.y = 1.99; g.add(b); }
    if (hat === 'cap') { var c = sph(0.12, acc, 16, 8); c.position.y = 1.98; g.add(c); var br = box(0.16, 0.02, 0.14, acc); br.position.set(0, 1.97, 0.12); g.add(br); }
    if (hat === 'fedora') { var fb = cyl(0.2, 0.2, 0.02, 20, pants); fb.position.y = 2.0; g.add(fb); var fc = cyl(0.1, 0.12, 0.13, 16, pants); fc.position.y = 2.07; g.add(fc); }
    if (hat === 'headphones') { var hp = new THREE.Mesh(new THREE.TorusBufferGeometry(0.13, 0.02, 8, 20, Math.PI), acc); hp.position.y = 1.95; hp.rotation.y = Math.PI / 2; g.add(hp); }
    if (r() < 0.55) { var sc = new THREE.Mesh(new THREE.TorusBufferGeometry(0.12, 0.045, 8, 20), acc); sc.rotation.x = Math.PI / 2; sc.position.y = 1.79; g.add(sc); }
    var armL = new THREE.Group(), armR = new THREE.Group();
    [[armL, -1], [armR, 1]].forEach(function (q) {
      var a = cyl(0.055, 0.05, 0.62, 8, coat); a.position.y = -0.31; q[0].add(a);
      var h = sph(0.05, skin); h.position.y = -0.64; q[0].add(h);
      q[0].position.set(q[1] * 0.27, 1.72, 0); q[0].rotation.z = q[1] * 0.12; g.add(q[0]);
    });
    var prop = pick(r, ['coffee', 'tote', 'paper', 'none']);
    if (prop === 'coffee') {
      armR.rotation.x = -0.9;
      var cup = cyl(0.045, 0.035, 0.12, 12, std('#2E6FD1', 0.6)); cup.position.set(0, -0.66, 0.05); armR.add(cup);
    }
    if (prop === 'tote') { var tb = box(0.3, 0.34, 0.06, std('#EDE6D6', 0.9)); tb.position.set(0.03, -0.72, 0); armR.add(tb); }
    if (prop === 'paper') { armL.rotation.x = -1.0; var np = box(0.26, 0.02, 0.34, std('#E6E2D6', 0.9)); np.position.set(0, -0.66, 0.05); armL.add(np); }
    shade(g);
    var ph = r() * 6.28;
    g.userData.update = function (ctx) {
      g.rotation.z = Math.sin(ctx.real * 0.8 + ph) * 0.012;
      head.rotation.y = Math.sin(ctx.real * 0.23 + ph) * 0.5;
    };
    g.userData.what = 'New Yorker';
    return g;
  }

  // ------------------------------------------------------------ helpers
  // a free spot in frame; if the asked-for band is crowded, widen it step by step
  function placeInView(W, rad, offA, offB, dA, dB) {
    for (var i = 0; i < 90; i++) {
      var grow = 1 + Math.floor(i / 30) * 0.5;
      var off = rf(W.r, offA, Math.min(offB * grow, 34)) * (W.r() < 0.5 ? -1 : 1), p = W.inView(off, rf(W.r, dA, dB * grow));
      if (W.free(p.x, p.z, rad)) { W.claim(p.x, p.z, rad); return p; }
    }
    return null;
  }
  function billboardFrame(W, w, h, postH, tex) {
    var g = new THREE.Group(), steel = std('#50555B', 0.6, 0.6);
    var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: C('#FFFFFF'), emissiveMap: tex, emissiveIntensity: 0 }));
    W.glow(face.material, 0, 0.55);
    face.position.set(0, postH + h / 2, 0.16); g.add(face);
    var back = box(w + 0.2, h + 0.2, 0.25, steel); back.position.set(0, postH + h / 2, 0); g.add(back);
    [-w / 3, w / 3].forEach(function (x) { var p = box(0.35, postH, 0.35, steel); p.position.set(x, postH / 2, -0.1); g.add(p); });
    var walk = box(w, 0.06, 0.9, steel); walk.position.set(0, postH - 0.05, 0.5); g.add(walk);
    return g;
  }
  var FLOWER_COLS = ['#FF2E63', '#2962FF', '#22D3EE', '#00E676', '#FFD23F', '#FF7A3C', '#9B5DE5', '#F15BB5'];
  function paintFlowers(g, x0, y0, w, h, r) {
    var n = ri(r, 5, 8);
    for (var i = 0; i < n; i++) {
      var cx = x0 + rf(r, 0.1, 0.9) * w, cy = y0 + rf(r, 0.15, 0.75) * h, R = rf(r, 0.1, 0.2) * h;
      var pc = pick(r, FLOWER_COLS), pc2 = pick(r, FLOWER_COLS), np = ri(r, 7, 12);
      g.fillStyle = pc;
      for (var d = 0; d < np; d++) {
        var dx = cx + rf(r, -R, R), len = rf(r, 0.2, 0.9) * h * 0.4;
        g.fillRect(dx - 3, cy, 6, len); g.beginPath(); g.arc(dx, cy + len, 6, 0, 6.2832); g.fill();
      }
      for (var p = 0; p < np; p++) {
        var a = p / np * 6.2832;
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.fillStyle = p % 2 ? pc : pc2;
        g.beginPath(); g.ellipse(R * 0.55, 0, R * 0.55, R * 0.24, 0, 0, 6.2832); g.fill();
        g.restore();
      }
      g.fillStyle = '#0D0D0D'; g.beginPath(); g.arc(cx, cy, R * 0.28, 0, 6.2832); g.fill();
      g.fillStyle = pick(r, [BRAND.cyan, '#FFD23F', '#FFFFFF']); g.beginPath(); g.arc(cx, cy, R * 0.14, 0, 6.2832); g.fill();
    }
  }

  // ------------------------------------------------------------ the eggs
  var EGG_BUILD = {
    'NYC Taxi': function (W) {
      var t = taxi(W);
      if (W.road) {
        var rd = W.road, dirn = W.r() < 0.5 ? 1 : -1, lane = dirn * 1.9, speed = rf(W.r, 20, 27), s = rf(W.r, -300, 300), wait = 0;
        var yaw = Math.atan2(-rd.along.z * dirn, rd.along.x * dirn);
        t.g.rotation.y = yaw;
        W.add(t.g);
        W.onUpdate(function (ctx) {
          if (wait > 0) { wait -= ctx.dt; t.g.visible = false; return; }
          t.g.visible = true;
          s += speed * ctx.dt * dirn;
          if (Math.abs(s) > 650) { s = -650 * dirn; wait = rf(W.r, 3, 20); }
          t.g.position.copy(rd.center).addScaledVector(rd.along, s).addScaledVector(rd.across, lane);
          t.spin(speed * ctx.dt / 0.34);
        });
      } else {
        var p = placeInView(W, 3.4, 12, 26, W.cam.dist * 0.55, W.cam.dist * 1.35);
        if (!p) return;
        t.g.position.copy(p); t.g.rotation.y = rf(W.r, 0, 6.28);
        var bs = blobShadow(5.6, 2.6, 0.5); bs.rotation.z = 0; t.g.add(bs);
        W.add(t.g);
      }
    },
    'fLOWers Billboard': function (W) {
      var p = placeInView(W, 7, 16, 28, 45, 95);
      if (!p) return;
      var rr = W.r, tex = canvasTex(1536, 600, function (g, w, h) {
        var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0D0D0D'); gr.addColorStop(1, '#1B1F2A');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        paintFlowers(g, 0, 0, w * 0.62, h, rr);
        g.fillStyle = '#F0F4F8'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.font = 'italic 700 110px ' + FONT_SERIF; g.fillText('fLOWers', w * 0.64, h * 0.42);
        g.font = '400 42px ' + FONT_MONO; g.fillText('SIGNED PRINTS', w * 0.645, h * 0.56);
        g.fillStyle = BRAND.blue; g.font = '700 70px ' + FONT_MONO; g.fillText('MLOW.NYC', w * 0.645, h * 0.76);
      });
      var b = billboardFrame(W, 13, 5.1, 4.8, tex);
      b.position.copy(p); W.face(b); shade(b); W.add(b);
      var bs = blobShadow(12, 3, 0.35); bs.position.copy(p); W.add(bs);
    },
    'New Yorker': function (W) {
      if (W.P.clock === 'Analemmatic Sundial') return;           // already the gnomon
      var p = placeInView(W, 0.6, 6, 16, W.cam.dist * 0.45, W.cam.dist * 0.8);
      if (!p) return;
      var f = newYorker(W.r, W); f.position.copy(p);
      f.rotation.y = Math.atan2(-p.x, -p.z) + rf(W.r, -0.5, 0.5);
      W.add(f); W.onUpdate(f.userData.update);
      var sg = textPlane(['NEW YORKERS', 'N3WYORKERS.COM'], { bg: '#0D0D0D', color: '#F0F4F8', height: 0.5, px: 70, font: FONT_MONO, pad: 0.3 });
      var aframe = new THREE.Group(); sg.position.y = 0.6; aframe.add(sg);
      var leg = box(0.04, 0.6, 0.04, std('#222', 0.6)); leg.position.set(0, 0.3, -0.05); aframe.add(leg);
      aframe.position.copy(p).add(new THREE.Vector3(0.9, 0, 0.4)); W.face(aframe); shade(aframe); W.add(aframe);
    },
    'Bodega Cat': function (W) {
      var p = placeInView(W, 0.4, 4, 12, W.cam.dist * 0.5, W.cam.dist * 0.8);
      if (!p) return;
      var g = new THREE.Group(), fur = std(pick(W.r, ['#D98A3D', '#2A2A2A', '#E9E3D6', '#8C8C8C']), 0.9);
      var body = sph(0.17, fur); body.scale.set(0.8, 1, 1.25); body.position.y = 0.2; g.add(body);
      var head = sph(0.1, fur); head.position.set(0, 0.42, 0.1); g.add(head);
      [-1, 1].forEach(function (sd) { var e = new THREE.Mesh(new THREE.ConeBufferGeometry(0.035, 0.07, 4), fur); e.position.set(sd * 0.055, 0.52, 0.1); g.add(e); });
      var eyeM = std('#C9E36A', 0.3); eyeM.emissive = C('#9CC23A'); eyeM.emissiveIntensity = 0.3;
      [-1, 1].forEach(function (sd) { var e = sph(0.014, eyeM, 8, 6); e.position.set(sd * 0.035, 0.44, 0.19); g.add(e); });
      var tail = new THREE.Group(); tail.position.set(0, 0.08, -0.18); g.add(tail);
      var tl = cyl(0.022, 0.03, 0.34, 8, fur); tl.position.set(0, 0.0, -0.15); tl.rotation.x = Math.PI / 2.4; tail.add(tl);
      g.position.copy(p); W.face(g); shade(g); W.add(g);
      W.onUpdate(function (ctx) { tail.rotation.y = Math.sin(ctx.real * 1.7) * 0.5; head.rotation.y = Math.sin(ctx.real * 0.31) * 0.4; });
    },
    'First Eye Flower': function (W) {
      var p = placeInView(W, 1.2, 9, 20, W.cam.dist * 0.6, W.cam.dist * 1.1);
      if (!p) return;
      var g = new THREE.Group(), stemM = std('#3F6B3A', 0.8), H = rf(W.r, 2.8, 3.6);
      var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, H * 0.35, 0.05), new THREE.Vector3(-0.1, H * 0.7, 0), new THREE.Vector3(0, H, 0.1)]);
      g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(curve, 30, 0.06, 8), stemM));
      [0.3, 0.5].forEach(function (f, k) { var lf = sph(0.35, stemM); lf.scale.set(1, 0.12, 0.4); lf.position.copy(curve.getPoint(f)); lf.position.x += k ? -0.3 : 0.3; lf.rotation.z = k ? 0.6 : -0.6; g.add(lf); });
      var head = new THREE.Group(); head.position.copy(curve.getPoint(1)); g.add(head);
      var pm = [std('#3E55B8', 0.6), std('#7F8FD1', 0.6)];
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * 6.2832, pet = sph(0.42, pm[i % 2], 12, 8);
        pet.scale.set(0.45, 1, 0.12); pet.position.set(Math.sin(a) * 0.55, Math.cos(a) * 0.55, -0.05); pet.rotation.z = -a; head.add(pet);
      }
      var eye = sph(0.32, new THREE.MeshStandardMaterial({ map: eyeTexture(), roughness: 0.3, emissive: C('#FFFFFF'), emissiveMap: eyeTexture(), emissiveIntensity: 0.05 }), 32, 20);
      W.glow(eye.material, 0.05, 0.5);
      head.add(eye);
      g.position.copy(p); shade(g); W.add(g);
      var wp = new THREE.Vector3();
      W.onUpdate(function (ctx) {
        head.getWorldPosition(wp);
        head.lookAt(ctx.camera.position);
        head.rotation.z += Math.sin(ctx.real * 0.5) * 0.05;
      });
    },
    'Chromie Squiggle': function (W) {
      var pts = [], n = 90, amp = rf(W.r, 0.35, 0.6), fr = rf(W.r, 4, 7), Wd = 4.2;
      for (var i = 0; i <= n; i++) { var u = i / n; pts.push(new THREE.Vector3((u - 0.5) * Wd, Math.sin(u * fr * 6.2832) * amp * (0.6 + 0.4 * Math.sin(u * 3.1)), 0)); }
      var curve = new THREE.CatmullRomCurve3(pts), segs = 240, rad = 10;
      var geo = new THREE.TubeBufferGeometry(curve, segs, 0.075, rad, false), cols = [], c = new THREE.Color(), h0 = W.r();
      for (i = 0; i <= segs; i++) {
        c.setHSL((h0 + i / segs * 0.9) % 1, 0.95, 0.55);
        for (var j = 0; j <= rad; j++) cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      var neon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
      var g = new THREE.Group(); neon.position.y = 1.2; g.add(neon);
      var back = box(Wd + 0.6, 1.8, 0.06, std('#1B1D21', 0.4, 0.8)); back.position.set(0, 1.2, -0.12); g.add(back);
      if (W.court) {
        var cw = W.court;
        var p2 = W.inView(rf(W.r, -8, 8), W.cam.dist + cw.half - 0.4);
        g.position.set(p2.x, 0.4, p2.z);
      } else {
        var p = placeInView(W, 2.6, 12, 22, W.cam.dist * 1.1, W.cam.dist * 1.6);
        if (!p) return;
        g.position.copy(p);
        [-1, 1].forEach(function (sd) { var leg = box(0.1, 1.4, 0.1, std('#3A3D42', 0.5, 0.8)); leg.position.set(sd * (Wd / 2), 0.0, -0.12); g.add(leg); });
      }
      W.face(g); shade(g); W.add(g);
      W.lamp('#FF6FCF', 1.1, 9, g.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
    },
    'Ringers Board': function (W) {
      var p = placeInView(W, 1.6, 10, 22, W.cam.dist * 0.7, W.cam.dist * 1.2);
      if (!p) return;
      var g = new THREE.Group(), S = 2.0, n = 7, wood = std('#C9A36B', 0.85), peg = std('#E9E4DA', 0.6), used = [];
      var board = box(S, S, 0.08, wood); board.position.y = 1.4; g.add(board);
      var pegs = [];
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var x = (i - (n - 1) / 2) * S / (n + 0.5), y = 1.4 + (j - (n - 1) / 2) * S / (n + 0.5);
        var pg = cyl(0.03, 0.03, 0.14, 8, peg); pg.rotation.x = Math.PI / 2; pg.position.set(x, y, 0.1); g.add(pg);
        pegs.push(new THREE.Vector3(x, y, 0.12));
      }
      for (i = 0; i < ri(W.r, 6, 11); i++) used.push(pegs[ri(W.r, 0, pegs.length - 1)]);
      used.sort(function (a, b) { return Math.atan2(a.y - 1.4, a.x) - Math.atan2(b.y - 1.4, b.x); });
      var path = new THREE.CurvePath();
      for (i = 0; i < used.length; i++) path.add(new THREE.LineCurve3(used[i], used[(i + 1) % used.length]));
      g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(path, used.length * 8, 0.012, 5, true), std(pick(W.r, ['#D1495B', '#1D1D1F', BRAND.blue, '#EDAE49']), 0.6)));
      [-1, 1].forEach(function (sd) { var l = box(0.08, 1.4, 0.08, wood); l.position.set(sd * S * 0.4, 0.2, -0.08); g.add(l); });
      g.position.copy(p); W.face(g); shade(g); W.add(g);
    },
    'Fidenza Mural': function (W) {
      var p = placeInView(W, 5, 14, 26, 32, 70);
      if (!p) return;
      var rr = W.r, tex = canvasTex(1400, 520, function (g, w, h) {
        g.fillStyle = '#EFE8D8'; g.fillRect(0, 0, w, h);
        var pal = ['#E4572E', '#F2C14E', '#2E86AB', '#1B1B1E', '#A7C957', '#F4F1E8', '#D1495B'], s = ri(rr, 1, 999);
        for (var i = 0; i < 90; i++) {
          var x = rr() * w, y = rr() * h, wd = rf(rr, 8, 34);
          g.strokeStyle = pick(rr, pal); g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y);
          for (var k = 0; k < ri(rr, 8, 30); k++) {
            var a = fbm(x / 260, y / 260, s, 3) * 6.2832 * 1.4;
            x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y);
          }
          g.stroke();
        }
      });
      var g = new THREE.Group();
      var wall = box(10.4, 4.0, 0.4, std('#C4BBAA', 0.95)); wall.position.y = 2.0; g.add(wall);
      var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(10, 3.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      face.position.set(0, 2.0, 0.21); g.add(face);
      g.position.copy(p); W.face(g); shade(g); W.add(g);
      var bs = blobShadow(11, 2.5, 0.35); bs.position.copy(p); W.add(bs);
    },
    'Marfa Blimp': function (W) {
      var p = W.inView(rf(W.r, -26, 26), rf(W.r, 2400, 3200)), g = new THREE.Group(), wht = std('#EEF0F2', 0.5);
      var body = sph(1, wht, 32, 16); body.scale.set(30, 10, 10); g.add(body);
      [0, 2.094, 4.189].forEach(function (a) { var f = box(10, 8, 0.6, wht); f.position.set(-26, Math.cos(a) * 7, Math.sin(a) * 7); f.rotation.x = a; g.add(f); });
      var alt = rf(W.r, 420, 560);
      g.position.set(p.x, alt, p.z); g.rotation.y = rf(W.r, 0, 6.28);
      W.add(g);
      var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x, alt - 10, p.z), new THREE.Vector3(p.x + 20, 0, p.z + 10)]), new THREE.LineBasicMaterial({ color: C('#444444') }));
      W.add(line);
      W.onUpdate(function (ctx) { g.rotation.y += ctx.dt * 0.01; g.rotation.z = Math.sin(ctx.real * 0.2) * 0.03; });
    },
    'Judd Boxes': function (W) {
      if (W.P.place === 'Chinati Field') return;
      juddRow(W, 150, 260, rf(W.r, -30, -14), rf(W.r, 10, 28), 4);
    },
    'Prada Marfa': function (W) {
      var p;
      if (W.road) {
        p = W.road.center.clone().addScaledVector(W.road.along, rf(W.r, 14, 34) * (W.r() < 0.5 ? -1 : 1)).addScaledVector(W.road.across, 16);
        W.claim(p.x, p.z, 6);
      } else p = placeInView(W, 6, 14, 26, 110, 220);
      if (!p) return;
      var g = new THREE.Group(), white = std('#EEEBE4', 0.92), glass = std('#9FB9C6', 0.1, 0.4), dark = std('#1C1C1C', 0.7);
      var body = box(7.6, 4.7, 4.6, white); body.position.y = 2.35; g.add(body);
      [-2.2, 2.2].forEach(function (x) {
        var wdw = box(2.6, 2.3, 0.05, glass); wdw.position.set(x, 1.75, 2.31); g.add(wdw);
        for (var s = 0; s < 3; s++) {
          var shelf = box(2.3, 0.04, 0.4, std('#DAD5CC', 0.6)); shelf.position.set(x, 1.0 + s * 0.6, 2.05); g.add(shelf);
          for (var k = 0; k < 3; k++) { var item = box(0.28, 0.22, 0.2, s === 1 ? dark : std('#6E5A48', 0.6)); item.position.set(x - 0.7 + k * 0.7, 1.14 + s * 0.6, 2.05); g.add(item); }
        }
      });
      var door = box(1.3, 2.5, 0.05, glass); door.position.set(0, 1.25, 2.31); g.add(door);
      var sign = textPlane('PRADA', { color: '#111111', height: 0.62, px: 120, font: FONT_SANS, spacing: 0.25, pad: 0.1 });
      sign.position.set(-2.2, 3.55, 2.31); g.add(sign);
      var sign2 = sign.clone(); sign2.position.x = 2.2; g.add(sign2);
      var sign3 = textPlane('PRADA MARFA', { color: '#111111', height: 0.32, px: 90, font: FONT_SANS, spacing: 0.2, pad: 0.1 });
      sign3.position.set(0, 3.1, 2.31); g.add(sign3);
      g.position.copy(p); W.face(g);
      if (W.road) g.rotation.y = Math.atan2(-W.road.across.x, -W.road.across.z);
      shade(g); W.add(g);
      var bs = blobShadow(9, 6.5, 0.4); bs.position.copy(p); W.add(bs);
    },
    'Mile Marker 317': function () { },
    'Now Serving 317': function (W) {
      var p = placeInView(W, 0.6, 7, 16, W.cam.dist * 0.5, W.cam.dist * 0.85);
      if (!p) return;
      var g = new THREE.Group(), pole = cyl(0.04, 0.05, 2.2, 8, std('#6C7076', 0.4, 0.8)); pole.position.y = 1.1; g.add(pole);
      var tex = canvasTex(512, 256, function (gc) {
        gc.fillStyle = '#0A0A0A'; gc.fillRect(0, 0, 512, 256);
        gc.fillStyle = '#FF3B30'; gc.font = '700 46px ' + FONT_MONO; gc.textAlign = 'center';
        gc.fillText('NOW SERVING', 256, 70);
        gc.font = '700 140px ' + FONT_MONO; gc.fillText('317', 256, 200);
        gc.fillStyle = 'rgba(0,0,0,0.55)';
        for (var y = 0; y < 256; y += 6) gc.fillRect(0, y, 512, 2);
        for (var x = 0; x < 512; x += 6) gc.fillRect(x, 0, 2, 256);
      });
      var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.2, 0.6), new THREE.MeshStandardMaterial({ map: tex, emissive: C('#FFFFFF'), emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.4 }));
      face.position.set(0, 2.45, 0.08); g.add(face);
      var hous = box(1.3, 0.7, 0.14, std('#2A2C30', 0.5, 0.5)); hous.position.y = 2.45; g.add(hous);
      g.position.copy(p); W.face(g); shade(g); W.add(g);
    },
    'Evil Eye': function (W) {
      var p = placeInView(W, 0.8, 8, 18, W.cam.dist * 0.4, W.cam.dist * 0.7);
      if (!p) return;
      var g = new THREE.Group(), wood = std('#6B5238', 1);
      var post = box(0.14, 2.4, 0.14, wood); post.position.y = 1.2; g.add(post);
      var arm = box(0.9, 0.1, 0.1, wood); arm.position.set(0.4, 2.35, 0); g.add(arm);
      var sw = new THREE.Group(); sw.position.set(0.75, 2.3, 0); g.add(sw);
      var cord = cyl(0.004, 0.004, 0.45, 4, std('#222')); cord.position.y = -0.22; sw.add(cord);
      var disc = new THREE.Group(); disc.position.y = -0.62; sw.add(disc);
      [[0.2, BRAND.blue], [0.132, '#FFFFFF'], [0.092, BRAND.cyan], [0.06, BRAND.ink]].forEach(function (q, k) {
        var d = cyl(q[0], q[0], 0.03 + k * 0.004, 32, std(q[1], 0.15, 0.1)); d.rotation.x = Math.PI / 2; disc.add(d);
      });
      g.position.copy(p); W.face(g); shade(g); W.add(g);
      W.onUpdate(function (ctx) { sw.rotation.z = Math.sin(ctx.real * 1.3) * 0.12; disc.rotation.y = Math.sin(ctx.real * 0.6) * 0.5; });
    },
    'Marfa Lights': function (W) {
      var tex = canvasTex(64, 64, function (g) {
        var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,210,0.8)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
      var orbs = [];
      for (var i = 0; i < ri(W.r, 3, 6); i++) {
        var m = new THREE.SpriteMaterial({ map: tex, color: C(pick(W.r, ['#FFE9B0', '#FFB070', '#BFE6FF', '#FFFFFF'])), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, toneMapped: false });
        var s = new THREE.Sprite(m), p = W.inView(rf(W.r, -24, 24), rf(W.r, 2400, 4000));
        s.position.set(p.x, rf(W.r, 4, 30), p.z); s.scale.setScalar(rf(W.r, 30, 60));
        W.add(s); orbs.push({ s: s, ph: W.r() * 6.28, base: s.position.clone(), sp: rf(W.r, 0.1, 0.4) });
      }
      W.onUpdate(function (ctx) {
        orbs.forEach(function (o) {
          var on = ctx.night * (0.55 + 0.45 * Math.sin(ctx.real * o.sp * 3 + o.ph)) * (Math.sin(ctx.real * 0.05 + o.ph) > -0.3 ? 1 : 0);
          o.s.material.opacity = on;
          o.s.position.set(o.base.x + Math.sin(ctx.real * o.sp + o.ph) * 60, o.base.y + Math.sin(ctx.real * o.sp * 1.7) * 8, o.base.z);
        });
      });
    }
  };

  // ------------------------------------------------------------ the taxi
  function taxi(W) {
    var g = new THREE.Group(), yel = std('#F4B400', 0.32, 0.1), dark = std('#131416', 0.4, 0.3), glass = std('#1C2630', 0.06, 0.9), chrome = std('#C9CDD2', 0.25, 1);
    var lower = box(4.9, 0.72, 1.92, yel); lower.position.y = 0.62; g.add(lower);
    var cabin = box(2.5, 0.6, 1.76, glass); cabin.position.set(-0.25, 1.27, 0); g.add(cabin);
    var roof = box(2.3, 0.08, 1.78, yel); roof.position.set(-0.25, 1.6, 0); g.add(roof);
    [-1.4, 0.9].forEach(function (x) { var pil = box(0.12, 0.6, 1.8, yel); pil.position.set(x, 1.27, 0); g.add(pil); });
    [-2.47, 2.47].forEach(function (x) { var bm = box(0.08, 0.18, 1.9, chrome); bm.position.set(x, 0.38, 0); g.add(bm); });
    var wheels = [];
    [[1.55, 0.86], [1.55, -0.86], [-1.55, 0.86], [-1.55, -0.86]].forEach(function (q) {
      var w = cyl(0.34, 0.34, 0.26, 16, dark); w.rotation.x = Math.PI / 2; w.position.set(q[0], 0.34, q[1]); g.add(w); wheels.push(w);
    });
    [1, -1].forEach(function (sd) {
      var d = textPlane('NYC TAXI', { color: '#111111', height: 0.22, px: 80, font: FONT_SANS, pad: 0.05 });
      d.position.set(0.1, 0.72, sd * 0.965); if (sd < 0) d.rotation.y = Math.PI; g.add(d);
      var tp = textPlane('MLOW.XYZ', { bg: '#F5F5F0', color: '#0D0D0D', height: 0.3, px: 80, font: FONT_MONO, pad: 0.2, glow: '#FFFFFF' });
      W.glow(tp.material, 0.05, 0.9);
      tp.position.set(-0.25, 1.84, sd * 0.135); if (sd < 0) tp.rotation.y = Math.PI; g.add(tp);
    });
    var top = box(1.2, 0.34, 0.25, std('#F5F5F0', 0.5)); top.position.set(-0.25, 1.84, 0); g.add(top);
    var hl = W.glow(glowMat('#FFF6E0', 0.3), 0.3, 3), tl = W.glow(glowMat('#FF2A1F', 0.6), 0.6, 2.2);
    [0.62, -0.62].forEach(function (z) {
      var h = box(0.03, 0.14, 0.3, hl); h.position.set(2.46, 0.72, z); g.add(h);
      var t2 = box(0.03, 0.14, 0.24, tl); t2.position.set(-2.46, 0.72, z); g.add(t2);
    });
    shade(g);
    return { g: g, spin: function (a) { wheels.forEach(function (w) { w.rotation.y -= a; }); } };
  }

  // ------------------------------------------------------------ life
  function addLife(W) {
    var r = W.r;
    if (typeof egg2_life === 'function') egg2_life(W);   // shooting stars, dust devils, pickups (45-eggs-new.js)
    if (!W.court) {
      var tw = new THREE.Group(), twM = std('#8C6F4E', 0.9, 0, { wireframe: true });
      tw.add(new THREE.Mesh(new THREE.IcosahedronBufferGeometry(0.45, 1), twM));
      var inner = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(0.32, 1), twM); inner.rotation.set(0.5, 0.3, 0.2); tw.add(inner);
      tw.castShadow = true; W.add(tw);
      var a = null, b = null, u = 1, sp = 0, wait = rf(r, 1, 6);
      W.onUpdate(function (ctx) {
        if (u >= 1) {
          wait -= ctx.dt; tw.visible = false;
          if (wait > 0) return;
          var d = rf(r, 10, 28), s = r() < 0.5 ? 1 : -1;
          a = W.inView(-36 * s, d); b = W.inView(36 * s, d + rf(r, -6, 6)); u = 0; sp = rf(r, 2.5, 5.5) / a.distanceTo(b); wait = rf(r, 6, 25);
        }
        tw.visible = true;
        u += ctx.dt * sp;
        tw.position.copy(a).lerp(b, u); tw.position.y = 0.45 + Math.abs(Math.sin(u * 40)) * 0.25;
        tw.rotation.z -= ctx.dt * 4; tw.rotation.x += ctx.dt * 1.3;
      });
    }
    var birds = [], bm = std('#1A1715', 0.9), ctr = W.inView(rf(r, -18, 18), rf(r, 140, 240));
    for (var i = 0; i < ri(r, 2, 4); i++) {
      var bg = new THREE.Group();
      [-1, 1].forEach(function (sd) { var w = box(0.9, 0.03, 0.3, bm); w.position.x = sd * 0.45; w.rotation.z = sd * 0.25; bg.add(w); });
      W.add(bg);
      birds.push({ g: bg, R: rf(r, 25, 60), h: rf(r, 70, 140), ph: r() * 6.28, sp: rf(r, 0.1, 0.18) });
    }
    W.onUpdate(function (ctx) {
      birds.forEach(function (q) {
        var a = ctx.real * q.sp + q.ph;
        q.g.visible = ctx.sun.el > -2;
        q.g.position.set(ctr.x + Math.cos(a) * q.R, q.h, ctr.z + Math.sin(a) * q.R);
        q.g.rotation.set(0, -a, 0.35);
      });
    });
  }

  // register the v0.2 eggs. `line` is what a visitor reads when they click one.
  [
    ['NYC Taxi', 12, 'A yellow cab with MLOW.XYZ on its roof light. MLow’s work has run on 5,000+ NYC taxis.'],
    ['fLOWers Billboard', 9, 'fLOWers: dripping flowers, signed prints at MLOW.NYC.'],
    ['New Yorker', 10, 'A New Yorker who stopped to look. NEW YORKERS is a painted census of 7,541 characters at N3WYORKERS.COM.'],
    ['Bodega Cat', 7, 'Every block has one. NEW YORKERS No. 0550 is the Bodega Cat.'],
    ['First Eye Flower', 7, 'After NEW YORKERS No. 1467, The First Eye Flower. It watches you back.'],
    ['Chromie Squiggle', 8, 'A neon squiggle for Snowfro’s Chromie Squiggle, Art Blocks project zero.'],
    ['Ringers Board', 6, 'One string around a few pegs, for Dmitri Cherniak’s Ringers.'],
    ['Fidenza Mural', 6, 'Flowing curves on a wall, for Tyler Hobbs’s Fidenza.'],
    ['Marfa Blimp', 8, 'The tethered radar aerostat in the Marfa sky.'],
    ['Judd Boxes', 8, 'Open boxes of 25 cm concrete slabs in a line across the field, after Donald Judd at Chinati.'],
    ['Prada Marfa', 9, 'Elmgreen & Dragset’s shop that never opens, on the road outside Valentine.'],
    ['Mile Marker 317', 0, 'Mile 317 on US 90. 317 is MLow’s number.'],
    ['Now Serving 317', 7, 'The take-a-number sign from STILL WAITING. Now serving 317.'],
    ['Evil Eye', 7, 'A nazar on a post. The eye is MLow’s mark.'],
    ['Marfa Lights', 6, 'Unexplained lights on the horizon east of town, only after dark.']
  ].forEach(function (q) { defineEgg(q[0], { w: q[1], line: q[2], build: EGG_BUILD[q[0]] }); });
