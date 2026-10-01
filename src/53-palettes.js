  // =====================================================================
  // BORROWED PALETTES
  // Most tokens keep Marfa's own colours. The rest borrow a palette from a
  // collection this work honours, with the artists' permission, and use it
  // for the light and the people in the scene: the fluorescent barrier and
  // its spill, the visitors' clothes, the luminaria bags, the courts' inlays.
  // The sky, the stone and the clock keep their own colours.
  //   Chromie Spectrum   the hue run of a real Squiggle, from Snowfro's own
  //                      colour maths (start colour, spread, direction)
  //   Friendship Bracelets palettes, by Alexis André's names, the colours
  //                      sampled from Art Blocks' renders of those tokens
  //   NimBuds, NimTeens  hex colours from Bryan Brinkman's scripts
  // Draws only from hashRng(hash, 7301). Prefix pal_.
  // =====================================================================

  var PAL_SETS = {
    'Marfa Sunset':     { by: 'Friendship Bracelets, Alexis André', colors: ['#C44B1B', '#8F1308', '#E68945', '#F2B880'] },
    'PURP':             { by: 'Friendship Bracelets, Alexis André', colors: ['#5A1B65', '#995AA5', '#BC80C7', '#72337C'] },
    'Twinkle in Pink':  { by: 'Friendship Bracelets, Alexis André', colors: ['#D36990', '#961F34', '#BB4E76', '#E299AD'] },
    'In the Mountains': { by: 'Friendship Bracelets, Alexis André', colors: ['#4B3113', '#445841', '#67735B', '#A4AF9D'] },
    'MGoBlue!':         { by: 'Friendship Bracelets, Alexis André', colors: ['#D9D473', '#586397', '#151E4E', '#383E63'] },
    'Neon Lit Diner':   { by: 'Friendship Bracelets, Alexis André', colors: ['#6F160E', '#A64C33', '#CA7753', '#8D6E54'] },
    'NimBuds':          { by: 'NimBuds, Bryan Brinkman', colors: ['#23C7D9', '#48D9A4', '#F2668B', '#F2BF27', '#F2F1DF'] },
    'NimTeens':         { by: 'NimTeens, Bryan Brinkman', colors: ['#126374', '#247452', '#813345', '#F2668B', '#F2BF27'] }
  };
  var PAL_WEIGHTS = [['Marfa', 45], ['Chromie Spectrum', 12], ['Marfa Sunset', 9], ['NimBuds', 8], ['NimTeens', 4],
    ['PURP', 4], ['Twinkle in Pink', 4], ['In the Mountains', 4], ['MGoBlue!', 3], ['Neon Lit Diner', 3]];

  function palPlan(hash) {
    var r = hashRng(hash, 7301), name = pickW(r, PAL_WEIGHTS), seed = Math.floor(r() * 4294967296) >>> 0;
    var P = { name: name, seed: seed, features: { 'Palette': name } };
    if (name === 'Chromie Spectrum') {
      // the token's own Squiggle when it has one on display, so the two agree
      var tok = sqgPick(hash), S = sqgState(tok.hash);
      P.spectrum = { start: S.startColor, spread: S.spread, reverse: S.reverse, n: Math.round((S.segments - 2) * (S.slinky ? 50 : S.fuzzy ? 1000 : 200)) };
      P.features['Palette Source'] = 'Chromie Squiggle #' + tok.id;
    } else if (name !== 'Marfa') {
      P.colors = PAL_SETS[name].colors;
      P.features['Palette Source'] = PAL_SETS[name].by;
    }
    return P;
  }
  function pal_on(W) { var p = W.P.resonance && W.P.resonance.paintPalette || W.P.palette; return p && p.name !== 'Marfa' ? p : null; }
  // the Squiggle's colour at t (0..1) along its run, as Snowfro computes it
  function pal_hue(p, t) {
    var sp = p.spectrum, color = t * sp.n;
    var hue = sp.reverse ? 255 - (((color / sp.spread) + sp.start) % 255) : ((color / sp.spread) + sp.start) % 255;
    return '#' + new THREE.Color().setHSL(hue / 255, 1, 0.5).getHexString();
  }
  // the i-th of n colours; glowing things are lifted so a dark palette still reads as light
  function palColor(W, i, n, glow) {
    var p = pal_on(W); if (!p) return null;
    var hex = p.spectrum ? pal_hue(p, n > 1 ? i / (n - 1) : 0) : p.colors[i % p.colors.length];
    if (!glow) return hex;
    var c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);   // sRGB, not C(): the lift is a display decision
    if (hsl.l < 0.55) c.setHSL(hsl.h, Math.max(hsl.s, 0.55), 0.55);
    return '#' + c.getHexString();
  }
  function palRng(W, salt) { var p = pal_on(W); return p ? seedRng((p.seed ^ salt) >>> 0) : null; }
