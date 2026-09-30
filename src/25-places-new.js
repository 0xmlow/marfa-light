  // =====================================================================
  // FIVE MORE PLACES, in the house language: Arsham x Hadid x Wright x Abloh
  //   Artillery Shed     Judd's converted sheds at Chinati, from inside
  //   Highland Avenue    downtown Marfa, the courthouse at the end of the street
  //   Observatory Ridge  a summit in the Davis Mountains, domes that open at night
  //   Hadid Pavilion     a field of white ribs sweeping over the clock
  //   Prairie Terrace    Wright: a low red roof, sandstone terraces, the desert
  // Everything here is prefixed plc_ because every src file shares one scope.
  // =====================================================================

  // two more procedural surfaces for the triplanar detail system
  DETAIL_KINDS.plc_brick = function (u, v) {
    var rows = 12, cols = 4, rv = v * rows, row = Math.floor(rv), fy = rv - row;
    var ru = u * cols + (row % 2) * 0.5, col = Math.floor(ru), fx = ru - col;
    var n = pfbm(u, v, 16, 132, 2), tone = hash2(col % cols, row, 131);
    if (fy < 0.15 || fx < 0.05) return [0.72 + (n - 0.5) * 0.12, 0.85, 0.22];
    return [0.34 + tone * 0.24 + (n - 0.5) * 0.2, 0.55 + (n - 0.5) * 0.3, 0.64 + (n - 0.5) * 0.25];
  };
  DETAIL_KINDS.plc_ashlar = function (u, v) {
    // Wright's raked sandstone: long low courses, deep horizontal joints
    var rows = 5, rv = v * rows, row = Math.floor(rv), fy = rv - row;
    var ru = u * 2 + hash2(row, 7, 141) * 2, col = Math.floor(ru), fx = ru - col;
    var n = pfbm(u, v, 8, 142, 3), tone = hash2(col % 2, row, 143);
    if (fy < 0.1) return [0.46, 0.8, 0.1];
    if (fx < 0.012) return [0.6, 0.7, 0.4];
    return [0.46 + tone * 0.16 + (n - 0.5) * 0.24, 0.6 + (n - 0.5) * 0.3, 0.6 + (n - 0.5) * 0.35];
  };

  // ------------------------------------------------------------ helpers
  // A frame that turns with the camera: local +z points at the camera, local
  // +x is the camera's right, local -z runs past the clock into the view.
  function plc_frame(W) {
    var c = W.cam, th = Math.atan2(c.pos.x, c.pos.z), cs = Math.cos(th), sn = Math.sin(th);
    var g = new THREE.Group(); g.rotation.y = th; W.add(g);
    return {
      g: g, th: th, D: c.dist, R: W.heroR, h: c.h, look: c.lookY,
      w: function (x, z, y) { return new THREE.Vector3(x * cs + z * sn, y || 0, -x * sn + z * cs); },
      claim: function (x, z, rad) { W.claim(x * cs + z * sn, -x * sn + z * cs, rad); },
      free: function (x, z, rad) { return W.free(x * cs + z * sn, -x * sn + z * cs, rad); },
      loc: function (wx, wz) { return [wx * cs - wz * sn, wx * sn + wz * cs]; },
      // cover a local rectangle with overlapping claims
      claimRect: function (x0, x1, z0, z1, rad) {
        rad = rad || 4;
        var st = rad * 1.2, nx = Math.max(1, Math.ceil((x1 - x0) / st)), nz = Math.max(1, Math.ceil((z1 - z0) / st));
        for (var i = 0; i <= nx; i++) for (var j = 0; j <= nz; j++) this.claim(lerp(x0, x1, i / nx), lerp(z0, z1, j / nz), rad);
      }
    };
  }
  function plc_m4(x, y, z, sx, sy, sz, rx, ry, rz) {
    var m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
    return m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
  }
  // an instancing kit: collect transforms per part, flush to one InstancedMesh each
  function plc_kit() {
    var K = {}, keys = [];
    var api = {
      def: function (key, geo, mat, o) { K[key] = { geo: geo, mat: mat, o: o || {}, m: [], c: [] }; keys.push(key); return api; },
      put: function (key, m4, col) { var k = K[key]; k.m.push(m4); k.c.push(col == null ? null : (typeof col === 'string' ? C(col) : col)); return m4; },
      box: function (key, x, y, z, sx, sy, sz, ry, col, parent) {
        var m = plc_m4(x, y, z, sx, sy, sz, 0, ry || 0, 0);
        if (parent) m.premultiply(parent);
        return api.put(key, m, col);
      },
      n: function (key) { return K[key].m.length; },
      flush: function (parent) {
        var white = new THREE.Color(1, 1, 1);
        keys.forEach(function (key) {
          var k = K[key], n = k.m.length;
          if (!n) return;
          var mesh = new THREE.InstancedMesh(k.geo, k.mat, n), hasC = k.c.some(function (c) { return !!c; });
          for (var i = 0; i < n; i++) { mesh.setMatrixAt(i, k.m[i]); if (hasC) mesh.setColorAt(i, k.c[i] || white); }
          if (hasC) mesh.instanceColor.needsUpdate = true;
          mesh.castShadow = k.o.cast !== false; mesh.receiveShadow = k.o.recv !== false; mesh.frustumCulled = false;
          if (k.o.order) mesh.renderOrder = k.o.order;
          parent.add(mesh); k.mesh = mesh;
        });
      }
    };
    return api;
  }
  function plc_tex(hex, kind, rough, metal, tile, albedo, bump) {
    return detail(std(hex, rough, metal), kind, { tile: tile, albedo: albedo, bump: bump });
  }
  function plc_glow(W, hex, day, night) { return W.glow(glowMat(hex, day), day, night); }
  // a parametric surface: fn(u, v, out) fills a Vector3
  function plc_param(fn, u0, u1, nu, v0, v1, nv) {
    var pos = [], idx = [], p = new THREE.Vector3();
    for (var j = 0; j <= nv; j++) for (var i = 0; i <= nu; i++) {
      fn(lerp(u0, u1, i / nu), lerp(v0, v1, j / nv), p); pos.push(p.x, p.y, p.z);
    }
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  // move what a call added onto a height field (instanced scatter, groups)
  function plc_drapeFrom(W, n0, hw) {
    var m = new THREE.Matrix4();
    for (var i = n0; i < W.root.children.length; i++) {
      var o = W.root.children[i];
      if (o.isInstancedMesh) {
        for (var k = 0; k < o.count; k++) {
          o.getMatrixAt(k, m); m.elements[13] += hw(m.elements[12], m.elements[14]); o.setMatrixAt(k, m);
        }
        o.instanceMatrix.needsUpdate = true;
      } else if (o.isGroup || o.isMesh) o.position.y += hw(o.position.x, o.position.z);
    }
  }
  function plc_scatter(W, opts, hw) {
    var n0 = W.root.children.length;
    commonScatter(W, opts);
    if (hw) plc_drapeFrom(W, n0, hw);
  }
  // Eggs and life are built after the place. W.groundAt(x, z) gives them the
  // terrain height in world metres; the spots they ask about are remembered.
  // A late pass then sets down anything that stood at y = 0 without asking
  // (older eggs, the tumbleweed, which re-positions itself every frame).
  function plc_drapeLate(W, hw) {
    var n0 = W.root.children.length, armed = false, asked = [];
    W.groundAt = function (x, z) { asked.push(x, z); return hw(x, z); };
    var handled = function (o) {
      for (var i = 0; i < asked.length; i += 2) { var dx = asked[i] - o.position.x, dz = asked[i + 1] - o.position.z; if (dx * dx + dz * dz < 36) return true; }
      return false;
    };
    W.onUpdate(function () {
      if (armed) return;
      armed = true;
      W.onUpdate(function () {
        for (var i = n0; i < W.root.children.length; i++) {
          var o = W.root.children[i];
          if (o.isLine || !(o.isMesh || o.isGroup || o.isSprite || o.isLight)) continue;
          if (o.userData.plcY === o.position.y) continue;
          if (o.userData.plcY === undefined && handled(o)) { o.userData.plcY = o.position.y; o.userData.plcSkip = true; continue; }
          if (o.userData.plcSkip) { o.userData.plcY = o.position.y; continue; }
          if (o.position.y < 60) o.position.y += hw(o.position.x, o.position.z);
          o.userData.plcY = o.position.y;
        }
      });
    });
  }
  function plc_label(text, bg, fg, h) {
    return textPlane(text, { bg: bg, color: fg, font: FONT_SANS, height: h, px: 80, pad: 0.3, spacing: 0.04 });
  }
  // the top of the clock in metres (buildWorld registers the clock as the first pick)
  function plc_heroTop(W) {
    var hero = null;
    (W.picks || []).forEach(function (p) { if (!hero && p.name === W.P.clock) hero = p.obj; });
    if (!hero) return 6;
    if (W.plcTop == null) { var b = new THREE.Box3().setFromObject(hero); W.plcTop = isFinite(b.max.y) ? b.max.y : 6; }
    return W.plcTop;
  }

  // =====================================================================
  // 1. ARTILLERY SHED
  // A brick shed with a vaulted galvanized roof, after the two artillery
  // sheds at Chinati where Donald Judd installed 100 untitled works in mill
  // aluminum. The long walls are almost all window, so the real sun walks
  // across the floor in window-shaped patches. The camera stands inside.
  // =====================================================================
  function plc_shed(W) {
    W.shadowExtent = 55;
    makeGround(W, '#AE976A');
    makeRidges(W, 3100, false, '#6F6A74'); makeRidges(W, 1300, true, '#8C7A62');
    var F = plc_frame(W), g = F.g, D = F.D, R = F.R, r = W.r;
    var HW = 13, T = 0.5, EH = 6, RS = 6.8, ySill = 0.95, yHead = 5.15;
    var zN = D * 2.2 + 6, zF = Math.max(48, 92 - zN), L = zN + zF, zc = (zN - zF) / 2;
    var Rc = (HW * HW + RS * RS) / (2 * RS), cy = EH + RS - Rc, al = Math.asin((HW + T / 2) / Rc);
    var nb = Math.round(L / 4.8), bay = L / nb, PW = 0.66;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    // r124 keeps the first program a material compiles, so instanced and
    // plain meshes never share a material
    var brick = plc_tex('#A56E57', 'plc_brick', 0.92, 0, 0.9, 0.55, 0.6), brickP = plc_tex('#A56E57', 'plc_brick', 0.92, 0, 0.9, 0.55, 0.6);
    var conc = mtl('#BDB6AA', 'concrete', 0.9, 0, 1.6);
    var steel = std('#33373B', 0.5, 0.75);
    var alu = mtl('#D8DCE1', 'brushed', 0.24, 0.95, 0.9);
    var kit = plc_kit()
      .def('brick', BOX, brick).def('conc', BOX, conc).def('steel', BOX, steel).def('alu', BOX, alu)
      .def('joint', BOX, std('#6F6A62', 0.9), { cast: false })
      .def('rib', new THREE.TorusBufferGeometry(Rc - 0.14, 0.07, 5, 56, 2 * al), steel)
      .def('rod', new THREE.CylinderBufferGeometry(0.025, 0.025, 1, 5), steel)
      .def('shade', new THREE.ConeBufferGeometry(0.42, 0.34, 18, 1, true), std('#2E3A33', 0.45, 0.4, { side: THREE.DoubleSide }))
      .def('bulb', new THREE.SphereBufferGeometry(0.13, 10, 8), plc_glow(W, '#FFE2B0', 0.1, 2.4), { cast: false });

    // floor: a concrete slab with saw-cut joints on the pier grid
    var floor = box(2 * HW, 0.1, L, mtl('#B2AB9E', 'concrete', 0.72, 0, 3.2));
    floor.position.set(0, -0.02, zc); floor.receiveShadow = true; g.add(floor);
    var j, k;
    for (j = 0; j <= nb; j++) kit.box('joint', 0, 0.032, zN - j * bay, 2 * HW - 0.4, 0.004, 0.02);
    [-6.5, 0, 6.5].forEach(function (x) { kit.box('joint', x, 0.032, zc, 0.02, 0.004, L); });

    // the long walls: brick sill, steel window grid, brick lintel, piers
    [-1, 1].forEach(function (s) {
      var x = s * HW;
      kit.box('brick', x, ySill / 2, zc, T, ySill, L);
      kit.box('conc', x, ySill + 0.035, zc, T + 0.16, 0.07, L);
      kit.box('brick', x, (EH + yHead) / 2, zc, T, EH - yHead, L);
      kit.box('conc', x, EH + 0.09, zc, T + 0.22, 0.18, L + 0.4);
      for (j = 0; j <= nb; j++) {
        var zp = zN - j * bay, wide = (j === 0 || j === nb) ? 1.1 : PW;
        kit.box('brick', x, (ySill + yHead) / 2, zp, T + 0.06, yHead - ySill, wide);
        if (j === nb) break;
        var z0 = zp - PW / 2, z1 = zp - bay + PW / 2, hh = yHead - ySill;
        for (k = 0; k <= 4; k++) kit.box('steel', x, ySill + hh / 2, lerp(z0, z1, k / 4), 0.1, hh, (k === 0 || k === 4) ? 0.09 : 0.05);
        for (k = 0; k <= 4; k++) kit.box('steel', x, ySill + hh * k / 4, (z0 + z1) / 2, 0.1, (k === 0 || k === 4) ? 0.09 : 0.05, z0 - z1);
      }
      var glass = new THREE.Mesh(new THREE.PlaneBufferGeometry(L, yHead - ySill), new THREE.MeshStandardMaterial({
        color: C('#D6E6EA'), transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
      glass.position.set(x, (ySill + yHead) / 2, zc); glass.rotation.y = Math.PI / 2; g.add(glass);
    });

    // the gable ends: brick, a gridded window and a lunette under the vault
    var ew = new THREE.Shape(), NA = 40, i;
    ew.moveTo(-HW - T / 2, 0); ew.lineTo(HW + T / 2, 0); ew.lineTo(HW + T / 2, EH);
    for (i = 0; i <= NA; i++) { var ph = al - 2 * al * i / NA; ew.lineTo(Rc * Math.sin(ph), cy + Rc * Math.cos(ph)); }
    ew.lineTo(-HW - T / 2, 0);
    var WX = 4.6, rl = Rc - 1.4, yl = EH + 0.5, x0 = Math.sqrt(rl * rl - (yl - cy) * (yl - cy)), p1 = Math.asin(x0 / rl);
    var hole = new THREE.Path(); hole.moveTo(-WX, ySill); hole.lineTo(WX, ySill); hole.lineTo(WX, yHead); hole.lineTo(-WX, yHead); hole.lineTo(-WX, ySill);
    var lun = new THREE.Path(); lun.moveTo(-x0, yl); lun.lineTo(x0, yl);
    for (i = 1; i < NA; i++) { var q = p1 - 2 * p1 * i / NA; lun.lineTo(rl * Math.sin(q), cy + rl * Math.cos(q)); }
    lun.lineTo(-x0, yl);
    ew.holes.push(hole, lun);
    var ewGeo = new THREE.ExtrudeBufferGeometry(ew, { depth: T, bevelEnabled: false }); ewGeo.translate(0, 0, -T / 2);
    var lunS = new THREE.Shape(lun.getPoints());
    [zN, -zF].forEach(function (z) {
      var e = new THREE.Mesh(ewGeo, brickP); e.position.z = z; g.add(e);
      var hh = yHead - ySill;
      for (k = 0; k <= 6; k++) kit.box('steel', lerp(-WX, WX, k / 6), ySill + hh / 2, z, (k % 6 ? 0.05 : 0.09), hh, 0.1);
      for (k = 0; k <= 4; k++) kit.box('steel', 0, ySill + hh * k / 4, z, 2 * WX, (k % 4 ? 0.05 : 0.09), 0.1);
      for (k = 1; k < 8; k++) {
        var xx = lerp(-x0, x0, k / 8), top = cy + Math.sqrt(rl * rl - xx * xx);
        kit.box('steel', xx, (yl + top) / 2, z, 0.05, top - yl, 0.1);
      }
      kit.box('steel', 0, yl, z, 2 * x0, 0.08, 0.1);
      var yy = yl + 1.5, xm = Math.sqrt(rl * rl - (yy - cy) * (yy - cy));
      kit.box('steel', 0, yy, z, 2 * xm, 0.05, 0.1);
      var gm = new THREE.MeshStandardMaterial({ color: C('#D6E6EA'), transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
      var gp = new THREE.Mesh(new THREE.PlaneBufferGeometry(2 * WX, hh), gm); gp.position.set(0, ySill + hh / 2, z); g.add(gp);
      var gl = new THREE.Mesh(new THREE.ShapeBufferGeometry(lunS), gm); gl.position.z = z; g.add(gl);
    });

    // the vault: galvanized corrugations, arched ribs and tie rods at every pier
    var ctex = canvasTex(8, 64, function (gc) {
      for (var y = 0; y < 64; y++) { var v = 150 + 38 * Math.sin(y / 64 * 6.2832); gc.fillStyle = 'rgb(' + (v | 0) + ',' + ((v + 4) | 0) + ',' + ((v + 6) | 0) + ')'; gc.fillRect(0, y, 8, 1); }
    }, { repeat: [1, L / 0.42] });
    var rp = [], ru = [], ri2 = [];
    for (i = 0; i <= 72; i++) {
      var a = -al + 2 * al * i / 72;
      for (k = 0; k < 2; k++) { rp.push(Rc * Math.sin(a), cy + Rc * Math.cos(a), k ? zN + 0.8 : -zF - 0.8); ru.push(i / 72, k); }
      if (i < 72) ri2.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    var rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2));
    rg.setIndex(ri2); rg.computeVertexNormals();
    var roof = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: C('#C9CED0'), map: ctex, bumpMap: ctex, bumpScale: 0.03, metalness: 0.55, roughness: 0.48, side: THREE.DoubleSide }));
    roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    for (j = 0; j <= nb; j++) {
      var zr = zN - j * bay;
      kit.put('rib', plc_m4(0, cy, zr, 1, 1, 1, 0, 0, Math.PI / 2 - al));
      kit.put('rod', plc_m4(0, EH - 0.15, zr, 1, 2 * HW, 1, 0, 0, Math.PI / 2));
    }
    [-0.62, -0.3, 0, 0.3, 0.62].forEach(function (f) {
      var a = f * al;
      kit.put('steel', plc_m4((Rc - 0.2) * Math.sin(a), cy + (Rc - 0.2) * Math.cos(a), zc, 0.06, 0.12, L, 0, 0, -a));
    });

    // pendant lamps down both sides of the aisle
    var pend = [];
    for (j = 1; j < nb; j += 2) [-3.6, 3.6].forEach(function (x) {
      var z = zN - j * bay, yTop = cy + Math.sqrt(Rc * Rc - x * x) - 0.1, yP = 8.7;
      kit.box('rod', x, (yTop + yP) / 2, z, 0.5, yTop - yP, 0.5);
      kit.box('shade', x, yP - 0.12, z, 1, 1, 1);
      kit.box('bulb', x, yP - 0.3, z, 1, 1, 1);
      pend.push([x, yP - 0.4, z]);
    });
    pend.sort(function (a, b) { return Math.abs(a[2] + 6) - Math.abs(b[2] + 6); });
    pend.slice(0, 6).forEach(function (p) { W.lamp('#FFD2A0', 0.5, 20, F.w(p[0], p[2], p[1])); });

    // outdoors: nothing grows in the hall
    var n0 = W.occupied.length;
    F.claimRect(0, 0, -zF - 2, zN + 2, HW + 3);
    commonScatter(W, { bushes: 300, rocks: 160, yucca: 6 });
    W.occupied.splice(n0, W.occupied.length - n0);
    for (k = -zF; k <= zN; k += 2.5) { F.claim(-HW, k, 1); F.claim(HW, k, 1); }

    // 100 works in mill aluminum, 104 x 129 x 183 cm, in rows down both sides
    var BW = 1.83, BH = 1.04, BD = 1.29, t = 0.02, clear = Math.max(8, R + 3), cone = null;
    [-8.9, -5.6, 5.6, 8.9].forEach(function (x) {
      for (var z = zN - 3; z > -zF + 2.5; z -= 2.55) {
        if (Math.sqrt(x * x + z * z) < clear) continue;
        var v = r(), y0 = 0.03, cxm = plc_m4(x, 0, z, 1, 1, 1, 0, 0, 0);
        var pl = function (px, py, pz, w, h, d, rz) { kit.put('alu', plc_m4(px, py, pz, w, h, d, 0, 0, rz || 0).premultiply(cxm)); };
        if (v < 0.34) pl(0, y0 + BH / 2, 0, BW, BH, BD);
        else {
          var openZ = v < 0.62, top = y0 + BH - t / 2, bot = y0 + t / 2;
          pl(0, top, 0, BW, t, BD); pl(0, bot, 0, BW, t, BD);
          if (openZ) { pl(-BW / 2 + t / 2, y0 + BH / 2, 0, t, BH, BD); pl(BW / 2 - t / 2, y0 + BH / 2, 0, t, BH, BD); }
          else { pl(0, y0 + BH / 2, -BD / 2 + t / 2, BW, BH, t); pl(0, y0 + BH / 2, BD / 2 - t / 2, BW, BH, t); }
          var inner = r();
          if (inner < 0.3) pl(0, y0 + BH / 2, 0, openZ ? t : BW, BH, openZ ? BD : t);
          else if (inner < 0.55 && openZ) pl(0, y0 + BH / 2, 0, Math.hypot(BW, BH) - 0.05, t, BD - 0.01, Math.atan2(BH, BW) * (r() < 0.5 ? 1 : -1));
          else if (inner < 0.7) pl(0, y0 + BH * 0.5, 0, BW - 0.02, t, BD - 0.02);
        }
        F.claim(x, z, 1.25);
        if (!cone && Math.abs(x) < 6 && z < -R - 1 && z > -R - 7) cone = [x, z];
      }
    });

    // Abloh: one safety orange cone, one quoted placard
    if (cone) {
      var cg = new THREE.Group(), orange = std('#FF6B00', 0.55);
      var cn = new THREE.Mesh(new THREE.ConeBufferGeometry(0.17, 0.62, 20), orange); cn.position.y = 0.35; cg.add(cn);
      var cb = box(0.42, 0.04, 0.42, orange); cb.position.y = 0.02; cg.add(cb);
      var band = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.085, 0.115, 0.1, 20, 1, true), std('#F4F2EC', 0.4)); band.position.y = 0.42; cg.add(band);
      var pc = plc_label('"DO NOT TOUCH"', '#F4F2EC', '#111111', 0.16);
      var stand = new THREE.Group(); pc.position.set(0, 0.95, 0.012); pc.rotation.x = -0.3; stand.add(pc);
      var sp = box(0.03, 0.9, 0.03, std('#33373B', 0.5, 0.75)); sp.position.y = 0.45; stand.add(sp);
      stand.position.set(0.55, 0, 0.1); cg.add(stand);
      var cx = cone[0] - Math.sign(cone[0]) * 1.5;
      cg.position.set(cx, 0, cone[1] + 0.6); cg.rotation.y = Math.atan2(-cx, D - cone[1]) * 0.6;
      shade(cg); g.add(cg); F.claim(cx, cone[1] + 0.6, 0.8);
    }

    kit.flush(g);
    shade(g, true, true);
    g.traverse(function (o) { if (o.material && o.material.transparent) o.castShadow = false; });
    floor.castShadow = false;
    W.court = { half: zF, group: g, H: EH, interior: true };
    // daylight bouncing off the floor and the brick: warm, shadowless, gone at night
    plc_bounce(W, '#FFF0DC', '#B7916C', 0.95);
  }
  function plc_bounce(W, sky, gnd, k) {
    var hb = new THREE.HemisphereLight(C(sky), C(gnd), 0);
    W.add(hb);
    W.onUpdate(function (ctx) { hb.intensity = k * sstep(-3, 14, ctx.sun.el) * (1 - 0.5 * ctx.night); });
  }

  // =====================================================================
  // 2. HIGHLAND AVENUE
  // Downtown Marfa at golden hour: low false fronts on a very wide street,
  // angle-parked pickups, power lines, and at the far end a Second Empire
  // courthouse in pale pink stone, in the spirit of Presidio County's (1886).
  // The street is turned a little off the camera's line, so the courthouse
  // stands beside the clock instead of behind it. Every shop name is invented.
  // =====================================================================
  var PLC_SIGNS = ['"GENERAL STORE"', 'BOOKS', 'FEED AND SEED', 'HARDWARE', 'DRY GOODS', 'CAFE', 'SADDLERY', 'HOTEL',
    'ICE HOUSE', 'PHARMACY', 'TRADING POST', 'GALLERY', 'BAKERY', 'TACOS', 'BARBER', 'LAUNDRY', 'MERCANTILE', 'RECORDS',
    'MOTOR CO.', 'LUMBER', 'BOOTS', 'ANTIQUES', 'PRINT SHOP', 'THEATRE', '"OPEN LATE"', 'WESTERN WEAR', 'ASSAY OFFICE',
    'DRUGS', 'NOTIONS', 'CANDY', 'SUNDRIES', 'TIRE AND AUTO', 'TELEGRAPH', '"SOUVENIR"', 'HATS', 'FILM AND PHOTO'];
  var PLC_STUCCO = ['#D8C3A5', '#E6D8C3', '#CFA27A', '#E8E1D6', '#C98E6B', '#BFA58A', '#E3CFB0', '#D9B8A0', '#B8C4B0', '#E2C9A2'];
  var PLC_BRICK = ['#9C5A42', '#B06E4F', '#8E4E3A', '#B89272', '#A7654A'];
  var PLC_AWN = ['#2F5D50', '#8C2F39', '#C99A3A', '#2B4C6F', '#6E3B2F', '#E1DAC9', '#3E3B38'];
  var PLC_TRUCK = ['#8E3B2F', '#D9D3C4', '#3A5A78', '#6B6F4E', '#C7A86B', '#2B2D30', '#B04A2E', '#8A8F93', '#5B3A2A'];

  function plc_highland(W) {
    W.shadowExtent = 48;
    makeGround(W, '#A58E6E');
    makeRidges(W, 3100, false, '#6C6772'); makeRidges(W, 1400, true, '#8A785F');
    var F = plc_frame(W), D = F.D, R = F.R, r = W.r, i, j, k;
    var side = W.P.seed % 2 ? 1 : -1, phi = side * rf(r, 15, 21) * D2R, cp = Math.cos(phi), spn = Math.sin(phi);
    var S = new THREE.Group(); S.rotation.y = phi; F.g.add(S);
    // street frame to place frame, for claims and lamps
    var sl = function (x, z) { return [x * cp + z * spn, -x * spn + z * cp]; };
    var sclaim = function (x, z, rad) { var q = sl(x, z); F.claim(q[0], q[1], rad); };
    var sfree = function (x, z, rad) { var q = sl(x, z); return F.free(q[0], q[1], rad); };
    var swp = function (x, z, y) { var q = sl(x, z); return F.w(q[0], q[1], y); };
    var HS = Math.max(16, R + 10), SW = 3.4, zS = D * 2.4 + 14, zE = -104, zCH = -158, g0 = -66, g1 = -50;
    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    var shopLit = std('#262C31', 0.12, 0.55); shopLit.emissive = C('#FFC27A'); W.glow(shopLit, 0, 0.95);
    var winLit = std('#262C31', 0.12, 0.55); winLit.emissive = C('#FFD9A6'); W.glow(winLit, 0, 0.7);
    var kit = plc_kit()
      .def('stucco', BOX, plc_tex('#FFFFFF', 'plaster', 0.95, 0, 1.6, 0.3, 0.35))
      .def('brick', BOX, plc_tex('#FFFFFF', 'plc_brick', 0.9, 0, 0.9, 0.5, 0.5))
      .def('trim', BOX, std('#FFFFFF', 0.7))
      .def('shop', BOX, shopLit).def('win', BOX, winLit)
      .def('dark', BOX, std('#1B2025', 0.1, 0.7))
      .def('awn', BOX, std('#FFFFFF', 0.85))
      .def('wood', BOX, mtl('#6B5238', 'wood', 0.9, 0, 0.8))
      .def('conc', BOX, mtl('#B9B2A6', 'concrete', 0.92, 0, 1.8))
      .def('pole', new THREE.CylinderBufferGeometry(0.11, 0.14, 1, 6), mtl('#5B4B3B', 'wood', 1, 0, 1.2))
      .def('lpole', new THREE.CylinderBufferGeometry(0.07, 0.09, 1, 8), std('#2B3430', 0.5, 0.5))
      .def('lhead', BOX, std('#22282A', 0.5, 0.5))
      .def('lens', BOX, plc_glow(W, '#FFD7A0', 0.05, 2.2), { cast: false })
      .def('paint', BOX, std('#E8E4DA', 0.8), { cast: false })
      .def('shrub', new THREE.IcosahedronBufferGeometry(1, 0), std('#5E6B3E', 0.95, 0, { flatShading: true }))
      .def('tbody', BOX, std('#FFFFFF', 0.45, 0.3))
      .def('tglass', BOX, std('#161B20', 0.08, 0.8))
      .def('tire', new THREE.CylinderBufferGeometry(0.4, 0.4, 0.3, 14), std('#18191B', 0.9))
      .def('chrome', BOX, std('#C9CDD2', 0.25, 1))
      .def('thead', BOX, plc_glow(W, '#FFF4D6', 0.05, 1.4), { cast: false })
      .def('ttail', BOX, plc_glow(W, '#FF2A1F', 0.3, 1.4), { cast: false })
      .def('stone', BOX, plc_tex('#D9B3A1', 'stone', 0.85, 0, 1.4, 0.3, 0.3))
      .def('ctrim', BOX, mtl('#F1ECE2', 'plaster', 0.7, 0, 1.2))
      .def('cwin', BOX, std('#1E2328', 0.1, 0.6))
      .def('cwinLit', BOX, winLit);

    // ground plane of the street: asphalt, sidewalks, the plaza and the median
    var L = zS - zE + 70, zc = (zS + zE - 70) / 2;
    var asph = box(2 * HS, 0.04, L, mtl('#4B4945', 'concrete', 0.95, 0, 2.2)); asph.position.set(0, -0.005, zc); asph.receiveShadow = true; S.add(asph);
    var cross = box(260, 0.04, g1 - g0, mtl('#4B4945', 'concrete', 0.95, 0, 2.2)); cross.position.set(0, -0.004, (g0 + g1) / 2); cross.receiveShadow = true; S.add(cross);
    [-1, 1].forEach(function (s) {
      [[zS, g1], [g0, zE]].forEach(function (seg) {
        kit.box('conc', s * (HS - SW / 2), 0.08, (seg[0] + seg[1]) / 2, SW, 0.16, seg[0] - seg[1]);
      });
      // angled parking stripes, a crosswalk at the corner
      for (var z = zS - 4; z > zE + 4; z -= 3.4) {
        if (z < g1 + 2 && z > g0 - 2) continue;
        kit.put('paint', plc_m4(s * (HS - SW - 2.4), 0.02, z, 0.1, 0.01, 5.6, 0, s * 0.72, 0));
      }
      for (var c = 0; c < 9; c++) kit.box('paint', s * (HS - SW - 1 - c * 1.3), 0.02, g1 + 1.8, 0.55, 0.01, 2.6);
    });
    var Rp = R + 2.4;
    var plaza = new THREE.Mesh(new THREE.CylinderBufferGeometry(Rp, Rp, 0.06, 64), mtl('#CDBFA8', 'stone', 0.85, 0, 1.4));
    plaza.receiveShadow = true; S.add(plaza);
    var curb = new THREE.Mesh(new THREE.LatheBufferGeometry([new THREE.Vector2(Rp, 0), new THREE.Vector2(Rp, 0.18), new THREE.Vector2(Rp + 0.4, 0.18), new THREE.Vector2(Rp + 0.4, 0)], 72), mtl('#BDB4A6', 'concrete', 0.9, 0, 1.4));
    curb.castShadow = curb.receiveShadow = true; S.add(curb);
    var ringM = std('#A89A84', 0.9);
    for (i = 1; i <= 3; i++) {
      var rr0 = R + 0.6 + i * (Rp - R - 0.6) / 3.6, ring = new THREE.Mesh(new THREE.RingBufferGeometry(rr0, rr0 + 0.09, 72), ringM);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.033; S.add(ring);
    }
    kit.box('conc', 0, 0.09, (-Rp - 0.2 + g1 + 1) / 2, 2.8, 0.18, -Rp - 0.2 - g1 - 1);
    var soil = box(2.3, 0.2, -Rp - g1 - 1.6, std('#5A4A36', 1)); soil.position.set(0, 0.1, (-Rp - 0.5 + g1 + 1.3) / 2); S.add(soil);
    for (var zz = -Rp - 1.4; zz > g1 + 2; zz -= 1.3) kit.put('shrub', plc_m4(rf(r, -0.5, 0.5), 0.35, zz, rf(r, 0.4, 0.6), rf(r, 0.3, 0.45), rf(r, 0.4, 0.6), 0, r() * 6, 0));
    sclaim(0, (-Rp + g1) / 2, 1.6); sclaim(0, -Rp - 8, 1.6); sclaim(0, g1 + 6, 1.6);

    // storefronts on both sides
    var names = PLC_SIGNS.slice(), signs = 0;
    [-1, 1].forEach(function (s) {
      var z = zS;
      while (z > zE) {
        var wB = rf(r, 6.5, 13);
        if (z - wB < g1 && z > g0) { z = g0; continue; }
        if (z - wB < zE) break;
        var zc2 = z - wB / 2, two = r() < 0.42, H = two ? rf(r, 7.2, 8.6) : rf(r, 4.3, 5.4), pH = rf(r, 0.5, 1.9), dB = rf(r, 12, 18);
        var isB = r() < 0.36, key = isB ? 'brick' : 'stucco', col = isB ? pick(r, PLC_BRICK) : pick(r, PLC_STUCCO);
        var trimC = pick(r, ['#F1ECE2', '#3B3531', '#6E5A47', '#E7DCC6', '#2F4A45']), fx = s * HS, ww = wB - 0.1;
        kit.box(key, s * (HS + dB / 2), H / 2, zc2, dB, H, ww, 0, col);
        // the false front and its cornice
        var type = r();
        kit.box(key, s * (HS + 0.2), H + pH / 2, zc2, 0.4, pH, ww, 0, col);
        kit.box('trim', s * (HS - 0.05), H + pH + 0.08, zc2, 0.62, 0.16, ww + 0.2, 0, trimC);
        if (type < 0.35) {
          var tw = ww * rf(r, 0.3, 0.45), th = rf(r, 0.6, 1.1);
          kit.box(key, s * (HS + 0.2), H + pH + th / 2, zc2, 0.4, th, tw, 0, col);
          kit.box('trim', s * (HS - 0.05), H + pH + th + 0.08, zc2, 0.62, 0.16, tw + 0.2, 0, trimC);
        }
        kit.box('trim', s * (HS - 0.1), H - 0.1, zc2, 0.3, 0.28, ww, 0, trimC);
        [-1, 1].forEach(function (e) { kit.box('trim', s * (HS - 0.06), (H + pH) / 2, zc2 + e * (ww / 2 - 0.16), 0.14, H + pH, 0.32, 0, trimC); });
        // storefront: bulkhead, glass, a recessed door, a transom
        var lit = r() < 0.72, gk = lit ? 'shop' : 'dark', dw = 1.2, pw = (ww - 0.64 - dw) / 2;
        kit.box('trim', fx - s * 0.04, 0.3, zc2, 0.1, 0.6, ww - 0.64, 0, trimC);
        [-1, 1].forEach(function (e) {
          var zw = zc2 + e * (dw / 2 + pw / 2);
          kit.box(gk, fx - s * 0.03, 1.65, zw, 0.06, 2.1, pw - 0.1);
          kit.box('trim', fx - s * 0.05, 1.65, zw, 0.06, 2.1, 0.06, 0, trimC);
        });
        kit.box('dark', fx + s * 0.25, 1.25, zc2, 0.06, 2.5, dw);
        kit.box('trim', fx - s * 0.04, 2.85, zc2, 0.1, 0.18, ww - 0.64, 0, trimC);
        kit.box(gk, fx - s * 0.03, 3.25, zc2, 0.06, 0.55, ww - 0.9);
        if (two) {
          var nw = Math.max(2, Math.floor(ww / 2.3)), wl = r() < 0.45;
          for (k = 0; k < nw; k++) {
            var zw2 = zc2 - ww / 2 + (k + 0.5) * ww / nw;
            kit.box(wl && r() < 0.7 ? 'win' : 'dark', fx - s * 0.02, H * 0.66, zw2, 0.06, 1.7, 0.95);
            kit.box('trim', fx - s * 0.06, H * 0.66 + 0.98, zw2, 0.12, 0.16, 1.25, 0, trimC);
            kit.box('trim', fx - s * 0.06, H * 0.66 - 0.92, zw2, 0.14, 0.1, 1.15, 0, trimC);
          }
        }
        // awning: a flat porch roof on posts, or an angled canvas
        var aw = r();
        if (aw < 0.4) {
          kit.box('wood', s * (HS - 1.35), 3.72, zc2, 2.7, 0.14, ww - 0.2);
          kit.box('trim', s * (HS - 2.7), 3.68, zc2, 0.06, 0.3, ww - 0.2, 0, trimC);
          for (var pz = -ww / 2 + 0.5; pz <= ww / 2 - 0.4; pz += Math.max(2.6, (ww - 0.9) / Math.ceil((ww - 0.9) / 3.6))) kit.box('wood', s * (HS - 2.62), 1.86, zc2 + pz, 0.14, 3.7, 0.14);
        } else if (aw < 0.75) {
          kit.put('awn', plc_m4(s * (HS - 1.0), 3.45, zc2, 2.1, 0.05, ww - 0.5, 0, 0, s * 0.36), pick(r, PLC_AWN));
          kit.put('awn', plc_m4(s * (HS - 1.98), 3.02, zc2, 0.04, 0.34, ww - 0.5, 0, 0, 0), pick(r, PLC_AWN));
        }
        // the painted sign
        if (names.length) {
          var nm = names.splice(Math.floor(r() * names.length), 1)[0], neon = r() < 0.3;
          var bg = pick(r, ['#F1ECE2', '#2E2A27', '#7B3F32', '#2F4A45', null]), fg = bg === '#F1ECE2' ? '#2E2A27' : (bg ? '#F4EBD9' : pick(r, ['#2E2A27', '#7B3F32', '#F4EBD9']));
          var sg = textPlane(nm, { bg: bg, color: neon ? '#FFE3B0' : fg, font: r() < 0.5 ? FONT_SERIF : FONT_SANS, height: 0.72, px: 90, spacing: 0.08, pad: 0.35, glow: neon ? '#FF9E5A' : null });
          if (neon) W.glow(sg.material, 0, 0.85);
          var maxW = ww - 1.0; if (sg.userData.w > maxW) sg.scale.setScalar(maxW / sg.userData.w);
          var sy = pH > 1.0 ? H + pH * 0.5 : (two ? H - 0.9 : H - 0.62);
          if (pH <= 1.0 && two) sy = H * 0.66 + 1.55;
          sg.position.set(s * (HS - 0.12), sy, zc2); sg.rotation.y = -s * Math.PI / 2;
          S.add(sg); signs++;
        }
        for (var cz = z; cz > z - wB; cz -= 5) sclaim(s * (HS + 3), cz, 3.6);
        z -= wB;
      }
    });

    // pickups, parked at an angle
    var trucks = 0;
    for (i = 0; i < 40 && trucks < 9; i++) {
      var s2 = r() < 0.5 ? 1 : -1, tz = Math.round(rf(r, zE + 8, zS - 10) / 3.4) * 3.4 - 1.7;
      if (tz < g1 + 3 && tz > g0 - 3) continue;
      var tx = s2 * (HS - SW - 2.8);
      if (!sfree(tx, tz, 2.8)) continue;
      sclaim(tx, tz, 2.8); trucks++;
      var TM = plc_m4(tx, 0, tz, 1, 1, 1, 0, Math.atan2(-0.72, s2 * 0.7), 0), tc = pick(r, PLC_TRUCK);
      kit.box('tbody', 0, 0.78, 0, 5.3, 0.72, 1.95, 0, tc, TM);
      kit.box('tbody', 0.45, 1.5, 0, 1.95, 0.74, 1.86, 0, tc, TM);
      kit.box('tglass', 0.45, 1.52, 0, 2.02, 0.5, 1.58, 0, null, TM);
      kit.box('tglass', 0.45, 1.52, 0, 1.55, 0.5, 1.9, 0, null, TM);
      kit.box('tbody', -1.55, 1.3, 0.93, 2.2, 0.34, 0.08, 0, tc, TM);
      kit.box('tbody', -1.55, 1.3, -0.93, 2.2, 0.34, 0.08, 0, tc, TM);
      kit.box('tbody', -2.61, 1.3, 0, 0.08, 0.34, 1.95, 0, tc, TM);
      kit.box('chrome', 2.69, 0.55, 0, 0.1, 0.2, 2.0, 0, null, TM);
      kit.box('chrome', -2.69, 0.55, 0, 0.1, 0.2, 2.0, 0, null, TM);
      [[1.7, 0.9], [1.7, -0.9], [-1.6, 0.9], [-1.6, -0.9]].forEach(function (q) { kit.put('tire', plc_m4(q[0], 0.4, q[1], 1, 1, 1, Math.PI / 2, 0, 0).premultiply(TM)); });
      [0.68, -0.68].forEach(function (q) { kit.box('thead', 2.66, 0.9, q, 0.04, 0.16, 0.3, 0, null, TM); kit.box('ttail', -2.66, 0.95, q, 0.04, 0.2, 0.18, 0, null, TM); });
    }

    // street lamps along both curbs; the nearest ones are real lights
    var lamps = [];
    [-1, 1].forEach(function (s) {
      for (var z = zS - 6; z > zE; z -= 22) {
        if (z < g1 + 2 && z > g0 - 2) continue;
        var x = s * (HS - SW + 0.55);
        kit.box('lpole', x, 3.2, z, 1, 6.4, 1);
        kit.box('lhead', x - s * 0.7, 6.32, z, 1.4, 0.08, 0.08);
        kit.box('lhead', x - s * 1.35, 6.2, z, 0.62, 0.2, 0.34);
        kit.box('lens', x - s * 1.35, 6.08, z, 0.5, 0.04, 0.26);
        lamps.push([x - s * 1.35, z]);
      }
    });
    lamps.sort(function (a, b) { return Math.abs(a[1] - 4) - Math.abs(b[1] - 4); });
    lamps.slice(0, 6).forEach(function (p) { W.lamp('#FFC98A', 1.5, 26, swp(p[0], p[1], 5.6)); });
    for (i = 0; i < 4; i++) {
      var a = (i + 0.5) / 4 * 6.2832, bx = Math.sin(a) * (Rp + 0.2), bz = Math.cos(a) * (Rp + 0.2);
      kit.box('lpole', bx, 0.5, bz, 1.4, 1, 1.4);
      kit.box('lens', bx, 1.02, bz, 0.2, 0.06, 0.2);
    }

    // power lines on one side, three wires sagging between the poles
    var ps = -side, wireM = new THREE.LineBasicMaterial({ color: C('#2A2622') }), tops = [];
    for (var z3 = zS - 2; z3 > zE - 20; z3 -= 34) {
      var px = ps * (HS - 0.6);
      kit.box('pole', px, 5, z3, 1, 10, 1);
      kit.box('wood', px + ps * 0.1, 9.4, z3, 2.6, 0.14, 0.14);
      tops.push(z3);
    }
    for (i = 0; i < tops.length - 1; i++) [-1.1, 0, 1.1].forEach(function (o) {
      var pts = [];
      for (k = 0; k <= 12; k++) { var t = k / 12; pts.push(new THREE.Vector3(ps * (HS - 0.5) + o, 9.55 - Math.sin(t * Math.PI) * 0.8, lerp(tops[i], tops[i + 1], t))); }
      S.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    });

    // the courthouse square
    var lawn = box(80, 0.06, 74, mtl('#7E8452', 'sand', 1, 0, 2)); lawn.position.set(0, 0.0, zCH + 2); lawn.receiveShadow = true; S.add(lawn);
    kit.box('conc', 0, 0.05, zCH + 26, 4.5, 0.08, 26);
    var CW = 34, CD = 24, H1 = 11;
    var CM = plc_m4(0, 0, zCH, 1, 1, 1, 0, 0, 0);
    var cb = function (key, x, y, z, sx, sy, sz, col) { kit.box(key, x, y, z, sx, sy, sz, 0, col, CM); };
    cb('stone', 0, 0.7, 0, CW + 1.2, 1.4, CD + 1.2, '#C79F8C');
    cb('stone', 0, H1 / 2 + 0.7, 0, CW, H1 - 1.4, CD);
    cb('stone', 0, (H1 + 1.6) / 2, 0, 10, H1 + 1.6, CD + 2.4);
    [-1, 1].forEach(function (e) { cb('stone', e * (CW / 2 - 3.4), (H1 + 0.7) / 2, 0, 7, H1 + 0.7, CD + 1.2); });
    [1.4, 6.1, H1].forEach(function (y, n) {
      cb('ctrim', 0, y, 0, CW + 0.5 + (n === 2 ? 0.6 : 0), n === 2 ? 0.55 : 0.22, CD + 0.5 + (n === 2 ? 0.6 : 0));
      cb('ctrim', 0, y + (n === 2 ? 1.6 : 0), 0, 10.6, n === 2 ? 0.55 : 0.22, CD + 3);
      [-1, 1].forEach(function (e) { cb('ctrim', e * (CW / 2 - 3.4), y + (n === 2 ? 0.7 : 0), 0, 7.6, n === 2 ? 0.55 : 0.22, CD + 1.8); });
    });
    [-1, 1].forEach(function (e) {
      [CW / 2, 6.9 - 0].forEach(function (qx, n) {
        for (var y = 1.6; y < H1; y += 0.9) cb('ctrim', e * (n ? 5 : CW / 2), y + 0.35, CD / 2 + (n ? 1.2 : 0.6), 0.7, 0.4, 0.2);
      });
    });
    var wx = [-15.2, -12.4, -8.2, -6.4, 6.4, 8.2, 12.4, 15.2, -2.9, 2.9];
    [3.6, 8.3].forEach(function (y, fl) {
      wx.forEach(function (x, n) {
        if (fl === 0 && n >= 8) return;
        var zf = Math.abs(x) < 5 ? CD / 2 + 1.2 : (Math.abs(x) > 13 ? CD / 2 + 0.6 : CD / 2), lit = r() < 0.4;
        cb('ctrim', x, y, zf + 0.02, 1.7, 3.1, 0.1);
        cb(lit ? 'cwinLit' : 'cwin', x, y - 0.05, zf + 0.08, 1.15, 2.6, 0.06);
        cb('ctrim', x, y + 1.7, zf + 0.18, 1.9, 0.3, 0.3);
        cb('ctrim', x, y - 1.45, zf + 0.12, 1.6, 0.14, 0.26);
      });
    });
    cb('dark', 0, 2.2, CD / 2 + 1.25, 2.4, 3.4, 0.06);
    cb('ctrim', 0, 4.1, CD / 2 + 1.35, 3.2, 0.5, 0.3);
    cb('stone', 0, 0.35, CD / 2 + 3, 6, 0.7, 3.2, '#C79F8C');
    // mansard roofs: truncated pyramids in slate, with dormers
    var slate = std('#62666D', 0.6, 0.25), mans = function (w, d, h, inset, y, x) {
      var m = new THREE.Mesh(new THREE.CylinderBufferGeometry(Math.SQRT1_2 * (1 - inset), Math.SQRT1_2, 1, 4, 1), slate);
      m.rotation.y = Math.PI / 4; m.scale.set(1, 1, 1);
      var gg = new THREE.Group(); gg.add(m); gg.scale.set(w, h, d); gg.position.set(x || 0, y + h / 2, zCH); S.add(gg);
    };
    mans(CW + 0.3, CD + 0.3, 3.8, 0.22, H1 + 0.28);
    [-1, 1].forEach(function (e) { mans(7.4, CD + 1.5, 4.8, 0.3, H1 + 1, e * (CW / 2 - 3.4)); });
    [-9.5, -6.5, 6.5, 9.5].forEach(function (x) {
      cb('ctrim', x, H1 + 1.9, CD / 2 - 0.5, 1.3, 1.9, 1.4);
      cb('cwin', x, H1 + 1.8, CD / 2 + 0.22, 0.8, 1.3, 0.06);
    });
    // the central tower, a drum, a silver dome, a lantern and Justice on top
    var ty = H1 + 1.6;
    cb('stone', 0, ty + 3.6, 0, 7, 7.2, 7);
    cb('ctrim', 0, ty + 7.3, 0, 7.8, 0.5, 7.8);
    [-1, 1].forEach(function (e) { cb('cwin', e * 1.4, ty + 3.8, 3.52, 1, 3, 0.06); cb('cwin', 3.52, ty + 3.8, e * 1.4, 0.06, 3, 1); cb('cwin', -3.52, ty + 3.8, e * 1.4, 0.06, 3, 1); });
    var tg = new THREE.Group(); tg.position.set(0, ty + 7.55, zCH); S.add(tg);
    var drum = cyl(3.1, 3.3, 2.4, 16, mtl('#F1ECE2', 'plaster', 0.7, 0, 1.2)); drum.position.y = 1.2; tg.add(drum);
    var domeM = std('#D4D6D2', 0.35, 0.65); domeM.emissive = C('#FFE7C0'); W.glow(domeM, 0, 0.18);
    var dome = new THREE.Mesh(new THREE.SphereBufferGeometry(3.25, 32, 14, 0, 6.2832, 0, Math.PI / 2), domeM); dome.scale.y = 1.35; dome.position.y = 2.4; tg.add(dome);
    var lant = cyl(0.8, 0.9, 1.5, 8, drum.material); lant.position.y = 7.2; tg.add(lant);
    var lcap = new THREE.Mesh(new THREE.SphereBufferGeometry(0.95, 16, 8, 0, 6.2832, 0, Math.PI / 2), domeM); lcap.position.y = 7.95; tg.add(lcap);
    var gold = std('#C9A24A', 0.35, 1), just = cyl(0.22, 0.34, 1.5, 10, gold); just.position.y = 9.6; tg.add(just);
    var jh = sph(0.2, gold); jh.position.y = 10.5; tg.add(jh);
    var arm = box(1.2, 0.08, 0.08, gold); arm.position.set(0.3, 10.1, 0); arm.rotation.z = 0.5; tg.add(arm);
    shade(tg);
    [-1, 1].forEach(function (e) {
      W.lamp('#FFD4A0', 1.3, 44, swp(e * 13, zCH + 22, 2.5));
      for (var n = 0; n < 3; n++) {
        var tr = cottonwood(r); tr.scale.setScalar(rf(r, 1.1, 1.5));
        tr.position.copy(swp(e * rf(r, 22, 34), zCH + rf(r, -26, 20))); W.add(tr);
      }
    });
    sclaim(0, zCH, 30);

    // Abloh: a safety orange news box by the plaza, quoted
    var np = placeInView(W, 0.6, 14, 24, D * 0.55, D * 0.85);
    if (np) {
      var nb2 = new THREE.Group(), orange = std('#FF6B00', 0.5, 0.2);
      var bxm = box(0.5, 0.95, 0.45, orange); bxm.position.y = 0.6; nb2.add(bxm);
      var lid = box(0.54, 0.06, 0.5, orange); lid.position.y = 1.1; nb2.add(lid);
      var legm = box(0.4, 0.14, 0.36, std('#2A2C30', 0.5, 0.6)); legm.position.y = 0.07; nb2.add(legm);
      var wdw = box(0.38, 0.3, 0.02, std('#1B2025', 0.1, 0.7)); wdw.position.set(0, 0.82, 0.23); nb2.add(wdw);
      var nl = plc_label('"NEWS"', '#FF6B00', '#111111', 0.14); nl.position.set(0, 0.5, 0.232); nb2.add(nl);
      nb2.position.copy(np); W.face(nb2); shade(nb2); W.add(nb2);
    }

    kit.flush(S);
    shade(S, true, true);
    asph.castShadow = cross.castShadow = lawn.castShadow = plaza.castShadow = false;
    commonScatter(W, { bushes: 220, rocks: 120, yucca: 4 });
  }

  // =====================================================================
  // 3. OBSERVATORY RIDGE
  // A summit in the Davis Mountains, after McDonald Observatory: white domes
  // on drums, a visitor building, a road winding down, pinon and juniper, and
  // the plains far below. After dark each slit opens and the dome turns with
  // the sky. Astronomers keep their lights red.
  // =====================================================================
  function plc_obsDome(W, Rd, Hd, park, phase) {
    var g = new THREE.Group(), white = std('#F1F2EF', 0.34, 0.2);
    var seam = canvasTex(256, 16, function (gc) { gc.fillStyle = '#FFFFFF'; gc.fillRect(0, 0, 256, 16); gc.fillStyle = '#C9CCCB'; for (var x = 0; x < 256; x += 16) gc.fillRect(x, 0, 1.5, 16); }, { repeat: [Math.round(Rd * 1.2), 1] });
    var drum = new THREE.Mesh(new THREE.CylinderBufferGeometry(Rd, Rd, Hd, 56, 1, true), std('#EEEFEC', 0.5, 0.05, { map: seam }));
    drum.position.y = Hd / 2; g.add(drum);
    var plinth = cyl(Rd + 0.7, Rd + 0.9, 0.7, 56, mtl('#A9A39A', 'concrete', 0.95, 0, 2)); plinth.position.y = 0.35; g.add(plinth);
    var walk = new THREE.Mesh(new THREE.RingBufferGeometry(Rd, Rd + 1.0, 56), std('#5C6166', 0.6, 0.6, { side: THREE.DoubleSide }));
    walk.rotation.x = -Math.PI / 2; walk.position.y = Hd - 0.9; g.add(walk);
    var rail = new THREE.Mesh(new THREE.TorusBufferGeometry(Rd + 0.95, 0.035, 5, 72), std('#5C6166', 0.6, 0.6)); rail.rotation.x = Math.PI / 2; rail.position.y = Hd + 0.1; g.add(rail);
    var posts = new THREE.InstancedMesh(new THREE.CylinderBufferGeometry(0.03, 0.03, 1.0, 5), std('#5C6166', 0.6, 0.6), 28);
    for (var i = 0; i < 28; i++) { var a = i / 28 * 6.2832; posts.setMatrixAt(i, plc_m4(Math.sin(a) * (Rd + 0.95), Hd - 0.4, Math.cos(a) * (Rd + 0.95))); }
    posts.frustumCulled = false; g.add(posts);
    var door = box(1.6, 2.5, 0.2, std('#4A4F55', 0.5, 0.6)); door.position.set(0, 1.95, Rd - 0.05); g.add(door);
    var dl = box(0.3, 0.12, 0.12, null); dl.material = W.glow(glowMat('#FF2A1A', 0.2), 0.2, 1.6); dl.position.set(0, 3.4, Rd + 0.05); g.add(dl);
    var cap = new THREE.Mesh(new THREE.TorusBufferGeometry(Rd, 0.12, 6, 72), white); cap.rotation.x = Math.PI / 2; cap.position.y = Hd; g.add(cap);
    // the dome, parametrised around the slit's own axis so the slit is a true band
    var D0 = new THREE.Group(); D0.position.y = Hd; g.add(D0);
    var w = Rd * 0.34, th1 = Math.acos(w / (2 * Rd)), ph0 = -0.14;
    var sphere = function (rad) { return function (u, v, p) { p.set(rad * Math.cos(u), rad * Math.sin(u) * Math.cos(v), rad * Math.sin(u) * Math.sin(v)); }; };
    // each patch twice, on the same triangles: white outside, dark inside. A
    // triangle is never front and back at once, so nothing can depth-fight.
    var innerB = std('#34383E', 0.85, 0.2, { side: THREE.BackSide });
    [[0, th1, -Math.PI / 2, Math.PI / 2], [Math.PI - th1, Math.PI, -Math.PI / 2, Math.PI / 2], [th1, Math.PI - th1, -Math.PI / 2, ph0]].forEach(function (q) {
      var pg = plc_param(sphere(Rd), q[0], q[1], 14, q[2], q[3], 36);
      D0.add(new THREE.Mesh(pg, white)); D0.add(new THREE.Mesh(pg, innerB));
    });
    // the shutter slides back over the dome; a polygon offset keeps it on top
    var shut = new THREE.Group(); D0.add(shut);
    var shutM = std('#F1F2EF', 0.34, 0.2, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    var sg = plc_param(sphere(Rd * 1.006), th1, Math.PI - th1, 8, ph0, Math.PI / 2, 30);
    shut.add(new THREE.Mesh(sg, shutM)); shut.add(new THREE.Mesh(sg, innerB));
    [-1, 1].forEach(function (e) {
      var jr = Math.sqrt(Rd * Rd - w * w / 4), jamb = new THREE.Mesh(new THREE.TorusBufferGeometry(jr + 0.05, 0.1, 6, 40, Math.PI / 2 - ph0), white);
      jamb.rotation.y = -Math.PI / 2; jamb.rotation.x = 0; jamb.position.x = e * w / 2; D0.add(jamb);
    });
    // the telescope, pointed out through the slit
    var tube = new THREE.Group(); tube.position.y = -Rd * 0.2; D0.add(tube);
    var pier = cyl(Rd * 0.12, Rd * 0.16, Rd * 0.5, 16, std('#2F4A6B', 0.5, 0.4)); pier.position.y = -Rd * 0.25; tube.add(pier);
    var ota = cyl(Rd * 0.085, Rd * 0.085, Rd * 1.1, 20, std('#E9ECEE', 0.4, 0.3)); ota.rotation.x = Math.PI / 2 - 0.85; ota.position.set(0, Rd * 0.32, Rd * 0.2); tube.add(ota);
    var ring = cyl(Rd * 0.11, Rd * 0.11, 0.25, 20, std('#2F4A6B', 0.5, 0.4)); ring.rotation.copy(ota.rotation); ring.position.copy(ota.position); tube.add(ring);
    shade(g);
    var dlamp = W.lamp('#FF3320', 0.7, Rd * 2.4, new THREE.Vector3());
    return {
      g: g, lamp: dlamp,
      update: function (ctx) {
        var open = sstep(0.35, 0.85, ctx.night), track = lst(ctx.utc) + phase;
        var diff = ((track - park) % 6.2832 + 6.2832 + Math.PI) % 6.2832 - Math.PI;
        D0.rotation.y = park + diff * open;
        shut.rotation.x = -open * (Math.PI / 2 + ph0 - 0.02);
      }
    };
  }

  function plc_observatory(W) {
    W.shadowExtent = 62;
    var F = plc_frame(W), D = F.D, R = F.R, r = W.r, i, j, k, s = W.P.seed % 2 ? 1 : -1, VAL = 540;
    var LIFT = F.h > 4 ? 0.8 : 2.4;
    W.cam.pos.y += LIFT; W.cam.h += LIFT;
    var ground = makeGround(W, '#8F8163', { relief: 40 }); ground.position.y = -VAL;
    makeRidges(W, 3300, false, '#66637A').position.y = -VAL + 60; makeRidges(W, 1900, true, '#6E6A5C').position.y = -VAL + 30;
    // the summit: flat pads for the clock, the domes and the visitor building,
    // joined along the ridge; everything else falls away to the plains
    var pads = [], sites = [];
    var pad = function (ax, az, bx, bz, rad, ha, hb) { pads.push([ax, az, bx, bz, rad, ha, hb == null ? ha : hb]); };
    pad(0, 0, 0, D + 10, Math.max(7, R + 3.5), 0);
    pad(0, 0, 0, 0, R + 6, 0);
    var nD = r() < 0.55 ? 3 : 2;
    var R0 = rf(r, 6.5, 8.5), R1 = rf(r, 6, 8), R2 = rf(r, 9.5, 12);
    var at = function (deg, d) { var a = deg * D2R; return [Math.sin(a) * d, D - Math.cos(a) * d]; };
    var q0 = at(-s * rf(r, 14, 18), D + R + rf(r, 44, 52)), q1 = at(s * rf(r, 8, 13), D + R + rf(r, 72, 86)), q2 = at(-s * rf(r, 1, 5), D + R + rf(r, 118, 138));
    sites.push([q0[0], q0[1], R0, rf(r, 6, 7.5), rf(r, 0.5, 2.5)]);
    sites.push([q1[0], q1[1], R1, rf(r, 5.5, 7), rf(r, 3, 7)]);
    if (nD === 3) sites.push([q2[0], q2[1], R2, rf(r, 8, 10), rf(r, 9, 14)]);
    sites.forEach(function (q) { pad(q[0], q[1], q[0], q[1], q[2] + 5, q[4]); pad(0, 0, q[0], q[1], 3.5, 0, q[4]); });
    var vq = at(s * 24, D + R + 20), vx = s * Math.max(Math.abs(vq[0]), R + 10), vz = vq[1];
    pad(vx, vz, vx + s * 10, vz, 7, 0); pad(0, 0, vx, vz, 4, 0);
    var mq = at(s * 19, D + R + 52), mast = [mq[0], mq[1]]; pad(mast[0], mast[1], mast[0], mast[1], 4, 1.2); pad(sites[0][0], sites[0][1], mast[0], mast[1], 2.5, sites[0][4], 1.2);
    var fall = function (u) { return 1.1 * u * u / (u + 20); };
    var sd = W.P.seed;
    var baseH = function (x, z, info) {
      var best = -1e9, ub = 0;
      for (var n = 0; n < pads.length; n++) {
        var p = pads[n], dx = p[2] - p[0], dz = p[3] - p[1], L2 = dx * dx + dz * dz;
        var t = L2 > 0 ? clamp(((x - p[0]) * dx + (z - p[1]) * dz) / L2, 0, 1) : 0;
        var ex = x - p[0] - dx * t, ez = z - p[1] - dz * t, u = Math.max(0, Math.sqrt(ex * ex + ez * ez) - p[4]);
        var hp = lerp(p[5], p[6], t) - fall(u);
        if (hp > best) { best = hp; ub = u; }
      }
      var rr = Math.sqrt(x * x + z * z);
      var hills = -VAL + 330 * Math.pow(fbm(x / 520 + 3, z / 520, sd + 21, 4), 1.6) * sstep(250, 700, rr) * (1 - sstep(1400, 2300, rr));
      var h = Math.max(best, hills);
      h += (fbm(x / 36, z / 36, sd + 5, 4) - 0.5) * 18 * sstep(3, 45, ub) + (fbm(x / 8, z / 8, sd + 6, 2) - 0.5) * 2.4 * sstep(1, 8, ub);
      // the clock and the camera stand on level ground, whatever the ridge does
      var sz = clamp(z, 0, D + 10), flat = Math.min(Math.sqrt(x * x + z * z) - (R + 5), Math.sqrt(x * x + (z - sz) * (z - sz)) - Math.max(6, R + 2.5));
      if (flat < 7) { h *= sstep(0, 7, flat); if (flat < 0) ub = 0; }
      if (info) info.u = ub;
      return h;
    };
    // the road: points in view to the right of the ridge, then smoothed on the slope
    var way = [[24, 64], [14, 96], [26, 140], [15, 200], [25, 290], [16, 420], [23, 620], [12, 900], [20, 1300], [6, 1900]];
    var ctrl = way.map(function (q) { var a = s * q[0] * D2R; return new THREE.Vector3(Math.sin(a) * q[1], 0, D - Math.cos(a) * q[1]); });
    ctrl.unshift(new THREE.Vector3(vx + s * 10, 0, vz));
    var curve = new THREE.CatmullRomCurve3(ctrl), NS = 260, rpts = curve.getSpacedPoints(NS), ry = [];
    for (i = 0; i <= NS; i++) ry.push(baseH(rpts[i].x, rpts[i].z));
    for (k = 0; k < 6; k++) for (i = 1; i < NS; i++) ry[i] = (ry[i - 1] + ry[i] * 2 + ry[i + 1]) / 4;
    ry[0] = 0;
    var roadD = function (x, z) {
      var best = 1e9, bi = 0;
      for (var n = 0; n <= NS; n += 2) { var dx = x - rpts[n].x, dz = z - rpts[n].z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = n; } }
      return [Math.sqrt(best), ry[bi]];
    };
    var hL = function (x, z, info) {
      var h = baseH(x, z, info), rd = roadD(x, z);
      if (rd[0] < 14) h = lerp(rd[1] - 0.05, h, sstep(4.2, 13, rd[0]));
      if (info) info.road = rd[0];
      return h;
    };
    var hW = function (wx, wz) { var q = F.loc(wx, wz); return hL(q[0], q[1]); };

    // summit mesh: a polar grid, dense near the pads, out to 2.3 km
    var NR = 150, NA = 220, pos = [], col = [], idx = [], info = {}, cc = new THREE.Color();
    var cRock = C('#7D7468'), cSoil = C('#6E5F4B'), cScrub = C('#4B4F37'), cPad = C('#8F8573');
    for (i = 0; i <= NR; i++) {
      var rr = 2300 * Math.pow(i / NR, 2.35);
      for (j = 0; j < NA; j++) {
        var a = j / NA * 6.2832, x = Math.sin(a) * rr, z = Math.cos(a) * rr, h = hL(x, z, info);
        pos.push(x, h, z);
        var n1 = fbm(x / 14, z / 14, sd + 8, 3), n2 = fbm(x / 90, z / 90, sd + 9, 3);
        cc.copy(cSoil).lerp(cScrub, sstep(0.35, 0.7, n2) * sstep(-40, -200, h) * 0.8 + 0.25 * sstep(0.5, 0.75, n1));
        cc.lerp(cRock, sstep(0.55, 0.8, n1) * sstep(3, 20, info.u) * 0.8);
        cc.lerp(cPad, 0.5 * (1 - sstep(0, 5, info.u)));
        if (info.road < 4.2) cc.set(0x2E2D2B);
        cc.multiplyScalar(0.86 + 0.28 * n1);
        col.push(cc.r, cc.g, cc.b);
      }
    }
    for (i = 0; i < NR; i++) for (j = 0; j < NA; j++) {
      var a0 = i * NA + j, b0 = i * NA + (j + 1) % NA, c0 = a0 + NA, d0 = b0 + NA;
      idx.push(a0, c0, b0, b0, c0, d0);
    }
    var mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    mg.setIndex(idx); mg.computeVertexNormals();
    var mtn = new THREE.Mesh(mg, detail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), 'stone', { tile: 2.6, albedo: 0.3, bump: 0.5 }));
    mtn.receiveShadow = true; mtn.castShadow = true; F.g.add(mtn);
    W.groundColor = C('#8A7C62');

    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    var kit = plc_kit()
      .def('juniper', new THREE.IcosahedronBufferGeometry(1, 1), std('#FFFFFF', 0.95, 0, { flatShading: true }))
      .def('pinon', new THREE.ConeBufferGeometry(1, 1, 7), std('#FFFFFF', 0.95, 0, { flatShading: true }))
      .def('trunk', new THREE.CylinderBufferGeometry(0.08, 0.12, 1, 5), std('#4E4034', 1))
      .def('rock', new THREE.DodecahedronBufferGeometry(1, 0), std('#8A837A', 1, 0, { flatShading: true, tex: 'stone', tile: 0.8 }))
      .def('bol', BOX, std('#2F3236', 0.6, 0.5))
      .def('red', BOX, plc_glow(W, '#FF2A1A', 0.15, 1.7), { cast: false })
      .def('stone', BOX, plc_tex('#B79D7A', 'plc_ashlar', 0.9, 0, 1.6, 0.4, 0.5))
      .def('slab', BOX, mtl('#B9AE9C', 'concrete', 0.9, 0, 2))
      .def('glass', BOX, (function () { var m = std('#20272D', 0.1, 0.6); m.emissive = C('#FF5A3A'); return W.glow(m, 0, 0.5); })())
      .def('mastM', new THREE.CylinderBufferGeometry(1, 1, 1, 6), std('#B8BCBF', 0.5, 0.7));

    // domes
    var domes = [];
    sites.forEach(function (q, n) {
      var d = plc_obsDome(W, q[2], q[3], rf(r, -0.8, 0.8), n * 1.3 + rf(r, -0.4, 0.4));
      d.g.position.set(q[0], q[4], q[1]);
      d.g.rotation.y = Math.atan2(-q[0], D - q[1]) * 0.5;
      F.g.add(d.g); domes.push(d);
      d.lamp.position.copy(F.w(q[0], q[1], q[4] + q[3] + 0.5));
      F.claim(q[0], q[1], q[2] + 2);
      W.onUpdate(d.update);
    });

    // the visitor building: a sandstone base, a band of glass, a long flat roof
    var VB = plc_m4(vx + s * 5, 0, vz, 1, 1, 1, 0, 0, 0);
    kit.box('stone', 0, 0.5, 0, 15, 1.0, 7, 0, null, VB);
    kit.box('glass', 0, 2.0, 0, 14.4, 2.0, 6.4, 0, null, VB);
    kit.box('stone', s * 5.5, 1.9, 0, 3.4, 2.8, 6.8, 0, null, VB);
    kit.box('slab', s * -1, 3.35, 0.4, 19, 0.35, 10, 0, null, VB);
    kit.box('stone', -s * 6.2, 2.2, -3.4, 0.9, 4.6, 0.9, 0, null, VB);
    for (i = 0; i < 6; i++) kit.box('bol', -6.5 + i * 2.6, 2.0, 3.25, 0.1, 2.0, 0.1, 0, null, VB);
    var vs = textPlane('VISITOR CENTER', { color: '#2E2A27', font: FONT_SANS, height: 0.34, px: 80, spacing: 0.18, pad: 0.1 });
    vs.position.set(vx + s * 5, 3.35, vz + 5.42); F.g.add(vs);
    W.lamp('#FF3A22', 1.1, 16, F.w(vx + s * 2, vz + 5, 2.8));
    W.lamp('#FF3A22', 0.9, 14, F.w(vx + s * 9, vz + 5, 2.8));
    F.claim(vx + s * 5, vz, 9);

    // the radio mast, with a red beacon
    var mh = baseH(mast[0], mast[1]), mastH = 24;
    kit.put('mastM', plc_m4(mast[0], mh + mastH / 2, mast[1], 0.16, mastH, 0.16));
    var beaconM = W.glow(glowMat('#FF2A1A', 0.6), 0.6, 2.2), beacon = sph(0.28, beaconM, 10, 8);
    beacon.position.set(mast[0], mh + mastH + 0.3, mast[1]); F.g.add(beacon);
    W.onUpdate(function (ctx) { beaconM.emissiveIntensity *= (Math.sin(ctx.real * 3.1) > 0.2 ? 1 : 0.15); });
    var guyM = new THREE.LineBasicMaterial({ color: C('#5A5D60') });
    for (i = 0; i < 3; i++) {
      var ga = i / 3 * 6.2832 + 0.4, gx = mast[0] + Math.sin(ga) * 10, gz = mast[1] + Math.cos(ga) * 10;
      F.g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mast[0], mh + mastH * 0.8, mast[1]), new THREE.Vector3(gx, baseH(gx, gz), gz)]), guyM));
    }
    F.claim(mast[0], mast[1], 3);

    // the road ribbon, with a painted centre line
    var rp = [], rix = [], lp = [];
    for (i = 0; i <= NS; i++) {
      var p0 = rpts[Math.max(0, i - 1)], p1 = rpts[Math.min(NS, i + 1)], tx = p1.x - p0.x, tz = p1.z - p0.z, tl = Math.sqrt(tx * tx + tz * tz) || 1;
      var nx = -tz / tl * 3.2, nz = tx / tl * 3.2, y = ry[i] + 0.08;
      rp.push(rpts[i].x + nx, y, rpts[i].z + nz, rpts[i].x - nx, y, rpts[i].z - nz);
      if (i < NS) rix.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      if (i % 3 === 0 && i < NS - 1) lp.push(new THREE.Vector3(rpts[i].x, y + 0.02, rpts[i].z), new THREE.Vector3((rpts[i].x + rpts[i + 1].x) / 2, y + 0.02, (rpts[i].z + rpts[i + 1].z) / 2));
    }
    var rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rgeo.setIndex(rix); rgeo.computeVertexNormals();
    var road = new THREE.Mesh(rgeo, mtl('#3A3936', 'concrete', 0.95, 0, 2.5)); road.receiveShadow = true; F.g.add(road);
    F.g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: C('#D9B24A') })));
    for (i = 0; i <= NS; i += 3) F.claim(rpts[i].x, rpts[i].z, 4);

    // red path lights along the ridge
    var nb = 0;
    pads.forEach(function (p, n) {
      if (n < 2) return;
      for (var t = 0.15; t < 1; t += 0.24) {
        var bx = lerp(p[0], p[2], t) + 2.2, bz = lerp(p[1], p[3], t);
        if (p[0] === p[2] && p[1] === p[3]) continue;
        var by = hL(bx, bz);
        kit.box('bol', bx, by + 0.4, bz, 0.14, 0.8, 0.14); kit.box('red', bx, by + 0.78, bz, 0.16, 0.08, 0.16); nb++;
      }
    });
    for (i = 0; i < 8; i++) { var ba = (i + 0.5) / 8 * 6.2832; kit.box('bol', Math.sin(ba) * (R + 3.4), 0.25, Math.cos(ba) * (R + 3.4), 0.16, 0.5, 0.16); kit.box('red', Math.sin(ba) * (R + 3.4), 0.52, Math.cos(ba) * (R + 3.4), 0.18, 0.06, 0.18); }
    W.lamp('#FF3A22', 0.8, 14, F.w(0, D * 0.5, 1.2));
    var sumPad = cyl(R + 3, R + 3.1, 0.08, 64, mtl('#958D80', 'stone', 0.9, 0, 1.6)); sumPad.position.y = 0.0; sumPad.receiveShadow = true; F.g.add(sumPad);

    // pinon, juniper and rock on the slopes
    var tc = new THREE.Color();
    for (i = 0; i < 2600; i++) {
      var ang = r() * 6.2832, dd = 14 + Math.pow(r(), 1.7) * 700, tx2 = Math.sin(ang) * dd, tz2 = Math.cos(ang) * dd;
      var th = hL(tx2, tz2, info);
      if (info.u < 5 || info.road < 5.5) continue;
      if (!F.free(tx2, tz2, 0.6)) continue;
      var big = dd > 160 ? 1.8 : 1, sc = rf(r, 0.5, 1.0) * big;
      tc.setHSL(rf(r, 0.19, 0.25), rf(r, 0.14, 0.26), rf(r, 0.1, 0.16));
      if (r() < 0.6) kit.put('juniper', plc_m4(tx2, th + 0.9 * sc, tz2, 1.2 * sc, 1.1 * sc, 1.2 * sc, 0, r() * 6, 0), tc.clone());
      else {
        kit.put('pinon', plc_m4(tx2, th + 1.5 * sc, tz2, 1.2 * sc, 2.6 * sc, 1.2 * sc, 0, r() * 6, 0), tc.clone().multiplyScalar(0.85));
        kit.put('trunk', plc_m4(tx2, th + 0.1, tz2, sc, 0.6 * sc, sc));
      }
    }
    for (i = 0; i < 320; i++) {
      var ra = r() * 6.2832, rd2 = 9 + Math.pow(r(), 1.3) * 200, rx = Math.sin(ra) * rd2, rz = Math.cos(ra) * rd2, rh = hL(rx, rz, info);
      if (info.u < 0.8 || info.road < 5) continue;
      if (!F.free(rx, rz, 0.5)) continue;
      var rs = rf(r, 0.25, 0.9) * (r() < 0.08 ? 2.2 : 1);
      kit.put('rock', plc_m4(rx, rh + rs * 0.2, rz, rs, rs * 0.7, rs * 1.1, r(), r() * 6, r()));
    }

    // Abloh: a public telescope in safety orange, quoted
    var op = placeInView(W, 0.8, 15, 22, D * 0.5, D * 0.8);
    if (op) {
      var og = new THREE.Group(), orange = std('#FF6B00', 0.45, 0.15), blk = std('#1E1F22', 0.5, 0.5);
      for (i = 0; i < 3; i++) { var la = i / 3 * 6.2832, leg = cyl(0.02, 0.025, 1.35, 6, blk); leg.position.set(Math.sin(la) * 0.25, 0.62, Math.cos(la) * 0.25); leg.rotation.set(Math.cos(la) * 0.38, 0, -Math.sin(la) * 0.38); og.add(leg); }
      var scope = cyl(0.09, 0.075, 1.1, 16, orange); scope.rotation.x = Math.PI / 2 - 0.6; scope.position.set(0, 1.45, 0.1); og.add(scope);
      var ol = plc_label('"LOOK UP"', '#FF6B00', '#111111', 0.13); ol.position.set(0, 1.12, 0.12); og.add(ol);
      og.position.copy(op); W.face(og); shade(og); W.add(og);
    }

    kit.flush(F.g);
    plc_scatter(W, { bushes: 160, rocks: 90, yucca: 0, bush: '#4E5A3A' }, hW);
    plc_drapeLate(W, hW);
    W.court = null;
  }

  // =====================================================================
  // 4. HADID PAVILION
  // A field of white ribs, each a little different from the last: they rise
  // from the terrazzo behind the clock and sweep overhead toward the camera,
  // leaning out at the edges, so the sun draws stripes across the floor. A
  // long reflecting pool, one eroded column with blue calcite inside (Arsham),
  // one bench with a safety orange label (Abloh).
  // =====================================================================
  function plc_hadid(W) {
    W.shadowExtent = 40;
    makeGround(W, '#C2AC86');
    makeRidges(W, 3100, false, '#6F6A7C'); makeRidges(W, 1400, true, '#8E7C63');
    var F = plc_frame(W), g = F.g, D = F.D, R = F.R, r = W.r, i, k, top = plc_heroTop(W), sp = W.P.seed % 2 ? 1 : -1;
    var N = ri(r, 34, 46), XW = Math.max(14, R + 9), ph = r() * 6.28, ph2 = r() * 6.28;
    var Hmin = Math.max(top + 2.4, F.h + 2.6, 6.2), tk = 0.17;
    var bone = mtl('#ECE7DE', 'plaster', 0.5, 0, 1.6);
    var ribs = [], apex = [], tips = [], feet = [];
    for (i = 0; i < N; i++) {
      var u = i / (N - 1), x = lerp(-XW, XW, u), E = Math.pow(Math.sin(Math.PI * u), 0.7);
      var H = Hmin + 3.4 * E + 1.1 * Math.sin(6.2832 * u * 1.4 + ph);
      var zf = -(R + 7.5 + 2.2 * (0.5 + 0.5 * Math.sin(Math.PI * u * 1.3 + ph2)) + 3.5 * (1 - E));
      var zt = lerp(-(R + 1), D * 0.72, Math.pow(E, 1.3)), yt = Math.max(H * 0.8 + 0.7 * Math.sin(u * 9 + ph), F.h + 1.9);
      var zm = lerp(zf + 5.5, zt, 0.45);
      var ctrl = [[zf, -0.4], [zf + 0.55, 0.3 * H], [zf + 2.1, 0.7 * H], [zf + 5.2, 0.95 * H], [zm, H], [lerp(zm, zt, 0.7), lerp(H, yt, 0.75)], [zt, yt]];
      if (zt < zf + 7) ctrl = ctrl.slice(0, 4).concat([[zf + 7.5, 0.9 * H]]);
      var curve = new THREE.SplineCurve(ctrl.map(function (q) { return new THREE.Vector2(q[0], q[1]); })), pts = curve.getPoints(72);
      var outer = [], inner = [];
      for (k = 0; k < pts.length; k++) {
        var a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dz = b.x - a.x, dy = b.y - a.y, dl = Math.sqrt(dz * dz + dy * dy) || 1;
        var t = k / (pts.length - 1), dep = lerp(1.35, 0.28, Math.pow(t, 0.85)) * (0.85 + 0.3 * E);
        outer.push(new THREE.Vector2(pts[k].x - dy / dl * dep / 2, pts[k].y + dz / dl * dep / 2));
        inner.push(new THREE.Vector2(pts[k].x + dy / dl * dep / 2, pts[k].y - dz / dl * dep / 2));
      }
      var shp = new THREE.Shape(outer.concat(inner.reverse()));
      var geo = new THREE.ExtrudeBufferGeometry(shp, { depth: tk, bevelEnabled: false, curveSegments: 1 });
      var basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0));
      var sig = 0.2 * Math.sin(Math.PI * (u - 0.5)) + 0.05 * Math.sin(u * 11 + ph2), lean = -0.3 * (u - 0.5);
      var M = new THREE.Matrix4().makeTranslation(x, 0, zf)
        .multiply(new THREE.Matrix4().makeRotationY(sig)).multiply(new THREE.Matrix4().makeRotationZ(lean))
        .multiply(new THREE.Matrix4().makeTranslation(tk / 2, 0, -zf)).multiply(basis);
      geo.applyMatrix4(M);
      ribs.push(geo);
      var pa = curve.getPoint(0.55), ptip = curve.getPoint(1);
      apex.push(new THREE.Vector3(0, pa.y, pa.x).applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0, zf).multiply(new THREE.Matrix4().makeRotationY(sig)).multiply(new THREE.Matrix4().makeRotationZ(lean)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -zf))));
      tips.push(new THREE.Vector3(0, ptip.y, ptip.x).applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0, zf).multiply(new THREE.Matrix4().makeRotationY(sig)).multiply(new THREE.Matrix4().makeRotationZ(lean)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -zf))));
      feet.push(new THREE.Vector3(x, 0.03, zf));
    }
    var shell = new THREE.Mesh(mergeGeos(ribs), bone);
    shell.castShadow = shell.receiveShadow = true; g.add(shell);
    // two continuous lines tie the field together: through the crowns and along the tips
    [apex, tips].forEach(function (pl, n) {
      var tb = new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(pl), N * 4, n ? 0.07 : 0.11, 8), bone);
      tb.castShadow = true; g.add(tb);
    });
    for (i = 0; i < N; i++) F.claim(feet[i].x, feet[i].z, 0.6);

    // the floor: a rounded slab of polished bone terrazzo, a brass line along the feet
    var FX = XW + 7, z0 = -(R + 30), z1 = D + 9, cr = 7;
    var slabS = new THREE.Shape();
    slabS.moveTo(-FX + cr, -z1); slabS.lineTo(FX - cr, -z1); slabS.quadraticCurveTo(FX, -z1, FX, -z1 + cr);
    slabS.lineTo(FX, -z0 - cr); slabS.quadraticCurveTo(FX, -z0, FX - cr, -z0); slabS.lineTo(-FX + cr, -z0);
    slabS.quadraticCurveTo(-FX, -z0, -FX, -z0 - cr); slabS.lineTo(-FX, -z1 + cr); slabS.quadraticCurveTo(-FX, -z1, -FX + cr, -z1);
    var px = sp * Math.min(XW * 0.55, R + 6.5), pw = 3.2, pz0 = -(R + 5), pz1 = D + 5;
    var hole = new THREE.Path(); hole.moveTo(px - pw / 2, -pz1); hole.lineTo(px + pw / 2, -pz1); hole.lineTo(px + pw / 2, -pz0); hole.lineTo(px - pw / 2, -pz0); hole.lineTo(px - pw / 2, -pz1);
    slabS.holes.push(hole);
    var sgeo = new THREE.ExtrudeBufferGeometry(slabS, { depth: 0.4, bevelEnabled: false, curveSegments: 10 });
    sgeo.rotateX(-Math.PI / 2); sgeo.translate(0, -0.38, 0);
    var terr = detail(std('#E9E4DA', 0.3, 0), 'terrazzo', { tile: 0.9, albedo: 0.32, rough: 0.3, bump: 0.08 });
    var slab = new THREE.Mesh(sgeo, terr); slab.receiveShadow = true; g.add(slab);
    var brass = std('#B8914C', 0.3, 1);
    var inlay = new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(feet.map(function (p) { return new THREE.Vector3(p.x, 0.02, p.z + 0.9); })), N * 3, 0.035, 5), brass);
    g.add(inlay);
    // the reflecting pool, sunk into the slab, with a lit lip
    var water = new THREE.Mesh(new THREE.PlaneBufferGeometry(pw, pz1 - pz0), std('#0B161B', 0.03, 1));
    water.rotation.x = -Math.PI / 2; water.position.set(px, -0.14, (pz0 + pz1) / 2); g.add(water);
    var lip = W.glow(glowMat('#E9F6FF', 0.0), 0.0, 1.3);
    [-1, 1].forEach(function (e) { var l = box(0.04, 0.03, pz1 - pz0 - 0.2, lip); l.position.set(px + e * (pw / 2 - 0.03), -0.05, (pz0 + pz1) / 2); g.add(l); });
    for (k = pz0; k < pz1; k += 5) F.claim(px, k, 2);

    // Arsham: an eroded column, blue calcite growing in its cavity
    var cands = [[-sp * (R + 3), -(R + 3)], [-sp * (R + 2.5), -(R + 5)], [-sp * (R + 4.5), -(R + 1)], [sp * (R + 2), -(R + 4.5)]], cp = null;
    for (i = 0; i < cands.length && !cp; i++) if (F.free(cands[i][0], cands[i][1], 1.1)) cp = cands[i];
    if (cp) {
      var col = new THREE.Group(), sel = mtl('#EFEDE6', 'plaster', 0.62, 0, 0.9), gap = 2.1, sd2 = W.P.seed;
      var base = cyl(0.62, 0.66, 1.25, 40, sel); base.position.y = 0.625; col.add(base);
      var mid = new THREE.CylinderBufferGeometry(0.62, 0.62, 1.5, 40, 12, true, gap / 2, 6.2832 - gap), mp = mid.attributes.position;
      for (k = 0; k < mp.count; k++) {
        var vx = mp.getX(k), vy = mp.getY(k), vz = mp.getZ(k), th = Math.atan2(vx, vz), edge = Math.min(Math.abs(th - gap / 2), Math.abs(th + gap / 2));
        if (edge < 0.45) { var n = fbm(vy * 3, th * 2, sd2, 3); var nth = th + Math.sign(th) * -(0.45 - edge) * (n - 0.3) * 0.9; mp.setXYZ(k, Math.sin(nth) * 0.62, vy, Math.cos(nth) * 0.62); }
      }
      mid.computeVertexNormals();
      var midM = new THREE.Mesh(mid, std('#EFEDE6', 0.62, 0, { side: THREE.DoubleSide })); midM.position.y = 1.25 + 0.75; col.add(midM);
      var cave = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.46, 0.46, 1.5, 24, 1, true), std('#6A625A', 0.95, 0, { side: THREE.BackSide })); cave.position.y = 2.0; col.add(cave);
      var ceil = cyl(0.62, 0.62, 0.02, 40, sel); ceil.position.y = 2.75; col.add(ceil);
      var upper = new THREE.CylinderBufferGeometry(0.6, 0.62, 1.7, 40, 6), upp = upper.attributes.position;
      for (k = 0; k < upp.count; k++) if (upp.getY(k) > 0.8) upp.setY(k, upp.getY(k) - 0.4 * fbm(upp.getX(k) * 3, upp.getZ(k) * 3, sd2 + 3, 3));
      upper.computeVertexNormals();
      var upM = new THREE.Mesh(upper, sel); upM.position.y = 2.75 + 0.85; col.add(upM);
      var calc = std('#BDEBFF', 0.1, 0.05); calc.emissive = C('#7FD4FF'); W.glow(calc, 0.85, 1.6);
      var cr2 = new THREE.InstancedMesh(new THREE.OctahedronBufferGeometry(1, 0), calc, 34);
      for (k = 0; k < 34; k++) {
        var cth = rf(r, -1.2, 1.2) + Math.PI, cy2 = rf(r, 1.35, 2.65), len = rf(r, 0.18, 0.42), rad2 = k < 28 ? 0.42 : 0.6;
        if (k >= 28) cth = (k % 2 ? 1 : -1) * rf(r, gap / 2 - 0.05, gap / 2 + 0.3);
        var mm = plc_m4(Math.sin(cth) * rad2, cy2, Math.cos(cth) * rad2, 0.1, len, 0.1, rf(r, -0.5, 0.5) + Math.PI / 2, cth, rf(r, -0.4, 0.4));
        cr2.setMatrixAt(k, mm);
      }
      cr2.frustumCulled = false; col.add(cr2);
      col.scale.setScalar(1.25); col.position.set(cp[0], 0, cp[1]); col.rotation.y = Math.atan2(-cp[0], D - cp[1]);
      shade(col); g.add(col); F.claim(cp[0], cp[1], 1.1);
      W.lamp('#7FD4FF', 1.0, 7, F.w(cp[0] + Math.sin(col.rotation.y) * 1.2, cp[1] + Math.cos(col.rotation.y) * 1.2, 2.0));
      W.pick(col, 'Eroded Column', 'A column worn open, blue calcite growing inside, after Daniel Arsham.');
    }

    // Abloh: a stone bench by the pool with one safety orange label
    var bpos = null, bc = [[px - sp * 2.8, -(R * 0.2) - 1], [px - sp * 2.8, 2], [px - sp * 2.8, -(R + 3)], [px + sp * 3, 0]];
    for (i = 0; i < bc.length && !bpos; i++) if (F.free(bc[i][0], bc[i][1], 1.5)) bpos = bc[i];
    if (bpos) {
      var bs = new THREE.Shape(), bl = 2.6, bw = 0.56, br = bw / 2;
      bs.moveTo(-bl / 2 + br, -bw / 2); bs.lineTo(bl / 2 - br, -bw / 2); bs.absarc(bl / 2 - br, 0, br, -Math.PI / 2, Math.PI / 2, false);
      bs.lineTo(-bl / 2 + br, bw / 2); bs.absarc(-bl / 2 + br, 0, br, Math.PI / 2, Math.PI * 1.5, false);
      var bgeo = new THREE.ExtrudeBufferGeometry(bs, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 });
      bgeo.rotateX(-Math.PI / 2);
      var bench = new THREE.Group(), bm = new THREE.Mesh(bgeo, mtl('#ECE7DE', 'terrazzo', 0.2, 0, 0.9)); bench.add(bm);
      var lab = plc_label('"PAVILION"', '#FF6B00', '#111111', 0.13); lab.position.set(bl * 0.18, 0.24, bw / 2 + 0.035); bench.add(lab);
      bench.position.set(bpos[0], 0.02, bpos[1]); bench.rotation.y = Math.atan2(-bpos[0], D - bpos[1]) * 0.5;
      shade(bench); g.add(bench); F.claim(bpos[0], bpos[1], 1.5);
    }

    // uplights at the feet, so the ribs glow after dark
    var up = new THREE.InstancedMesh(new THREE.CylinderBufferGeometry(0.11, 0.11, 0.025, 12), W.glow(glowMat('#FFF1DC', 0.05), 0.05, 0.45), Math.ceil(N / 2));
    for (i = 0, k = 0; i < N; i += 2, k++) up.setMatrixAt(k, plc_m4(feet[i].x, 0.03, feet[i].z + 1.3));
    up.count = k; up.frustumCulled = false; g.add(up);
    for (i = 0; i < 6; i++) { var fi = Math.round((i + 0.5) / 6 * (N - 1)); W.lamp('#FFE2C4', 0.5, 13, F.w(feet[fi].x, feet[fi].z + 1.4, 1.2)); }
    W.lamp('#FFE2C4', 0.3, 18, F.w(0, D * 0.5, 6.5));

    var n0 = W.occupied.length;
    F.claimRect(-FX, FX, z0, z1, 6);
    commonScatter(W, { bushes: 380, rocks: 220, yucca: 10, bush: '#6B7447' });
    W.occupied.splice(n0, W.occupied.length - n0);
  }

  // =====================================================================
  // 5. PRAIRIE TERRACE
  // Wright: compression and release. A low wing of raked sandstone runs along
  // one side of the view with a hearth, glass doors and a band of art glass,
  // and a Cherokee red roof slab cantilevers out over the terrace. When the
  // camera is low enough it stands under the roof and looks out. Sandstone
  // trays step down toward the desert, copper at every edge.
  // =====================================================================
  function plc_artGlass() {
    return canvasTex(128, 64, function (g) {
      g.fillStyle = '#EDE6D2'; g.fillRect(0, 0, 128, 64);
      g.strokeStyle = '#6E5A3A'; g.lineWidth = 2;
      [16, 64, 112].forEach(function (x) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); });
      [14, 50].forEach(function (y) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); });
      var cols = ['#B8452E', '#2F6E8C', '#D9A63A', '#5E8C4E', '#B8452E'];
      [[24, 20, 10], [40, 20, 6], [52, 30, 8], [76, 20, 10], [92, 34, 6], [100, 20, 8], [60, 40, 5]].forEach(function (q, i) {
        g.fillStyle = cols[i % cols.length]; g.fillRect(q[0], q[1], q[2], q[2]);
        g.strokeRect(q[0], q[1], q[2], q[2]);
      });
      g.beginPath(); g.moveTo(24, 58); g.lineTo(104, 58); g.moveTo(64, 50); g.lineTo(64, 64); g.stroke();
    });
  }
  function plc_prairie(W) {
    W.shadowExtent = 42;
    var ground = makeGround(W, '#BCA37C');
    makeRidges(W, 3100, false, '#6C6772'); makeRidges(W, 1400, true, '#8A785F');
    var F = plc_frame(W), g = F.g, D = F.D, R = F.R, r = W.r, i, k, s = (W.P.seed >> 1) % 2 ? 1 : -1;
    var XW = Math.max(R + 6, 8.5), WD = 8, zW1 = D + 10, zW0 = -(R + 17);
    var zB0 = -(R + 7), zB1 = zB0 - 9, zB2 = zB1 - 8;
    var T = [
      { y: 0, z0: zB0, z1: zW1 + 2, xa: -s * (R + 12), xb: s * (XW + WD) },
      { y: -0.8, z0: zB1, z1: zB0, xa: -s * (R + 16), xb: s * (XW + WD + 4) },
      { y: -1.6, z0: zB2, z1: zB1, xa: -s * (R + 20), xb: s * (XW + WD + 8) }
    ];
    T.forEach(function (t) { t.x0 = Math.min(t.xa, t.xb); t.x1 = Math.max(t.xa, t.xb); });
    var BX0 = T[2].x0, BX1 = T[2].x1, BZ0 = zB2, BZ1 = T[0].z1, DP = 2.4;
    var rectD = function (x, z) { var dx = Math.max(BX0 - x, 0, x - BX1), dz = Math.max(BZ0 - z, 0, z - BZ1); return Math.sqrt(dx * dx + dz * dz); };
    var basin = function (x, z) { return -DP * (1 - sstep(0, 95, rectD(x, z))); };
    var hL = function (x, z) {
      for (var n = 0; n < 3; n++) { var t = T[n]; if (x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1) return t.y; }
      return basin(x, z);
    };
    var hW = function (wx, wz) { var q = F.loc(wx, wz); return hL(q[0], q[1]); };
    // the desert falls away in front of the house
    var gp = ground.geometry.attributes.position;
    for (i = 0; i < gp.count; i++) { var q = F.loc(gp.getX(i), gp.getZ(i)); gp.setY(i, gp.getY(i) + basin(q[0], q[1])); }
    ground.geometry.computeVertexNormals();

    var BOX = new THREE.BoxBufferGeometry(1, 1, 1);
    var ash = plc_tex('#C8A97E', 'plc_ashlar', 0.9, 0, 1.6, 0.45, 0.6);
    var copper = std('#B06A3B', 0.36, 0.85), verd = std('#5E9C8C', 0.6, 0.5);
    var red = plc_tex('#7B3F32', 'concrete', 0.85, 0, 1.2, 0.25, 0.3);
    var doorLit = std('#2A2622', 0.12, 0.5); doorLit.emissive = C('#FFB86A'); W.glow(doorLit, 0, 0.75);
    var agTex = plc_artGlass(), ag = new THREE.MeshStandardMaterial({ map: agTex, emissiveMap: agTex, emissive: C('#FFD9A0'), roughness: 0.2, metalness: 0 });
    W.glow(ag, 0.25, 1.05);
    var kit = plc_kit()
      .def('ash', BOX, ash).def('pave', BOX, plc_tex('#D2B78E', 'stone', 0.85, 0, 2.2, 0.3, 0.3))
      .def('joint', BOX, std('#A88E6C', 0.95), { cast: false })
      .def('red', BOX, red).def('soffit', BOX, mtl('#8A5A3C', 'wood', 0.8, 0, 0.9)).def('copper', BOX, copper).def('verd', BOX, verd)
      .def('door', BOX, doorLit).def('wood', BOX, mtl('#6E4A30', 'wood', 0.8, 0, 0.8))
      .def('ag', new THREE.PlaneBufferGeometry(1, 1), ag, { cast: false })
      .def('down', new THREE.CylinderBufferGeometry(0.1, 0.1, 0.02, 12), W.glow(glowMat('#FFE0B0', 0.05), 0.05, 1.3), { cast: false })
      .def('lant', BOX, W.glow((function () { var m = std('#F3E2C0', 0.5); m.emissive = C('#FFC77E'); return m; })(), 0.15, 1.3))
      .def('shrub', new THREE.IcosahedronBufferGeometry(1, 0), std('#5F6A40', 0.95, 0, { flatShading: true }));
    var bx = function (key, x0, x1, y0, y1, z0, z1, col) { kit.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0), 0, col); };

    // the trays: a slab that overhangs its own wall by 0.8 m, raked stone below
    T.forEach(function (t, n) {
      bx('ash', t.x0 + 0.6, t.x1 - 0.6, -DP - 0.3, t.y - 0.3, t.z0 + 0.8, t.z1);
      bx('pave', t.x0, t.x1, t.y - 0.3, t.y, t.z0, t.z1);
      for (var x = Math.ceil(t.x0 / 1.6) * 1.6; x < t.x1; x += 1.6) bx('joint', x - 0.012, x + 0.012, t.y, t.y + 0.004, t.z0 + 0.05, n === 0 ? Math.min(t.z1, zW1) : t.z1);
      for (var z = t.z1 - 1.6; z > t.z0; z -= 1.6) bx('joint', t.x0 + 0.05, t.x1 - 0.05, t.y, t.y + 0.004, z - 0.012, z + 0.012);
      bx('copper', t.x0, t.x1, t.y - 0.34, t.y - 0.3, t.z0 - 0.02, t.z0 + 0.02);
    });
    // a low parapet along the clock terrace, open at a stair down to the next tray
    var stX = -s * 2.2;
    [[T[0].x0, stX - 1.6], [stX + 1.6, T[0].x1]].forEach(function (q) {
      if (q[1] - q[0] < 0.5) return;
      bx('ash', q[0], q[1], 0, 0.5, zB0 + 0.1, zB0 + 0.55);
      bx('pave', q[0] - 0.1, q[1] + 0.1, 0.5, 0.62, zB0, zB0 + 0.65);
    });
    for (k = 0; k < 3; k++) bx('pave', stX - 1.6, stX + 1.6, -0.8, -0.27 * k, zB0 - 0.42 * (k + 1), zB0 - 0.42 * k);
    for (k = 0; k < 3; k++) bx('pave', -stX - 1.6, -stX + 1.6, -1.6, -0.8 - 0.27 * k, zB1 - 0.42 * (k + 1), zB1 - 0.42 * k);
    // planters along the lower tray
    for (var px = T[1].x0 + 3; px < T[1].x1 - 3; px += 6.5) {
      if (Math.abs(px - (-stX)) < 2.5) continue;
      bx('ash', px - 1.4, px + 1.4, -0.8, -0.3, zB1 + 0.6, zB1 + 1.5);
      for (k = 0; k < 3; k++) kit.put('shrub', plc_m4(px - 0.9 + k * 0.9, -0.2, zB1 + 1.05, 0.45, 0.35, 0.4, 0, r() * 6, 0));
    }

    // the wing: piers and glass doors, a lintel, a band of art glass, a red roof
    var xi = s * XW, xo = s * (XW + WD), yR = 3.2, OH = Math.min(6, XW - R - 1.5);
    bx('ash', xo - s * 0.6, xo, 0, yR, zW0, zW1);
    bx('ash', xi, xo, 0, yR, zW0, zW0 + 0.6); bx('ash', xi, xo, 0, yR, zW1 - 0.6, zW1);
    for (var z = zW1 - 0.6; z > zW0 + 0.6; z -= 3.0) {
      bx('ash', xi, xi + s * 0.7, 0, 2.25, z - 0.8, z);
      if (z - 3.0 > zW0 + 0.6) bx('door', xi + s * 0.3, xi + s * 0.36, 0, 2.25, z - 3.0, z - 0.8);
    }
    bx('ash', xi, xi + s * 0.7, 2.25, 2.45, zW0, zW1);
    for (z = zW1 - 0.6; z > zW0 + 0.6; z -= 1.2) {
      kit.put('ag', plc_m4(xi + s * 0.36, 2.75, z - 0.6, 1.14, 0.58, 1, 0, -s * Math.PI / 2, 0));
      bx('copper', xi + s * 0.3, xi + s * 0.42, 2.45, 3.05, z - 0.03, z + 0.03);
    }
    bx('copper', xi + s * 0.28, xi + s * 0.44, 3.02, 3.2, zW0, zW1);
    var rx0 = xo + s * 1.8, rx1 = s * (XW - OH), rz0 = zW0 - 2.8, rz1 = zW1 + 1;
    bx('soffit', rx0, rx1, yR, yR + 0.12, rz0, rz1); bx('red', rx0, rx1, yR + 0.12, yR + 0.45, rz0, rz1);
    bx('copper', rx1 - s * 0.06, rx1 + s * 0.06, yR - 0.08, yR + 0.52, rz0, rz1);
    bx('verd', rx1 - s * 0.02, rx1 + s * 0.1, yR - 0.14, yR - 0.06, rz0, rz1);
    bx('copper', rx0, rx1, yR - 0.08, yR + 0.52, rz0 - 0.06, rz0 + 0.06);
    // a second, higher plane over the wing: Wright's layered roofs
    bx('red', xi + s * 0.5, xo + s * 1.0, yR + 1.1, yR + 1.4, zW0 + 3, zW1 - 4);
    bx('ash', xi + s * 1.0, xo - s * 1.0, yR + 0.45, yR + 1.1, zW0 + 4, zW1 - 5);
    for (z = zW0 + 4.5; z < zW1 - 5.5; z += 1.2) kit.put('ag', plc_m4(xi + s * 0.98, yR + 0.78, z + 0.6, 1.1, 0.5, 1, 0, -s * Math.PI / 2, 0));
    // downlights in the soffit
    var soff = [];
    for (z = rz1 - 2; z > rz0 + 1; z -= 3) { var dx2 = (rx1 + xi) / 2; kit.box('down', dx2, yR - 0.01, z, 1, 1, 1); soff.push([dx2, z]); }
    soff.sort(function (a, b) { return Math.abs(a[1]) - Math.abs(b[1]); });
    soff.slice(0, 3).forEach(function (p) { W.lamp('#FFD9A8', 0.8, 12, F.w(p[0], p[1], yR - 0.3)); });
    // compression: when the camera is low, the roof reaches over it
    var arm = F.h < 2.75 && F.look < F.h + 0.6 && plc_heroTop(W) < 5.5 && D - clamp((yR - F.h) / 0.26, 2.5, 6) > R + 1.5;
    if (arm) {
      var ax1 = -s * 1.8, az0 = D - clamp((yR - F.h) / 0.26, 2.5, 6), az1 = D + 5;
      bx('soffit', rx1, ax1, yR, yR + 0.12, az0, az1); bx('red', rx1, ax1, yR + 0.12, yR + 0.45, az0, az1);
      bx('copper', rx1, ax1, yR - 0.08, yR + 0.52, az0 - 0.06, az0 + 0.06);
      bx('copper', ax1 - s * 0.06, ax1 + s * 0.06, yR - 0.08, yR + 0.52, az0, az1);
      bx('ash', ax1 - 0.4, ax1 + 0.4, 0, yR, az1 - 1.4, az1 - 0.6);
      kit.box('down', (rx1 + ax1) / 2, yR - 0.01, (az0 + az1) / 2, 1, 1, 1);
      W.lamp('#FFD9A8', 0.6, 10, F.w((rx1 + ax1) / 2, (az0 + az1) / 2, yR - 0.3));
    }

    // the hearth: a sandstone mass through the roof, a fire you can see from the terrace
    var zH = -(R + 6.5), hx0 = s * (XW - 1.8), hx1 = s * (XW + 1.4), hz0 = zH - 1.8, hz1 = zH + 1.8;
    bx('ash', hx0, hx1, 0, 5.8, hz0, hz1);
    bx('copper', hx0 - s * 0.05, hx1 + s * 0.05, 5.8, 5.95, hz0 - 0.05, hz1 + 0.05);
    bx('ash', hx0 - s * 1.1, hx0, 0, 0.42, hz0 - 0.4, hz1 + 0.4);
    var fire = new THREE.Group(), fm = W.glow(glowMat('#FF7A2A', 0.35), 0.35, 1.25);
    var hearthBack = box(0.06, 1.05, 1.5, std('#1A1411', 0.9)); hearthBack.position.set(hx0 + s * 0.02, 0.42 + 0.55, zH); fire.add(hearthBack);
    var emb = box(0.5, 0.16, 1.2, fm); emb.position.set(hx0 - s * 0.05, 0.52, zH); fire.add(emb);
    for (k = 0; k < 3; k++) { var lg = cyl(0.07, 0.07, 1.1, 6, std('#3A2A20', 1)); lg.rotation.x = Math.PI / 2; lg.position.set(hx0 - s * (0.05 + k * 0.12), 0.62 + (k % 2) * 0.08, zH); fire.add(lg); }
    g.add(fire);
    var fl = W.lamp('#FF9A4A', 1.5, 14, F.w(hx0 - s * 0.8, zH, 1.0));
    W.onUpdate(function (ctx) { fl.intensity *= 0.82 + 0.18 * Math.sin(ctx.real * 7.3) * Math.sin(ctx.real * 3.1 + 1); });
    F.claim(s * (XW - 0.2), zH, 2.6);

    // Wright lanterns at the corners of the trays, and two copper urns
    [[T[0].x0 + 0.5, zB0 + 0.35, 0.62], [T[0].x1 - 0.5, zB0 + 0.35, 0.62], [T[1].x0 + 0.6, zB1 + 0.4, -0.8], [T[1].x1 - 0.6, zB1 + 0.4, -0.8]].forEach(function (p, n) {
      bx('ash', p[0] - 0.28, p[0] + 0.28, p[2], p[2] + 0.75, p[1] - 0.28, p[1] + 0.28);
      bx('lant', p[0] - 0.2, p[0] + 0.2, p[2] + 0.75, p[2] + 1.15, p[1] - 0.2, p[1] + 0.2);
      bx('copper', p[0] - 0.32, p[0] + 0.32, p[2] + 1.15, p[2] + 1.23, p[1] - 0.32, p[1] + 0.32);
      if (n < 2) W.lamp('#FFC98A', 0.7, 9, F.w(p[0], p[1], p[2] + 1.0));
    });
    var urnPts = [[0, 0], [0.18, 0], [0.2, 0.08], [0.12, 0.2], [0.14, 0.34], [0.46, 0.5], [0.52, 0.56], [0.5, 0.6], [0, 0.58]].map(function (q) { return new THREE.Vector2(q[0], q[1]); });
    var urnG = new THREE.LatheBufferGeometry(urnPts, 20);
    var urnM = std('#5E9C8C', 0.6, 0.5);
    [stX - 2.2, stX + 2.2].forEach(function (x) { var u = new THREE.Mesh(urnG, urnM); u.position.set(x, 0.62, zB0 + 0.32); u.castShadow = true; g.add(u); });

    // Abloh: a safety orange stool by the fire
    var stool = new THREE.Group(), so = std('#FF6B00', 0.5);
    var st = box(0.46, 0.44, 0.46, so); st.position.y = 0.22; stool.add(st);
    var sl = plc_label('"HEARTH"', '#FF6B00', '#111111', 0.1); sl.position.set(0, 0.26, 0.232); stool.add(sl);
    stool.position.set(hx0 - s * 2.1, 0, zH + 1.4); stool.rotation.y = Math.atan2(-(hx0 - s * 2.1), D - zH) * 0.7;
    shade(stool); g.add(stool); F.claim(hx0 - s * 2.1, zH + 1.4, 0.5);

    kit.flush(g);
    shade(g, true, true);
    // claims: the wing and the roof pier are solid; the trays are walkable
    var n0 = W.occupied.length;
    F.claimRect(BX0, BX1, BZ0, BZ1, 5);
    plc_scatter(W, { bushes: 420, rocks: 240, yucca: 12, ocotillo: 5, bush: '#6A7247' }, hW);
    W.occupied.splice(n0, W.occupied.length - n0);
    F.claimRect(Math.min(xi, xo) - 0.5, Math.max(xi, xo) + 0.5, zW0, zW1, 2.5);
    plc_drapeLate(W, hW);
    plc_bounce(W, '#FFE9CF', '#9C7A58', 0.25);
  }

  // ------------------------------------------------------------ register
  // r124 keeps the first program a material compiles, so a material must never
  // be shared between an InstancedMesh and a plain Mesh: every file here keeps
  // kit materials inside the kit.
  // Roofed places only take clocks that fit under the roof, never a clock that
  // keeps time by the sun (a sundial under a roof reads nothing), and never one
  // that belongs outdoors (a windmill, a pumpjack, a scoreboard).
  var plc_fits = function (maxH) { return function (clock, def) { return !def.solar && !def.outdoor && (def.height || 6) <= maxH; }; };
  [
    ['Artillery Shed', 12, [], plc_shed, plc_fits(10)],
    ['Highland Avenue', 12, [], plc_highland],
    ['Observatory Ridge', 12, [], plc_observatory],
    ['Hadid Pavilion', 12, [], plc_hadid, plc_fits(14)],
    ['Prairie Terrace', 12, [], plc_prairie]
  ].forEach(function (q) { definePlace(q[0], { w: q[1], eggs: q[2], build: q[3], accepts: q[4] }); });
