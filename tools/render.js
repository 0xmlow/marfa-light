#!/usr/bin/env node
// Render stills of tokens with headless Chrome on the GPU (Metal, macOS).
// SOFTWARE=1 uses SwiftShader instead: no GPU needed, but minutes a frame for big scenes.
//   node tools/render.js --hashes hashes.json --out renders/stills --w 2400 --h 1600
// hashes.json: [{ "hash": "0x...", "hour": 19.5, "name": "optional-file-name" }]
// --src other.js renders a different build (paths relative to cwd). Items may carry "view": "Close" etc.
// With no --hashes, renders 12 random tokens at their residency minute.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1800), H = +arg('h', 1200), OUT = path.resolve(arg('out', path.join(ROOT, 'renders', 'stills')));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let list;
if (arg('hashes')) list = JSON.parse(fs.readFileSync(path.resolve(arg('hashes')), 'utf8'));
else { let x = Date.now() >>> 0; list = []; for (let i = 0; i < 12; i++) { let h = '0x'; for (let j = 0; j < 64; j++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; h += ((x >>> 16) & 15).toString(16); } list.push({ hash: h }); } }
fs.mkdirSync(OUT, { recursive: true });
list.forEach((it, i) => {
  const name = (it.name || String(i + 1).padStart(2, '0') + '-' + it.hash.slice(2, 10)) + '.png';
  const q = new URLSearchParams({ hash: it.hash, w: W, h: H }); if (it.hour != null) q.set('hour', it.hour); if (it.film) q.set('film', it.film); if (it.view) q.set('view', it.view); if (arg('src')) q.set('src', path.relative(__dirname, path.resolve(arg('src'))));
  const GL = process.env.SOFTWARE ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
  execFileSync(CHROME, ['--headless=new'].concat(GL, ['--hide-scrollbars', '--allow-file-access-from-files',
    '--virtual-time-budget=90000', `--window-size=${W},${H}`, '--screenshot=' + path.join(OUT, name), 'file://' + path.join(__dirname, 'still.html') + '?' + q]), { stdio: 'ignore' });
  console.log('rendered', name);
});
