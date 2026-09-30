#!/usr/bin/env node
// Record a film of Marfa Light with headless Chrome over the DevTools protocol.
// Real engine frames, no screen capture: each frame is rendered on demand and
// grabbed as PNG, then ffmpeg makes the MP4.
//
//   node tools/film.js                       -> renders/film/marfa-light.mp4 from tools/film-shots.json
//   node tools/film.js --shots my.json --w 1280 --h 720 --fps 30
//
// Needs Chrome and ffmpeg. Node 22+ (built in WebSocket).
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1280), H = +arg('h', 720), FPS = +arg('fps', 30);
const SHOTS = JSON.parse(fs.readFileSync(path.resolve(arg('shots', path.join(__dirname, 'film-shots.json'))), 'utf8'));
const OUT = path.resolve(arg('out', path.join(ROOT, 'renders', 'film')));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9300 + Math.floor(Math.random() * 400);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, 'frames'))) fs.unlinkSync(path.join(OUT, 'frames', f));
  const chrome = spawn(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const wait = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + path.join(__dirname, 'film.html') });
  for (let i = 0; i < 100; i++) { if (await evaluate('typeof window.__load').catch(() => '') === 'function') break; await sleep(200); }
  let n = 0;
  for (const s of SHOTS) {
    const feats = await evaluate(`__load(${JSON.stringify(s.hash)}, ${W}, ${H}, ${JSON.stringify(s.film || null)})`);
    const frames = Math.round(s.seconds * FPS);
    console.log('shot', s.hash.slice(0, 10), JSON.parse(feats).Clock, frames, 'frames');
    for (let k = 0; k < frames; k++) {
      const t = k / Math.max(1, frames - 1);
      const utc = s.utc + t * s.seconds * (s.speed || 1);
      await evaluate(`__frame(${utc}, ${1 / FPS}, ${(s.orbit || 0) * (t - 0.5)}, ${(s.lift || 0) * t}, ${k === 0})`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, 'frames', String(n++).padStart(5, '0') + '.png'), Buffer.from(shot.result.data, 'base64'));
    }
  }
  ws.close(); chrome.kill();
  const mp4 = path.join(OUT, arg('name', 'marfa-light') + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(OUT, 'frames', '%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4]);
  console.log('wrote', mp4, n, 'frames');
}
main().catch((e) => { console.error(e); process.exit(1); });
