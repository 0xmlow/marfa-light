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
function mergeInstanced(THREE, o, cap, R) {
  const n = Math.min(o.count, cap), parts = [], m = new THREE.Matrix4(), w = new THREE.Matrix4(), col = new THREE.Color(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    o.getMatrixAt(i, m); w.multiplyMatrices(o.matrixWorld, m);
    if (!w.elements.every(Number.isFinite)) continue;
    if (R) { p.setFromMatrixPosition(w); if (Math.hypot(p.x, p.z) > R) continue; }
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
  merged.computeBoundingBox(); if (!Number.isFinite(merged.boundingBox.min.x + merged.boundingBox.max.y)) return null;
  const mat = [].concat(o.material)[0].clone(); if (o.instanceColor) mat.vertexColors = true;
  const mesh = new THREE.Mesh(merged, mat); mesh.name = o.name || 'instanced'; return mesh;
}
// keep only the triangles within R metres of the clock (the ground runs for kilometres)
function cropGeometry(THREE, geo, mw, R) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), pos = g.attributes.position, v = new THREE.Vector3(), keep = [];
  for (let t = 0; t < pos.count; t += 3) {
    let ok = true;
    for (let k = 0; k < 3 && ok; k++) { v.fromBufferAttribute(pos, t + k).applyMatrix4(mw); if (Math.hypot(v.x, v.z) > R) ok = false; }
    if (ok) keep.push(t);
  }
  if (keep.length * 3 === pos.count) return g;
  if (!keep.length) return null;
  const out = new THREE.BufferGeometry();
  for (const name in g.attributes) {
    const a = g.attributes[name], sz = a.itemSize, arr = new a.array.constructor(keep.length * 3 * sz);
    keep.forEach((t, i) => { arr.set(a.array.subarray(t * sz, (t + 3) * sz), i * 3 * sz); });
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz, a.normalized));
  }
  out.groups = []; return out;
}
function collect(THREE, roots, out, R = 0) {
  const sph = new THREE.Sphere();
  roots.forEach((r) => r.traverse((o) => {
    if (!shown(o)) return;
    if (o.material && [].concat(o.material).some((m) => m.isShaderMaterial)) return;
    if (o.isInstancedMesh) { const mm = mergeInstanced(THREE, o, 6000, R); if (mm) out.add(mm); return; }
    if (!(o.isMesh || o.isLine)) return;
    let geo = o.geometry;
    if (R && geo) {
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      sph.copy(geo.boundingSphere).applyMatrix4(o.matrixWorld);
      if (Math.hypot(sph.center.x, sph.center.z) - sph.radius > R) return;
      if (sph.center.y + sph.radius < -25) return;                       // under the ground: shadow catchers, cellars of nothing
      if (o.isLine && sph.radius > R) return;                             // sky lines and survey rays run for kilometres
      if (o.isMesh && sph.radius > R * 0.5 && !Array.isArray(o.material)) { geo = cropGeometry(THREE, geo, o.matrixWorld, R); if (!geo) return; }
    }
    if (geo) { geo.computeBoundingBox(); if (!Number.isFinite(geo.boundingBox.min.x + geo.boundingBox.max.y)) return; }
    const copy = o.clone(false); if (geo !== o.geometry) copy.geometry = geo;
    copy.matrixAutoUpdate = false; copy.matrix.copy(o.matrixWorld); out.add(copy);
  }));
}

// mode 'scene' = the whole place, with the sun as a light and the hero camera; 'clock' = the clock alone
export async function buildGLB(seed, { base = '', mode = 'scene', hour = 13 } = {}) {
  const L = await loadEngine(base);
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const utc = L.marfaUtc(2027, 4, 17, Math.floor(hour), Math.round((hour % 1) * 60));
  const ctl = L.create(c, seed, { mode: 'still', utc, interactive: false, overlay: false, keys: false });
  try { ctl.renderOnce(0); return await glbFromWorld(ctl, { mode, name: 'Marfa Light ' + seed.slice(0, 10) }); }
  finally { ctl.dispose(); }
}

// any running token (a remix, with art hung in it) as a GLB; extra = more objects to include
export async function glbFromWorld(ctl, { mode = 'scene', name = 'Marfa Light', extra = [], radius = 60 } = {}) {
  await script(THREE_CDN + 'exporters/GLTFExporter.js');
  await script(THREE_CDN + 'utils/BufferGeometryUtils.js');
  const THREE = window.THREE, L = window.marfaLight;
  const W = ctl.world, out = new THREE.Scene(), t = ctl.getTime(), sun = L.sunPos(t.utc), cam = W.camera;
  out.name = name + (mode === 'clock' ? ' clock' : '');
  W.root.updateMatrixWorld(true);
  if (mode === 'clock') collect(THREE, (W.heroParts || []).concat([W.hero.group]), out);
  else {
    collect(THREE, [W.root].concat(extra), out, radius);
    // a last look at each piece where it really ends up: nothing buried, nothing out past the edge
    const bx = new THREE.Box3();
    out.children.slice().forEach((o) => {
      o.updateMatrixWorld(true); bx.setFromObject(o);
      if (bx.isEmpty() || bx.max.y < -25 || Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) > radius * 3) out.remove(o);
    });
    const r = Math.PI / 180, d = new THREE.Vector3(Math.cos(sun.el * r) * Math.sin(sun.az * r), Math.sin(sun.el * r), -Math.cos(sun.el * r) * Math.cos(sun.az * r));
    const light = new THREE.DirectionalLight(0xfff1dc, sun.el > 0 ? 3 : 0.2); light.name = 'Sun';
    light.position.copy(d).multiplyScalar(100); out.add(light); out.add(light.target);
    out.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a6a4a, sun.el > 0 ? 0.6 : 0.15));
    const hc = new THREE.PerspectiveCamera(cam.fov, 1.5, 0.3, 9500); hc.name = 'Camera';
    cam.updateMatrixWorld(true); hc.position.setFromMatrixPosition(cam.matrixWorld); hc.quaternion.setFromRotationMatrix(cam.matrixWorld); out.add(hc);
  }
  out.userData = { seed: ctl.plan.hash, features: ctl.features, units: 'metres, +y up, -z north' };
  const glb = await new Promise((res) => new THREE.GLTFExporter().parse(out, res, { binary: true, maxTextureSize: 2048, onlyVisible: true }));
  return new Blob([glb], { type: 'model/gltf-binary' });
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
