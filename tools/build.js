#!/usr/bin/env node
// Cross-platform build: concatenates src/*.js into dist-ready marfa-light.js
//   node tools/build.js            -> marfa-light.js and site/marfa-light.js
//   node tools/build.js out.js     -> out.js only
//   node tools/build.js out.js a.js b.js  -> out.js with extra source files merged
//     into src/ by file name (for work in progress that is not in src/ yet)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const head = fs.readFileSync(path.join(ROOT, 'build.sh'), 'utf8').split("<<'HEAD'\n")[1].split('\nHEAD\n')[0];
const extra = process.argv.slice(3).map((f) => path.resolve(f));
const files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'src', f))
  .concat(extra).sort((a, b) => path.basename(a) < path.basename(b) ? -1 : 1);
let out = head + '\n';
for (const f of files) out += fs.readFileSync(f, 'utf8') + '\n';
out += '})(typeof window !== "undefined" ? window : globalThis);\n';
const dest = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'marfa-light.js');
fs.writeFileSync(dest, out);
if (!process.argv[2]) fs.copyFileSync(dest, path.join(ROOT, 'site', 'marfa-light.js'));
console.log('wrote', path.relative(ROOT, dest), out.length, 'bytes from', files.length, 'files');
// the onchain build: minified with terser when it is installed (npm install)
if (!process.argv[2]) {
  try {
    const { execFileSync } = require('child_process');
    fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
    // Every line stays under ABX's 22 KB chunk size: its onchain generator joins chunks with a
    // newline, so a chunk boundary inside one long line could split a token in two. Terser wraps
    // code; the relic base64 arrays are broken between items, which is always safe.
    const min = path.join(ROOT, 'dist', 'marfa-light.min.js');
    execFileSync(path.join(ROOT, 'node_modules', '.bin', 'terser'), [dest, '-c', 'passes=2', '-m', '-f', 'max_line_len=16000', '--comments', '/MARFA LIGHT/', '-o', min]);
    fs.writeFileSync(min, fs.readFileSync(min, 'utf8').split('\n').map((l) => l.length > 16000
      ? l.replace(/([A-Za-z0-9+\/=]{1000})","(?=[A-Za-z0-9+\/=]{1000})/g, '$1",\n"') : l).join('\n'));
    console.log('wrote dist/marfa-light.min.js', fs.statSync(path.join(ROOT, 'dist', 'marfa-light.min.js')).size, 'bytes');
  } catch (e) { console.log('skipped the minified build (run npm install for terser)'); }
}
