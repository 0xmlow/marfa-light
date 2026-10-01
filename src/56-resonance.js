  // MLow's original spatial studies, informed by the credited collections.
  // This is NOT those artists' code or a reproduction of a minted output.
  // Independent streams preserve all v0.8 token selections.
  var RES_SOURCES = {
    'Peg Constellation': 'Ringers / Dmitri Cherniak',
    'Flow Ribbons': 'Fidenza / Tyler Hobbs',
    'Recursive Terraces': 'Archetype / Kjetil Golid',
    'Contour Isobars': 'Meridian / Matt DesLauriers',
    'Chromie Trace': 'Chromie Squiggle / Snowfro',
    'Woven Paths': 'Friendship Bracelets / Alexis André'
  };
  // Exact RGB samples from Art Blocks' official #0 preview images, 2026-10-01.
  // A sampled subset, not the complete original algorithm's palette definition.
  var RES_PALETTES = {
    'Ringers #0 / Ivory and Gold': { by: 'Ringers #0 / Dmitri Cherniak', colors: ['#F5F5F5', '#2B2B2B', '#F2C945'] },
    'Fidenza #0 / Golf Socks': { by: 'Fidenza #0 / Tyler Hobbs', colors: ['#66806A', '#EBE4D8', '#264D2D', '#204973', '#F2C7C2', '#F29191', '#FCD9B1'] },
    'Archetype #0 / Red Spider': { by: 'Archetype #0 / Kjetil Golid', colors: ['#F2DBBD', '#E93E48', '#050505'] },
    'Meridian #0 / Shore': { by: 'Meridian #0 / Matt DesLauriers', colors: ['#E9E3D5', '#D6CE84', '#0B4A63', '#D69D02', '#328191'] }
  };
  function resPlan(hash, gen, place, align, palette) {
    var r = hashRng(hash, 8601), indoor = !!GEN_INDOOR[place];
    var pattern = pickW(r, [['Peg Constellation', 17], ['Flow Ribbons', 22], ['Recursive Terraces', 15], ['Contour Isobars', 20], ['Chromie Trace', 14], ['Woven Paths', 12]]);
    var density = pickW(r, [['Spare', 25], ['Measured', 53], ['Abundant', 22]]);
    var scale = pickW(r, [['Intimate', 30], ['Field', 52], ['Expansive', 18]]);
    var rhythm = pick(r, ['Sequence', 'Alternating', 'Grouped', 'Single Accent']);
    var finish = pickW(r, [['Mineral Inlay', 42], ['Satin Enamel', 40], ['Chalk Wash', 18]]);
    var paint = pickW(r, [['Tidal Bands', 38], ['Vertical Seams', 26], ['Contour Paint', 23], ['Basal Band', 13]]);
    var air = pickW(r, [['High Desert', 38], ['Pearl Haze', 25], ['Copper Veil', 23], ['Blue Distance', 14]]);
    var score = pickW(r, [['Open Arc', 42], ['Counterpoint', 33], ['Solar Axis', 25]]);
    var marker = pick(r, ['Sixty Petals', 'Braided Halo', 'Concentric Register']);
    var weave = pick(r, ['Three Strand', 'Double Twist', 'Chevron']);
    var cut = pick(r, ['Close Grain', 'Cross Bedding', 'Long Vein']);
    var grain = pickW(r, [['Fine', 35], ['Balanced', 45], ['Coarse', 20]]);
    var extent = indoor ? 0.62 : scale === 'Intimate' ? 0.78 : scale === 'Expansive' ? 1.3 : 1;
    var pitch = rf(r, 0.7, 1.8), phase = r() * Math.PI * 2, seed = Math.floor(r() * 4294967296) >>> 0;
    var pr = hashRng(hash, 8603), pname = pickW(pr, [['Token Palette', 52], ['Ringers #0 / Ivory and Gold', 12], ['Fidenza #0 / Golf Socks', 12], ['Archetype #0 / Red Spider', 12], ['Meridian #0 / Shore', 12]]);
    var sampled = RES_PALETTES[pname], paintPalette = sampled ? { name: pname, colors: sampled.colors, seed: seed, by: sampled.by } : null;
    var source = RES_SOURCES[pattern];
    var features = {
      'Pigment Palette': sampled ? pname : palette.name, 'Pigment Source': sampled ? sampled.by + ' / sampled preview' : 'Token palette',
      'Landscape Score': pattern, 'Score Reference': source, 'Score Density': density,
      'Score Scale': indoor ? 'Interior' : scale, 'Score Composition': score,
      'Pigment Rhythm': rhythm, 'Clock Accent': paint, 'Accent Finish': finish,
      'Atmospheric Depth': air, 'Mineral Cut': cut, 'Surface Grain': grain
    };
    if (palette.name !== 'Marfa' || paintPalette) features['Tie Weave'] = weave;
    if (align.gate !== 'None') { features['Alignment Register'] = marker; features['Alignment Approach'] = 'Twelve minute stations'; }
    return { paintPalette: paintPalette, pattern: pattern, density: density, scale: scale, rhythm: rhythm, finish: finish, paint: paint, air: air,
      score: score, marker: marker, weave: weave, cut: cut, grain: grain, extent: extent, pitch: pitch, phase: phase, seed: seed, features: features };
  }
  function resColor(W, i, n) {
    var R = W.P.resonance, j = i;
    if (R.rhythm === 'Alternating') j = i % 2 ? n - 1 : 0;
    if (R.rhythm === 'Grouped') j = Math.floor(i / 4) * 4;
    if (R.rhythm === 'Single Accent') j = Math.floor(n * 0.35);
    return palColor(W, j, n, false) || ['#C1764D', '#4D7477', '#D8B978', '#8B715C', '#E8D8BB'][j % 5];
  }
  // Paint only the clock builder's tagged structural material. Numerals,
  // hands, screens, mechanisms and other artists' exhibits keep their colours.
  function RES_PAINT(shader) {
    var d = this.userData.res;
    shader.uniforms.resA = { value: C(d.a) }; shader.uniforms.resB = { value: C(d.b) };
    shader.uniforms.resPitch = { value: d.pitch }; shader.uniforms.resPhase = { value: d.phase };
    shader.uniforms.resKind = { value: d.kind }; shader.uniforms.resRough = { value: d.rough };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 resA; uniform vec3 resB; uniform float resPitch; uniform float resPhase; uniform float resKind; uniform float resRough;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', [
      'float resAxis = vTpW.y;',
      'if (resKind > 0.5 && resKind < 1.5) resAxis = vTpW.x + 0.28 * vTpW.z;',
      'if (resKind > 1.5 && resKind < 2.5) resAxis += 0.18 * sin(vTpW.x * 1.8 + resPhase) + 0.12 * cos(vTpW.z * 1.4);',
      'float resWave = fract(resAxis / resPitch + resPhase);',
      'float resMask = (1.0 - smoothstep(0.12, 0.18, resWave)) * smoothstep(0.0, 0.025, resWave);',
      'if (resKind > 2.5) resMask = (1.0 - smoothstep(0.22, 0.26, vTpW.y)) * smoothstep(0.07, 0.10, vTpW.y);',
      'resMask *= 1.0 - tpDustUp * 0.28;',
      'diffuseColor.rgb = mix(diffuseColor.rgb, mix(resA, resB, smoothstep(-1.0, 1.0, sin(resAxis * 0.45 + resPhase))) * (0.83 + 0.34 * tpS.r), resMask);',
      '#include <roughnessmap_fragment>',
      'roughnessFactor = mix(roughnessFactor, resRough, resMask);'
    ].join('\n'));
  }
  function resPaint(W, hero) {
    var R = W.P.resonance, done = new Set();
    [hero.group].concat(W.heroParts || []).forEach(function (group) { group.traverse(function (o) {
      var m = o.material;
      if (!m || !m.userData || !m.userData.heroBase || !m.userData.tp || done.has(m)) return;
      done.add(m);
      m.userData.res = { a: resColor(W, 0, 6), b: resColor(W, 4, 6), pitch: R.pitch, phase: R.phase,
        kind: ['Tidal Bands', 'Vertical Seams', 'Contour Paint', 'Basal Band'].indexOf(R.paint),
        rough: R.finish === 'Satin Enamel' ? 0.32 : R.finish === 'Chalk Wash' ? 0.92 : 0.56 };
      // Vary grain on the clock only. Avoid modifying shared texture objects.
      m.userData.tp = Object.assign({}, m.userData.tp);
      m.userData.tp.scale *= R.grain === 'Fine' ? 1.8 : R.grain === 'Coarse' ? 0.65 : 1;
      var before = m.onBeforeCompile, key = m.customProgramCacheKey();
      // a clone keeps userData.tp but r124 drops onBeforeCompile, so paint
      // only shaders the triplanar pass actually patched
      m.onBeforeCompile = function (shader) { before.call(this, shader); if (shader.fragmentShader.indexOf('vTpW') >= 0) RES_PAINT.call(this, shader); };
      m.customProgramCacheKey = function () { return key + '/marfa-res-paint-1'; };
      m.needsUpdate = true;
    }); });
  }
  // The relief catches the low sun. Faces turned toward the sun glow in the
  // token's own pigment as the light rakes across the ground: nothing at
  // noon, full at the horizon. Shadows do the rest.
  function resLowSun(W, m) {
    var before = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    var U = { resSun: { value: new THREE.Vector3(0, 1, 0) }, resLow: { value: 0 } };
    m.onBeforeCompile = function (shader) {
      if (before) before.call(this, shader);
      shader.uniforms.resSun = U.resSun; shader.uniforms.resLow = U.resLow;
      var hasN = shader.fragmentShader.indexOf('vTpN') >= 0;
      if (!hasN) {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vResN;')
          .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvResN = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vResN;');
      }
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 resSun; uniform float resLow;')
        .replace('#include <emissivemap_fragment>', ['#include <emissivemap_fragment>',
          'vec3 resWn = normalize(' + (hasN ? 'vTpN' : 'vResN') + ');',
          'float resFace = pow(max(dot(resWn, resSun), 0.0), 1.4);',
          'vec3 resPig = vec3(1.0);',
          '#ifdef USE_INSTANCING_COLOR',
          'resPig = vColor;',
          '#endif',
          'totalEmissiveRadiance += resPig * vec3(1.0, 0.74, 0.5) * resFace * resLow * 0.55;'].join('\n'));
    };
    m.customProgramCacheKey = function () { return key + '/marfa-res-lowsun-1'; };
    W.onUpdate(function (ctx) {
      dirAzEl(ctx.sun.az, Math.max(ctx.sun.el, 0), U.resSun.value);
      U.resLow.value = sstep(-1, 2, ctx.sun.el) * (1 - sstep(4, 20, ctx.sun.el));
    });
  }
  // pigment pressed into earth never reads as pure black: lift the darkest
  // palette entries toward a burnt umber so the relief keeps its form
  function resRelief(hex) {
    var c = C(hex), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return l < 0.08 ? c.lerp(C('#5A4636'), 0.7) : c;
  }
  function resBuild(W, hero) {
    if (!W.P.resonance) return;
    var R = W.P.resonance;
    resPaint(W, hero);
    var S = { W: W, R: hero.R, g: W.P.gen, fov: GEN_FOV[W.P.gen.lens] || 38, shift: gen_shift(W.P.gen) };
    gen_basis(S);
    var group = new THREE.Group(); group.userData.plcSkip = true; group.userData.alnSkip = true; W.add(group);
    var rows = [], pegs = [], phase = R.phase, radius = hero.R + 2.4;
    // relief scale: raised enough to throw a long shadow when the sun is low
    var lift = R.density === 'Spare' ? 1.35 : R.density === 'Abundant' ? 0.85 : 1;
    // and it grows with the camera's distance, so a far framing still reads it
    // above the grass: knee-high land-art walls rather than a painted line
    var near = clamp(W.cam.dist / 12, 1, 2.4); lift *= near;
    var count = R.density === 'Spare' ? 7 : R.density === 'Abundant' ? 17 : 11;
    var span = (R.scale === 'Expansive' ? 24 : R.scale === 'Intimate' ? 12 : 17) * R.extent;
    // The same solar axis determines composition and the direction of the field.
    var az = R.score === 'Solar Axis' ? W.P.align.az * D2R : Math.atan2(W.cam.right.x, W.cam.right.z);
    var ax = Math.sin(az), azz = Math.cos(az), bx = -azz, bz = ax;
    function position(x, z) { return { x: ax * x + bx * z, z: azz * x + bz * z }; }
    function allowed(p, clearance) {
      return gen_open(S, p.x, p.z, clearance || 0.1, 1.03) && gen_inside(S, p.x, p.z, 0.45);
    }
    function segment(a, b, width, col, height) {
      var p = position((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      if (!allowed(p, width * 0.55)) return;
      if (R.score === 'Open Arc' && p.x * W.cam.dir.x + p.z * W.cam.dir.z > radius + span * 0.35) return;
      var pa = position(a[0], a[1]), pb = position(b[0], b[1]);
      var ya = gen_gy(S, pa.x, pa.z), yb = gen_gy(S, pb.x, pb.z);
      if (Math.abs(ya - yb) > 0.35) return;
      var dx = pb.x - pa.x, dz = pb.z - pa.z, len = Math.sqrt(dx * dx + dz * dz);
      // sunk 4 cm so the relief reads as set into the ground, not resting on it
      var hh = height || 0.12; width *= Math.sqrt(near);
      rows.push([p.x, (ya + yb) / 2 + hh / 2 - 0.04, p.z, Math.atan2(dx, dz), width, hh + 0.04, len * 1.04, col]);
    }
    if (R.pattern === 'Peg Constellation') {
      for (var i = 0; i < count; i++) {
        var a = phase + i / count * Math.PI * 2, rr = radius - 0.3 + Math.sin(i * 2.399) * 0.7;
        var p = [Math.cos(a) * rr, Math.sin(a) * rr], w = position(p[0], p[1]);
        if (allowed(w, 0.45)) pegs.push([w.x, gen_gy(S, w.x, w.z), w.z, i, (1.1 + 0.9 * ((i * 7) % 5) / 4) * Math.sqrt(near)]);
        var na = phase + (i + 1) / count * Math.PI * 2, nr = radius - 0.3 + Math.sin((i + 1) * 2.399) * 0.7;
        for (var k = 0; k < 18; k++) {
          var t = k / 18, t1 = (k + 1) / 18;
          segment([lerp(p[0], Math.cos(na) * nr, t), lerp(p[1], Math.sin(na) * nr, t)], [lerp(p[0], Math.cos(na) * nr, t1), lerp(p[1], Math.sin(na) * nr, t1)], 0.18, i, 0.14 * lift);
        }
      }
    } else if (R.pattern === 'Recursive Terraces') {
      for (var row = -count; row <= count; row++) for (var col = -count; col <= count; col++) {
        var x = col * 1.25, z = row * 1.25;
        if ((row + col + 2 * count) % 3 === 0 || x * x + z * z > (radius + span * 0.5) * (radius + span * 0.5)) continue;
        // stepped like a terrace: the farther ring, the higher the step
        // terraces are solid blocks: they scale gently, not with the full lift
        var h = (0.12 + 0.1 * ((Math.abs(row) + Math.abs(col)) % 3) + 0.04 * Math.max(Math.abs(row), Math.abs(col)) / count * 3) * lift / Math.sqrt(near);
        segment([x, z], [x, z + 1.0], 0.5, Math.abs(row + col), h);
      }
    } else {
      var sq = R.pattern === 'Chromie Trace' ? sqgPathFn(W.P.forms.path) : null;
      for (var lane = 0; lane < count; lane++) {
        var prev = null;
        for (var step = 0; step <= 90; step++) {
          var t2 = step / 90, xx = (t2 - 0.5) * span * 2, zz = (lane - (count - 1) / 2) * 0.75;
          if (R.pattern === 'Contour Isobars') {
            var ang = t2 * Math.PI * 2, rr2 = radius + lane * 0.62 + 0.6 * Math.sin(ang * 3 + phase) + 0.35 * Math.cos(ang * 5);
            xx = Math.cos(ang) * rr2; zz = Math.sin(ang) * rr2;
          } else if (R.pattern === 'Chromie Trace') zz += sq(t2) * 5.2;
          else if (R.pattern === 'Woven Paths') zz += Math.sin(t2 * Math.PI * 6 + lane * Math.PI * 2 / 3) * 2.4;
          else zz += 3 * Math.sin(xx * 0.15 + phase) + 1.1 * Math.sin(xx * 0.33 + lane * 0.19);
          // the crest swells and settles along each line, so the low sun rakes it
          var crest = (0.24 + 0.14 * Math.sin(t2 * Math.PI * 5 + lane * 1.7 + phase)) * lift;
          if (R.pattern === 'Flow Ribbons') crest *= 0.75;
          if (prev) segment(prev, [xx, zz], R.pattern === 'Flow Ribbons' ? 0.55 : R.pattern === 'Contour Isobars' ? 0.2 : 0.24, lane, crest);
          prev = [xx, zz];
        }
      }
    }
    if (rows.length) {
      var mat = mtl('#FFFFFF', R.finish === 'Satin Enamel' ? 'paint' : 'stone', R.finish === 'Satin Enamel' ? 0.4 : 0.85, 0.03, R.cut === 'Close Grain' ? 0.32 : R.cut === 'Long Vein' ? 1.7 : 0.8);
      resLowSun(W, mat);
      var mesh = gen_inst(new THREE.BoxBufferGeometry(1, 1, 1), mat, rows.length, true);
      var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), sc = new THREE.Vector3();
      rows.forEach(function (v, j) { mesh.setMatrixAt(j, m4.compose(p3.set(v[0], v[1], v[2]), q.setFromEuler(e.set(0, v[3], 0)), sc.set(v[4], v[5], v[6]))); mesh.setColorAt(j, resRelief(resColor(W, v[7], count))); });
      group.add(mesh);
      W.pick(mesh, R.pattern, 'An original MLow landscape score, in dialogue with ' + RES_SOURCES[R.pattern] + '. Pigment and shallow relief follow the token’s palette and leave the clock’s footprint clear.');
    }
    if (pegs.length) {
      var pinMat = std('#FFFFFF', 0.45, 0.5); resLowSun(W, pinMat);
      var pins = gen_inst(new THREE.CylinderBufferGeometry(0.13, 0.17, 1, 14), pinMat, pegs.length, true);
      pegs.forEach(function (v, j) { pins.setMatrixAt(j, new THREE.Matrix4().compose(new THREE.Vector3(v[0], v[1] + v[4] / 2 - 0.04, v[2]), new THREE.Quaternion(), new THREE.Vector3(Math.sqrt(near), v[4], Math.sqrt(near)))); pins.setColorAt(j, resRelief(resColor(W, v[3], count))); }); group.add(pins);
    }
    W.resonanceStats = { segments: rows.length, pegs: pegs.length };
  }

  // An engraved, palette-coloured approach to the existing physical gate.
  // The register lights ONLY on the chosen calendar date; geometry alone
  // can also align on a second day with the same solar declination.
  function resAlignment(W, A, marker, gate) {
    var R = W.P.resonance; if (!R) return;
    var N = R.marker === 'Sixty Petals' ? 60 : R.marker === 'Braided Halo' ? 72 : 96;
    var ring = gen_inst(new THREE.BoxBufferGeometry(1, 1, 1), std('#FFFFFF', 0.46, 0.6), N, false);
    for (var j = 0; j < N; j++) {
      var a = j / N * Math.PI * 2, rr = R.marker === 'Concentric Register' ? 0.43 + (j % 3) * 0.13 : 0.55 + (R.marker === 'Braided Halo' ? 0.075 * Math.sin(a * 12) : 0);
      ring.setMatrixAt(j, new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * rr, 0.015, Math.cos(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(0.028, 0.025, R.marker === 'Sixty Petals' ? (j % 5 ? 0.09 : 0.19) : 0.055)));
      ring.setColorAt(j, C(resColor(W, j, N)));
    }
    marker.add(ring);
    var stations = [], dir = dirAzEl(A.az, 0), perp = new THREE.Vector3(-dir.z, 0, dir.x);
    for (var i = 0; i < 12; i++) {
      var p = marker.position.clone().addScaledVector(dir, (i + 1) * 0.28).addScaledVector(perp, 0.85);
      var m = std(resColor(W, i, 12), 0.5, 0.35), stone = box(0.12, 0.035, 0.2, m);
      m.emissive = C(resColor(W, i, 12));
      stone.position.set(p.x, aln_gy(W, p.x, p.z) + 0.033, p.z); stone.rotation.y = Math.atan2(dir.x, dir.z);
      W.add(stone); stations.push(m);
    }
    var chosen = marfaTime(A.utc);
    W.onUpdate(function (ctx) {
      var sameDay = ctx.t.mo === chosen.mo && ctx.t.d === chosen.d;
      var delta = (chosen.h * 60 + chosen.m) - (ctx.t.h * 60 + ctx.t.m + (ctx.t.s || 0) / 60);
      stations.forEach(function (m, j) { m.emissiveIntensity = sameDay && delta >= 0 && delta <= 12 && j >= delta - 1 ? 0.7 : 0; });
    });
    W.pick(ring, 'Alignment Register', R.marker + '. The twelve inlaid stations illuminate during the twelve minutes before the token’s annual appointment with the sun.');
  }

  // Offline studies occupy the four former credit plaques. The website can
  // replace these with official Art Blocks preview textures and open the
  // original generator. The standalone token never requests those resources.
  var RES_EXHIBITS = {
    'Ringers Board': ['Ringers', 'Dmitri Cherniak', 1],
    'Fidenza Mural': ['Fidenza', 'Tyler Hobbs', 5 / 6],
    'Archetype Stack': ['Archetype', 'Kjetil Golid', 1],
    'Meridian Painting': ['Meridian', 'Matt DesLauriers', 0.5625]
  };
  function resReference(hash, name) {
    var keys = Object.keys(REF_IDS), r = hashRng(hash, 8700 + keys.indexOf(name)), list = REF_IDS[name];
    var t = list[Math.floor(r() * list.length)]; return { name: name, n: t[0], id: t[1], contract: '0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270', chain: 1 };
  }
  Object.keys(RES_EXHIBITS).forEach(function (key) {
    var info = RES_EXHIBITS[key], def = EGG_DEFS[key];
    def.line = 'An original MLow study in dialogue with ' + info[0] + ' by ' + info[1] + '. The website can show the actual referenced token through Art Blocks.';
    def.build = function (W) {
      var ref = resReference(W.P.hash, info[0]), r = hashRng(W.P.hash, 8711 + Object.keys(RES_EXHIBITS).indexOf(key));
      var aspect = info[2], hh = 3.1, ww = hh * aspect;
      var texture = canvasTex(Math.round(600 * aspect), 600, function (c, w, h) {
        c.fillStyle = '#E8DFC9'; c.fillRect(0, 0, w, h);
        // These are diagrams of this token's own landscape score, labelled
        // as MLow studies; they are never passed off as the referenced NFT.
        for (var j = 0; j < 22; j++) {
          c.strokeStyle = resColor(W, j, 22); c.fillStyle = c.strokeStyle; c.lineWidth = 2.5;
          if (info[0] === 'Archetype') {
            var x = 24 + (j % 4) * (w - 48) / 4, y = 24 + Math.floor(j / 4) * (h - 110) / 6;
            c.fillRect(x, y, (w - 70) / 4, 20 + r() * 42);
          } else if (info[0] === 'Ringers') {
            var a = j / 22 * Math.PI * 2, rad = Math.min(w, h) * 0.31;
            c.beginPath(); c.arc(w / 2 + Math.cos(a) * rad, h * 0.44 + Math.sin(a) * rad, 6 + j % 4, 0, Math.PI * 2); c.stroke();
          } else {
            c.beginPath(); for (var k = 0; k <= 80; k++) { var px = 22 + k / 80 * (w - 44), py = 35 + j * (h - 140) / 22 + Math.sin(k * 0.07 + j * 0.18) * 20; if (!k) c.moveTo(px, py); else c.lineTo(px, py); } c.stroke();
          }
        }
        c.fillStyle = '#E8DFC9'; c.fillRect(0, h - 62, w, 62); c.fillStyle = '#292D2B'; c.font = '16px monospace'; c.textAlign = 'center'; c.fillText('MLOW / SPATIAL STUDY', w / 2, h - 34);
        c.font = '12px monospace'; c.fillText('AFTER ' + info[0].toUpperCase(), w / 2, h - 14);
      });
      var E = exh_screen(W, ww, hh, 2.35, texture, [info[0].toUpperCase() + ' #' + ref.n, info[1].toUpperCase(), 'OFFLINE: MLOW STUDY / ONLINE: ORIGINAL']);
      if (!exh_place(W, E.g, 2.6)) { texture.dispose(); return; }
      ref.mesh = E.screen; ref.artist = info[1]; ref.aspect = aspect;
      (W.referenceScreens = W.referenceScreens || []).push(ref);
      E.g.userData.onClick = E.screen.userData.onClick = function () { if (W.openReference) W.openReference(ref); };
      W.pick(E.g, info[0] + ' / ' + info[1], 'Offline: an original MLow spatial study. On the website, the official preview of ' + info[0] + ' #' + ref.n + ' replaces it; click to play the original Art Blocks script.');
    };
  });
