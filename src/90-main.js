  // =====================================================================
  // PLAN: everything the hash decides. Needs no WebGL, runs in node.
  // =====================================================================
  var SKIES = [['Clear', 42], ['Scattered', 26], ['Monsoon', 13], ['Dust', 10], ['Blue Norther', 9]];
  var WINDS = [['Calm', 28], ['Breeze', 46], ['Gusty', 26]];
  // Abloh owns the text: every clock wears a quoted museum label
  var TAGS = ['"CLOCK"', '"TIME"', '"SHADOW"', '"SCULPTURE"', '"NOW"', '"LATER"', '"MARFA"', '"317"', '"HOLD STILL"', '"LIVE"', '"WAIT"', '"SUN"'];

  function plan(hash) {
    var r = hashRng(hash, 1);
    var clock = pickW(r, weighted(CLOCK_DEFS)), cd = CLOCK_DEFS[clock];
    var place = pickW(r, weighted(PLACE_DEFS, function (p) { return !p.accepts || p.accepts(clock, cd); }));
    var observatory = obsPlan(hash, clock, place);
    place = observatory.place;
    var pd = PLACE_DEFS[place];
    var material = pick(r, cd.mats);
    var sky = pickW(r, pd.skies || SKIES), wind = pickW(r, WINDS), film = pickW(r, FILM_WEIGHTS), tag = pick(r, TAGS);
    var eggs = [];
    (pd.eggs || []).concat(cd.eggs || []).forEach(function (e) { if (EGG_DEFS[e] && eggs.indexOf(e) < 0) eggs.push(e); });
    var extra = ri(r, 2, 5), guard = 0;
    var pool = weighted(EGG_DEFS, function (e) { return !e.places || e.places.indexOf(place) >= 0; });
    while (extra > 0 && guard++ < 80) {
      var e = pickW(r, pool);
      if (eggs.indexOf(e) < 0) { eggs.push(e); extra--; }
    }
    var camAz = cd.solar ? 180 + rf(r, -55, 55) : r() * 360;
    var camK = rf(r, 0.94, 1.1), camHk = r();
    // a minute from the residency, for stills: April 2027, weighted to low sun
    var day = ri(r, 1, 28), night = r() < 0.12, tm, a = r(), b = r();
    if (night) tm = 21.2 + a * 2.6;
    else tm = 7.3 + 12.4 * (Math.abs(a - 0.5) > Math.abs(b - 0.5) ? a : b);
    var hh = Math.floor(tm), mi = Math.floor((tm - hh) * 60);
    var seed = parseInt(hash.slice(2, 9), 16) % 1000003;
    var ct = cd.traits ? cd.traits(hashRng(hash, 3)) : {};
    var features = { 'Clock': clock };
    for (var k in ct) features[k] = ct[k];
    features['Keeps Time By'] = cd.keeps;
    features['Place'] = place;
    features['Material'] = material;
    features['Sky'] = sky;
    features['Wind'] = wind;
    features['Film'] = film;
    features['Tag'] = tag;
    // the generative layer (48-generative.js) draws from its own stream, so it
    // never moves the draws above
    var gen = typeof genPlan === 'function' ? genPlan(hash, clock, cd, place, PLACE_DEFS[place], sky) : { features: {} };
    for (var gk in gen.features) features[gk] = gen.features[gk];
    if (observatory.place === 'Meridian Cloister' || observatory.place === 'Aeolian Court' || observatory.place === 'Contour Passage') {
      features['Architecture'] = observatory.place; features['Bays'] = observatory.bays; features['Architectural Finish'] = observatory.finish; features['Water Study'] = observatory.water;
      if (observatory.place === 'Aeolian Court') features['Aperture'] = observatory.aperture;
    }
    features['Easter Eggs'] = eggs.join(' · ');
    features['Egg Count'] = eggs.length;
    if (eggs.indexOf('First Eye Flower') >= 0) features['Witness Bloom'] = 'Solar-responsive / six bone petals';
    if (eggs.indexOf('Chromie Squiggle') >= 0) { var sq = OBS_SQUIGGLES[Math.floor(hashRng(hash, 710)() * OBS_SQUIGGLES.length)]; features['Chromie Reference Token'] = '#' + sq.id; features['Chromie Reference Type'] = sq.type; features['Reference Display'] = 'Artist-hosted original / viewer only'; }
    return {
      gen: gen, observatory: observatory,
      hash: hash, seed: seed, clock: clock, place: place, material: material, sky: sky, wind: wind, film: film, tag: tag,
      eggs: eggs, clockTraits: ct, camAz: camAz, camK: camK, camHk: camHk, windAz: r() * 360,
      stillUtc: marfaUtc(2027, 4, day, hh, mi), stillLabel: 'APR ' + day + ' 2027 ' + pad2(hh) + ':' + pad2(mi),
      features: features
    };
  }

  // =====================================================================
  // BUILD: one world from one plan
  // =====================================================================
  function tagPlaque(W, hero) {
    var g = new THREE.Group(), post = cyl(0.03, 0.03, 0.95, 8, mtl('#2A2C30', 'brushed', 0.4, 0.8, 0.5));
    post.position.y = 0.47; g.add(post);
    var face = textPlane([W.P.tag, W.P.clock.toUpperCase(), 'MLOW  ·  MARFA LIGHT  ·  2027'], {
      bg: '#F4F2EC', color: '#111111', font: FONT_SANS, height: 0.36, px: 64, pad: 0.35, align: 'left'
    });
    face.position.set(0, 1.02, 0.02); face.rotation.x = -0.35; g.add(face);
    var back = box(face.userData.w + 0.02, 0.38, 0.02, mtl('#2A2C30', 'brushed', 0.4, 0.8, 0.5)); back.position.set(0, 1.02, 0); back.rotation.x = -0.35; g.add(back);
    // one safety orange strap, zip-tied round the post
    var strap = new THREE.Mesh(new THREE.TorusBufferGeometry(0.045, 0.012, 6, 16), std('#FF6B00', 0.6));
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.62; g.add(strap);
    var tail = box(0.012, 0.09, 0.02, std('#FF6B00', 0.6)); tail.position.set(0.05, 0.58, 0); tail.rotation.z = 0.3; g.add(tail);
    var d = W.cam.dir, R = hero.R + 0.6;
    var side = (W.P.seed % 2 ? 1 : -1);
    g.position.set(-d.x * R + W.cam.right.x * side * R * 0.45, 0, -d.z * R + W.cam.right.z * side * R * 0.45);
    W.face(g); shade(g); W.add(g);
    W.pick(g, 'Label', W.P.tag + ' A museum label in quotation marks, after Virgil Abloh. Every clock wears one.');
  }

  function buildWorld(P, renderer, atUtc) {
    var W = new World(P, hashRng(P.hash, 7));
    W.dst = marfaTime(atUtc).dst;
    W.picks = [];
    W.pick = function (obj, name, line) { this.picks.push({ obj: obj, name: name, line: line }); };
    W.windSpeed = { 'Calm': 0.25, 'Breeze': 1, 'Gusty': 2.1 }[P.wind];
    W.windDir = dirAzEl(P.windAz, 0);
    var scene = new THREE.Scene();
    scene.add(W.root);
    var cd = CLOCK_DEFS[P.clock];
    var n0 = W.root.children.length, hero = cd.build(W, P.material);
    W.heroParts = W.root.children.slice(n0);        // anything the builder added straight to the world
    W.heroR = hero.R; W.claim(0, 0, hero.R);
    W.root.add(hero.group);
    W.pick(hero.group, P.clock, cd.line || ('Keeps Marfa time by ' + cd.keeps.toLowerCase() + '.'));
    // a lens from the generative layer: { fov, distK, hK, azOff (degrees) }
    var lens = typeof genCamera === 'function' ? genCamera(P, hero) : null;
    var dist = hero.dist * P.camK * (lens && lens.distK || 1), camH = lerp(hero.camH[0], hero.camH[1], P.camHk) * (lens && lens.hK || 1);
    var camAz = P.camAz + (lens && lens.azOff || 0);
    var pos = new THREE.Vector3(Math.sin(camAz * D2R) * dist, camH, -Math.cos(camAz * D2R) * dist);
    var dir = new THREE.Vector3(-pos.x, 0, -pos.z).normalize();
    W.cam = { pos: pos, dir: dir, right: new THREE.Vector3(-dir.z, 0, dir.x), dist: dist, h: camH, lookY: hero.lookY };
    if (hero.face) hero.group.rotation.y = Math.atan2(pos.x, pos.z);
    PLACE_DEFS[P.place].build(W);
    tagPlaque(W, hero);
    P.eggs.forEach(function (e) {
      var d = EGG_DEFS[e];
      if (!d || !d.build) return;
      var before = W.root.children.length;
      d.build(W);
      for (var i = before; i < W.root.children.length; i++) {
        var o = W.root.children[i];
        if (o.isMesh || o.isGroup) W.pick(o, e, d.line || e);
      }
    });
    if (typeof genBuild === 'function') genBuild(W, hero);
    addLife(W);
    // the sky
    W.sky = makeSky(); scene.add(W.sky);
    W.stars = makeStars(); scene.add(W.stars);
    W.moon = makeMoon(); scene.add(W.moon);
    W.clouds = makeClouds(W.r, P.sky === 'Dust' || P.sky === 'Blue Norther' ? 'Scattered' : P.sky, P.camAz + 180); scene.add(W.clouds);
    // light
    W.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); scene.add(W.hemi);
    var key = new THREE.DirectionalLight(0xffffff, 1), S = Math.max(hero.R + (hero.shadowPad || 7), W.shadowExtent || 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -S; key.shadow.camera.right = S; key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
    key.shadow.camera.near = 1; key.shadow.camera.far = 600;
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03;
    scene.add(key); scene.add(key.target);
    W.key = key;
    scene.fog = new THREE.FogExp2(0xffffff, 0.00028);
    W.pmrem = new THREE.PMREMGenerator(renderer);
    W.envScene = new THREE.Scene();
    W.envScene.add(new THREE.Mesh(W.sky.geometry, W.sky.material));
    W.envAt = -99; W.envReal = -99;
    W.camera = new THREE.PerspectiveCamera(lens && lens.fov || 38, 1.5, 0.3, 9500);
    W.camAz = camAz;
    W.camera.position.copy(pos);
    W.hero = hero;
    W.scene = scene;
    unshareMaterials(scene);
    W.exposure = 1;
    return W;
  }

  var SKY_TUNE = {
    'Clear':        { cloud: 1,    fog: 0.00024, dust: 0 },
    'Scattered':    { cloud: 0.9,  fog: 0.00026, dust: 0 },
    'Monsoon':      { cloud: 0.62, fog: 0.00042, dust: 0 },
    'Dust':         { cloud: 0.7,  fog: 0.0011,  dust: 1 },
    'Blue Norther': { cloud: 0.95, fog: 0.00016, dust: 0 }
  };
  var _dustCol = null, _nortCol = null;
  function updateWorld(W, renderer, ctx) {
    var sun = ctx.sun, moon = ctx.moon, L = lightAt(sun.el), cam = W.camera, tune = SKY_TUNE[W.P.sky] || SKY_TUNE.Clear;
    if (!_dustCol) { _dustCol = C('#C8A27A'); _nortCol = C('#1B3F8A'); }
    var cloudF = tune.cloud;
    var night = 1 - sstep(-7, 2, sun.el);
    ctx.night = night; ctx.wind = W.windSpeed; ctx.windDir = W.windDir;
    var u = W.sky.material.uniforms;
    u.zen.value.copy(L.zen); u.hor.value.copy(L.hor);
    if (W.P.sky === 'Monsoon') u.zen.value.lerp(L.hor, 0.25).multiplyScalar(0.85);
    if (tune.dust) { u.zen.value.lerp(_dustCol.clone().multiplyScalar(0.6 + 0.4 * (1 - night)), 0.45 * (1 - night)); u.hor.value.lerp(_dustCol, 0.55 * (1 - night)); }
    if (W.P.sky === 'Blue Norther') u.zen.value.lerp(_nortCol, 0.35 * (1 - night));
    u.gnd.value.copy(W.groundColor).multiplyScalar(0.25 + L.ambient * 0.6);
    dirAzEl(sun.az, sun.el, u.sunDir.value);
    u.sunCol.value.copy(L.sun);
    u.glow.value = sstep(-10, 0, sun.el) * cloudF;
    u.disk.value = sstep(-1.2, 0.3, sun.el) * (W.P.sky === 'Monsoon' || tune.dust ? 0.4 : 1);
    W.sky.position.copy(cam.position);
    starMatrix(lst(ctx.utc), cam.position, W.stars.matrix);
    W.stars.material.opacity = sstep(-4, -13, sun.el) * (W.P.sky === 'Monsoon' || tune.dust ? 0.45 : 1);
    var md = dirAzEl(moon.az, moon.el, new THREE.Vector3());
    W.moon.position.copy(cam.position).addScaledVector(md, 4100);
    W.moon.material.uniforms.sunDir.value.copy(u.sunDir.value);
    W.moon.material.uniforms.gain.value = 0.55 + 0.9 * night;
    W.moon.visible = moon.el > -3;
    var key = W.key, kd = new THREE.Vector3();
    if (sun.el > -1.5) {
      dirAzEl(sun.az, Math.max(sun.el, 0.6), kd);
      key.color.copy(L.sun);
      if (tune.dust) key.color.lerp(_dustCol, 0.3);
      key.intensity = L.direct * 3.1 * cloudF * sstep(-1.5, 2.5, sun.el);
    } else if (moon.el > 0) {
      dirAzEl(moon.az, Math.max(moon.el, 1), kd);
      key.color.copy(C('#A9BCE0'));
      key.intensity = 0.42 * moon.illum * sstep(0, 12, moon.el) * cloudF;
    } else key.intensity = 0;
    key.position.copy(kd).multiplyScalar(160); key.target.position.set(0, 0, 0);
    W.hemi.color.copy(L.zen).lerp(L.hor, 0.5);
    W.hemi.groundColor.copy(W.groundColor).multiplyScalar(0.5);
    W.hemi.intensity = L.ambient * 1.25 + night * 0.1 + (tune.dust ? 0.15 : 0);
    if (W.P.sky === 'Monsoon' && night > 0.5) {
      W.flash = (W.flash || 0) - ctx.dt;
      if (W.flash < -rf(W.r, 5, 18)) W.flash = 0.25;
      if (W.flash > 0) { W.hemi.intensity += 1.6 * W.flash / 0.25; u.zen.value.addScalar(0.15 * W.flash); }
    }
    W.clouds.rotation.y = (ctx.utc % 86400) * 0.000015 * (0.5 + W.windSpeed) + W.P.seed;
    var cm = W.clouds.userData.mat;
    if (cm) {
      cm.color.copy(L.hor).lerp(L.sun, 0.25 * (1 - night)).lerp(C('#FFFFFF'), 0.45 * (1 - night));
      cm.emissive.copy(L.hor).multiplyScalar(0.35 * (1 - night)).add(L.zen.clone().multiplyScalar(1.1 * night));
    }
    W.scene.fog.color.copy(u.hor.value).lerp(u.zen.value, 0.15);
    W.scene.fog.density = tune.fog;
    W.glows.forEach(function (g) { g[0].emissiveIntensity = lerp(g[1], g[2], night); });
    W.lamps.forEach(function (l) { l.intensity = l.userData.full * night; });
    var level = L.ambient + L.direct * Math.max(Math.sin(Math.max(sun.el, 0) * D2R), 0.3) * cloudF;
    W.exposure = clamp(0.7 / level, 0.62, 1.75);
    if (W.hero.update) W.hero.update(ctx);
    for (var i = 0; i < W.updates.length; i++) W.updates[i](ctx);
    if ((Math.abs(sun.el - W.envAt) > 1.5 || ctx.snap) && (ctx.real - W.envReal > 2 || ctx.snap)) {
      if (W.envRT) W.envRT.dispose();
      W.envRT = W.pmrem.fromScene(W.envScene, 0.04, 1, 9000);
      W.scene.environment = W.envRT.texture;
      W.envAt = sun.el; W.envReal = ctx.real;
    }
  }

  // r124 compiles one program per material and does not recheck it per object,
  // so a material drawn by a plain mesh, an instanced mesh and an instanced mesh
  // with per-instance colour must be three materials. Any file can slip here
  // (clones, shared kits, the generative skins), so the world is checked once,
  // after everything is built: each kind after the first gets its own copy.
  // A wide screen with a wide lens stretches everything near the edges. The
  // lens keeps its vertical view, but never sees more than 72 degrees across.
  var MAX_HFOV = 72;
  function fitCamera(cam, w, h) {
    cam.aspect = w / h;
    if (cam.userData.fov0 == null) cam.userData.fov0 = cam.fov;
    var vmax = 2 * Math.atan(Math.tan(MAX_HFOV * D2R / 2) / cam.aspect) * R2D;
    cam.fov = Math.min(cam.userData.fov0, vmax);
    cam.updateProjectionMatrix();
  }
  function unshareMaterials(scene) {
    var seen = new Map();
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      var kind = o.isInstancedMesh ? (o.instanceColor ? 'ic' : 'i') : 'm', e = seen.get(o.material);
      if (!e) { e = { first: kind, copies: {} }; seen.set(o.material, e); }
      if (kind === e.first) return;
      if (!e.copies[kind]) {
        var c = o.material.clone();
        if (o.material.onBeforeCompile) c.onBeforeCompile = o.material.onBeforeCompile;
        if (o.material.customProgramCacheKey) c.customProgramCacheKey = o.material.customProgramCacheKey;
        // Three serializes userData during clone: retain the actual shared GPU texture.
        if (o.material.userData.tp) c.userData.tp = Object.assign({}, o.material.userData.tp);
        e.copies[kind] = c;
      }
      o.material = e.copies[kind];
    });
  }
  function disposeWorld(W) {
    W.scene.traverse(function (o) {
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) {
        ['map', 'emissiveMap'].forEach(function (k) { if (m[k] && !(m[k].userData && m[k].userData.shared)) m[k].dispose(); });
        if (m.uniforms && m.uniforms.map && m.uniforms.map.value) m.uniforms.map.value.dispose();
        m.dispose();
      });
    });
    if (W.envRT) W.envRT.dispose();
    W.pmrem.dispose();
  }

  function setupRenderer(renderer) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;     // the post pass owns tone mapping
    return renderer;
  }

  // =====================================================================
  // CREATE: a running clock on a canvas
  // Live mode reads the wall clock on purpose. It is a clock.
  // =====================================================================
  var VIEWS = ['Hero', 'Close', 'Wide', 'Ground', 'Plan'];
  function create(canvas, hash, opts) {
    opts = opts || {};
    var renderer = setupRenderer(opts.renderer || new THREE.WebGLRenderer({ canvas: canvas, antialias: false, preserveDrawingBuffer: !!opts.preserve }));
    var pr = Math.min(root.devicePixelRatio || 1, opts.maxPixelRatio || 2);
    var P = plan(hash), mode = opts.mode || 'live';
    var utc = opts.utc != null ? opts.utc : mode === 'still' ? P.stillUtc : Date.now() / 1000;
    var W = buildWorld(P, renderer, utc), cam = W.camera, post = new Post(renderer);
    var film = P.film; post.setFilm(film);
    var lapse = opts.lapse || 900, raf = 0, lastMs = null, real = 0, snapNext = true, alive = true, frozen = false;
    var view = 0, cur = { az: 0, el: 0, zoom: 1, look: 0 }, tgt = { az: 0, el: 0, zoom: 1, look: 0 };
    var drag = { down: false, x: 0, y: 0, moved: 0, pts: {} };
    var ui = new Interact(null, canvas, W, opts);
    function resize() {
      var w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      post.setSize(Math.floor(w * pr), Math.floor(h * pr));
      fitCamera(cam, w, h);
    }
    function viewTarget(i) {
      var v = VIEWS[i], hc = W.hero.close || {};
      tgt.az = cur.az; tgt.look = 0;
      if (v === 'Hero') { tgt.zoom = 1; tgt.el = 0; }
      if (v === 'Close') { tgt.zoom = hc.zoom || 0.45; tgt.el = hc.el || 0.05; tgt.look = hc.look || 0; }
      if (v === 'Wide') { tgt.zoom = 2.1; tgt.el = 0.35; }
      if (v === 'Ground') { tgt.zoom = 0.8; tgt.el = -0.25; }
      if (v === 'Plan') { tgt.zoom = 1.25; tgt.el = 3.2; }
    }
    var override = null, capturing = false, grainHold = null;
    function placeCamera(dt) {
      if (override) { cam.position.copy(override.pos); cam.lookAt(override.target); return; }
      var k = Math.min(1, dt * 2.5);
      cur.az += (tgt.az - cur.az) * k; cur.el += (tgt.el - cur.el) * k; cur.zoom += (tgt.zoom - cur.zoom) * k; cur.look += (tgt.look - cur.look) * k;
      var c = W.cam, sway = opts.reducedMotion ? 0 : grainHold != null ? grainHold : real, az = W.camAz * D2R + cur.az + Math.sin(sway * 0.045) * 0.07;
      var d = c.dist * cur.zoom;
      cam.position.set(Math.sin(az) * d, Math.max(0.5, c.h * (VIEWS[view] === 'Ground' ? 0.35 : 1) + cur.el * c.dist * 0.6 + Math.sin(sway * 0.07) * 0.12), -Math.cos(az) * d);
      cam.lookAt(0, c.lookY + cur.look, 0);
      if (VIEWS[view] !== 'Plan') cam.rotateY((P.seed % 2 ? 1 : -1) * 0.035);
    }
    function step(dtReal) {
      real += dtReal;
      if (!frozen) {
        if (mode === 'live') utc = Date.now() / 1000;
        else if (mode === 'lapse') utc += dtReal * lapse;
      }
      placeCamera(dtReal);
      var t = marfaTime(utc);
      var ctx = { utc: utc, t: t, sun: sunPos(utc), moon: moonPos(utc), dt: dtReal, real: real, snap: snapNext, fast: mode === 'lapse', camera: cam, night: 0 };
      snapNext = false;
      updateWorld(W, renderer, ctx);
      post.render(W.scene, cam, W.exposure, grainHold != null ? grainHold : real);
      if (opts.onFrame && !capturing) opts.onFrame({ camera: cam, scene: W.scene, screens: W.referenceScreens || [], utc: utc });
      ui.tick();
      return ctx;
    }
    function loop(ms) {
      if (!alive) return;
      var dt = lastMs == null ? 0 : Math.min((ms - lastMs) / 1000, 0.1);
      lastMs = ms;
      step(dt);
      raf = root.requestAnimationFrame(loop);
    }
    function pinchDist() { var k = Object.keys(drag.pts); if (k.length < 2) return 0; var a = drag.pts[k[0]], b = drag.pts[k[1]]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }
    function onDown(e) {
      drag.pts[e.pointerId] = [e.clientX, e.clientY];
      drag.down = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.pinch = pinchDist();
      if (canvas.setPointerCapture) try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
    }
    function onMove(e) {
      if (!drag.down) return;
      if (drag.pts[e.pointerId]) drag.pts[e.pointerId] = [e.clientX, e.clientY];
      if (Object.keys(drag.pts).length > 1) {
        var pd = pinchDist();
        if (drag.pinch) tgt.zoom = clamp(tgt.zoom * drag.pinch / pd, 0.35, 2.6);
        drag.pinch = pd; drag.moved += 10; return;
      }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      tgt.az -= dx * 0.004; tgt.el = clamp(tgt.el - dy * 0.003, -0.35, 3.3);
      cur.az = tgt.az; cur.el = tgt.el;
      drag.x = e.clientX; drag.y = e.clientY;
    }
    function onUp(e) {
      delete drag.pts[e.pointerId];
      if (Object.keys(drag.pts).length) return;
      drag.down = false;
      if (drag.moved < 6) {
        var hit = ui.click(e.clientX, e.clientY, cam);
        if (hit && hit.obj.userData.reference && opts.onReference) opts.onReference(hit.obj.userData.reference);
        if (hit && hit.obj === W.hero.group) { view = VIEWS[view] === 'Close' ? 0 : 1; viewTarget(view); }
      }
    }
    function onWheel(e) {
      if (!opts.freeWheel && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); tgt.zoom = clamp(tgt.zoom * (1 + e.deltaY * 0.001), 0.35, 2.6); cur.zoom = tgt.zoom;
    }
    function onKey(e) {
      if (e.target && (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) || (e.target.closest && e.target.closest('dialog')))) return;
      var k = (e.key || '').toLowerCase();
      if (k === 'l') api.setMode('live');
      else if (k === 't') api.setMode(mode === 'lapse' ? 'live' : 'lapse');
      else if (k === 's') api.setMode('still');
      else if (k === '[' || k === ']') api.setTime(utc + (k === ']' ? 3600 : -3600));
      else if (k === ',' || k === '.') api.setTime(utc + (k === '.' ? 86400 : -86400));
      else if (k === ' ') { frozen = !frozen; e.preventDefault(); }
      else if (k === 'c') api.cycleView();
      else if (k === 'f') api.cycleFilm();
      else if (k === 'i') ui.toggleLabel();
      else if (k === '?' || k === 'h' || k === '/') ui.toggleHelp();
      else if (k === 'p') api.saveStill();
      else if (k === 'g') api.recordGif({ day: e.shiftKey });
    }
    if (opts.interactive !== false) {
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      if (opts.keys !== false) root.addEventListener('keydown', onKey);
    }
    resize();
    var api = {
      plan: P, features: P.features, renderer: renderer, world: W,
      start: function () { if (!raf) { lastMs = null; raf = root.requestAnimationFrame(loop); } return api; },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; return api; },
      renderOnce: function (dt) { return step(dt || 0); },
      resize: resize,
      setMode: function (m) { mode = m; frozen = false; if (m === 'still' && opts.utc == null) utc = P.stillUtc; snapNext = true; return api; },
      setTime: function (u) { mode = 'still'; utc = u; snapNext = true; return api; },
      // move the clock without a jump (flaps flip, pins travel): for films and scrubbing
      setClock: function (u, snap) { mode = 'still'; utc = u; if (snap) snapNext = true; return api; },
      getMode: function () { return mode; },
      getTime: function () { return marfaTime(utc); },
      sun: function () { return sunPos(utc); },
      cycleView: function () { view = (view + 1) % VIEWS.length; viewTarget(view); ui.say('View', VIEWS[view]); return VIEWS[view]; },
      // hold the camera somewhere specific (films, close-ups); null releases it
      setCamera: function (pos, target) { override = pos ? { pos: pos.clone(), target: target.clone() } : null; return api; },
      setView: function (name) { var i = VIEWS.indexOf(name); if (i >= 0) { view = i; viewTarget(i); } return api; },
      cycleFilm: function () {
        var names = Object.keys(FILMS), i = (names.indexOf(film) + 1) % names.length;
        film = names[i]; post.setFilm(film); ui.say('Film', film + (film === P.film ? ' (this token’s own)' : '')); return film;
      },
      setFilm: function (name) { if (FILMS[name]) { film = name; post.setFilm(name); } return api; },
      views: VIEWS, films: Object.keys(FILMS),
      stats: function () { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; },
      getFilm: function () { return film; },
      getView: function () { return VIEWS[view]; },
      running: function () { return !!raf; },
      // exports: render at a chosen size into a 2D context, then put the screen back
      // hold: freeze the film grain (a GIF of changing grain is noise, and heavy)
      beginCapture: function (w, h, hold) {
        api.stop(); capturing = true; grainHold = hold ? real : null;
        renderer.setPixelRatio(1); renderer.setSize(w, h, false); post.setSize(w, h);
        fitCamera(cam, w, h); return api;
      },
      captureFrame: function (dt, g2) { step(dt || 0); g2.drawImage(renderer.domElement, 0, 0, g2.canvas.width, g2.canvas.height); return api; },
      endCapture: function (restart) { capturing = false; grainHold = null; resize(); if (restart) api.start(); else step(0); return api; },
      saveStill: function (o) {
        if (capturing) return null;
        ui.say('Still', 'Saving a PNG of this minute.');
        o = o || {};
        // a host page can take the file instead (opts.onSave), e.g. to save it its own way
        var hand = opts.onSave && o.download == null;
        if (hand) o.download = false;
        return exp_still(api, o).then(function (r) { if (hand) opts.onSave(r, 'png'); return r; });
      },
      recordGif: function (o) {
        if (capturing) return null;
        o = o || {};
        var user = o.onProgress;
        o.onProgress = function (f) { ui.say('GIF', (o.day ? 'Recording the whole day. ' : 'Recording three seconds. ') + Math.round(f * 100) + '%'); if (user) user(f); };
        var handG = opts.onSave && o.download == null;
        if (handG) o.download = false;
        return exp_gif(api, o).then(function (r) {
          ui.say('GIF', 'Saved ' + r.frames + ' frames at ' + r.width + ' x ' + r.height + '.');
          if (handG) opts.onSave(r, o.day ? 'day' : 'gif');
          return r;
        });
      },
      dispose: function () {
        alive = false; api.stop();
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel); root.removeEventListener('keydown', onKey);
        ui.dispose(); post.dispose(); disposeWorld(W);
        if (!opts.renderer) renderer.dispose();
      }
    };
    ui.api = api;
    return api;
  }

  // one frame, drawn into a fresh 2D canvas, for galleries of many tokens
  var _shared = null, _sharedPost = null;
  function snapshot(hash, utc, w, h, o) {
    o = o || {};
    if (!_shared) {
      var c = document.createElement('canvas');
      _shared = setupRenderer(new THREE.WebGLRenderer({ canvas: c, antialias: false, preserveDrawingBuffer: true }));
      _sharedPost = new Post(_shared);
    }
    _shared.setPixelRatio(1);
    _shared.setSize(w, h, false);
    _sharedPost.setSize(w, h);
    var P = plan(hash), at = utc == null ? P.stillUtc : utc;
    _sharedPost.setFilm(o.film || P.film);
    var W = buildWorld(P, _shared, at), cam = W.camera;
    fitCamera(cam, w, h);
    cam.position.copy(W.cam.pos); cam.lookAt(0, W.cam.lookY, 0); cam.rotateY((P.seed % 2 ? 1 : -1) * 0.035);
    if (o.view && o.view !== 'Hero') {
      // the same framing create() eases into for that view
      var hc = W.hero.close || {}, v = { zoom: 1, el: 0, look: 0 }, c = W.cam;
      if (o.view === 'Close') v = { zoom: hc.zoom || 0.45, el: hc.el || 0.05, look: hc.look || 0 };
      if (o.view === 'Wide') v.zoom = 2.1, v.el = 0.35;
      if (o.view === 'Ground') v.zoom = 0.8, v.el = -0.25;
      if (o.view === 'Plan') v.zoom = 1.25, v.el = 3.2;
      var az = W.camAz * D2R, d = c.dist * v.zoom;
      cam.position.set(Math.sin(az) * d, Math.max(0.5, c.h * (o.view === 'Ground' ? 0.35 : 1) + v.el * c.dist * 0.6), -Math.cos(az) * d);
      cam.lookAt(0, c.lookY + v.look, 0);
    }
    var ctx = { utc: at, t: marfaTime(at), sun: sunPos(at), moon: moonPos(at), dt: o.dt || 0, real: o.real || 0, snap: true, fast: false, camera: cam, night: 0 };
    updateWorld(W, _shared, ctx);
    _sharedPost.render(W.scene, cam, W.exposure, 0.5);
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(_shared.domElement, 0, 0, w, h);
    disposeWorld(W);
    return { canvas: out, plan: P, time: ctx.t };
  }

  // =====================================================================
  // EXPORTS, and the token itself
  // =====================================================================
  root.marfaLight = {
    version: '0.4.1', plan: plan, create: create, snapshot: snapshot, films: FILMS, views: VIEWS,
    clocks: CLOCK_DEFS, places: PLACE_DEFS, eggs: EGG_DEFS,
    marfaTime: marfaTime, marfaUtc: marfaUtc, sunPos: sunPos, moonPos: moonPos, sunEvents: sunEvents, moonEvents: moonEvents
  };
  root.calculateFeatures = function (tokenData) { return plan(tokenData.hash).features; };

  // Two hosts, one hash: Art Blocks injects tokenData.hash; ABX serves a bytes32 seed
  // through abx.tokenData (abx.js). Either is a 0x + 64 hex string, so plan() reads both.
  var abxData = root.abx && root.abx.tokenData;
  var tokenHash = (abxData && abxData.seed) || (root.tokenData && root.tokenData.hash);
  if (tokenHash && !root.MARFA_LIGHT_GALLERY && root.document && THREE) {
    var cv = document.createElement('canvas');
    document.body.style.cssText = 'margin:0;background:#0d0d0d;overflow:hidden;height:100vh;position:relative';
    cv.style.cssText = 'display:block;width:100vw;height:100vh;touch-action:none';
    document.body.appendChild(cv);
    var tok = create(cv, tokenHash, { mode: 'live', freeWheel: true, overlayHost: document.body }).start();
    root.addEventListener('resize', tok.resize);
    // ABX captures marketplace traits from abx.traits() and the still at abx.done().
    if (root.abx && typeof root.abx.traits === 'function') {
      root.abx.traits(plan(tokenHash).features);
      var frames = 0;
      (function wait() { if (++frames < 3) root.requestAnimationFrame(wait); else if (root.abx.done) root.abx.done(); })();
    }
  }
