  // =====================================================================
  // WORLD: materials, ground, mountains, plants, the six places
  // =====================================================================
  // Hero materials. `tex` is the procedural detail kind, `tile` its size in
  // metres. The last six come from the practice's house palette: Cherokee red
  // and sandstone for Wright, bone white for Hadid, selenite for Arsham.
  var MATERIALS = {
    'Travertine':       { color: '#D9CBB0', rough: 0.78, metal: 0.0,  trim: '#6E5E48', tex: 'stone',    tile: 1.2 },
    'Brass':            { color: '#B58B4C', rough: 0.4,  metal: 1.0,  trim: '#3A2A14', tex: 'brushed',  tile: 0.8 },
    'Weathering Steel': { color: '#8A4526', rough: 0.86, metal: 0.25, trim: '#2E170C', tex: 'rust',     tile: 1.4 },
    'Mill Aluminum':    { color: '#C9CDD2', rough: 0.34, metal: 0.95, trim: '#2A2E33', tex: 'brushed',  tile: 0.9 },
    'Concrete':         { color: '#B4AC9F', rough: 0.95, metal: 0.0,  trim: '#4B463F', tex: 'concrete', tile: 1.8 },
    'Caliche Stone':    { color: '#DCCFB6', rough: 0.9,  metal: 0.0,  trim: '#6B5D45', tex: 'stone',    tile: 1.5 },
    'Ink Black':        { color: '#1A1C20', rough: 0.45, metal: 0.3,  trim: '#F0F4F8', tex: 'paint',    tile: 1.0 },
    'Blossom Blue':     { color: '#2962FF', rough: 0.4,  metal: 0.1,  trim: '#F0F4F8', tex: 'paint',    tile: 1.0 },
    'Bone White':       { color: '#EDE8DF', rough: 0.5,  metal: 0.0,  trim: '#1A1C20', tex: 'plaster',  tile: 1.4 },
    'Cherokee Red':     { color: '#7B3F32', rough: 0.9,  metal: 0.0,  trim: '#F0EFEA', tex: 'concrete', tile: 1.2 },
    'Desert Sandstone': { color: '#C8A97E', rough: 0.92, metal: 0.0,  trim: '#4A3522', tex: 'stone',    tile: 2.0 },
    'Patinated Copper': { color: '#5E9C8C', rough: 0.7,  metal: 0.55, trim: '#1E2F2A', tex: 'rust',     tile: 1.0 },
    'Terrazzo':         { color: '#E6E0D4', rough: 0.3,  metal: 0.0,  trim: '#1A1C20', tex: 'terrazzo', tile: 0.9 },
    'Obsidian':         { color: '#121216', rough: 0.28, metal: 0.2,  trim: '#E9E6DE', tex: 'marble',   tile: 1.6 },
    'Selenite':         { color: '#F0EFEA', rough: 0.35, metal: 0.0,  trim: '#3B4A58', tex: 'crystal',  tile: 0.7 }
  };
  function std(hex, rough, metal, extra) {
    var m = new THREE.MeshStandardMaterial({ color: C(hex), roughness: rough == null ? 0.8 : rough, metalness: metal || 0 });
    if (extra) for (var k in extra) if (k !== 'tex' && k !== 'tile') m[k] = extra[k];
    if (extra && extra.tex) detail(m, extra.tex, { tile: extra.tile || 1.5 });
    return m;
  }
  // a textured standard material in one call: mtl('#hex', 'concrete', rough, metal, tileMetres)
  function mtl(hex, kind, rough, metal, tile) { return std(hex, rough, metal, { tex: kind, tile: tile }); }
  function heroMat(name) { var d = MATERIALS[name] || MATERIALS.Concrete; var m = std(d.color, d.rough, d.metal, { tex: d.tex, tile: d.tile }); m.userData.heroBase = true; return m; }
  function glowMat(hex, strength) {
    var m = std('#111418', 0.5, 0);
    m.emissive = C(hex); m.emissiveIntensity = strength == null ? 1 : strength;
    return m;
  }
  function shade(o, cast, recv) {
    o.traverse(function (c) { if (c.isMesh) { c.castShadow = cast !== false; c.receiveShadow = recv !== false; } });
    return o;
  }
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxBufferGeometry(w, h, d), mat); }
  function cyl(rt, rb, h, seg, mat) { return new THREE.Mesh(new THREE.CylinderBufferGeometry(rt, rb, h, seg || 16), mat); }
  function sph(rad, mat, ws, hs) { return new THREE.Mesh(new THREE.SphereBufferGeometry(rad, ws || 16, hs || 12), mat); }

  // ------------------------------------------------------------ the world context
  function World(P, rng) {
    this.P = P; this.r = rng;
    this.root = new THREE.Group();
    this.updates = [];
    this.glows = [];           // materials whose glow follows the dark
    this.lamps = [];           // point lights that come on at night
    this.occupied = [];        // [x, z, radius]
    this.cam = null;
  }
  World.prototype.add = function (o) { this.root.add(o); return o; };
  World.prototype.onUpdate = function (f) { this.updates.push(f); };
  World.prototype.glow = function (mat, day, night) { this.glows.push([mat, day, night]); return mat; };
  // a point light that comes on at night. Pass a parent group to have it move
  // and turn with that group (pos is then in the group's own coordinates).
  World.prototype.lamp = function (color, intensity, dist, pos, parent) {
    var l = new THREE.PointLight(C(color), 0, dist);
    l.position.copy(pos); l.userData.full = intensity;
    this.lamps.push(l); (parent || this.root).add(l);
    return l;
  };
  World.prototype.claim = function (x, z, rad) { this.occupied.push([x, z, rad]); };
  World.prototype.free = function (x, z, rad) {
    for (var i = 0; i < this.occupied.length; i++) {
      var o = this.occupied[i], dx = x - o[0], dz = z - o[1];
      if (dx * dx + dz * dz < (rad + o[2]) * (rad + o[2])) return false;
    }
    // keep the line of sight from the camera to the clock clear
    var c = this.cam, ax = c.pos.x, az = c.pos.z, bx = 0, bz = 0;
    var t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), 0, 1);
    var px = ax + (bx - ax) * t - x, pz = az + (bz - az) * t - z;
    return px * px + pz * pz > (rad + 2.2) * (rad + 2.2);
  };
  // a point on the ground, seen from the camera: `off` degrees right of the
  // line to the clock, `dist` metres away
  World.prototype.inView = function (off, dist) {
    var c = this.cam, a = off * D2R;
    return new THREE.Vector3(c.pos.x + (c.dir.x * Math.cos(a) + c.right.x * Math.sin(a)) * dist, 0,
      c.pos.z + (c.dir.z * Math.cos(a) + c.right.z * Math.sin(a)) * dist);
  };
  // turn an object so its local +z faces the camera
  World.prototype.face = function (o, tx, tz) {
    var c = this.cam;
    o.rotation.y = Math.atan2(c.pos.x - (tx == null ? o.position.x : tx), c.pos.z - (tz == null ? o.position.z : tz));
    return o;
  };

  // ------------------------------------------------------------ ground
  function makeGround(W, hex, opts) {
    opts = opts || {};
    var seg = 180, size = 9000, geo = new THREE.PlaneBufferGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, col = [], base = C(hex), c = new THREE.Color(), s = W.P.seed;
    // denser rings near the middle: warp the grid toward the centre
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), rr = Math.sqrt(x * x + z * z), k = rr / (size / 2);
      var warp = Math.pow(k, 2.2) / Math.max(k, 1e-6);
      x *= warp; z *= warp; rr *= warp;
      var h = (fbm(x / 520, z / 520, s, 4) - 0.45) * (opts.relief || 26) * sstep(90, 900, rr);
      pos.setXYZ(i, x, h, z);
      var n = fbm(x / 26, z / 26, s + 5, 3), n2 = fbm(x / 140, z / 140, s + 9, 3);
      c.copy(base).multiplyScalar(0.78 + 0.34 * n + 0.18 * (n2 - 0.5));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    var grit = false && canvasTex(256, 256, function (g) {
      var r = seedRng(s ^ 99);
      g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 5000; i++) {
        var v = Math.floor(120 + r() * 136);
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        g.fillRect(r() * 256, r() * 256, 1 + r() * 2.5, 1 + r() * 2.5);
      }
      if (opts.cracks) {
        g.strokeStyle = 'rgba(70,60,50,0.55)'; g.lineWidth = 1.4;
        for (i = 0; i < 26; i++) {
          var x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y);
          for (var k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
          g.stroke();
        }
      }
    }, { repeat: [900, 900] });
    var mat = detail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), opts.cracks ? 'cracks' : 'sand', { tile: opts.cracks ? 3.2 : 2.0, albedo: opts.cracks ? 0.5 : 0.2, rough: 0.4, bump: 0.35 });
    var m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    W.add(m);
    W.groundColor = base;
    return m;
  }

  // ------------------------------------------------------------ mountains
  // Real bearings from Marfa: the Davis Mountains to the north, the Chinati
  // Mountains to the southwest, the Sierra Vieja to the west.
  function ridgeHeight(az, s, near) {
    var a = az * D2R, h = 30 + 80 * fbm(Math.cos(a) * 3 + 11, Math.sin(a) * 3 + 7, s, 5);
    if (!near) {
      h += 230 * Math.exp(-Math.pow(((az - 15 + 540) % 360 - 180) / 38, 2));   // Davis Mountains
      h += 170 * Math.exp(-Math.pow(((az - 225 + 540) % 360 - 180) / 30, 2));  // Chinati Mountains
      h += 90 * Math.exp(-Math.pow(((az - 280 + 540) % 360 - 180) / 22, 2));   // Sierra Vieja
    }
    return h;
  }
  function makeRidges(W, dist, near, tintHex) {
    var N = 360, rows = 5, pos = [], col = [], idx = [], s = W.P.seed + (near ? 3 : 0);
    var base = C(tintHex), c = new THREE.Color();
    for (var i = 0; i <= N; i++) {
      var az = i / N * 360, hh = ridgeHeight(az, s, near) * (near ? 0.45 : 1);
      for (var j = 0; j < rows; j++) {
        var t = j / (rows - 1), rr = dist + (1 - t) * (near ? 160 : 420);
        var jag = (fbm(az * 0.9, j * 3.1, s + 2, 3) - 0.5) * hh * 0.35 * t;
        var y = -30 + (hh + jag) * Math.pow(t, 0.8);
        pos.push(Math.sin(az * D2R) * rr, y, -Math.cos(az * D2R) * rr);
        c.copy(base).multiplyScalar(0.62 + 0.5 * t + 0.14 * fbm(az * 2, j, s + 4, 2));
        col.push(c.r, c.g, c.b);
      }
    }
    for (i = 0; i < N; i++) for (j = 0; j < rows - 1; j++) {
      var a = i * rows + j, b = (i + 1) * rows + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
    W.add(m);
    return m;
  }

  // ------------------------------------------------------------ plants and rocks
  function scatter(W, geo, mat, count, rmin, rmax, sizeFn, o) {
    o = o || {};
    var mesh = new THREE.InstancedMesh(geo, mat, count), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    var e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), r = W.r, n = 0, tries = 0;
    while (n < count && tries < count * 8) {
      tries++;
      var a = r() * Math.PI * 2, d = Math.sqrt(lerp(rmin * rmin, rmax * rmax, r()));
      var x = Math.sin(a) * d, z = -Math.cos(a) * d, s = sizeFn(r);
      if (!W.free(x, z, s * (o.pad || 0.6))) continue;
      e.set(o.tilt ? rf(r, -o.tilt, o.tilt) : 0, r() * 6.28, o.tilt ? rf(r, -o.tilt, o.tilt) : 0);
      q.setFromEuler(e);
      v.set(x, (o.lift || 0) * s, z);
      sc.set(s * (o.sx || 1), s * (o.sy || 1), s * (o.sz || 1));
      m4.compose(v, q, sc);
      mesh.setMatrixAt(n++, m4);
    }
    mesh.count = n;
    mesh.castShadow = !!o.cast; mesh.receiveShadow = true;
    W.add(mesh);
    return mesh;
  }
  function grassBlade() {
    var g = new THREE.ConeBufferGeometry(0.035, 1, 3, 1);
    g.translate(0, 0.5, 0);
    return g;
  }
  function tuftGeometry() {
    // five blades leaning out from one root
    var parts = [], i;
    for (i = 0; i < 5; i++) {
      var b = grassBlade(), m = new THREE.Matrix4(), a = i / 5 * 6.28;
      m.makeRotationFromEuler(new THREE.Euler(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35));
      b.applyMatrix4(m);
      parts.push(b);
    }
    return mergeGeos(parts);
  }
  function mergeGeos(list) {
    var pos = [], nor = [], idx = [], off = 0;
    list.forEach(function (g) {
      var gi = g.index ? g : g;
      var p = gi.attributes.position.array, nn = gi.attributes.normal.array;
      for (var i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(nn[i]); }
      if (gi.index) { var ia = gi.index.array; for (i = 0; i < ia.length; i++) idx.push(ia[i] + off); }
      else for (i = 0; i < p.length / 3; i++) idx.push(i + off);
      off += p.length / 3;
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setIndex(idx);
    return out;
  }
  function yucca(r) {
    var g = new THREE.Group(), trunkH = rf(r, 0.4, 1.6);
    var tr = cyl(0.09, 0.13, trunkH, 6, std('#5B4A36', 1)); tr.position.y = trunkH / 2; g.add(tr);
    var leaf = new THREE.ConeBufferGeometry(0.025, 0.75, 3), lm = std('#6E7F4A', 0.8);
    for (var i = 0; i < 26; i++) {
      var l = new THREE.Mesh(leaf, lm), a = i * 2.4, up = rf(r, 0.1, 1.3);
      l.position.set(Math.sin(a) * 0.12, trunkH + 0.25, Math.cos(a) * 0.12);
      l.rotation.set(Math.cos(a) * up, 0, -Math.sin(a) * up, 'YXZ');
      g.add(l);
    }
    return shade(g);
  }
  function ocotillo(r) {
    var g = new THREE.Group(), m = std('#57603F', 0.9), n = ri(r, 9, 16);
    for (var i = 0; i < n; i++) {
      var h = rf(r, 2.2, 4.2), s = cyl(0.018, 0.035, h, 5, m), a = r() * 6.28, lean = rf(r, 0.05, 0.35);
      s.geometry.translate(0, h / 2, 0);
      s.rotation.set(Math.cos(a) * lean, 0, Math.sin(a) * lean);
      g.add(s);
    }
    return shade(g);
  }
  function cottonwood(r) {
    var g = new THREE.Group(), bark = std('#5E5042', 1), leaf = std('#6F8A3E', 0.9, 0, { flatShading: true });
    var t = cyl(0.22, 0.34, 3.2, 7, bark); t.position.y = 1.6; g.add(t);
    for (var i = 0; i < 9; i++) {
      var b = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(rf(r, 1.2, 2.1), 0), leaf);
      b.position.set(rf(r, -2, 2), rf(r, 3.4, 5.6), rf(r, -2, 2));
      g.add(b);
    }
    return shade(g);
  }
  // grass that moves: a vertex shader sways each blade by its height, phased by
  // where it stands, at the token's wind speed
  function swayMat(mat, W) {
    var u = { swT: { value: 0 }, swW: { value: W.windSpeed || 1 } };
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.swT = u.swT; shader.uniforms.swW = u.swW;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float swT; uniform float swW;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'float swH = max(transformed.y, 0.0);',
          'vec4 swP = vec4(0.0, 0.0, 0.0, 1.0);',
          '#ifdef USE_INSTANCING',
          '  swP = instanceMatrix * swP;',
          '#endif',
          'float swPh = swP.x * 0.37 + swP.z * 0.23;',
          'float swG = 0.6 + 0.4 * sin(swT * 0.5 + swP.x * 0.05);',
          'transformed.x += sin(swT * 1.9 + swPh) * 0.16 * swH * swW * swG;',
          'transformed.z += cos(swT * 1.4 + swPh * 1.3) * 0.09 * swH * swW * swG;'
        ].join('\n'));
    };
    mat.customProgramCacheKey = function () { return 'sway-1'; };
    W.onUpdate(function (ctx) { u.swT.value = ctx.real; });
    return mat;
  }
  function commonScatter(W, o) {
    o = o || {};
    var rock = new THREE.DodecahedronBufferGeometry(1, 0);
    scatter(W, rock, std('#8C7B66', 1, 0, { flatShading: true, tex: 'stone', tile: 0.6 }), o.rocks || 260, 6, 220, function (r) { return rf(r, 0.08, 0.5) * (r() < 0.06 ? 3 : 1); }, { sy: 0.55, lift: 0.1, cast: true });
    var bush = new THREE.IcosahedronBufferGeometry(1, 0);
    scatter(W, bush, std(o.bush || '#5D6841', 0.95, 0, { flatShading: true }), o.bushes || 520, 5, 260, function (r) { return rf(r, 0.25, 0.75); }, { sy: 0.6, lift: 0.35, cast: true });
    if (o.grass) {
      scatter(W, tuftGeometry(), swayMat(std(o.grass, 0.95, 0), W), o.tufts || 3200, 3, 120, function (r) { return rf(r, 0.25, 0.55); }, { tilt: 0.12 });
    }
    var i, p, n = o.yucca == null ? 14 : o.yucca;
    for (i = 0; i < n; i++) {
      p = W.inView(rf(W.r, -34, 34), rf(W.r, 12, 90));
      if (!W.free(p.x, p.z, 0.8)) continue;
      var y = yucca(W.r); y.position.copy(p); W.add(y); W.claim(p.x, p.z, 0.8);
    }
    n = o.ocotillo || 0;
    for (i = 0; i < n; i++) {
      p = W.inView(rf(W.r, -34, 34), rf(W.r, 14, 80));
      if (!W.free(p.x, p.z, 1.2)) continue;
      var oc = ocotillo(W.r); oc.position.copy(p); W.add(oc); W.claim(p.x, p.z, 1.2);
    }
  }

  // ------------------------------------------------------------ Judd, in concrete
  // An open box of 25 cm slabs, 2.5 by 2.5 by 5 metres, after the fifteen
  // untitled works in concrete at the Chinati Foundation.
  function concreteUnit(mat) {
    var g = new THREE.Group(), t = 0.25, s = 2.5, L = 5;
    var top = box(s, t, L, mat); top.position.y = s - t / 2; g.add(top);
    var bot = box(s, t, L, mat); bot.position.y = t / 2; g.add(bot);
    var l = box(t, s, L, mat); l.position.set(-s / 2 + t / 2, s / 2, 0); g.add(l);
    var rr = box(t, s, L, mat); rr.position.set(s / 2 - t / 2, s / 2, 0); g.add(rr);
    return g;
  }
  function juddRow(W, near, far, offA, offB, count) {
    var mat = mtl('#BDB4A6', 'concrete', 0.95, 0, 2.5), a = W.inView(offA, near), b = W.inView(offB, far), n = count || 9;
    for (var i = 0; i < n; i++) {
      var p = a.clone().lerp(b, i / (n - 1)), grp = new THREE.Group(), k = ri(W.r, 1, 3);
      for (var j = 0; j < k; j++) {
        var u = concreteUnit(mat);
        if (W.r() < 0.5) u.rotation.y = Math.PI / 2;
        u.position.set(j * 2.9, 0, 0);
        grp.add(u);
      }
      grp.position.copy(p);
      grp.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + (W.r() < 0.3 ? Math.PI / 2 : 0);
      var bs = blobShadow(k * 3.2, 6.4, 0.35); grp.add(bs);
      shade(grp, false, true);
      W.add(grp);
      W.claim(p.x, p.z, k * 3);
    }
  }

  // ------------------------------------------------------------ the six places
  var PLACE_BUILD = {
    'Chinati Field': function (W) {
      makeGround(W, '#B39A64');
      makeRidges(W, 3100, false, '#6F6A74'); makeRidges(W, 1300, true, '#8C7A62');
      commonScatter(W, { grass: '#B59E66', tufts: 3600, bushes: 260, rocks: 140, yucca: 10 });
      juddRow(W, 70, 190, rf(W.r, -28, -12), rf(W.r, 8, 26), ri(W.r, 7, 11));
    },
    'Highway 90': function (W) {
      makeGround(W, '#A99066');
      makeRidges(W, 3100, false, '#6C6772'); makeRidges(W, 1400, true, '#8A785F');
      var c = W.cam, dRoad = c.dist + rf(W.r, 16, 26);
      var center = new THREE.Vector3(c.pos.x + c.dir.x * dRoad, 0, c.pos.z + c.dir.z * dRoad);
      var road = new THREE.Group(), L = 2400;
      var tex = canvasTex(64, 512, function (g) {
        g.fillStyle = '#3B3A38'; g.fillRect(0, 0, 64, 512);
        var r = seedRng(90);
        for (var i = 0; i < 1400; i++) { var v = 45 + r() * 40 | 0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 2) + ')'; g.fillRect(r() * 64, r() * 512, 1.5, 1.5); }
        g.fillStyle = '#E6E1D3'; g.fillRect(2, 0, 2, 512); g.fillRect(60, 0, 2, 512);
        g.fillStyle = '#E3B23C'; g.fillRect(30, 0, 1.6, 300); g.fillRect(33, 0, 1.6, 300);
      }, { repeat: [1, L / 24] });
      var asphalt = new THREE.Mesh(new THREE.PlaneBufferGeometry(7.6, L), std('#FFFFFF', 0.92, 0, { map: tex }));
      asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = 0.06; asphalt.receiveShadow = true;
      road.add(asphalt);
      var shoulder = new THREE.Mesh(new THREE.PlaneBufferGeometry(12, L), std('#8F8067', 1));
      shoulder.rotation.x = -Math.PI / 2; shoulder.position.y = 0.04; shoulder.receiveShadow = true;
      road.add(shoulder);
      road.position.copy(center);
      road.rotation.y = Math.atan2(c.right.x, c.right.z);
      W.add(road);
      W.road = { center: center, along: c.right.clone(), across: c.dir.clone(), width: 7.6 };
      W.claim(center.x, center.z, 0);
      // telephone poles and wires on the far side
      var poleM = mtl('#5B4B3B', 'wood', 1, 0, 1.2), wireM = new THREE.LineBasicMaterial({ color: C('#2A2622') });
      var tops = [];
      for (var i = -12; i <= 12; i++) {
        var p = center.clone().addScaledVector(c.right, i * 62 + 13).addScaledVector(c.dir, 9);
        var pole = cyl(0.13, 0.16, 9, 6, poleM); pole.position.set(p.x, 4.5, p.z);
        var bar = box(2.2, 0.12, 0.12, poleM); bar.position.set(p.x, 8.4, p.z); bar.rotation.y = road.rotation.y + Math.PI / 2;
        W.add(pole); W.add(bar); tops.push(p);
      }
      for (i = 0; i < tops.length - 1; i++) {
        for (var w = -1; w <= 1; w += 2) {
          var pts = [], a = tops[i], b = tops[i + 1];
          for (var k = 0; k <= 12; k++) {
            var t = k / 12, q = a.clone().lerp(b, t);
            q.y = 8.4 - Math.sin(t * Math.PI) * 0.9;
            q.x += c.dir.x * w * 0.95; q.z += c.dir.z * w * 0.95;
            pts.push(q);
          }
          W.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
        }
      }
      // barbed wire fence between the clock and the road
      var fM = mtl('#6B5A45', 'wood', 1, 0, 0.6), fl = [];
      for (i = -60; i <= 60; i++) {
        var fp = center.clone().addScaledVector(c.right, i * 4.2).addScaledVector(c.dir, -7);
        if (fp.distanceTo(new THREE.Vector3()) < W.heroR + 3) continue;
        var post = cyl(0.05, 0.06, 1.3, 5, fM); post.position.set(fp.x, 0.65, fp.z); post.castShadow = true; W.add(post);
        fl.push(fp);
      }
      [0.45, 0.8, 1.15].forEach(function (hgt) {
        var pts = fl.map(function (p) { return new THREE.Vector3(p.x, hgt, p.z); });
        W.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
      });
      // mile marker 317
      var mm = center.clone().addScaledVector(c.dir, -5.2).addScaledVector(c.right, rf(W.r, -14, 14));
      var sign = new THREE.Group();
      var sp = cyl(0.04, 0.04, 1.4, 6, std('#8D9196', 0.4, 0.8)); sp.position.y = 0.7; sign.add(sp);
      var face = textPlane(['MILE', '317'], { bg: '#1E6B3C', color: '#FFFFFF', font: FONT_SANS, height: 0.62, px: 80, pad: 0.25 });
      face.position.y = 1.35; face.position.z = 0.05; sign.add(face);
      var backM = box(face.userData.w, 0.62, 0.03, std('#8D9196', 0.4, 0.8)); backM.position.y = 1.35; sign.add(backM);
      sign.position.copy(mm); W.face(sign); shade(sign); W.add(sign);
      commonScatter(W, { bushes: 380, rocks: 200, yucca: 8 });
    },
    'Marfa Lights Viewing Area': function (W) {
      makeGround(W, '#A58F6B');
      makeRidges(W, 3000, false, '#66637A'); makeRidges(W, 1500, true, '#7F735F');
      var p = W.inView(rf(W.r, -30, -18) * (W.r() < 0.5 ? 1 : -1), rf(W.r, 16, 24)), g = new THREE.Group();
      var stone = std('#9C8C78', 1, 0, { flatShading: true, tex: 'stone', tile: 0.9 }), steel = mtl('#4A4E54', 'rust', 0.5, 0.7, 1.2);
      var pad = box(10, 0.3, 6, mtl('#A9A39A', 'concrete', 0.95, 0, 2)); pad.position.y = 0.15; g.add(pad);
      [[-4.5, -2.5], [4.5, -2.5], [-4.5, 2.5], [4.5, 2.5]].forEach(function (q) {
        var col = box(0.35, 3, 0.35, steel); col.position.set(q[0], 1.8, q[1]); g.add(col);
      });
      var roof = box(11, 0.25, 7, steel); roof.position.y = 3.35; g.add(roof);
      var wall = box(10, 0.9, 0.5, stone); wall.position.set(0, 0.75, -2.7); g.add(wall);
      var signp = textPlane(['MARFA LIGHTS', 'VIEWING AREA'], { bg: '#6B3E26', color: '#F3E7D2', height: 1.1, px: 90, spacing: 0.08 });
      signp.position.set(0, 1.5, 3.3); g.add(signp);
      g.position.copy(p); W.face(g); shade(g); W.add(g); W.claim(p.x, p.z, 7);
      commonScatter(W, { grass: '#A89066', tufts: 1800, bushes: 420, rocks: 220, yucca: 12 });
    },
    'Salt Playa': function (W) {
      makeGround(W, '#DCD3C2', { cracks: true, relief: 10 });
      makeRidges(W, 3300, false, '#747085'); makeRidges(W, 1700, true, '#9A8B77');
      commonScatter(W, { bushes: 90, rocks: 60, yucca: 0, bush: '#7A7E5A' });
    },
    'Mesa Rim': function (W) {
      makeGround(W, '#B47B52');
      makeRidges(W, 3000, false, '#77616A'); makeRidges(W, 1500, true, '#9A6247');
      var strata = ['#A4583A', '#C98A5E', '#B8704A', '#DDB08A', '#9C4E33'];
      for (var i = 0; i < ri(W.r, 3, 5); i++) {
        var p = W.inView(rf(W.r, -40, 40), rf(W.r, 420, 950)), mesa = new THREE.Group(), R = rf(W.r, 50, 120), hh = 0;
        for (var j = 0; j < ri(W.r, 3, 5); j++) {
          var sh = new THREE.Shape(), n = 14, rr = R * (1 - j * 0.12);
          for (var k = 0; k < n; k++) {
            var a = k / n * 6.2832, q = rr * (0.75 + 0.35 * vnoise(k * 0.7, j + i * 5, W.P.seed));
            if (k === 0) sh.moveTo(Math.cos(a) * q, Math.sin(a) * q); else sh.lineTo(Math.cos(a) * q, Math.sin(a) * q);
          }
          var th = rf(W.r, 6, 15);
          var geo = new THREE.ExtrudeBufferGeometry(sh, { depth: th, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          var m = new THREE.Mesh(geo, std(strata[(i + j) % strata.length], 1, 0, { flatShading: true, tex: 'stone', tile: 9 }));
          m.position.y = hh; hh += th; mesa.add(m);
        }
        mesa.position.copy(p); W.add(mesa); W.claim(p.x, p.z, R);
      }
      commonScatter(W, { bushes: 340, rocks: 320, yucca: 16, ocotillo: 9, bush: '#66703F' });
      var pear = new THREE.SphereBufferGeometry(1, 7, 5);
      scatter(W, pear, std('#6D8A4B', 0.8, 0, { flatShading: true }), 120, 6, 90, function (r) { return rf(r, 0.14, 0.26); }, { sx: 1, sy: 1.2, sz: 0.3, lift: 1, tilt: 0.6, cast: true });
    },
    'Adobe Courtyard': function (W) {
      makeGround(W, '#C3AE8E', { relief: 14 });
      makeRidges(W, 3100, false, '#6C6772'); makeRidges(W, 1400, true, '#8A785F');
      var c = W.cam, half = Math.max(c.dist + 5, W.heroR + 9), adobe = mtl('#CFA27A', 'plaster', 0.95, 0, 1.6), cap = mtl('#BE926C', 'plaster', 0.95, 0, 1.6);
      var g = new THREE.Group(), H = 2.8, T = 0.5, vig = mtl('#6B5238', 'wood', 1, 0, 0.8);
      var sides = [[0, -half, 2 * half + T, 0], [0, half, 2 * half + T, 0], [-half, 0, 2 * half + T, 1], [half, 0, 2 * half + T, 1]];
      sides.forEach(function (s, i) {
        var len = s[2], seg = [[-len / 2, len / 2]];
        if (i === 2) seg = [[-len / 2, -1.2], [1.2, len / 2]];            // a doorway
        seg.forEach(function (q) {
          var l = q[1] - q[0], wmesh = box(l, H, T, adobe);
          wmesh.position.set((q[0] + q[1]) / 2, H / 2, 0);
          var capm = box(l, 0.12, T + 0.08, cap); capm.position.set((q[0] + q[1]) / 2, H + 0.06, 0);
          var part = new THREE.Group(); part.add(wmesh); part.add(capm);
          for (var x = q[0] + 0.7; x < q[1] - 0.5; x += 1.3) {
            var v = cyl(0.1, 0.1, T + 0.7, 7, vig); v.rotation.x = Math.PI / 2; v.position.set(x, H - 0.35, 0); part.add(v);
          }
          part.position.set(s[0], 0, s[1]);
          if (s[3]) part.rotation.y = Math.PI / 2;
          g.add(part);
        });
      });
      var door = box(2.2, 2.3, 0.1, std('#2E7F8F', 0.6)); door.position.set(-half, 1.15, 0); door.rotation.y = Math.PI / 2; door.position.x -= 0.4;
      g.add(door);
      // the courtyard turns to face the camera, so the back wall sits behind the clock
      g.rotation.y = Math.atan2(c.dir.x, c.dir.z);
      shade(g); W.add(g);
      W.court = { half: half, group: g, H: H };
      var tr = cottonwood(W.r), tp = W.inView(rf(W.r, 22, 30) * (W.r() < 0.5 ? 1 : -1), c.dist + half * 0.55);
      tr.position.copy(tp); W.add(tr);
      // string lights
      var bulbM = W.glow(glowMat('#FFC98A', 0.2), 0.25, 2.2), bulbG = new THREE.SphereBufferGeometry(0.06, 6, 5);
      for (var s2 = -1; s2 <= 1; s2++) {
        var a = new THREE.Vector3(-half + 0.3, H, -half + 0.3 + (s2 + 1) * half * 0.5), b = new THREE.Vector3(half - 0.3, H, -half + 0.3 + (s2 + 1) * half * 0.6);
        for (var k = 0; k <= 22; k++) {
          var t = k / 22, q = a.clone().lerp(b, t); q.y -= Math.sin(t * Math.PI) * 0.8;
          var bl = new THREE.Mesh(bulbG, bulbM); bl.position.copy(q).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y); W.add(bl);
        }
      }
      W.lamp('#FFB870', 2.2, 40, new THREE.Vector3(0, 3.2, 0));
      commonScatter(W, { bushes: 60, rocks: 90, yucca: 3, bush: '#6A7247' });
    }
  };

  // register the six original places
  [['Chinati Field', 20, ['Judd Boxes']], ['Highway 90', 20, ['Prada Marfa', 'Mile Marker 317']], ['Marfa Lights Viewing Area', 14, ['Marfa Lights']],
    ['Salt Playa', 12], ['Mesa Rim', 14], ['Adobe Courtyard', 14]].forEach(function (q) {
    definePlace(q[0], { w: q[1], eggs: q[2] || [], build: PLACE_BUILD[q[0]] });
  });
