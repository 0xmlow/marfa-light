#!/usr/bin/env node
// Export tokens as GLB with headless Chrome: the whole scene (with the sun as a
// light and the hero camera) and the clock alone, plus a JSON of traits, time,
// sun and camera.
//   node tools/export-glb.js 0xHASH 19.5 [out_dir]
//   node tools/export-glb.js --hashes renders/v0.4-hashes.json --out renders/v0.4/glb [--modes scene,clock]
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let list, OUT;
if (arg('hashes')) { list = JSON.parse(fs.readFileSync(path.resolve(arg('hashes')), 'utf8')); OUT = path.resolve(arg('out', 'renders/glb')); }
else { list = [{ hash: argv[0], hour: +(argv[1] || 19.5) }]; OUT = path.resolve(argv[2] || path.join(__dirname, '..', 'renders', 'glb')); }
const MODES = arg('modes', 'scene,clock').split(',');
const PORT = 9700 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const GL = process.env.SOFTWARE ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
  const chrome = spawn(CHROME, ['--headless=new', ...GL, '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });
  let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const wait = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result.result.value;
  for (const it of list) {
    for (const mode of MODES) {
      const base = (it.name || 'marfa-light-' + it.hash.slice(2, 10)) + (mode === 'clock' ? '-clock' : '');
      await send('Page.navigate', { url: 'file://' + path.join(__dirname, 'export-glb.html') + '?' + new URLSearchParams({ hash: it.hash, hour: it.hour == null ? 19.5 : it.hour, mode, auto: 1 }) });
      await sleep(300);
      let len = 0;
      for (let i = 0; i < 600 && !(len = await ev('window.__glb ? window.__glb.length : 0')); i++) await sleep(250);
      if (!len) { console.log('FAILED', base, await ev('String(window.__err || "")')); continue; }
      let b64 = '';
      for (let o = 0; o < len; o += 4000000) b64 += await ev(`window.__glb.slice(${o}, ${o + 4000000})`);
      fs.writeFileSync(path.join(OUT, base + '.glb'), Buffer.from(b64, 'base64'));
      fs.writeFileSync(path.join(OUT, base + '.json'), await ev('JSON.stringify(window.__exportInfo, null, 1)'));
      console.log('wrote', base + '.glb', Math.round(fs.statSync(path.join(OUT, base + '.glb')).size / 1024), 'KB');
    }
  }
  ws.close(); chrome.kill();
})().catch((e) => { console.error(e); process.exit(1); });
