#!/usr/bin/env node
// Draw N hashes and report how every trait is distributed. Writes docs/TRAITS.md.
//   node tools/features.js [N]
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(process.env.MARFA_JS ? path.resolve(process.env.MARFA_JS) : path.join(ROOT, 'marfa-light.js'));
const L = globalThis.marfaLight, N = +(process.argv[2] || 2000);
const counts = {}, eggs = {};
let x = 317;
const hash = () => { let h = '0x'; for (let j = 0; j < 64; j++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; h += ((x >>> 16) & 15).toString(16); } return h; };
let eggTotal = 0;
for (let i = 0; i < N; i++) {
  const P = L.plan(hash());
  for (const [k, v] of Object.entries(P.features)) {
    if (k === 'Easter Eggs') continue;
    (counts[k] = counts[k] || {})[v] = (counts[k][v] || 0) + 1;
  }
  P.eggs.forEach((e) => { eggs[e] = (eggs[e] || 0) + 1; }); eggTotal += P.eggs.length;
}
let md = `# Traits\n\nDistribution over ${N} random hashes (\`node tools/features.js ${N}\`). Every token also carries 2 to 7 easter eggs (mean ${(eggTotal / N).toFixed(1)}).\n\n`;
md += `${Object.keys(L.clocks).length} clocks · ${Object.keys(L.places).length} places · ${Object.keys(L.eggs).length} easter eggs · ${Object.keys(L.films).length} film stocks.\n\n`;
const order = Object.keys(counts);
for (const k of order) {
  md += `## ${k}\n\n| Value | Share |\n|---|---|\n`;
  Object.entries(counts[k]).sort((a, b) => b[1] - a[1]).forEach(([v, c]) => { md += `| ${v} | ${(100 * c / N).toFixed(1)}% |\n`; });
  md += '\n';
}
md += `## Easter eggs\n\n| Egg | Appears in | Caption |\n|---|---|---|\n`;
Object.entries(eggs).sort((a, b) => b[1] - a[1]).forEach(([e, c]) => { md += `| ${e} | ${(100 * c / N).toFixed(1)}% | ${(L.eggs[e] && L.eggs[e].line) || ''} |\n`; });
if (process.env.MARFA_JS || N < 1000) console.log(md); else fs.writeFileSync(path.join(ROOT, 'docs', 'TRAITS.md'), md);
console.log(md.split('\n').slice(0, 6).join('\n'));
console.log('wrote docs/TRAITS.md');
