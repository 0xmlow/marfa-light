// Wrist and wall: a live watch preview, Photos face stills, and the day pack for the watch app.
// Everything renders here, from the seed; nothing is stored on a server.
import { loadEngine, seedFor, download } from '../ui/marfa-live.js';
import { renderDay, renderStills, WATCH, hhmm } from '../ui/watch-render.js';

const BASE = '../', MAX_ID = 110;
const $ = (id) => document.getElementById(id);
const input = $('id');
let L = null, live = null, seed = null, busy = false, raf = 0, last = 0, ticket = 0;

const clampId = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(MAX_ID, Math.max(0, n)) : 0; };
const view = () => document.querySelector('input[name=view]:checked').value;
const status = (t) => { $('status').textContent = t; };

// the watch keeps the wearer's time: hand the engine the second whose Marfa wall time is ours
function localUtc() {
  const u = Date.now() / 1000;
  return u - new Date().getTimezoneOffset() * 60 - L.marfaTime(u).off * 3600;
}

function tick(ms) {
  raf = requestAnimationFrame(tick);
  if (!live || ms - last < 66) return; // about 15 fps is plenty for a preview
  const dt = last ? Math.min((ms - last) / 1000, 0.2) : 0; last = ms;
  live.setClock(localUtc());
  live.renderOnce(dt);
  const d = new Date();
  $('wtime').textContent = (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function choose() {
  const my = ++ticket, id = clampId(input.value);
  input.value = id;
  $('frameLink').href = '../frame/?id=' + id;
  $('stills').innerHTML = '';
  status('Loading #' + id);
  L = L || await loadEngine(BASE);
  const s = await seedFor(id, BASE);
  if (my !== ticket) return;
  if (live) { live.dispose(); live = null; }
  seed = s;
  if (!seed) { $('name').textContent = 'Not minted yet'; status('#' + id + ' has not been minted yet.'); setButtons(false); return; }
  // a fresh canvas each time: a disposed context is not always reusable
  const old = $('live'), c = document.createElement('canvas');
  c.id = 'live'; c.width = WATCH.w; c.height = WATCH.h; c.setAttribute('aria-label', old.getAttribute('aria-label'));
  old.replaceWith(c);
  live = L.create(c, seed, { mode: 'still', utc: localUtc(), interactive: false, keys: false, overlay: false, maxPixelRatio: 2, reducedMotion: true });
  live.setView(view());
  for (let i = 0; i < 4; i++) live.renderOnce(1);
  const f = live.features;
  $('name').textContent = 'Marfa Light #' + id + ' · ' + f.Clock + ' · ' + f.Place;
  status('Your time, live. This is what the watch app shows.');
  setButtons(true);
  if (!raf) raf = requestAnimationFrame(tick);
}
function setButtons(on) { $('stillsBtn').disabled = !on || busy; $('dayBtn').disabled = !on || busy; }

// fflate, only when someone asks for a zip
let zipLib = null;
async function zip(files) {
  zipLib = zipLib || await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  const entries = {};
  for (const [name, b] of files) entries[name] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];
  return new Blob([zipLib.zipSync(entries)], { type: 'application/zip' });
}

async function heavy(label, job) {
  if (busy || !seed) return;
  busy = true; setButtons(false);
  const paused = live; live = null; // one GPU job at a time
  try { await job(); }
  catch (e) { console.error(e); status(label + ' failed: ' + (e.message || e)); }
  finally { busy = false; live = paused; last = 0; setButtons(true); $('prog').hidden = true; }
}

$('stillsBtn').addEventListener('click', () => heavy('The stills', async () => {
  const id = clampId(input.value);
  status('Drawing four moments of today');
  const stills = await renderStills(L, seed, { view: view() });
  const box = $('stills'); box.innerHTML = '';
  for (const s of stills) {
    const url = URL.createObjectURL(s.blob), a = document.createElement('a');
    a.href = url; a.download = `marfa-light-${id}-${s.name}.jpg`;
    const img = new Image(); img.src = url; img.alt = `#${id} at ${s.name}`; img.width = WATCH.w; img.height = WATCH.h;
    a.append(img, `${s.name} ${hhmm(s.min).replace(/(\d\d)(\d\d)/, '$1:$2')}`);
    box.appendChild(a);
  }
  download(await zip(stills.map((s) => [`marfa-light-${id}-${s.name}.jpg`, s.blob])), `marfa-light-${id}-watch-stills.zip`);
  status('Saved. Tap a still to save it alone, or open the zip on your iPhone.');
}));

$('dayBtn').addEventListener('click', () => heavy('The day pack', async () => {
  const id = clampId(input.value), prog = $('prog');
  prog.hidden = false; prog.value = 0;
  const t0 = performance.now();
  const day = await renderDay(L, seed, {
    view: view(),
    onFrame: (f, i, n) => { prog.value = (i + 1) / n; status(`Frame ${i + 1} of ${n} · ${f.name.slice(0, 2)}:${f.name.slice(2)}`); },
  });
  const feats = L.plan(seed).features;
  const meta = { id, seed, clock: feats.Clock, place: feats.Place, date: day.date, step: day.step, w: day.w, h: day.h, view: view(), frames: day.frames.map((x) => x.name) };
  const files = day.frames.map((x) => [`ml-${id}-${x.name}.jpg`, x.blob]);
  files.push([`ml-${id}.json`, new Blob([JSON.stringify(meta, null, 1)], { type: 'application/json' })]);
  download(await zip(files), `marfa-light-${id}-day-${day.date}.zip`);
  status(`Saved ${day.frames.length} frames in ${Math.round((performance.now() - t0) / 1000)} s.`);
}));

// ---------- controls ----------
document.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => { input.value = (clampId(input.value) + +b.dataset.step + MAX_ID + 1) % (MAX_ID + 1); choose(); }));
input.addEventListener('change', choose);
document.querySelectorAll('input[name=view]').forEach((r) => r.addEventListener('change', () => { if (live) { live.setView(view()); for (let i = 0; i < 4; i++) live.renderOnce(1); } }));
const startId = new URLSearchParams(location.search).get('id');
if (startId != null) input.value = clampId(startId);
setButtons(false);
choose().catch((e) => { console.error(e); status('This browser could not draw the clock.'); });
