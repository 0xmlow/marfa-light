// Marfa Light Studio: any minted token, live in the page. Remix its picks, hold or run its time,
// walk or fly through it, hang pictures in it, and take photos, video, GIFs and GLBs of what you see.
// The engine is the minted script plus studio-src/91-remix.js (site only, never onchain).
import { seedFor, glbFromWorld } from '../ui/marfa-live.js?v=4';

const $ = (id) => document.getElementById(id);
const BASE = '../';
const THREE = window.THREE;
const touch = matchMedia('(pointer: coarse)').matches;
const FIELDS = [['clock', 'Clock'], ['place', 'Place'], ['material', 'Material'], ['sky', 'Sky'], ['wind', 'Wind'], ['palette', 'Colours'], ['film', 'Film']];
const SPEEDS = [[60, '1 min a second'], [300, '5 min a second'], [900, '15 min a second'], [1800, '30 min a second'], [3600, '1 hour a second'], [10800, '3 hours a second']];
const pad = (n) => String(n).padStart(2, '0');
const hm = (h) => pad(Math.floor(h)) + ':' + pad(Math.floor((h % 1) * 60));

let L, ctl = null, canvas = $('view');
let id = null, seed = null, over = {}, minted = null, tokens = [], names = new Map();
let timeMode = 'held', heldUtc = null, camMode = 'orbit';
const cam = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0 };
const keys = new Set();
let joy = null, look = null, vibeA = null;
const hud = { set(t) { $('hud').innerHTML = t; } };
const msg = (t) => { $('capMsg').textContent = t; };

// ---------------------------------------------------------------- boot
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); }); }

async function boot() {
  window.MARFA_LIGHT_GALLERY = true;
  await loadScript('engine.min.js?v=1');
  L = window.marfaLight;
  const [col, seeds] = await Promise.all([
    fetch(BASE + 'data/holders.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({ tokens: [], holders: [] })),
    fetch(BASE + 'data/seeds.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({}))
  ]);
  (col.holders || []).forEach((h) => names.set((h.address || h.wallet || '').toLowerCase(), h.name || h.ens || ''));
  const byId = new Map((col.tokens || []).map((t) => [t.id, t]));
  const ids = Object.keys(seeds).map(Number).sort((a, b) => a - b);
  tokens = ids.map((i) => ({ id: i, seed: seeds[i], ...(byId.get(i) || {}) }));
  $('tokenSel').innerHTML = tokens.map((t) => `<option value="${t.id}">#${t.id}${t.clock ? ' · ' + t.clock : ''}${t.place ? ' · ' + t.place : ''}</option>`).join('');
  (L.holidays || []).forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; $('cal').appendChild(o); });

  const q = new URLSearchParams(location.search);
  FIELDS.forEach(([k]) => { if (q.get(k)) over[k] = q.get(k); });
  if (q.get('tag')) over.tag = q.get('tag');
  const want = q.has('id') ? +q.get('id') : (tokens.length ? tokens[Math.floor(Math.random() * tokens.length)].id : 0);
  const t = q.get('t'), d = q.get('d');
  await openToken(want, { keepOver: true, hour: t != null ? +t : null, date: d });
  if (q.get('cam') === 'walk' || q.get('cam') === 'fly') setCam(q.get('cam'));
  $('boot').hidden = true;
  requestAnimationFrame(frame);
}

async function openToken(n, o = {}) {
  const tk = tokens.find((t) => t.id === n) || tokens[0];
  if (!tk) { $('boot').textContent = 'No minted tokens found'; return; }
  id = tk.id; seed = tk.seed || await seedFor(id, BASE);
  if (!o.keepOver) over = {};
  $('tokenSel').value = String(id);
  minted = L.remix.options(seed, {}).current;
  build({ hour: o.hour, date: o.date, fresh: true });
}

// ---------------------------------------------------------------- the world
function build(o = {}) {
  const prevUtc = ctl && !o.fresh ? ctl.getTime().utc : null;
  if (ctl) { ctl.dispose(); ctl = null; }
  const fresh = document.createElement('canvas'); fresh.id = 'view'; fresh.setAttribute('aria-label', 'The token, drawn live');
  canvas.replaceWith(fresh); canvas = fresh; wireCanvas();
  $('overlay').innerHTML = '';
  ctl = L.remix.create(canvas, seed, { mode: 'still', overlayHost: $('overlay'), freeWheel: true, keys: false, maxPixelRatio: 2 }, cleanOver());
  if (prevUtc != null) heldUtc = prevUtc;
  else {
    const t0 = ctl.getTime();
    const dt = o.date && /^\d{4}-\d\d-\d\d$/.test(o.date) ? o.date.split('-').map(Number) : [t0.y, t0.mo, t0.d];
    const hr = o.hour != null && isFinite(o.hour) ? o.hour : t0.h + t0.m / 60;
    heldUtc = L.marfaUtc(dt[0], dt[1], dt[2], Math.floor(hr), Math.round((hr % 1) * 60));
  }
  applyTime(true);
  if (over.film) ctl.setFilm(over.film);
  ctl.start();
  art.reattach();
  if (camMode === 'orbit' && !$('vibe').checked) ctl.setCamera(null);
  applyLens();
  renderFields(); renderSpec(); syncTime(); syncUrl();
}
function cleanOver() { const o = {}; for (const k in over) if (over[k] != null && over[k] !== '') o[k] = over[k]; return o; }

function renderFields() {
  const op = L.remix.options(seed, cleanOver()), cur = op.current;
  const lists = { clock: op.clocks, place: op.places, material: op.materials, sky: op.skies, wind: op.winds, palette: op.palettes, film: op.films };
  $('fields').innerHTML = FIELDS.map(([k, label]) => {
    const changed = cur[k] !== minted[k];
    const opts = lists[k].slice().sort((a, b) => a === minted[k] ? -1 : b === minted[k] ? 1 : a.localeCompare(b));
    return `<label class="field${changed ? ' changed' : ''}"><span>${label}</span><select data-k="${k}">${opts.map((v) => `<option value="${esc(v)}"${v === cur[k] ? ' selected' : ''}>${esc(v)}${v === minted[k] ? ' (minted)' : ''}</option>`).join('')}</select></label>`;
  }).join('');
  const tag = (cur.tag || '').replace(/"/g, '');
  $('tagIn').placeholder = (minted.tag || '').replace(/"/g, '') || 'as minted';
  $('tagIn').value = over.tag ? tag : '';
  $('tagIn').closest('.field').classList.toggle('changed', !!over.tag);
  const remixed = FIELDS.some(([k]) => cur[k] !== minted[k]) || !!over.tag;
  const tk = tokens.find((t) => t.id === id) || {};
  $('lede').textContent = '#' + id + ' ' + cur.clock;
  hud.set(`<b>#${id}</b> ${esc(cur.clock)} · ${esc(cur.place)}${remixed ? ' · <b>remix</b>' : ''}${tk.owner && names.get(tk.owner) ? ' · held by ' + esc(names.get(tk.owner)) : ''}`);
}
function renderSpec() {
  const F = ctl.features;
  $('spec').innerHTML = Object.keys(F).filter((k) => F[k] != null && F[k] !== '').map((k) => `<dt>${esc(k)}</dt><dd>${esc(String(F[k]))}</dd>`).join('');
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

$('fields').addEventListener('change', (e) => {
  const s = e.target.closest('select[data-k]'); if (!s) return;
  const k = s.dataset.k, v = s.value;
  if (v === minted[k]) delete over[k]; else over[k] = v;
  if (k === 'clock') { delete over.place; delete over.material; }
  if (k === 'film') { ctl.setFilm(v); renderFields(); renderSpec(); syncUrl(); return; }
  build();
});
let tagT = 0;
$('tagIn').addEventListener('input', () => { clearTimeout(tagT); tagT = setTimeout(() => { const v = $('tagIn').value.trim(); if (v) over.tag = v; else delete over.tag; build(); }, 600); });
$('tagIn').addEventListener('keydown', (e) => e.stopPropagation());
$('reset').onclick = () => { over = {}; build(); };
$('copyLink').onclick = () => { syncUrl(); navigator.clipboard.writeText(location.href).then(() => { $('copyLink').textContent = 'Copied'; setTimeout(() => { $('copyLink').textContent = 'Copy link'; }, 1500); }); };
$('tokenSel').onchange = () => { art.clear(); openToken(+$('tokenSel').value); };
document.querySelectorAll('.pick .step').forEach((b) => b.onclick = () => {
  const i = tokens.findIndex((t) => t.id === id), n = tokens[(i + +b.dataset.step + tokens.length) % tokens.length];
  art.clear(); openToken(n.id);
});

function syncUrl() {
  const q = new URLSearchParams(); q.set('id', id);
  for (const k in cleanOver()) q.set(k, over[k]);
  if (timeMode === 'held' && heldUtc) { const t = L.marfaTime(heldUtc); q.set('d', t.y + '-' + pad(t.mo) + '-' + pad(t.d)); q.set('t', (t.h + t.m / 60).toFixed(2)); }
  if (camMode !== 'orbit') q.set('cam', camMode);
  try { history.replaceState(null, '', '?' + q.toString()); } catch (e) { }
}

// ---------------------------------------------------------------- time
function applyTime(snap) {
  if (!ctl) return;
  if (timeMode === 'live') ctl.setMode('live');
  else ctl.setClock(heldUtc, snap);
}
function syncTime() {
  const t = L.marfaTime(timeMode === 'live' ? Date.now() / 1000 : heldUtc);
  $('hour').value = (t.h + t.m / 60).toFixed(2); $('hourVal').textContent = pad(t.h) + ':' + pad(t.m);
  $('date').value = t.y + '-' + pad(t.mo) + '-' + pad(t.d);
  const s = L.sunPos(t.utc);
  $('sunNote').textContent = 'In Marfa: ' + (s.el > 0 ? 'the sun is ' + Math.round(s.el) + '° up, bearing ' + Math.round(s.az) + '°' : 'the sun is down, ' + Math.round(-s.el) + '° below the horizon') + '.';
  document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === timeMode)));
}
function heldFromInputs() {
  const v = +$('hour').value, d = ($('date').value || '').split('-').map(Number), t = L.marfaTime(heldUtc || Date.now() / 1000);
  return L.marfaUtc(d[0] || t.y, d[1] || t.mo, d[2] || t.d, Math.floor(v), Math.floor((v % 1) * 60));
}
$('hour').addEventListener('input', () => { if (timeMode === 'live') timeMode = 'held'; heldUtc = heldFromInputs(); ctl.setClock(heldUtc, false); syncTime(); });
$('hour').addEventListener('change', syncUrl);
$('date').addEventListener('change', () => { if (timeMode === 'live') timeMode = 'held'; heldUtc = heldFromInputs(); applyTime(true); syncTime(); syncUrl(); });
$('cal').addEventListener('change', () => {
  if (!$('cal').value) return;
  const nx = ctl.celebrate($('cal').value);
  if (nx) { timeMode = 'held'; heldUtc = nx.utc; applyTime(true); syncTime(); syncUrl(); hud.set('<b>' + esc(nx.names.join(' · ')) + '</b>'); }
  $('cal').value = '';
});
$('modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  if (timeMode === 'live') heldUtc = Date.now() / 1000;
  timeMode = b.dataset.mode; applyTime(true); syncTime(); syncUrl();
});
$('speed').addEventListener('input', () => { $('speedVal').textContent = SPEEDS[$('speed').value - 1][1]; });

// ---------------------------------------------------------------- camera
function wcam() { return ctl.world.camera; }
function setCam(m) {
  camMode = m;
  document.querySelectorAll('#camSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === m)));
  $('cross').hidden = m === 'orbit'; $('joy').hidden = m === 'orbit' || !touch;
  $('camHelp').textContent = m === 'orbit' ? 'Drag to turn around the clock. Scroll or pinch to move in and out.'
    : touch ? 'Use the stick to ' + (m === 'fly' ? 'fly' : 'walk') + '. Drag anywhere else to look around.'
    : 'Click the picture to look around with the mouse. W A S D or the arrows to move, Shift to run' + (m === 'fly' ? ', E and Q to rise and sink' : '') + ', Esc to let go of the mouse.';
  if (m === 'orbit') { if (document.pointerLockElement) document.exitPointerLock(); if (!$('vibe').checked) ctl.setCamera(null); hint(''); }
  else {
    const c = wcam(); c.updateMatrixWorld(true);
    cam.pos.setFromMatrixPosition(c.matrixWorld);
    const d = new THREE.Vector3(); c.getWorldDirection(d);
    cam.yaw = Math.atan2(d.x, -d.z); cam.pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    if (m === 'walk') { cam.pos.y = ground(cam.pos.x, cam.pos.z) + +$('eye').value; cam.pitch = Math.max(-0.3, Math.min(0.3, cam.pitch)); }
    $('vibe').checked = false; vibeA = null;
    if (!touch) hint('Click to look around · W A S D to move · H to hang art · P for a photo');
  }
  syncUrl();
}
let hintT = 0;
function hint(t) { clearTimeout(hintT); $('hint').hidden = !t; $('hint').textContent = t; if (t) hintT = setTimeout(() => { $('hint').hidden = true; }, 6000); }
$('camSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-cam]'); if (b) setCam(b.dataset.cam); });
$('views').innerHTML = ['Hero', 'Close', 'Wide', 'Ground', 'Plan'].map((v) => `<button type="button" data-view="${v}">${v}</button>`).join('');
$('views').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  if (camMode !== 'orbit') setCam('orbit');
  $('vibe').checked = false; vibeA = null; ctl.setCamera(null); ctl.setView(b.dataset.view);
});
function lensFov() { const v = +$('lens').value; return v ? 90 - v * 0.78 : 0; }
function applyLens() {
  if (!ctl) return;
  const f = lensFov(); $('lensVal').textContent = f ? Math.round(f) + '° (' + Math.round(18 / Math.tan(f * Math.PI / 360)) + ' mm)' : 'auto';
  if (!f) { ctl.resize(); return; }
  const c = wcam(); c.fov = f; c.updateProjectionMatrix();
}
$('lens').addEventListener('input', applyLens);
$('eye').addEventListener('input', () => { $('eyeVal').textContent = (+$('eye').value).toFixed(1) + ' m'; });
$('walk').addEventListener('input', () => { $('walkVal').textContent = ['slow', 'normal', 'brisk', 'fast', 'very fast'][$('walk').value - 1]; });
$('vibe').addEventListener('change', () => {
  if ($('vibe').checked) { if (camMode !== 'orbit') setCam('orbit'); const p = wcam().position; vibeA = Math.atan2(p.x, -p.z); }
  else { vibeA = null; ctl.setCamera(null); }
});

function ground(x, z) {
  const W = ctl.world; let g = 0;
  try { if (W.groundAt) g = W.groundAt(x, z) || 0; } catch (e) { }
  return isFinite(g) ? g : 0;
}

// pointer look, the stick, keys
function wireCanvas() {
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('pointerdown', (e) => {
    if (camMode === 'orbit' || document.pointerLockElement) return;
    if (touch || e.pointerType !== 'mouse') look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!look || e.pointerId !== look.id) return;
    turn(e.clientX - look.x, e.clientY - look.y, 0.005); look.x = e.clientX; look.y = e.clientY;
  });
  const end = (e) => { if (look && e.pointerId === look.id) look = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}
function turn(dx, dy, k) { cam.yaw += dx * k; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch - dy * k)); }
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) turn(e.movementX, e.movementY, 0.0022); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && camMode !== 'orbit' && !touch) hint('Click to look around again'); });
const jEl = $('joy');
jEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); jEl.setPointerCapture(e.pointerId); joy = { x: 0, y: 0 }; moveJoy(e); });
jEl.addEventListener('pointermove', (e) => { if (joy) moveJoy(e); });
const jEnd = () => { joy = null; jEl.firstElementChild.style.transform = ''; };
jEl.addEventListener('pointerup', jEnd); jEl.addEventListener('pointercancel', jEnd);
function moveJoy(e) {
  const r = jEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  joy.x = dx; joy.y = dy; jEl.firstElementChild.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`;
}
window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, select, textarea, dialog')) return;
  const k = e.key.toLowerCase();
  if (k === 'p') { e.preventDefault(); photo(); return; }
  if (k === 'v') { e.preventDefault(); rec.toggle(); return; }
  if (k === 'h') { e.preventDefault(); art.hangAtCenter(); return; }
  if (camMode === 'orbit') return;
  if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(k)) { keys.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------- the loop
let last = 0;
function frame(ms) {
  const dt = Math.min(0.1, last ? (ms - last) / 1000 : 0); last = ms;
  if (ctl) {
    if (timeMode === 'lapse') { heldUtc += dt * SPEEDS[$('speed').value - 1][0]; ctl.setClock(heldUtc, false); if ((ms | 0) % 30 < 17) syncTime(); }
    if (camMode !== 'orbit') walkStep(dt);
    else if (vibeA != null) {
      const C = ctl.world.cam; vibeA += dt * 0.06;
      const d = C.dist * 1.15, p = new THREE.Vector3(Math.sin(vibeA) * d, C.h + Math.sin(ms / 9000) * 0.6, -Math.cos(vibeA) * d);
      ctl.setCamera(p, new THREE.Vector3(0, C.lookY, 0));
    }
    if (lensFov()) { const c = wcam(); if (Math.abs(c.fov - lensFov()) > 0.01) { c.fov = lensFov(); c.updateProjectionMatrix(); } }
  }
  requestAnimationFrame(frame);
}
function walkStep(dt) {
  let f = 0, s = 0, u = 0;
  if (keys.has('w') || keys.has('arrowup')) f += 1;
  if (keys.has('s') || keys.has('arrowdown')) f -= 1;
  if (keys.has('d')) s += 1;
  if (keys.has('a')) s -= 1;
  if (keys.has('arrowleft')) cam.yaw -= dt * 1.6;
  if (keys.has('arrowright')) cam.yaw += dt * 1.6;
  if (keys.has('e') || keys.has(' ')) u += 1;
  if (keys.has('q')) u -= 1;
  if (joy) { f -= joy.y; s += joy.x; }
  const speed = [0.8, 1.6, 3, 6, 14][$('walk').value - 1] * (keys.has('shift') ? 3 : 1) * (camMode === 'fly' ? 2.5 : 1);
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  if (camMode === 'fly') {
    const cp = Math.cos(cam.pitch);
    cam.pos.x += (fx * cp * f - fz * s) * speed * dt; cam.pos.z += (fz * cp * f + fx * s) * speed * dt;
    cam.pos.y += (Math.sin(cam.pitch) * f + u) * speed * dt;
    cam.pos.y = Math.max(ground(cam.pos.x, cam.pos.z) + 0.3, Math.min(900, cam.pos.y));
  } else {
    cam.pos.x += (fx * f - fz * s) * speed * dt; cam.pos.z += (fz * f + fx * s) * speed * dt;
    const want = ground(cam.pos.x, cam.pos.z) + +$('eye').value;
    cam.pos.y += (want - cam.pos.y) * Math.min(1, dt * 10);
  }
  const R = 1500, r = Math.hypot(cam.pos.x, cam.pos.z); if (r > R) { cam.pos.x *= R / r; cam.pos.z *= R / r; }
  const cp = Math.cos(cam.pitch), tgt = new THREE.Vector3(cam.pos.x + Math.sin(cam.yaw) * cp, cam.pos.y + Math.sin(cam.pitch), cam.pos.z - Math.cos(cam.yaw) * cp);
  ctl.setCamera(cam.pos, tgt);
}

// ---------------------------------------------------------------- hanging art
const FRAMES = { black: '#16171B', brass: '#B08A4A', white: '#F1EEE6', wood: '#6B4A2E' };
const art = {
  shelf: [], hung: [], armed: null, sel: null, n: 0,
  add(name, img) {
    const c = document.createElement('canvas'), k = Math.min(1, 2048 / Math.max(img.width, img.height));
    c.width = Math.max(2, Math.round(img.width * k)); c.height = Math.max(2, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const item = { key: 'a' + (++this.n), name, canvas: c, aspect: c.width / c.height };
    this.shelf.push(item); this.arm(item); this.drawShelf();
  },
  arm(item) { this.armed = item; this.drawShelf(); if (item) hint((touch ? 'Tap' : 'Click') + ' a wall, the ground or anything in the picture to hang "' + item.name + '"' + (camMode !== 'orbit' ? ', or press H' : '')); },
  drawShelf() {
    const s = $('shelf'); s.innerHTML = '';
    this.shelf.forEach((it) => {
      const b = document.createElement('button'); b.type = 'button'; b.title = it.name; b.setAttribute('aria-pressed', String(it === this.armed));
      const im = new Image(); im.src = it.thumb || (it.thumb = it.canvas.toDataURL('image/jpeg', 0.7)); im.alt = it.name; b.appendChild(im);
      b.onclick = () => this.arm(it === this.armed ? null : it); s.appendChild(b);
    });
  },
  mesh(rec) {
    const it = rec.item, h = rec.size, w = h * it.aspect, g = new THREE.Group(); g.name = 'Hung: ' + it.name;
    const tex = new THREE.CanvasTexture(it.canvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    const pic = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, emissive: rec.lit ? 0xffffff : 0x000000, emissiveMap: rec.lit ? tex : null, emissiveIntensity: rec.lit ? 0.45 : 0 }));
    pic.position.z = 0.012; pic.receiveShadow = true; g.add(pic);
    if (rec.frame !== 'none') {
      const b = Math.max(0.03, h * 0.045), fm = new THREE.MeshStandardMaterial({ color: FRAMES[rec.frame], roughness: rec.frame === 'brass' ? 0.35 : 0.7, metalness: rec.frame === 'brass' ? 0.8 : 0 });
      const fr = new THREE.Mesh(new THREE.BoxBufferGeometry(w + 2 * b, h + 2 * b, 0.035), fm); fr.position.z = -0.006; fr.castShadow = fr.receiveShadow = true; g.add(fr);
    }
    if (rec.stand) {
      const post = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.025, 0.035, rec.stand, 10), new THREE.MeshStandardMaterial({ color: '#2A2C30', roughness: 0.5, metalness: 0.7 }));
      post.position.set(0, -h / 2 - rec.stand / 2, -0.03); post.castShadow = true; g.add(post);
    }
    g.position.copy(rec.pos); g.quaternion.copy(rec.quat);
    return g;
  },
  place(hit) {
    if (!this.armed || !hit) return false;
    const n = hit.normal, p = hit.point, size = +$('artSize').value, it = this.armed;
    const rec = { item: it, size, frame: $('artFrame').value, lit: $('artLit').checked, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), stand: 0, id: 'h' + (++this.n) };
    const o = new THREE.Object3D();
    if (Math.abs(n.y) < 0.6) { o.position.copy(p).addScaledVector(n, 0.03); o.lookAt(p.clone().add(n)); }
    else {
      const c = new THREE.Vector3().setFromMatrixPosition(wcam().matrixWorld);
      const up = n.y > 0, lift = up ? Math.min(0.9, size * 0.4) : 0;
      rec.stand = up ? lift + 0.02 : 0;
      o.position.set(p.x, p.y + (up ? lift + size / 2 : -size / 2 - 0.05), p.z);
      o.lookAt(c.x, o.position.y, c.z);
    }
    rec.pos.copy(o.position); rec.quat.copy(o.quaternion);
    this.hung.push(rec); this.show(rec); this.sel = rec; this.drawList();
    hint('Hung "' + it.name + '". Choose another work, or ' + (touch ? 'tap' : 'click') + ' again to hang another copy.');
    return true;
  },
  show(rec) { rec.obj = this.mesh(rec); ctl.world.root.add(rec.obj); },
  redo(rec) { if (rec.obj && rec.obj.parent) rec.obj.parent.remove(rec.obj); this.show(rec); },
  reattach() { this.hung.forEach((r) => this.show(r)); },
  clear() { this.hung.forEach((r) => { if (r.obj && r.obj.parent) r.obj.parent.remove(r.obj); }); this.hung = []; this.sel = null; this.drawList(); },
  drawList() {
    $('hung').innerHTML = this.hung.map((r, i) => `<div class="${r === this.sel ? 'sel' : ''}" data-i="${i}"><span>${esc(r.item.name)} · ${r.size.toFixed(1)} m</span><button type="button" data-act="sel">Edit</button><button type="button" data-act="del">Remove</button></div>`).join('');
  },
  hangAtCenter() {
    if (!this.armed) { if (this.shelf.length) this.arm(this.shelf[this.shelf.length - 1]); else { hint('Add a picture in the Hang art tab first'); tab('hang'); return; } }
    this.place(pickAt(0, 0));
  }
};
$('hung').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const r = art.hung[+b.closest('[data-i]').dataset.i];
  if (b.dataset.act === 'del') { if (r.obj && r.obj.parent) r.obj.parent.remove(r.obj); art.hung.splice(art.hung.indexOf(r), 1); if (art.sel === r) art.sel = null; }
  else { art.sel = r; $('artSize').value = r.size; $('artSizeVal').textContent = r.size.toFixed(1) + ' m'; $('artFrame').value = r.frame; $('artLit').checked = r.lit; }
  art.drawList();
});
$('artSize').addEventListener('input', () => { const v = +$('artSize').value; $('artSizeVal').textContent = v.toFixed(1) + ' m'; if (art.sel) { art.sel.size = v; art.redo(art.sel); art.drawList(); } });
$('artFrame').addEventListener('change', () => { if (art.sel) { art.sel.frame = $('artFrame').value; art.redo(art.sel); } });
$('artLit').addEventListener('change', () => { if (art.sel) { art.sel.lit = $('artLit').checked; art.redo(art.sel); } });
$('artFile').addEventListener('change', () => {
  [...$('artFile').files].forEach((f) => {
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => { art.add(f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture', im); URL.revokeObjectURL(url); };
    im.onerror = () => hint('Could not read ' + f.name);
    im.src = url;
  });
  $('artFile').value = '';
});
$('artToken').onclick = () => {
  $('tokGrid').innerHTML = tokens.map((t) => `<button type="button" data-id="${t.id}"><img src="${BASE}tokens/1/s/${t.id}.jpg" alt="" loading="lazy">#${t.id}</button>`).join('');
  $('tokDlg').showModal();
};
$('tokGrid').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  const t = tokens.find((x) => x.id === +b.dataset.id); $('tokDlg').close();
  hint('Drawing #' + t.id + ' at 1024 px');
  setTimeout(() => {
    try { const s = L.snapshot(t.seed, null, 1024, 1024); art.add('Marfa Light #' + t.id, s.canvas); }
    catch (err) { console.warn(err); hint('Could not draw #' + t.id); }
  }, 30);
});

// raycast into the world, from screen coordinates in -1..1
function pickAt(nx, ny) {
  const rc = new THREE.Raycaster(), c = wcam(); c.updateMatrixWorld(true);
  rc.setFromCamera({ x: nx, y: ny }, c); rc.far = 3000;
  const hits = rc.intersectObjects(ctl.world.root.children, true);
  for (const h of hits) {
    const o = h.object;
    if (!o.isMesh || !h.face) continue;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis || [].concat(o.material).some((m) => m.isShaderMaterial || m.transparent && m.opacity < 0.5)) continue;
    const n = h.face.normal.clone().transformDirection(o.matrixWorld);
    if (n.dot(rc.ray.direction) > 0) n.negate();
    return { point: h.point, normal: n };
  }
  // nothing solid: the ground under the ray, or a spot in front of the camera
  const d = rc.ray.direction, o = rc.ray.origin;
  if (d.y < -0.02) { const t = (ground(o.x, o.z) - o.y) / d.y; const p = o.clone().addScaledVector(d, Math.min(t, 60)); return { point: p, normal: new THREE.Vector3(0, 1, 0) }; }
  const f = new THREE.Vector3(d.x, 0, d.z).normalize(), p = o.clone().addScaledVector(f, 4);
  p.y = ground(p.x, p.z);
  return { point: p, normal: new THREE.Vector3(0, 1, 0) };
}
let downAt = null;
document.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; }, true);
function onCanvasClick(e) {
  const moved = downAt ? Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) : 0;
  if (camMode !== 'orbit' && !touch && document.pointerLockElement !== canvas) {
    if (art.armed) { art.place(pickAt(0, 0)); return; }
    canvas.requestPointerLock && canvas.requestPointerLock(); return;
  }
  if (moved > 6 || !art.armed) return;
  if (document.pointerLockElement === canvas) { art.place(pickAt(0, 0)); return; }
  const r = canvas.getBoundingClientRect();
  art.place(pickAt(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1));
}

// ---------------------------------------------------------------- capture
function baseName() { return 'marfa-light-' + id + (Object.keys(cleanOver()).length ? '-remix' : ''); }
function stamp() { const t = L.marfaTime(ctl.getTime().utc); return pad(t.h) + pad(t.m); }
async function deliver(blob, name, kind) {
  const url = URL.createObjectURL(blob), f = document.createElement('figure');
  const media = kind === 'video' ? Object.assign(document.createElement('video'), { src: url, controls: true, muted: true, loop: true, playsInline: true, autoplay: true }) : kind === 'glb' ? null : Object.assign(new Image(), { src: url, alt: name });
  if (media) f.appendChild(media);
  const cap = document.createElement('figcaption');
  cap.innerHTML = `<span>${esc(name)} · ${(blob.size / 1048576).toFixed(blob.size > 1048576 ? 1 : 2)} MB</span>`;
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save'; save.onclick = () => saveFile(blob, name, url); cap.appendChild(save);
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    const sh = document.createElement('button'); sh.type = 'button'; sh.className = 'ghost'; sh.textContent = kind === 'photo' || kind === 'gif' || kind === 'video' ? 'Share or save to Photos' : 'Share';
    sh.onclick = () => navigator.share({ files: [file], title: 'Marfa Light #' + id }).catch(() => { }); cap.appendChild(sh);
  }
  f.appendChild(cap); $('tray').prepend(f);
  while ($('tray').children.length > 12) $('tray').lastChild.remove();
  if (!touch) saveFile(blob, name, url);
  msg(touch ? 'Ready: tap Save, or Share to put it in Photos' : 'Saved ' + name);
  tab('capture');
}
function saveFile(blob, name, url) { const a = document.createElement('a'); a.href = url || URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function shotSize() {
  const shape = $('shotShape').value, long = +$('shotSize').value;
  const r = shape === 'screen' ? canvas.clientWidth / Math.max(1, canvas.clientHeight) : (([a, b]) => a / b)(shape.split(':').map(Number));
  const w = r >= 1 ? long : long * r, h = r >= 1 ? long / r : long;
  return [Math.round(w / 2) * 2, Math.round(h / 2) * 2];
}
let busy = false;
async function photo() {
  if (busy || !ctl) return; busy = true; msg('Rendering the photo');
  try {
    const [w, h] = shotSize(), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const running = ctl.running();
    ctl.beginCapture(w, h, false);
    if (lensFov()) { const c = wcam(); c.fov = lensFov(); c.updateProjectionMatrix(); }
    ctl.captureFrame(0, cv.getContext('2d'));
    ctl.endCapture(running); applyLens();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.94));
    if (!blob) throw new Error('empty');
    await deliver(blob, baseName() + '-' + stamp() + '-' + w + 'x' + h + '.jpg', 'photo');
  } catch (e) { console.warn(e); msg('That size is too big for this device. Try a smaller one.'); try { ctl.endCapture(true); } catch (x) { } }
  busy = false;
}
$('shot').onclick = photo;

const rec = {
  r: null, t0: 0, len: 0, chunks: [],
  type() {
    const c = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    return window.MediaRecorder ? c.find((t) => MediaRecorder.isTypeSupported(t)) || '' : null;
  },
  toggle() { this.r ? this.stop() : this.start(); },
  start() {
    const type = this.type();
    if (type == null || !canvas.captureStream) { msg('This browser cannot record video. Try Chrome or Safari.'); return; }
    const stream = canvas.captureStream(30);
    this.chunks = []; this.len = +$('vidLen').value; this.type_ = type || 'video/webm';
    this.r = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: +$('vidQ').value * 1e6 });
    this.r.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.r.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.type_.split(';')[0] });
      stream.getTracks().forEach((t) => t.stop());
      deliver(blob, baseName() + '-' + stamp() + (this.type_.includes('mp4') ? '.mp4' : '.webm'), 'video');
    };
    this.r.start(500); this.t0 = performance.now();
    this.iv = setInterval(() => this.tick(), 250);
    $('rec').hidden = false; $('vid').textContent = 'Stop recording'; msg('Recording');
  },
  stop() { if (!this.r) return; clearInterval(this.iv); const r = this.r; this.r = null; r.stop(); $('rec').hidden = true; $('vid').innerHTML = 'Record video <kbd>V</kbd>'; },
  tick() {
    if (!this.r) return;
    const s = (performance.now() - this.t0) / 1000;
    $('recT').textContent = Math.floor(s / 60) + ':' + pad(Math.floor(s % 60));
    if (this.len && s >= this.len) this.stop();
  }
};
$('vid').onclick = () => rec.toggle();
$('recStop').onclick = () => rec.stop();

$('gif').onclick = async () => {
  if (busy || !ctl) return; busy = true; $('gif').disabled = true;
  const day = $('gifKind').value === 'day';
  try {
    const r = await ctl.recordGif({ day, long: +$('gifSize').value, download: false, onProgress: (f) => msg('Recording the GIF ' + Math.round(f * 100) + '%') });
    if (r && r.blob) await deliver(r.blob, baseName() + (day ? '-day' : '-' + stamp()) + '.gif', 'gif');
  } catch (e) { console.warn(e); msg('Could not make the GIF in this browser'); }
  applyTime(false);
  busy = false; $('gif').disabled = false;
};

let glbBlob = null, glbName = '';
async function glb(mode) {
  if (busy || !ctl) return; busy = true; msg('Building the 3D model');
  ['glbScene', 'glbClock'].forEach((b) => { $(b).disabled = true; });
  try {
    glbBlob = await glbFromWorld(ctl, { mode, name: 'Marfa Light #' + id, radius: +$('glbR').value });
    glbName = baseName() + (mode === 'clock' ? '-clock' : '') + '.glb';
    msg('3D model ready, ' + (glbBlob.size / 1048576).toFixed(1) + ' MB');
    await showModel(glbBlob, mode);
  } catch (e) { console.warn(e); msg('Could not build the model in this browser'); }
  busy = false; ['glbScene', 'glbClock'].forEach((b) => { $(b).disabled = false; });
}
let mvLoaded = null;
async function showModel(blob, mode) {
  $('glbTitle').textContent = 'Marfa Light #' + id + (mode === 'clock' ? ', the clock' : ', the whole scene');
  $('glbNote').textContent = (blob.size / 1048576).toFixed(1) + ' MB. Drag to turn it. Opens in Blender, Unity, Spline, three.js, or any viewer that reads GLB.' + (touch ? ' Tap the cube icon to place it in your room.' : '');
  $('mvBox').innerHTML = 'Loading the viewer';
  $('glbDlg').showModal();
  if (!mvLoaded) mvLoaded = import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js').catch(() => null);
  await mvLoaded;
  const mv = document.createElement('model-viewer');
  mv.setAttribute('src', URL.createObjectURL(blob)); mv.setAttribute('camera-controls', ''); mv.setAttribute('auto-rotate', ''); mv.setAttribute('shadow-intensity', '1');
  mv.setAttribute('environment-image', 'neutral'); mv.setAttribute('exposure', '1.1');
  if (mode !== 'clock') {
    // start where the token's own camera stands, looking at the clock
    const C = ctl.world.cam, az = Math.atan2(C.pos ? C.pos.x : 0, C.pos ? C.pos.z : 1) * 180 / Math.PI;
    mv.setAttribute('camera-target', '0m ' + C.lookY.toFixed(2) + 'm 0m');
    mv.setAttribute('camera-orbit', az.toFixed(0) + 'deg 75deg ' + (C.dist * 1.8).toFixed(1) + 'm');
    mv.setAttribute('field-of-view', '40deg');
  }
  if (mode === 'clock') { mv.setAttribute('ar', ''); mv.setAttribute('ar-modes', 'webxr quick-look'); mv.setAttribute('ar-scale', 'auto'); }
  $('mvBox').innerHTML = ''; $('mvBox').appendChild(mv);
}
$('glbScene').onclick = () => glb('scene');
$('glbClock').onclick = () => glb('clock');
$('glbSave').onclick = () => { if (glbBlob) { $('glbDlg').close(); deliver(glbBlob, glbName, 'glb'); } };

// ---------------------------------------------------------------- tabs
function tab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
}
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) tab(b.dataset.tab); });
window.addEventListener('resize', () => { if (ctl) { ctl.resize(); applyLens(); } });
const ro = new ResizeObserver(() => { if (ctl) { ctl.resize(); applyLens(); } }); ro.observe($('stage'));

boot().catch((e) => { console.error(e); $('boot').textContent = 'This browser could not start the studio (WebGL is needed)'; });
