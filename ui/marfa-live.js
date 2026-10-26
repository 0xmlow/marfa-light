// The engine, on demand: draw any token live in the page, or rebuild it as a GLB in the visitor's
// own browser. Nothing is stored on a server; a token's seed is all it takes.
//
//   import { loadEngine, seedFor, buildGLB, saveGLB } from './ui/marfa-live.js';
//   const L = await loadEngine('../');            // window.marfaLight, with three r124
//   const seed = await seedFor(77, '../');         // data/seeds.json, else the ABX resolver
//   await saveGLB(seed, 77, '../');                // downloads marfa-light-77.glb
export const TOKEN = '0x4504570d25b710942bee78b7ff5720950c1fc02d';
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/js/';

const loaded = new Map();
function script(src) {
  if (!loaded.has(src)) loaded.set(src, new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  }));
  return loaded.get(src);
}

// three r124 (the version Art Blocks stores onchain) and the Marfa Light engine
export async function loadEngine(base = '') {
  if (window.marfaLight) return window.marfaLight;
  if (!window.THREE) await script(base + 'studies/three-r124.min.js');
  window.MARFA_LIGHT_GALLERY = true; // keep the engine from taking over the page
  await script(base + 'marfa-light.js?v=0.10.1');
  return window.marfaLight;
}

// a token's seed: the hourly snapshot first, then the ABX resolver, which knows a mint within a minute
let seeds = null;
export async function seedFor(id, base = '') {
  if (!seeds) seeds = await fetch(base + 'data/seeds.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : {}).catch(() => ({}));
  if (seeds[id]) return seeds[id];
  const s = await seedFromResolver(id);
  if (s) seeds[id] = s;
  return s;
}
export async function seedFromResolver(id, chain = 1, token = TOKEN) {
  const r = await fetch(`https://resolver.abx.io/a/${chain}/${token.toLowerCase()}/${id}`, { cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return null;
  const m = (await r.text()).match(/"seed"\s*:\s*"(0x[0-9a-fA-F]{64})"/);
  return m ? m[1] : null;
}

// ---------- GLB, the same recipe as tools/export-glb.html ----------
function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
function mergeInstanced(THREE, o, cap) {
  const n = Math.min(o.count, cap), parts = [], m = new THREE.Matrix4(), w = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    o.getMatrixAt(i, m); w.multiplyMatrices(o.matrixWorld, m);
    const g = o.geometry.clone(); g.applyMatrix4(w);
    if (o.instanceColor) {
      col.fromArray(o.instanceColor.array, i * 3);
      const c = new Float32Array(g.attributes.position.count * 3);
      for (let k = 0; k < c.length; k += 3) { c[k] = col.r; c[k + 1] = col.g; c[k + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    parts.push(g);
  }
  const merged = parts.length ? THREE.BufferGeometryUtils.mergeBufferGeometries(parts, false) : null;
  if (!merged) return null;
  const mat = [].concat(o.material)[0].clone(); if (o.instanceColor) mat.vertexColors = true;
  const mesh = new THREE.Mesh(merged, mat); mesh.name = o.name || 'instanced'; return mesh;
}
function collect(THREE, roots, out) {
  roots.forEach((r) => r.traverse((o) => {
    if (!shown(o)) return;
    if (o.material && [].concat(o.material).some((m) => m.isShaderMaterial)) return;
    if (o.isInstancedMesh) { const mm = mergeInstanced(THREE, o, 6000); if (mm) out.add(mm); return; }
    if (o.isMesh || o.isLine) { const copy = o.clone(false); copy.matrixAutoUpdate = false; copy.matrix.copy(o.matrixWorld); out.add(copy); }
  }));
}

// mode 'scene' = the whole place, with the sun as a light and the hero camera; 'clock' = the clock alone
export async function buildGLB(seed, { base = '', mode = 'scene', hour = 13 } = {}) {
  const L = await loadEngine(base);
  await script(THREE_CDN + 'exporters/GLTFExporter.js');
  await script(THREE_CDN + 'utils/BufferGeometryUtils.js');
  const THREE = window.THREE;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const utc = L.marfaUtc(2027, 4, 17, Math.floor(hour), Math.round((hour % 1) * 60));
  const ctl = L.create(c, seed, { mode: 'still', utc, interactive: false, overlay: false, keys: false });
  try {
    ctl.renderOnce(0);
    const W = ctl.world, out = new THREE.Scene(), sun = L.sunPos(utc), cam = W.camera;
    out.name = 'Marfa Light ' + seed.slice(0, 10) + (mode === 'clock' ? ' clock' : '');
    W.root.updateMatrixWorld(true);
    if (mode === 'clock') collect(THREE, (W.heroParts || []).concat([W.hero.group]), out);
    else {
      collect(THREE, [W.root], out);
      const r = Math.PI / 180, d = new THREE.Vector3(Math.cos(sun.el * r) * Math.sin(sun.az * r), Math.sin(sun.el * r), -Math.cos(sun.el * r) * Math.cos(sun.az * r));
      const light = new THREE.DirectionalLight(0xfff1dc, sun.el > 0 ? 3 : 0.2); light.name = 'Sun';
      light.position.copy(d).multiplyScalar(100); out.add(light); out.add(light.target);
      const hc = new THREE.PerspectiveCamera(cam.fov, 1.5, 0.3, 9500); hc.name = 'Hero Camera';
      hc.position.copy(cam.position); hc.quaternion.copy(cam.quaternion); out.add(hc);
    }
    out.userData = { seed, features: ctl.features, units: 'metres, +y up, -z north' };
    const glb = await new Promise((res) => new THREE.GLTFExporter().parse(out, res, { binary: true, maxTextureSize: 1024, onlyVisible: true }));
    return new Blob([glb], { type: 'model/gltf-binary' });
  } finally { ctl.dispose(); }
}

export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export async function saveGLB(seed, id, base = '', mode = 'scene') {
  const blob = await buildGLB(seed, { base, mode });
  download(blob, 'marfa-light-' + id + (mode === 'clock' ? '-clock' : '') + '.glb');
  return blob;
}

// every [data-glb="<id>"] link inside root builds that token's GLB on click
export function wireGLB(root, base = '') {
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-glb]'); if (!a || !root.contains(a)) return;
    e.preventDefault(); if (a.classList.contains('busy')) return;
    const id = a.getAttribute('data-glb'), was = a.textContent;
    a.classList.add('busy'); a.textContent = 'Building…';
    try {
      const seed = await seedFor(id, base);
      if (!seed) throw new Error('seed not found');
      const blob = await saveGLB(seed, id, base, a.getAttribute('data-mode') || 'scene');
      a.textContent = 'Saved · ' + (blob.size / 1048576).toFixed(1) + ' MB';
    } catch (err) { console.warn(err); a.textContent = 'Try again'; }
    setTimeout(() => { a.textContent = was; a.classList.remove('busy'); }, 2600);
  });
}
