#!/usr/bin/env node
// Write the two single-file HTML versions of a token into dist/:
//   dist/marfa-light-standalone.html  three.js r124 and the engine inlined. Works
//                                     offline, opened straight from the disk.
//   dist/marfa-light-token.html       the engine inlined, three.js r124 from
//                                     cdnjs, the way Art Blocks serves a token.
// Both read ?hash=0x... from the address, or draw a random hash.
//   node tools/standalone.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const engineFile = fs.existsSync(path.join(ROOT, 'dist', 'marfa-light.min.js')) ? path.join(ROOT, 'dist', 'marfa-light.min.js') : path.join(ROOT, 'marfa-light.js');
const engine = fs.readFileSync(engineFile, 'utf8');
const threeFile = path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js');
if (!fs.existsSync(threeFile)) { console.error('three.js r124 is missing: run npm install'); process.exit(1); }
const three = fs.readFileSync(threeFile, 'utf8');
if (!/REVISION="124"/.test(three)) { console.error('node_modules/three is not r124'); process.exit(1); }
// a script body may not contain the closing tag
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

const HASH = `<script>
(function () {
  var q = new URLSearchParams(location.search), h = q.get('hash');
  if (!/^0x[0-9a-fA-F]{64}$/.test(h || '')) {
    var a = new Uint8Array(32); crypto.getRandomValues(a);
    h = '0x' + Array.prototype.map.call(a, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  window.tokenData = { hash: h, tokenId: q.get('id') || '0' };
})();
</script>`;
const HEAD = (title) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:#0d0d0d;overflow:hidden}</style>
</head>
<body>
<!--
  MARFA LIGHT (working title), v0.4. Michael Low (MLow). mlow.xyz
  Every token is a working clock for Marfa, Texas. Add ?hash=0x... (64 hex
  digits) to the address for a particular token; without one you get a random
  token each time. Keys: ? for all keys. P saves a still, G saves a GIF,
  Shift G saves the whole day as a GIF.
-->
`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const standalone = HEAD('Marfa Light') + HASH + '\n<script>\n' + safe(three) + '\n</script>\n<script>\n' + safe(engine) + '\n</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(ROOT, 'dist', 'marfa-light-standalone.html'), standalone);
const token = HEAD('Marfa Light token') + HASH + '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r124/three.min.js"></script>\n<script>\n' + safe(engine) + '\n</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(ROOT, 'dist', 'marfa-light-token.html'), token);
console.log('wrote dist/marfa-light-standalone.html', Math.round(standalone.length / 1024), 'KB (offline)');
console.log('wrote dist/marfa-light-token.html', Math.round(token.length / 1024), 'KB (three.js from cdnjs)');
