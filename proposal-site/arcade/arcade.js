/* Marfa Light Arcade. three.js r124.
   Every piece runs live through the Art Blocks generator. Token data comes only from projects.json. */
(function () {
  'use strict';

  var GEN = 'https://generator.artblocks.io/';
  var TOKEN_PAGE = 'https://www.artblocks.io/token/';

  /* Where each project lives in the building. Names must match projects.json keys. */
  var LAYOUT = [
    { name: 'Chromie Squiggle',      artist: 'Snowfro', room: 'snowfro', x: -6.52, z: 6,   face: 'east' },
    { name: '///',                   artist: 'Snowfro', room: 'snowfro', x: 6.52,  z: 6,   face: 'west' },
    { name: 'LIFT (a self portrait)', artist: 'Snowfro', room: 'snowfro', x: -6.52, z: 0,   face: 'east' },
    { name: '100 Untitled Spaces',   artist: 'Snowfro', room: 'snowfro', x: 6.52,  z: 0,   face: 'west' },
    { name: 'send/receive',          artist: 'Snowfro', room: 'snowfro', x: -6.52, z: -6,  face: 'east' },
    { name: 'heart + craft',         artist: 'Snowfro and Jordan Lyall', room: 'snowfro', x: 6.52, z: -6, face: 'west' },
    { name: 'NimBuds',               artist: 'Bryan Brinkman', room: 'nim', x: -2.3, z: -25.5, face: 'south' },
    { name: 'NimTeens',              artist: 'Bryan Brinkman', room: 'nim', x: 2.3,  z: -25.5, face: 'south' },
    { name: 'Friendship Bracelets',  artist: 'Alexis André', room: 'entrance', x: 6.94, z: 9.6, face: 'west', frame: true }
  ];
  var ROOMS = {
    snowfro: { title: 'Snowfro Arcade', blurb: 'Onchain experiments by Erick Calderon, played on the cabinets of the main hall.' },
    nim: { title: 'The Nim Room', blurb: 'Bryan Brinkman’s NimBuds and NimTeens, through the doorway at the end of the hall.' },
    entrance: { title: 'At the entrance', blurb: 'A single screen by the door.' }
  };

  var EYE = 1.6, RADIUS = 0.32, WALK = 3.1, RUN = 5.4, NEAR = 2.2;

  var $ = function (id) { return document.getElementById(id); };
  var data = null, items = [];
  var state = { item: null, idx: 0, open: false };

  function slug(name) {
    var s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'slashes';
  }
  function thumb(item) { return 'img/' + slug(item.name) + '.jpg'; }

  /* ---------- modal ---------- */
  var dlg = $('play'), frame = $('playFrame'), frameWrap = $('frameWrap'), frameMsg = $('frameMsg');

  function sizeFrame() {
    if (!state.item) return;
    var a = state.item.p.aspect || 1;
    var head = document.querySelector('.play-head').offsetHeight;
    var foot = document.querySelector('.play-foot').offsetHeight;
    var availW = window.innerWidth - 32;
    var availH = Math.max(160, window.innerHeight - head - foot - 12);
    var w = Math.min(availW, availH * a);
    frameWrap.style.width = Math.floor(w) + 'px';
    frameWrap.style.height = Math.floor(w / a) + 'px';
  }

  function showToken() {
    var it = state.item, p = it.p, t = p.tokens[state.idx];
    var url = GEN + p.chain + '/' + p.contract + '/' + t.id;
    frameMsg.hidden = false;
    frame.title = it.name + ', token ' + t.n + ', live';
    frame.src = url;
    $('playToken').textContent = 'Token #' + t.n + '  ·  ' + (state.idx + 1) + ' of ' + p.tokens.length + (p.chain === 42161 ? '  ·  Arbitrum' : '');
    $('tokLink').href = TOKEN_PAGE + p.chain + '/' + p.contract + '/' + t.id;
    $('tokLink').setAttribute('aria-label', 'View ' + it.name + ' token ' + t.n + ' on Art Blocks (opens in a new tab)');
  }

  function openPlay(item, idx) {
    state.item = item;
    state.idx = idx || 0;
    state.open = true;
    keys = {}; tapTarget = null; stickVec.x = stickVec.y = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    $('playTitle').textContent = item.name;
    $('playArtist').textContent = item.artist;
    if (!dlg.open) dlg.showModal();
    sizeFrame();
    showToken();
    $('tokNext').focus();
  }
  function closePlay() { if (dlg.open) dlg.close(); }
  function step(d) {
    var n = state.item.p.tokens.length;
    state.idx = (state.idx + d + n) % n;
    showToken();
  }
  function randomToken() {
    var n = state.item.p.tokens.length, r = state.idx;
    while (n > 1 && r === state.idx) r = Math.floor(Math.random() * n);
    state.idx = r;
    showToken();
  }

  frame.addEventListener('load', function () {
    if (!state.open || frame.src === 'about:blank') return;
    frameMsg.hidden = true;
    try { frame.focus(); } catch (e) {}
  });
  dlg.addEventListener('close', function () {
    state.open = false;
    frame.src = 'about:blank';
    keys = {};
    var back = document.body.classList.contains('listing') ? lastCardBtn : $('scene');
    if (back) back.focus();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closePlay(); });
  $('playClose').addEventListener('click', closePlay);
  $('tokPrev').addEventListener('click', function () { step(-1); });
  $('tokNext').addEventListener('click', function () { step(1); });
  $('tokRand').addEventListener('click', randomToken);
  window.addEventListener('resize', sizeFrame);

  /* ---------- list view ---------- */
  var lastCardBtn = null;
  function buildList() {
    var root = $('cards');
    ['snowfro', 'nim', 'entrance'].forEach(function (room) {
      var group = items.filter(function (i) { return i.room === room; });
      if (!group.length) return;
      var h = document.createElement('h2'); h.textContent = ROOMS[room].title; root.appendChild(h);
      var bl = document.createElement('p'); bl.textContent = ROOMS[room].blurb; root.appendChild(bl);
      var grid = document.createElement('div'); grid.className = 'grid'; root.appendChild(grid);
      group.forEach(function (it) {
        var c = document.createElement('article'); c.className = 'card';
        var img = document.createElement('img'); img.src = thumb(it); img.alt = it.name + ', token #' + it.p.tokens[0].n; img.loading = 'lazy';
        var m = document.createElement('div'); m.className = 'meta';
        var t = document.createElement('h3'); t.textContent = it.name;
        var a = document.createElement('p'); a.className = 'eyebrow'; a.textContent = it.artist;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn solid'; b.textContent = 'Play';
        b.setAttribute('aria-label', 'Play ' + it.name + ' by ' + it.artist);
        b.addEventListener('click', function () { lastCardBtn = b; openPlay(it, 0); });
        m.appendChild(t); m.appendChild(a); m.appendChild(b);
        c.appendChild(img); c.appendChild(m); grid.appendChild(c);
      });
    });
  }
  function setList(on) {
    var tog = $('listToggle');
    document.body.classList.toggle('listing', on);
    $('list').hidden = !on;
    tog.setAttribute('aria-pressed', on ? 'true' : 'false');
    tog.textContent = on ? '3D view' : 'List view';
    keys = {};
    if (on) { $('listTitle').setAttribute('tabindex', '-1'); $('listTitle').focus(); window.scrollTo(0, 0); }
    else if (!webgl) { setList(true); }
    else $('scene').focus();
  }
  $('listToggle').addEventListener('click', function () { setList(!document.body.classList.contains('listing')); });

  /* ---------- boot ---------- */
  var webgl = false;
  fetch('projects.json').then(function (r) { return r.json(); }).then(function (json) {
    data = json;
    LAYOUT.forEach(function (L) {
      if (!data[L.name]) return;
      var it = Object.assign({}, L); it.p = data[L.name]; items.push(it);
    });
    buildList();
    window.ARCADE = { items: items, open: openPlay, close: closePlay, state: state };
    try {
      if (/[?&]nogl\b/.test(location.search)) throw new Error('3D view turned off by ?nogl');
      if (!window.THREE) throw new Error('three.js did not load');
      var test = document.createElement('canvas');
      if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('no WebGL');
      initScene();
      webgl = true;
      if (/[?&]list\b/.test(location.search)) setList(true);
    } catch (e) {
      console.warn('Arcade 3D view unavailable:', e.message);
      $('listToggle').hidden = true;
      $('listNote').textContent = 'The 3D hall needs WebGL. Here is every piece as a list.';
      $('loading').classList.add('done');
      setList(true);
    }
  }).catch(function (e) {
    console.error(e);
    $('loading').querySelector('span').textContent = 'Could not load the arcade data';
  });

  /* ---------- input state ---------- */
  var keys = {};
  var stickVec = { x: 0, y: 0 };
  var tapTarget = null;

  /* ================================================================ 3D */
  function initScene() {
    var T = THREE;
    var canvas = $('scene');
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;

    var scene = new T.Scene();
    scene.background = new T.Color(0x0e1220);
    scene.fog = new T.Fog(0x1a1512, 22, 48);

    var camera = new T.PerspectiveCamera((window.innerWidth / window.innerHeight < 0.8 ? 80 : (window.innerWidth < 700 ? 74 : 66)), window.innerWidth / window.innerHeight, 0.05, 80);
    camera.rotation.order = 'YXZ';
    var player = { x: 0, z: 10.6, yaw: 0, pitch: -0.04 };
    /* on a narrow portrait screen, start turned toward the first cabinet so the arcade reads at once */
    if (window.innerWidth / window.innerHeight < 0.8) { player.yaw = 0.62; player.pitch = -0.08; }

    var touchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touchDevice) document.body.classList.add('touch');

    /* --- environment map for the bronze and the polished floor --- */
    (function () {
      var pm = new T.PMREMGenerator(renderer);
      var es = new T.Scene();
      var g = new T.SphereBufferGeometry(10, 32, 16);
      var pos = g.attributes.position, col = [];
      var top = new T.Color(0xfff0d8), mid = new T.Color(0xb09276), low = new T.Color(0x2a2220), c = new T.Color();
      for (var i = 0; i < pos.count; i++) {
        var y = pos.getY(i) / 10;
        if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 1.5)); else c.copy(mid).lerp(low, Math.min(1, -y * 2));
        col.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      es.add(new T.Mesh(g, new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true })));
      var strip = new T.Mesh(new T.PlaneBufferGeometry(2.4, 18), new T.MeshBasicMaterial({ color: new T.Color(5, 4.6, 4), side: T.DoubleSide }));
      strip.rotation.x = Math.PI / 2; strip.position.y = 8; es.add(strip);
      var pink = new T.Mesh(new T.PlaneBufferGeometry(3, 2), new T.MeshBasicMaterial({ color: new T.Color(3, 0.6, 1.2), side: T.DoubleSide }));
      pink.position.set(0, 1, -9.5); es.add(pink);
      scene.environment = pm.fromScene(es, 0.03).texture;
      pm.dispose();
    })();

    /* --- procedural textures --- */
    function canvasTex(w, h, draw, repeat) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      var t = new T.CanvasTexture(c);
      t.encoding = T.sRGBEncoding;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
      return t;
    }
    function noise(ctx, w, h, amt, seed) {
      var img = ctx.getImageData(0, 0, w, h), d = img.data, s = seed || 1;
      for (var i = 0; i < d.length; i += 4) {
        s = (s * 16807) % 2147483647;
        var n = ((s / 2147483647) - 0.5) * amt;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
    }
    function speckle(ctx, w, h, count, colors, rmax) {
      for (var i = 0; i < count; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.15 + Math.random() * 0.35;
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * rmax + 0.4, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    /* limestone / caliche wall: one tile spans the full wall height so it can carry a baked floor and ceiling shade */
    function limestone(base, courses, aoTop) {
      return canvasTex(512, 1024, function (ctx, w, h) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (var k = 0; k < 40; k++) {
          var gx = Math.random() * w, gy = Math.random() * h, r = 40 + Math.random() * 120;
          var gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
          gr.addColorStop(0, Math.random() > 0.5 ? 'rgba(255,240,215,.10)' : 'rgba(120,90,60,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        }
        speckle(ctx, w, h, 900, ['#8c7357', '#f1e2c8', '#a68a6a'], 1.4);
        noise(ctx, w, h, 16, 7);
        if (courses) {
          var rows = courses, rh = h / rows;
          for (var r2 = 1; r2 < rows; r2++) {
            ctx.fillStyle = 'rgba(70,50,35,.22)'; ctx.fillRect(0, r2 * rh, w, 2);
            ctx.fillStyle = 'rgba(255,245,225,.18)'; ctx.fillRect(0, r2 * rh + 2, w, 1);
            var off = (r2 % 2) ? 0 : w / 2;
            ctx.fillStyle = 'rgba(70,50,35,.16)'; ctx.fillRect((off + w / 4) % w, r2 * rh, 2, rh); ctx.fillRect((off + 3 * w / 4) % w, r2 * rh, 2, rh);
          }
        }
        var ao = ctx.createLinearGradient(0, 0, 0, h);
        ao.addColorStop(0, 'rgba(40,28,20,' + (aoTop || 0.35) + ')'); ao.addColorStop(0.12, 'rgba(40,28,20,0)');
        ao.addColorStop(0.86, 'rgba(40,28,20,0)'); ao.addColorStop(1, 'rgba(30,20,14,.55)');
        ctx.fillStyle = ao; ctx.fillRect(0, 0, w, h);
      }, true);
    }
    var concreteTex = canvasTex(1024, 1024, function (ctx, w, h) {
      ctx.fillStyle = '#7a7168'; ctx.fillRect(0, 0, w, h);
      for (var k = 0; k < 60; k++) {
        var gx = Math.random() * w, gy = Math.random() * h, r = 60 + Math.random() * 220;
        var gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        gr.addColorStop(0, Math.random() > 0.5 ? 'rgba(255,245,230,.08)' : 'rgba(40,30,25,.09)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      }
      speckle(ctx, w, h, 2600, ['#5f574f', '#c9bfb2', '#a39684', '#3e3832'], 2.2);
      noise(ctx, w, h, 14, 3);
      ctx.fillStyle = 'rgba(30,24,20,.45)'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, 0, 3, h);
    }, true);
    var plasterTex = canvasTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#d9cbb6'; ctx.fillRect(0, 0, w, h); noise(ctx, w, h, 10, 11); }, true);

    /* --- materials --- */
    var M = {
      floor: new T.MeshStandardMaterial({ map: concreteTex, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.55 }),
      ceil: new T.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 }),
      bronze: new T.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.32, metalness: 0.9, envMapIntensity: 1.2 }),
      darkBronze: new T.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.4, metalness: 0.8 }),
      black: new T.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.25, metalness: 0.2 }),
      glow: new T.MeshBasicMaterial({ color: 0xfff1d9, toneMapped: false })
    };
    function wallMat(len, tex, color) {
      var t = tex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 3.2)), 1);
      return new T.MeshStandardMaterial({ map: t, color: color || 0xffffff, roughness: 0.92 });
    }
    var hallStone = limestone('#cdb596', 10, 0.4);
    var nimWallTex = canvasTex(512, 1024, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#93b6ea'); g.addColorStop(0.55, '#c3b0ec'); g.addColorStop(1, '#eab3c8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 8, 5);
      var ao = ctx.createLinearGradient(0, 0, 0, h);
      ao.addColorStop(0.85, 'rgba(90,70,110,0)'); ao.addColorStop(1, 'rgba(90,70,110,.35)');
      ctx.fillStyle = ao; ctx.fillRect(0, 0, w, h);
    }, true);

    /* --- building helpers --- */
    var colliders = [];
    var BOX = new T.BoxBufferGeometry(1, 1, 1);
    function box(x0, x1, y0, y1, z0, z1, mat, collide, parent) {
      var m = new T.Mesh(BOX, mat);
      m.scale.set(x1 - x0, y1 - y0, z1 - z0);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.matrixAutoUpdate = false; m.updateMatrix();
      (parent || scene).add(m);
      if (collide) colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
      return m;
    }
    function plane(w, h, mat, x, y, z, rx, ry) {
      var m = new T.Mesh(new T.PlaneBufferGeometry(w, h), mat);
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
      scene.add(m); return m;
    }
    function gradientSprite(inner, outer) {
      return canvasTex(128, 128, function (ctx, w, h) {
        var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, inner); g.addColorStop(1, outer);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
    }
    var blobTex = gradientSprite('rgba(0,0,0,.55)', 'rgba(0,0,0,0)');
    var glowTex = gradientSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

    /* ---------------- Snowfro Arcade: the main hall ---------------- */
    var HX = 7, HZ0 = -14, HZ1 = 12, HH = 6, DOOR = 1.5, DOORH = 3.2;
    var floor = new T.Mesh(new T.PlaneBufferGeometry(HX * 2, HZ1 - HZ0), M.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (HZ0 + HZ1) / 2);
    floor.material.map.repeat.set(HX * 2 / 4, (HZ1 - HZ0) / 4);
    scene.add(floor);
    var floors = [floor];

    box(-HX - 0.4, -HX, 0, HH, HZ0, HZ1, wallMat(HZ1 - HZ0, hallStone), true);
    box(HX, HX + 0.4, 0, HH, HZ0, HZ1, wallMat(HZ1 - HZ0, hallStone), true);
    box(-HX - 0.4, HX + 0.4, 0, HH, HZ1, HZ1 + 0.4, wallMat(HX * 2, hallStone), true);
    box(-HX - 0.4, -DOOR, 0, HH, HZ0 - 0.4, HZ0, wallMat(HX - DOOR, hallStone), true);
    box(DOOR, HX + 0.4, 0, HH, HZ0 - 0.4, HZ0, wallMat(HX - DOOR, hallStone), true);
    box(-DOOR, DOOR, DOORH, HH, HZ0 - 0.4, HZ0, wallMat(3, hallStone));
    /* bronze door surround */
    box(-DOOR - 0.12, -DOOR, 0, DOORH + 0.12, HZ0 - 0.42, HZ0 + 0.04, M.bronze);
    box(DOOR, DOOR + 0.12, 0, DOORH + 0.12, HZ0 - 0.42, HZ0 + 0.04, M.bronze);
    box(-DOOR - 0.12, DOOR + 0.12, DOORH, DOORH + 0.12, HZ0 - 0.42, HZ0 + 0.04, M.bronze);

    /* ceiling with a long skylight slot */
    var SK = 1.3;
    [[-HX, -SK], [SK, HX]].forEach(function (r) {
      var c = new T.Mesh(new T.PlaneBufferGeometry(r[1] - r[0], HZ1 - HZ0), M.ceil);
      c.rotation.x = Math.PI / 2; c.position.set((r[0] + r[1]) / 2, HH, (HZ0 + HZ1) / 2); scene.add(c);
    });
    box(-SK - 0.06, -SK, HH, HH + 0.9, HZ0, HZ1, M.ceil);
    box(SK, SK + 0.06, HH, HH + 0.9, HZ0, HZ1, M.ceil);
    var sky = plane(SK * 2, HZ1 - HZ0, new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.45, 1.2), toneMapped: false }), 0, HH + 0.9, (HZ0 + HZ1) / 2, Math.PI / 2);
    for (var lz = HZ0 + 1.3; lz < HZ1; lz += 1.6) box(-SK, SK, HH + 0.35, HH + 0.43, lz - 0.05, lz + 0.05, M.darkBronze);
    /* bronze rail on both long walls */
    box(-HX, -HX + 0.05, 3.4, 3.46, HZ0, HZ1, M.bronze);
    box(HX - 0.05, HX, 3.4, 3.46, HZ0, HZ1, M.bronze);
    box(-HX, HX, 3.4, 3.46, HZ1 - 0.05, HZ1, M.bronze);
    /* sunlight pooling on the floor under the slot */
    var pool = plane(SK * 2.6, HZ1 - HZ0 - 1, new T.MeshBasicMaterial({ map: canvasTex(64, 8, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,214,160,0)'); g.addColorStop(0.5, 'rgba(255,214,160,.16)'); g.addColorStop(1, 'rgba(255,214,160,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }), transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 0, 0.006, (HZ0 + HZ1) / 2, -Math.PI / 2);

    /* entrance: glazed doors in a bronze frame */
    box(-1.6, 1.6, 0, 3.0, HZ1 - 0.06, HZ1 - 0.02, new T.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 }));
    box(-1.72, -1.6, 0, 3.12, HZ1 - 0.1, HZ1, M.bronze); box(1.6, 1.72, 0, 3.12, HZ1 - 0.1, HZ1, M.bronze);
    box(-1.72, 1.72, 3.0, 3.12, HZ1 - 0.1, HZ1, M.bronze); box(-0.03, 0.03, 0, 3.0, HZ1 - 0.1, HZ1 - 0.02, M.bronze);

    /* Flavin: fluorescent tubes flanking the doorway to the Nim Room */
    var tubeGeo = new T.CylinderBufferGeometry(0.028, 0.028, 2.44, 8);
    function tubeMat(hex) { var c = new T.Color(hex); return new T.MeshBasicMaterial({ color: c.multiplyScalar(1.6), toneMapped: false }); }
    var FL = [0xff5c8a, 0xfff2da, 0xffc53a, 0x7aa6ff];
    [-1, 1].forEach(function (side) {
      for (var k = 0; k < 4; k++) {
        var x = side * (DOOR + 0.55 + k * 0.22);
        box(x - 0.07, x + 0.07, 0.25, 2.75, HZ0 + 0.01, HZ0 + 0.06, new T.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.6 }));
        var tb = new T.Mesh(tubeGeo, tubeMat(FL[side > 0 ? 3 - k : k])); tb.position.set(x, 1.5, HZ0 + 0.1); scene.add(tb);
      }
      var gl = new T.Mesh(new T.PlaneBufferGeometry(3.4, 4.2), new T.MeshBasicMaterial({ map: glowTex, color: side < 0 ? 0xff6f9c : 0xffd27a, transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending }));
      gl.position.set(side * (DOOR + 0.9), 1.5, HZ0 + 0.03); scene.add(gl);
      var fg = new T.Mesh(new T.PlaneBufferGeometry(2.6, 2.2), gl.material.clone()); fg.material.opacity = 0.22;
      fg.rotation.x = -Math.PI / 2; fg.position.set(side * (DOOR + 0.9), 0.008, HZ0 + 0.9); scene.add(fg);
    });
    /* a horizontal fluorescent line across the entrance wall */
    var hTube = new T.Mesh(new T.CylinderBufferGeometry(0.028, 0.028, 9.6, 8), tubeMat(0xfff2da)); hTube.rotation.z = Math.PI / 2; hTube.position.set(0, 4.6, HZ1 - 0.12); scene.add(hTube);

    /* signage painted on the stone */
    function sign(lines, w, h, opts) {
      opts = opts || {};
      var tex = canvasTex(1024, Math.round(1024 * h / w), function (ctx, cw, ch) {
        ctx.clearRect(0, 0, cw, ch);
        var y = 0;
        lines.forEach(function (L) {
          ctx.font = L.font; ctx.fillStyle = L.color; ctx.textBaseline = 'top';
          ctx.textAlign = opts.align || 'left';
          var x = opts.align === 'center' ? cw / 2 : 0;
          if (L.track) { try { ctx.letterSpacing = L.track; } catch (e) {} }
          var fs = parseInt(L.font.match(/(\d+)px/)[1], 10);
          while (ctx.measureText(L.text).width > cw - 24 && fs > 12) { fs -= 4; ctx.font = L.font.replace(/\d+px/, fs + 'px'); }
          ctx.fillText(L.text, x, y + (L.dy || 0));
          if (L.track) { try { ctx.letterSpacing = '0px'; } catch (e) {} }
          y += L.lh;
        });
      });
      return new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    }

    /* lights: few, warm, baked looking */
    scene.add(new T.HemisphereLight(0xffe8c8, 0x3a2c22, 0.5));
    var sun = new T.DirectionalLight(0xffd8a6, 0.85); sun.position.set(3, 12, 4); scene.add(sun);
    var neon = new T.PointLight(0xff7aa8, 1.1, 9, 2); neon.position.set(0, 2, HZ0 + 1.2); scene.add(neon);

    /* ---------------- The Nim Room ---------------- */
    var NX = 6, NZ0 = -26, NZ1 = HZ0, NH = 4.6;
    var nimFloorTex = canvasTex(512, 512, function (ctx, w, h) {
      ctx.fillStyle = '#cf9fb0'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 900, ['#ffffff', '#b8a6d9', '#9cc3e6', '#f3a9be'], 3);
      noise(ctx, w, h, 8, 9);
    }, true);
    nimFloorTex.repeat.set(4, 4);
    var nimFloor = new T.Mesh(new T.PlaneBufferGeometry(NX * 2, NZ1 - NZ0), new T.MeshStandardMaterial({ map: nimFloorTex, roughness: 0.6, envMapIntensity: 0.35 }));
    nimFloor.rotation.x = -Math.PI / 2; nimFloor.position.set(0, 0.001, (NZ0 + NZ1) / 2); scene.add(nimFloor); floors.push(nimFloor);
    box(-NX - 0.4, -NX, 0, NH, NZ0, NZ1 - 0.4, wallMat(12, nimWallTex), true);
    box(NX, NX + 0.4, 0, NH, NZ0, NZ1 - 0.4, wallMat(12, nimWallTex), true);
    box(-NX - 0.4, NX + 0.4, 0, NH, NZ0 - 0.4, NZ0, wallMat(12, nimWallTex), true);
    var nimCeil = plane(NX * 2, NZ1 - NZ0, new T.MeshStandardMaterial({ color: 0x9fbdf0, roughness: 1, emissive: 0x6d86c4, emissiveIntensity: 0.2 }), 0, NH, (NZ0 + NZ1) / 2, Math.PI / 2);
    /* the Nim Room's side of the doorway wall */
    box(-NX, -DOOR, 0, NH, NZ1 - 0.42, NZ1 - 0.4, new T.MeshStandardMaterial({ color: 0xc3b0ec, roughness: 0.95 }));
    box(DOOR, NX, 0, NH, NZ1 - 0.42, NZ1 - 0.4, new T.MeshStandardMaterial({ color: 0xc3b0ec, roughness: 0.95 }));
    box(-DOOR, DOOR, DOORH, NH, NZ1 - 0.42, NZ1 - 0.4, new T.MeshStandardMaterial({ color: 0xc3b0ec, roughness: 0.95 }));
    /* soft clouds */
    var cloudMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xf4ecff, emissiveIntensity: 0.15 });
    var sphere = new T.SphereBufferGeometry(1, 18, 12);
    var clouds = [];
    [[-3.6, 3.7, -17.5], [2.8, 3.9, -19.5], [-1.0, 4.0, -22.6], [4.0, 3.6, -23.8], [-4.2, 3.8, -24.2], [0.6, 3.75, -16.4]].forEach(function (p, i) {
      var g = new T.Group();
      [[0, 0, 0, 0.62], [0.62, -0.08, 0.1, 0.46], [-0.6, -0.1, 0, 0.44], [0.28, 0.24, -0.1, 0.42], [-0.25, 0.2, 0.15, 0.38]].forEach(function (s) {
        var m = new T.Mesh(sphere, cloudMat); m.position.set(s[0], s[1], s[2]); m.scale.setScalar(s[3]); g.add(m);
      });
      g.position.set(p[0], p[1], p[2]); g.scale.set(1.2, 0.8, 1); g.userData.base = p[1]; g.userData.ph = i * 1.3;
      scene.add(g); clouds.push(g);
    });
    var nimLight = new T.PointLight(0xffc7e8, 0.55, 16, 2); nimLight.position.set(0, 3.4, -20); scene.add(nimLight);
    /* pastel rails */
    box(-NX, -NX + 0.05, 1.0, 1.08, NZ0, NZ1 - 0.42, new T.MeshStandardMaterial({ color: 0xf6a7c1, roughness: 0.5 }));
    box(NX - 0.05, NX, 1.0, 1.08, NZ0, NZ1 - 0.42, new T.MeshStandardMaterial({ color: 0x9cc3e6, roughness: 0.5 }));

    /* ---------------- cabinets ---------------- */
    var clickables = [], cabinets = [];
    var loader = new T.TextureLoader();
    var pending = 0;
    function doneLoading() { $('loading').classList.add('done'); }
    var loadTimer = setTimeout(doneLoading, 6000);

    function marqueeMat(it, idx, style) {
      var tex = canvasTex(1024, 300, function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, style.mq0); g.addColorStop(1, style.mq1);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        if (style.nim) {
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          [[90, 230, 60], [150, 210, 70], [210, 235, 55], [820, 70, 50], [880, 50, 62], [940, 78, 46]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 6.283); ctx.fill(); });
        } else {
          ctx.strokeStyle = 'rgba(255,230,190,.5)'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, w - 28, h - 28);
        }
        ctx.fillStyle = style.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        var size = 170, title = it.name.toUpperCase();
        do { ctx.font = '800 ' + size + 'px "Big Shoulders Display", Impact, sans-serif'; size -= 6; } while (ctx.measureText(title).width > w - 110 && size > 40);
        ctx.fillText(title, w / 2, 196);
        ctx.font = '500 28px "IBM Plex Mono", Menlo, monospace';
        try { ctx.letterSpacing = '6px'; } catch (e) {}
        ctx.fillStyle = style.sub;
        ctx.fillText((style.nim ? 'THE NIM ROOM' : 'SNOWFRO ARCADE') + '  ·  ' + String(idx + 1).padStart(2, '0'), w / 2, 258);
      });
      return new T.MeshBasicMaterial({ map: tex, toneMapped: false });
    }
    function plaqueMat(text) {
      var tex = canvasTex(512, 96, function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c99a62'); g.addColorStop(0.5, '#8c5e33'); g.addColorStop(1, '#6a4423');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(40,24,10,.6)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.font = '500 34px "IBM Plex Mono", Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        try { ctx.letterSpacing = '4px'; } catch (e) {}
        var t = text.toUpperCase(); var s = 34;
        while (ctx.measureText(t).width > w - 40 && s > 16) { s -= 2; ctx.font = '500 ' + s + 'px "IBM Plex Mono", Menlo, monospace'; }
        ctx.fillStyle = 'rgba(255,225,180,.35)'; ctx.fillText(t, w / 2 + 1, h / 2 + 2);
        ctx.fillStyle = '#2b1a0c'; ctx.fillText(t, w / 2, h / 2);
      });
      return new T.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.75 });
    }
    function avgColor(img) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 8;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
        var d = x.getImageData(0, 0, 8, 8).data, r = 0, g = 0, b = 0;
        for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        var col = new T.Color(r / 64 / 255, g / 64 / 255, b / 64 / 255);
        var hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.3 + 0.1), 0.6);
        return col;
      } catch (e) { return new T.Color(0xfff0d8); }
    }
    function screenTex(it, onImg) {
      pending++;
      return loader.load(thumb(it), function (t) {
        t.encoding = T.sRGBEncoding; t.anisotropy = 4;
        if (onImg) onImg(t.image);
        if (--pending === 0) { clearTimeout(loadTimer); doneLoading(); }
      }, undefined, function () {
        console.warn('thumbnail missing for', it.name);
        if (--pending === 0) { clearTimeout(loadTimer); doneLoading(); }
      });
    }

    var STYLE_SNOW = [
      { body: 0x1d2333, mq0: '#2b1d14', mq1: '#5a3418', ink: '#ffe3b8', sub: '#f2b45a' },
      { body: 0x262019, mq0: '#13172a', mq1: '#2c3560', ink: '#f6efe3', sub: '#9fb4ff' },
      { body: 0x2a1c18, mq0: '#3a1410', mq1: '#7a2a16', ink: '#fff0dc', sub: '#ffb48a' },
      { body: 0x1a2522, mq0: '#0f2420', mq1: '#1f4a40', ink: '#eaf6ee', sub: '#7fe0bf' },
      { body: 0x221d2b, mq0: '#221432', mq1: '#4a2462', ink: '#f7e9ff', sub: '#d7a6ff' },
      { body: 0x2b2116, mq0: '#3d1c26', mq1: '#a2384e', ink: '#fff1f0', sub: '#ffc7c7' }
    ];
    var STYLE_NIM = [
      { body: 0xa58fe6, mq0: '#bcd6ff', mq1: '#f4c6e3', ink: '#3b2a6e', sub: '#6d55b5', nim: true, trim: 0xffffff },
      { body: 0x7cc4d6, mq0: '#fde2c8', mq1: '#c8f0dc', ink: '#24525e', sub: '#c46a8f', nim: true, trim: 0xffffff }
    ];

    function buildCabinet(it, idx, style) {
      var g = new T.Group();
      var W = 0.86;
      var nim = !!style.nim;
      var bodyMat = new T.MeshStandardMaterial({ color: style.body, roughness: nim ? 0.6 : 0.42, metalness: nim ? 0 : 0.15 });
      var trimMat = nim ? new T.MeshStandardMaterial({ color: style.trim, roughness: 0.4 }) : M.bronze;
      var shape = new T.Shape();
      var pts = [[-0.42, 0], [0.36, 0], [0.36, 0.9], [0.5, 0.98], [0.47, 1.07], [0.22, 1.12], [0.12, 1.86], [0.27, 1.92], [0.27, 2.24], [-0.42, 2.24]];
      shape.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
      shape.closePath();
      var bev = nim ? 0.035 : 0.014;
      var side = new T.ExtrudeBufferGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: nim ? 4 : 2, steps: 1 });
      [-1, 1].forEach(function (s) {
        var m = new T.Mesh(side, [bodyMat, trimMat]);
        m.rotation.y = -Math.PI / 2;
        m.position.x = s > 0 ? W / 2 + 0.05 : -W / 2;
        g.add(m);
      });
      function part(w, h, d, x, y, z, mat, rx) {
        var m = new T.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m;
      }
      part(W, 0.9, 0.76, 0, 0.45, -0.03, bodyMat);
      part(W + 0.1, 0.06, 0.8, 0, 0.03, -0.03, nim ? trimMat : M.darkBronze);
      /* coin door with two lit slots */
      part(0.3, 0.34, 0.02, 0, 0.42, 0.355, M.black);
      var slotMat = new T.MeshBasicMaterial({ color: nim ? 0xff8fb8 : 0xff8a3c, toneMapped: false });
      part(0.03, 0.07, 0.01, -0.06, 0.48, 0.368, slotMat); part(0.03, 0.07, 0.01, 0.06, 0.48, 0.368, slotMat);
      /* plaque */
      var pl = new T.Mesh(new T.PlaneBufferGeometry(0.5, 0.094), plaqueMat(it.artist));
      pl.position.set(0, 0.76, 0.362); g.add(pl);
      part(0.52, 0.11, 0.008, 0, 0.76, 0.356, nim ? trimMat : M.darkBronze);
      /* control panel */
      var panel = part(W, 0.06, 0.34, 0, 1.03, 0.34, bodyMat, 0.36);
      var cp = new T.Group(); cp.position.set(0, 1.03, 0.34); cp.rotation.x = 0.36; g.add(cp);
      var stickM = new T.Mesh(new T.CylinderBufferGeometry(0.012, 0.012, 0.12, 8), M.black); stickM.position.set(-0.2, 0.09, 0); cp.add(stickM);
      var ball = new T.Mesh(new T.SphereBufferGeometry(0.035, 14, 10), new T.MeshStandardMaterial({ color: nim ? 0xff8fb8 : 0xd9452b, roughness: 0.25 })); ball.position.set(-0.2, 0.16, 0); cp.add(ball);
      var btnGeo = new T.CylinderBufferGeometry(0.03, 0.03, 0.03, 16);
      var bc = nim ? [0xffd36b, 0x8fd3ff, 0xb59cff] : [0xf2b45a, 0xece5d8, 0xff5c8a];
      bc.forEach(function (c, k) {
        var b = new T.Mesh(btnGeo, new T.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.25 }));
        b.position.set(0.02 + k * 0.1, 0.035, -0.02 + (k === 1 ? -0.04 : 0)); cp.add(b);
      });
      /* screen housing, bezel and glowing screen */
      part(W, 0.78, 0.54, 0, 1.49, -0.15, bodyMat);
      var tilt = -Math.atan2(0.1, 0.74);
      var scr = new T.Group(); scr.position.set(0, 1.49, 0.17); scr.rotation.x = tilt; g.add(scr);
      var bez = new T.Mesh(BOX, M.black); bez.scale.set(W, 0.76, 0.03); scr.add(bez);
      var a = it.p.aspect || 1, sw = Math.min(0.74, 0.62 * a), sh = sw / a;
      var screenMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      var screen = new T.Mesh(new T.PlaneBufferGeometry(sw, sh), screenMat); screen.position.z = 0.017; scr.add(screen);
      var glass = new T.Mesh(new T.PlaneBufferGeometry(W - 0.04, 0.72), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 1, transparent: true, opacity: 0.08, depthWrite: false }));
      glass.position.z = 0.022; scr.add(glass);
      /* marquee */
      part(W, 0.32, 0.69, 0, 2.08, -0.075, bodyMat);
      var mq = new T.Mesh(new T.PlaneBufferGeometry(W - 0.02, 0.27), marqueeMat(it, idx, style)); mq.position.set(0, 2.08, 0.272); g.add(mq);
      part(W, 0.03, 0.2, 0, 1.905, 0.17, nim ? trimMat : M.bronze);
      /* floor shading and screen spill */
      var blob = new T.Mesh(new T.PlaneBufferGeometry(1.5, 1.4), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.004, 0); g.add(blob);
      var spillMat = new T.MeshBasicMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, opacity: nim ? 0.18 : 0.26, depthWrite: false, blending: T.AdditiveBlending });
      var spill = new T.Mesh(new T.PlaneBufferGeometry(1.6, 1.6), spillMat);
      spill.rotation.x = -Math.PI / 2; spill.position.set(0, 0.007, 0.95); g.add(spill);

      screenMat.map = screenTex(it, function (img) { spillMat.color.copy(avgColor(img)); });
      screenMat.needsUpdate = true;
      return { group: g, hit: [screen, mq, bez, panel], screenMat: screenMat };
    }

    function buildFrame(it) {
      var g = new T.Group();
      var a = it.p.aspect || 1, w = 1.3, h = w / a;
      var fr = new T.Mesh(BOX, M.bronze); fr.scale.set(w + 0.16, h + 0.16, 0.06); fr.position.set(0, 1.75, 0.03); g.add(fr);
      var mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      var s = new T.Mesh(new T.PlaneBufferGeometry(w, h), mat); s.position.set(0, 1.75, 0.065); g.add(s);
      mat.map = screenTex(it); mat.needsUpdate = true;
      var lab = new T.Mesh(new T.PlaneBufferGeometry(0.9, 0.17), plaqueMat(it.name + '  ·  ' + it.artist)); lab.position.set(0, 1.75 - h / 2 - 0.28, 0.02); g.add(lab);
      var sp = new T.Mesh(new T.PlaneBufferGeometry(2.2, 1.6), new T.MeshBasicMaterial({ map: glowTex, color: 0xffd9a8, transparent: true, opacity: 0.16, depthWrite: false, blending: T.AdditiveBlending }));
      sp.rotation.x = -Math.PI / 2; sp.position.set(0, 0.007, 0.9); g.add(sp);
      return { group: g, hit: [s, fr] };
    }

    var FACE = { east: Math.PI / 2, west: -Math.PI / 2, north: Math.PI, south: 0 };
    var snowIdx = 0, nimIdx = 0;

    function placeAll() {
      items.forEach(function (it) {
        var built;
        if (it.frame) built = buildFrame(it);
        else if (it.room === 'nim') built = buildCabinet(it, nimIdx, STYLE_NIM[nimIdx++ % STYLE_NIM.length]);
        else built = buildCabinet(it, snowIdx, STYLE_SNOW[snowIdx++ % STYLE_SNOW.length]);
        var g = built.group;
        g.position.set(it.x, 0, it.z);
        g.rotation.y = FACE[it.face];
        scene.add(g);
        g.updateMatrixWorld(true);
        built.hit.forEach(function (m) { m.userData.item = it; clickables.push(m); });
        var front = new T.Vector3(0, 0, it.frame ? 0.1 : 0.45).applyMatrix4(g.matrixWorld);
        var dir = new T.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
        cabinets.push({ item: it, front: front, dir: dir });
        if (!it.frame) {
          var bb = new T.Box3().setFromObject(g);
          colliders.push({ minX: bb.min.x + 0.03, maxX: bb.max.x - 0.03, minZ: bb.min.z + 0.03, maxZ: bb.max.z - 0.03 });
        }
      });
    }

    function paintSigns() {
      var ink = '#3a2516';
      var hallSign = new T.Mesh(new T.PlaneBufferGeometry(4.4, 1.4), sign([
        { text: 'SNOWFRO ARCADE', font: '800 150px "Big Shoulders Display", Impact, sans-serif', color: ink, lh: 160 },
        { text: 'ONCHAIN EXPERIMENTS BY ERICK CALDERON', font: '500 34px "IBM Plex Mono", Menlo, monospace', color: '#6b4a2e', lh: 50, track: '4px' },
        { text: 'WALK UP TO A CABINET TO PLAY A REAL MINTED TOKEN', font: '400 26px "IBM Plex Mono", Menlo, monospace', color: '#7a5a3c', lh: 40, track: '3px' }
      ], 4.4, 1.4));
      hallSign.position.set(-HX + 0.02, 2.55, 9.6); hallSign.rotation.y = Math.PI / 2; scene.add(hallSign);
      var nimSign = new T.Mesh(new T.PlaneBufferGeometry(3.6, 1.2), sign([
        { text: 'THE NIM ROOM', font: '800 150px "Big Shoulders Display", Impact, sans-serif', color: ink, lh: 165 },
        { text: 'BRYAN BRINKMAN  ·  NIMBUDS AND NIMTEENS', font: '500 34px "IBM Plex Mono", Menlo, monospace', color: '#6b4a2e', lh: 50, track: '4px' }
      ], 3.6, 1.2, { align: 'center' }), undefined);
      nimSign.position.set(0, 4.35, HZ0 + 0.02); scene.add(nimSign);
      var nimInside = new T.Mesh(new T.PlaneBufferGeometry(5, 1.3), sign([
        { text: 'NIMBUDS + NIMTEENS', font: '800 140px "Big Shoulders Display", Impact, sans-serif', color: '#5a46a0', lh: 150 },
        { text: 'BRYAN BRINKMAN', font: '500 40px "IBM Plex Mono", Menlo, monospace', color: '#c4688f', lh: 50, track: '8px' }
      ], 5, 1.3, { align: 'center' }));
      nimInside.position.set(0, 3.55, NZ0 + 0.02); scene.add(nimInside);
    }

    var fontsReady = document.fonts && document.fonts.load ? Promise.race([
      Promise.all([
        document.fonts.load('800 80px "Big Shoulders Display"'),
        document.fonts.load('500 30px "IBM Plex Mono"'),
        document.fonts.load('400 30px "IBM Plex Mono"')
      ]),
      new Promise(function (r) { setTimeout(r, 2500); })
    ]) : Promise.resolve();
    fontsReady.then(function () { placeAll(); paintSigns(); }, function () { placeAll(); paintSigns(); });

    /* ---------------- movement ---------------- */
    function blocked(x, z) {
      for (var i = 0; i < colliders.length; i++) {
        var b = colliders[i];
        if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) return true;
      }
      return false;
    }
    function tryMove(dx, dz) {
      var moved = false;
      if (dx && !blocked(player.x + dx, player.z)) { player.x += dx; moved = true; }
      if (dz && !blocked(player.x, player.z + dz)) { player.z += dz; moved = true; }
      return moved;
    }

    window.addEventListener('keydown', function (e) {
      if (state.open || document.body.classList.contains('listing')) return;
      var t = e.target;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT') && (e.key === 'Enter' || e.key === ' ')) return;
      var k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q'].indexOf(k) >= 0) {
        keys[k] = true; tapTarget = null;
        if (k.indexOf('arrow') === 0) e.preventDefault();
      } else if ((k === 'e' || k === 'enter') && nearest) {
        e.preventDefault(); openPlay(nearest.item, 0);
      } else if (k === 'l') {
        if (document.pointerLockElement) document.exitPointerLock(); else if (canvas.requestPointerLock) canvas.requestPointerLock();
      }
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { keys = {}; });

    /* look by dragging; pointer lock optional */
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      if (state.open) return;
      canvas.focus({ preventScroll: true });
      if (document.pointerLockElement === canvas) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function (e) {
      if (document.pointerLockElement === canvas) {
        player.yaw -= e.movementX * 0.0022; player.pitch -= e.movementY * 0.0022; clampPitch(); return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      var s = e.pointerType === 'touch' ? 0.0055 : 0.0042;
      player.yaw += dx * s; player.pitch += dy * s; clampPitch();
    });
    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var quick = performance.now() - drag.t < 450 && drag.moved < 10;
      if (quick && e.type === 'pointerup') pick(e.clientX, e.clientY);
      drag = null;
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('click', function (e) { if (document.pointerLockElement === canvas) pick(window.innerWidth / 2, window.innerHeight / 2); });
    function clampPitch() { player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch)); }

    var ray = new T.Raycaster(), ndc = new T.Vector2();
    function pick(cx, cy) {
      ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(clickables.concat(floors), false);
      if (!hits.length) return;
      var h = hits[0];
      if (h.object.userData.item) {
        if (h.distance < 14) openPlay(h.object.userData.item, 0);
        return;
      }
      if (floors.indexOf(h.object) >= 0 && h.distance < 30) tapTarget = { x: h.point.x, z: h.point.z, stuck: 0 };
    }

    /* touch joystick */
    var stick = $('stick'), knob = stick.querySelector('.knob'), stickId = null;
    function stickMove(e) {
      var r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy, max = r.width / 2 - 10, d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      stickVec.x = dx / max; stickVec.y = dy / max;
    }
    stick.addEventListener('pointerdown', function (e) { stickId = e.pointerId; tapTarget = null; try { stick.setPointerCapture(e.pointerId); } catch (err) {} stickMove(e); e.preventDefault(); });
    stick.addEventListener('pointermove', function (e) { if (e.pointerId === stickId) stickMove(e); });
    function stickEnd(e) { if (e.pointerId !== stickId) return; stickId = null; stickVec.x = stickVec.y = 0; knob.style.transform = ''; }
    stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
    window.addEventListener('touchstart', function () { if (!document.body.classList.contains('touch')) document.body.classList.add('touch'); }, { passive: true, once: true });

    /* proximity prompt */
    var nearest = null, promptEl = $('prompt');
    promptEl.addEventListener('click', function () { if (nearest) openPlay(nearest.item, 0); });
    var fwd = new T.Vector3();
    function updatePrompt() {
      var best = null, bd = 1e9;
      camera.getWorldDirection(fwd);
      for (var i = 0; i < cabinets.length; i++) {
        var c = cabinets[i];
        var dx = player.x - c.front.x, dz = player.z - c.front.z;
        var d = Math.hypot(dx, dz);
        if (d > NEAR + (c.item.frame ? 0.4 : 0)) continue;
        if (dx * c.dir.x + dz * c.dir.z < 0.05) continue;
        var look = (-dx * fwd.x + -dz * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1);
        if (look < 0.5) continue;
        if (d < bd) { bd = d; best = c; }
      }
      if (best !== nearest) {
        nearest = best;
        promptEl.hidden = !best;
        if (best) { $('promptTitle').textContent = best.item.name; promptEl.setAttribute('aria-label', 'Play ' + best.item.name + ' by ' + best.item.artist); }
      }
    }

    var roomEl = $('room'), roomNow = '';
    function updateRoom() {
      var r = player.z < HZ0 ? 'The Nim Room' : (player.z > 8.6 ? 'Entrance' : 'Snowfro Arcade');
      if (r !== roomNow) { roomNow = r; roomEl.textContent = r; }
    }

    /* ---------------- loop ---------------- */
    var clock = new T.Clock();
    function frameLoop() {
      requestAnimationFrame(frameLoop);
      var dt = Math.min(clock.getDelta(), 0.05);
      if (state.open || document.body.classList.contains('listing')) return;
      var turn = (keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0);
      player.yaw += turn * 1.9 * dt;
      var f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - stickVec.y;
      var s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + stickVec.x;
      var speed = keys.shift ? RUN : WALK;
      var sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      if (f || s) {
        tapTarget = null;
        var len = Math.max(1, Math.hypot(f, s));
        tryMove((-sy * f + cy * s) / len * speed * dt, (-cy * f - sy * s) / len * speed * dt);
      } else if (tapTarget) {
        var tx = tapTarget.x - player.x, tz = tapTarget.z - player.z, td = Math.hypot(tx, tz);
        if (td < 0.25) tapTarget = null;
        else {
          var st = Math.min(td, speed * dt);
          if (!tryMove(tx / td * st, tz / td * st)) { if (++tapTarget.stuck > 10) tapTarget = null; }
          var want = Math.atan2(-tx, -tz), dyaw = ((want - player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          player.yaw += dyaw * Math.min(1, dt * 3);
        }
      }
      var t = clock.elapsedTime;
      camera.position.set(player.x, EYE + ((f || s || tapTarget) ? Math.sin(t * 9) * 0.015 : 0), player.z);
      camera.rotation.set(player.pitch, player.yaw, 0);
      for (var i = 0; i < clouds.length; i++) clouds[i].position.y = clouds[i].userData.base + Math.sin(t * 0.5 + clouds[i].userData.ph) * 0.08;
      updatePrompt();
      updateRoom();
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', function () {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = (window.innerWidth / window.innerHeight < 0.8 ? 80 : (window.innerWidth < 700 ? 74 : 66));
      camera.updateProjectionMatrix();
    });

    /* test and debugging hooks */
    window.ARCADE.player = player;
    window.ARCADE.teleport = function (x, z, yaw) { player.x = x; player.z = z; if (yaw !== undefined) player.yaw = yaw; tapTarget = null; };
    window.ARCADE.nearest = function () { return nearest && nearest.item.name; };
    window.ARCADE.renderer = renderer;
    window.ARCADE.keys = function () { return keys; };
    window.ARCADE.blocked = blocked;

    frameLoop();
    canvas.focus({ preventScroll: true });
  }
})();
