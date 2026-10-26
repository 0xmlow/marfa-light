// Ask OpenSea to re-read metadata for tokens whose real GIF is now published.
//
//   node tools/opensea-refresh.mjs --address 0x.. [--ids 55,56] [--init 0-68] [--headed]
//
// Why: OpenSea fetches a token's image within minutes of the mint. If that happens before
// thumbs.mjs has rendered and published the day GIF, OpenSea caches the 6.7 KB "developing"
// placeholder and never looks again. ABX's own refresh has no OpenSea step for Ethereum and the
// OpenSea API needs a key, so this opens each item page in Chrome and presses OpenSea's own
// "Refresh Metadata" (no sign-in needed). State: thumbs/opensea-1-<addr>.json {id: ISO time}.
// It only refreshes ids that thumbs.mjs rendered AND whose GIF the onchain image URL
// (GitHub Pages) already serves at full size, so a refresh never re-caches the placeholder.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : undefined; };
const has = (k) => process.argv.includes('--' + k);
const address = (arg('address') || '').toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(address)) { console.error('usage: node tools/opensea-refresh.mjs --address 0x.. [--ids 1,2] [--init 0-68] [--headed]'); process.exit(1); }
const range = (s) => s.split(',').flatMap(p => { const [a, b] = p.split('-').map(Number); return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i); });

const thumbsFile = path.join(ROOT, 'thumbs', `1-${address}.json`);
const stateFile = path.join(ROOT, 'thumbs', `opensea-1-${address}.json`);
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 1) + '\n');

if (arg('init')) { for (const id of range(arg('init'))) state[id] ??= 'init'; save(); console.log(`marked ${arg('init')} as already refreshed`); process.exit(0); }

const rendered = fs.existsSync(thumbsFile) ? Object.keys(JSON.parse(fs.readFileSync(thumbsFile, 'utf8'))).map(Number) : [];
// A first refresh can still catch the placeholder (GitHub Pages' CDN keeps serving it for a few
// minutes after a publish; #72 and #74 stuck that way on Oct 23), so every id is refreshed a
// second time 30+ minutes after the first. Second refreshes are stored as "twice:<ISO time>".
const due = (v) => v === undefined || (/^\d{4}-/.test(v) && Date.now() - Date.parse(v) > 30 * 60 * 1000);
const want = arg('ids') ? range(arg('ids')) : rendered.filter(id => due(state[id])).sort((a, b) => a - b);
if (!want.length) { console.log('opensea: nothing to refresh'); process.exit(0); }

// only once the URL OpenSea reads (the onchain url-template on GitHub Pages) serves the real GIF
const ready = [];
for (const id of want) {
  const r = await fetch(`https://0xmlow.github.io/marfa-light/tokens/1/${id}.gif?v=${Date.now()}`, { method: 'HEAD' }).catch(() => null);
  const len = Number(r?.headers.get('content-length') || 0);
  if (r?.ok && len > 100000) ready.push(id); else console.log(`opensea: #${id} not live on GitHub Pages yet (${len} bytes), next run`);
}
if (!ready.length) process.exit(0);

const CLICK = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const find = () => [...document.querySelectorAll('button[aria-haspopup="menu"]')].find(b => { const r = b.getBoundingClientRect(); return r.y > 80 && r.y < 400 && r.x > 300; });
  let btn = null; for (let i = 0; i < 60 && !btn; i++) { btn = find(); if (!btn) await sleep(500); }
  const fire = (el) => { const r = el.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: 'mouse', button: 0 };
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(t.startsWith('pointer') ? new PointerEvent(t, o) : new MouseEvent(t, o)); };
  if (!btn) return 'no menu button';
  fire(btn);
  let item = null; for (let i = 0; i < 15 && !item; i++) { await sleep(200); item = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent.trim() === 'Refresh Metadata'); }
  if (!item) return 'menu did not open';
  fire(item.closest('[role="menuitem"]') || item);
  for (let i = 0; i < 25; i++) { await sleep(200); if (/queued this item/.test(document.body.innerText)) return 'queued'; }
  return 'no confirmation';
})()`;

const browser = await chromium.launch({
  headless: !has('headed'),
  executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
let ok = 0;
for (const id of ready) {
  try {
    await page.goto(`https://opensea.io/item/ethereum/${address}/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    let res = '';
    for (let t = 0; t < 3 && res !== 'queued'; t++) { if (t) { await page.keyboard.press('Escape'); await page.waitForTimeout(2000); } res = await page.evaluate(CLICK); }
    console.log(`opensea: #${id} ${res}`);
    if (res === 'queued') { state[id] = (state[id] && !arg('ids') ? 'twice:' : '') + new Date().toISOString(); ok++; save(); }
  } catch (e) { console.log(`opensea: #${id} failed: ${e.message.split('\n')[0]}`); }
}
await browser.close();
console.log(`opensea: refreshed ${ok} of ${ready.length}`);
