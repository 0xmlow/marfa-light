  // =====================================================================
  // REMIX (site only, never onchain): the same plan as 90-main.js, with any
  // pick swapped for one the visitor chooses. Every random draw still happens
  // in the same order, so what they did not touch stays as the hash made it.
  //   marfaLight.remix.create(canvas, hash, opts, { clock, place, material, sky, wind, film, palette, tag })
  // =====================================================================
  var RMX = null, rmx_plan0 = plan;
  function rmx_has(list, name) { for (var i = 0; i < list.length; i++) if ((list[i][0] || list[i]) === name) return true; return false; }
  function rmx_pal(hash, name) {
    var P = palPlan(hash);
    if (!name || name === P.name || !(name === 'Marfa' || name === 'Chromie Spectrum' || PAL_SETS[name])) return P;
    var out = { name: name, seed: P.seed, features: { 'Palette': name } };
    if (name === 'Chromie Spectrum') {
      var tok = sqgPick(hash), S = sqgState(tok.hash);
      out.spectrum = { start: S.startColor, spread: S.spread, reverse: S.reverse, n: Math.round((S.segments - 2) * (S.slinky ? 50 : S.fuzzy ? 1000 : 200)) };
      out.features['Palette Source'] = 'Chromie Squiggle #' + tok.id;
    } else if (name !== 'Marfa') { out.colors = PAL_SETS[name].colors; out.features['Palette Source'] = PAL_SETS[name].by; }
    return out;
  }
  function rmx_placeOk(place, clock) { var p = PLACE_DEFS[place]; return !!p && (!p.accepts || p.accepts(clock, CLOCK_DEFS[clock])); }

  function planWith(hash, o) {
    o = o || {};
    var r = hashRng(hash, 1);
    var clock = pickW(r, weighted(CLOCK_DEFS));
    if (o.clock && CLOCK_DEFS[o.clock]) clock = o.clock;
    var cd = CLOCK_DEFS[clock];
    var place = pickW(r, weighted(PLACE_DEFS, function (p) { return !p.accepts || p.accepts(clock, cd); }));
    var observatory = obsPlan(hash, clock, place);
    if (o.place && rmx_placeOk(o.place, clock)) { place = o.place; observatory = obsPlan(hash, clock, place); observatory.place = place; observatory.features = {}; }
    else place = observatory.place;
    var pd = PLACE_DEFS[place];
    var material = pick(r, cd.mats);
    if (o.material && cd.mats.indexOf(o.material) >= 0) material = o.material;
    var sky = pickW(r, pd.skies || SKIES), wind = pickW(r, WINDS), film = pickW(r, FILM_WEIGHTS), tag = pick(r, TAGS);
    if (o.sky && rmx_has(pd.skies || SKIES, o.sky)) sky = o.sky;
    if (o.wind && rmx_has(WINDS, o.wind)) wind = o.wind;
    if (o.film && FILMS[o.film]) film = o.film;
    if (o.tag) tag = '"' + String(o.tag).replace(/[^A-Za-z0-9 .,!?&:\-]/g, '').toUpperCase().slice(0, 24) + '"';
    var eggs = [];
    (pd.eggs || []).concat(cd.eggs || []).forEach(function (e) { if (EGG_DEFS[e] && eggs.indexOf(e) < 0) eggs.push(e); });
    var extra = ri(r, 2, 5), guard = 0;
    var pool = weighted(EGG_DEFS, function (e) { return !e.places || e.places.indexOf(place) >= 0; });
    while (extra > 0 && guard++ < 80) {
      var e = pickW(r, pool);
      if (eggs.indexOf(e) < 0) { eggs.push(e); extra--; }
    }
    var camAz = cd.solar ? 180 + rf(r, -55, 55) : r() * 360;
    var camK = rf(r, 0.94, 1.1), camHk = r();
    var day = ri(r, 1, 28), night = r() < 0.12, tm, a = r(), b = r();
    if (night) tm = 21.2 + a * 2.6;
    else tm = 7.3 + 12.4 * (Math.abs(a - 0.5) > Math.abs(b - 0.5) ? a : b);
    var hh = Math.floor(tm), mi = Math.floor((tm - hh) * 60);
    var seed = parseInt(hash.slice(2, 9), 16) % 1000003;
    var ct = cd.traits ? cd.traits(hashRng(hash, 3)) : {};
    var features = { 'Clock': clock };
    for (var k in ct) features[k] = ct[k];
    features['Keeps Time By'] = cd.keeps;
    features['Place'] = place;
    features['Material'] = material;
    features['Sky'] = sky;
    features['Wind'] = wind;
    features['Film'] = film;
    features['Tag'] = tag;
    var gen = typeof genPlan === 'function' ? genPlan(hash, clock, cd, place, PLACE_DEFS[place], sky) : { features: {} };
    for (var gk in gen.features) features[gk] = gen.features[gk];
    if (observatory.place === 'Meridian Cloister' || observatory.place === 'Aeolian Court' || observatory.place === 'Contour Passage') {
      features['Architecture'] = observatory.place; features['Bays'] = observatory.bays; features['Architectural Finish'] = observatory.finish; features['Water Study'] = observatory.water;
      if (observatory.place === 'Aeolian Court') features['Aperture'] = observatory.aperture;
    }
    var stillUtc = marfaUtc(2027, 4, day, hh, mi);
    var align = typeof alnPlan === 'function' ? alnPlan(hash, place, stillUtc) : null;
    if (align) for (var ak in align.features) features[ak] = align.features[ak];
    var palette = rmx_pal(hash, o.palette);
    if (palette) for (var pk in palette.features) features[pk] = palette.features[pk];
    var forms = typeof formsPlan === 'function' ? formsPlan(hash, gen, place, palette) : null;
    if (forms) for (var fk in forms.features) features[fk] = forms.features[fk];
    var resonance = resPlan(hash, gen, place, align, palette);
    for (var rk in resonance.features) features[rk] = resonance.features[rk];
    if (resonance.paintPalette) {
      features['Label Tie'] = 'Woven, ' + resonance.paintPalette.name;
      if (gen.bloom !== 'None' && gen.bloom !== 'Cholla in Bloom') features['Bloom Tint'] = resonance.paintPalette.name;
    }
    eggs.forEach(function (key) { if (RES_EXHIBITS[key]) { var ref = resReference(hash, RES_EXHIBITS[key][0]); features[ref.name + ' Reference'] = '#' + ref.n; } });
    features['Easter Eggs'] = eggs.join(' · ');
    features['Egg Count'] = eggs.length;
    if (eggs.indexOf('First Eye Flower') >= 0) features['Witness Bloom'] = 'Solar-responsive / six bone petals';
    if (eggs.indexOf('Chromie Squiggle') >= 0) { var sq = sqgPick(hash); features['Chromie Squiggle'] = '#' + sq.id; features['Squiggle Type'] = sq.type; if (sq.spectrum !== 'Normal') features['Squiggle Spectrum'] = sq.spectrum; }
    if (eggs.indexOf('Friendship Bracelets') >= 0) { var fb = brcPick(hash); features['Friendship Bracelet'] = '#' + fb.id; features['Bracelet Palette'] = fb.palette; }
    return {
      resonance: resonance, gen: gen, observatory: observatory, align: align, palette: palette, forms: forms,
      hash: hash, seed: seed, clock: clock, place: place, material: material, sky: sky, wind: wind, film: film, tag: tag,
      eggs: eggs, clockTraits: ct, camAz: camAz, camK: camK, camHk: camHk, windAz: r() * 360,
      stillUtc: stillUtc, stillLabel: 'APR ' + day + ' 2027 ' + pad2(hh) + ':' + pad2(mi),
      features: features, remixed: true
    };
  }
  // create() calls plan() by name, so for the length of one remix.create it reads the visitor's picks
  plan = function (hash) { return RMX ? planWith(hash, RMX) : rmx_plan0(hash); };

  root.marfaLight.remix = {
    plan: planWith,
    create: function (canvas, hash, opts, over) { RMX = over || {}; try { return create(canvas, hash, opts); } finally { RMX = null; } },
    // what can be chosen for this hash; places and materials depend on the clock
    options: function (hash, over) {
      var P = planWith(hash, over), clock = P.clock, pd = PLACE_DEFS[P.place];
      return {
        clocks: Object.keys(CLOCK_DEFS),
        places: Object.keys(PLACE_DEFS).filter(function (p) { return rmx_placeOk(p, clock); }),
        materials: CLOCK_DEFS[clock].mats.slice(),
        skies: (pd.skies || SKIES).map(function (s) { return s[0]; }),
        winds: WINDS.map(function (w) { return w[0]; }),
        films: Object.keys(FILMS),
        palettes: PAL_WEIGHTS.map(function (p) { return p[0]; }),
        views: VIEWS.slice(),
        current: { clock: clock, place: P.place, material: P.material, sky: P.sky, wind: P.wind, film: P.film, palette: P.palette ? P.palette.name : 'Marfa', tag: P.tag }
      };
    }
  };
