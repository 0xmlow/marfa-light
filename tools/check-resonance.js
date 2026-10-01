// Determinism, submitted-feature preservation, and meaningful variation.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
function engine(p) { const c = {console}; vm.runInNewContext(fs.readFileSync(p,'utf8'),c); return c.marfaLight; }
const old = engine('proposal-site/studies/submitted-v0.8.js'), next = engine('marfa-light.js');
let x=317, count=1000, sums=0, samples=[], values={};
function hash(){let h='0x';for(let j=0;j<64;j++){x=(Math.imul(x,1664525)+1013904223)>>>0;h+=((x>>>16)&15).toString(16);}return h;}
for(let i=0;i<count;i++){
 const h=hash(), a=old.plan(h),b=next.plan(h);
 assert.equal(JSON.stringify(b),JSON.stringify(next.plan(h)), 'nondeterministic plan');
 for(const k of Object.keys(a.features).filter(k=>!['Label Tie','Bloom Tint'].includes(k))) assert.equal(b.features[k],a.features[k],h+' changed '+k);
 assert.equal(b.align.utc,a.align.utc); assert(Number.isFinite(b.resonance.pitch));
 sums+=Object.keys(b.features).length;
 for(const [k,v] of Object.entries(b.resonance.features)){(values[k]||=(new Set())).add(v);}
 if(i<6) samples.push({hash:h,name:'Ordinary '+(i+1),hour:18.5,pattern:b.resonance.pattern});
}
assert.equal(values['Landscape Score'].size,6);
fs.writeFileSync('proposal-site/studies/seeds.json',JSON.stringify(samples,null,2));
console.log(JSON.stringify({hashes:count,unchangedCoreSelections:true,meanTraits:sums/count,newTraitNames:Object.keys(values).length,values:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,[...v]]))},null,2));
