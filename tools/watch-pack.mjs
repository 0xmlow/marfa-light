#!/usr/bin/env node
// Render day packs for the Marfa Light watch app: 288 frames a token (one every 5 minutes),
// written flat into watch-app/MarfaLight/Frames as ml-<id>-HHMM.jpg plus ml-<id>.json.
// The same renderer as marfalight.art/watch/ (proposal-site/ui/watch-render.js), on the GPU.
//
//   node tools/watch-pack.mjs --ids 14,0,3 [--view Close] [--step 300] [--date 2026-11-15] [--clean]
//
// Re-run monthly: the frames hold one day's sun, and the sun moves with the seasons.
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'proposal-site');
const OUT = path.join(ROOT, 'watch-app/MarfaLight/Frames');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const ids = (arg('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
if (!ids.length || ids.some((n) => !Number.isInteger(n) || n < 0 || n > 110)) {
  console.error('usage: node tools/watch-pack.mjs --ids 14,0,3 [--view Hero|Close] [--step 300] [--date YYYY-MM-DD] [--clean]');
  process.exit(1);
}
const view = arg('view', 'Hero'), step = +arg('step', 300), date = arg('date');

// the site, served from this folder (module imports need http, not file://)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const f = path.join(SITE, p.endsWith('/') ? p + 'index.html' : p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

fs.mkdirSync(OUT, { recursive: true });
if (argv.includes('--clean')) for (const f of fs.readdirSync(OUT)) if (/^ml-\d+[-.]/.test(f)) fs.unlinkSync(path.join(OUT, f));

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  await page.goto(origin + '/watch/blank.html');
  for (const id of ids) {
    const t0 = Date.now();
    const pack = await page.evaluate(async ({ id, view, step, date }) => {
      const { loadEngine, seedFor } = await import('/ui/marfa-live.js');
      const W = await import('/ui/watch-render.js');
      const L = await loadEngine('/');
      const seed = await seedFor(id, '/');
      if (!seed) return null;
      const at = date ? new Date(date + 'T18:00:00Z') : undefined; // midday in Marfa
      const day = await W.renderDay(L, seed, { view, step, date: at });
      const b64 = (b) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b); });
      const frames = [];
      for (const f of day.frames) frames.push({ name: f.name, data: await b64(f.blob) });
      const ft = L.plan(seed).features;
      return { meta: { id, seed, clock: ft.Clock, place: ft.Place, date: day.date, step: day.step, w: day.w, h: day.h, view, frames: day.frames.map((f) => f.name) }, frames };
    }, { id, view, step, date });
    if (!pack) { console.log(`  #${id}  not minted, skipped`); continue; }
    let bytes = 0;
    for (const f of pack.frames) {
      const buf = Buffer.from(f.data, 'base64'); bytes += buf.length;
      fs.writeFileSync(path.join(OUT, `ml-${id}-${f.name}.jpg`), buf);
    }
    fs.writeFileSync(path.join(OUT, `ml-${id}.json`), JSON.stringify(pack.meta, null, 1) + '\n');
    console.log(`  #${id}  ${pack.meta.clock} · ${pack.meta.place}  ${pack.frames.length} frames  ${(bytes / 1e6).toFixed(1)} MB  ${((Date.now() - t0) / 1000).toFixed(0)} s  (${pack.meta.date})`);
  }
} finally {
  await browser.close();
  server.close();
}
