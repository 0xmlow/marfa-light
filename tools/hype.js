#!/usr/bin/env node
// The hype film: every clock and every place, cut to a 120 BPM track that is
// synthesised to the same timeline (tools/hype_music.py). Real engine frames,
// rendered on demand in headless Chrome on the GPU and grabbed over the
// DevTools protocol, then ffmpeg.
//   node tools/hype.js [--w 1920 --h 1080 --fps 30] [--only 0-5] [--plan]
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1920), H = +arg('h', 1080), FPS = +arg('fps', 30), BEAT = 0.5;
const OUT = path.resolve(arg('out', path.join(ROOT, 'renders', 'hype')));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
require(path.join(ROOT, 'marfa-light.js'));
const L = globalThis.marfaLight;
const utcAt = (h, day) => { const hh = Math.floor(h), rest = (h - hh) * 60, mm = Math.floor(rest), ss = Math.round((rest - mm) * 60); return L.marfaUtc(2027, 4, day || 17, hh, mm) + ss; };

// ---------------------------------------------------------------- the shots
const stills = JSON.parse(fs.readFileSync(path.join(ROOT, 'renders', 'v0.4-hashes.json'), 'utf8'));
const byClock = {};
stills.forEach((s) => { if (s.name.startsWith('clock-')) byClock[L.plan(s.hash).clock] = s.hash; });
const shots = [];
let dir = 1;
function shot(o) { dir = -dir; shots.push(Object.assign({ orbit: 0.3 * dir, push: 0.07, speed: 1 }, o)); }
function clockShot(name, hour, beats, extra) { shot(Object.assign({ hash: byClock[name], hour, beats, section: extra && extra.section }, extra)); }

// 1. cold open: night into sunrise on the obelisk, the title over it
shot({ hash: byClock['Meridian Obelisk'], hour: 5.2, beats: 8, speed: 3.2 * 3600 / 4, orbit: 0.5, push: -0.12, lift: 1.5, label: false,
  title: 'Marfa Light', titleSub: 'Every token is a working clock for Marfa, Texas', titleIn: 0.18, section: 'intro' });
shots.push({ card: 'Nine read the sky', cardSub: 'Shadows cast by the real sun, for the minute you look', beats: 2, section: 'card' });
// 2. the sky clocks: time-lapse so the shadows travel
// low sun, long shadows: a dial at mid afternoon hides its shadow against its own gnomon
const SKY = [['Horizontal Sundial', 17.7, 2400], ['Analemmatic Sundial', 8.9, 2400], ['Armillary Sphere', 9.3, 2400], ['Heliochronometer', 17.2, 1800],
  ['Noon Cannon', 13 + 55.6 / 60, 12], ['Meridian Obelisk', 18.0, 3000], ['Wall Dial', 10.4, 2400], ['Bow Dial', 9.0, 2400], ['Nocturnal', 22.3, 1800]];
SKY.forEach((q) => clockShot(q[0], q[1], 3, { speed: q[2], section: 'sky' }));
shots.push({ card: 'Twenty keep it other ways', cardSub: 'Flaps · water · sand · words · gears · fire · bulbs · wind · the turning Earth', beats: 2, section: 'card' });
// 3. the rest, in real time; several start just before the minute or the hour so it turns on screen
const MACH = [['Split-Flap Board', 19.0 - 1.2 / 3600], ['Flip Monument', 20.2 - 0.4 / 60], ['Orbital', 21.7], ['Blossom Binary', 13.1], ['Solar Henge', 18.7],
  ['Concourse Clock', 21.1], ['Water Clock', 9.3], ['Hourglass', 20 - 0.6 / 3600], ['Word Clock', 16.4], ['Kinetic Pin Field', 7.8 - 0.5 / 3600],
  ['Skeleton Clock', 21.1], ['Astronomical Clock', 13 - 0.4 / 3600], ['Motel Sign', 22.2], ['Water Tower Clock', 20.1], ['Foucault Pendulum', 16.5],
  ['Candle Clock', 21.6], ['Station Clock', 10 - 3 / 3600], ['Scoreboard', 21.9], ['Pumpjack', 19.2], ['Windmill Clock', 18.4]];
MACH.forEach((q) => clockShot(q[0], q[1], 2, { section: 'machines' }));
shots.push({ card: 'Nineteen places', cardSub: 'Each with the real skyline of the Davis and Chinati Mountains', beats: 2, section: 'card' });
// 4. every place, each with a different clock, framed straight on
const PLACES = ['Chinati Field', 'Highway 90', 'Marfa Lights Viewing Area', 'Salt Playa', 'Mesa Rim', 'Adobe Courtyard', 'Artillery Shed', 'Highland Avenue',
  'Observatory Ridge', 'Hadid Pavilion', 'Prairie Terrace', 'Railroad Depot', 'Arroyo', 'Rodeo Arena', 'Ghost Town', 'Aerostat Field', 'Drive-In Lot', 'Empty Pool', 'Hot Springs'];
const PH = [18.9, 19.3, 21.8, 11.2, 19.6, 20.6, 15.4, 19.1, 22.4, 17.8, 18.3, 19.4, 10.8, 20.3, 19.5, 11.6, 21.9, 16.2, 19.7];
function hashFrom(x) { let h = '0x'; x = x >>> 0; for (let j = 0; j < 64; j++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; h += ((x >>> 16) & 15).toString(16); } return h; }
const usedAt = {};
PLACES.forEach((p, i) => {
  let h = null;
  for (let s = 40000 + i * 977; s < 400000 && !h; s++) {
    const c = hashFrom(Math.imul(s, 2654435761)), P = L.plan(c), d = L.clocks[P.clock];
    if (P.place !== p || d.solar || usedAt[P.clock] || P.film === 'Tri-X' || P.film === 'Polaroid') continue;
    if (P.gen.features.Framing !== 'Centered' || P.gen.features.Lens === '85mm' || P.gen.features.Anomaly !== 'None') continue;
    h = c; usedAt[P.clock] = 1;
  }
  shot({ hash: h, hour: PH[i], beats: 2, name: p, sub: 'with the ' + L.plan(h).clock, orbit: 0.5 * dir, push: -0.06, section: 'places' });
});
// 5. a whole day on the water tower, then the end card
shot({ hash: byClock['Water Tower Clock'], hour: 0.2, beats: 8, speed: 23.5 * 3600 / 4, orbit: 0.9, push: 0.1, name: 'One day in Marfa', sub: 'Midnight to midnight in four seconds', flash: true, section: 'finale' });
shots.push({ card: 'Marfa Light', cardSub: '29 clocks  ·  19 places  ·  22 traits a token  ·  working title  ·  mlow.xyz', beats: 6, logo: true, fade: true, section: 'end' });

// ---------------------------------------------------------------- timeline
let beat = 0;
shots.forEach((s) => { s.startBeat = beat; beat += s.beats; s.seconds = s.beats * BEAT; if (s.hour != null) s.utc = utcAt(s.hour); });
const timeline = { bpm: 120, beats: beat, seconds: beat * BEAT, sections: shots.map((s) => ({ section: s.section, start: s.startBeat, beats: s.beats })) };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 1));
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(shots.map((s) => ({ section: s.section, hash: s.hash, clock: s.hash && L.plan(s.hash).clock, place: s.hash && L.plan(s.hash).place, hour: s.hour, beats: s.beats, card: s.card })), null, 1));
console.log(shots.length, 'shots,', beat, 'beats,', timeline.seconds, 's');
if (process.argv.includes('--plan')) process.exit(0);

// ---------------------------------------------------------------- render
const only = arg('only', null), [o0, o1] = only ? only.split('-').map(Number) : [0, shots.length - 1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const FR = path.join(OUT, 'frames'); fs.mkdirSync(FR, { recursive: true });
  const PORT = 9500 + Math.floor(Math.random() * 300);
  const chrome = spawn(CHROME, ['--headless=new', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });
  let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const wait = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(e.slice(0, 60) + ' ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + path.join(__dirname, 'hype.html') });
  for (let i = 0; i < 100; i++) { if (await ev('typeof window.__shot').catch(() => '') === 'function') break; await sleep(200); }
  for (let si = o0; si <= o1; si++) {
    const s = shots[si], frames = Math.round(s.seconds * FPS), f0 = Math.round(s.startBeat * BEAT * FPS);
    await ev('__shot(' + JSON.stringify(s) + ')');
    const t0 = Date.now();
    for (let k = 0; k < frames; k++) {
      const t = k / frames;
      await ev(`__frame(${t}, ${s.utc != null ? s.utc + t * s.seconds * s.speed : 0}, ${1 / FPS}, ${k})`);
      const shotImg = await send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
      fs.writeFileSync(path.join(FR, String(f0 + k).padStart(5, '0') + '.jpg'), Buffer.from(shotImg.result.data, 'base64'));
    }
    console.log('shot', si, s.section, s.card || L.plan(s.hash).clock + ' / ' + L.plan(s.hash).place, frames, 'frames', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  ws.close(); chrome.kill();
  if (only) return;
  const wav = path.join(OUT, 'hype-music.wav');
  execFileSync('python3', [path.join(__dirname, 'hype_music.py'), path.join(OUT, 'timeline.json'), wav], { stdio: 'inherit' });
  const mp4 = path.join(OUT, 'marfa-light-hype.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FR, '%05d.jpg'), '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', mp4]);
  console.log('wrote', mp4);
})().catch((e) => { console.error(e); process.exit(1); });
