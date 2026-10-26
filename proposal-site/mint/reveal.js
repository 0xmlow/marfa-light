// The blind mint reveal. Nobody knows which clock a mint will draw until the block lands, so the page
// plays it like a pull: reels spin while the wallet signs and the block is mined, the token's hash
// locks in digit by digit as it arrives from the chain, the reels stop on the real clock, place and
// sky, and then the clock itself is drawn live, in 3D, by the same engine that lives onchain.
//
//   const R = createReveal({ base: '../', chainId: 1, token, snapshot });
//   R.open(); R.signed(txHash); R.landed(tokenId); await R.reveal(seed, { owner });  R.fail(msg)
//   R.demo()  plays a reveal of a token that is already minted, so anyone can see what a pull feels like
import { loadEngine, seedFromResolver, saveGLB, seedFor } from '../ui/marfa-live.js?v=1';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HEX = '0123456789abcdef';
const sleep = (ms) => new Promise((r) => setTimeout(r, RM ? Math.min(ms, 60) : ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

const CLOCK_IMG = ['horizontal-sundial', 'analemmatic-sundial', 'armillary-sphere', 'split-flap-board', 'flip-monument', 'orbital', 'blossom-binary',
  'solar-henge', 'concourse-clock', 'water-clock', 'hourglass', 'word-clock', 'kinetic-pin-field', 'skeleton-clock', 'astronomical-clock', 'motel-sign',
  'water-tower-clock', 'heliochronometer', 'noon-cannon', 'meridian-obelisk', 'wall-dial', 'nocturnal', 'bow-dial', 'foucault-pendulum', 'candle-clock',
  'station-clock', 'scoreboard', 'pumpjack', 'windmill-clock'];
const PLACES = ['Highway 90', 'Chinati Field', 'Marfa Lights Viewing Area', 'Railroad Depot', 'Salt Playa', 'Mesa Rim', 'Arroyo', 'Adobe Courtyard', 'Ghost Town',
  'Hot Springs', 'Drive-In Lot', 'Rodeo Arena', 'Observatory Ridge', 'Highland Avenue', 'Artillery Shed', 'Empty Pool', 'Aerostat Field', 'Prairie Terrace',
  'Meridian Cloister', 'Aeolian Court', 'Contour Passage', 'Hadid Pavilion'];
const SKIES = ['Clear', 'Scattered', 'Monsoon', 'Dust', 'Blue Norther'];

// ---------- a little sound, made in the browser (no files) ----------
let ac = null, muted = false;
try { muted = localStorage.getItem('ml-mute') === '1'; } catch (e) {}
function tone(f, d = 0.05, type = 'square', v = 0.035) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch (e) {}
}
const tick = () => tone(1400 + Math.random() * 300, 0.025, 'square', 0.02);
const thunk = () => { tone(140, 0.18, 'triangle', 0.12); tone(70, 0.25, 'sine', 0.12); };
const ding = () => { [880, 1108, 1318, 1760].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sine', 0.06), i * 90)); };

// ---------- a reel: a strip of cells that spins until told where to stop ----------
class Reel {
  constructor(el, items) {
    this.el = el; this.items = items; this.strip = el.querySelector('.rv-strip');
    const cells = items.concat(items, items, items);
    this.strip.innerHTML = cells.map((it) => `<div class="rv-cell">${it.img ? `<img src="${it.img}" alt="" width="96" height="96">` : ''}<span>${esc(it.name)}</span></div>`).join('');
    this.h = 0; this.pos = 0; this.v = 0; this.target = null; this.done = null; this.last = -1;
  }
  measure() { this.h = this.strip.firstElementChild.getBoundingClientRect().height || 72; }
  spin(speed) { this.v = speed; this.target = null; }
  stop(index) {
    return new Promise((res) => {
      this.measure();
      const n = this.items.length, cyc = n * this.h;
      const base = Math.ceil((this.pos + this.h * 6) / cyc) * cyc; // at least a few cells more
      this.from = this.pos; this.target = base + index * this.h; this.t0 = performance.now(); this.dur = RM ? 1 : 900 + Math.random() * 400; this.done = res;
    });
  }
  frame(now, dt) {
    if (!this.h) this.measure();
    const n = this.items.length, cyc = n * this.h;
    if (this.target != null) {
      const k = Math.min(1, (now - this.t0) / this.dur), e = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.015;
      this.pos = this.from + (this.target - this.from) * e;
      if (k >= 1) { this.pos = this.target; this.target = null; this.v = 0; this.el.classList.add('hit'); const d = this.done; this.done = null; d && d(); }
    } else this.pos += this.v * dt;
    if (this.pos > cyc * 2 && this.target == null) this.pos -= cyc;
    const cell = Math.floor(this.pos / this.h);
    if (cell !== this.last && this.v > 0) { this.last = cell; if (this.v < 2600 || cell % 3 === 0) tick(); }
    this.strip.style.transform = `translateY(${-this.pos}px)`;
    this.el.classList.toggle('blur', this.v > 1400 && this.target == null);
  }
}

export function createReveal({ base = '../', chainId = 1, token, snapshot = () => null, onMintAgain = () => {} }) {
  const root = document.createElement('div');
  root.id = 'reveal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Your mint');
  root.innerHTML = `
    <div class="rv-sky"></div><div class="rv-flash"></div>
    <button class="rv-x" type="button" aria-label="Close">×</button>
    <button class="rv-mute mono" type="button"></button>
    <div class="rv-in">
      <p class="rv-kicker mono"><i class="live-dot"></i><span class="rv-step">Blind mint</span></p>
      <h2 class="rv-title">Rolling the block</h2>
      <div class="rv-hash mono" aria-live="polite">0x${'0'.repeat(64)}</div>
      <div class="rv-machine">
        <div class="rv-reel" data-k="clock"><span class="rv-lab mono">Clock</span><div class="rv-win"><div class="rv-strip"></div></div></div>
        <div class="rv-reel" data-k="place"><span class="rv-lab mono">Place</span><div class="rv-win"><div class="rv-strip"></div></div></div>
        <div class="rv-reel" data-k="sky"><span class="rv-lab mono">Sky</span><div class="rv-win"><div class="rv-strip"></div></div></div>
      </div>
      <p class="rv-status mono" aria-live="polite"></p>
      <div class="rv-result" hidden>
        <div class="rv-stage"><canvas class="rv-canvas"></canvas><span class="rv-badge mono"></span></div>
        <div class="rv-side">
          <p class="rv-pulled"></p>
          <p class="rv-rarity mono"></p>
          <ul class="rv-traits"></ul>
          <div class="rv-actions">
            <a class="btn solid rv-live" target="_blank" rel="noopener">Enter in 3D ↗</a>
            <button class="btn rv-png" type="button">Save still ↓</button>
            <button class="btn rv-glb" type="button">Download 3D ↓</button>
            <a class="btn rv-share" target="_blank" rel="noopener">Post it on X</a>
            <button class="btn solid rv-again" type="button">Pull again</button>
          </div>
          <p class="rv-fine mono"></p>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const setMute = () => { q('.rv-mute').textContent = muted ? 'Sound off' : 'Sound on'; };
  setMute();
  q('.rv-mute').onclick = () => { muted = !muted; try { localStorage.setItem('ml-mute', muted ? '1' : '0'); } catch (e) {} setMute(); };

  let reels = null, raf = 0, last = 0, ctl = null, hashT = 0, state = { id: null, seed: null, demo: false };
  const L0 = loadEngine(base); // start fetching the engine at once; the reveal needs it

  function buildReels() {
    if (reels) return;
    const clocks = CLOCK_IMG.map((s, i) => ({ name: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), img: `${base}img/clock-${String(i + 1).padStart(2, '0')}-${s}.jpg` }));
    reels = {
      clock: new Reel(q('[data-k=clock]'), clocks),
      place: new Reel(q('[data-k=place]'), PLACES.map((n) => ({ name: n }))),
      sky: new Reel(q('[data-k=sky]'), SKIES.map((n) => ({ name: n }))),
    };
  }
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    for (const r of Object.values(reels)) r.frame(now, dt);
    raf = requestAnimationFrame(loop);
  }
  function scramble(on) {
    clearInterval(hashT);
    if (!on) return;
    hashT = setInterval(() => { let s = '0x'; for (let i = 0; i < 64; i++) s += HEX[(Math.random() * 16) | 0]; q('.rv-hash').textContent = s; }, 50);
  }
  const step = (t) => { q('.rv-step').textContent = t; };
  const title = (t) => { q('.rv-title').textContent = t; };
  const status = (h) => { q('.rv-status').innerHTML = h; };

  function open({ demo = false } = {}) {
    state = { id: null, seed: null, demo };
    buildReels();
    root.classList.remove('done', 'failed'); root.classList.add('on'); document.documentElement.classList.add('rv-open');
    q('.rv-result').hidden = true; q('.rv-machine').hidden = false; q('.rv-hash').hidden = false;
    for (const r of Object.values(reels)) { r.el.classList.remove('hit'); }
    reels.clock.spin(900); reels.place.spin(700); reels.sky.spin(500);
    cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop);
    step(demo ? 'Demo · a pull that already happened' : 'Blind mint'); title(demo ? 'Rolling the block' : 'Sign in your wallet');
    status(demo ? 'This replays a real token. Your own pull works the same way.' : 'Nothing is decided yet. Not even MLow knows what comes out.');
    scramble(true);
  }
  function signed(tx) {
    reels.clock.spin(2400); reels.place.spin(2000); reels.sky.spin(1700);
    step('Transaction sent'); title('Rolling the block');
    const scan = chainId === 1 ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
    status(`Waiting for a block. <a href="${scan}/tx/${tx}" target="_blank" rel="noopener">${tx.slice(0, 10)}… ↗</a>`);
  }
  function landed(id) {
    state.id = id;
    reels.clock.spin(3200); reels.place.spin(2800); reels.sky.spin(2400);
    step('Block landed · token #' + id); title('Reading your hash');
    status('The chain has spoken. Pulling your hash from it…');
    thunk();
  }
  async function waitSeed(id) {
    for (let i = 0; i < 90; i++) {
      const s = await seedFromResolver(id, chainId, token).catch(() => null);
      if (s) return s;
      if (i === 6) status('Still reading the chain. A new mint takes ABX up to a minute to index.');
      await sleep(3000);
    }
    return null;
  }
  async function lockHash(seed) {
    scramble(false);
    const el = q('.rv-hash'), body = seed.slice(2);
    for (let k = 0; k <= 64; k += RM ? 64 : 2) {
      let s = '0x' + body.slice(0, k); for (let i = k; i < 64; i++) s += HEX[(Math.random() * 16) | 0];
      el.innerHTML = `0x<b>${body.slice(0, k)}</b>${s.slice(2 + k)}`;
      if (k % 8 === 0) tick();
      await sleep(26);
    }
    el.innerHTML = `0x<b>${body}</b>`;
  }
  const indexOf = (reel, value) => { const i = reel.items.findIndex((it) => norm(it.name) === norm(value)); return i; };

  async function reveal(seed, { owner = '' } = {}) {
    state.seed = seed;
    const L = await L0;
    const f = L.plan(seed).features;
    step('Your hash'); title('Here it comes');
    status('Locking in…');
    await lockHash(seed);
    // the sky reel only knows a few names; add the real one if it is new so the reel can land on it
    for (const [k, v] of [['clock', f.Clock], ['place', f.Place], ['sky', f.Sky]]) {
      if (indexOf(reels[k], v) < 0) { reels[k].items.push({ name: v }); const it = reels[k].items; reels[k].strip.innerHTML = it.concat(it, it, it).map((x) => `<div class="rv-cell">${x.img ? `<img src="${x.img}" alt="" width="96" height="96">` : ''}<span>${esc(x.name)}</span></div>`).join(''); reels[k].h = 0; }
    }
    await sleep(250);
    await reels.clock.stop(indexOf(reels.clock, f.Clock)); thunk();
    await sleep(RM ? 0 : 500);
    await reels.place.stop(indexOf(reels.place, f.Place)); thunk();
    status('One more…');
    await sleep(RM ? 0 : 900);
    await reels.sky.stop(indexOf(reels.sky, f.Sky)); thunk();
    await sleep(350);
    // the hit
    ding();
    root.classList.add('done'); q('.rv-flash').classList.remove('go'); void q('.rv-flash').offsetWidth; q('.rv-flash').classList.add('go');
    const b = q('.rv-machine').getBoundingClientRect();
    window.MLFX && MLFX.burst(b.left + b.width / 2, b.top + b.height / 2, [base + 'media/stickers/sundial.webp', base + 'media/stickers/orbital.webp', base + 'media/stickers/hourglass.webp', base + 'media/stickers/windmill.webp']);
    await sleep(700);
    showResult(L, seed, f, owner);
  }

  function rarity(f) {
    const snap = snapshot();
    const toks = snap && snap.tokens ? snap.tokens.filter((t) => t.clock && t.id !== state.id) : [];
    const same = toks.filter((t) => norm(t.clock) === norm(f.Clock)).length;
    const place = toks.filter((t) => norm(t.place) === norm(f.Place)).length;
    const lines = [];
    lines.push(same === 0 ? `The first ${f.Clock} in the edition.` : `${f.Clock}: ${same + 1} in the edition so far, out of ${toks.length + 1} clocks.`);
    if (place === 0) lines.push(`The first clock ever at ${f.Place}.`);
    return lines.join(' ');
  }
  function showResult(L, seed, f, owner) {
    const id = state.id;
    q('.rv-machine').hidden = true; q('.rv-hash').hidden = true;
    step(state.demo ? `Demo · Marfa Light #${id}` : `Marfa Light #${id} is yours`);
    title(f.Clock);
    status('');
    q('.rv-pulled').innerHTML = `${state.demo ? 'This pull drew' : 'You pulled'} a <b>${esc(f.Clock)}</b> at <b>${esc(f.Place)}</b>, under a ${esc(String(f.Sky).toLowerCase())} sky. It is drawing itself live, right now, for this minute in Marfa. Drag to look around.`;
    q('.rv-rarity').textContent = rarity(f);
    const show = ['Material', 'Film', 'Visitors', 'Sky Event', 'Anomaly', 'Birds', 'Light Work', 'Easter Eggs', 'Alignment'];
    q('.rv-traits').innerHTML = show.filter((k) => f[k] != null && f[k] !== 'None').map((k) => `<li><span>${esc(k)}</span><b>${esc(f[k])}</b></li>`).join('');
    const special = f.Anomaly && f.Anomaly !== 'None' ? 'Anomaly · ' + f.Anomaly : f['Sky Event'] && f['Sky Event'] !== 'None' ? f['Sky Event'] : '';
    q('.rv-badge').textContent = special; q('.rv-badge').hidden = !special;
    const live = `https://resolver.abx.io/a/${chainId}/${String(token).toLowerCase()}/${id}`;
    q('.rv-live').href = live;
    const os = `https://opensea.io/item/ethereum/${String(token).toLowerCase()}/${id}`;
    const text = `${state.demo ? 'Watched' : 'Just pulled'} Marfa Light #${id} by @degens: a ${f.Clock} at ${f.Place}. Blind mint, drawn live from code on Ethereum.`;
    q('.rv-share').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(chainId === 1 ? os : 'https://marfalight.art/mint/');
    q('.rv-fine').textContent = state.demo ? (owner ? 'Held by ' + owner + '. ' : '') + 'Mint your own and the reels stop on yours.' : 'Its day GIF lands on OpenSea and marfalight.art within the hour.';
    q('.rv-again').textContent = state.demo ? 'Mint my own' : 'Pull again';
    q('.rv-result').hidden = false;
    // draw it, live
    if (ctl) { ctl.dispose(); ctl = null; }
    const cv = q('.rv-canvas');
    requestAnimationFrame(() => {
      try { ctl = L.create(cv, seed, { mode: 'live', freeWheel: true, overlay: false, keys: false }); ctl.start(); }
      catch (e) { console.warn(e); q('.rv-stage').innerHTML = `<img src="${base}tokens/developing.gif" alt="">`; }
    });
  }

  function fail(msg) {
    scramble(false); cancelAnimationFrame(raf);
    root.classList.add('failed'); step('No mint'); title('Nothing was charged'); status(esc(msg));
    setTimeout(close, 2600);
  }
  function close() {
    root.classList.remove('on'); document.documentElement.classList.remove('rv-open');
    scramble(false); cancelAnimationFrame(raf);
    if (ctl) { ctl.dispose(); ctl = null; }
  }

  // a reveal of a token that already exists, at the same pace as a real one
  async function demo() {
    const snap = snapshot();
    const ids = snap && snap.tokens ? snap.tokens.filter((t) => t.rendered).map((t) => t.id) : [0];
    const id = ids[(Math.random() * ids.length) | 0];
    open({ demo: true });
    const seedP = seedFor(id, base);
    await sleep(1400); signed('0x' + Array.from({ length: 64 }, () => HEX[(Math.random() * 16) | 0]).join(''));
    status('Demo · no transaction is sent.');
    await sleep(2200); landed(id);
    const seed = await seedP; if (!seed) return fail('Could not load that token. Try again.');
    await sleep(1200);
    const t = snap.tokens[id], h = t && snap.holders.find((x) => x.address === t.owner);
    await reveal(seed, { owner: h ? (h.name || h.ens || '') : '' });
  }

  q('.rv-x').onclick = close;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('on')) close(); });
  q('.rv-png').onclick = () => { if (ctl) ctl.saveStill(); };
  q('.rv-glb').onclick = async () => {
    const btn = q('.rv-glb'); if (!state.seed || btn.disabled) return;
    btn.disabled = true; btn.textContent = 'Building…';
    try { const blob = await saveGLB(state.seed, state.id, base); btn.textContent = 'Saved · ' + (blob.size / 1048576).toFixed(1) + ' MB'; }
    catch (e) { console.warn(e); btn.textContent = 'Try again'; }
    setTimeout(() => { btn.textContent = 'Download 3D ↓'; btn.disabled = false; }, 2600);
  };
  q('.rv-again').onclick = () => { const wasDemo = state.demo; close(); onMintAgain(wasDemo); };
  addEventListener('resize', () => { if (ctl) ctl.resize(); });

  return { open, signed, landed, waitSeed, reveal, fail, close, demo, get id() { return state.id; } };
}
