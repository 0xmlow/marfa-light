// Marfa Light Frame: one token, full-screen, keeping real time on a TV or spare screen.
//
//   /frame/?id=14               Marfa time (the hands and the sun are Marfa's)
//   /frame/?id=14&tz=local      the hands keep this screen's time; the sun moves with them
//   /frame/?id=14&tz=Europe/London
//   &view=Close|Wide|Ground|Plan   &fps=20 (1 to 60)   &scale=1 (render size, 0.25 to 2)
//   &time=1                     keep the time in the corner
//
// A TV is a weak computer left on for weeks, so the frame draws at a capped rate and size,
// holds a wake lock, rebuilds itself if the GPU drops the scene, and reloads once a night.
import { loadEngine, seedFor } from '../ui/marfa-live.js';

const BASE = '../';
const MAX_ID = 110;
const VIEWS = ['Hero', 'Close', 'Wide', 'Ground', 'Plan'];
const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const state = {
  id: q.has('id') ? clampInt(q.get('id'), 0, MAX_ID, 0) : null,
  tz: q.get('tz') || 'marfa',
  view: VIEWS.includes(q.get('view')) ? q.get('view') : 'Hero',
  fps: clampNum(q.get('fps'), 1, 60, 20),
  scale: q.has('scale') ? clampNum(q.get('scale'), 0.25, 2, 1) : null,
  time: q.get('time') === '1',
};
let L = null, ctl = null, canvas = $('c'), lastDraw = 0, lastMs = 0, raf = 0, hudTimer = 0, idleTimer = 0, building = 0;
const started = Date.now();

function clampInt(v, a, b, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; }
function clampNum(v, a, b, d) { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; }

// ---------- time: which minute the hands keep ----------
// The engine always reads a UTC second as Marfa wall time. To keep another zone, hand it the
// UTC second whose Marfa wall time equals that zone's wall time now.
function zoneOffsetSec(zone, at) {
  if (zone === 'local') return -new Date(at).getTimezoneOffset() * 60;
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((wall - Math.floor(at / 1000) * 1000) / 1000);
  } catch (e) { return null; }
}
function keptUtc() {
  const now = Date.now(), u = now / 1000;
  if (state.tz === 'marfa') return u;
  const off = zoneOffsetSec(state.tz, now);
  if (off == null) { state.tz = 'marfa'; return u; }
  return u + off - L.marfaTime(u).off * 3600;
}
function zoneLabel(t) {
  if (state.tz === 'marfa') return 'Marfa time · ' + t.zone;
  if (state.tz === 'local') return 'Local time';
  return state.tz.split('/').pop().replace(/_/g, ' ') + ' time';
}
function clockText(t) { const h = t.h % 12 || 12; return h + ':' + String(t.m).padStart(2, '0') + (t.h < 12 ? ' am' : ' pm'); }

// ---------- the label ----------
function showHud(ms = 6000) {
  $('hud').classList.add('on');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => $('hud').classList.remove('on'), ms);
}
function paintHud() {
  if (!ctl) return;
  const t = L.marfaTime(keptUtc());
  $('hudTime').textContent = clockText(t);
  $('hudZone').textContent = zoneLabel(t);
}
function say(text) { const m = $('msg'); m.textContent = text; m.hidden = !text; }

// ---------- drawing ----------
function renderScale() {
  if (state.scale) return state.scale;
  // about 1920 px across is plenty from a sofa, and a 4K TV browser cannot push more
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, 1920 / Math.max(1, innerWidth));
}
function loop(ms) {
  raf = requestAnimationFrame(loop);
  if (!ctl || ms - lastDraw < 1000 / state.fps - 2) return;
  const dt = lastMs ? Math.min((ms - lastMs) / 1000, 1) : 0;
  lastMs = ms; lastDraw = ms;
  ctl.setClock(keptUtc());
  ctl.renderOnce(dt);
  if (state.time || $('hud').classList.contains('on')) paintHud();
}

async function build() {
  const ticket = ++building;
  say('');
  if (ctl) { ctl.dispose(); ctl = null; }
  // a fresh canvas for each token: a disposed WebGL context is not always reusable on TV browsers
  const fresh = document.createElement('canvas');
  fresh.id = 'c'; fresh.setAttribute('aria-label', 'Marfa Light clock');
  canvas.replaceWith(fresh); canvas = fresh;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); say('Rebuilding the scene'); setTimeout(() => location.reload(), 3000); });

  $('hudNum').textContent = '#' + state.id;
  $('hudName').textContent = 'Loading';
  showHud(1e9);
  L = L || await loadEngine(BASE);
  const seed = await seedFor(state.id, BASE);
  if (ticket !== building) return;
  if (!seed) { $('hudName').textContent = 'Not minted yet'; say('Marfa Light #' + state.id + ' has not been minted yet.'); return; }

  ctl = L.create(canvas, seed, {
    mode: 'still', utc: keptUtc(), interactive: true, keys: false, overlay: false,
    maxPixelRatio: renderScale(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  ctl.setView(state.view);
  const f = ctl.features;
  $('hudName').textContent = [f.Clock, f.Place].filter(Boolean).join(' · ');
  document.title = 'Marfa Light #' + state.id + ' · Frame';
  paintHud(); showHud();
  lastMs = 0; lastDraw = 0;
  if (!raf) raf = requestAnimationFrame(loop);
}

function writeUrl() {
  const p = new URLSearchParams();
  p.set('id', state.id);
  if (state.tz !== 'marfa') p.set('tz', state.tz);
  if (state.view !== 'Hero') p.set('view', state.view);
  for (const k of ['fps', 'scale', 'time']) if (q.has(k)) p.set(k, q.get(k));
  history.replaceState(null, '', '?' + p.toString());
}

// ---------- staying on ----------
let lock = null;
async function holdScreen() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch (e) { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') holdScreen(); });
// once a night, after hours of running, start clean: TV browsers leak
setInterval(() => {
  const h = new Date().getHours();
  if (h === 4 && Date.now() - started > 6 * 3600e3) location.reload();
}, 60e3);

function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
}
addEventListener('pointermove', wake);
addEventListener('pointerdown', () => { wake(); if (ctl) showHud(); });

function fullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
}

// ---------- the remote ----------
addEventListener('keydown', (e) => {
  if (!ctl && state.id == null) return; // the picker handles its own keys
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ChannelUp' || k === 'ChannelDown' || k === 'MediaTrackNext' || k === 'MediaTrackPrevious') {
    const d = /Right|Up|Next/.test(k) ? 1 : -1;
    state.id = (state.id + d + MAX_ID + 1) % (MAX_ID + 1);
    writeUrl(); build(); e.preventDefault();
  } else if (k === 'ArrowUp' || k === 'ArrowDown') {
    const i = (VIEWS.indexOf(state.view) + (k === 'ArrowUp' ? 1 : -1) + VIEWS.length) % VIEWS.length;
    state.view = VIEWS[i]; ctl?.setView(state.view); writeUrl();
    $('hudZone').textContent = state.view + ' view'; showHud(2500); e.preventDefault();
  } else if (k === 'Enter' || k === ' ' || k === 'i') {
    paintHud(); showHud(); e.preventDefault();
  } else if (k === 't') {
    state.tz = state.tz === 'marfa' ? 'local' : 'marfa'; writeUrl(); paintHud(); showHud();
  } else if (k === 'f') {
    fullscreen();
  } else if (k === 'Escape' || k === 'Backspace' || k === 'GoBack') {
    if (!document.fullscreenElement) { location.href = './'; e.preventDefault(); }
  }
});

// ---------- the picker ----------
function picker() {
  $('pick').hidden = false;
  $('hud').hidden = true;
  const input = $('pickId'), form = $('pickForm');
  let saved = null;
  try { saved = localStorage.getItem('marfa-frame-id'); } catch (e) { }
  if (saved != null) input.value = clampInt(saved, 0, MAX_ID, 0);
  if (state.tz !== 'marfa') form.querySelector('input[value=local]').checked = true;
  const bump = (d) => { input.value = (clampInt(input.value, 0, MAX_ID, 0) + d + MAX_ID + 1) % (MAX_ID + 1); };
  form.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => bump(+b.dataset.step)));
  form.addEventListener('keydown', (e) => {
    if (e.target === input && (e.key === 'ArrowUp' || e.key === 'ArrowRight')) { bump(1); e.preventDefault(); }
    if (e.target === input && (e.key === 'ArrowDown' || e.key === 'ArrowLeft')) { bump(-1); e.preventDefault(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = clampInt(input.value, 0, MAX_ID, 0);
    try { localStorage.setItem('marfa-frame-id', String(id)); } catch (x) { }
    const tz = form.querySelector('input[name=tz]:checked').value;
    location.search = '?id=' + id + (tz === 'local' ? '&tz=local' : '');
  });
  input.focus(); input.select();
  loadEngine(BASE).catch(() => { }); // warm the engine while they choose
}

// ---------- go ----------
if (state.time) $('hud').classList.add('always');
if (state.id == null) picker();
else {
  holdScreen(); wake();
  build().catch((e) => { console.error(e); say('This screen could not draw the clock. Try a newer browser, or add &scale=0.5 to the address.'); });
  // keep the corner clock honest even between draws at low fps
  setInterval(() => { if (state.time) paintHud(); }, 1000);
}
