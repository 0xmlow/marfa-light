  // =====================================================================
  // TEXTURES: procedural surface detail, projected in world space
  //
  // Every material can carry a detail map: albedo variation (R), roughness
  // variation (G) and height (B), tileable, 512 square, computed in JS with
  // no canvas and no image. It is projected triplanar in world metres, so a
  // stone plinth and a stone step share one texel density and no UVs are
  // needed. Height drives a derivative bump, so pits, grain and brush lines
  // catch the low sun.
  // =====================================================================
  var DETAIL_SIZE = 256;
  function pnoise(x, y, p, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var x0 = ((ix % p) + p) % p, y0 = ((iy % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    return lerp(lerp(hash2(x0, y0, s), hash2(x1, y0, s), ux), lerp(hash2(x0, y1, s), hash2(x1, y1, s), ux), uy);
  }
  // periodic fbm over a unit tile: u, v in [0, 1)
  function pfbm(u, v, base, s, oct) {
    var t = 0, amp = 0.5, p = base;
    for (var i = 0; i < (oct || 5); i++) { t += amp * pnoise(u * p, v * p, p, s + i * 31); p *= 2; amp *= 0.5; }
    return t;
  }
  var DETAIL_KINDS = {
    // each returns [albedo, roughness, height] for a point on the tile
    stone: function (u, v, r) {
      var band = Math.sin((v + pfbm(u, v, 4, 11, 4) * 0.35) * Math.PI * 14) * 0.5 + 0.5;
      var n = pfbm(u, v, 6, 12, 3), pit = pfbm(u, v, 20, 13, 1);
      var hole = 1 - sstep(0.2, 0.3, pit);
      return [0.5 + (n - 0.5) * 0.3 + (band - 0.5) * 0.1 - hole * 0.1, 0.5 + hole * 0.2 + (n - 0.5) * 0.2, 0.55 + (n - 0.5) * 0.35 - hole * 0.25];
    },
    marble: function (u, v) {
      var t = pfbm(u, v, 4, 21, 5), vein = Math.abs(Math.sin((u + v * 0.6 + t * 1.8) * Math.PI * 4));
      var line = Math.pow(1 - vein, 10);
      return [0.55 - line * 0.35 + (t - 0.5) * 0.12, 0.45 - line * 0.1, 0.5 - line * 0.15];
    },
    concrete: function (u, v) {
      var n = pfbm(u, v, 6, 31, 3), m = pfbm(u, v, 2, 32, 3), pore = 1 - sstep(0.14, 0.22, pfbm(u, v, 24, 33, 1));
      var board = Math.abs(Math.sin(v * Math.PI * 6)) < 0.03 ? 1 : 0;
      return [0.5 + (n - 0.5) * 0.28 + (m - 0.5) * 0.22 - pore * 0.1 - board * 0.06, 0.55 + pore * 0.2, 0.5 + (n - 0.5) * 0.3 - pore * 0.2 - board * 0.12];
    },
    brushed: function (u, v) {
      var streak = pfbm(u * 0.04, v, 32, 41, 2) * 0.75 + pfbm(u * 0.25, v, 48, 42, 1) * 0.25;
      var blotch = pfbm(u, v, 3, 43, 3);
      return [0.5 + (streak - 0.5) * 0.28 + (blotch - 0.5) * 0.1, 0.5 + (streak - 0.5) * 0.6, 0.5 + (streak - 0.5) * 0.25];
    },
    rust: function (u, v) {
      var a = pfbm(u, v, 4, 51, 4), b = pfbm(u, v, 8, 52, 3), c = pfbm(u, v, 24, 53, 1);
      var bloom = a > 0.55 ? (a - 0.55) * 3 : 0;
      return [0.5 + (b - 0.5) * 0.45 - bloom * 0.35 + (c - 0.5) * 0.15, 0.62 + (b - 0.5) * 0.4, 0.5 + (b - 0.5) * 0.6 + bloom * 0.3];
    },
    plaster: function (u, v) {
      var t = pfbm(u, v, 3, 61, 4), sw = Math.sin((u * 5 + pfbm(u, v, 5, 62, 3) * 3) * Math.PI * 2) * 0.5 + 0.5;
      var grit = pfbm(u, v, 32, 63, 1);
      return [0.5 + (t - 0.5) * 0.3 + (sw - 0.5) * 0.06 + (grit - 0.5) * 0.08, 0.55 + (sw - 0.5) * 0.2, 0.5 + (sw - 0.5) * 0.3 + (grit - 0.5) * 0.25];
    },
    wood: function (u, v) {
      var w = pfbm(u * 0.25, v, 8, 71, 4), ring = Math.sin((v * 22 + w * 6) * Math.PI) * 0.5 + 0.5, fine = pfbm(u * 0.1, v, 48, 72, 1);
      return [0.5 + (ring - 0.5) * 0.35 + (fine - 0.5) * 0.12, 0.6 + (ring - 0.5) * 0.2, 0.5 + (ring - 0.5) * 0.4];
    },
    sand: function (u, v) {
      var g = pfbm(u, v, 24, 81, 2), m = pfbm(u, v, 4, 82, 3), rip = Math.sin((u + pfbm(u, v, 3, 83, 3) * 0.5) * Math.PI * 8) * 0.5 + 0.5;
      return [0.5 + (g - 0.5) * 0.3 + (m - 0.5) * 0.3, 0.6 + (g - 0.5) * 0.3, 0.5 + (g - 0.5) * 0.35 + (rip - 0.5) * 0.12];
    },
    paint: function (u, v) {
      var p = pfbm(u, v, 12, 91, 2), sc = pfbm(u, v * 0.05, 32, 92, 1), scratch = sc > 0.82 ? 1 : 0;
      return [0.5 + (p - 0.5) * 0.06 + scratch * 0.06, 0.45 + (p - 0.5) * 0.25 + scratch * 0.25, 0.5 + (p - 0.5) * 0.15];
    },
    terrazzo: function (u, v) {
      var chip = pfbm(u, v, 16, 101, 1), n = pfbm(u, v, 6, 102, 2);
      var c = chip > 0.62 ? 0.3 : chip < 0.3 ? -0.3 : 0;
      return [0.5 + c + (n - 0.5) * 0.1, 0.35 + Math.abs(c) * 0.2, 0.5 + c * 0.2];
    },
    cracks: function (u, v) {
      // dried playa: cells from jittered points, cracked where two cells meet
      var N = 7, gx = Math.floor(u * N), gy = Math.floor(v * N), d1 = 9, d2 = 9;
      for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
        var cx = gx + i, cy = gy + j, wx = ((cx % N) + N) % N, wy = ((cy % N) + N) % N;
        var px = (cx + hash2(wx, wy, 121)) / N, py = (cy + hash2(wx, wy, 122)) / N;
        var d = Math.sqrt((px - u) * (px - u) + (py - v) * (py - v));
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      var edge = 1 - sstep(0.0, 0.016, d2 - d1), n = pfbm(u, v, 8, 123, 2);
      return [0.52 + (n - 0.5) * 0.2 - edge * 0.35, 0.55 + edge * 0.3, 0.55 - edge * 0.55 + (n - 0.5) * 0.15];
    },
    crystal: function (u, v) {
      var f = pfbm(u, v, 5, 111, 4), cell = Math.abs(Math.sin(u * 40 + f * 9) * Math.sin(v * 40 - f * 7));
      return [0.5 + (cell - 0.5) * 0.35, 0.3 + (1 - cell) * 0.2, 0.5 + (cell - 0.5) * 0.6];
    }
  };
  var _detail = {};
  function detailTex(kind) {
    if (_detail[kind]) return _detail[kind];
    var S = (kind === 'obs_lime' || kind === 'obs_limestone' || kind === 'stone' || kind === 'brushed') ? 512 : DETAIL_SIZE, data = new Uint8Array(S * S * 4), fn = DETAIL_KINDS[kind] || DETAIL_KINDS.concrete;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var q = fn(x / S, y / S), i = (y * S + x) * 4;
      data[i] = clamp(q[0], 0, 1) * 255; data[i + 1] = clamp(q[1], 0, 1) * 255; data[i + 2] = clamp(q[2], 0, 1) * 255; data[i + 3] = 255;
    }
    var t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 8; t.needsUpdate = true;
    t.userData = { shared: true };
    return (_detail[kind] = t);
  }

  // one compile function for every detailed material, so they share a program
  function TRIPLANAR(shader) {
    var d = this.userData.tp;
    shader.uniforms.tpMap = { value: d.map };
    shader.uniforms.tpScale = { value: d.scale };
    shader.uniforms.tpAmt = { value: d.albedo };
    shader.uniforms.tpRough = { value: d.rough };
    shader.uniforms.tpBump = { value: d.bump };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTpW;\nvarying vec3 vTpN;')
      .replace('#include <worldpos_vertex>', [
        '#include <worldpos_vertex>',
        'vec4 tpw = vec4(transformed, 1.0);',
        'vec3 tpn = objectNormal;',
        '#ifdef USE_INSTANCING',
        '  tpw = instanceMatrix * tpw;',
        '  mat3 tim = mat3(instanceMatrix); tpn /= vec3(dot(tim[0],tim[0]),dot(tim[1],tim[1]),dot(tim[2],tim[2])); tpn = tim * tpn;',
        '#endif',
        'vTpW = (modelMatrix * tpw).xyz;',
        'mat3 tmm = mat3(modelMatrix); tpn /= vec3(dot(tmm[0],tmm[0]),dot(tmm[1],tmm[1]),dot(tmm[2],tmm[2])); vTpN = normalize(tmm * tpn);'
      ].join('\n'));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform sampler2D tpMap; uniform float tpScale; uniform float tpAmt; uniform float tpRough; uniform float tpBump;',
        'varying vec3 vTpW; varying vec3 vTpN;',
        'vec4 tpSample() {',
        '  vec3 n = abs(normalize(vTpN)); n = n * n * n * n; n /= (n.x + n.y + n.z + 1e-5);',
        '  vec3 p = vTpW * tpScale;',
        '  return texture2D(tpMap, p.zy) * n.x + texture2D(tpMap, p.xz) * n.y + texture2D(tpMap, p.xy) * n.z;',
        '}',
        'vec3 tpPerturb(vec3 p, vec3 n, vec2 dH) {',
        '  vec3 dpx = dFdx(p), dpy = dFdy(p);',
        '  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);',
        '  float det = dot(dpx, r1);',
        '  vec3 g = sign(det) * (dH.x * r1 + dH.y * r2);',
        '  return normalize(abs(det) * n - g);',
        '}'
      ].join('\n'))
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec4 tpS = tpSample();\nfloat tpDist = length(vViewPosition); float tpFade = 1.0 - smoothstep(6.0, 45.0, tpDist); float tpNear = 1.0 - smoothstep(2.5, 14.0, tpDist);\ndiffuseColor.rgb *= mix(1.0, tpS.r * 2.0, tpAmt * (0.35 + 0.65 * tpFade));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * mix(1.0, tpS.g * 2.0, tpRough * tpFade), 0.03, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif (tpBump > 0.0 && tpNear > 0.0) { vec2 dH = vec2(dFdx(tpS.b), dFdy(tpS.b)) * tpBump * tpNear; normal = tpPerturb(-vViewPosition, normal, dH); }');
  }
  function detail(mat, kind, o) {
    o = o || {};
    if (!mat.isMeshStandardMaterial) return mat;
    mat.userData.tp = {
      map: detailTex(kind), scale: 1 / (o.tile || 1.6),
      albedo: o.albedo == null ? 0.22 : o.albedo, rough: o.rough == null ? 0.45 : o.rough, bump: (o.bump == null ? 0.25 : o.bump) * 0.1
    };
    mat.onBeforeCompile = TRIPLANAR;
    mat.customProgramCacheKey = function () { return 'triplanar-2'; };
    mat.extensions = { derivatives: true };
    return mat;
  }
