// Marketplace thumbnails and traits for minted Marfa Light tokens, rendered here on the GPU.
//
//   node tools/thumbs.mjs --chain ethereum --address 0x.. --from-block N [--date 2026-10-06] [--ids 0,1,2] [--force]
//                         [--placeholders 111] [--no-push]
//
// For every minted token without a GIF (or --ids / --force), opens its real ABX live view, steps the
// clock to --date (Marfa time), presses Shift+G for the 24-hour day GIF, and saves it to
// proposal-site/tokens/<chainId>/<id>.gif with its traits in thumbs/<chainId>-<address>.json.
// Then publishes the site, hands every token's traits to the ABX resolver (abx add --attributes),
// and prints the marketplace refresh links. The contract's collection image is a url-template that
// points at these files, so nothing here sends a transaction.
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const flag = (k) => argv.includes('--' + k);
const CHAINS = { ethereum: 1, sepolia: 11155111 };
const chain = arg('chain'), address = arg('address'), fromBlock = arg('from-block');
const date = arg('date', '2026-10-06');
if (!CHAINS[chain] || !/^0x[0-9a-fA-F]{40}$/.test(address || '') || !fromBlock) {
  console.error('usage: node tools/thumbs.mjs --chain ethereum|sepolia --address 0x.. --from-block N [--date YYYY-MM-DD] [--ids 0,1] [--force] [--no-push]');
  process.exit(1);
}
const chainId = CHAINS[chain];
const ABX = path.join(ROOT, 'node_modules/.bin/abx');
const env = { ...process.env, ABX_CHAIN: chain, ABX_NO_UPDATE_CHECK: '1' };
const abx = (...a) => execFileSync(ABX, a, { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const outDir = path.join(ROOT, 'proposal-site/tokens', String(chainId));
const traitsFile = path.join(ROOT, 'thumbs', `${chainId}-${address.toLowerCase()}.json`);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(traitsFile), { recursive: true });
const traits = fs.existsSync(traitsFile) ? JSON.parse(fs.readFileSync(traitsFile, 'utf8')) : {};

// minted ids, straight from the contract
const minted = JSON.parse(abx('tokens', address, '--json')).tokens.map((t) => String(t.tokenId));
let ids = arg('ids') ? arg('ids').split(',').map((s) => s.trim()) : minted;
ids = ids.filter((id) => minted.includes(id));
if (!flag('force') && !arg('ids')) ids = ids.filter((id) => !traits[id] || !fs.existsSync(path.join(outDir, id + '.gif')));
console.log(`${minted.length} minted · rendering ${ids.length}: ${ids.join(', ') || 'none'} · day ${date}`);

if (ids.length) {
  const [y, m, d] = date.split('-').map(Number);
  const live = `https://resolver.abx.io/a/${chainId}/${address.toLowerCase()}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  for (const id of ids) {
    const t0 = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.goto(`${live}/${id}`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction('window.abx && window.abx.__done === true', undefined, { timeout: 180000 });
    // step whole days from today (Marfa time) to the fixed date
    const shift = await page.evaluate(([y, m, d]) => {
      const now = window.marfaLight.marfaTime(Date.now() / 1000);
      return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.y, now.mo - 1, now.d)) / 86400000);
    }, [y, m, d]);
    for (let i = 0; i < Math.abs(shift); i++) await page.keyboard.press(shift > 0 ? '.' : ',');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 600000 }), page.keyboard.press('Shift+G')]);
    await dl.saveAs(path.join(outDir, id + '.gif'));
    const tt = await page.evaluate(() => window.abx.__traits);
    traits[id] = Object.entries(tt).map(([trait_type, value]) => ({ trait_type, value }));
    fs.writeFileSync(traitsFile, JSON.stringify(traits, null, 1));
    const mb = (fs.statSync(path.join(outDir, id + '.gif')).size / 1e6).toFixed(1);
    console.log(`  #${id}  ${mb} MB  ${traits[id].length} traits  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await ctx.close();
  }
  await browser.close();
}

// --placeholders N: every id below N without a GIF shows tokens/developing.gif until its render lands
let held = 0;
if (arg('placeholders')) {
  for (let i = 0; i < Number(arg('placeholders')); i++) {
    const f = path.join(outDir, i + '.gif');
    if (!fs.existsSync(f)) { fs.copyFileSync(path.join(ROOT, 'proposal-site/tokens/developing.gif'), f); held++; }
  }
  console.log(`${held} placeholder(s) written`);
}

if (!flag('no-push') && (ids.length || held)) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'inherit' });
  git('add', outDir, path.join(ROOT, 'proposal-site/tokens/developing.gif'), ...(fs.existsSync(traitsFile) ? [traitsFile] : []));
  git('commit', '-q', '-m', `Token thumbnails: chain ${chainId}, ${ids.length} rendered, ${held} placeholder(s)`);
  execFileSync('npm', ['run', 'publish:site'], { cwd: ROOT, stdio: 'inherit' });
}
if (Object.keys(traits).length) {
  console.log('traits → ABX resolver');
  abx('add', address, '--remote', 'abx', '--from-block', String(fromBlock), '--attributes', traitsFile);
}
console.log(`done. GIFs: https://0xmlow.github.io/marfa-light/tokens/${chainId}/<id>.gif (Pages takes a minute or two)`);
if (ids.length) console.log(abx('refresh', address, '--token', ids[0]).trim());
