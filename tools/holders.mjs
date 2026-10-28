#!/usr/bin/env node
// Builds proposal-site/data/holders.json: the mint count read from the chain, every token's owner,
// and a name, X handle and picture for each holder.
//
//   node tools/holders.mjs            (then python3 tools/holders-media.py for pictures and stills)
//
// Who is who comes from, in order: the CRM one-per-person sheet (name, X, ENS), the NEW YORKERS
// honoraries (a holder with an honorary portrait shows it as their picture), then ENS (reverse name,
// avatar and com.twitter). Anyone left is shown by short address. The page re-reads owners live, so
// this file only has to be right about identities; counts here are a snapshot for first paint.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, fallback, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = '0x4504570d25b710942BeE78b7Ff5720950c1FC02D';
const MINTER = '0xfb5C61274a3A7dA83CcDD88DdEC914438244E2c9';
const ARTIST = '0xa8357ee17cb3ff5a6b9694ddc8fde0ed2ce9d788';
const CRM = path.resolve(ROOT, '../crm/wallets-master-one-per-person-2026-10-22.csv');
const HON = '/Users/degens/Desktop/NEW YORKERS BY MLOW/NEW YORKERS SITE/_build/honoraries/honoraries.json';
const OUT = path.join(ROOT, 'proposal-site/data/holders.json');
const TRAITS = path.join(ROOT, 'thumbs/1-' + TOKEN.toLowerCase() + '.json');

const pub = createPublicClient({ chain: mainnet, batch: { multicall: true }, transport: fallback([
  'https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://rpc.mevblocker.io'].map(u => http(u))) });

const tokenAbi = parseAbi(['function totalSupply() view returns (uint256)', 'function maxInvocations() view returns (uint256)',
  'function ownerOf(uint256) view returns (address)']);
const minterAbi = parseAbi(['function sales(address) view returns (bool, address, uint256, uint256, uint256)']);

// --- identities we already know -------------------------------------------------------------
function csv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows; return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])));
}
const known = new Map();
if (fs.existsSync(CRM)) for (const r of csv(fs.readFileSync(CRM, 'utf8')))
  known.set(r.wallet.toLowerCase(), { name: r.name, x: r.x.replace(/^@/, ''), ens: r.ens });
known.set(ARTIST, { name: 'MLow', x: 'degens', ens: 'mlow.eth', artist: true });
// the hourly launchd clone cannot read ~/Documents or ~/Desktop (TCC), so the last build is the cache
const cache = new Map();
if (fs.existsSync(OUT)) for (const h of JSON.parse(fs.readFileSync(OUT, 'utf8')).holders || []) cache.set(h.address, h);

// honorary portraits: matched by X handle, then by name
let people = [];
if (fs.existsSync(HON)) people = JSON.parse(fs.readFileSync(HON, 'utf8')).people;
const byX = new Map(people.filter(p => p.x).map(p => [p.x.toLowerCase(), p]));
const byName = new Map(people.map(p => [p.name.toLowerCase(), p]));
// wallets whose honorary sits under another name or has no X handle to match (2026-10-28: wave 44 painted every
// holder without one; OGtheartist is OGtheperson and 6529 Museum shows Punk6529's, both by MLow)
const byId = new Map(people.map(p => [p.id, p]));
const BY_WALLET = {
  '0x9128233a0e77dca38c5abc0810bcfb3663120123': 'og', '0xc6400a5584db71e41b0e5dfbdc769b54b91256cd': 'punk6529',
  '0xce723e6912ff14b7f5db305eb3c3091b50b308e6': 'jared-poz', '0x9379304ddb2d837ce1cbc6ad2d980c37c415d0c1': 'self6967',
  '0xfc3c962fad2c1cc77f1a0d46e7b8a2de79a21774': 'rhynot', '0x63a9dbce75413036b2b778e670aabd4493aaf9f3': 'natealex',
  '0x8c48b40dba656187896147089545439e4ff4a01c': 'thetexican', '0x8a471928c2f417b5a5fdffbc15a5ba3d37bbe3f3': 'refinator',
  '0x2da40ce78682262d8024c76f614490c73b174340': 'davus', '0x207b3c1083a62e282d375a11f52730879cbfbbbb': 'silversurfer888',
  '0xaf785066250a0614a3154fa12ab9b2347d97f6b8': 'dorkian', '0x0f0eae91990140c560d4156db4f00c854dc8f09e': 'vvd',
  '0xd4f11b5f55c20fc71c4d533d1d4c1106747a9772': 'drcco', '0x79a2b7a14f5b1a661a98694974f630c403a8cf45': 'matto',
  '0x2c81cee7050c9d03295560851ffde123bdf9696a': 'ddaavvee', '0xafcd6e3d6b8e87722ed8d5a598e811672a462a9d': 'visavi',
  '0x9df947cd8a9810964473339c38a95201ecbe112d': 'jdh', '0xd4100a2e1aacdeb18bcda92a280124a7111a12b6': 'shwig',
  '0x5a5617ba16beba3d04ae3c6b1e9d522c1856763c': 'talmadge', '0xb88f61e6fbda83fbfffabe364112137480398018': 'flamingo-dao',
  '0xdd19308a9731cdecb67e0d80ca6823394208c045': 'ab500-dao', '0x29de97ea67bac92300157b40b81e3a3ccbe24d50': 'artcollectorrr',
};
const honorary = (who, addr) => byId.get(BY_WALLET[addr]) || (who.x && byX.get(who.x.toLowerCase())) || byName.get((who.name || '').toLowerCase()) || null;

// --- the chain ------------------------------------------------------------------------------
const [supply, max, sale] = await Promise.all([
  pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'totalSupply' }),
  pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'maxInvocations' }),
  pub.readContract({ address: MINTER, abi: minterAbi, functionName: 'sales', args: [TOKEN] })]);
const n = Number(supply);
const owners = await Promise.all(Array.from({ length: n }, (_, id) =>
  pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'ownerOf', args: [BigInt(id)] }).then(a => a.toLowerCase())));

const traits = fs.existsSync(TRAITS) ? JSON.parse(fs.readFileSync(TRAITS, 'utf8')) : {};
const trait = (id, k) => (traits[id] || []).find(t => t.trait_type === k)?.value || null;
const tokens = owners.map((owner, id) => ({ id, owner, clock: trait(id, 'Clock'), place: trait(id, 'Place'), rendered: !!traits[id] }));

// --- holders --------------------------------------------------------------------------------
const group = new Map();
for (const t of tokens) { if (!group.has(t.owner)) group.set(t.owner, []); group.get(t.owner).push(t.id); }

async function ens(addr) {
  const out = {};
  try { out.ens = await pub.getEnsName({ address: addr }); } catch {}
  if (!out.ens) return out;
  try { out.avatar = await pub.getEnsAvatar({ name: normalize(out.ens) }); } catch {}
  try { out.x = await pub.getEnsText({ name: normalize(out.ens), key: 'com.twitter' }); } catch {}
  return out;
}

const holders = [];
for (const [address, ids] of group) {
  const was = cache.get(address);
  const who = { ...(known.get(address) || (was ? { name: was.name, x: was.x, ens: was.ens, artist: was.artist } : {})) };
  const chain = await ens(address);
  who.ens = who.ens || chain.ens || '';
  who.x = (who.x || chain.x || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, '');
  const h = honorary(who, address);
  const work = h?.works?.[0];
  // ENS avatars: keep http(s) and small inline images, drop ipfs/nft URIs the browser cannot show
  if (chain.avatar && !/^https:\/\//.test(chain.avatar) && !(chain.avatar.startsWith('data:image') && chain.avatar.length < 30000)) chain.avatar = '';
  holders.push({
    address, ids, count: ids.length,
    name: who.name || who.ens || '',
    x: who.x || '', ens: who.ens || '', artist: !!who.artist,
    honorary: h ? { id: h.id, title: work?.title || '', src: work?.s || '', url: 'https://n3wyorkers.com/h/' + h.id } : (was?.honorary || null),
    avatar: chain.avatar || was?.avatar || '',
  });
  process.stdout.write('.');
}
console.log();
// most pieces first; ties go to whoever collected first
holders.sort((a, b) => b.count - a.count || Math.min(...a.ids) - Math.min(...b.ids));

const data = {
  updated: new Date().toISOString(), chainId: 1, token: TOKEN, minter: MINTER,
  supply: n, max: Number(max), available: Number(max) - n,
  sale: { price: sale[2].toString(), allocation: Number(sale[3]), sold: Number(sale[4]) },
  tokens, holders,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
console.log(`${n} / ${max} minted, ${data.available} left, ${holders.length} holders, ${holders.filter(h => h.honorary).length} with an honorary portrait → ${path.relative(ROOT, OUT)}`);
