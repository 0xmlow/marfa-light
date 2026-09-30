#!/usr/bin/env node
// The complete handoff: every page, the engine, all the code, renders, films,
// 3D models and the proposal, in one organized folder and a zip of it.
//   node tools/package.js          (npm run package)
// Run after `npm run build`, `npm run standalone`, the renders, and
// `sh tools/proposal-assets.sh`. Writes handoff/marfa-light-v<version>-complete/.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'marfa-light.js'));
const L = globalThis.marfaLight, V = L.version;
const NAME = 'marfa-light-v' + V + '-complete';
const OUT = path.join(ROOT, 'handoff', NAME);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const SKIP = /(^|\/)(\.DS_Store|node_modules|\.agent|\.claude)(\/|$)/;
function copy(from, to, filter) {
  const s = path.join(ROOT, from), d = path.join(OUT, to);
  if (!fs.existsSync(s)) { console.log('  missing, skipped:', from); return; }
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.cpSync(s, d, { recursive: true, filter: (p) => !SKIP.test(p) && (!filter || filter(p)) });
}
function write(to, text) { const d = path.join(OUT, to); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, text); }
function jpeg(src, dst, q) { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), src, '--out', dst], { stdio: 'ignore' }); }

// the pages
copy('dist/marfa-light-standalone.html', 'open-me/marfa-light-standalone.html');
copy('dist/marfa-light-token.html', 'open-me/marfa-light-token.html');

// the proposal site: the published page has no doctype (the host wraps it), so the copy here gets one
copy('proposal-site', 'site-proposal');
const idx = path.join(OUT, 'site-proposal', 'index.html');
fs.writeFileSync(idx, '<!doctype html>\n<html lang="en">\n<head>\n' + fs.readFileSync(idx, 'utf8').replace('<header class="bar">', '</head>\n<body>\n<header class="bar">') + '\n</body>\n</html>\n');
const serve = '#!/bin/sh\n# Double-click to serve this folder, then open the page.\ncd "$(dirname "$0")"\n(sleep 1; open http://localhost:8318/) &\npython3 -m http.server 8318\n';
write('site-proposal/serve.command', serve); fs.chmodSync(path.join(OUT, 'site-proposal/serve.command'), 0o755);
copy('site', 'site-gallery');
write('site-gallery/serve.command', serve.replace(/8318/g, '8317')); fs.chmodSync(path.join(OUT, 'site-gallery/serve.command'), 0o755);

// the engine
copy('marfa-light.js', 'engine/marfa-light.js');
copy('dist/marfa-light.min.js', 'engine/marfa-light.min.js');

// all the code, arranged the way the repo is, so `npm install && npm run build` works inside source/
['src', 'tools', 'docs', 'build.sh', 'package.json', 'package-lock.json', 'README.md', 'LICENSE', '.gitignore', 'handoff-README.md', 'package-README.md', 'handoff-links.md',
 'test.html', 'token.html', 'live.html', 'still.html', 'sheet.html', 'curated.html', 'curated.json'].forEach((f) => copy(f, 'source/' + f));
copy('proposal-site/index.html', 'source/proposal-site/index.html');
// the motion reel: code and assets only (frames and tests are rebuilt by `npm run reel`)
['core.js', 'scenes.js', 'reel.html', 'reel2.html', 'reel2.js', 'render.js', 'score.py', 'assets'].forEach((f) => copy('reel/' + f, 'source/reel/' + f));

// renders: stills as JPEG, the GIFs, contact sheets
const stills = path.join(ROOT, 'renders', 'v' + V), sd = path.join(OUT, 'renders', 'stills');
fs.mkdirSync(sd, { recursive: true });
fs.readdirSync(stills).filter((f) => f.endsWith('.png')).forEach((f) => jpeg(path.join(stills, f), path.join(sd, f.replace(/\.png$/, '.jpg')), 88));
copy('renders/v' + V + '/gifs', 'renders/gifs');
copy('renders/v' + V + '/contact-sheet.jpg', 'renders/sheets/contact-sheet.jpg');
copy('renders/v' + V + '/glb-clocks-sheet.jpg', 'renders/sheets/glb-clocks-sheet.jpg');
copy('renders/hype/shots-sheet.jpg', 'renders/sheets/film-shots-sheet.jpg');
copy('renders/v' + V + '-hashes.json', 'renders/hashes.json');

// films at web size (the full-resolution masters stay in renders/hype and reel/out)
copy('renders/web/marfa-light-film-web.mp4', 'film/marfa-light-film-16x9.mp4');
copy('renders/web/marfa-light-film-vertical-web.mp4', 'film/marfa-light-film-9x16.mp4');
copy('renders/web/mlow-motion-reel-web.mp4', 'film/mlow-motion-reel.mp4');
copy('proposal-site/img/film-poster.jpg', 'film/marfa-light-film-poster.jpg');

// 3D: the clocks alone (the whole scenes zip separately; see the README)
const glbSrc = path.join(ROOT, 'renders', 'v' + V, 'glb');
if (fs.existsSync(glbSrc)) {
  const cl = path.join(OUT, 'glb', 'clocks'); fs.mkdirSync(cl, { recursive: true });
  // by name from the hashes list: a scene whose name ends in "clock" (water-clock.glb) is not a clock model
  const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'renders', 'v' + V + '-hashes.json'), 'utf8')).map((x) => x.name);
  names.forEach((n) => ['-clock.glb', '-clock.json'].forEach((e) => { const f = path.join(glbSrc, n + e); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(cl, n + e)); }));
}

// the proposal
copy('../job-hunter/applications/ArtBlocks-OpenSea-Residency.md', 'proposal/ArtBlocks-OpenSea-Residency.md');
copy('handoff-links.md', 'proposal/LINKS.md');

// counts, straight from the code
const counts = { version: V, clocks: Object.keys(L.clocks).length, places: Object.keys(L.places).length, eggs: Object.keys(L.eggs).length, films: Object.keys(L.films).length, views: L.views.length };
write('counts.json', JSON.stringify(counts, null, 2) + '\n');
copy('package-README.md', 'README.md');

// a manifest of every file and its size
function walk(dir, rel, out) {
  fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
    const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(p, r, out); else out.push([r, fs.statSync(p).size]);
  });
  return out;
}
const files = walk(OUT, '', []), total = files.reduce((a, f) => a + f[1], 0);
const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const groups = {};
files.forEach((f) => { const g = f[0].includes('/') ? f[0].split('/')[0] : '(top)'; (groups[g] = groups[g] || []).push(f); });
let man = '# Manifest\n\n' + files.length + ' files, ' + kb(total) + ' before zipping. Generated by `tools/package.js`.\n\n| Folder | Files | Size |\n|---|---:|---:|\n';
Object.keys(groups).forEach((g) => { man += '| `' + g + '` | ' + groups[g].length + ' | ' + kb(groups[g].reduce((a, f) => a + f[1], 0)) + ' |\n'; });
man += '\n## Every file\n\n```\n' + files.map((f) => f[0].padEnd(72) + ' ' + kb(f[1])).join('\n') + '\n```\n';
write('MANIFEST.md', man);

const zip = OUT + '.zip';
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-rqX', path.basename(zip), path.basename(OUT)], { cwd: path.dirname(OUT) });
console.log('wrote', path.relative(ROOT, OUT), '(' + files.length + ' files, ' + kb(total) + ')');
console.log('wrote', path.relative(ROOT, zip), kb(fs.statSync(zip).size));
console.log(counts);
