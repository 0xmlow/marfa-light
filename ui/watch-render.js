// A token's day at watch size, drawn in the visitor's browser (or headless Chrome, for the app).
//
//   renderDay(L, seed, { step: 300 })  one JPEG every 5 minutes, midnight to midnight: the hands
//                                      of each frame show its own wall-clock minute
//   renderStills(L, seed)              four moments for the Apple Watch Photos face
//
// Frames are named by the minute their hands show (HHMM), so a player picks the frame for the
// time it wants to keep: Marfa's, or the wearer's own (the sun then rises with them too).
export const WATCH = { w: 422, h: 514 }; // Apple Watch Ultra 3, the largest; smaller watches crop

function marfaDay(L, date) {
  const t = L.marfaTime((date ? date.getTime() : Date.now()) / 1000);
  return { y: t.y, mo: t.mo, d: t.d, t };
}
function toMin(hhmm) { if (!/^\d\d:\d\d$/.test(hhmm)) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
export const hhmm = (min) => String(Math.floor(min / 60) % 24).padStart(2, '0') + String(min % 60).padStart(2, '0');

function blob(canvas, quality) { return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality)); }

// one running scene, re-clocked for every frame: far faster than a fresh scene per frame
function open(L, seed, { w, h, view, film }) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${w + 50}px;top:0;width:${w}px;height:${h}px;pointer-events:none`;
  const c = document.createElement('canvas');
  c.width = w; c.height = h; c.style.cssText = `width:${w}px;height:${h}px`;
  host.appendChild(c); document.body.appendChild(host);
  const ctl = L.create(c, seed, { mode: 'still', interactive: false, keys: false, overlay: false, preserve: true, reducedMotion: true, maxPixelRatio: 1 });
  if (film) ctl.setFilm(film);
  ctl.setView(view || 'Hero');
  ctl.beginCapture(w, h, true);
  for (let i = 0; i < 4; i++) ctl.renderOnce(1); // ease the camera fully into its view
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  return { ctl, g2: out.getContext('2d'), out, close() { ctl.endCapture(false); ctl.dispose(); host.remove(); } };
}
function frameAt(s, utc) {
  s.ctl.setClock(utc, true);
  s.ctl.renderOnce(0.5);          // let flaps, pins and water settle at this minute
  s.ctl.captureFrame(0.5, s.g2);
}

export async function renderDay(L, seed, o = {}) {
  const { w = WATCH.w, h = WATCH.h, step = 300, quality = 0.8, view = 'Hero', film, date, onFrame } = o;
  const day = marfaDay(L, date);
  const s = open(L, seed, { w, h, view, film });
  const n = Math.round(86400 / step), frames = [];
  try {
    for (let i = 0; i < n; i++) {
      const min = Math.round((i * step) / 60);
      // marfaUtc handles daylight saving: each frame is that wall-clock minute in Marfa
      frameAt(s, L.marfaUtc(day.y, day.mo, day.d, Math.floor(min / 60), min % 60));
      const b = await blob(s.out, quality);
      const f = { name: hhmm(min), min, blob: b };
      frames.push(f);
      if (onFrame) await onFrame(f, i, n);
      if (i % 8 === 7) await new Promise((r) => setTimeout(r)); // let the page breathe
    }
  } finally { s.close(); }
  return { frames, date: `${day.y}-${String(day.mo).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`, step, w, h };
}

// dawn, midday, golden hour, night: today's sun, at the moments the piece looks most itself
export async function renderStills(L, seed, o = {}) {
  const { w = WATCH.w, h = WATCH.h, quality = 0.9, view = 'Hero', film, date } = o;
  const day = marfaDay(L, date), ev = L.sunEvents(day.t);
  const rise = toMin(ev.rise) ?? 7 * 60, set = toMin(ev.set) ?? 19 * 60;
  const moments = [
    ['dawn', rise + 25], ['midday', Math.round((rise + set) / 2)],
    ['golden', set - 35], ['night', Math.min(set + 150, 23 * 60 + 30)],
  ];
  const s = open(L, seed, { w, h, view, film }), out = [];
  try {
    for (const [name, min] of moments) {
      frameAt(s, L.marfaUtc(day.y, day.mo, day.d, Math.floor(min / 60), min % 60));
      out.push({ name, min, blob: await blob(s.out, quality) });
    }
  } finally { s.close(); }
  return out;
}
