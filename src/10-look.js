  // =====================================================================
  // LOOK: colour, light by elevation, textures, sky, stars, moon, clouds
  // =====================================================================
  function C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  var BRAND = { blue: '#2962FF', cyan: '#22D3EE', green: '#00E676', ink: '#0D0D0D', cloud: '#F0F4F8', pink: '#FF2E63' };

  // Sky and light by solar elevation. The ramp's shape is measured (zenith
  // to horizon as a power of 2.6). The colours are set by eye, and are the
  // first thing the residency is meant to correct against the real sky.
  var KEYS = [
    [-18, '#050B1E', '#0E1A36', '#000000', 0.00, 0.10],
    [-8,  '#0B1630', '#2B2A48', '#000000', 0.00, 0.16],
    [-3,  '#1C2F55', '#B46A58', '#FF7A3C', 0.00, 0.24],
    [0,   '#2E4468', '#E3A06C', '#FF8E42', 0.30, 0.34],
    [5,   '#40608C', '#E8C892', '#FFBE72', 0.74, 0.42],
    [10,  '#335F9C', '#E6D2A8', '#FFD49A', 0.86, 0.44],
    [20,  '#2F63A6', '#CFD6D2', '#FFE4BA', 0.95, 0.48],
    [45,  '#2459A6', '#B6CEE2', '#FFF3DE', 1.02, 0.52],
    [85,  '#2358A2', '#C2D7E8', '#FFF9EE', 1.06, 0.58]
  ];
  var KEYC = null;
  function lightAt(el) {
    if (!KEYC) KEYC = KEYS.map(function (k) { return [k[0], C(k[1]), C(k[2]), C(k[3]), k[4], k[5]]; });
    var e = clamp(el, KEYC[0][0], KEYC[KEYC.length - 1][0]), i = 0;
    while (i < KEYC.length - 2 && e > KEYC[i + 1][0]) i++;
    var a = KEYC[i], b = KEYC[i + 1], t = (e - a[0]) / (b[0] - a[0]);
    return {
      zen: a[1].clone().lerp(b[1], t), hor: a[2].clone().lerp(b[2], t), sun: a[3].clone().lerp(b[3], t),
      direct: lerp(a[4], b[4], t), ambient: lerp(a[5], b[5], t)
    };
  }

  // ------------------------------------------------------------ textures
  function canvasTex(w, h, draw, opts) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    draw(g, w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    if (opts && opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    return t;
  }
  var FONT_SERIF = 'Georgia, "Times New Roman", serif';
  var FONT_MONO = 'Consolas, Menlo, "Courier New", monospace';
  var FONT_SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  // a flat panel of text, sized in metres by its height
  function textPlane(lines, o) {
    o = o || {};
    lines = [].concat(lines);
    var px = o.px || 96, font = (o.weight || '700') + ' ' + px + 'px ' + (o.font || FONT_SERIF);
    var meas = document.createElement('canvas').getContext('2d');
    meas.font = font;
    var ls = o.spacing || 0, wmax = 0;
    lines.forEach(function (l) { wmax = Math.max(wmax, meas.measureText(l).width + ls * px * l.length); });
    var pad = o.pad == null ? px * 0.3 : o.pad * px;
    var W = Math.ceil(wmax + pad * 2), H = Math.ceil(px * 1.25 * lines.length + pad * 2);
    var tex = canvasTex(W, H, function (g) {
      if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, W, H); }
      g.font = font; g.fillStyle = o.color || '#111'; g.textBaseline = 'middle';
      g.textAlign = o.align === 'left' ? 'left' : 'center';
      lines.forEach(function (l, i) {
        var y = pad + px * 1.25 * (i + 0.5);
        if (ls) {
          var tw = meas.measureText(l).width + ls * px * l.length, x = o.align === 'left' ? pad : (W - tw) / 2;
          g.textAlign = 'left';
          for (var k = 0; k < l.length; k++) { g.fillText(l[k], x, y); x += meas.measureText(l[k]).width + ls * px; }
        } else g.fillText(l, o.align === 'left' ? pad : W / 2, y);
      });
    });
    var h = o.height || 0.3, w = h * W / H;
    var m = new THREE.MeshStandardMaterial({
      map: tex, transparent: !o.bg, roughness: o.rough == null ? 0.7 : o.rough, metalness: 0,
      emissive: o.glow ? C(o.glow) : new THREE.Color(0), emissiveMap: o.glow ? tex : null,
      depthWrite: !!o.bg, side: o.double ? THREE.DoubleSide : THREE.FrontSide
    });
    var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), m);
    mesh.userData.w = w; mesh.userData.h = h;
    return mesh;
  }

  // soft contact shadow for objects outside the shadow map
  var _blobTex = null;
  function blobShadow(w, d, alpha) {
    if (!_blobTex) {
      _blobTex = canvasTex(128, 128, function (g) {
        var gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      });
      _blobTex.userData = { shared: true };
    }
    var m = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, d), new THREE.MeshBasicMaterial({
      map: _blobTex, transparent: true, opacity: alpha == null ? 0.45 : alpha, depthWrite: false, color: 0x000000
    }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1;
    return m;
  }

  var _eyeTex = null;
  function eyeTexture() {
    if (_eyeTex) return _eyeTex;
    _eyeTex = canvasTex(1024, 512, function (g) {
      g.fillStyle = '#F4F6F8'; g.fillRect(0, 0, 1024, 512);
      var k = 1024 / (2 * Math.PI), cx = 256, cy = 256;
      [[0.95, BRAND.blue], [0.66, '#FFFFFF'], [0.46, BRAND.cyan], [0.30, BRAND.ink]].forEach(function (r) {
        g.fillStyle = r[1]; g.beginPath(); g.arc(cx, cy, r[0] * k, 0, 6.2832); g.fill();
      });
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(cx - 0.14 * k, cy - 0.14 * k, 0.07 * k, 0, 6.2832); g.fill();
    });
    _eyeTex.userData = { shared: true };
    return _eyeTex;
  }

  // ------------------------------------------------------------ sky dome
  function makeSky() {
    var u = {
      zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
      glow: { value: 1 }, disk: { value: 1 }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 zen; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol;',
        'uniform float glow; uniform float disk;',
        'varying vec3 vDir;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float e = asin(clamp(d.y, -1.0, 1.0)) / 1.5707963;',
        '  vec3 col = e >= 0.0 ? mix(zen, hor, pow(1.0 - e, 2.6)) : mix(hor, gnd, smoothstep(0.0, 0.05, -e));',
        '  float c = max(dot(d, sunDir), 0.0);',
        '  float band = 1.0 - smoothstep(0.0, 0.22, abs(e));',
        '  col += sunCol * glow * (0.18 * pow(c, 9.0) + 0.5 * pow(c, 80.0) + 0.28 * band * pow(c, 4.0));',
        '  col += sunCol * disk * smoothstep(0.99988, 0.99994, c) * 12.0;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    var mesh = new THREE.Mesh(new THREE.SphereBufferGeometry(4500, 48, 24), mat);
    mesh.frustumCulled = false; mesh.renderOrder = -10;
    return mesh;
  }

  // ------------------------------------------------------------ stars
  // Real sky geometry: the stars are placed in right ascension and
  // declination and turned by local sidereal time, so they wheel about
  // Polaris at Marfa's latitude. The field is fixed, the same for every token.
  function makeStars() {
    var r = seedRng(317), n1 = 2600, n2 = 3200, pos = [], col = [], i;
    var tint = [C('#BFD0FF'), C('#FFFFFF'), C('#FFF1D8'), C('#FFD8A8')];
    function push(x, y, z, b) {
      pos.push(x * 4200, y * 4200, z * 4200);
      var c = tint[Math.floor(r() * 4)];
      col.push(c.r * b, c.g * b, c.b * b);
    }
    for (i = 0; i < n1; i++) {
      var z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      var b = Math.pow(r(), 3) * 1.6 + 0.12;
      push(s * Math.cos(a), -s * Math.sin(a), z, b);
    }
    // the band of the galaxy: north galactic pole at RA 192.86, Dec 27.13
    var gra = 192.86 * D2R, gde = 27.13 * D2R;
    var P = new THREE.Vector3(Math.cos(gde) * Math.cos(gra), Math.cos(gde) * Math.sin(gra), Math.sin(gde));
    var U = new THREE.Vector3(0, 0, 1).cross(P).normalize(), V = P.clone().cross(U).normalize(), v = new THREE.Vector3();
    for (i = 0; i < n2; i++) {
      var th = r() * Math.PI * 2, gz = (r() + r() + r() - 1.5) * 0.14;
      v.copy(U).multiplyScalar(Math.cos(th)).addScaledVector(V, Math.sin(th)).addScaledVector(P, gz).normalize();
      push(v.x, -v.y, v.z, 0.1 + r() * 0.45);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
    var pts = new THREE.Points(geo, mat);
    pts.matrixAutoUpdate = false; pts.frustumCulled = false; pts.renderOrder = -9;
    return pts;
  }
  var _Q0 = null, _W = null, _P = null, _basis = null, _rz = null;
  function starMatrix(L, camPos, out) {
    if (!_Q0) {
      _Q0 = new THREE.Vector3(0, CPHI, SPHI); _W = new THREE.Vector3(-1, 0, 0); _P = new THREE.Vector3(0, SPHI, -CPHI);
      _basis = new THREE.Matrix4().makeBasis(_Q0, _W, _P); _rz = new THREE.Matrix4();
    }
    _rz.makeRotationZ(L);
    out.multiplyMatrices(_basis, _rz);
    out.setPosition(camPos);
    return out;
  }

  // ------------------------------------------------------------ the moon
  function makeMoon() {
    var tex = canvasTex(512, 256, function (g) {
      var r = seedRng(1969);
      g.fillStyle = '#D8D6CF'; g.fillRect(0, 0, 512, 256);
      for (var i = 0; i < 26; i++) {
        var x = r() * 512, y = 40 + r() * 176, rad = 10 + r() * 46;
        var gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(120,120,118,0.55)'); gr.addColorStop(1, 'rgba(120,120,118,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill();
      }
      for (i = 0; i < 90; i++) {
        g.strokeStyle = 'rgba(90,90,88,' + (0.1 + r() * 0.2) + ')'; g.lineWidth = 1;
        g.beginPath(); g.arc(r() * 512, r() * 256, 1 + r() * 5, 0, 6.2832); g.stroke();
      }
    });
    var mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, sunDir: { value: new THREE.Vector3() }, gain: { value: 1 } },
      fog: false, depthWrite: false,
      vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform sampler2D map; uniform vec3 sunDir; uniform float gain; varying vec3 vN; varying vec2 vUv;',
        'void main(){ vec3 a = texture2D(map, vUv).rgb; a = a * a;',
        '  float l = smoothstep(-0.05, 0.25, dot(normalize(vN), sunDir));',
        '  vec3 col = a * (l * 1.9 + 0.035) * gain;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 40, 20), mat);
    m.scale.setScalar(4100 * Math.tan(0.27 * 1.7 * D2R));
    m.frustumCulled = false; m.renderOrder = -8;
    return m;
  }

  // ------------------------------------------------------------ clouds
  function makeClouds(r, kind, view) {
    var g = new THREE.Group(), n = kind === 'Clear' ? ri(r, 0, 2) : kind === 'Scattered' ? ri(r, 8, 13) : ri(r, 12, 18);
    var mat = new THREE.MeshLambertMaterial({ color: C('#FFFFFF'), emissive: new THREE.Color(0), flatShading: true });
    g.userData.mat = mat;
    var geo = new THREE.IcosahedronBufferGeometry(1, 1);
    for (var i = 0; i < n; i++) {
      var c = new THREE.Group(), puffs = ri(r, 6, 12), tall = kind === 'Monsoon' && r() < 0.6;
      var len = rf(r, 160, 420);
      for (var p = 0; p < puffs; p++) {
        var s = rf(r, 40, 90) * (tall ? 1.3 : 1);
        var m = new THREE.Mesh(geo, mat);
        m.scale.set(s * rf(r, 1.2, 2.0), s * rf(r, 0.35, 0.6) * (tall ? rf(r, 1.6, 3.2) : 1), s * rf(r, 0.8, 1.2));
        m.position.set(rf(r, -len, len), (tall ? rf(r, 0, 180) : rf(r, -10, 30)), rf(r, -60, 60));
        c.add(m);
      }
      var ang = (view + rf(r, -70, 70)) * D2R, dist = rf(r, 2600, 5200);
      c.position.set(Math.sin(ang) * dist, rf(r, 1100, 1800) * (tall ? 0.7 : 1), -Math.cos(ang) * dist);
      c.rotation.y = rf(r, 0, 6.28);
      g.add(c);
    }
    return g;
  }
