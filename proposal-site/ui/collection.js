// The collection, read from Ethereum: how many are minted, how many are left, who holds which.
// First paint comes from data/holders.json (built hourly by tools/holders.mjs, with names, X handles
// and pictures); then the page asks the chain itself, so the counts and owners are never stale.
//
//   import { loadCollection, renderDial, renderFaces, renderBoard, renderWall } from './ui/collection.js';
//   const col = await loadCollection({ base: '' , onUpdate: c => ... });
import { createPublicClient, fallback, http, parseAbi } from 'https://cdn.jsdelivr.net/npm/viem@2.21.0/+esm';
import { mainnet } from 'https://cdn.jsdelivr.net/npm/viem@2.21.0/chains/+esm';

export const TOKEN = '0x4504570d25b710942BeE78b7Ff5720950c1FC02D';
export const MINTER = '0xfb5C61274a3A7dA83CcDD88DdEC914438244E2c9';
const RPC = ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://rpc.mevblocker.io'];
const tokenAbi = parseAbi(['function totalSupply() view returns (uint256)', 'function maxInvocations() view returns (uint256)', 'function ownerOf(uint256) view returns (address)']);
const minterAbi = parseAbi(['function sales(address) view returns (bool, address, uint256, uint256, uint256)']);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
export const liveUrl = (id) => 'https://resolver.abx.io/a/1/' + TOKEN.toLowerCase() + '/' + id;
export const openseaUrl = (id) => 'https://opensea.io/item/ethereum/' + TOKEN.toLowerCase() + '/' + id;

// group tokens by owner, carrying over every identity the snapshot knows
function regroup(col) {
  const known = new Map(col.holders.map((h) => [h.address, h]));
  const by = new Map();
  for (const t of col.tokens) {
    if (!by.has(t.owner)) {
      const k = known.get(t.owner);
      by.set(t.owner, { address: t.owner, name: k?.name || '', x: k?.x || '', ens: k?.ens || '', artist: !!k?.artist, honorary: k?.honorary || null, avatar: k?.avatar || '', ids: [] });
    }
    by.get(t.owner).ids.push(t.id);
  }
  col.holders = [...by.values()].map((h) => ({ ...h, count: h.ids.length }))
    .sort((a, b) => b.count - a.count || Math.min(...a.ids) - Math.min(...b.ids));
  col.byOwner = by;
}

export async function loadCollection({ base = '', onUpdate = () => {}, live = true } = {}) {
  const col = await fetch(base + 'data/holders.json', { cache: 'no-cache' }).then((r) => r.json());
  col.base = base;
  regroup(col); onUpdate(col);
  if (!live) return col;
  const pub = createPublicClient({ chain: mainnet, batch: { multicall: true }, transport: fallback(RPC.map((u) => http(u))) });
  async function sync() {
    const [ts, mx, s] = await Promise.all([
      pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'totalSupply' }),
      pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'maxInvocations' }),
      pub.readContract({ address: MINTER, abi: minterAbi, functionName: 'sales', args: [TOKEN] })]);
    const n = Number(ts);
    const owners = await Promise.all(Array.from({ length: n }, (_, id) =>
      pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'ownerOf', args: [BigInt(id)] }).then((a) => a.toLowerCase())));
    const old = new Map(col.tokens.map((t) => [t.id, t]));
    col.tokens = owners.map((owner, id) => ({ ...(old.get(id) || { id, clock: null, place: null, rendered: false }), owner }));
    col.supply = n; col.max = Number(mx); col.available = col.max - n;
    col.sale = { price: s[2].toString(), allocation: Number(s[3]), sold: Number(s[4]) };
    col.live = true; regroup(col); onUpdate(col);
  }
  sync().catch((e) => console.warn('chain read failed, showing the snapshot', e));
  setInterval(() => { if (!document.hidden) sync().catch(() => {}); }, 60000);
  return col;
}

// ---------- pictures ----------
export function still(col, id) {
  const t = col.tokens[id];
  return col.base + (t && t.rendered ? 'tokens/1/s/' + id + '.jpg' : 'tokens/developing.gif');
}
export function pfp(col, h) {
  if (h.honorary) return col.base + 'holders/pfp/' + h.honorary.id + '.jpg';
  if (h.avatar) return h.avatar;
  if (h.x) return 'https://unavatar.io/x/' + encodeURIComponent(h.x) + '?fallback=false';
  return '';
}
// no picture: a disc lit in two colours taken from the address, like a sun on the horizon
function sigil(addr) {
  const a = parseInt(addr.slice(2, 8), 16), b = parseInt(addr.slice(-6), 16);
  const h1 = a % 360, h2 = (h1 + 40 + (b % 80)) % 360;
  return `background:radial-gradient(circle at 50% 62%, hsl(${h1} 70% 72%) 0 30%, transparent 31%), linear-gradient(180deg, hsl(${h2} 35% 30%), hsl(${h1} 45% 55%))`;
}
export const nameOf = (h) => h.name || h.ens || short(h.address);
function avatar(col, h, cls = 'cx-av') {
  const src = pfp(col, h);
  const fallbackStyle = sigil(h.address);
  return `<span class="${cls}" style="${fallbackStyle}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}

// ---------- the edition dial: 111 hour ticks, the minted ones in brass ----------
export function renderDial(el, col) {
  const R1 = 158, R2 = 186, C = 200, max = col.max || 111;
  const owner = new Map(col.tokens.map((t) => [t.id, t.owner]));
  let ticks = '';
  for (let i = 0; i < max; i++) {
    const a = (i / max) * Math.PI * 2 - Math.PI / 2;
    const minted = i < col.supply, major = i % 10 === 0;
    const r1 = minted ? R1 - 8 : (major ? R1 + 6 : R1 + 12);
    const x1 = C + Math.cos(a) * r1, y1 = C + Math.sin(a) * r1, x2 = C + Math.cos(a) * R2, y2 = C + Math.sin(a) * R2;
    const who = minted ? col.byOwner.get(owner.get(i)) : null;
    ticks += `<line class="${minted ? 'on' : 'off'}${i === col.supply ? ' next' : ''}" style="--i:${i}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"><title>#${i} ${minted ? '· ' + esc(nameOf(who)) : '· available'}</title></line>`;
  }
  let nums = '';
  for (const i of [0, 25, 50, 75, 100]) {
    const a = (i / max) * Math.PI * 2 - Math.PI / 2;
    nums += `<text x="${(C + Math.cos(a) * 206).toFixed(1)}" y="${(C + Math.sin(a) * 206 + 4).toFixed(1)}">${i}</text>`;
  }
  const ha = (col.supply / max) * 360;
  el.innerHTML = `<svg viewBox="-30 -30 460 460" role="img" aria-label="${col.supply} of ${max} minted, ${col.available} left">
    <defs><linearGradient id="cxBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3E2B8"/><stop offset=".5" stop-color="#DCB27B"/><stop offset="1" stop-color="#AE7431"/></linearGradient></defs>
    <circle class="face" cx="200" cy="200" r="${R1 - 20}"/>
    <circle class="ring" cx="200" cy="200" r="${R2 + 4}"/>
    <g class="ticks">${ticks}</g><g class="nums">${nums}</g>
    <g class="hand" style="transform:rotate(${ha}deg)"><line x1="200" y1="${200 - R1 + 30}" x2="200" y2="${200 - R2 - 14}"/><circle cx="200" cy="${200 - R2 - 18}" r="6"/></g>
  </svg>
  <div class="cx-dial-c"><b>${col.supply}</b><span>of ${max} minted</span><em>${col.available} left</em></div>`;
}

// ---------- every holder's face ----------
export function renderFaces(el, col, { limit = 999 } = {}) {
  el.innerHTML = col.holders.slice(0, limit).map((h) =>
    `<a class="cx-face${h.honorary ? ' hon' : ''}" href="${col.base}holders/#h-${h.address}" title="${esc(nameOf(h))} · ${h.count} piece${h.count > 1 ? 's' : ''}">${avatar(col, h)}<span>${esc(nameOf(h))}</span></a>`).join('');
}

// ---------- the leaderboard: the artist's reserve as a row, then a card for every collector ----------
function pieceLabel(col, id) {
  const t = col.tokens[id];
  return t?.clock ? `${t.clock}${t.place ? ' · ' + t.place : ''}` : 'Rendering its day';
}
function whoLinks(h) {
  return [
    h.x ? `<a href="https://x.com/${esc(h.x)}" target="_blank" rel="noopener">@${esc(h.x)}</a>` : '',
    `<a href="https://opensea.io/${h.address}" target="_blank" rel="noopener">${esc(h.ens || short(h.address))}</a>`,
  ].filter(Boolean).join('<i>·</i>');
}
const honChip = (h) => h.honorary ? `<a class="cx-hon" href="${esc(h.honorary.url)}" target="_blank" rel="noopener" title="${esc(h.honorary.title)}">NEW YORKERS honorary ↗</a>` : '';
export function renderBoard(el, col) {
  let n = 0;
  el.innerHTML = col.holders.map((h) => {
    const ids = h.ids.slice().sort((a, b) => a - b);
    if (h.artist) {
      const pieces = ids.map((id) => `<a class="cx-piece" href="${liveUrl(id)}" target="_blank" rel="noopener" title="#${id} · ${esc(pieceLabel(col, id))}"><img src="${still(col, id)}" alt="Marfa Light #${id}" loading="lazy" width="360" height="360"><span><b>#${id}</b></span></a>`).join('');
      return `<li class="cx-row ml-card is-artist" id="h-${h.address}">
        <span class="cx-rank"><span class="cx-artist">Artist</span></span>${avatar(col, h, 'cx-av big')}
        <div class="cx-who"><b>${esc(nameOf(h))}</b><span class="cx-links">${whoLinks(h)}</span><span class="cx-links">The artist's reserve</span></div>
        <div class="cx-count"><b>${h.count}</b><span>pieces</span></div><div class="cx-pieces">${pieces}</div></li>`;
    }
    const first = ids[0], rest = ids.slice(1);
    const extra = rest.length ? `<div class="cx-extra">${rest.map((id) => `<a href="${liveUrl(id)}" target="_blank" rel="noopener" title="#${id} · ${esc(pieceLabel(col, id))}"><img src="${still(col, id)}" alt="Marfa Light #${id}" loading="lazy" width="360" height="360"></a>`).join('')}</div>` : '';
    return `<li class="cx-card ml-card${h.honorary ? ' hon' : ''}" id="h-${h.address}">
      <a class="cx-art" href="${liveUrl(first)}" target="_blank" rel="noopener" aria-label="Marfa Light #${first} in 3D"><img src="${still(col, first)}" alt="Marfa Light #${first}, ${esc(pieceLabel(col, first))}" loading="lazy" width="360" height="360">
        <span class="cx-no">No. ${String(++n).padStart(2, '0')}</span>${h.count > 1 ? `<span class="cx-n">${h.count} pieces</span>` : ''}</a>
      ${extra}
      <div class="cx-label">${avatar(col, h)}<div class="cx-who"><b>${esc(nameOf(h))}</b><span class="cx-links">${whoLinks(h)}</span></div></div>
      <div class="cx-meta"><span><b>#${first}</b> ${esc(pieceLabel(col, first))}</span>${honChip(h)}</div>
    </li>`;
  }).join('');
}

// ---------- the edition wall: all 111 places, minted or waiting ----------
export function renderWall(el, col, { mintHref = 'mint/' } = {}) {
  const cells = [];
  for (let id = 0; id < col.max; id++) {
    const t = col.tokens[id];
    if (t) {
      const h = col.byOwner.get(t.owner);
      cells.push(`<a class="cx-cell" href="${liveUrl(id)}" target="_blank" rel="noopener"><img src="${still(col, id)}" alt="Marfa Light #${id}" loading="lazy" width="360" height="360"><span class="cx-cap"><b>#${id}</b>${esc(h ? nameOf(h) : '')}</span></a>`);
    } else {
      const next = id === col.supply;
      cells.push(`<a class="cx-cell empty${next ? ' next' : ''}" href="${col.base}${mintHref}"><span class="cx-num">${id}</span><span class="cx-cap">${next ? 'Next to mint' : 'Available'}</span></a>`);
    }
  }
  el.innerHTML = cells.join('');
}

// the sentence every page shares
export function countLine(col) {
  return `${col.supply} of ${col.max} minted · ${col.available} left`;
}
