#!/usr/bin/env node
// Write docs/CATALOGUE.md straight from the registries: every clock with its
// materials and possible variations, every place, every easter egg.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'marfa-light.js'));
const L = globalThis.marfaLight;
let x = 99;
const rng = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
let md = '# Catalogue\n\nGenerated from the code by `node tools/docs.js`.\n\n## Clocks\n\n| Clock | Keeps time by | Materials | Variations |\n|---|---|---|---|\n';
for (const [name, d] of Object.entries(L.clocks)) {
  const vals = {};
  if (d.traits) for (let i = 0; i < 600; i++) { const t = d.traits(rng); for (const [k, v] of Object.entries(t)) (vals[k] = vals[k] || new Set()).add(v); }
  const vars = Object.entries(vals).map(([k, s]) => `**${k}**: ${[...s].join(', ')}`).join('<br>') || '';
  md += `| ${name} | ${d.keeps} | ${d.mats.join(', ')} | ${vars} |\n`;
}
md += '\n';
for (const [name, d] of Object.entries(L.clocks)) if (d.line) md += `- **${name}.** ${d.line}\n`;
md += '\n## Places\n\n| Place | Always brings |\n|---|---|\n';
for (const [name, d] of Object.entries(L.places)) md += `| ${name} | ${(d.eggs || []).join(', ')} |\n`;
md += '\n## Easter eggs\n\n| Egg | Caption |\n|---|---|\n';
for (const [name, d] of Object.entries(L.eggs)) md += `| ${name} | ${d.line || ''} |\n`;
md += '\n## Film stocks\n\n' + Object.keys(L.films).join(', ') + '\n';
// the generative layer: every token carries every one of these, whatever the clock
const gen = {};
for (let i = 0; i < 3000; i++) { let h = '0x'; for (let j = 0; j < 64; j++) h += Math.floor(rng() * 16).toString(16); const G = L.plan(h).gen.features; for (const [k, v] of Object.entries(G)) (gen[k] = gen[k] || new Set()).add(v); }
md += '\n## The generative layer\n\nEvery token carries all of these, drawn from their own stream of the hash, whatever the clock and place.\n\n| Trait | Values |\n|---|---|\n';
for (const [k, s] of Object.entries(gen)) md += `| ${k} | ${[...s].join(', ')} |\n`;
fs.writeFileSync(path.join(ROOT, 'docs', 'CATALOGUE.md'), md);
console.log('wrote docs/CATALOGUE.md:', Object.keys(L.clocks).length, 'clocks,', Object.keys(L.places).length, 'places,', Object.keys(L.eggs).length, 'eggs');
