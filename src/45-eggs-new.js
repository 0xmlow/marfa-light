  // =====================================================================
  // MORE EASTER EGGS, and more life (v0.4)
  //
  // STILL WAITING, THE COMMUTE, BLOOM CYCLE, THE SOFT CONSPIRACY (MLow x
  // Andres Del Vecchio), The MLow Show, three Art Blocks homages, and the
  // things that really live around Marfa: the Reata front from Giant, a
  // trailer, pronghorn, a freight train and a roadrunner.
  //
  // egg2_life(W) adds shooting stars, a dust devil and pickups on the road.
  // Every src file shares one scope, so every top-level name starts egg2_.
  // =====================================================================

  // ------------------------------------------------------------ helpers
  // true when a spot would sit on Highway 90, its poles or its fence, or
  // (for near things) outside the Adobe Courtyard walls
  function egg2_blocked(W, p, rad, far) {
    if (W.road) {
      var rd = W.road, a = (p.x - rd.center.x) * rd.across.x + (p.z - rd.center.z) * rd.across.z;
      if (Math.abs(a) < 6.5 + rad || Math.abs(a - 9) < rad + 1 || Math.abs(a + 7) < rad + 0.6) return true;
    }
    if (W.court && !far) {
      var c = W.court, ry = c.group.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry);
      var lx = p.x * cs - p.z * sn, lz = p.x * sn + p.z * cs, lim = c.half - rad - 0.7;
      // an interior (the Artillery Shed) is long and narrow: keep well inside its side walls
      var limX = c.interior ? Math.min(c.halfX || 12, c.half) - rad - 0.7 : lim;
      if (Math.abs(lx) > limX || Math.abs(lz) > lim) return true;
    }
    return false;
  }
  // placeInView, but it also keeps off the road and inside a courtyard, sets
  // the spot's height from the ground, skips slopes, and when the clock is big
  // and the camera close it widens the search twice (past the clock, then
  // anywhere in frame) rather than give up (a last pass looks farther, past a road)
  function egg2_spot(W, rad, offA, offB, dA, dB, far) {
    var c = W.cam, past = c.dist + (W.heroR || 3) + rad + 1;
    var tries = [[offA, offB, dA, dB], [offA * 0.7, Math.min(offB * 1.4, 26), dA, Math.max(dB * 1.6, past + 4)], [3, 26, Math.min(dA, 4), Math.max(dB * 2.2, past + 14)], [3, 22, Math.max(dB, past), Math.max(dB * 4, past + 45)]];
    for (var k = 0; k < tries.length; k++) {
      var t = tries[k];
      for (var i = 0; i < 40; i++) {
        var off = rf(W.r, t[0], t[1]) * (W.r() < 0.5 ? -1 : 1), p = W.inView(off, rf(W.r, t[2], t[3]));
        if (egg2_blocked(W, p, rad, far)) continue;
        if (!W.free(p.x, p.z, rad)) continue;
        if (!egg2_level(W, p, rad)) continue;
        W.claim(p.x, p.z, rad);
        return p;
      }
    }
    return null;
  }
  // sets p.y to the ground and says whether the ground under a disc of
  // radius rad is level enough to stand something on
  function egg2_level(W, p, rad) {
    p.y = egg2_groundY(W, p.x, p.z);
    if (egg2_flatKnown(W) && p.x * p.x + p.z * p.z < 8100) return true;
    var lo = p.y, hi = p.y, d = rad * 0.75;
    [[d, 0], [-d, 0], [0, d], [0, -d]].forEach(function (q) { var y = egg2_groundY(W, p.x + q[0], p.z + q[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); });
    return hi - lo < Math.max(0.35, rad * 0.18);
  }
  // true when nothing is claimed within rad of (x, z); unlike W.free it
  // ignores the camera's sightline (for small things that pass through it)
  function egg2_clear(W, x, z, rad) {
    for (var i = 0; i < W.occupied.length; i++) {
      var o = W.occupied[i], dx = x - o[0], dz = z - o[1];
      if (dx * dx + dz * dz < (rad + o[2]) * (rad + o[2])) return false;
    }
    return true;
  }
  // the ground's height. A place can publish W.groundAt(x, z); places built
  // on makeGround follow its formula (flat within 90 m of the clock); any
  // other terrain is asked directly, with a ray down onto its big meshes.
  var egg2_RELIEF = { 'Chinati Field': 26, 'Highway 90': 26, 'Marfa Lights Viewing Area': 26, 'Mesa Rim': 26, 'Salt Playa': 10, 'Adobe Courtyard': 14, 'Artillery Shed': 26, 'Highland Avenue': 26, 'Hadid Pavilion': 26 };
  function egg2_flatKnown(W) { return !W.groundAt && egg2_RELIEF[W.P.place] !== undefined; }
  function egg2_groundY(W, x, z) {
    if (W.groundAt) return W.groundAt(x, z);
    var rel = egg2_RELIEF[W.P.place];
    if (rel === undefined) {
      if (!W.egg2_terrain) {
        var list = [];
        W.root.updateMatrixWorld(true);
        W.root.traverse(function (o) {
          if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          if (o.geometry.boundingSphere.radius > 300) list.push(o);
        });
        W.egg2_terrain = { list: list, ray: new THREE.Raycaster(), down: new THREE.Vector3(0, -1, 0), o: new THREE.Vector3() };
      }
      var tr = W.egg2_terrain;
      tr.ray.set(tr.o.set(x, 4000, z), tr.down);
      var hit = tr.ray.intersectObjects(tr.list, false)[0];
      if (hit) return hit.point.y;
      rel = 26;
    }
    return (fbm(x / 520, z / 520, W.P.seed, 4) - 0.45) * rel * sstep(90, 900, Math.sqrt(x * x + z * z));
  }
  function egg2_inst(geo, mat, n) {
    var m = new THREE.InstancedMesh(geo, mat, Math.max(n, 1));
    m.count = n; m.frustumCulled = false;
    return m;
  }
  function egg2_mat(x, y, z, rx, ry, rz, sx, sy, sz, order) {
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, order || 'XYZ'));
    if (sx == null) sx = 1;
    if (sy == null) sy = sx;
    if (sz == null) sz = sx;
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  }
  function egg2_spow(x, p) { return (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), p); }
  var egg2_glowT = null;
  function egg2_glowTex() {
    if (!egg2_glowT) {
      egg2_glowT = canvasTex(64, 64, function (g) {
        var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
      egg2_glowT.userData = { shared: true };
    }
    return egg2_glowT;
  }
  function egg2_glare(hex, size) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: egg2_glowTex(), color: C(hex), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.scale.setScalar(size);
    return s;
  }
  // a metal folding chair, facing +z
  function egg2_foldChair(metal, seatM) {
    var g = new THREE.Group();
    var seat = box(0.42, 0.03, 0.4, seatM); seat.position.set(0, 0.46, 0.02); g.add(seat);
    var back = box(0.4, 0.2, 0.022, seatM); back.position.set(0, 0.8, -0.2); back.rotation.x = -0.1; g.add(back);
    [-1, 1].forEach(function (sd) {
      var rl = cyl(0.011, 0.011, 0.93, 6, metal); rl.position.set(sd * 0.205, 0.46, -0.17); rl.rotation.x = 0.12; g.add(rl);
      var fl = cyl(0.011, 0.011, 0.52, 6, metal); fl.position.set(sd * 0.215, 0.24, 0.13); fl.rotation.x = -0.3; g.add(fl);
      var rail = cyl(0.009, 0.009, 0.4, 6, metal); rail.rotation.x = Math.PI / 2; rail.position.set(sd * 0.21, 0.44, 0.0); g.add(rail);
    });
    var br = cyl(0.008, 0.008, 0.43, 6, metal); br.rotation.z = Math.PI / 2; br.position.set(0, 0.13, 0.2); g.add(br);
    var br2 = br.clone(); br2.position.set(0, 0.13, -0.24); g.add(br2);
    return g;
  }

  // ------------------------------------------------------------ STILL WAITING
  // a moulded plastic shell, seat and back in one piece, side profile extruded
  function egg2_shellGeo() {
    var ctl = [[0.235, 0.4], [0.24, 0.445], [0.19, 0.462], [0.02, 0.445], [-0.15, 0.452], [-0.215, 0.5], [-0.24, 0.63], [-0.258, 0.78], [-0.262, 0.84]];
    var curve = new THREE.CatmullRomCurve3(ctl.map(function (q) { return new THREE.Vector3(q[0], q[1], 0); }));
    var pts = curve.getPoints(30), t = 0.026, a = [], b = [];
    for (var i = 0; i < pts.length; i++) {
      var p0 = pts[Math.max(i - 1, 0)], p1 = pts[Math.min(i + 1, pts.length - 1)], tx = p1.x - p0.x, ty = p1.y - p0.y, l = Math.sqrt(tx * tx + ty * ty);
      a.push(new THREE.Vector2(pts[i].x - ty / l * t / 2, pts[i].y + tx / l * t / 2));
      b.push(new THREE.Vector2(pts[i].x + ty / l * t / 2, pts[i].y - tx / l * t / 2));
    }
    var geo = new THREE.ExtrudeBufferGeometry(new THREE.Shape(a.concat(b.reverse())), { depth: 0.42, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 });
    geo.translate(0, 0, -0.21);
    geo.rotateY(-Math.PI / 2);
    return geo;
  }
  function egg2_ticketTex() {
    return canvasTex(256, 160, function (g, w, h) {
      g.fillStyle = '#D7263D'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 22px ' + FONT_SANS; g.fillText('TAKE A NUMBER', w / 2, 36);
      g.font = '700 86px ' + FONT_SANS; g.fillText('317', w / 2, 102);
    });
  }
  var egg2_FLOWER = ['#FF2E88', '#2962FF', '#22D3EE', '#FFD23F', '#FF4FD8'];
  // saturated flowers as instanced petals, balls, stems and leaves.
  // heads: [{ x, y, z, bx, bz, s, col, kind: 'daisy' | 'pom' }], faceDir in local space
  function egg2_flowerBed(r, parent, heads, faceDir) {
    var nPet = 0, nBall = 0;
    heads.forEach(function (h) { if (h.kind === 'daisy') { nPet += 8; nBall += 1; } else nBall += 11; });
    var petGeo = new THREE.SphereBufferGeometry(1, 10, 6), ballGeo = new THREE.SphereBufferGeometry(1, 10, 8), stemGeo = new THREE.CylinderBufferGeometry(1, 1, 1, 5);
    stemGeo.translate(0, 0.5, 0);
    var pet = egg2_inst(petGeo, std('#FFFFFF', 0.5), nPet), ball = egg2_inst(ballGeo, std('#FFFFFF', 0.5), nBall);
    var stem = egg2_inst(stemGeo, std('#3E7B3A', 0.8), heads.length), leaf = egg2_inst(petGeo, std('#4C8F3E', 0.7), heads.length * 2);
    var up = new THREE.Vector3(0, 1, 0), qh = new THREE.Quaternion(), qp = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler();
    var v = new THREE.Vector3(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4(), ip = 0, ib = 0, il = 0, col = new THREE.Color();
    heads.forEach(function (h, hi) {
      var hp = new THREE.Vector3(h.x, h.y, h.z), k;
      var face = new THREE.Vector3(faceDir.x * 0.8 + rf(r, -0.45, 0.45), 1.2 + rf(r, -0.2, 0.4), faceDir.z * 0.8 + rf(r, -0.45, 0.45)).normalize();
      qh.setFromUnitVectors(up, face);
      col.copy(C(h.col));
      if (h.kind === 'daisy') {
        var tilt = rf(r, 0.1, 0.45), a0 = r() * 6.28;
        for (k = 0; k < 8; k++) {
          e.set(-tilt, a0 + k / 8 * 6.2832 + rf(r, -0.12, 0.12), 0, 'YXZ'); qp.setFromEuler(e); q2.multiplyQuaternions(qh, qp);
          v.set(0, 0, h.s * 0.52).applyQuaternion(q2).add(hp);
          sc.set(h.s * 0.2, h.s * 0.05, h.s * 0.52);
          m4.compose(v, q2, sc); pet.setMatrixAt(ip, m4); pet.setColorAt(ip, col); ip++;
        }
        v.copy(face).multiplyScalar(h.s * 0.05).add(hp); sc.setScalar(h.s * 0.2);
        m4.compose(v, qh, sc); ball.setMatrixAt(ib, m4); ball.setColorAt(ib, C(h.col === '#FFD23F' ? '#1A1A1A' : '#FFD23F')); ib++;
      } else {
        for (k = 0; k < 11; k++) {
          var th = r() * 6.28, ph = rf(r, 0, 1.2);
          v.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).applyQuaternion(qh).multiplyScalar(h.s * 0.42).add(hp);
          sc.setScalar(h.s * rf(r, 0.24, 0.34));
          m4.compose(v, qh, sc); ball.setMatrixAt(ib, m4);
          ball.setColorAt(ib, col.clone().lerp(C('#FFFFFF'), rf(r, 0, 0.18))); ib++;
        }
      }
      var base = new THREE.Vector3(h.bx, 0, h.bz), dv = hp.clone().sub(base), len = dv.length();
      q2.setFromUnitVectors(up, dv.clone().normalize());
      sc.set(0.011, len, 0.011); m4.compose(base, q2, sc); stem.setMatrixAt(hi, m4);
      for (k = 0; k < 2; k++) {
        e.set(rf(r, -1.0, -0.5), r() * 6.28, 0, 'YXZ'); qp.setFromEuler(e);
        v.set(0, 0, 0.08).applyQuaternion(qp).add(base.clone().addScaledVector(dv, rf(r, 0.12, 0.5)));
        sc.set(0.035, 0.006, 0.1); m4.compose(v, qp, sc); leaf.setMatrixAt(il++, m4);
      }
    });
    [pet, ball, stem, leaf].forEach(function (m) { parent.add(m); });
  }

  // ------------------------------------------------------------ THE COMMUTE
  // a 5 by 7 dot-matrix alphabet, rows top to bottom, 16 is the left dot
  var egg2_FONT = {
    'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30], 'C': [14, 17, 16, 16, 16, 17, 14], 'D': [30, 17, 17, 17, 17, 17, 30],
    'E': [31, 16, 16, 30, 16, 16, 31], 'F': [31, 16, 16, 30, 16, 16, 16], 'G': [14, 17, 16, 23, 17, 17, 15], 'H': [17, 17, 17, 31, 17, 17, 17],
    'I': [14, 4, 4, 4, 4, 4, 14], 'J': [7, 2, 2, 2, 2, 18, 12], 'K': [17, 18, 20, 24, 20, 18, 17], 'L': [16, 16, 16, 16, 16, 16, 31],
    'M': [17, 27, 21, 21, 17, 17, 17], 'N': [17, 25, 21, 19, 17, 17, 17], 'O': [14, 17, 17, 17, 17, 17, 14], 'P': [30, 17, 17, 30, 16, 16, 16],
    'Q': [14, 17, 17, 17, 21, 18, 13], 'R': [30, 17, 17, 30, 20, 18, 17], 'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4],
    'U': [17, 17, 17, 17, 17, 17, 14], 'V': [17, 17, 17, 17, 17, 10, 4], 'W': [17, 17, 17, 21, 21, 21, 10], 'X': [17, 17, 10, 4, 10, 17, 17],
    'Y': [17, 17, 10, 4, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
    '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
    '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
    '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
    ':': [0, 12, 12, 0, 12, 12, 0], '+': [0, 4, 4, 31, 4, 4, 0], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ' ': [0, 0, 0, 0, 0, 0, 0]
  };
  var egg2_LED = { cols: 120, rows: 24, px: 8 };
  // rows: [[left, right], [left, right]]; returns a Uint8Array of lit dots
  function egg2_ledGrid(rows) {
    var L = egg2_LED, grid = new Uint8Array(L.cols * L.rows);
    function put(s, x, y) {
      for (var i = 0; i < s.length; i++, x += 6) {
        var gl = egg2_FONT[s[i]] || egg2_FONT[' '];
        for (var gy = 0; gy < 7; gy++) for (var gx = 0; gx < 5; gx++) {
          if ((gl[gy] & (16 >> gx)) && x + gx >= 0 && x + gx < L.cols) grid[(y + gy) * L.cols + x + gx] = 1;
        }
      }
    }
    rows.forEach(function (rw, i) {
      var y = 3 + i * 11;
      put(rw[0], 2, y);
      if (rw[1]) put(rw[1], L.cols - 1 - rw[1].length * 6, y);
    });
    return grid;
  }
  function egg2_ledDraw(g, grid, on, off, gl) {
    var L = egg2_LED, P = L.px, rad = P * 0.36, y, x;
    g.fillStyle = '#050505'; g.fillRect(0, 0, L.cols * P, L.rows * P);
    for (y = 0; y < L.rows; y++) {
      var sh = gl && gl.band && y >= gl.band[0] && y <= gl.band[1] ? gl.shift : 0;
      for (x = 0; x < L.cols; x++) {
        var sx = x - sh, lit = sx >= 0 && sx < L.cols && grid[y * L.cols + sx];
        if (gl && gl.dead && (x % gl.dead === 3)) lit = 0;
        g.fillStyle = lit ? on : off;
        g.beginPath(); g.arc(x * P + P / 2, y * P + P / 2, rad, 0, 6.2832); g.fill();
      }
    }
  }

  // ------------------------------------------------------------ BLOOM CYCLE
  // a petal as a bent plane: base at the origin, tip up +y, face +z
  function egg2_petalGeo(len, wid, cup, curl) {
    var g = new THREE.PlaneBufferGeometry(1, 1, 4, 10), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var u = p.getX(i), v = p.getY(i) + 0.5;
      var w = wid * Math.max(0.14, Math.sin(Math.PI * Math.pow(v, 0.75)));
      p.setXYZ(i, u * w, v * len, -cup * 4 * u * u * w * 0.5 + curl * v * v * len);
    }
    g.computeVertexNormals();
    return g;
  }
  // one of the six looks: 0 bud, 1 bloom, 2 peak, 3 wilt, 4 frost, 5 regrowth
  function egg2_bloomLook(k, hex, r) {
    var g = new THREE.Group(), H = [0.82, 1.02, 1.12, 0.98, 0.7, 0][k], i;
    var stemM = std(k === 4 ? '#6E6650' : '#3F7A3A', 0.75), leafM = std(k === 3 ? '#8E8E44' : '#4E8F3F', 0.7, 0, { side: THREE.DoubleSide });
    var c = C(hex);
    if (k === 3) c.lerp(C('#6B4A34'), 0.7);
    if (k === 4) c = C('#D8E6EE');
    var petM = new THREE.MeshStandardMaterial({ color: c, roughness: k === 4 ? 0.28 : 0.55, metalness: k === 4 ? 0.1 : 0, side: THREE.DoubleSide });
    if (k === 5) {
      var stump = cyl(0.02, 0.024, 0.12, 8, std('#6B5A3A', 0.9)); stump.position.y = 0.06; g.add(stump);
      var shootM = std('#6CC644', 0.6), newLeaf = std('#8BDB52', 0.6, 0, { side: THREE.DoubleSide });
      for (i = 0; i < 7; i++) {
        var sh = new THREE.Group(), a = i / 7 * 6.28 + r() * 0.5, hh = rf(r, 0.14, 0.34), rr = rf(r, 0.03, 0.12);
        var sm = new THREE.Mesh(new THREE.ConeBufferGeometry(0.009, hh, 5), shootM); sm.position.y = hh / 2; sh.add(sm);
        [-1, 1].forEach(function (sd) {
          var lf = new THREE.Mesh(egg2_petalGeo(0.07, 0.035, 0.3, 0.02), newLeaf);
          lf.position.y = hh * 0.85; lf.rotation.set(0.9, sd * 1.2, 0, 'YXZ'); sh.add(lf);
        });
        sh.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr);
        sh.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
        g.add(sh);
      }
      return g;
    }
    var pts = k === 3
      ? [[0, 0, 0], [0.02, H * 0.45, 0], [0.08, H * 0.85, 0.04], [0.22, H * 0.98, 0.08], [0.32, H * 0.86, 0.1]]
      : [[0, 0, 0], [0.025, H * 0.4, 0.01], [-0.02, H * 0.75, 0], [0, H, 0.02]];
    var curve = new THREE.CatmullRomCurve3(pts.map(function (q) { return new THREE.Vector3(q[0], q[1], q[2]); }));
    g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(curve, 24, k === 4 ? 0.013 : 0.017, 6), stemM));
    [0.28, 0.5, 0.66].forEach(function (f, j) {
      if (k === 4 && j) return;
      var lf = new THREE.Mesh(egg2_petalGeo(0.24, 0.09, 0.4, k === 3 ? 0.25 : 0.1), leafM);
      lf.position.copy(curve.getPoint(f)); lf.rotation.set(k === 3 ? 1.9 : 1.0, j * 2.3 + 0.4, 0, 'YXZ'); g.add(lf);
    });
    var head = new THREE.Group(); head.position.copy(curve.getPoint(1)); g.add(head);
    if (k === 3) head.rotation.set(0.3, 0, -2.1);
    if (k === 2) head.rotation.x = 0.45;
    if (k === 1) head.rotation.x = 0.25;
    function ring(n, len, wid, cup, curl, phi, mat, a0) {
      var geo = egg2_petalGeo(len, wid, cup, curl);
      for (var i2 = 0; i2 < n; i2++) {
        var piv = new THREE.Group(); piv.rotation.y = (a0 || 0) + i2 / n * 6.2832;
        var m = new THREE.Mesh(geo, mat); m.rotation.x = phi + rf(r, -0.06, 0.06); piv.add(m); head.add(piv);
      }
    }
    var sepM = std('#4A8A3C', 0.7, 0, { side: THREE.DoubleSide }), yel = std('#FFC928', 0.6), dark = std('#2A1A10', 0.8);
    if (k === 0) {
      ring(6, 0.17, 0.07, 0.7, -0.02, 0.1, petM);
      ring(5, 0.14, 0.065, 0.6, 0.0, 0.22, sepM, 0.3);
      var bb = sph(0.04, sepM); bb.scale.y = 0.8; head.add(bb);
    } else if (k === 1) {
      ring(5, 0.16, 0.1, 0.6, 0.0, 0.3, petM);
      ring(7, 0.22, 0.13, 0.4, 0.03, 0.7, petM, 0.4);
      ring(5, 0.12, 0.06, 0.3, 0.05, 1.7, sepM, 0.2);
      var c1 = sph(0.035, yel); c1.position.y = 0.03; head.add(c1);
    } else if (k === 2) {
      ring(8, 0.17, 0.09, 0.45, 0.02, 0.55, petM);
      ring(10, 0.24, 0.12, 0.35, 0.05, 0.98, petM, 0.3);
      ring(12, 0.31, 0.14, 0.22, 0.08, 1.35, petM, 0.15);
      var disc = cyl(0.075, 0.07, 0.03, 20, dark); disc.position.y = 0.035; head.add(disc);
      for (i = 0; i < 14; i++) { var st = sph(0.011, yel, 6, 4), a2 = i / 14 * 6.28; st.position.set(Math.sin(a2) * 0.06, 0.055, Math.cos(a2) * 0.06); head.add(st); }
    } else if (k === 3) {
      ring(7, 0.26, 0.11, 0.1, -0.12, 2.0, petM);
      var d3 = cyl(0.06, 0.055, 0.03, 16, dark); d3.position.y = 0.02; head.add(d3);
    } else {
      ring(7, 0.18, 0.09, 0.5, -0.03, 0.45, petM);
      var d4 = sph(0.04, std('#9A8A70', 0.9)); d4.position.y = 0.03; head.add(d4);
    }
    return g;
  }
  function egg2_plaqueDraw(g, w, h, k, day) {
    var gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#9C7131'); gr.addColorStop(0.45, '#D8B266'); gr.addColorStop(1, '#A87C38');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5A3E14'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#2A1C0A'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 30px ' + FONT_SANS; g.fillText('B L O O M   C Y C L E', w / 2, 46);
    g.font = '700 64px ' + FONT_SERIF; g.fillText(BLOOM_NAMES[k], w / 2, 104);
    g.font = '600 17px ' + FONT_SANS;
    var x = 40, sp = (w - 80) / 6;
    BLOOM_NAMES.forEach(function (n, i) {
      g.fillStyle = i === k ? '#2A1C0A' : 'rgba(42,28,10,0.35)';
      g.fillText(n, x + sp * (i + 0.5), 152);
      if (i === k) g.fillRect(x + sp * i + 10, 164, sp - 20, 3);
    });
    g.fillStyle = 'rgba(42,28,10,0.6)'; g.font = '600 15px ' + FONT_MONO; g.fillText('DAY ' + day + ' IN MARFA', w / 2, 186);
  }

  // ------------------------------------------------------------ THE SOFT CONSPIRACY
  function egg2_dossierTex() {
    return canvasTex(512, 400, function (g, w, h) {
      g.fillStyle = '#D6B574'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,80,30,' + (0.03 + (i % 7) * 0.01) + ')'; g.fillRect((i * 97) % w, (i * 53) % h, 3, 2); }
      g.fillStyle = '#C9A562'; g.fillRect(0, 0, w, 40);
      g.fillStyle = '#2B2418'; g.font = '700 26px ' + FONT_MONO; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('OPERATIVE DOSSIER', 34, 92); g.fillText('No. 317', 34, 128);
      g.font = '400 20px ' + FONT_MONO; g.fillText('SUBJECT: THE UNSEEN', 34, 170); g.fillText('STATUS: MAINTAINED', 34, 200);
      g.save(); g.translate(w * 0.56, h * 0.7); g.rotate(-0.16);
      g.strokeStyle = 'rgba(179,18,27,0.88)'; g.lineWidth = 7; g.strokeRect(-190, -46, 380, 92); g.lineWidth = 3; g.strokeRect(-178, -34, 356, 68);
      g.fillStyle = 'rgba(179,18,27,0.88)'; g.font = '700 54px ' + FONT_SANS; g.textAlign = 'center'; g.fillText('CLASSIFIED', 0, 4);
      g.restore();
    });
  }
  function egg2_brassTex(lines) {
    return canvasTex(720, 260, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#8E6A2E'); gr.addColorStop(0.5, '#D9B56A'); gr.addColorStop(1, '#9A7434');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#4E3510'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]].forEach(function (q) { g.fillStyle = '#5E4318'; g.beginPath(); g.arc(q[0], q[1], 6, 0, 6.2832); g.fill(); });
      g.fillStyle = '#2B1D08'; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach(function (l) { g.font = l[1]; g.fillText(l[0], w / 2, l[2]); });
    });
  }

  // ------------------------------------------------------------ wildlife
  function egg2_pronghorn(buck, M) {
    var g = new THREE.Group();
    var body = sph(1, M.tan, 16, 12); body.scale.set(0.24, 0.27, 0.58); body.position.set(0, 0.8, 0); g.add(body);
    var saddle = sph(1, M.tan, 14, 10); saddle.scale.set(0.2, 0.2, 0.34); saddle.position.set(0, 0.9, 0.22); g.add(saddle);
    var belly = sph(1, M.white, 14, 10); belly.scale.set(0.22, 0.19, 0.5); belly.position.set(0, 0.7, 0.02); g.add(belly);
    var rump = sph(1, M.white, 12, 10); rump.scale.set(0.2, 0.23, 0.12); rump.position.set(0, 0.82, -0.5); g.add(rump);
    var tail = sph(0.045, M.white, 8, 6); tail.position.set(0, 0.96, -0.6); g.add(tail);
    var neck = new THREE.Group(); neck.position.set(0, 0.95, 0.42); g.add(neck);
    var nk = cyl(0.065, 0.1, 0.44, 10, M.tan); nk.position.set(0, 0.18, 0.08); nk.rotation.x = 0.45; neck.add(nk);
    [0.1, 0.24].forEach(function (f) { var bd = sph(1, M.white, 10, 6); bd.scale.set(0.07, 0.035, 0.05); bd.position.set(0, f, 0.1 + f * 0.45); neck.add(bd); });
    var head = new THREE.Group(); head.position.set(0, 0.38, 0.19); neck.add(head);
    var skull = sph(1, M.tan, 14, 10); skull.scale.set(0.07, 0.08, 0.2); skull.position.set(0, 0, 0.09); skull.rotation.x = 0.4; head.add(skull);
    var cheek = sph(1, M.white, 10, 8); cheek.scale.set(0.072, 0.035, 0.07); cheek.position.set(0, -0.05, 0.04); head.add(cheek);
    var muzzle = sph(0.036, M.black, 10, 8); muzzle.position.set(0, -0.07, 0.24); head.add(muzzle);
    [-1, 1].forEach(function (sd) {
      var eye = sph(0.016, M.black, 8, 6); eye.position.set(sd * 0.065, 0.03, 0.09); head.add(eye);
      var ear = new THREE.Mesh(new THREE.ConeBufferGeometry(0.028, 0.12, 5), M.tan); ear.position.set(sd * 0.06, 0.1, -0.02); ear.rotation.set(-0.3, 0, -sd * 0.45); head.add(ear);
      if (buck) {
        var patch = sph(1, M.black, 8, 6); patch.scale.set(0.02, 0.035, 0.04); patch.position.set(sd * 0.07, -0.04, 0.02); head.add(patch);
        var hn = new THREE.Group(); hn.position.set(sd * 0.035, 0.08, 0.05); hn.rotation.z = -sd * 0.12; head.add(hn);
        var sh = cyl(0.012, 0.02, 0.2, 6, M.black); sh.position.y = 0.1; hn.add(sh);
        var hook = cyl(0.008, 0.012, 0.07, 6, M.black); hook.position.set(0, 0.2, -0.025); hook.rotation.x = -1.1; hn.add(hook);
        var prong = new THREE.Mesh(new THREE.ConeBufferGeometry(0.012, 0.06, 5), M.black); prong.position.set(0, 0.09, 0.03); prong.rotation.x = 1.0; hn.add(prong);
      } else {
        var nub = new THREE.Mesh(new THREE.ConeBufferGeometry(0.01, 0.05, 5), M.black); nub.position.set(sd * 0.035, 0.1, 0.05); head.add(nub);
      }
    });
    var legs = [];
    [[-1, 0.36], [1, 0.36], [-1, -0.38], [1, -0.38]].forEach(function (q) {
      var piv = new THREE.Group(); piv.position.set(q[0] * 0.11, 0.72, q[1]); g.add(piv);
      var up = cyl(0.045, 0.028, 0.36, 7, M.tan); up.position.y = -0.18; piv.add(up);
      var lo = cyl(0.02, 0.017, 0.33, 6, M.leg); lo.position.y = -0.52; piv.add(lo);
      var hf = cyl(0.02, 0.026, 0.05, 6, M.black); hf.position.y = -0.7; piv.add(hf);
      legs.push(piv);
    });
    shade(g);
    return { g: g, neck: neck, head: head, legs: legs };
  }
  function egg2_roadrunner() {
    var g = new THREE.Group(), brown = std('#4E4032', 0.85), streak = std('#8A7A62', 0.85), pale = std('#DDD4C2', 0.85), dark = std('#17130F', 0.6);
    var legM = std('#7C8A99', 0.6), eyeM = std('#E8742C', 0.5), k;
    var body = new THREE.Group(); body.position.y = 0.21; g.add(body);
    var torso = sph(1, brown, 14, 10); torso.scale.set(0.062, 0.07, 0.16); body.add(torso);
    var belly = sph(1, pale, 12, 8); belly.scale.set(0.052, 0.05, 0.12); belly.position.set(0, -0.026, 0.03); body.add(belly);
    [-1, 1].forEach(function (sd) { var wg = sph(1, streak, 10, 6); wg.scale.set(0.018, 0.05, 0.12); wg.position.set(sd * 0.05, 0.01, -0.02); body.add(wg); });
    var head = new THREE.Group(); head.position.set(0, 0.075, 0.14); body.add(head);
    var nk = cyl(0.028, 0.036, 0.08, 8, brown); nk.position.set(0, -0.035, -0.02); nk.rotation.x = 0.6; head.add(nk);
    var hd = sph(0.038, brown, 12, 8); hd.scale.z = 1.2; head.add(hd);
    for (k = 0; k < 4; k++) { var cr = new THREE.Mesh(new THREE.ConeBufferGeometry(0.011, 0.055, 5), dark); cr.position.set(0, 0.035, 0.01 - k * 0.012); cr.rotation.x = -0.5 - k * 0.12; head.add(cr); }
    var beak = new THREE.Mesh(new THREE.ConeBufferGeometry(0.011, 0.085, 6), dark); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.004, 0.08); head.add(beak);
    [-1, 1].forEach(function (sd) {
      var ep = sph(0.01, eyeM, 6, 4); ep.position.set(sd * 0.03, 0.006, 0.0); head.add(ep);
      var ey = sph(0.006, dark, 6, 4); ey.position.set(sd * 0.033, 0.012, 0.018); head.add(ey);
    });
    var tail = new THREE.Group(); tail.position.set(0, 0.02, -0.13); body.add(tail);
    var tl = box(0.045, 0.012, 0.3, dark); tl.position.z = -0.15; tail.add(tl);
    var tip = box(0.047, 0.013, 0.03, pale); tip.position.z = -0.29; tail.add(tip);
    var legs = [];
    [-1, 1].forEach(function (sd) {
      var piv = new THREE.Group(); piv.position.set(sd * 0.028, 0.18, 0.01); g.add(piv);
      var l = cyl(0.006, 0.005, 0.18, 5, legM); l.position.y = -0.09; piv.add(l);
      var f = box(0.028, 0.006, 0.05, legM); f.position.set(0, -0.178, 0.012); piv.add(f);
      legs.push(piv);
    });
    shade(g);
    return { g: g, body: body, head: head, tail: tail, legs: legs };
  }

  // ------------------------------------------------------------ the trailer body
  // a loaf of aluminum: superellipse sections, rounded ends in plan and in
  // elevation, a flatter belly. s runs along the length, th around it.
  var egg2_TR = { L: 6.6, a: 1.2, b: 1.2, y0: 1.62 };
  function egg2_trailerPt(s, th, out) {
    var T = egg2_TR, e = Math.abs(2 * s - 1), f = Math.pow(Math.max(1 - Math.pow(e, 3.2), 0), 1 / 3.2);
    var c = Math.cos(th), sn = Math.sin(th), top = sn >= 0, n = top ? 2.5 : 4;
    var zc = egg2_spow(c, 2 / n), yc = egg2_spow(sn, 2 / n);
    return (out || new THREE.Vector3()).set((s - 0.5) * T.L, T.y0 + T.b * yc * (top ? f : Math.pow(f, 0.3)), T.a * zc * f);
  }
  // a patch of the skin between (s0, t0) and (s1, t1), lifted off it by `off`
  function egg2_patch(s0, s1, t0, t1, off, ns, nt) {
    var pos = [], uv = [], idx = [], P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), i, j;
    for (i = 0; i <= ns; i++) for (j = 0; j <= nt; j++) {
      var s = lerp(s0, s1, i / ns), t = lerp(t0, t1, j / nt);
      egg2_trailerPt(s, t, P);
      A.copy(egg2_trailerPt(s + 0.002, t)).sub(egg2_trailerPt(s - 0.002, t));
      B.copy(egg2_trailerPt(s, t + 0.002)).sub(egg2_trailerPt(s, t - 0.002));
      N.crossVectors(A, B).normalize();
      pos.push(P.x + N.x * off, P.y + N.y * off, P.z + N.z * off);
      uv.push(i / ns, j / nt);
    }
    for (i = 0; i < ns; i++) for (j = 0; j < nt; j++) {
      var a = i * (nt + 1) + j, b = (i + 1) * (nt + 1) + j;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  // ------------------------------------------------------------ the eggs
  var EGG2_BUILD = {
    'Waiting Room': function (W) {
      var p = egg2_spot(W, 3.4, 10, 24, W.cam.dist * 0.75, W.cam.dist * 1.5);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), n = ri(r, 5, 8), gap = 0.56, half = n * gap / 2, i, x, k;
      var steel = mtl('#70757B', 'brushed', 0.45, 0.8, 0.6), dark = std('#1C1D1F', 0.6);
      var pal = ['#E8612C', '#1F8A8A', '#D9A21B', '#2B59C3', '#CFC3A6', '#B23A48'];
      var main = pick(r, pal), odd = pick(r, pal), oddI = ri(r, 0, n - 1), gone = r() < 0.45 ? ri(r, 0, n - 1) : -1;
      if (gone === oddI) gone = -1;
      var shells = egg2_inst(egg2_shellGeo(), std('#FFFFFF', 0.4, 0), n - (gone >= 0 ? 1 : 0));
      k = 0;
      for (i = 0; i < n; i++) {
        x = (i - (n - 1) / 2) * gap;
        var br = box(0.05, 0.1, 0.3, steel); br.position.set(x, 0.39, -0.02); g.add(br);
        if (i === gone) continue;
        shells.setMatrixAt(k, egg2_mat(x, 0, 0, 0, rf(r, -0.035, 0.035), 0)); shells.setColorAt(k, C(i === oddI ? odd : main)); k++;
      }
      g.add(shells);
      var beam = box(n * gap + 0.1, 0.07, 0.09, steel); beam.position.set(0, 0.33, -0.02); g.add(beam);
      var legX = [-half + 0.28, half - 0.28];
      if (n >= 6) legX.push(0);
      legX.forEach(function (lx) {
        var lg = box(0.06, 0.3, 0.06, steel); lg.position.set(lx, 0.15, -0.02); g.add(lg);
        var ft = box(0.08, 0.03, 0.56, steel); ft.position.set(lx, 0.015, -0.02); g.add(ft);
      });
      // take a number, on a stanchion at the front of the row
      var red = std('#C8102E', 0.3, 0.05), chrome = std('#C9CDD2', 0.25, 1), tn = new THREE.Group();
      tn.position.set(-half - 0.5, 0, 0.5); g.add(tn);
      var bd = cyl(0.16, 0.18, 0.03, 24, dark); bd.position.y = 0.015; tn.add(bd);
      var pl = cyl(0.022, 0.022, 1.2, 10, chrome); pl.position.y = 0.6; tn.add(pl);
      var disp = cyl(0.12, 0.12, 0.1, 28, red); disp.rotation.x = Math.PI / 2; disp.position.set(0, 1.26, 0.03); tn.add(disp);
      var chin = box(0.14, 0.1, 0.11, red); chin.position.set(0, 1.12, 0.035); tn.add(chin);
      var slot = box(0.09, 0.012, 0.01, dark); slot.position.set(0, 1.1, 0.093); tn.add(slot);
      var tk = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.085, 0.053), std('#FFFFFF', 0.8, 0, { map: egg2_ticketTex(), side: THREE.DoubleSide }));
      tk.position.set(0, 1.078, 0.112); tk.rotation.x = -0.45; tn.add(tk);
      var tsign = textPlane('TAKE A NUMBER', { bg: '#F4F2EC', color: '#111111', height: 0.07, px: 60, font: FONT_SANS, pad: 0.25 });
      tsign.position.set(0, 1.46, 0.02); tn.add(tsign);
      for (i = 0; i < 3; i++) {
        var drop = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.085, 0.053), tk.material);
        drop.rotation.set(-Math.PI / 2, 0, r() * 6.28); drop.position.set(-half + rf(r, -0.6, 1.4), 0.012, rf(r, 0.3, 1.0)); g.add(drop);
      }
      // a fluorescent fixture on a post, at the back of the row
      var fp = new THREE.Group(); fp.position.set(half + 0.45, 0, -0.55); g.add(fp);
      var post = box(0.08, 2.75, 0.08, steel); post.position.y = 1.375; fp.add(post);
      var arm = box(1.05, 0.06, 0.06, steel); arm.position.set(-0.48, 2.72, 0); fp.add(arm);
      [-0.15, -0.85].forEach(function (rx) { var rod = cyl(0.006, 0.006, 0.22, 4, steel); rod.position.set(rx, 2.6, 0); fp.add(rod); });
      var hous = box(1.3, 0.07, 0.22, std('#E4E2DC', 0.5, 0.2)); hous.position.set(-0.5, 2.47, 0); fp.add(hous);
      var tubeA = new THREE.MeshStandardMaterial({ color: C('#F2F7FF'), emissive: C('#DCEBFF'), emissiveIntensity: 0.3, roughness: 0.3 }), tubeB = tubeA.clone();
      [[tubeA, 0.055], [tubeB, -0.055]].forEach(function (q) {
        var tb = cyl(0.017, 0.017, 1.2, 10, q[0]); tb.rotation.z = Math.PI / 2; tb.position.set(-0.5, 2.41, q[1]); fp.add(tb);
      });
      [-1.12, 0.12].forEach(function (ex) { var cap = box(0.04, 0.05, 0.18, dark); cap.position.set(ex, 2.41, 0); fp.add(cap); });
      var wsign = textPlane(['WAITING AREA'], { bg: '#1F3B73', color: '#FFFFFF', height: 0.13, px: 70, font: FONT_SANS, pad: 0.35 });
      wsign.position.set(0, 1.85, 0.045); fp.add(wsign);
      // flowers, growing up through the chairs
      var heads = [];
      function head(bx, bz, y, s, kind) {
        heads.push({ bx: bx, bz: bz, x: bx + rf(r, -0.06, 0.06), y: y, z: bz + rf(r, -0.06, 0.06), s: s, col: pick(r, egg2_FLOWER), kind: kind || (r() < 0.55 ? 'daisy' : 'pom') });
      }
      for (i = 0; i < n; i++) {
        x = (i - (n - 1) / 2) * gap;
        if (i === gone) { for (k = 0; k < 8; k++) head(x + rf(r, -0.25, 0.25), rf(r, -0.25, 0.3), rf(r, 0.3, 1.25), rf(r, 0.12, 0.2)); continue; }
        if (r() < 0.85) head(x + gap / 2 + rf(r, -0.05, 0.05), rf(r, -0.25, 0.15), rf(r, 0.55, 1.2), rf(r, 0.11, 0.19));
        if (r() < 0.6) head(x + rf(r, -0.14, 0.14), rf(r, -0.12, 0.12), rf(r, 0.6, 1.05), rf(r, 0.1, 0.17));
        if (r() < 0.5) head(x + rf(r, -0.2, 0.2), rf(r, -0.3, 0.1), rf(r, 0.2, 0.38), rf(r, 0.09, 0.14));
      }
      for (i = 0; i < ri(r, 10, 16); i++) head(rf(r, -half - 0.4, half + 0.5), rf(r, 0.25, 1.0), rf(r, 0.12, 0.45), rf(r, 0.09, 0.16));
      for (i = 0; i < ri(r, 6, 10); i++) head(rf(r, -half - 0.2, half + 0.2), rf(r, -1.0, -0.35), rf(r, 0.4, 1.35), rf(r, 0.11, 0.2));
      egg2_flowerBed(r, g, heads, new THREE.Vector3(0, 0, 1));
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.3, 0.3); shade(g); W.add(g);
      g.add(blobShadow(n * gap + 1.6, 2.2, 0.32));
      g.updateMatrixWorld(true);
      var lamp = W.lamp('#DDEBFF', 1.3, 9, fp.localToWorld(new THREE.Vector3(-0.5, 2.25, 0.2)));
      var fs = seedRng(W.P.seed + 4501), next = rf(fs, 1, 5), burst = 0, flick = 1, hold = 0;
      W.onUpdate(function (ctx) {
        var base = lerp(0.28, 1.05, ctx.night), fb = 1;
        if (burst > 0) {
          burst -= ctx.dt; hold -= ctx.dt;
          if (hold <= 0) { flick = fs() < 0.5 ? 0.06 : 1; hold = rf(fs, 0.03, 0.14); }
          fb = flick;
        } else {
          next -= ctx.dt;
          if (next <= 0) { burst = rf(fs, 0.4, 1.8); next = rf(fs, 2, 10); }
        }
        tubeA.emissiveIntensity = base; tubeB.emissiveIntensity = base * fb;
        lamp.intensity *= 0.5 + 0.5 * fb;
      });
    },

    'Commute Sign': function (W) {
      var p = egg2_spot(W, 1.8, 9, 22, W.cam.dist * 0.6, W.cam.dist * 1.25);
      if (!p) return;
      var r = W.r, state = pickW(r, [['A', 5], ['B', 3], ['C', 2]]), i, j;
      var look = { A: { on: '#FFB23A', off: '#261809', k: 1 }, B: { on: '#B9C23A', off: '#1B1D0A', k: 0.85 }, C: { on: '#C4C8CC', off: '#18191B', k: 0.7 } }[state];
      var g = new THREE.Group(), steel = mtl('#5C6168', 'brushed', 0.5, 0.7, 0.6), colM = mtl('#27352F', 'paint', 0.6, 0.3, 1.0), black = std('#131416', 0.5, 0.4);
      var slab = box(3.0, 0.3, 1.7, mtl('#A8A298', 'concrete', 0.95, 0, 1.5)); slab.position.y = 0.15; g.add(slab);
      var edge = box(3.0, 0.02, 0.55, std('#E8B800', 0.75)); edge.position.set(0, 0.31, 0.56); g.add(edge);
      var dots = [];
      for (i = 0; i < 26; i++) for (j = 0; j < 4; j++) if (!((i + j) % 2)) dots.push([-1.45 + i * 0.116, 0.36 + j * 0.13]);
      var dotI = egg2_inst(new THREE.CylinderBufferGeometry(0.025, 0.03, 0.02, 6), std('#E8B800', 0.75), dots.length);   // never share a material with a plain Mesh (r124)
      dots.forEach(function (q, k) { dotI.setMatrixAt(k, egg2_mat(q[0], 0.325, q[1])); });
      g.add(dotI);
      var col = box(0.24, 3.2, 0.24, colM); col.position.set(0, 1.9, -0.4); g.add(col);
      [0.33, 3.47].forEach(function (y) { var fl = box(0.34, 0.06, 0.34, colM); fl.position.set(0, y, -0.4); g.add(fl); });
      var arm = box(0.08, 0.08, 0.85, steel); arm.position.set(0, 3.3, 0.0); g.add(arm);
      var cross = box(1.5, 0.06, 0.06, steel); cross.position.set(0, 3.3, 0.35); g.add(cross);
      [-0.6, 0.6].forEach(function (x) { var rod = cyl(0.012, 0.012, 0.28, 6, steel); rod.position.set(x, 3.13, 0.35); g.add(rod); });
      var hous = box(1.72, 0.44, 0.2, black); hous.position.set(0, 2.8, 0.35); g.add(hous);
      var tex = canvasTex(egg2_LED.cols * egg2_LED.px, egg2_LED.rows * egg2_LED.px, function () { });
      var ledM = new THREE.MeshStandardMaterial({ map: tex, emissive: C('#FFFFFF'), emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.35 });
      var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.56, 0.312), ledM); face.position.set(0, 2.8, 0.452); g.add(face);
      var band = textPlane('THE COMMUTE', { bg: '#101010', color: '#FFFFFF', font: FONT_SANS, height: 0.2, px: 80, pad: 0.45 });
      band.position.set(0, 2.2, -0.275); g.add(band);
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.25, 0.25); shade(g); W.add(g);
      g.add(blobShadow(3.6, 2.4, 0.3));
      var ctx2 = tex.image.getContext('2d'), last = '', gs = seedRng(W.P.seed + 3170), glitch = null, gT = rf(gs, 0.5, 3), gRedraw = 0;
      W.onUpdate(function (ctx) {
        var t = ctx.t, page = Math.floor(ctx.real / 4) % 2, clock = pad2(t.h) + ':' + pad2(t.m), rem = 7 - (t.m % 8), rows;
        if (state === 'A') rows = page ? [['ON TIME', 'A'], ['MARFA', clock]] : [['NEXT TRAIN', 'A'], ['317 LOCAL', rem ? rem + ' MIN' : 'NOW']];
        else if (state === 'B') rows = page ? [['SIGNAL PROBLEMS', 'B'], ['MARFA', clock]] : [['NEXT TRAIN', 'B'], ['DELAYED', '+17 MIN']];
        else rows = page ? [['NO SERVICE', 'C'], ['MARFA', clock]] : [['NEXT TRAIN', 'C'], ['SUSPENDED', '--']];
        var k = lerp(1.0, 1.1, ctx.night) * look.k;
        if (state === 'C') {
          gT -= ctx.dt;
          if (glitch) {
            glitch.t -= ctx.dt; gRedraw -= ctx.dt;
            if (gRedraw <= 0) { glitch.shift = ri(gs, -4, 4); glitch.band = [ri(gs, 0, 16), ri(gs, 8, 23)]; glitch.dead = gs() < 0.4 ? ri(gs, 4, 9) : 0; glitch.f = rf(gs, 0.15, 1.2); glitch.n++; gRedraw = rf(gs, 0.04, 0.1); }
            k *= glitch.f;
            if (glitch.t <= 0) { glitch = null; gT = rf(gs, 1.5, 6); }
          } else if (gT <= 0) glitch = { t: rf(gs, 0.2, 0.9), n: 0, f: 1 };
        }
        ledM.emissiveIntensity = k;
        var key = rows.join('|') + (glitch ? '#' + glitch.n : '');
        if (key !== last) {
          last = key;
          egg2_ledDraw(ctx2, egg2_ledGrid(rows), look.on, look.off, glitch);
          tex.needsUpdate = true;
        }
      });
    },

    'Bloom Cycle': function (W) {
      var p = egg2_spot(W, 1.1, 8, 20, W.cam.dist * 0.5, W.cam.dist * 0.95);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), hex = pick(r, ['#FF2E88', '#FF5A36', '#8B5CF6', '#2962FF', '#FFD23F', '#F15BB5']), k;
      var corten = mtl('#7A4A2E', 'rust', 0.85, 0.3, 0.6);
      var body = box(1.0, 0.6, 1.0, corten); body.position.y = 0.3; g.add(body);
      [[0, 0.49, 1.06, 0.06], [0, -0.49, 1.06, 0.06], [0.49, 0, 0.06, 0.94], [-0.49, 0, 0.06, 0.94]].forEach(function (q) {
        var rim = box(q[2], 0.04, q[3], corten); rim.position.set(q[0], 0.62, q[1]); g.add(rim);
      });
      var soil = box(0.92, 0.04, 0.92, std('#3B2A1E', 1)); soil.position.y = 0.58; g.add(soil);
      var frost = box(0.93, 0.012, 0.93, std('#EEF4F8', 0.35)); frost.position.y = 0.605; frost.visible = false; g.add(frost);
      var looks = [];
      for (k = 0; k < 6; k++) { var lk = egg2_bloomLook(k, hex, r); lk.position.y = 0.6; lk.visible = false; g.add(lk); looks.push(lk); }
      // fallen petals for the wilt, frost crystals for the frost
      var pm = std(hex, 0.7, 0, { side: THREE.DoubleSide });
      pm.color.lerp(C('#6B4A34'), 0.7);
      for (k = 0; k < 4; k++) {
        var fp = new THREE.Mesh(egg2_petalGeo(0.2, 0.09, 0.2, 0.02), pm);
        fp.rotation.set(-Math.PI / 2 + 0.1, 0, r() * 6.28); fp.position.set(rf(r, -0.35, 0.35), 0.006, rf(r, -0.3, 0.38)); looks[3].add(fp);
      }
      var ice = egg2_inst(new THREE.OctahedronBufferGeometry(1, 0), std('#F4FAFF', 0.15, 0.2, { emissive: C('#BFE3FF'), emissiveIntensity: 0.15 }), 70);
      for (k = 0; k < 70; k++) {
        var onHead = k < 30, a = r() * 6.28, rr = onHead ? rf(r, 0.02, 0.16) : rf(r, 0.05, 0.44);
        ice.setMatrixAt(k, egg2_mat(Math.sin(a) * rr, onHead ? 0.7 + rf(r, -0.05, 0.1) : 0.012, Math.cos(a) * rr, r() * 3, r() * 3, 0, rf(r, 0.006, 0.014)));
      }
      looks[4].add(ice);
      var ptex = canvasTex(640, 200, function () { }), pctx = ptex.image.getContext('2d');
      var plaq = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.4, 0.125), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.35, metalness: 0.55 }));
      plaq.position.set(0, 0.34, 0.503); g.add(plaq);
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.35, 0.35); shade(g); W.add(g);
      g.add(blobShadow(1.8, 1.8, 0.35));
      var cur = -1, curDay = -1, ph = r() * 6.28;
      W.onUpdate(function (ctx) {
        var st = bloomState(ctx.t), day = dayOfYear(ctx.t);
        if (st !== cur || day !== curDay) {
          looks.forEach(function (l, i) { l.visible = i === st; });
          frost.visible = st === 4;
          egg2_plaqueDraw(pctx, 640, 200, st, day); ptex.needsUpdate = true;
          cur = st; curDay = day;
        }
        var lk = looks[st];
        lk.rotation.z = Math.sin(ctx.real * 1.1 + ph) * 0.02 * ctx.wind;
        lk.rotation.x = Math.sin(ctx.real * 0.7 + ph) * 0.012 * ctx.wind;
      });
    },

    'Dossier Cabinet': function (W) {
      var p = egg2_spot(W, 1.0, 8, 20, W.cam.dist * 0.5, W.cam.dist * 0.95);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), cab = new THREE.Group(); g.add(cab);
      var paint = mtl(pick(r, ['#66705F', '#6E7478', '#7B7560']), 'paint', 0.55, 0.35, 0.6), dark = std('#141512', 0.95), chrome = std('#B9BCBE', 0.45, 0.8);
      var Wd = 0.46, H = 1.32, D = 0.66, i;
      [-Wd / 2 + 0.01, Wd / 2 - 0.01].forEach(function (x) { var sd = box(0.02, H - 0.06, D, paint); sd.position.set(x, H / 2 + 0.03, 0); cab.add(sd); });
      var back = box(Wd, H - 0.06, 0.02, paint); back.position.set(0, H / 2 + 0.03, -D / 2 + 0.01); cab.add(back);
      var top = box(Wd + 0.01, 0.025, D + 0.01, paint); top.position.y = H; cab.add(top);
      var plinth = box(Wd - 0.02, 0.06, D - 0.04, dark); plinth.position.y = 0.03; cab.add(plinth);
      var inner = box(Wd - 0.04, H - 0.1, D - 0.06, dark); inner.position.set(0, H / 2 + 0.02, -0.02); cab.add(inner);
      var open = ri(r, 2, 3), slide = 0.36, labels = ['FIELD NOTES', 'MAINTENANCE', 'THE UNSEEN', 'DOSSIERS'];
      var manila = std('#D6B574', 0.85), tabCols = ['#D6B574', '#C9A562', '#B23A48', '#2962FF', '#E9E4D6'];
      for (i = 0; i < 4; i++) {
        var yc = 0.06 + 0.16 + i * 0.315, z0 = D / 2 + 0.0125 + (i === open ? slide : 0), dr = new THREE.Group();
        var fr = box(0.43, 0.3, 0.025, paint); fr.position.set(0, yc, z0); dr.add(fr);
        var hb = cyl(0.008, 0.008, 0.14, 8, chrome); hb.rotation.z = Math.PI / 2; hb.position.set(0, yc + 0.02, z0 + 0.04); dr.add(hb);
        [-0.07, 0.07].forEach(function (x) { var bk = box(0.012, 0.018, 0.04, chrome); bk.position.set(x, yc + 0.02, z0 + 0.02); dr.add(bk); });
        var hold = box(0.11, 0.05, 0.006, chrome); hold.position.set(0, yc + 0.095, z0 + 0.015); dr.add(hold);
        var card = textPlane(labels[i], { bg: '#F2EAD8', color: '#222222', height: 0.034, px: 40, font: FONT_MONO, pad: 0.4 });
        card.scale.setScalar(Math.min(1, 0.1 / card.userData.w)); card.position.set(0, yc + 0.095, z0 + 0.019); dr.add(card);
        if (i === open) {
          var zc = D / 2 - 0.3 + slide;
          [-0.2, 0.2].forEach(function (x) { var s = box(0.012, 0.24, 0.6, paint); s.position.set(x, yc - 0.02, zc); dr.add(s); });
          var bt = box(0.4, 0.012, 0.6, paint); bt.position.set(0, yc - 0.135, zc); dr.add(bt);
          for (var f = 0; f < 12; f++) {
            var fz = z0 - 0.05 - f * 0.042, lift = f === 3 ? 0.06 : 0;
            var fo = box(0.38, 0.23, 0.005, manila); fo.position.set(0, yc - 0.01 + lift, fz); fo.rotation.x = rf(r, -0.08, 0.08); dr.add(fo);
            var tab = box(0.1, 0.03, 0.005, std(pick(r, tabCols), 0.8)); tab.position.set([-0.12, 0, 0.12][f % 3], yc + 0.115 + lift, fz); dr.add(tab);
          }
        }
        cab.add(dr);
      }
      // a sheet caught in the wind, from the open drawer
      var oy = 0.06 + 0.16 + open * 0.315, sheet = new THREE.Group();
      sheet.position.set(0.05, oy + 0.02, D / 2 + slide - 0.09); cab.add(sheet);
      var pap = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.2, 0.27), std('#F4F1E8', 0.9, 0, { side: THREE.DoubleSide })); pap.position.y = 0.1; sheet.add(pap);
      // the CLASSIFIED folder on top
      var fold = new THREE.Group(); fold.position.set(rf(r, -0.03, 0.03), H + 0.014, rf(r, -0.05, 0.05)); fold.rotation.y = rf(r, -0.25, 0.25); cab.add(fold);
      fold.add(box(0.3, 0.008, 0.235, manila));
      var ff = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.3, 0.235), std('#FFFFFF', 0.85, 0, { map: egg2_dossierTex() })); ff.rotation.x = -Math.PI / 2; ff.position.y = 0.0045; fold.add(ff);
      var clip = box(0.012, 0.004, 0.05, chrome); clip.position.set(-0.12, 0.007, -0.1); fold.add(clip);
      var lock = cyl(0.012, 0.012, 0.02, 10, chrome); lock.rotation.x = Math.PI / 2; lock.position.set(0.15, H - 0.05, D / 2 + 0.005); cab.add(lock);
      cab.rotation.z = rf(r, -0.025, 0.025); cab.rotation.x = rf(r, -0.02, 0.01);
      var drift = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: W.groundColor.clone(), roughness: 1 }));
      drift.scale.set(0.42, 0.07, 0.5); drift.position.set(0.05, 0, -0.05); g.add(drift);
      // the brass plaque, on a stake beside it
      var stake = new THREE.Group(); stake.position.set(0.55, 0, 0.35); stake.rotation.y = -0.25; g.add(stake);
      var sp = cyl(0.014, 0.014, 0.72, 8, std('#2A2C30', 0.4, 0.8)); sp.position.y = 0.36; stake.add(sp);
      var bt2 = egg2_brassTex([['THE SOFT CONSPIRACY', '700 44px ' + FONT_SANS, 62], ['MLOW x ANDRES DEL VECCHIO', '600 28px ' + FONT_SANS, 112], ['We do not worship the unseen.', 'italic 30px ' + FONT_SERIF, 166], ['We maintain it.', 'italic 30px ' + FONT_SERIF, 204]]);
      var plq = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.36, 0.13), new THREE.MeshStandardMaterial({ map: bt2, roughness: 0.35, metalness: 0.6 }));
      plq.position.set(0, 0.75, 0.01); plq.rotation.x = -0.4; stake.add(plq);
      var pb = box(0.37, 0.14, 0.012, std('#6E5220', 0.4, 0.8)); pb.position.set(0, 0.75, 0.0); pb.rotation.x = -0.4; stake.add(pb);
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.4, 0.4); shade(g); W.add(g);
      g.add(blobShadow(1.3, 1.3, 0.35));
      var ph = r() * 6.28;
      W.onUpdate(function (ctx) {
        sheet.rotation.x = -0.35 + Math.sin(ctx.real * 5.5 + ph) * 0.08 * ctx.wind + Math.sin(ctx.real * 13 + ph) * 0.03 * ctx.wind;
        sheet.rotation.z = Math.sin(ctx.real * 3.1 + ph) * 0.06 * ctx.wind;
      });
    },

    'On Air': function (W) {
      var p = egg2_spot(W, 1.4, 8, 20, W.cam.dist * 0.5, W.cam.dist * 1.0);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), metal = std('#2B2D31', 0.45, 0.7), chrome = std('#D5D8DC', 0.16, 1), black = std('#101112', 0.6);
      var base = cyl(0.17, 0.19, 0.035, 28, metal); base.position.y = 0.018; g.add(base);
      var p1 = cyl(0.017, 0.017, 1.1, 10, chrome); p1.position.y = 0.57; g.add(p1);
      var clutch = cyl(0.026, 0.026, 0.06, 12, metal); clutch.position.y = 1.12; g.add(clutch);
      var p2 = cyl(0.011, 0.011, 0.46, 10, chrome); p2.position.y = 1.36; g.add(p2);
      // the microphone: a chrome capsule with a ribbed grille, on a yoke, with a flag
      var mic = new THREE.Group(); mic.position.y = 1.72; mic.rotation.x = -0.12; g.add(mic);
      var shell = sph(1, chrome, 28, 18); shell.scale.set(0.055, 0.085, 0.045); mic.add(shell);
      var grille = sph(1, black, 20, 14); grille.scale.set(0.047, 0.076, 0.02); grille.position.z = 0.032; mic.add(grille);
      for (var k = -4; k <= 4; k++) {
        var y = k * 0.016, fr = Math.sqrt(Math.max(0, 1 - Math.pow(y / 0.085, 2)));
        var bar = cyl(0.0032, 0.0032, 0.1 * fr, 6, chrome); bar.rotation.z = Math.PI / 2; bar.position.set(0, y, 0.046 * fr + 0.004); mic.add(bar);
      }
      var spine = box(0.008, 0.15, 0.008, chrome); spine.position.z = 0.05; mic.add(spine);
      var yoke = new THREE.Mesh(new THREE.TorusBufferGeometry(0.07, 0.006, 6, 24, Math.PI), chrome); yoke.rotation.z = Math.PI; mic.add(yoke);
      [-1, 1].forEach(function (sd) { var kn = cyl(0.012, 0.012, 0.018, 10, metal); kn.rotation.z = Math.PI / 2; kn.position.x = sd * 0.068; mic.add(kn); });
      var neck = cyl(0.011, 0.013, 0.08, 8, chrome); neck.position.y = -0.1; mic.add(neck);
      var ftex = canvasTex(256, 200, function (gc, w, h) {
        gc.fillStyle = '#F4F2EC'; gc.fillRect(0, 0, w, h);
        gc.fillStyle = '#0D0D0D'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
        gc.font = '700 64px ' + FONT_SANS; gc.fillText('MLOW', w / 2, h * 0.42);
        gc.fillStyle = BRAND.blue; gc.fillRect(30, h * 0.66, w - 60, 14);
      });
      var fm = std('#FFFFFF', 0.5, 0, { map: ftex }), fplain = std('#F4F2EC', 0.5);
      var flag = new THREE.Mesh(new THREE.BoxBufferGeometry(0.075, 0.06, 0.075), [fm, fm, fplain, fplain, fm, fm]); flag.position.y = -0.155; mic.add(flag);
      // the ON AIR light, on its own post
      var la = new THREE.Group(); la.position.set(-0.85, 0, -0.55); g.add(la);
      var lb = cyl(0.13, 0.15, 0.03, 20, metal); lb.position.y = 0.015; la.add(lb);
      var lp = cyl(0.018, 0.018, 2.05, 8, metal); lp.position.y = 1.03; la.add(lp);
      var hous = box(0.54, 0.21, 0.12, black); hous.position.y = 2.16; la.add(hous);
      var atex = canvasTex(512, 180, function (gc, w, h) {
        var gr = gc.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.55);
        gr.addColorStop(0, '#FF3A2E'); gr.addColorStop(1, '#9E0710');
        gc.fillStyle = gr; gc.fillRect(0, 0, w, h);
        gc.fillStyle = '#FFE9DF'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
        gc.font = '800 112px ' + FONT_SANS; gc.fillText('ON AIR', w / 2, h / 2 + 6);
      });
      var am = new THREE.MeshStandardMaterial({ map: atex, emissive: C('#FFFFFF'), emissiveMap: atex, emissiveIntensity: 0.9, roughness: 0.25 });
      var lens = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.49, 0.172), am); lens.position.set(0, 2.16, 0.061); la.add(lens);
      var show = textPlane('THE MLOW SHOW', { bg: '#0D0D0D', color: '#F4F2EC', height: 0.06, px: 60, font: FONT_SANS, pad: 0.3, spacing: 0.08 });
      show.position.set(0, 1.99, 0.03); la.add(show);
      // the chair, the headphones on it, a mug
      var chair = egg2_foldChair(metal, std(pick(r, ['#3A3D42', '#6E2E2A', '#2E4A6B', '#C9C4B8']), 0.5, 0.3));
      chair.position.set(0.5, 0, -0.2); chair.rotation.y = -1.25 + rf(r, -0.2, 0.2); g.add(chair);
      var hp = new THREE.Group(); hp.position.set(0, 0.49, 0.03); hp.rotation.set(-1.35, 0.4, 0); chair.add(hp);
      var band = new THREE.Mesh(new THREE.TorusBufferGeometry(0.085, 0.009, 6, 18, Math.PI), black); hp.add(band);
      [-1, 1].forEach(function (sd) { var cup = cyl(0.04, 0.04, 0.03, 16, black); cup.rotation.z = Math.PI / 2; cup.position.set(sd * 0.085, -0.005, 0); hp.add(cup); });
      var mug = cyl(0.04, 0.036, 0.095, 16, std('#F4F2EC', 0.4)); mug.position.set(0.85, 0.048, 0.15); g.add(mug);
      var mb = cyl(0.041, 0.041, 0.02, 16, std(BRAND.blue, 0.4)); mb.position.set(0.85, 0.07, 0.15); g.add(mb);
      var cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.58, -0.02), new THREE.Vector3(0.025, 1.0, -0.03), new THREE.Vector3(0.05, 0.05, -0.08), new THREE.Vector3(-0.2, 0.015, -0.4), new THREE.Vector3(-0.55, 0.015, -0.3), new THREE.Vector3(-0.85, 0.015, -0.48)]);
      g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(cable, 60, 0.006, 5), black));
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.35, 0.35); shade(g); W.add(g);
      g.add(blobShadow(2.2, 1.8, 0.32));
      g.updateMatrixWorld(true);
      var lamp = W.lamp('#FF3B30', 0.3, 4, la.localToWorld(new THREE.Vector3(0, 2.1, 0.4)));
      var ph = r() * 6.28;
      W.onUpdate(function (ctx) {
        var breathe = 1 + Math.sin(ctx.real * 1.6 + ph) * 0.05;
        am.emissiveIntensity = lerp(0.95, 1.15, ctx.night) * breathe;
        lamp.intensity *= breathe;
      });
    },

    'Archetype Stack': function (W) {
      var p = egg2_spot(W, 1.4, 9, 22, W.cam.dist * 0.6, W.cam.dist * 1.2);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), s = 0.34, N = 4;
      var pals = [['#FF4E50', '#FC913A', '#F9D423', '#1B998B', '#2D3047'], ['#0B3954', '#FF5A5F', '#FFD166', '#06D6A0'], ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'], ['#E63946', '#F1C453', '#2A9D8F', '#264653']];
      var pal = pick(r, pals);
      function tone(hex, k) { var c = new THREE.Color(hex); if (k > 0) c.lerp(new THREE.Color('#FFFFFF'), k); else c.multiplyScalar(1 + k); return '#' + c.getHexString(); }
      function faceTex(hex) {
        return canvasTex(64, 64, function (gc) { gc.fillStyle = '#FFFFFF'; gc.fillRect(0, 0, 64, 64); gc.fillStyle = hex; gc.fillRect(5, 5, 54, 54); });
      }
      var mats = pal.map(function (hex) {
        var top = std('#FFFFFF', 0.9, 0, { map: faceTex(tone(hex, 0.28)) }), a = std('#FFFFFF', 0.9, 0, { map: faceTex(hex) }), b = std('#FFFFFF', 0.9, 0, { map: faceTex(tone(hex, -0.3)) });
        return [a, a, top, b, b, b];
      });
      var cubes = pal.map(function () { return []; }), cx, cz, h;
      for (cx = 0; cx < N; cx++) for (cz = 0; cz < N; cz++) {
        var d = Math.abs(cx - 1.5) + Math.abs(cz - 1.5);
        h = Math.max(0, Math.round(rf(r, 0.5, 4.8) - d * 0.55 + (r() < 0.15 ? 2 : 0)));
        if (cx === 1 && cz === 1) h = Math.max(h, 4);
        for (var y = 0; y < h; y++) cubes[ri(r, 0, pal.length - 1)].push([cx, y, cz]);
      }
      var geo = new THREE.BoxBufferGeometry(s, s, s), base = new THREE.Group(); base.position.y = 0.6; g.add(base);
      cubes.forEach(function (list, i) {
        if (!list.length) return;
        var im = egg2_inst(geo, mats[i], list.length);
        list.forEach(function (q, j) { im.setMatrixAt(j, egg2_mat((q[0] - 1.5) * s, q[1] * s + s / 2, (q[2] - 1.5) * s)); });
        base.add(im);
      });
      var pl = box(1.6, 0.6, 1.6, mtl('#F2F0EA', 'plaster', 0.8, 0, 1.2)); pl.position.y = 0.3; g.add(pl);
      g.position.copy(p); W.face(g); g.rotation.y += Math.PI / 4 + rf(r, -0.15, 0.15); shade(g); W.add(g);
      g.add(blobShadow(2.4, 2.4, 0.35));
    },

    'Meridian Painting': function (W) {
      var p = egg2_spot(W, 1.4, 9, 22, W.cam.dist * 0.6, W.cam.dist * 1.2);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), seed = ri(r, 1, 9999), k;
      var schemes = [['#F2ECE0', ['#1D3557', '#457B9D', '#E63946', '#F4A261']], ['#0F1726', ['#F72585', '#7209B7', '#4CC9F0', '#F8F4E3']], ['#EFE6D8', ['#264653', '#2A9D8F', '#E9C46A', '#E76F51']], ['#141414', ['#FF7B54', '#FFB26B', '#FFD56F', '#939B62']]];
      var sc = pick(r, schemes), bg = sc[0], pal = sc[1], sunX = rf(r, 0.25, 0.75), hills = [];
      for (k = 0; k < 3; k++) hills.push([rf(r, 0.1, 0.9), rf(r, 0.1, 0.25), rf(r, 0.5, 1)]);
      var tex = canvasTex(1500, 1000, function (gc, w, h) {
        gc.fillStyle = bg; gc.fillRect(0, 0, w, h);
        gc.fillStyle = pal[pal.length - 1]; gc.globalAlpha = 0.9; gc.beginPath(); gc.arc(w * sunX, h * 0.26, h * 0.11, 0, 6.2832); gc.fill(); gc.globalAlpha = 1;
        var n = 84, m = 70, c = new THREE.Color(), c2 = new THREE.Color();
        for (var i = 0; i < n; i++) {
          var y0 = h * 0.2 + h * 0.72 * i / n, pts = [];
          for (var x = m; x <= w - m; x += 5) {
            var u = x / w, env = 0.25;
            hills.forEach(function (q) { env += q[2] * Math.exp(-Math.pow((u - q[0]) / q[1], 2)); });
            var nz = fbm(u * 4 + i * 0.035, i * 0.06, seed, 4);
            pts.push([x, y0 - Math.max(0, nz - 0.32) * h * 0.34 * env * (0.4 + 0.6 * i / n)]);
          }
          gc.beginPath(); gc.moveTo(pts[0][0], h); pts.forEach(function (q) { gc.lineTo(q[0], q[1]); }); gc.lineTo(pts[pts.length - 1][0], h); gc.closePath();
          gc.fillStyle = bg; gc.fill();
          var f = i / (n - 1) * (pal.length - 2), a = Math.floor(f);
          c.set(pal[a]); c2.set(pal[Math.min(a + 1, pal.length - 2)]); c.lerp(c2, f - a);
          gc.strokeStyle = '#' + c.getHexString(); gc.lineWidth = 2.6; gc.beginPath();
          pts.forEach(function (q, j) { if (j) gc.lineTo(q[0], q[1]); else gc.moveTo(q[0], q[1]); });
          gc.stroke();
        }
        gc.fillStyle = bg; gc.fillRect(0, h - m * 0.6, w, m); gc.fillRect(0, 0, m * 0.8, h); gc.fillRect(w - m * 0.8, 0, m, h);
      });
      var wood = mtl('#9C7650', 'wood', 0.8, 0, 0.5);
      var cw = 1.8, ch = 1.2, cy = 0.95 + ch / 2;
      var canvasBox = box(cw, ch, 0.04, std('#F2EEE6', 0.9)); canvasBox.position.set(0, cy, 0); canvasBox.rotation.x = -0.1; g.add(canvasBox);
      var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(cw, ch), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
      face.position.z = 0.021; canvasBox.add(face);
      [-1, 1].forEach(function (sd) {
        var leg = box(0.06, 2.5, 0.06, wood); leg.position.set(sd * 0.55, 1.22, 0.02); leg.rotation.z = sd * -0.06; leg.rotation.x = -0.1; g.add(leg);
      });
      var mast = box(0.07, 2.6, 0.06, wood); mast.position.set(0, 1.3, -0.1); mast.rotation.x = -0.1; g.add(mast);
      var rear = box(0.06, 2.4, 0.06, wood); rear.position.set(0, 1.1, -0.55); rear.rotation.x = 0.3; g.add(rear);
      var ledge = box(1.5, 0.05, 0.16, wood); ledge.position.set(0, 0.93, 0.08); g.add(ledge);
      var clampB = box(0.3, 0.06, 0.1, wood); clampB.position.set(0, cy + ch / 2 + 0.03, -0.04); clampB.rotation.x = -0.1; g.add(clampB);
      var foot = box(1.3, 0.06, 0.1, wood); foot.position.set(0, 0.03, 0.08); g.add(foot);
      var tray = box(0.28, 0.035, 0.22, std('#E7E1D4', 0.6)); tray.position.set(0.45, 0.965, 0.1); g.add(tray);
      pal.forEach(function (hx, i) { var dab = sph(0.018, std(hx, 0.4), 8, 6); dab.scale.y = 0.4; dab.position.set(0.36 + i * 0.05, 0.99, 0.1 + (i % 2) * 0.05); g.add(dab); });
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.3, 0.3); shade(g); W.add(g);
      g.add(blobShadow(1.9, 1.5, 0.32));
    },

    'Friendship Bracelets': function (W) {
      var p = egg2_spot(W, 1.6, 10, 24, W.cam.dist * 0.4, W.cam.dist * 0.75);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), wood = mtl('#7D7466', 'wood', 1, 0, 0.5), wireM = new THREE.LineBasicMaterial({ color: C('#3A3530') });
      var pal = ['#FF2E63', '#FFD23F', '#22D3EE', '#2962FF', '#00E676', '#FF7A3C', '#9B5DE5', '#F15BB5', '#FFFFFF', '#0D0D0D'];
      function bandTex() {
        var cols = [], n = ri(r, 3, 6);
        for (var i = 0; i < n; i++) cols.push(pick(r, pal));
        var t = canvasTex(128, 32, function (gc) {
          for (var y = 0; y < 32; y++) for (var x = 0; x < 128; x++) {
            gc.fillStyle = cols[Math.floor((x + Math.abs(y - 15.5)) / 7) % n]; gc.fillRect(x, y, 1, 1);
          }
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      }
      [-2.2, 0, 2.2].forEach(function (x, i) {
        var pst = cyl(i === 1 ? 0.07 : 0.055, i === 1 ? 0.08 : 0.065, 1.35, 7, wood); pst.position.set(x, 0.66, 0); pst.rotation.z = i === 1 ? 0 : rf(r, -0.05, 0.05); g.add(pst);
      });
      [0.5, 0.85, 1.15].forEach(function (y) {
        var pts = [];
        for (var k = 0; k <= 20; k++) pts.push(new THREE.Vector3(-2.2 + 4.4 * k / 20, y - Math.sin((k % 10) / 10 * Math.PI) * 0.04, 0.06));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
      });
      // bracelets round the middle post, each with two knotted tails
      var tails = [], nb = ri(r, 7, 11), i, t;
      for (i = 0; i < nb; i++) {
        var tx = bandTex(), m = std('#FFFFFF', 0.85, 0, { map: tx, side: THREE.DoubleSide }), y = 0.72 + i * 0.05 + rf(r, -0.01, 0.01);
        tx.repeat.set(4, 1);
        var br = new THREE.Mesh(new THREE.TorusBufferGeometry(0.086, 0.013, 6, 32), m);
        br.rotation.x = Math.PI / 2 + rf(r, -0.15, 0.15); br.rotation.y = rf(r, -0.1, 0.1); br.scale.z = 1.7; br.position.set(0, y, 0); g.add(br);
        var a = r() * 6.28;
        for (t = 0; t < 2; t++) {
          var tl = rf(r, 0.2, 0.32), geo = new THREE.PlaneBufferGeometry(0.026, tl, 1, 8), tail = new THREE.Mesh(geo, m);
          geo.translate(0, -tl / 2, 0);
          tail.position.set(Math.sin(a + t * 0.25) * 0.095, y, Math.cos(a + t * 0.25) * 0.095); tail.rotation.y = a + t * 0.25;
          g.add(tail);
          tails.push({ m: tail, base: Float32Array.from(geo.attributes.position.array), ph: r() * 6.28, len: tl });
        }
      }
      // two more tied to the wire
      [-1.1, 1.2].forEach(function (x) {
        var tx2 = bandTex(), m2 = std('#FFFFFF', 0.85, 0, { map: tx2, side: THREE.DoubleSide });
        tx2.repeat.set(2, 1);
        var br2 = new THREE.Mesh(new THREE.TorusBufferGeometry(0.025, 0.008, 6, 20), m2); br2.rotation.y = Math.PI / 2; br2.position.set(x, 0.85, 0.06); g.add(br2);
        var geo2 = new THREE.PlaneBufferGeometry(0.02, 0.3, 1, 8), tl2 = new THREE.Mesh(geo2, m2);
        geo2.translate(0, -0.15, 0); tl2.position.set(x, 0.83, 0.06); g.add(tl2);
        tails.push({ m: tl2, base: Float32Array.from(geo2.attributes.position.array), ph: r() * 6.28, len: 0.3 });
      });
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.4, 0.4); shade(g); W.add(g);
      g.add(blobShadow(5, 1.2, 0.25));
      // the wind, in each tail's own frame
      tails.forEach(function (q) {
        var phi = -(g.rotation.y + q.m.rotation.y), wd = W.windDir;
        q.wx = wd.x * Math.cos(phi) + wd.z * Math.sin(phi); q.wz = -wd.x * Math.sin(phi) + wd.z * Math.cos(phi);
      });
      W.onUpdate(function (ctx) {
        var wv = ctx.wind;
        tails.forEach(function (q) {
          var pos = q.m.geometry.attributes.position, b = q.base;
          for (var i2 = 0; i2 < pos.count; i2++) {
            var y2 = b[i2 * 3 + 1], f = Math.min(1, -y2 / q.len), flap = Math.sin(ctx.real * 7 + q.ph - f * 3.5) * 0.03 * f * (0.4 + wv);
            var lift = f * f * 0.09 * wv;
            pos.setXYZ(i2, b[i2 * 3] + q.wx * lift + flap * 0.5, y2 * (1 - 0.25 * Math.min(wv, 1.5) * f), b[i2 * 3 + 2] + q.wz * lift + flap);
          }
          pos.needsUpdate = true;
        });
      });
    },

    'Reata Facade': function (W) {
      if (W.court && W.court.interior) return;                 // nothing to see from inside
      var p = egg2_spot(W, 12, 10, 28, 100, 250, true);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), k;
      var paint = mtl('#E6E0D3', 'plaster', 0.92, 0, 2.2), trim = mtl('#D6CFC1', 'paint', 0.85, 0, 1.0), slate = mtl('#6E6A66', 'stone', 0.95, 0, 1.5);
      var timber = mtl('#7A6A55', 'wood', 1, 0, 1.2), glass = std('#1B2128', 0.25, 0.3), doorM = mtl('#4A3A2C', 'wood', 0.8, 0, 0.8), deckM = mtl('#BDB5A6', 'wood', 0.95, 0, 1.0);
      // clapboard, five boards to the metre (extrusions carry UVs in metres)
      paint.map = canvasTex(64, 64, function (gc) {
        for (var b = 0; b < 5; b++) {
          var gr = gc.createLinearGradient(0, b * 12.8, 0, b * 12.8 + 12.8);
          gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.8, '#EDEAE4'); gr.addColorStop(1, '#B9B3A8');
          gc.fillStyle = gr; gc.fillRect(0, b * 12.8, 64, 12.8);
        }
      }, { repeat: [1, 1] });
      function shape(pts) { var s = new THREE.Shape(); pts.forEach(function (q, i) { if (i) s.lineTo(q[0], q[1]); else s.moveTo(q[0], q[1]); }); return s; }
      // the wall: a silhouette with a mansard shoulder each side
      var wall = new THREE.Mesh(new THREE.ExtrudeBufferGeometry(shape([[-6.5, 0], [6.5, 0], [6.5, 10.0], [5.1, 11.7], [-5.1, 11.7], [-6.5, 10.0]]), { depth: 0.3, bevelEnabled: false }), paint);
      wall.position.z = -0.3; g.add(wall);
      [-1, 1].forEach(function (sd) {
        var roof = new THREE.Mesh(new THREE.ExtrudeBufferGeometry(shape([[sd * 6.55, 9.95], [sd * 5.1, 11.75], [sd * 3.2, 11.75], [sd * 3.2, 9.95]]), { depth: 0.08, bevelEnabled: false }), slate);
        g.add(roof);
      });
      [3.9, 7.35, 9.95].forEach(function (y) { var band = box(13.3, 0.24, 0.26, trim); band.position.set(0, y, 0.1); g.add(band); });
      var cornice = box(10.6, 0.3, 0.4, trim); cornice.position.set(0, 11.8, 0.1); g.add(cornice);
      [-6.45, 6.45].forEach(function (x) { var cb = box(0.3, 10, 0.2, trim); cb.position.set(x, 5, 0.06); g.add(cb); });
      // instanced parts get their own materials: r124 keeps one program per material,
      // so sharing one between an InstancedMesh and a plain Mesh breaks the render
      var trimI = mtl('#D6CFC1', 'paint', 0.85, 0, 1.0), glassI = std('#1B2128', 0.25, 0.3);
      var unit = new THREE.BoxBufferGeometry(1, 1, 1), crest = egg2_inst(unit, std('#2A2A2A', 0.7, 0.4), 21);
      for (k = 0; k < 21; k++) crest.setMatrixAt(k, egg2_mat(-5 + k * 0.5, 12.1, 0.1, 0, 0, 0, 0.05, 0.3, 0.05));
      g.add(crest);
      // windows, as instanced frames, hoods, sills, panes and sash bars
      var wins = [];
      [-1.9, 1.9, 4.5].forEach(function (x) { wins.push([x, 2.0, 0.95, 2.1]); });
      [-1.9, 0, 1.9, 4.5].forEach(function (x) { wins.push([x, 5.55, 0.9, 2.0]); });
      [-4.5, -1.9, 0, 1.9, 4.5].forEach(function (x) { wins.push([x, 8.65, 0.8, 1.55]); });
      var frI = egg2_inst(unit, trimI, wins.length * 3), pnI = egg2_inst(unit, glassI, wins.length), muI = egg2_inst(unit, trimI, wins.length);
      wins.forEach(function (w, i) {
        frI.setMatrixAt(i * 3, egg2_mat(w[0], w[1], 0.06, 0, 0, 0, w[2] + 0.3, w[3] + 0.3, 0.12));
        frI.setMatrixAt(i * 3 + 1, egg2_mat(w[0], w[1] + w[3] / 2 + 0.28, 0.14, 0, 0, 0, w[2] + 0.6, 0.2, 0.28));
        frI.setMatrixAt(i * 3 + 2, egg2_mat(w[0], w[1] - w[3] / 2 - 0.2, 0.12, 0, 0, 0, w[2] + 0.45, 0.1, 0.22));
        pnI.setMatrixAt(i, egg2_mat(w[0], w[1], 0.13, 0, 0, 0, w[2], w[3], 0.02));
        muI.setMatrixAt(i, egg2_mat(w[0], w[1], 0.15, 0, 0, 0, w[2], 0.06, 0.02));
      });
      [frI, pnI, muI].forEach(function (m) { g.add(m); });
      // an oval window in the attic
      var ov = cyl(0.55, 0.55, 0.05, 24, glass); ov.rotation.x = Math.PI / 2; ov.position.set(0, 10.85, 0.08); ov.scale.set(1.3, 1, 0.8); g.add(ov);
      var ovr = new THREE.Mesh(new THREE.TorusBufferGeometry(0.58, 0.07, 6, 28), trim); ovr.position.set(0, 10.85, 0.1); ovr.scale.set(1.3, 0.8, 1); g.add(ovr);
      // the bay window, two storeys, left of the door
      var bayShape = shape([[-1.35, 0], [1.35, 0], [0.85, -1.0], [-0.85, -1.0]]);
      function bayPiece(depth, y, grow, mat) {
        var m = new THREE.Mesh(new THREE.ExtrudeBufferGeometry(bayShape, { depth: depth, bevelEnabled: false }), mat);
        m.rotation.x = -Math.PI / 2; m.position.set(-4.4, y, 0); m.scale.set(grow, grow, 1); g.add(m);
      }
      bayPiece(6.9, 0, 1, paint); bayPiece(0.25, 6.9, 1.12, slate); bayPiece(0.2, 3.65, 1.06, trim);
      [2.0, 5.3].forEach(function (y) {
        var fw = box(0.9, 1.9, 0.06, glass); fw.position.set(-4.4, y, 1.02); g.add(fw);
        var ft = box(1.2, 2.2, 0.04, trim); ft.position.set(-4.4, y, 1.0); g.add(ft);
        [-1, 1].forEach(function (sd) {
          var sw = box(0.45, 1.8, 0.06, glass); sw.position.set(-4.4 + sd * 1.1, y, 0.52); sw.rotation.y = sd * 1.1; g.add(sw);
        });
      });
      // the door and transom
      var door = box(1.6, 2.6, 0.12, doorM); door.position.set(0, 1.8, 0.02); g.add(door);
      var dtr = box(2.0, 3.4, 0.08, trim); dtr.position.set(0, 2.1, 0.0); g.add(dtr);
      var trans = box(1.5, 0.45, 0.04, glass); trans.position.set(0, 3.4, 0.06); g.add(trans);
      // the porch, with a balustrade and steps
      var deck = box(9.2, 0.5, 2.8, deckM); deck.position.set(1.9, 0.25, 1.4); g.add(deck);
      for (var c = 0; c < 7; c++) {
        var cx = -2.6 + c * 1.5, colm = cyl(0.1, 0.12, 3.3, 10, trim); colm.position.set(cx, 2.15, 2.62); g.add(colm);
        if (c < 6) { var br1 = box(0.7, 0.3, 0.08, trim); br1.position.set(cx + 0.3, 3.6, 2.62); br1.rotation.z = -0.35; g.add(br1); }
      }
      var pr = box(9.8, 0.2, 3.1, slate); pr.position.set(1.9, 3.92, 1.5); pr.rotation.x = 0.06; g.add(pr);
      var fascia = box(9.8, 0.3, 0.08, trim); fascia.position.set(1.9, 3.74, 3.02); g.add(fascia);
      var rail = box(8.7, 0.08, 0.08, trim); rail.position.set(2.1, 1.4, 2.62); g.add(rail);
      var bl = [];
      for (var bx = -2.5; bx <= 6.4; bx += 0.22) if (Math.abs(bx) > 0.9) bl.push(bx);
      var balI = egg2_inst(unit, trimI, bl.length);
      bl.forEach(function (bx2, i) { balI.setMatrixAt(i, egg2_mat(bx2, 0.95, 2.62, 0, 0, 0, 0.06, 0.9, 0.06)); });
      g.add(balI);
      for (k = 0; k < 3; k++) { var stp = box(2.0, 0.16, 0.36, deckM); stp.position.set(0, 0.08 + k * 0.16, 3.4 - k * 0.34); g.add(stp); }
      // the cupola, on its own timber tower behind the cornice
      var cup = box(2.3, 2.4, 2.3, paint); cup.position.set(0, 13.1, -1.2); g.add(cup);
      [-0.55, 0.55].forEach(function (x2) {
        var cw = box(0.5, 1.2, 0.05, glass); cw.position.set(x2, 13.2, -0.03); g.add(cw);
        var ct = box(0.66, 1.36, 0.03, trim); ct.position.set(x2, 13.2, -0.04); g.add(ct);
      });
      var cbd = box(2.6, 0.22, 2.6, trim); cbd.position.set(0, 14.35, -1.2); g.add(cbd);
      var cr2 = new THREE.Mesh(new THREE.ConeBufferGeometry(2.1, 1.9, 4), slate); cr2.rotation.y = Math.PI / 4; cr2.position.set(0, 15.4, -1.2); g.add(cr2);
      var fin = cyl(0.03, 0.06, 1.2, 6, std('#2A2A2A', 0.6, 0.5)); fin.position.set(0, 16.9, -1.2); g.add(fin);
      [[-0.9, -0.5], [0.9, -0.5], [-0.9, -2.1], [0.9, -2.1]].forEach(function (q) { var tw = box(0.2, 11.9, 0.2, timber); tw.position.set(q[0], 5.95, q[1]); g.add(tw); });
      // peeled paint, showing grey wood
      var peelM = std('#9A8E7E', 1);
      for (k = 0; k < 9; k++) {
        var pp = box(rf(r, 0.4, 1.4), rf(r, 0.2, 0.9), 0.01, peelM);
        pp.position.set(rf(r, -6, 6), rf(r, 0.8, 9.5), 0.005);
        if (Math.abs(pp.position.x + 4.4) < 1.6 && pp.position.y < 7) pp.position.x += 3.2;
        g.add(pp);
      }
      // the timber braces that hold it up from behind
      [-5.8, -3.0, -0.4, 2.2, 4.8, 6.1].forEach(function (x3, i) {
        var hi = i % 2 ? 9.2 : 6.5, run = hi * 0.72, len = Math.sqrt(hi * hi + run * run);
        var b1 = box(0.22, len, 0.22, timber); b1.position.set(x3, hi / 2, -0.42 - run / 2); b1.rotation.x = Math.atan2(run, hi); g.add(b1);
        var stk = box(0.3, 0.5, 0.3, timber); stk.position.set(x3, 0.15, -0.42 - run); g.add(stk);
      });
      [2.5, 6.0, 9.4].forEach(function (y) { var wl = box(13, 0.22, 0.14, timber); wl.position.set(0, y, -0.38); g.add(wl); });
      for (var v = -6; v <= 6; v += 1.5) { var stud = box(0.12, 11.4, 0.12, timber); stud.position.set(v, 5.7, -0.36); g.add(stud); }
      g.position.set(p.x, p.y - 0.15, p.z); W.face(g); g.rotation.y += rf(r, -0.3, 0.3);
      shade(g); W.add(g);
      var sh2 = blobShadow(16, 12, 0.35); sh2.position.set(0, 0.17, -2.5); g.add(sh2);
    },

    'Vintage Trailer': function (W) {
      var p = egg2_spot(W, 4.6, 14, 28, W.cam.dist * 1.0, W.cam.dist * 2.2);
      if (!p) return;
      var r = W.r, g = new THREE.Group(), T = egg2_TR, i, j, k;
      var NS = 56, NT = 48, pos = [], uv = [], idx = [], P = new THREE.Vector3();
      for (i = 0; i <= NS; i++) for (j = 0; j <= NT; j++) {
        egg2_trailerPt(i / NS, -Math.PI / 2 + j / NT * Math.PI * 2, P);
        pos.push(P.x, P.y, P.z); uv.push(i / NS, j / NT);
      }
      for (i = 0; i < NS; i++) for (j = 0; j < NT; j++) { var a = i * (NT + 1) + j, b = (i + 1) * (NT + 1) + j; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      var bgeo = new THREE.BufferGeometry();
      bgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bgeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      bgeo.setIndex(idx); bgeo.computeVertexNormals();
      var skin = canvasTex(1024, 512, function (gc, w, h) {
        gc.fillStyle = '#D9DDE1'; gc.fillRect(0, 0, w, h);
        for (var q = 0; q < 40; q++) { gc.fillStyle = 'rgba(255,255,255,' + (0.03 + (q % 5) * 0.012) + ')'; gc.fillRect((q * 131) % w, 0, 18 + (q % 4) * 9, h); }
        gc.fillStyle = '#8D9399';
        for (var sx = 0; sx <= 12; sx++) {
          var xx = sx / 12 * w; gc.fillRect(xx - 1.5, 0, 3, h);
          for (var ry = 4; ry < h; ry += 9) { gc.beginPath(); gc.arc(xx + 5, ry, 1.6, 0, 6.2832); gc.fill(); }
        }
        [0.16, 0.34, 0.5, 0.66, 0.84].forEach(function (v) { gc.fillRect(0, v * h - 1.5, w, 3); for (var rx = 3; rx < w; rx += 9) { gc.beginPath(); gc.arc(rx, v * h + 5, 1.6, 0, 6.2832); gc.fill(); } });
      });
      var alu = new THREE.MeshStandardMaterial({ map: skin, color: C('#FFFFFF'), roughness: 0.3, metalness: 1 });
      g.add(new THREE.Mesh(bgeo, alu));
      // windows and a door that follow the curve of the skin
      var winM = W.glow(new THREE.MeshStandardMaterial({ color: C('#1C2229'), roughness: 0.12, metalness: 0.4, emissive: C('#FFB36B'), emissiveIntensity: 0 }), 0, 0.85);
      var frameM = std('#7E848A', 0.35, 0.9);
      [[0.2, 0.3, 0.12, 0.62], [0.36, 0.46, 0.12, 0.62], [0.74, 0.86, 0.12, 0.62], [0.2, 0.3, 0.12 + Math.PI, 0.62 + Math.PI], [0.5, 0.64, 0.12 + Math.PI, 0.62 + Math.PI]].forEach(function (q) {
        g.add(new THREE.Mesh(egg2_patch(q[0] - 0.006, q[1] + 0.006, q[2] - 0.05, q[3] + 0.05, 0.008, 6, 6), frameM));
        g.add(new THREE.Mesh(egg2_patch(q[0], q[1], q[2], q[3], 0.016, 6, 6), winM));
      });
      g.add(new THREE.Mesh(egg2_patch(0.955, 0.99, 0.55, 2.59, 0.012, 4, 10), winM));
      g.add(new THREE.Mesh(egg2_patch(0.55, 0.65, -0.5, 0.58, 0.01, 6, 10), std('#A7ADB3', 0.35, 0.9)));
      g.add(new THREE.Mesh(egg2_patch(0.575, 0.625, 0.18, 0.46, 0.016, 4, 4), winM));
      var hnd = box(0.03, 0.08, 0.04, std('#2A2A2A', 0.5)); egg2_trailerPt(0.635, 0.02, hnd.position); hnd.position.z += 0.03; g.add(hnd);
      var doorX = egg2_trailerPt(0.6, 0).x;
      var step = box(0.6, 0.06, 0.35, std('#3A3C40', 0.6, 0.6)); step.position.set(doorX, 0.32, T.a + 0.18); g.add(step);
      // chassis, wheels, tongue, propane
      var darkM = std('#1B1C1E', 0.7, 0.3), tire = std('#161616', 0.9), hub = std('#D4D8DC', 0.2, 1);
      var ch = box(T.L * 0.72, 0.18, 1.9, darkM); ch.position.set(0, 0.42, 0); g.add(ch);
      [-0.25, 0.5].forEach(function (x) {
        [-1, 1].forEach(function (sd) {
          var tr = cyl(0.33, 0.33, 0.2, 18, tire); tr.rotation.x = Math.PI / 2; tr.position.set(x, 0.33, sd * 1.0); g.add(tr);
          var hc = cyl(0.19, 0.19, 0.21, 16, hub); hc.rotation.x = Math.PI / 2; hc.position.set(x, 0.33, sd * 1.005); g.add(hc);
        });
      });
      [-1, 1].forEach(function (sd) { var tg = cyl(0.04, 0.04, 1.75, 6, darkM); tg.rotation.z = Math.PI / 2; tg.rotation.y = sd * 0.4; tg.position.set(T.L / 2 + 0.55, 0.45, sd * 0.33); g.add(tg); });
      var cpl = box(0.3, 0.12, 0.14, darkM); cpl.position.set(T.L / 2 + 1.4, 0.45, 0); g.add(cpl);
      var jack = cyl(0.04, 0.04, 0.45, 8, darkM); jack.position.set(T.L / 2 + 1.1, 0.22, 0); g.add(jack);
      [-0.2, 0.2].forEach(function (z) {
        var tank = cyl(0.15, 0.15, 0.45, 16, std('#EEEDE8', 0.4)); tank.position.set(T.L / 2 + 0.7, 0.78, z); g.add(tank);
        var dome = sph(0.15, tank.material, 16, 8); dome.scale.y = 0.5; dome.position.set(T.L / 2 + 0.7, 1.0, z); g.add(dome);
      });
      // the awning, its poles, a chair
      var stripe = pick(r, [['#2E6FB5', '#F2EEE3'], ['#C8413A', '#F2EEE3'], ['#1F8A7A', '#F2EEE3'], ['#E0A021', '#F2EEE3']]);
      var awT = canvasTex(256, 64, function (gc) { for (var q = 0; q < 8; q++) { gc.fillStyle = stripe[q % 2]; gc.fillRect(q * 32, 0, 32, 64); } });
      var aw = new THREE.Mesh(new THREE.PlaneBufferGeometry(3.4, 2.1), std('#FFFFFF', 0.85, 0, { map: awT, side: THREE.DoubleSide }));
      var ax = doorX - 0.2, ayTop = 2.35, azIn = egg2_trailerPt(0.6, 0.6).z;
      aw.position.set(ax, ayTop - 0.18, azIn + 1.02); aw.rotation.x = -Math.PI / 2 + 0.17; g.add(aw);
      [-1, 1].forEach(function (sd) { var ap = cyl(0.02, 0.02, 2.0, 6, frameM); ap.position.set(ax + sd * 1.65, 1.0, azIn + 2.0); g.add(ap); });
      var valT = canvasTex(256, 32, function (gc) { for (var q = 0; q < 16; q++) { gc.fillStyle = stripe[q % 2]; gc.beginPath(); gc.moveTo(q * 16, 0); gc.lineTo(q * 16 + 16, 0); gc.lineTo(q * 16 + 16, 18); gc.arc(q * 16 + 8, 18, 8, 0, Math.PI); gc.fill(); } });
      var val = new THREE.Mesh(new THREE.PlaneBufferGeometry(3.4, 0.2), std('#FFFFFF', 0.85, 0, { map: valT, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3 }));
      val.position.set(ax, ayTop - 0.44, azIn + 2.05); g.add(val);
      var chair = egg2_foldChair(std('#2B2D31', 0.45, 0.7), std(pick(r, ['#D9A21B', '#2E6FB5', '#B23A48', '#1F8A7A']), 0.5, 0.1));
      chair.position.set(ax + 0.7, 0, azIn + 1.5); chair.rotation.y = rf(r, -0.6, 0.2); g.add(chair);
      var rug = box(0.9, 0.012, 0.55, std('#6B4E3A', 1)); rug.position.set(doorX, 0.006, T.a + 0.6); g.add(rug);
      // string lights: along the awning edge and out to a pole
      var poleX = ax - 3.4, poleZ = azIn + 3.2, lpole = cyl(0.035, 0.045, 2.6, 6, mtl('#6B5A45', 'wood', 1, 0, 0.6)); lpole.position.set(poleX, 1.3, poleZ); g.add(lpole);
      var bulbPts = [], wirePts = [], A = new THREE.Vector3(ax + 1.65, 1.97, azIn + 2.06), B = new THREE.Vector3(ax - 1.65, 1.97, azIn + 2.06), Cc = new THREE.Vector3(poleX, 2.55, poleZ);
      [[A, B, 10, 0.12], [B, Cc, 9, 0.35]].forEach(function (q) {
        for (k = 0; k <= 16; k++) { var t = k / 16, pt = q[0].clone().lerp(q[1], t); pt.y -= Math.sin(t * Math.PI) * q[3]; wirePts.push(pt); }
        for (k = 0; k < q[2]; k++) { var t2 = (k + 0.5) / q[2], pb = q[0].clone().lerp(q[1], t2); pb.y -= Math.sin(t2 * Math.PI) * q[3] + 0.06; bulbPts.push(pb); }
      });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: C('#2A2622') })));
      var bulbM = W.glow(glowMat('#FFC98A', 0.25), 0.25, 1.9), bulbs = egg2_inst(new THREE.SphereBufferGeometry(0.05, 8, 6), bulbM, bulbPts.length);
      bulbPts.forEach(function (q, n) { bulbs.setMatrixAt(n, egg2_mat(q.x, q.y, q.z)); });
      g.add(bulbs);
      g.position.copy(p); W.face(g); g.rotation.y += rf(r, -0.55, 0.35); shade(g); W.add(g);
      g.add(blobShadow(8.5, 3.6, 0.38));
      g.updateMatrixWorld(true);
      W.lamp('#FFB870', 1.4, 11, g.localToWorld(new THREE.Vector3(ax, 1.9, azIn + 1.4)));
    },

    'Pronghorn': function (W) {
      if (W.court) return;                                     // the walls would hide them
      if (!W.groundAt && !egg2_flatKnown(W)) return;           // they need ground they can walk on
      var c0 = egg2_spot(W, 5, 4, 20, Math.max(28, W.cam.dist * 2), Math.max(46, W.cam.dist * 3.4));
      if (!c0) return;
      var r = W.r, hs = seedRng(W.P.seed + 211), n = ri(r, 3, 7), animals = [];
      var M = { tan: std('#B98450', 0.85), white: std('#F1ECE2', 0.85), black: std('#141210', 0.5), leg: std('#C9A27A', 0.85) };
      var herd = { c: c0.clone(), to: null, state: 'graze', timer: rf(hs, 14, 30), speed: 0, dA: Math.max(26, W.cam.dist * 1.8), dB: Math.max(50, W.cam.dist * 3.6) };
      for (var i = 0; i < n; i++) {
        var ph = egg2_pronghorn(i === 0 || (i === 3 && r() < 0.5), M), off = new THREE.Vector3(rf(r, -4, 4), 0, rf(r, -3.5, 3.5));
        ph.g.position.copy(c0).add(off); ph.g.rotation.y = r() * 6.28;
        ph.g.add(blobShadow(0.7, 1.5, 0.3));
        W.add(ph.g);
        var an = { a: ph, off: off, speed: 0, yaw: ph.g.rotation.y, legPh: r() * 6.28, neck: r() < 0.65 ? 1.25 : 0, alert: 0, look: rf(hs, 2, 12) };
        ph.neck.rotation.x = an.neck;
        animals.push(an);
      }
      var d = new THREE.Vector3();
      W.onUpdate(function (ctx) {
        var dt = Math.min(ctx.dt, 0.1);
        herd.timer -= dt;
        if (herd.state === 'graze' && herd.timer <= 0) {
          var cur = herd.c.clone().sub(W.cam.pos), side = cur.x * W.cam.right.x + cur.z * W.cam.right.z > 0 ? -1 : 1;
          herd.to = W.inView(rf(hs, 6, 22) * side, rf(hs, herd.dA, herd.dB));
          herd.state = 'trot'; herd.speed = rf(hs, 4.5, 8.5);
          animals.forEach(function (q) { q.off.set(rf(hs, -3, 3), 0, rf(hs, -2.5, 2.5)); });
        }
        if (herd.state === 'trot') {
          d.copy(herd.to).sub(herd.c); var L = d.length();
          if (L < 0.5) { herd.state = 'graze'; herd.timer = rf(hs, 20, 55); }
          else herd.c.addScaledVector(d, Math.min(1, herd.speed * dt / L));
        }
        animals.forEach(function (q) {
          var g = q.a.g;
          d.copy(herd.c).add(q.off).sub(g.position); d.y = 0;
          var L2 = d.length(), want = L2 > 0.35 ? Math.min(L2 * 1.4, herd.state === 'trot' ? herd.speed * 1.15 : 0.7) : 0;
          q.speed += (want - q.speed) * Math.min(1, dt * 2.5);
          if (L2 > 0.01 && q.speed > 0.02) {
            g.position.addScaledVector(d, Math.min(1, q.speed * dt / L2));
            var ty = Math.atan2(d.x, d.z), dy = ((ty - q.yaw + 9.42478) % 6.28318) - 3.14159;
            q.yaw += dy * Math.min(1, dt * 3);
            g.rotation.y = q.yaw;
          }
          q.look -= dt;
          if (q.look <= 0) { q.alert = q.alert ? 0 : 1; q.look = q.alert ? rf(hs, 1.5, 4) : rf(hs, 4, 14); }
          var nk = herd.state === 'graze' && q.speed < 0.3 && !q.alert ? 1.25 : 0;
          q.neck += (nk - q.neck) * Math.min(1, dt * 2);
          q.a.neck.rotation.x = q.neck + (q.neck > 0.8 ? Math.sin(ctx.real * 2.2 + q.legPh) * 0.06 : 0);
          var amp = clamp(q.speed / 3, 0, 1) * 0.6;
          q.legPh += dt * (2 + q.speed * 2.6);
          var sv = Math.sin(q.legPh) * amp;
          q.a.legs[0].rotation.x = sv; q.a.legs[3].rotation.x = sv; q.a.legs[1].rotation.x = -sv; q.a.legs[2].rotation.x = -sv;
          g.position.y = egg2_groundY(W, g.position.x, g.position.z) + Math.abs(Math.cos(q.legPh)) * 0.05 * amp;
        });
      });
    },

    'Freight Train': function (W) {
      if (W.court && W.court.interior) return;                 // nothing to see from inside
      var r = W.r, cam = W.cam, T = null, B = null, s, q, i, k, lo, hi;
      for (var tr = 0; tr < 14 && !T; tr++) {
        var d0 = rf(r, 120, 300), t0 = cam.right.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rf(r, -0.14, 0.14));
        var b0 = new THREE.Vector3(cam.pos.x + cam.dir.x * d0, 0, cam.pos.z + cam.dir.z * d0), ok = true;
        for (s = -280; s <= 280 && ok; s += 20) { q = b0.clone().addScaledVector(t0, s); if (!W.free(q.x, q.z, 5)) ok = false; }
        // and a line across fairly level ground (a summit falls away too fast)
        for (s = -300, lo = 1e9, hi = -1e9; s <= 300 && ok; s += 60) { q = b0.clone().addScaledVector(t0, s); var gq = egg2_groundY(W, q.x, q.z); lo = Math.min(lo, gq); hi = Math.max(hi, gq); }
        if (ok && hi - lo > 25) ok = false;
        if (ok) { T = t0; B = b0; }
      }
      if (!T) return;
      for (s = -300; s <= 300; s += 20) { q = B.clone().addScaledVector(T, s); W.claim(q.x, q.z, 5); }
      var N = new THREE.Vector3(-T.z, 0, T.x);
      if (N.x * cam.dir.x + N.z * cam.dir.z < 0) N.negate();       // N points away from the camera
      // the ground under the line, and a raised bed that follows it gently
      var LH = 1600, ST = 10, NS = LH * 2 / ST + 1, gy = [], top = [];
      // the formula is cheap, so sample every station; other terrain is sampled
      // every 40 m (a ray each) and filled in between
      var every = egg2_flatKnown(W) ? 1 : 4, coarse = [];
      for (i = 0; i < NS; i += every) { q = B.clone().addScaledVector(T, -LH + i * ST); coarse[i] = egg2_groundY(W, q.x, q.z); }
      for (i = 0; i < NS; i++) { var i0 = Math.floor(i / every) * every, i1 = Math.min(i0 + every, NS - 1); gy.push(i1 === i0 || coarse[i1] === undefined ? coarse[i0] : lerp(coarse[i0], coarse[i1], (i - i0) / (i1 - i0))); }
      function smooth(a, rad) {
        var o = [];
        for (var i2 = 0; i2 < a.length; i2++) { var sum = 0, cnt = 0; for (var j2 = Math.max(0, i2 - rad); j2 <= Math.min(a.length - 1, i2 + rad); j2++) { sum += a[j2]; cnt++; } o.push(sum / cnt); }
        return o;
      }
      var sm = smooth(gy, 6);
      for (i = 0; i < NS; i++) top.push(Math.max(sm[i] + 1.2, gy[i] + 0.7));
      top = smooth(smooth(top, 4), 4);
      function hAt(ss) { var f = (ss + LH) / ST, i2 = clamp(Math.floor(f), 0, NS - 2); return lerp(top[i2], top[i2 + 1], clamp(f - i2, 0, 1)); }
      var bedPos = [], bedIdx = [], tiePos = [], tieUv = [], tieIdx = [];
      for (i = 0; i < NS; i++) {
        s = -LH + i * ST; q = B.clone().addScaledVector(T, s);
        [[-4.6, gy[i] - 0.6], [-1.9, top[i]], [1.9, top[i]], [4.6, gy[i] - 0.6]].forEach(function (v) { bedPos.push(q.x + N.x * v[0], v[1], q.z + N.z * v[0]); });
        [-1.45, 1.45].forEach(function (u, j) { tiePos.push(q.x + N.x * u, top[i] + 0.02, q.z + N.z * u); tieUv.push(j, s / 0.65); });
        if (i < NS - 1) {
          for (k = 0; k < 3; k++) { var a = i * 4 + k, b = (i + 1) * 4 + k; bedIdx.push(a, a + 1, b, a + 1, b + 1, b); }
          var a2 = i * 2, b2 = (i + 1) * 2; tieIdx.push(a2, a2 + 1, b2, a2 + 1, b2 + 1, b2);
        }
      }
      var bedGeo = new THREE.BufferGeometry();
      bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(bedPos, 3)); bedGeo.setIndex(bedIdx); bedGeo.computeVertexNormals();
      var bed = new THREE.Mesh(bedGeo, std('#8A8176', 1, 0, { tex: 'stone', tile: 0.8, side: THREE.DoubleSide })); bed.receiveShadow = true; bed.frustumCulled = false; W.add(bed);
      var tieTex = canvasTex(32, 64, function (gc) {
        gc.fillStyle = '#6F685F'; gc.fillRect(0, 0, 32, 64);
        var rr = seedRng(77);
        for (var n2 = 0; n2 < 300; n2++) { var v2 = 80 + rr() * 60 | 0; gc.fillStyle = 'rgb(' + v2 + ',' + (v2 - 4) + ',' + (v2 - 10) + ')'; gc.fillRect(rr() * 32, rr() * 64, 1.5, 1.5); }
        gc.fillStyle = '#3E3128'; gc.fillRect(2, 20, 28, 24);
      }, { repeat: [1, 1] });
      var tieGeo = new THREE.BufferGeometry();
      tieGeo.setAttribute('position', new THREE.Float32BufferAttribute(tiePos, 3)); tieGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tieUv, 2));
      tieGeo.setIndex(tieIdx); tieGeo.computeVertexNormals();
      var ties = new THREE.Mesh(tieGeo, std('#FFFFFF', 0.95, 0, { map: tieTex, side: THREE.DoubleSide })); ties.frustumCulled = false; W.add(ties);
      var yaw0 = Math.atan2(-T.z, T.x), unitBox = new THREE.BoxBufferGeometry(1, 1, 1), nSeg = LH * 2 / 20;
      var rails = egg2_inst(unitBox, std('#6E655C', 0.45, 0.7), nSeg * 2);
      for (i = 0; i < nSeg; i++) {
        var s0 = -LH + i * 20, h0 = hAt(s0), h1 = hAt(s0 + 20), mid = B.clone().addScaledVector(T, s0 + 10), pitch = Math.atan2(h1 - h0, 20);
        [-0.72, 0.72].forEach(function (u, j) {
          rails.setMatrixAt(i * 2 + j, egg2_mat(mid.x + N.x * u, (h0 + h1) / 2 + 0.1, mid.z + N.z * u, 0, yaw0, pitch, 20.03, 0.16, 0.08, 'YXZ'));
        });
      }
      W.add(rails);
      // telegraph poles on the far side
      var poleGeo = new THREE.CylinderBufferGeometry(1, 1, 1, 6); poleGeo.translate(0, 0.5, 0);
      var nPole = Math.floor(LH * 2 / 55), poleM = mtl('#5B4B3B', 'wood', 1, 0, 1.2), poles = egg2_inst(poleGeo, poleM, nPole), arms = egg2_inst(unitBox, poleM, nPole), tops = [];
      for (i = 0; i < nPole; i++) {
        s = -LH + 20 + i * 55; q = B.clone().addScaledVector(T, s).addScaledVector(N, 7);
        var gh = (egg2_flatKnown(W) ? egg2_groundY(W, q.x, q.z) : gy[clamp(Math.round((s + LH) / ST), 0, NS - 1)]) - 0.2;
        poles.setMatrixAt(i, egg2_mat(q.x, gh, q.z, 0, 0, 0, 0.13, 8.4, 0.13));
        arms.setMatrixAt(i, egg2_mat(q.x, gh + 8.0, q.z, 0, yaw0, 0, 0.12, 0.12, 1.9, 'YXZ'));
        tops.push(new THREE.Vector3(q.x, gh + 8.0, q.z));
      }
      W.add(poles); W.add(arms);
      var wm = new THREE.LineBasicMaterial({ color: C('#2A2622') });
      [-0.8, 0.8].forEach(function (u) {
        var pts = [];
        for (var i2 = 0; i2 < tops.length - 1; i2++) for (var k2 = 0; k2 < 8; k2++) {
          var t2 = k2 / 8, pt = tops[i2].clone().lerp(tops[i2 + 1], t2);
          pt.y -= Math.sin(t2 * Math.PI) * 0.7; pts.push(pt.addScaledVector(N, u));
        }
        W.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wm));
      });
      // the consist: one or two locomotives, then boxcars, hoppers, tank cars, gondolas
      var parts = {}, units = [];
      function ptype(key, geo, mat) { parts[key] = { geo: geo, mat: mat, list: [] }; }
      var cylG = new THREE.CylinderBufferGeometry(1, 1, 1, 16), coneG = new THREE.ConeBufferGeometry(1, 1, 4), sphG = new THREE.SphereBufferGeometry(1, 14, 10);
      var ribs = canvasTex(512, 128, function (gc, w, h) {
        gc.fillStyle = '#FFFFFF'; gc.fillRect(0, 0, w, h);
        for (var x2 = 6; x2 < w; x2 += 16) { gc.fillStyle = 'rgba(0,0,0,0.18)'; gc.fillRect(x2, 0, 3, h); gc.fillStyle = 'rgba(255,255,255,0.5)'; gc.fillRect(x2 + 3, 0, 1, h); }
        var gr = gc.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.35)');
        gc.fillStyle = gr; gc.fillRect(0, 0, w, h);
      });
      ptype('box', unitBox, std('#FFFFFF', 0.8, 0.15)); ptype('rib', unitBox, std('#FFFFFF', 0.85, 0.1, { map: ribs }));
      ptype('cyl', cylG, std('#FFFFFF', 0.6, 0.25)); ptype('cone', coneG, std('#FFFFFF', 0.8, 0.15)); ptype('sph', sphG, std('#FFFFFF', 0.6, 0.25));
      function put(u, key, x, y, z, sx, sy, sz, col, rx, ry, rz) { var e = { m: egg2_mat(x, y, z, rx, ry, rz, sx, sy, sz), col: C(col), key: key }; parts[key].list.push(e); u.parts.push(e); }
      function shadeHex(hex, f) { return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString(); }
      var DARK = '#26221F', WHEEL = '#1E1C1A';
      function truck(u, x, axles) {
        put(u, 'box', x, 0.5, 0, axles === 3 ? 3.8 : 2.6, 0.45, 2.3, DARK);
        for (var ax = 0; ax < axles; ax++) {
          var xx = x + (ax - (axles - 1) / 2) * 1.5;
          put(u, 'cyl', xx, 0.46, -0.72, 0.46, 0.12, 0.46, WHEEL, Math.PI / 2, 0, 0);
          put(u, 'cyl', xx, 0.46, 0.72, 0.46, 0.12, 0.46, WHEEL, Math.PI / 2, 0, 0);
        }
      }
      var COLS = { box: ['#7A2E1F', '#5B3A29', '#2F4F6F', '#C9A227', '#3F5F3A', '#8C8C84'], hop: ['#B9B6AE', '#D7D2C4', '#8F8B84', '#C4A884'], tank: ['#1E1E1E', '#2B2B2B', '#D9D9D4', '#6E6E6A'], gon: ['#3B3B3B', '#5A3A2A', '#2E3B2E'] };
      var LEN = { loco: 21.4, box: 15.8, hop: 16.4, tank: 17.4, gon: 15.6 };
      var scheme = pick(r, [['#2C3E57', '#E0B000'], ['#6E1F1F', '#E8E2D0'], ['#2A2A2A', '#D94F1E'], ['#3E5641', '#E8C547']]);
      var build = {
        loco: function (u) {
          var L = LEN.loco, c = scheme[0], st = scheme[1];
          truck(u, -7, 3); truck(u, 7, 3);
          put(u, 'box', 0, 1.45, 0, L, 0.45, 3.1, DARK); put(u, 'box', 0, 1.62, 0, L + 0.02, 0.18, 3.12, st);
          put(u, 'box', -3.4, 3.0, 0, 12.8, 2.6, 2.3, c); put(u, 'box', 4.6, 3.35, 0, 3.3, 3.3, 3.1, c); put(u, 'box', 4.6, 5.05, 0, 3.4, 0.14, 3.15, '#3A3A3A');
          put(u, 'box', 7.7, 2.65, 0, 2.8, 1.9, 2.5, c); put(u, 'box', 6.27, 4.35, 0, 0.05, 0.9, 2.6, '#10161C'); put(u, 'box', 4.8, 4.3, 0, 1.2, 0.8, 3.12, '#10161C');
          put(u, 'box', -8.0, 4.45, 0, 2.5, 0.3, 2.0, DARK); put(u, 'box', -1.5, 4.45, 0, 3.0, 0.4, 2.2, c); put(u, 'box', 0.8, 4.45, 0, 0.5, 0.35, 0.3, DARK);
          put(u, 'cyl', -0.5, 0.95, 0, 0.75, 5.5, 0.75, DARK, 0, 0, Math.PI / 2);
          put(u, 'box', -3.0, 2.5, 0, 12.0, 0.05, 3.3, st); put(u, 'box', 9.1, 2.2, 0, 0.05, 0.9, 3.0, st);
        },
        box: function (u, col) {
          var L = LEN.box; truck(u, -(L / 2 - 2.2), 2); truck(u, L / 2 - 2.2, 2);
          put(u, 'box', 0, 1.05, 0, L - 0.4, 0.3, 2.8, DARK); put(u, 'rib', 0, 2.85, 0, L - 0.6, 3.3, 3.05, col);
          put(u, 'box', 0, 4.55, 0, L - 0.5, 0.14, 3.15, shadeHex(col, 0.8)); put(u, 'box', rf(r, -2, 2), 2.75, 0, 1.9, 2.9, 3.14, shadeHex(col, 0.72));
        },
        hop: function (u, col) {
          var L = LEN.hop; truck(u, -(L / 2 - 2.2), 2); truck(u, L / 2 - 2.2, 2);
          put(u, 'box', 0, 1.05, 0, L - 0.4, 0.35, 0.6, DARK); put(u, 'box', 0, 3.35, 0, L - 0.8, 2.4, 3.1, col);
          put(u, 'box', 0, 4.6, 0, L - 1, 0.12, 3.0, shadeHex(col, 0.9)); put(u, 'box', 0, 4.72, 0, L - 2, 0.12, 0.7, shadeHex(col, 0.7));
          [-L / 3.3, 0, L / 3.3].forEach(function (x) { put(u, 'cone', x, 1.5, 0, 1.6, 1.3, 1.6, col, Math.PI, Math.PI / 4, 0); });
        },
        tank: function (u, col) {
          var L = LEN.tank; truck(u, -(L / 2 - 2.2), 2); truck(u, L / 2 - 2.2, 2);
          put(u, 'box', 0, 1.05, 0, L, 0.3, 0.5, DARK); put(u, 'cyl', 0, 2.95, 0, 1.5, L - 1.4, 1.5, col, 0, 0, Math.PI / 2);
          put(u, 'sph', -(L - 1.4) / 2, 2.95, 0, 0.55, 1.5, 1.5, col); put(u, 'sph', (L - 1.4) / 2, 2.95, 0, 0.55, 1.5, 1.5, col);
          put(u, 'cyl', 0, 4.55, 0, 0.5, 0.4, 0.5, col); put(u, 'box', 0, 1.55, 0, 2.4, 0.08, 3.3, DARK);
        },
        gon: function (u, col) {
          var L = LEN.gon; truck(u, -(L / 2 - 2.2), 2); truck(u, L / 2 - 2.2, 2);
          put(u, 'box', 0, 1.05, 0, L - 0.4, 0.3, 2.8, DARK); put(u, 'box', 0, 1.3, 0, L - 0.4, 0.2, 3.0, col);
          put(u, 'box', 0, 2.1, -1.5, L - 0.4, 1.4, 0.1, col); put(u, 'box', 0, 2.1, 1.5, L - 0.4, 1.4, 0.1, col);
          put(u, 'box', -(L / 2 - 0.25), 2.1, 0, 0.1, 1.4, 3.0, col); put(u, 'box', L / 2 - 0.25, 2.1, 0, 0.1, 1.4, 3.0, col);
          put(u, 'box', 0, 2.35, 0, L - 1, 0.6, 2.8, '#6B4A33');
          for (var k2 = 0; k2 < 4; k2++) put(u, 'box', rf(r, -6, 6), 2.75, rf(r, -0.8, 0.8), rf(r, 1, 2.5), rf(r, 0.3, 0.6), rf(r, 0.8, 1.6), '#5E4636', 0, rf(r, 0, 3), rf(r, -0.3, 0.3));
        }
      };
      var off = 0, nLoco = r() < 0.4 ? 2 : 1, nCars = ri(r, 20, 40), consist = [];
      while (consist.length < nCars) {
        var ty = pickW(r, [['box', 4], ['hop', 3], ['tank', 3], ['gon', 1]]), base = pick(r, COLS[ty]), run = ri(r, 2, 7);
        for (k = 0; k < run; k++) consist.push([ty, shadeHex(base, rf(r, 0.82, 1.06))]);
      }
      consist.length = nCars;
      for (i = 0; i < nLoco; i++) consist.unshift(['loco', scheme[0]]);
      consist.forEach(function (cs) {
        var u = { parts: [], o: off + LEN[cs[0]] / 2 };
        build[cs[0]](u, cs[1]);
        off += LEN[cs[0]] + 1.1; units.push(u);
      });
      var trainLen = off, meshes = [];
      Object.keys(parts).forEach(function (key) {
        var pt = parts[key]; if (!pt.list.length) return;
        var im = egg2_inst(pt.geo, pt.mat, pt.list.length);
        pt.list.forEach(function (e, j) { e.idx = j; im.setColorAt(j, e.col); });
        im.receiveShadow = true;
        pt.mesh = im; meshes.push(im); W.add(im);
      });
      // the lead locomotive's lights and number
      var lead = new THREE.Group(); lead.matrixAutoUpdate = false; W.add(lead);
      var hlM = W.glow(glowMat('#FFF3D6', 0.25), 0.25, 2.8);
      var hl = box(0.06, 0.28, 0.55, hlM); hl.position.set(9.13, 3.45, 0); lead.add(hl);
      [-1.2, 1.2].forEach(function (z) { var dl = box(0.06, 0.18, 0.18, hlM); dl.position.set(10.72, 1.95, z); lead.add(dl); });
      [1, -1].forEach(function (sd) {
        var nb = textPlane('317', { bg: '#101010', color: '#FFFFFF', height: 0.42, px: 80, font: FONT_SANS, pad: 0.3 });
        nb.position.set(4.6, 3.1, sd * 1.56); if (sd < 0) nb.rotation.y = Math.PI; lead.add(nb);
      });
      var nf = textPlane('317', { bg: '#101010', color: '#FFFFFF', height: 0.3, px: 80, font: FONT_SANS, pad: 0.3 }); nf.position.set(9.12, 3.8, 0); nf.rotation.y = Math.PI / 2; lead.add(nf);
      var glare = egg2_glare('#FFF1D0', 4); glare.position.set(9.9, 3.45, 0); lead.add(glare);
      var ts = seedRng(W.P.seed + 1213), dirn = r() < 0.5 ? 1 : -1, speed = rf(r, 16, 23), wait = 0;
      var sHead = dirn * rf(r, -60, trainLen * 0.7);
      var m4 = new THREE.Matrix4(), mp = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
      function show(v) { meshes.forEach(function (m) { m.visible = v; }); lead.visible = v; }
      W.onUpdate(function (ctx) {
        var dt = Math.min(ctx.dt, 0.1);
        if (wait > 0) {
          wait -= dt;
          if (wait > 0) return;
          dirn = ts() < 0.5 ? 1 : -1; speed = rf(ts, 15, 24); sHead = -dirn * (LH - 60); show(true);
        }
        sHead += dirn * speed * dt;
        if ((sHead - dirn * trainLen) * dirn > LH - 60) { show(false); wait = rf(ts, 50, 200); return; }
        units.forEach(function (u, ui) {
          var sc = sHead - dirn * u.o, h = hAt(sc) + 0.25, sl = (hAt(sc + 4) - hAt(sc - 4)) / 8;
          pv.copy(B).addScaledVector(T, sc); pv.y = h;
          eu.set(0, yaw0 + (dirn < 0 ? Math.PI : 0), Math.atan(sl * dirn)); qt.setFromEuler(eu);
          m4.compose(pv, qt, one);
          if (ui === 0) { lead.matrix.copy(m4); lead.matrixWorldNeedsUpdate = true; }
          u.parts.forEach(function (e) { mp.multiplyMatrices(m4, e.m); parts[e.key].mesh.setMatrixAt(e.idx, mp); });
        });
        meshes.forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
        glare.material.opacity = ctx.night * 0.85;
      });
    },

    'Roadrunner': function (W) {
      var rr = egg2_roadrunner(), g = rr.g, rs = seedRng(W.P.seed + 1717), r = W.r;
      var sgn = r() < 0.5 ? 1 : -1;
      var st = { a: null, b: null, u: 0, len: 1, stops: [], mode: 'pause', t: rf(r, 3, 6) };
      // a line across the frame that misses the clock: in front of it when
      // there is room, behind it when the camera stands close
      var room = (W.cam.dist - (W.heroR || 3) - 1) / 0.72, dFront = room > 3, lo = dFront ? Math.max(2.5, room * 0.45) : (W.cam.dist + (W.heroR || 3) + 1.5) / 0.72, hi = dFront ? room : lo * 1.3;
      function newPath(q) {
        var d = rf(q, lo, hi);
        st.a = W.inView(-44 * sgn, d); st.b = W.inView(44 * sgn, d + rf(q, -1, 1));
        st.a.y = egg2_groundY(W, st.a.x, st.a.z); st.b.y = egg2_groundY(W, st.b.x, st.b.z);
        st.len = st.a.distanceTo(st.b); st.stops = [];
        // pause somewhere free, in frame
        for (var k = 0; k < 12 && st.stops.length < 2; k++) {
          var u = rf(q, 0.3, 0.72), pt = st.a.clone().lerp(st.b, u);
          if (egg2_clear(W, pt.x, pt.z, 0.4) && !egg2_blocked(W, pt, 0.3) && (!st.stops.length || Math.abs(u - st.stops[0]) > 0.12)) st.stops.push(u);
        }
        st.stops.sort(function (x, y) { return x - y; });
        sgn = -sgn;
      }
      newPath(r);
      if (!st.stops.length) st.stops.push(0.5);
      st.u = st.stops.shift() - 0.001;
      g.position.copy(st.a).lerp(st.b, st.u);
      g.add(blobShadow(0.35, 0.5, 0.3));
      W.add(g);
      var dir = new THREE.Vector3(), legPh = 0;
      W.onUpdate(function (ctx) {
        var dt = Math.min(ctx.dt, 0.1);
        if (st.mode === 'wait') {
          g.visible = false; st.t -= dt;
          if (st.t <= 0) { newPath(rs); st.u = 0; st.mode = 'run'; }
          return;
        }
        g.visible = true;
        dir.copy(st.b).sub(st.a).normalize();
        g.rotation.y = Math.atan2(dir.x, dir.z);
        if (st.mode === 'pause') {
          st.t -= dt;
          rr.head.rotation.x = Math.sin(ctx.real * 5) * 0.12 - 0.05; rr.head.rotation.y = Math.sin(ctx.real * 0.9) * 0.6;
          rr.tail.rotation.x = 0.55 + Math.sin(ctx.real * 2.6) * 0.18;
          rr.body.rotation.x = 0; rr.legs[0].rotation.x = 0; rr.legs[1].rotation.x = 0; rr.body.position.y = 0.21;
          if (st.t <= 0) st.mode = 'run';
        } else {
          st.u += 6.5 * dt / st.len;
          legPh += dt * 34;
          rr.legs[0].rotation.x = Math.sin(legPh) * 0.9; rr.legs[1].rotation.x = -Math.sin(legPh) * 0.9;
          rr.body.rotation.x = 0.28; rr.body.position.y = 0.2 + Math.abs(Math.sin(legPh)) * 0.015;
          rr.head.rotation.x = -0.2; rr.head.rotation.y = 0; rr.tail.rotation.x = 0.08;
          if (st.stops.length && st.u >= st.stops[0]) { st.stops.shift(); st.mode = 'pause'; st.t = rf(rs, 1.2, 3.5); }
          if (st.u >= 1) { st.mode = 'wait'; st.t = rf(rs, 14, 45); }
        }
        g.position.copy(st.a).lerp(st.b, clamp(st.u, 0, 1));
      });
    }
  };

  // register. `line` is what a visitor reads on a click.
  [
    ['Waiting Room', 7, 'STILL WAITING: a municipal waiting room the desert took back, flowers up through the chairs. Take a number. It is 317.'],
    ['Commute Sign', 7, 'THE COMMUTE: NYC transit as emotional weather. This platform is on time, delayed or suspended, and the hash decides which.'],
    ['Bloom Cycle', 7, 'BLOOM CYCLE: one flower lives a full year, bud, bloom, peak, wilt, frost and regrowth. It keeps the real season in Marfa.'],
    ['Dossier Cabinet', 6, 'THE SOFT CONSPIRACY, by MLow and Andres Del Vecchio, keeps its operative dossiers here. We do not worship the unseen. We maintain it.'],
    ['On Air', 6, 'The MLow Show is on air. Pull up a chair.'],
    ['Archetype Stack', 5, 'Stacked blocks with white edges, for Kjetil Golid’s Archetype.'],
    ['Meridian Painting', 5, 'Layered ridge lines on canvas, for Matt DesLauriers’s Meridian.'],
    ['Friendship Bracelets', 5, 'Woven bands tied to a fence post, for Alexis André’s Friendship Bracelets.'],
    ['Reata Facade', 6, 'The Reata mansion from Giant (1956), filmed outside Marfa. A three storey front with nothing behind it but braces.'],
    ['Vintage Trailer', 7, 'A polished aluminum trailer, parked for the residency. The windows light up after dark.'],
    ['Pronghorn', 8, 'Pronghorn, the fastest runners in North America, grazing the grassland outside Marfa.'],
    ['Freight Train', 8, 'A freight train crossing the high desert, as they do through Marfa day and night. Locomotive 317 leads.'],
    ['Roadrunner', 7, 'A roadrunner. It stops only to look back at you.']
  ].forEach(function (q) { defineEgg(q[0], { w: q[1], line: q[2], build: EGG2_BUILD[q[0]] }); });

  // ------------------------------------------------------------ life
  // Call from addLife: shooting stars, a dust devil when the sky is Dust or
  // the wind is Gusty, and pickups when there is a road.
  function egg2_life(W) {
    egg2_stars(W);
    if (W.P.sky === 'Dust' || W.P.wind === 'Gusty') egg2_dustDevil(W);
    if (W.road) egg2_pickups(W);
  }
  function egg2_stars(W) {
    var rs = seedRng(W.P.seed + 7171), tex = canvasTex(256, 16, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(220,235,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var gv = g.createLinearGradient(0, 0, 0, h); gv.addColorStop(0, 'rgba(0,0,0,1)'); gv.addColorStop(0.5, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = gv; g.fillRect(0, 0, w, h);
    });
    var mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(4, 4, 4.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 });
    var m = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), mat); m.visible = false; m.frustumCulled = false; m.matrixAutoUpdate = false; m.userData.egg2 = 'star';
    W.add(m);
    var next = rf(rs, 20, 60), star = null, fw = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    var X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), ctr = new THREE.Vector3(), sc = new THREE.Vector3();
    W.onUpdate(function (ctx) {
      if (!star) {
        m.visible = false;
        if (ctx.night < 0.8) return;
        next -= ctx.dt;
        if (next > 0) return;
        next = rf(rs, 20, 60);
        // start in the upper part of the frame, above the horizon, and fall across it
        var cam = ctx.camera, dir = new THREE.Vector3(rf(rs, -0.75, 0.75), rf(rs, 0.35, 0.9), 0.5).unproject(cam).sub(cam.position).normalize();
        if (dir.y < 0.07) { dir.y = rf(rs, 0.07, 0.2); dir.normalize(); }
        fw.set(1, 0, 0).applyQuaternion(cam.quaternion); fw.y = 0; fw.normalize();
        var dip = rf(rs, 0.35, 0.8), mv = fw.multiplyScalar((rs() < 0.5 ? 1 : -1) * Math.cos(dip)).add(up.clone().multiplyScalar(-Math.sin(dip))).normalize();
        star = { p: cam.position.clone().addScaledVector(dir, 2600), mv: mv, len: rf(rs, 600, 1000), dur: rf(rs, 0.6, 1.2), t: 0 };
      }
      star.t += ctx.dt;
      var u = star.t / star.dur;
      if (u >= 1) { star = null; m.visible = false; return; }
      var head = star.p.clone().addScaledVector(star.mv, star.len * u), tail = Math.min(u, 0.45) * star.len + 20;
      ctr.copy(head).addScaledVector(star.mv, -tail / 2);
      X.copy(star.mv); Z.copy(ctx.camera.position).sub(ctr).normalize(); Y.crossVectors(Z, X).normalize(); Z.crossVectors(X, Y);
      m.matrix.makeBasis(X, Y, Z).scale(sc.set(tail, 9, 1)).setPosition(ctr);
      m.matrixWorldNeedsUpdate = true;
      mat.opacity = Math.sin(Math.PI * u) * ctx.night;
      m.visible = true;
    });
  }
  function egg2_dustDevil(W) {
    var rs = seedRng(W.P.seed + 5151), n = 320;
    var mat = new THREE.MeshBasicMaterial({ map: egg2_glowTex(), color: C('#C9A77C'), transparent: true, depthWrite: false, opacity: 0.2 });
    var im = egg2_inst(new THREE.PlaneBufferGeometry(1, 1), mat, n); im.userData.egg2 = 'devil';
    W.add(im);
    var ps = [], Hc = rf(rs, 14, 26);
    for (var i = 0; i < n; i++) ps.push({ h: Math.pow(rs(), 1.6), a: rs() * 6.28, j: rf(rs, 0.7, 1.3), s: rf(rs, 0.6, 1.4) });
    var off0 = rf(rs, -16, 16), d0 = Math.max(40, W.cam.dist * 3) + rf(rs, 0, 40), ph = rs() * 6.28, base = new THREE.Vector3(), m4 = new THREE.Matrix4(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    var dc = C('#C9A77C'), dark = C('#2A2622'), p0 = W.inView(off0, d0), y0 = egg2_groundY(W, p0.x, p0.z);
    W.onUpdate(function (ctx) {
      var t = ctx.real, life = 0.55 + 0.45 * Math.sin(t * 0.045 + ph), vis = life * (1 - ctx.night);
      im.visible = vis > 0.03;
      if (!im.visible) return;
      base.copy(W.inView(off0 + Math.sin(t * 0.017 + ph) * 8, d0 + Math.sin(t * 0.011 + ph * 2) * 18));
      mat.opacity = 0.28 * vis;
      mat.color.copy(dark).lerp(dc, 1 - ctx.night * 0.8);
      var q = ctx.camera.quaternion;
      for (var i2 = 0; i2 < n; i2++) {
        var p = ps[i2];
        p.h += ctx.dt * 0.05 * p.j; if (p.h > 1) p.h -= 1;
        p.a += ctx.dt * (3.2 - 2.2 * p.h) * p.j;
        var rad = (0.5 + 4.2 * Math.pow(p.h, 1.5)) * p.j * life, y = p.h * Hc * life;
        v.set(base.x + Math.cos(p.a) * rad + W.windDir.x * p.h * 3, y0 + y + 0.3, base.z + Math.sin(p.a) * rad + W.windDir.z * p.h * 3);
        sc.setScalar((0.6 + 2.2 * p.h) * p.s);
        m4.compose(v, q, sc); im.setMatrixAt(i2, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }
  function egg2_pickup(W, col, rs) {
    var g = new THREE.Group(), paint = std(col, 0.45, 0.2), dark = std('#141517', 0.5, 0.3), glass = std('#1A222B', 0.08, 0.8), chrome = std('#C9CDD2', 0.25, 1);
    var lower = box(5.3, 0.62, 1.95, paint); lower.position.y = 0.78; g.add(lower);
    var cab = box(1.75, 0.66, 1.8, glass); cab.position.set(0.35, 1.42, 0); g.add(cab);
    var roof = box(1.6, 0.07, 1.82, paint); roof.position.set(0.3, 1.78, 0); g.add(roof);
    [1.2, -0.52].forEach(function (x) { var pil = box(0.1, 0.66, 1.84, paint); pil.position.set(x, 1.42, 0); g.add(pil); });
    [-1, 1].forEach(function (sd) { var wall = box(2.0, 0.42, 0.07, paint); wall.position.set(-1.6, 1.29, sd * 0.94); g.add(wall); });
    var tg = box(0.07, 0.42, 1.95, paint); tg.position.set(-2.62, 1.29, 0); g.add(tg);
    var bedF = box(2.0, 0.05, 1.8, dark); bedF.position.set(-1.6, 1.1, 0); g.add(bedF);
    [2.66, -2.66].forEach(function (x) { var bm = box(0.1, 0.2, 2.0, chrome); bm.position.set(x, 0.52, 0); g.add(bm); });
    var wheels = [];
    [[1.65, 0.9], [1.65, -0.9], [-1.55, 0.9], [-1.55, -0.9]].forEach(function (q) {
      var w = cyl(0.4, 0.4, 0.3, 16, dark); w.rotation.x = Math.PI / 2; w.position.set(q[0], 0.4, q[1]); g.add(w); wheels.push(w);
    });
    var hl = W.glow(glowMat('#FFF4DC', 0.3), 0.3, 3.0), tl = W.glow(glowMat('#FF2A1F', 0.5), 0.5, 2.2), glares = [];
    [0.66, -0.66].forEach(function (z) {
      var h = box(0.04, 0.16, 0.34, hl); h.position.set(2.66, 0.86, z); g.add(h);
      var t = box(0.04, 0.2, 0.18, tl); t.position.set(-2.66, 0.95, z); g.add(t);
      var gl = egg2_glare('#FFEFD2', 1.6); gl.position.set(2.85, 0.86, z); g.add(gl); glares.push(gl);
    });
    if (rs() < 0.6) { var bale = box(1.0, 0.45, 0.6, mtl('#CDB36A', 'wood', 1, 0, 0.3)); bale.position.set(-1.5, 1.35, 0); g.add(bale); }
    shade(g);
    return { g: g, glares: glares, spin: function (a) { wheels.forEach(function (w) { w.rotation.y -= a; }); } };
  }
  function egg2_pickups(W) {
    var rs = seedRng(W.P.seed + 9090), rd = W.road, n = rs() < 0.5 ? 1 : 2;
    for (var i = 0; i < n; i++) (function (i) {
      var t = egg2_pickup(W, pick(rs, ['#8E2B25', '#E8E6E0', '#B89B72', '#3E7C7B', '#1E1F22', '#5C6B7A']), rs), dirn = i ? -1 : (rs() < 0.5 ? 1 : -1);
      var lane = dirn * 1.9, speed = rf(rs, 24, 31), s = rf(rs, -600, 600), wait = 0;
      t.g.rotation.y = Math.atan2(-rd.along.z * dirn, rd.along.x * dirn); t.g.userData.egg2 = 'pickup';
      W.add(t.g);
      W.onUpdate(function (ctx) {
        var dt = Math.min(ctx.dt, 0.1);
        if (wait > 0) { wait -= dt; t.g.visible = false; return; }
        t.g.visible = true;
        s += speed * dt * dirn;
        if (Math.abs(s) > 700) { s = -700 * dirn; wait = rf(rs, 6, 45); speed = rf(rs, 24, 31); }
        t.g.position.copy(rd.center).addScaledVector(rd.along, s).addScaledVector(rd.across, lane);
        t.spin(speed * dt / 0.4);
        t.glares.forEach(function (gl) { gl.material.opacity = ctx.night * 0.9; });
      });
    })(i);
  }
