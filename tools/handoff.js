#!/usr/bin/env node
// Assemble the handoff package: handoff/marfa-light-v<version>/ and a zip of it.
// Run after `npm run build`, `node tools/standalone.js` and the renders.
//   node tools/handoff.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'marfa-light.js'));
const L = globalThis.marfaLight, V = L.version;
const OUT = path.join(ROOT, 'handoff', 'marfa-light-v' + V);
fs.rmSync(OUT, { recursive: true, force: true });
function copy(from, to) {
  const s = path.join(ROOT, from), d = path.join(OUT, to || from);
  if (!fs.existsSync(s)) { console.log('  missing, skipped:', from); return; }
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.cpSync(s, d, { recursive: true, filter: (p) => !/\.DS_Store$|node_modules|\.agent/.test(p) });
}
// the page and the files, in the order someone new will want them
copy('handoff-README.md', 'README.md');
copy('dist/marfa-light-standalone.html', 'html/marfa-light-standalone.html');
copy('dist/marfa-light-token.html', 'html/marfa-light-token.html');
copy('site', 'html/site');
copy('marfa-light.js', 'engine/marfa-light.js');
copy('dist/marfa-light.min.js', 'engine/marfa-light.min.js');
['src', 'tools', 'docs', 'build.sh', 'package.json', 'package-lock.json', 'test.html', 'README.md', 'LICENSE', 'curated.json'].forEach((f) => copy(f, 'source/' + f));
copy('renders/v' + V, 'renders');
// stills go in as JPEG (the PNGs are about 3 MB each); macOS sips does the conversion
const rdir = path.join(OUT, 'renders');
if (fs.existsSync(rdir)) fs.readdirSync(rdir).filter((f) => f.endsWith('.png')).forEach((f) => {
  const src = path.join(rdir, f);
  try { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', src, '--out', src.replace(/\.png$/, '.jpg')], { stdio: 'ignore' }); fs.rmSync(src); }
  catch (e) { console.log('  kept as PNG (no sips):', f); }
});
copy('../job-hunter/applications/ArtBlocks-OpenSea-Residency.md', 'proposal/ArtBlocks-OpenSea-Residency.md');
// GLB: the clocks alone ride in the package; the whole scenes (about 630 MB) get a zip of their own
const glbSrc = path.join(ROOT, 'renders', 'v' + V, 'glb');
fs.rmSync(path.join(OUT, 'renders', 'glb'), { recursive: true, force: true });
if (fs.existsSync(glbSrc)) {
  const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'renders', 'v' + V + '-hashes.json'), 'utf8')).map((x) => x.name);
  const cl = path.join(OUT, 'glb', 'clocks'); fs.mkdirSync(cl, { recursive: true });
  names.forEach((n) => ['-clock.glb', '-clock.json'].forEach((e) => { const f = path.join(glbSrc, n + e); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(cl, n + e)); }));
  const sceneDir = path.join(ROOT, 'handoff', 'marfa-light-v' + V + '-glb-scenes');
  fs.rmSync(sceneDir, { recursive: true, force: true }); fs.mkdirSync(sceneDir, { recursive: true });
  names.forEach((n) => ['.glb', '.json'].forEach((e) => { const f = path.join(glbSrc, n + e); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(sceneDir, n + e)); }));
  const sz = sceneDir + '.zip'; fs.rmSync(sz, { force: true });
  execFileSync('zip', ['-rqX', path.basename(sz), path.basename(sceneDir)], { cwd: path.dirname(sceneDir) });
  fs.rmSync(sceneDir, { recursive: true, force: true });
  console.log('wrote', path.relative(ROOT, sz), Math.round(fs.statSync(sz).size / 1048576), 'MB');
}
// counts, for the README to quote
const counts = { version: V, clocks: Object.keys(L.clocks).length, places: Object.keys(L.places).length, eggs: Object.keys(L.eggs).length, films: Object.keys(L.films).length };
fs.writeFileSync(path.join(OUT, 'counts.json'), JSON.stringify(counts, null, 2) + '\n');
const zip = OUT + '.zip';
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-rqX', path.basename(zip), path.basename(OUT)], { cwd: path.dirname(OUT) });
console.log('wrote', path.relative(ROOT, OUT), 'and', path.relative(ROOT, zip), Math.round(fs.statSync(zip).size / 1048576 * 10) / 10, 'MB');
console.log(counts);
