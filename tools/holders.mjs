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
const honorary = (who) => (who.x && byX.get(who.x.toLowerCase())) || byName.get((who.name || '').toLowerCase()) || null;

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
  const h = honorary(who);
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
