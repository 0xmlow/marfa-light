
  // =====================================================================
  // THE CALENDAR: days the clock knows
  // Not traits. Every token keeps the same calendar, the way a real clock
  // in a real town sees the same holidays, and each token puts on its own
  // show from its own seed.
  //   Fourth of July  dusk to midnight in Marfa, a fireworks show over the
  //                   clock. Shells burst as real Chromie Squiggles, stars,
  //                   rings, an evil eye, gold willows and glitter, in red,
  //                   white and blue. The last minutes of every hour are a
  //                   finale; on the hour the token's own Squiggle bursts
  //                   big over the clock.
  //   New Year        from 23:45 on Dec 31, a few early shells, then at
  //                   midnight the token's own Squiggle and a finale in gold.
  // The show is a schedule, not a simulation: every shell is drawn from the
  // seed and its launch slot, so any second of the show can be rendered on
  // its own and a still of 22:00:03 on July 4 is always the same still.
  // Draws only from hashRng(hash, 9401) and slot seeds; builds from its own.
  // Indoor places see nothing. Keys: J jumps to July 4, N to New Year.
  // =====================================================================

  var CAL_SLOT = 0.9;                      // seconds per launch slot
  // colours are made on first use: the plan runs in node without three
  var CAL_RW, CAL_WH, CAL_BL, CAL_GOLD, CAL_SILVER, CAL_EYE;
  function cal_colors() {
    if (CAL_RW) return;
    CAL_RW = C('#FF2A3A'); CAL_WH = C('#FFF2E2'); CAL_BL = C('#3D6BFF'); CAL_GOLD = C('#FFC04A'); CAL_SILVER = C('#DDE6FF');
    CAL_EYE = [C('#1F4BD8'), C('#7FD4FF'), C('#FFFFFF'), C('#2A3A9A')];
    CAL_EVENTS['Fourth of July'].colors = [CAL_RW, CAL_WH, CAL_BL, CAL_RW, CAL_WH, CAL_BL, CAL_GOLD];
    CAL_EVENTS['New Year'].colors = [CAL_GOLD, CAL_SILVER, CAL_GOLD, CAL_WH];
    CAL_EVENTS['Juneteenth'].colors = [CAL_RW, CAL_WH, CAL_BL, CAL_RW, CAL_WH, CAL_BL];
  }
  var CAL_EVENTS = {
    'Fourth of July': {
      line: 'It is the Fourth of July in Marfa. From dusk to midnight the town puts on a show: Squiggles, stars and an evil eye in red, white and blue, a finale at the end of every hour, and on the hour this token’s own Squiggle.',
      mix: [['Peony', 20], ['Squiggle', 24], ['Ring', 9], ['Star', 11], ['Evil Eye', 7], ['Willow', 12], ['Glitter', 10], ['Palette', 7]],
      rate: function (t) { return t.m >= 57 ? 0.97 : 0.5; },
      multi: function (t) { return t.m >= 57 ? 0.75 : 0.12; }
    },
    'Juneteenth': {
      line: 'It is Juneteenth in Marfa. After dark the town puts on a show in the colours of the Juneteenth flag: red, white and blue, with its star and the nova burst round it.',
      mix: [['Nova', 26], ['Star', 14], ['Peony', 22], ['Ring', 10], ['Squiggle', 14], ['Glitter', 10], ['Willow', 4]],
      rate: function (t) { return t.h === 22 && t.m >= 50 ? 0.97 : 0.45; },
      multi: function (t) { return t.h === 22 && t.m >= 50 ? 0.7 : 0.1; }
    },
    'New Year': {
      line: 'It is New Year in Marfa. A few early shells, then at midnight this token’s own Squiggle and a finale in gold and silver.',
      mix: [['Peony', 14], ['Squiggle', 26], ['Ring', 8], ['Evil Eye', 8], ['Willow', 20], ['Glitter', 18], ['Palette', 6]],
      rate: function (t) { return t.mo === 12 ? 0.12 : t.m < 3 ? 0.97 : 0.42; },
      multi: function (t) { return t.mo === 1 && t.m < 3 ? 0.8 : 0.1; }
    }
  };
  // which event, if any, is on at this second
  function calEvent(utc) {
    var t = marfaTime(utc);
    if (t.mo === 7 && t.d === 4) return sunPos(utc).el < -5 ? 'Fourth of July' : null;
    if (t.mo === 6 && t.d === 19) return sunPos(utc).el < -5 && t.h < 23 ? 'Juneteenth' : null;
    if (t.mo === 12 && t.d === 31 && t.h === 23 && t.m >= 45) return 'New Year';
    if (t.mo === 1 && t.d === 1 && t.h === 0 && t.m < 30) return 'New Year';
    return null;
  }
  // the hour marks that get the token's own Squiggle
  function calMark(utc) {
    var t = marfaTime(utc);
    if (t.mo === 7 && t.d === 4) return (t.h === 22 || t.h === 23) && sunPos(utc).el < -5;
    return t.mo === 1 && t.d === 1 && t.h === 0;
  }
  // the next July 4 or New Year from a moment, for the J and N keys
  function calNext(utc, which) {
    var y = marfaTime(utc).y;
    var at = which === 'New Year' ? marfaUtc(y, 12, 31, 23, 58) + 30 : marfaUtc(y, 7, 4, 21, 57) + 30;
    return at < utc - 3600 ? (which === 'New Year' ? marfaUtc(y + 1, 12, 31, 23, 58) + 30 : marfaUtc(y + 1, 7, 4, 21, 57) + 30) : at;
  }
  // a Squiggle's colour at u along its run, as Snowfro computes it
  function cal_sqgHue(st, u) {
    var n = (Math.floor(st.segments) - 2) * 201, color = u * n;
    var hue = st.reverse ? 255 - (((color / st.spread) + st.startColor) % 255) : ((color / st.spread) + st.startColor) % 255;
    return new THREE.Color().setHSL(hue / 255, 1, 0.55);
  }

  function cal_fireworks(S) {
    var W = S.W, P = W.P;
    if (GEN_INDOOR[P.place]) return;
    cal_colors();
    var seed = Math.floor(hashRng(P.hash, 9401)() * 4294967296) >>> 0;
    var own = P.forms && P.forms.path ? { id: P.forms.squiggle, hash: P.forms.path } : sqgPick(P.hash);
    var MAX = 30000, pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    var mat = new THREE.PointsMaterial({ size: 3.6, map: gen_dotTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 2; pts.visible = false;
    S.box.add(pts);
    var proxy = new THREE.Mesh(new THREE.SphereBufferGeometry(4200, 16, 8, 0, 6.2832, 0, 1.5), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    proxy.visible = false; proxy.layers.set(31); S.box.add(proxy);
    var pick = { obj: proxy, name: 'Fireworks', line: '' };
    W.picks.push(pick);

    var cache = {}, cam0 = W.cam.pos, UP = new THREE.Vector3(0, 1, 0);
    function shell(r, ev, t0, big) {
      var E = CAL_EVENTS[ev], kind = big ? 'Own Squiggle' : pickW(r, E.mix);
      if (kind === 'Palette' && !pal_on(W)) kind = 'Peony';
      var fx = big ? rf(r, -0.12, 0.12) : rf(r, -0.82, 0.82), fy = big ? rf(r, 0.3, 0.42) : rf(r, 0.15, 0.6), D = big ? 300 : rf(r, 230, 430);
      // in the frame where the frame has sky; a clock seen from above gets its
      // show low over the horizon it faces, seen from the Ground view
      var dv = gen_dir(S, fx, fy), minEl = big ? 0.2 : rf(r, 0.1, 0.32);
      if (dv.y < minEl) { var hl = Math.hypot(dv.x, dv.z) || 1; dv.set(dv.x / hl * Math.sqrt(1 - minEl * minEl), minEl, dv.z / hl * Math.sqrt(1 - minEl * minEl)); }
      var B = cam0.clone().addScaledVector(dv, D);
      if (B.y < 50) B.y = 50 + r() * 20;
      var R = S.tv * D * (big ? 0.5 : rf(r, 0.2, 0.38));
      var sh = { t0: t0, rise: rf(r, 1.3, 1.9), B: B, base: new THREE.Vector3(B.x, 0, B.z), R: R, drag: 2.6, grav: 0.18, life: rf(r, 2.2, 3.2), crackle: 0 };
      var d = [], c = [], L = [];
      var tilt = rf(r, -0.5, 0.5), rot = r() * 6.2832, cr = Math.cos(rot), sr = Math.sin(rot);
      var e1 = S.rt.clone(), e2 = UP.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(S.f, Math.sin(tilt));
      var c1 = E.colors[Math.floor(r() * E.colors.length)], c2 = E.colors[Math.floor(r() * E.colors.length)];
      function put(x, y, z, colr, lk) {
        // x, y in the shape's plane (rotated), z towards the camera
        var X = x * cr - y * sr, Y = x * sr + y * cr;
        d.push(e1.x * X + e2.x * Y + S.f.x * z, e1.y * X + e2.y * Y + S.f.y * z, e1.z * X + e2.z * Y + S.f.z * z);
        c.push(colr.r, colr.g, colr.b); L.push(lk || 1);
      }
      function sphere(n, colr, colr2, jit) {
        for (var i = 0; i < n; i++) {
          var u = r() * 2 - 1, a = r() * 6.2832, s = Math.sqrt(1 - u * u), m = 1 - (jit || 0.08) * r();
          d.push(s * Math.cos(a) * m, u * m, s * Math.sin(a) * m);
          var cc = colr2 && r() < 0.5 ? colr2 : colr; c.push(cc.r, cc.g, cc.b); L.push(rf(r, 0.8, 1.1));
        }
      }
      function ring(n, rad, colr) { for (var i = 0; i < n; i++) { var a = i / n * 6.2832; put(Math.cos(a) * rad, Math.sin(a) * rad, rf(r, -0.04, 0.04), colr, rf(r, 0.9, 1.05)); } }
      if (kind === 'Squiggle' || kind === 'Own Squiggle') {
        // a real Squiggle's line, written in sparks and coloured along its run
        var tok = kind === 'Own Squiggle' || r() < 0.3 ? own : (function () { var t = SQG_TOKENS[Math.floor(r() * SQG_TOKENS.length)]; return { id: t[0], hash: t[1] }; })();
        var yAt = sqgPathFn(tok.hash), st = sqgState(tok.hash), n = big ? 420 : 260;
        rot = rf(r, -0.25, 0.25); cr = Math.cos(rot); sr = Math.sin(rot); e2.copy(UP);
        for (var i = 0; i < n; i++) { var u = i / (n - 1); put((u - 0.5) * 2, yAt(u) * 0.62, rf(r, -0.03, 0.03), cal_sqgHue(st, u), rf(r, 0.92, 1.05)); }
        sh.grav = 0.08; sh.life = big ? 4.2 : 3.2; sh.squiggle = tok.id;
      } else if (kind === 'Peony') sphere(160, c1, c2);
      else if (kind === 'Palette') { for (var p = 0; p < 120; p++) { var pc = C(palColor(W, p % 7, 7, true)), u2 = r() * 2 - 1, a2 = r() * 6.2832, s2 = Math.sqrt(1 - u2 * u2); d.push(s2 * Math.cos(a2), u2, s2 * Math.sin(a2)); c.push(pc.r, pc.g, pc.b); L.push(rf(r, 0.85, 1.1)); } }
      else if (kind === 'Ring') { ring(120, 1, c1); if (r() < 0.5) ring(70, 0.55, c2); }
      else if (kind === 'Star') {
        for (var k = 0; k < 150; k++) {
          var q = k / 150 * 10, j = Math.floor(q), f = q - j, ra = j % 2 ? 0.42 : 1, rb = j % 2 ? 1 : 0.42;
          var a0 = j / 10 * 6.2832 + 1.5708, a1 = (j + 1) / 10 * 6.2832 + 1.5708;
          put(lerp(Math.cos(a0) * ra, Math.cos(a1) * rb, f), lerp(Math.sin(a0) * ra, Math.sin(a1) * rb, f), 0, k % 3 ? c1 : CAL_WH, 1);
        }
      } else if (kind === 'Nova') {
        // the Juneteenth flag: a white star inside a twelve point burst
        for (var k2 = 0; k2 < 90; k2++) {
          var q2 = k2 / 90 * 10, j2 = Math.floor(q2), f2 = q2 - j2, ra2 = j2 % 2 ? 0.2 : 0.46, rb2 = j2 % 2 ? 0.46 : 0.2;
          var b0 = j2 / 10 * 6.2832 + 1.5708, b1 = (j2 + 1) / 10 * 6.2832 + 1.5708;
          put(lerp(Math.cos(b0) * ra2, Math.cos(b1) * rb2, f2), lerp(Math.sin(b0) * ra2, Math.sin(b1) * rb2, f2), 0, CAL_WH, 1);
        }
        for (k2 = 0; k2 < 144; k2++) {
          var q3 = k2 / 144 * 24, j3 = Math.floor(q3), f3 = q3 - j3, ra3 = j3 % 2 ? 0.62 : 1, rb3 = j3 % 2 ? 1 : 0.62;
          var c0 = j3 / 24 * 6.2832, c3 = (j3 + 1) / 24 * 6.2832;
          put(lerp(Math.cos(c0) * ra3, Math.cos(c3) * rb3, f3), lerp(Math.sin(c0) * ra3, Math.sin(c3) * rb3, f3), 0, CAL_RW, 1);
        }
        rot = 0; cr = 1; sr = 0; e2.copy(UP); sh.grav = 0.06; sh.life = 3.4;
      } else if (kind === 'Evil Eye') {
        // the eye, in rings: deep blue, sky, white, and a blue pupil
        ring(100, 1, CAL_EYE[0]); ring(76, 0.74, CAL_EYE[1]); ring(54, 0.5, CAL_EYE[2]); ring(30, 0.24, CAL_EYE[3]);
        sh.grav = 0.06; sh.life = 3.4;
      } else if (kind === 'Willow') { sphere(100, CAL_GOLD, null, 0.2); sh.drag = 1.6; sh.grav = 0.9; sh.life = 4.6; }
      else if (kind === 'Glitter') { sphere(130, CAL_WH, CAL_GOLD, 0.35); sh.crackle = 1; sh.life = 2.8; }
      sh.kind = kind; sh.n = L.length; sh.d = new Float32Array(d); sh.c = new Float32Array(c); sh.L = new Float32Array(L);
      return sh;
    }
    function slot(k) {
      if (cache[k]) return cache[k];
      var t0 = k * CAL_SLOT, ev = calEvent(t0), list = [];
      if (ev) {
        var r = seedRng((seed ^ Math.imul(k, 2654435761)) >>> 0), t = marfaTime(t0), E = CAL_EVENTS[ev], n = 0;
        if (r() < E.rate(t)) n = 1 + (r() < E.multi(t) ? ri(r, 1, 2) : 0);
        for (var i = 0; i < n; i++) list.push(shell(r, ev, t0 + r() * CAL_SLOT, false));
      }
      // on the mark the token's own Squiggle bursts, timed to the second
      var M = Math.ceil(t0 / 3600) * 3600, rise = 1.6;
      if (M - rise >= t0 && M - rise < t0 + CAL_SLOT && calMark(M)) {
        var big = shell(seedRng((seed ^ M) >>> 0), calEvent(M) || 'Fourth of July', M - rise, true);
        big.rise = rise; list.push(big);
      }
      list.ev = ev;
      cache[k] = list;
      return list;
    }

    var clockT = null, lastU = null, TR = [0, 0.05, 0.1, 0.16], TK = [1, 0.5, 0.28, 0.14];
    var wind = W.windDir.clone().multiplyScalar((W.windSpeed || 1) * 1.6), glow = new THREE.Color(), tint = new THREE.Color(), V = new THREE.Vector3();
    W.onUpdate(function (ctx) {
      // the show's own clock: it follows Marfa time, and keeps playing when the
      // clock is held still, so a still of the Fourth still has fireworks
      if (clockT == null || ctx.snap || ctx.fast || Math.abs(ctx.utc - lastU - ctx.dt) > 5) clockT = ctx.utc;
      else if (ctx.utc === lastU) clockT += ctx.dt;
      else clockT += ctx.utc - lastU;
      lastU = ctx.utc;
      var kHi = Math.floor(clockT / CAL_SLOT), kLo = Math.floor((clockT - 7.5) / CAL_SLOT), ev = null, m = 0, light = 0;
      for (var key in cache) if (+key < kLo) delete cache[key];
      glow.setRGB(0, 0, 0);
      for (var k = kLo; k <= kHi; k++) {
        var list = slot(k);
        if (list.ev) ev = list.ev;
        for (var s = 0; s < list.length; s++) {
          var sh = list[s], tau = clockT - sh.t0;
          if (tau < 0) continue;
          if (ev == null) ev = calEvent(sh.t0) || 'Fourth of July';
          if (tau < sh.rise) {
            // the rocket: a gold head and a short tail, slowing as it climbs
            for (var j = 0; j < 7 && m < MAX; j++) {
              var q = clamp((tau - j * 0.035) / sh.rise, 0, 1), e = 1 - (1 - q) * (1 - q), b = (1 - j / 7) * 0.9 * (0.7 + 0.3 * Math.sin(tau * 60 + j));
              V.copy(sh.base).lerp(sh.B, e);
              pos[m * 3] = V.x; pos[m * 3 + 1] = V.y; pos[m * 3 + 2] = V.z;
              col[m * 3] = CAL_GOLD.r * b; col[m * 3 + 1] = CAL_GOLD.g * b; col[m * 3 + 2] = CAL_GOLD.b * b; m++;
            }
            continue;
          }
          var tb = tau - sh.rise;
          if (tb > sh.life * 1.15) continue;
          var flash = Math.exp(-tb * 7);
          light += flash * 1.2 + 0.25 * Math.max(0, 1 - tb / sh.life);
          glow.r += sh.c[0] * (flash + 0.2); glow.g += sh.c[1] * (flash + 0.2); glow.b += sh.c[2] * (flash + 0.2);
          for (var i = 0; i < sh.n; i++) {
            var life = sh.life * sh.L[i];
            for (var tj = 0; tj < 4 && m < MAX; tj++) {
              var tt = tb - TR[tj];
              if (tt < 0 || tt > life) continue;
              var ex = sh.R * (1 - Math.exp(-sh.drag * tt)) / (1 - Math.exp(-sh.drag * 1.2)), fall = sh.grav * sh.R * 0.12 * tt * tt;
              var fade = Math.pow(1 - tt / life, 1.4) * TK[tj] * (1 + 1.5 * Math.exp(-tt * 9));
              if (sh.crackle && tt > life * 0.45) fade *= (hash2(i, Math.floor(tt * 24), 7) > 0.55 ? 2.2 : 0.1);
              pos[m * 3] = sh.B.x + sh.d[i * 3] * ex + wind.x * tt;
              pos[m * 3 + 1] = sh.B.y + sh.d[i * 3 + 1] * ex - fall;
              pos[m * 3 + 2] = sh.B.z + sh.d[i * 3 + 2] * ex + wind.z * tt;
              col[m * 3] = sh.c[i * 3] * fade; col[m * 3 + 1] = sh.c[i * 3 + 1] * fade; col[m * 3 + 2] = sh.c[i * 3 + 2] * fade; m++;
            }
          }
        }
      }
      geo.setDrawRange(0, m);
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      pts.visible = m > 0;
      // the bursts light the ground and the sky a little
      if (light > 0) {
        var gm = Math.max(glow.r, glow.g, glow.b, 1e-3);
        glow.multiplyScalar(1 / gm);
        var f = Math.min(light, 2.5) * 0.18;
        W.hemi.color.lerp(glow, clamp(f, 0, 0.6));
        W.hemi.intensity += f;
        W.sky.material.uniforms.zen.value.add(tint.copy(glow).multiplyScalar(f * 0.06));
      }
      proxy.position.copy(ctx.camera.position);
      proxy.layers.set(ev ? 0 : 31);
      if (ev) { pick.name = ev; pick.line = CAL_EVENTS[ev].line; }
      W.celebrating = ev;
    });
  }
