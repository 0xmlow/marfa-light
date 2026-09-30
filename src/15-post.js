  // =====================================================================
  // POST: the film. HDR scene, bloom, a grade per film stock, grain, vignette
  //
  // The scene renders linear and unclamped into a half float target. Bright
  // light is pulled out at quarter size and blurred twice for bloom (and for
  // halation on the stocks that have it). One last pass applies exposure,
  // ACES, the grade, the vignette and animated grain, then encodes sRGB.
  // =====================================================================
  var FILMS = {
    'Clean':      { sat: 1.0,  con: 1.0,  lift: [0, 0, 0],            gain: [1, 1, 1],          grain: 0.018, vig: 0.28, bloom: 0.55, hal: [0, 0, 0], bw: 0 },
    'Kodachrome': { sat: 1.18, con: 1.1,  lift: [0.012, 0.004, -0.01], gain: [1.05, 1.0, 0.92],  grain: 0.035, vig: 0.38, bloom: 0.5,  hal: [0, 0, 0], bw: 0 },
    'Ektachrome': { sat: 1.12, con: 1.06, lift: [-0.01, 0.0, 0.018],   gain: [0.95, 1.0, 1.07],  grain: 0.03,  vig: 0.32, bloom: 0.55, hal: [0, 0, 0], bw: 0 },
    'Velvia':     { sat: 1.38, con: 1.16, lift: [0, -0.004, 0.006],    gain: [1.02, 1.0, 1.02],  grain: 0.022, vig: 0.4,  bloom: 0.45, hal: [0, 0, 0], bw: 0 },
    'Cinestill':  { sat: 1.08, con: 1.04, lift: [0.0, 0.008, 0.016],   gain: [1.0, 0.98, 1.04],  grain: 0.04,  vig: 0.34, bloom: 0.9,  hal: [1.0, 0.18, 0.05], bw: 0 },
    'Polaroid':   { sat: 0.82, con: 0.86, lift: [0.05, 0.05, 0.035],   gain: [1.02, 1.0, 0.9],   grain: 0.03,  vig: 0.5,  bloom: 0.6,  hal: [0, 0, 0], bw: 0 },
    'Tri-X':      { sat: 0.0,  con: 1.28, lift: [0.0, 0.0, 0.0],       gain: [1, 1, 1],          grain: 0.075, vig: 0.46, bloom: 0.4,  hal: [0, 0, 0], bw: 1 }
  };
  var FILM_WEIGHTS = [['Clean', 22], ['Kodachrome', 20], ['Ektachrome', 16], ['Velvia', 12], ['Cinestill', 12], ['Polaroid', 10], ['Tri-X', 8]];

  var QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  function Post(renderer) {
    this.r = renderer;
    var gl2 = renderer.capabilities.isWebGL2;
    var opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true };
    this.scene = gl2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(4, 4, opts) : new THREE.WebGLRenderTarget(4, 4, opts);
    if (this.scene.samples !== undefined) this.scene.samples = 4;
    var small = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false };
    this.a = new THREE.WebGLRenderTarget(4, 4, small);
    this.b = new THREE.WebGLRenderTarget(4, 4, small);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.q = new THREE.Scene(); this.q.add(this.quad);
    this.bright = new THREE.ShaderMaterial({
      uniforms: { src: { value: null }, thr: { value: 1.6 }, exposure: { value: 1 } },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D src; uniform float thr; uniform float exposure; varying vec2 vUv;' +
        'void main(){ vec3 c = texture2D(src, vUv).rgb * exposure; float l = max(max(c.r, c.g), c.b);' +
        ' gl_FragColor = vec4(c * smoothstep(thr, thr * 2.5, l), 1.0); }'
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;' +
        'void main(){ vec3 c = texture2D(src, vUv).rgb * 0.2270;' +
        ' c += texture2D(src, vUv + dir * 1.3846).rgb * 0.3162; c += texture2D(src, vUv - dir * 1.3846).rgb * 0.3162;' +
        ' c += texture2D(src, vUv + dir * 3.2308).rgb * 0.0703; c += texture2D(src, vUv - dir * 3.2308).rgb * 0.0703;' +
        ' gl_FragColor = vec4(c, 1.0); }'
    });
    this.final = new THREE.ShaderMaterial({
      uniforms: {
        src: { value: null }, glow: { value: null }, exposure: { value: 1 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
        sat: { value: 1 }, con: { value: 1 }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) },
        grain: { value: 0.02 }, vig: { value: 0.3 }, bloom: { value: 0.5 }, hal: { value: new THREE.Vector3() }, bw: { value: 0 }
      },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false, toneMapped: false,
      fragmentShader: [
        'uniform sampler2D src; uniform sampler2D glow; uniform float exposure; uniform float time; uniform vec2 res;',
        'uniform float sat; uniform float con; uniform vec3 lift; uniform vec3 gain; uniform float grain; uniform float vig;',
        'uniform float bloom; uniform vec3 hal; uniform float bw; varying vec2 vUv;',
        'vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
        'vec3 aces(vec3 c){',
        '  const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);',
        '  const mat3 o = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);',
        '  c = i * (c / 0.6); c = rrt(c); c = o * c; return clamp(c, 0.0, 1.0); }',
        'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
        'void main(){',
        '  vec2 uv = vUv, d = uv - 0.5;',
        '  float ca = dot(d, d) * 0.004;',
        '  vec3 c = vec3(texture2D(src, uv + d * ca).r, texture2D(src, uv).g, texture2D(src, uv - d * ca).b) * exposure;',
        '  vec3 g = texture2D(glow, uv).rgb;',
        '  c += g * bloom + g * hal * 1.6;',
        '  c = aces(c);',
        '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
        '  c = mix(vec3(l), c, sat);',
        '  c = (c - 0.5) * con + 0.5;',
        '  c = c * gain + lift * (1.0 - c);',
        '  if (bw > 0.5) { float k = dot(c, vec3(0.3, 0.59, 0.11)); c = vec3(k); }',
        '  c *= 1.0 - vig * smoothstep(0.35, 0.95, length(d * vec2(res.x / res.y, 1.0)));',
        '  float n = h(uv * res + fract(time) * 91.7) - 0.5;',
        '  c += n * grain * (1.2 - l);',
        '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    this.film = FILMS.Clean;
  }
  Post.prototype.setSize = function (w, h) {
    this.w = w; this.h = h;
    this.scene.setSize(w, h);
    var qw = Math.max(1, Math.floor(w / 4)), qh = Math.max(1, Math.floor(h / 4));
    this.a.setSize(qw, qh); this.b.setSize(qw, qh);
    this.final.uniforms.res.value.set(w, h);
  };
  Post.prototype.setFilm = function (name) {
    var f = FILMS[name] || FILMS.Clean, u = this.final.uniforms;
    this.film = f; this.filmName = name;
    u.sat.value = f.sat; u.con.value = f.con; u.lift.value.fromArray(f.lift); u.gain.value.fromArray(f.gain);
    u.grain.value = f.grain * 0.38; u.vig.value = f.vig; u.bloom.value = f.bloom; u.hal.value.fromArray(f.hal); u.bw.value = f.bw;
  };
  Post.prototype.pass = function (mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.q, this.cam);
  };
  Post.prototype.render = function (scene, camera, exposure, time) {
    var r = this.r;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    this.bright.uniforms.src.value = this.scene.texture;
    this.bright.uniforms.exposure.value = exposure;
    this.pass(this.bright, this.a);
    for (var k = 0; k < 2; k++) {
      this.blur.uniforms.src.value = this.a.texture; this.blur.uniforms.dir.value.set(1 / this.a.width, 0); this.pass(this.blur, this.b);
      this.blur.uniforms.src.value = this.b.texture; this.blur.uniforms.dir.value.set(0, 1 / this.a.height); this.pass(this.blur, this.a);
    }
    var u = this.final.uniforms;
    u.src.value = this.scene.texture; u.glow.value = this.a.texture; u.exposure.value = exposure; u.time.value = time;
    this.pass(this.final, null);
  };
  Post.prototype.dispose = function () {
    this.scene.dispose(); this.a.dispose(); this.b.dispose();
    this.bright.dispose(); this.blur.dispose(); this.final.dispose(); this.quad.geometry.dispose();
  };
