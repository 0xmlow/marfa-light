
  // =====================================================================
  // HOLIDAYS: the rest of the calendar (57-calendar.js has the fireworks)
  // Like the fireworks these are not traits: every token keeps the same
  // calendar and makes each day its own way, from its own seed. Nothing is
  // built until its day first comes round.
  //   Jewish days begin at sundown, as they do: the Hebrew calendar is worked
  //   out from the molad here (Dershowitz and Reingold), no tables, no network.
  //     Rosh Hashanah   rings of gold go out in the shofar's calls; honey light rises
  //     Yom Kippur      memorial candles burn round the clock
  //     Sukkot          a sukkah stands by the clock, fruit swinging, lights at night
  //     Simchat Torah   seven circles of light dance round the clock (hakafot)
  //     Hanukkah        a menorah, one more candle each night, and a dreidel
  //     Tu BiShvat      almond blossom blows across the scene
  //     Purim           confetti
  //     Passover        at night the sea parts behind the clock
  //     Lag BaOmer      bonfires
  //     Shavuot         greenery round the clock, petals falling
  //   And: Halloween (jack-o'-lanterns, bats at dusk), Day of the Dead (a
  //   marigold path, papel picado, candles), the solstices and equinoxes
  //   (lines of light to where the sun rises and sets today), the token's own
  //   Residency Day (its April still date: a blossom of light over the clock),
  //   and the Marfa lights on the horizon on festival weekend and, rarely,
  //   on any night.
  // Draws only from hashRng(hash, 9501) and per-holiday seeds.
  // =====================================================================

  // ------------------------------------------------------------ the Hebrew calendar
  // months: Nisan 1 ... Elul 6, Tishri 7 ... Adar 12, Adar II 13 in a leap year
  var HEB_EPOCH = -1373427, RD_UNIX = 719163;      // R.D. of 1 Tishri AM 1; R.D. of 1970-01-01
  function hebLeap(y) { return ((7 * y + 1) % 19) < 7; }
  function hebElapsed(y) {
    var me = Math.floor((235 * y - 234) / 19), pe = 12084 + 13753 * me, d = 29 * me + Math.floor(pe / 25920);
    return ((3 * (d + 1)) % 7) < 3 ? d + 1 : d;
  }
  function hebNY(y) {
    var a = hebElapsed(y - 1), b = hebElapsed(y), c = hebElapsed(y + 1);
    return HEB_EPOCH + b + (c - b === 356 ? 2 : b - a === 382 ? 1 : 0);
  }
  function hebMonthDays(m, y) {
    var n = hebNY(y + 1) - hebNY(y);
    if (m === 2 || m === 4 || m === 6 || m === 10 || m === 13 || (m === 12 && !hebLeap(y)) || (m === 8 && n % 10 !== 5) || (m === 9 && n % 10 === 3)) return 29;
    return 30;
  }
  function hebFixed(y, m, d) {
    var r = hebNY(y) + d - 1, k, last = hebLeap(y) ? 13 : 12;
    if (m < 7) { for (k = 7; k <= last; k++) r += hebMonthDays(k, y); for (k = 1; k < m; k++) r += hebMonthDays(k, y); }
    else for (k = 7; k < m; k++) r += hebMonthDays(k, y);
    return r;
  }
  function hebFromRD(rd) {
    var y = Math.floor((rd - HEB_EPOCH) / (35975351 / 98496));
    while (hebNY(y + 1) <= rd) y++;
    var m = rd < hebFixed(y, 1, 1) ? 7 : 1;
    while (rd > hebFixed(y, m, hebMonthDays(m, y))) m++;
    return { y: y, m: m, d: rd - hebFixed(y, m, 1) + 1 };
  }
  // name, month (0: Adar, or Adar II in a leap year), day, length in days
  var HEB_DAYS = [['Rosh Hashanah', 7, 1, 2], ['Yom Kippur', 7, 10, 1], ['Sukkot', 7, 15, 7], ['Simchat Torah', 7, 22, 2], ['Hanukkah', 9, 25, 8],
    ['Tu BiShvat', 11, 15, 1], ['Purim', 0, 14, 1], ['Passover', 1, 15, 8], ['Lag BaOmer', 2, 18, 1], ['Shavuot', 3, 6, 2]];
  var hol_hebC = {};
  function hebHolidays(rd) {
    if (hol_hebC[rd]) return hol_hebC[rd];
    var h = hebFromRD(rd), out = {};
    for (var i = 0; i < HEB_DAYS.length; i++) {
      var e = HEB_DAYS[i], s = hebFixed(h.y, e[1] || (hebLeap(h.y) ? 13 : 12), e[2]);
      if (rd >= s && rd < s + e[3]) out[e[0]] = rd - s + 1;
    }
    return (hol_hebC[rd] = out);
  }
  // the solstices and equinoxes, from the sun's declination at Marfa noon
  function hol_dec(days) { return sunEq(days * 86400 + 18 * 3600).dec; }
  function hol_solar(days) {
    var a = hol_dec(days - 1), b = hol_dec(days), c = hol_dec(days + 1);
    if (b > 0.35 && b >= a && b >= c) return 'Summer Solstice';
    if (b < -0.35 && b <= a && b <= c) return 'Winter Solstice';
    if ((a < 0 && b >= 0 && Math.abs(b) <= Math.abs(a)) || (b < 0 && c >= 0 && Math.abs(b) < Math.abs(c))) return 'Spring Equinox';
    if ((a > 0 && b <= 0 && Math.abs(b) <= Math.abs(a)) || (b > 0 && c <= 0 && Math.abs(b) < Math.abs(c))) return 'Autumn Equinox';
    return null;
  }
  // every day the clock knows, at this second
  var hol_last = { key: null, out: null };
  function hol_active(utc, sun, P) {
    var t = marfaTime(utc), eve = t.hours > 12 && sun.el < -0.833, key = t.days * 2 + (eve ? 1 : 0) + (P ? P.seed * 1e6 : 0);
    if (hol_last.key === key) return hol_last.out;
    var out = {}, heb = hebHolidays(t.days + (eve ? 1 : 0) + RD_UNIX), k;
    for (k in heb) out[k] = heb[k];
    var sol = hol_solar(t.days); if (sol) out[sol] = 1;
    if (t.mo === 10 && t.d === 31) out['Halloween'] = 1;
    if (t.mo === 11 && t.d <= 2) out['Day of the Dead'] = t.d;
    var s1 = daysFromCivil(t.y, 9, 1), labor = s1 + (8 - weekday(s1)) % 7;      // first Monday in September
    if (t.days >= labor - 3 && t.days < labor) out['Marfa Lights Festival'] = t.days - labor + 4;
    else if (hash2(t.days, 317, 41) < 0.035) out['Marfa Lights'] = 1;
    if (P) { var rt = marfaTime(P.stillUtc); if (t.mo === rt.mo && t.d === rt.d) out['Residency Day'] = t.y - 2026; }
    hol_last.key = key; hol_last.out = out;
    return out;
  }

  var HOL_LINES = {
    'Rosh Hashanah': 'Rosh Hashanah, the Jewish New Year. Rings of gold go out over the desert in the shofar’s calls, tekiah, shevarim, teruah, and honey coloured light rises for a sweet year.',
    'Yom Kippur': 'Yom Kippur, the Day of Atonement. Memorial candles burn round the clock from sundown to sundown.',
    'Sukkot': 'Sukkot. For seven days a sukkah stands by the clock, roofed in branches so the stars show through, hung with fruit and lights.',
    'Simchat Torah': 'Shemini Atzeret and Simchat Torah. Seven circles of light dance round the clock, one for each hakafah.',
    'Hanukkah': 'Hanukkah. The menorah is lit at sundown, one more candle each night, the shamash above them, and a dreidel spins at its foot.',
    'Tu BiShvat': 'Tu BiShvat, the new year of the trees. Almond blossom blows across Marfa.',
    'Purim': 'Purim. Confetti, everywhere.',
    'Passover': 'Passover. At night the sea parts behind the clock: two walls of water, held back on either side of a dry path.',
    'Lag BaOmer': 'Lag BaOmer. Bonfires burn round the clock after dark.',
    'Shavuot': 'Shavuot. The clock is dressed in greenery and flowers, and petals fall.',
    'Halloween': 'Halloween. Jack-o’-lanterns glow round the clock, and at dusk the bats come out.',
    'Day of the Dead': 'Día de los Muertos. A path of marigolds leads to the clock, papel picado hangs along it, and candles burn at night for the dead.',
    'Summer Solstice': 'The summer solstice. Lines of light on the ground point to where the sun rises and sets today, as far north as it ever goes.',
    'Winter Solstice': 'The winter solstice. Lines of light on the ground point to where the sun rises and sets today, as far south as it ever goes.',
    'Spring Equinox': 'The spring equinox. Lines of light run due east and due west, to where the sun rises and sets today.',
    'Autumn Equinox': 'The autumn equinox. Lines of light run due east and due west, to where the sun rises and sets today.',
    'Residency Day': 'This token’s Residency Day, the April date of its still, every year. A blossom of light turns over the clock, and at the token’s own minute it brightens.',
    'Marfa Lights Festival': 'Marfa Lights Festival weekend. After dark the mystery lights are out under the Chinati skyline, where Zach Warren’s sight-line study puts them: they glow, drift, and now and then split and vanish.',
    'Marfa Lights': 'The Marfa lights. Some nights, without warning, they are out under the Chinati skyline, on the bearings in Zach Warren’s sight-line study.'
  };
  // which builder makes each day (solstices and equinoxes share one)
  var HOL_BUILD = {
    'Rosh Hashanah': 'shofar', 'Yom Kippur': 'yahrzeit', 'Sukkot': 'sukkah', 'Simchat Torah': 'hakafot', 'Hanukkah': 'menorah', 'Tu BiShvat': 'almond',
    'Purim': 'confetti', 'Passover': 'sea', 'Lag BaOmer': 'bonfire', 'Shavuot': 'greenery', 'Halloween': 'halloween', 'Day of the Dead': 'muertos',
    'Summer Solstice': 'sunlines', 'Winter Solstice': 'sunlines', 'Spring Equinox': 'sunlines', 'Autumn Equinox': 'sunlines',
    'Residency Day': 'blossom', 'Marfa Lights Festival': 'orbs', 'Marfa Lights': 'orbs'
  };

  // ------------------------------------------------------------ shared pieces
  // size is in metres: three scales an attenuated point by half the frame
  // height, not the focal length, so it is corrected here for a 38 degree lens
  function hol_pts(n, size, additive, round, atten) {
    if (atten !== false) size *= 2.9;
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    var m = new THREE.PointsMaterial({ size: size, map: round === false ? null : gen_dotTex(), vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, sizeAttenuation: atten !== false });
    if (!additive) m.alphaTest = 0.08;
    var p = new THREE.Points(g, m);
    p.frustumCulled = false; p.renderOrder = 2; p.pos = pos; p.col = col;
    p.flush = function (k) { g.setDrawRange(0, k == null ? n : k); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
    return p;
  }
  function hol_set(p, i, x, y, z, c, b) {
    p.pos[i * 3] = x; p.pos[i * 3 + 1] = y; p.pos[i * 3 + 2] = z;
    p.col[i * 3] = c.r * b; p.col[i * 3 + 1] = c.g * b; p.col[i * 3 + 2] = c.b * b;
  }
  function hol_cols(list) { return list.map(function (h) { return C(h); }); }
  function basic(hex, extra) { var m = new THREE.MeshBasicMaterial({ color: C(hex) }); if (extra) for (var k in extra) m[k] = extra[k]; return m; }
  // petals, confetti, motes, sparks: points falling (dir -1) or rising (+1)
  // through a cylinder, each position a function of time alone
  function hol_drift(H, o) {
    var r = H.r, n = o.n, p = hol_pts(n, o.size * H.fs, o.add, o.round, true), sd = [], cols = hol_cols(o.colors);
    o.h *= H.fs;
    // most of them where the camera is looking, the rest round the clock
    var cam = H.W.cam, ray = new THREE.Vector3();
    for (var i = 0; i < n; i++) {
      var x, z, yb = o.y0 || 0;
      if (i % 4) {
        gen_dir(H.S, rf(r, -1.05, 1.05), rf(r, -0.9, 1), ray);
        var dd = rf(r, Math.min(7, cam.dist * 0.4), cam.dist * 1.5);
        x = cam.pos.x + ray.x * dd; z = cam.pos.z + ray.z * dd; yb = Math.max(yb, cam.pos.y + ray.y * dd - o.h * 0.5);
      } else {
        var a = r() * 6.2832, d = (o.rad0 || 0) + Math.sqrt(r()) * (o.rad - (o.rad0 || 0));
        x = (o.cx || 0) + Math.cos(a) * d; z = (o.cz || 0) + Math.sin(a) * d;
      }
      sd.push([x, z, r(), rf(r, 0.6, 1.4), r() * 6.28, cols[i % cols.length], yb]);
    }
    H.box.add(p);
    return function (a, k) {
      for (var i = 0; i < n; i++) {
        var s = sd[i], f = (s[2] + a * o.speed * s[3] / o.h) % 1, y = s[6] + (o.dir > 0 ? f : 1 - f) * o.h;
        var sw = o.sway || 0, w = o.wind ? f * o.wind : 0;
        var b = k * (o.add ? Math.min(1, f * 6, (1 - f) * 6) : 1) * (o.twinkle ? 0.55 + 0.45 * Math.sin(a * 7 * s[3] + s[4]) : 1);
        hol_set(p, i, s[0] + Math.sin(a * 1.3 * s[3] + s[4]) * sw + H.wind.x * w, y, s[1] + Math.cos(a * 1.1 * s[3] + s[4]) * sw + H.wind.z * w, s[5], b);
      }
      p.flush();
    };
  }
  // a small flame: a few additive points that flicker, for candles and torches
  function hol_flames(H, spots, size, hex) {
    var p = hol_pts(spots.length * 3, size || 0.11, true), c1 = C(hex || '#FFB347'), c2 = C('#FFF1C8');
    var halo = hol_pts(spots.length, (size || 0.11) * 4.5, true);
    H.box.add(p); H.box.add(halo);
    return function (a, lit) {
      var m = 0, hm = 0;
      if (lit > 0.01) for (var i = 0; i < spots.length; i++) {
        var s = spots[i], fl = 0.75 + 0.25 * Math.sin(a * 13 + i * 2.1) * Math.sin(a * 7.3 + i);
        if (s.on === false) continue;
        hol_set(halo, hm++, s.x, s.y + 0.03, s.z, c1, 0.22 * fl * lit);
        hol_set(p, m++, s.x, s.y + 0.02, s.z, c1, 1.4 * fl * lit);
        hol_set(p, m++, s.x, s.y + 0.05 * fl, s.z, c1, 0.8 * fl * lit);
        hol_set(p, m++, s.x, s.y + 0.01, s.z, c2, 0.9 * lit);
      }
      p.flush(m); halo.flush(hm);
    };
  }
  // world position of a point in a group that has been placed
  function hol_world(g, x, y, z) { g.updateMatrixWorld(true); return new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld); }
  function hol_spot(H, o) {
    var S = H.S, save = S.r; S.r = H.r;
    // where it was asked for, and failing that, anywhere in view a little further out
    try {
      return gen_spot(S, { dA: o.dA, dB: o.dB, psiA: o.psiA || 0, psiB: o.psiB || 75, rad: o.rad, y: o.y, side: o.side, ndc: o.ndc || 0.8, tries: 200 }) ||
        gen_spot(S, { dA: o.dA, dB: o.dB * 1.8 + 4, psiA: 0, psiB: 180, rad: o.rad * 0.8, y: o.y, ndc: 0.95, tries: 300 });
    } finally { S.r = save; }
  }
  function hol_place(H, g, spot) { g.position.set(spot.x, spot.y, spot.z); H.W.face(g); H.box.add(g); return g; }
  function hol_night(sun) { return 1 - sstep(-4, 3, sun.el); }

  // ------------------------------------------------------------ the builders
  // each takes H and returns update(ctx, day, a) where a is seconds of animation
  var HOLB = {};
  HOLB.shofar = function (H) {
    var gold = C('#FFC04A'), N = 160, p = hol_pts(N * 13, 0.32 * H.fs, false);
    H.box.add(p);
    var motes = hol_drift(H, { n: 500, size: 0.3, add: true, rad: H.R + 16, y0: 0.2, h: 14, dir: 1, speed: 0.45, sway: 0.6, colors: ['#FFC04A', '#FFD98A', '#C8102E'], twinkle: true });
    // a 32 s round of calls: tekiah, three shevarim, nine teruah, tekiah gedolah
    var calls = [[0, 3.5, 1], [6, 1.2, 0.8], [7.6, 1.2, 0.8], [9.2, 1.2, 0.8]], y = H.top + 2;
    for (var i = 0; i < 9; i++) calls.push([12 + i * 0.45, 0.35, 0.55]);
    calls.push([19, 8, 1.35]);
    // the calls go out from the top of the clock as rings facing the viewer
    var gy = gen_gy(H.S, 0, 0), cy = gy + H.top * 0.85, rt = H.S.rt, big = H.S.tv * H.W.cam.dist * 1.25;
    return function (ctx, day, a) {
      var c = a % 32, m = 0;
      for (var j = 0; j < calls.length; j++) {
        var q = calls[j], u = (c - q[0]) / (q[1] + 3);
        if (u < 0 || u > 1) continue;
        var rad = H.R * 0.3 + u * big * q[2], b = Math.pow(1 - u, 1.1) * (c - q[0] < q[1] ? 1 : 0.6);
        for (var k = 0; k < N; k++) {
          if ((k * 0.618) % 1 > b) continue;
          var an = k / N * 6.2832, x = Math.cos(an) * rad, y = Math.sin(an) * rad;
          if (cy + y < gy + 0.2) continue;
          hol_set(p, m++, rt.x * x, cy + y, rt.z * x, gold, 1.15);
        }
      }
      p.flush(m);
      motes(a, 0.5 + 0.5 * hol_night(ctx.sun));
    };
  };
  HOLB.yahrzeit = function (H) {
    var r = H.r, spots = [], glass = std('#F4F1EA', 0.2, 0, { transparent: true, opacity: 0.85 }), g = new THREE.Group();
    glass.emissive = C('#FFB65C'); glass.emissiveIntensity = 0;
    for (var i = 0; i < 600 && spots.length < 54; i++) {
      var an = r() * 6.2832, d = H.R + rf(r, 0.7, 6 * H.fs), x = Math.cos(an) * d, z = Math.sin(an) * d;
      if (!gen_open(H.S, x, z, 0.12, 1) || !gen_inside(H.S, x, z, 0.3)) continue;
      var y = gen_gy(H.S, x, z), c = cyl(0.045 * H.fs, 0.04 * H.fs, 0.11 * H.fs, 10, glass); c.position.set(x, y + 0.055 * H.fs, z); g.add(c);
      spots.push({ x: x, y: y + 0.12 * H.fs, z: z });
    }
    H.box.add(g); H.pick(g);
    var fl = hol_flames(H, spots, 0.05 * H.fs), motes = hol_drift(H, { n: 300, size: 0.16, add: true, rad: H.R + 6, h: 12, dir: 1, speed: 0.25, sway: 0.4, colors: ['#FFFFFF', '#FFE7C2'] });
    return function (ctx, day, a) { var n = hol_night(ctx.sun); glass.emissiveIntensity = 0.25 + 0.9 * n; fl(a, 1); motes(a, 0.25 + 0.6 * n); };
  };
  HOLB.sukkah = function (H) {
    var sp = hol_spot(H, { dA: H.R + 2.5, dB: H.R + 10, psiA: 25, psiB: 95, rad: 2.2 });
    if (!sp) return null;
    var g = new THREE.Group(), wood = std('#8A6A45', 0.85), cloth = std('#EFE9DC', 0.95, 0, { side: THREE.DoubleSide }), W = 2.6, D = 2.2, Ht = 2.2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { var b = box(0.08, Ht, 0.08, wood); b.position.set(q[0] * W / 2, Ht / 2, q[1] * D / 2); g.add(b); });
    var back = new THREE.Mesh(new THREE.PlaneBufferGeometry(W, 1.9), cloth); back.position.set(0, 1.05, -D / 2); g.add(back);
    [-1, 1].forEach(function (s) { var w = new THREE.Mesh(new THREE.PlaneBufferGeometry(D, 1.9), cloth); w.rotation.y = Math.PI / 2; w.position.set(s * W / 2, 1.05, 0); g.add(w); });
    var beam = box(W + 0.1, 0.07, 0.07, wood); beam.position.set(0, Ht, D / 2); g.add(beam);
    // schach: branches laid across the top, gaps for the stars
    var sch = gen_inst(new THREE.BoxBufferGeometry(0.06, 0.05, D + 0.5), std('#6E7F3C', 0.9), 26, true), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    for (var i = 0; i < 26; i++) { sch.setMatrixAt(i, m4.compose(v.set(-W / 2 + (i + 0.5) * W / 26 + rf(H.r, -0.03, 0.03), Ht + 0.05 + rf(H.r, 0, 0.05), 0), q.setFromEuler(e.set(0, rf(H.r, -0.15, 0.15), rf(H.r, -0.1, 0.1))), sc)); sch.setColorAt(i, C(H.r() < 0.5 ? '#6E7F3C' : '#8C8A4A')); }
    g.add(sch);
    // fruit on strings, swinging
    var fruit = [], fc = ['#F28C28', '#F4D03F', '#C0392B', '#8E1B3A', '#7FB241'];
    for (i = 0; i < 9; i++) {
      var hang = new THREE.Group(), len = rf(H.r, 0.25, 0.55);
      hang.position.set(rf(H.r, -1.1, 1.1), Ht, rf(H.r, -0.8, 0.8));
      var str = box(0.006, len, 0.006, std('#DDD6C8', 0.9)); str.position.y = -len / 2; hang.add(str);
      var f = sph(0.07, std(fc[i % fc.length], 0.5), 10, 8); f.position.y = -len - 0.06; hang.add(f);
      g.add(hang); fruit.push([hang, H.r() * 6.28]);
    }
    hol_place(H, g, sp); shade(g); H.pick(g);
    // string lights along the open front
    var lights = [];
    for (i = 0; i < 18; i++) lights.push(hol_world(g, -W / 2 + i * W / 17, Ht - 0.04 - 0.08 * Math.sin(i / 17 * Math.PI), D / 2 + 0.03));
    var lp = hol_pts(18, 0.06, true), warm = C('#FFD58A');
    H.box.add(lp);
    return function (ctx, day, a) {
      for (var j = 0; j < fruit.length; j++) fruit[j][0].rotation.z = Math.sin(a * 1.1 + fruit[j][1]) * 0.12 * (H.W.windSpeed || 1);
      var n = hol_night(ctx.sun);
      for (j = 0; j < 18; j++) hol_set(lp, j, lights[j].x, lights[j].y, lights[j].z, warm, n * (0.8 + 0.2 * Math.sin(a * 3 + j)));
      lp.flush(n > 0.02 ? 18 : 0);
    };
  };
  HOLB.hakafot = function (H) {
    var p = hol_pts(7 * 14 * 3, 0.32 * H.fs, false), cols = hol_cols(['#FFFFFF', '#7EB8FF', '#2962FF']), gy = gen_gy(H.S, 0, 0);
    H.box.add(p);
    return function (ctx, day, a) {
      var m = 0;
      for (var ring = 0; ring < 7; ring++) {
        var rad = H.R + 0.5 + ring * 0.45 * H.fs, dir = ring % 2 ? -1 : 1, sp = 0.35 - ring * 0.025;
        for (var j = 0; j < 14; j++) for (var tr = 0; tr < 3; tr++) {
          var an = dir * (a - tr * 0.08) * sp + j / 14 * 6.2832 + ring, hop = Math.abs(Math.sin((a - tr * 0.08) * 4 + j + ring)) * 0.35;
          if (tr && (j + tr) % 3 === 0) continue;
          hol_set(p, m++, Math.cos(an) * rad, gy + (0.9 + hop) * H.fs, Math.sin(an) * rad, cols[(j + ring) % 3], 1.1);
        }
      }
      p.flush(m);
    };
  };
  HOLB.menorah = function (H) {
    var sp = hol_spot(H, { dA: H.R + 1.2, dB: H.R + 6, psiA: 10, psiB: 70, rad: 0.9 });
    if (!sp) return null;
    var g = new THREE.Group(), brass = std('#C9A24A', 0.32, 0.9), s = clamp(H.top * 0.75, 1.8, 4) / 2.4, top = 1.95, U = 0.21;
    var base = cyl(0.32, 0.42, 0.12, 24, brass); base.position.y = 0.06; g.add(base);
    var stem = cyl(0.045, 0.06, top + 0.2, 12, brass); stem.position.y = 0.12 + (top + 0.2) / 2 - 0.06; g.add(stem);
    for (var i = 1; i <= 4; i++) {
      var arc = new THREE.Mesh(new THREE.TorusBufferGeometry(i * U, 0.026, 8, 28, Math.PI), brass);
      arc.rotation.z = Math.PI; arc.position.y = top; g.add(arc);
    }
    // nine cups: eight in a row and the shamash raised in the middle
    var slots = [], candleMat = [std('#E8EEF8', 0.6), std('#4A78D8', 0.6)];
    for (i = -4; i <= 4; i++) {
      var x = i * U, y = i === 0 ? top + 0.28 : top;
      var cup = cyl(0.045, 0.03, 0.07, 12, brass); cup.position.set(x, y + 0.035, 0); g.add(cup);
      var cd = cyl(0.017, 0.017, 0.16, 8, candleMat[(i + 4) % 2]); cd.position.set(x, y + 0.15, 0); g.add(cd);
      slots.push({ i: i, lx: x, ly: y + 0.25 });
    }
    // a dreidel at its foot, Hebrew letters on its four sides
    var dr = new THREE.Group(), body = new THREE.Group(), dm = std('#2962FF', 0.35, 0.2);
    var prism = cyl(0.07, 0.07, 0.1, 4, dm); prism.rotation.y = Math.PI / 4; body.add(prism);
    var tip = new THREE.Mesh(new THREE.ConeBufferGeometry(0.07, 0.07, 4), dm); tip.rotation.set(Math.PI, Math.PI / 4, 0); tip.position.y = -0.085; body.add(tip);
    var handle = cyl(0.012, 0.012, 0.06, 6, dm); handle.position.y = 0.08; body.add(handle);
    ['נ', 'ג', 'ה', 'ש'].forEach(function (ch, k) {
      var tex = canvasTex(64, 64, function (c) { c.fillStyle = '#FFFFFF'; c.font = 'bold 50px ' + FONT_SERIF; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 32, 34); });
      var pl = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.085, 0.085), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      pl.rotation.y = k * Math.PI / 2; pl.position.set(Math.sin(k * Math.PI / 2) * 0.0505, 0, Math.cos(k * Math.PI / 2) * 0.0505); body.add(pl);
    });
    body.position.y = 0.12; dr.add(body); dr.position.set(0.75, 0, 0.45); dr.scale.setScalar(1 / s); g.add(dr);
    g.scale.setScalar(s);
    hol_place(H, g, sp); shade(g); H.pick(g, function (day) { return 'Hanukkah, night ' + day + ' of eight. ' + HOL_LINES['Hanukkah'].slice(10); });
    slots.forEach(function (q) { var w = hol_world(g, q.lx, q.ly, 0); q.x = w.x; q.y = w.y; q.z = w.z; });
    // night n lights the n candles furthest to the viewer's right, and the shamash
    var order = slots.filter(function (q) { return q.i !== 0; }).sort(function (A, B) { return B.i - A.i; });
    var fl = hol_flames(H, slots, 0.06 * s), light = new THREE.PointLight(C('#FFB65C'), 0, 9 * s);
    light.position.copy(hol_world(g, 0, top + 0.4, 0.2)); H.box.add(light);
    return function (ctx, day, a) {
      var t = ctx.t, lit = (ctx.sun.el < -1 || t.hours >= 17.5) && !(t.hours >= 2 && t.hours < 12) ? 1 : 0;
      for (var j = 0; j < order.length; j++) order[j].on = j < day;
      slots[4].on = true;
      fl(a, lit); light.intensity = lit * (0.6 + 0.1 * day) * (0.9 + 0.1 * Math.sin(a * 11));
      // the dreidel: a 12 s spin that slows, wobbles, falls and rests
      var c = a % 12, w = c < 9 ? c - c * c / 18 : 4.5;
      body.rotation.y = w * 18;
      var tilt = c < 7 ? 0.05 + 0.02 * Math.sin(a * 9) : c < 9 ? 0.05 + Math.pow((c - 7) / 2, 2) * 1.05 : 1.1;
      dr.rotation.x = tilt * Math.cos(w * 3); dr.rotation.z = tilt * Math.sin(w * 3);
    };
  };
  HOLB.almond = function (H) {
    var d = hol_drift(H, { n: 1200, size: 0.22, rad: H.R + 20, h: 11, dir: -1, speed: 0.55, sway: 0.9, wind: 7, colors: ['#FFFFFF', '#F4B6CB', '#EE9DB8', '#F7D0DD'] });
    return function (ctx, day, a) { d(a, 1); };
  };
  HOLB.confetti = function (H) {
    var d = hol_drift(H, { n: 1200, size: 0.12, round: false, rad: H.R + 14, h: 12, dir: -1, speed: 0.7, sway: 0.7, wind: 4, colors: ['#FF2E63', '#2962FF', '#00E5FF', '#D7FF1F', '#3DFFC0', '#FFFFFF', '#B072FF'] });
    return function (ctx, day, a) { d(a, 1); };
  };
  HOLB.sea = function (H) {
    var c = H.W.cam, N = 1600, p = hol_pts(N * 2, 0.22, true), cols = hol_cols(['#2962FF', '#7EB8FF', '#00E5FF', '#1B3F8A']), sd = [];
    for (var i = 0; i < N * 2; i++) sd.push([H.r(), H.r(), H.r(), cols[i % 4]]);
    H.box.add(p);
    var dx = c.dir.x, dz = c.dir.z, rx = c.right.x, rz = c.right.z, lane = H.R + 2.5;
    return function (ctx, day, a) {
      var k = 0.25 + 0.95 * hol_night(ctx.sun);
      for (var i = 0; i < N * 2; i++) {
        var s = sd[i], side = i < N ? -1 : 1, u = s[0], v = (s[1] + a * 0.12 * (0.6 + s[2])) % 1;
        var along = 2 + u * 80, hgt = (6 + u * 6) * v, half = lane + along * 0.06;
        var curl = v > 0.82 ? (v - 0.82) * 9 : 0, lat = side * (half + Math.sin(v * 3.1416) * 0.6 + curl + Math.sin(a * 0.7 + u * 20) * 0.25);
        hol_set(p, i, dx * along + rx * lat, gen_gy(H.S, 0, 0) + hgt + (curl ? -curl * curl * 0.15 : 0), dz * along + rz * lat, s[3], k * (0.35 + 0.65 * v));
      }
      p.flush();
    };
  };
  HOLB.bonfire = function (H) {
    var fires = [], fs = clamp(H.R / 3, 1, 2.2);
    for (var f = 0; f < 3; f++) {
      var sp = hol_spot(H, { dA: H.R + 3, dB: H.R + 16, psiA: 20, psiB: 150, rad: 1.4 * fs });
      if (!sp) continue;
      var g = new THREE.Group(), wood = std('#5B3A22', 0.95);
      for (var l = 0; l < 7; l++) { var lg = cyl(0.06, 0.07, 1.3, 7, wood), an = l / 7 * 6.2832; lg.position.set(Math.cos(an) * 0.28, 0.5, Math.sin(an) * 0.28); lg.rotation.set(Math.sin(an) * 0.45, 0, -Math.cos(an) * 0.45); g.add(lg); }
      g.scale.setScalar(fs); hol_place(H, g, sp); shade(g); H.pick(g);
      var light = new THREE.PointLight(C('#FF8A3D'), 0, 16 * fs); light.position.set(sp.x, sp.y + 1.2 * fs, sp.z); H.box.add(light);
      fires.push({ x: sp.x, y: sp.y, z: sp.z, light: light, seed: f * 7.1 });
    }
    var p = hol_pts(fires.length * 190, 0.2 * fs, true), yel = C('#FFE08A'), org = C('#FF8A3D'), red = C('#C8261E'), tmp = new THREE.Color();
    H.box.add(p);
    return function (ctx, day, a) {
      var lit = hol_night(ctx.sun) > 0.3 ? 1 : 0, m = 0;
      for (var i = 0; i < fires.length; i++) {
        var F = fires[i];
        F.light.intensity = lit * (2.2 + 0.6 * Math.sin(a * 9 + F.seed) * Math.sin(a * 5.3));
        if (!lit) continue;
        for (var j = 0; j < 190; j++) {
          var ember = j >= 160, sp = ember ? 0.25 : 1.2, f = (hash2(j, i, 5) + a * sp * (0.7 + hash2(j, i, 6) * 0.6)) % 1;
          var an = hash2(j, i, 7) * 6.2832 + a * (ember ? 0.3 : 1.5), rr = (ember ? 0.3 + f * 1.5 : (1 - f) * 0.55) * fs;
          var y = F.y + (0.3 + f * (ember ? 9 : 2.3)) * fs;
          tmp.copy(yel).lerp(f < 0.5 ? org : red, ember ? 0.6 : f);
          hol_set(p, m++, F.x + Math.cos(an) * rr, y, F.z + Math.sin(an) * rr, tmp, (ember ? 0.9 : 1.4) * (1 - f));
        }
      }
      p.flush(m);
    };
  };
  HOLB.greenery = function (H) {
    var gy = gen_gy(H.S, 0, 0), leaf = new THREE.IcosahedronBufferGeometry(0.11, 0), N = 240, M = 90;
    var lv = gen_inst(leaf, std('#4E7A35', 0.8), N, false), fl = gen_inst(new THREE.IcosahedronBufferGeometry(0.07, 0), std('#FFFFFF', 0.7), M, false);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), fc = ['#FFFFFF', '#F7B6CF', '#E85D8E', '#FFE27A'];
    for (var i = 0; i < N + M; i++) {
      var an = H.r() * 6.2832, rad = H.R * 0.92 + rf(H.r, -0.15, 0.35), isF = i >= N, s = rf(H.r, 0.7, 1.4);
      m4.compose(v.set(Math.cos(an) * rad, gy + rf(H.r, 0.02, 0.2), Math.sin(an) * rad), q.setFromEuler(e.set(H.r() * 3, H.r() * 3, 0)), sc.set(s, s * 0.6, s));
      if (isF) { fl.setMatrixAt(i - N, m4); fl.setColorAt(i - N, C(fc[i % 4])); } else { lv.setMatrixAt(i, m4); lv.setColorAt(i, C(H.r() < 0.5 ? '#4E7A35' : '#6F9A45')); }
    }
    H.box.add(lv); H.box.add(fl); H.pick(lv);
    var d = hol_drift(H, { n: 1000, size: 0.22, rad: H.R + 12, h: 10, dir: -1, speed: 0.45, sway: 0.8, wind: 5, colors: ['#F7B6CF', '#E85D8E', '#FFFFFF', '#7FB241'] });
    return function (ctx, day, a) { d(a, 1); };
  };
  HOLB.halloween = function (H) {
    var faces = [], face = canvasTex(128, 128, function (c) {
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.moveTo(30, 52); c.lineTo(50, 52); c.lineTo(40, 30); c.fill();
      c.beginPath(); c.moveTo(78, 52); c.lineTo(98, 52); c.lineTo(88, 30); c.fill();
      c.beginPath(); c.moveTo(22, 74); for (var k = 0; k <= 8; k++) c.lineTo(22 + k * 10.5, k % 2 ? 84 : 74); c.lineTo(106, 92); c.quadraticCurveTo(64, 112, 22, 92); c.fill();
    });
    for (var n = 0; n < 5; n++) {
      var sp = hol_spot(H, { dA: H.R + 0.9, dB: H.R + 7, psiA: 0, psiB: 85, rad: 0.4 * clamp(H.R / 3, 1, 2.2) });
      if (!sp) continue;
      var g = new THREE.Group(), rr = rf(H.r, 0.2, 0.32) * clamp(H.R / 3, 1, 2.2), geo = new THREE.SphereBufferGeometry(1, 24, 16), pa = geo.attributes.position;
      for (var i = 0; i < pa.count; i++) { var x = pa.getX(i), z = pa.getZ(i), rib = 1 - 0.07 * Math.abs(Math.sin(Math.atan2(z, x) * 4)); pa.setXYZ(i, x * rib, pa.getY(i) * 0.82, z * rib); }
      geo.computeVertexNormals();
      var pk = new THREE.Mesh(geo, std('#E8741E', 0.6)); pk.scale.setScalar(rr); pk.position.y = rr * 0.8; g.add(pk);
      var st = cyl(0.025, 0.035, 0.09, 6, std('#4B5A2A', 0.8)); st.position.y = rr * 1.62 + 0.03; g.add(st);
      var fm = new THREE.MeshBasicMaterial({ map: face, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: C('#FFB547') });
      var fp = new THREE.Mesh(new THREE.PlaneBufferGeometry(rr * 1.3, rr * 1.3), fm); fp.position.set(0, rr * 0.82, rr * 0.985); g.add(fp);
      hol_place(H, g, sp); g.rotation.y += rf(H.r, -0.4, 0.4); shade(g); H.pick(g);
      faces.push(fm);
    }
    // bats: two wings and a body, circling and flapping at dusk
    var bats = [], bm = basic('#15151C', { side: THREE.DoubleSide }), wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.06, 0, 0, 0.08, 0.32, 0.03, -0.02, 0, 0, 0.08, 0.32, 0.03, -0.02, 0.22, 0.02, 0.08], 3));
    for (n = 0; n < 24; n++) {
      var b = new THREE.Group(), L = new THREE.Mesh(wg, bm), R2 = new THREE.Mesh(wg, bm);
      R2.scale.x = -1; b.add(L); b.add(R2); b.add(new THREE.Mesh(new THREE.SphereBufferGeometry(0.05, 6, 4), bm));
      b.scale.setScalar(rf(H.r, 0.9, 1.4)); H.box.add(b);
      bats.push({ g: b, L: L, R: R2, rad: H.R + rf(H.r, 2, 16), h: H.top * 0.6 + rf(H.r, 2, 10), sp: rf(H.r, 0.35, 0.8) * (H.r() < 0.5 ? -1 : 1), ph: H.r() * 6.28, fl: rf(H.r, 9, 14) });
    }
    return function (ctx, day, a) {
      var n = hol_night(ctx.sun), dusk = ctx.sun.el < 6;
      for (var i = 0; i < faces.length; i++) faces[i].color.setRGB(1, 0.71, 0.28).multiplyScalar((0.12 + 1.1 * n) * (0.85 + 0.15 * Math.sin(a * 11 + i * 3)));
      for (i = 0; i < bats.length; i++) {
        var B = bats[i], an = a * B.sp + B.ph, x = Math.cos(an) * B.rad + Math.sin(an * 2.3) * 2, z = Math.sin(an) * B.rad, y = B.h + Math.sin(an * 3.1) * 1.5;
        B.g.visible = dusk;
        B.g.position.set(x, y, z); B.g.rotation.y = -an + (B.sp > 0 ? 0 : Math.PI);
        var flap = Math.sin(a * B.fl + B.ph) * 0.8; B.L.rotation.z = flap; B.R.rotation.z = -flap;
      }
    };
  };
  HOLB.muertos = function (H) {
    var c = H.W.cam, S = H.S, gy = function (x, z) { return gen_gy(S, x, z); };
    var dx = -c.dir.x, dz = -c.dir.z, rx = c.right.x, rz = c.right.z, far = Math.max(4, c.dist * 0.75 - H.R);
    // the marigold path, from near the camera to the clock
    var N = 320, mg = gen_inst(new THREE.IcosahedronBufferGeometry(0.06, 0), std('#FF9F1C', 0.75), N, false);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), mc = ['#FF9F1C', '#FFB627', '#F77F00', '#E85D04'], k = 0;
    for (var i = 0; i < 1200 && k < N; i++) {
      var t = H.r(), along = H.R + 0.5 + t * far, lat = (H.r() - 0.5) * (0.7 + t * 0.6), x = dx * along + rx * lat, z = dz * along + rz * lat;
      if (!gen_open(S, x, z, 0.03, 1)) continue;
      var s = rf(H.r, 0.7, 1.3);
      mg.setMatrixAt(k, m4.compose(v.set(x, gy(x, z) + 0.03, z), q.setFromEuler(e.set(H.r(), H.r() * 3, 0)), sc.set(s, s * 0.55, s)));
      mg.setColorAt(k++, C(mc[k % 4]));
    }
    mg.count = k; H.box.add(mg); H.pick(mg);
    // papel picado on two strings along the path, and candles beside it
    var flags = [], pc = ['#FF2E63', '#B072FF', '#00E5FF', '#FF9F1C', '#3DFFC0', '#2962FF'], spots = [];
    var cut = canvasTex(64, 80, function (g2) {
      g2.fillStyle = '#FFFFFF'; g2.fillRect(0, 0, 64, 80); g2.globalCompositeOperation = 'destination-out';
      for (var y = 0; y < 3; y++) for (var x = 0; x < 3; x++) { g2.beginPath(); g2.arc(14 + x * 18, 18 + y * 20, 5, 0, 6.3); g2.fill(); }
      g2.beginPath(); for (var z = 0; z <= 8; z++) g2.lineTo(z * 8, z % 2 ? 72 : 80); g2.lineTo(64, 80); g2.lineTo(0, 80); g2.fill();
    });
    [-1, 1].forEach(function (side) {
      var off = side * 1.7, a0 = H.R + 1, a1 = H.R + far;
      for (var j = 0; j < 16; j++) {
        var u = (j + 0.5) / 16, along = a0 + u * (a1 - a0), x = dx * along + rx * off, z = dz * along + rz * off, sag = Math.sin(u * Math.PI) * 0.35;
        var f = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.32, 0.4), new THREE.MeshBasicMaterial({ map: cut, color: C(pc[j % pc.length]), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
        f.geometry.translate(0, -0.2, 0);
        f.position.set(x, gy(x, z) + 2.7 - sag, z); f.rotation.y = Math.atan2(rx, rz); H.box.add(f); flags.push([f, j * 0.7 + side]);
      }
      [a0, a1].forEach(function (al) { var x = dx * al + rx * off, z = dz * al + rz * off, pole = cyl(0.025, 0.03, 2.75, 6, std('#6B4E2E', 0.9)); pole.position.set(x, gy(x, z) + 1.375, z); H.box.add(pole); });
      for (var j2 = 0; j2 < 6; j2++) { var al2 = a0 + (j2 + 0.5) / 6 * (a1 - a0), x2 = dx * al2 + rx * side * 0.7, z2 = dz * al2 + rz * side * 0.7, cn = cyl(0.03, 0.03, 0.12, 8, std('#F4EEDC', 0.6)); cn.position.set(x2, gy(x2, z2) + 0.06, z2); H.box.add(cn); spots.push({ x: x2, y: gy(x2, z2) + 0.14, z: z2 }); }
    });
    var fl = hol_flames(H, spots, 0.045);
    return function (ctx, day, a) {
      for (var j = 0; j < flags.length; j++) flags[j][0].rotation.x = Math.sin(a * 2.2 + flags[j][1]) * 0.25 * (H.W.windSpeed || 1);
      fl(a, hol_night(ctx.sun));
    };
  };
  HOLB.sunlines = function (H) {
    var gy = gen_gy(H.S, 0, 0), L = 60, lines = [], mat;
    [0, 1].forEach(function (k) {
      mat = new THREE.MeshBasicMaterial({ color: C('#FFC04A'), polygonOffset: true, polygonOffsetFactor: -2 });
      var strip = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.45 * H.fs, L).rotateX(-Math.PI / 2).translate(0, 0, -(H.R + 0.6 + L / 2)), mat);
      var g = new THREE.Group(); g.position.y = gy + 0.04; g.add(strip);
      var st = box(0.35, 1.1, 0.35, mtl('#D8CBB2', 'limestone', 0.85)); st.position.set(0, 0.55, -(H.R + 0.6 + L)); g.add(st);
      // a row of lit markers along the line, so it reads above the grass
      var bm = new THREE.MeshBasicMaterial({ color: C('#FFC04A') }), bh = 0.6 * H.fs, nb = 14;
      var bl = gen_inst(new THREE.BoxBufferGeometry(0.22 * H.fs, bh, 0.22 * H.fs), bm, nb, false), m4 = new THREE.Matrix4();
      for (var b = 0; b < nb; b++) bl.setMatrixAt(b, m4.makeTranslation(0, bh / 2, -(H.R + 1.2 + b * L / nb)));
      g.add(bl);
      H.box.add(g); lines.push({ g: g, m: mat, b: bm });
    });
    H.pick(lines[0].g);
    return function (ctx, day, a) {
      // where the sun rises and sets today, from today's declination
      var ca = clamp(Math.sin(ctx.sun.dec) / CPHI, -1, 1), rise = Math.acos(ca) * R2D, el = ctx.sun.el;
      var glow = 0.55 + 0.9 * Math.exp(-Math.pow((el - 1) / 4, 2));
      [rise, 360 - rise].forEach(function (az, k) {
        var d = dirAzEl(az, 0);
        lines[k].g.rotation.y = Math.atan2(-d.x, -d.z);
        lines[k].m.color.setRGB(1, 0.75, 0.29).multiplyScalar(glow * (0.8 + 0.2 * Math.sin(a * 1.5 + k)));
        lines[k].b.color.copy(lines[k].m.color);
      });
    };
  };
  HOLB.blossom = function (H) {
    var P = H.W.P, rr = clamp(H.R * 0.55, 0.9, 4), y = gen_gy(H.S, 0, 0) + H.top + 0.7, N = 90, p = hol_pts(7 * N, 0.16 * H.fs, false), cols = hol_cols(['#2962FF', '#00E5FF', '#7EB8FF']);
    H.box.add(p);
    var mine = marfaTime(P.stillUtc), minute = mine.h * 60 + mine.m;
    return function (ctx, day, a) {
      var now = ctx.t.h * 60 + ctx.t.m + ctx.t.s / 60, near = Math.exp(-Math.pow((now - minute) / 3, 2)), m = 0;
      var spin = a * (0.08 + near * 0.6), pulse = 1 + near * (0.4 + 0.3 * Math.sin(a * 6));
      for (var c = 0; c < 7; c++) {
        var cx = c ? Math.cos(spin + c / 6 * 6.2832) * rr : 0, cz = c ? Math.sin(spin + c / 6 * 6.2832) * rr : 0;
        for (var j = 0; j < N; j++) { var an = j / N * 6.2832 + spin; hol_set(p, m++, cx + Math.cos(an) * rr * pulse, y + Math.sin(an * 2 + a) * 0.08, cz + Math.sin(an) * rr * pulse, cols[(c + j) % 3], 1); }
      }
      p.flush(m);
    };
  };
  // The lights stand where the sight-line study puts them: Zach Warren,
  // "Separating the known from the unknown at Marfa, Texas" (v1.0, 2026,
  // doi:10.5281/zenodo.23046856, github.com/zacharyslate/marfa-lights-investigation).
  // From the Viewing Area the lights over Mitchell Flat sit just under the
  // Chinati skyline at 229-238 degrees true, 24-40 km out; from town that same
  // stretch lies at 203.6-210.1 degrees, 18-34 km. A typical one is magnitude
  // +2.6 and can outshine Sirius; it shows for about 17 s (the median window)
  // and drifts about 0.9 degrees a minute. Only his published numbers are used
  // here, not his code. What splits in two is the part nobody has explained.
  var ORB_BAND = { town: [203.6, 210.1], platform: [229, 238] };
  HOLB.orbs = function (H) {
    var c = H.W.cam, N = 7, p = hol_pts(N * 2, 16, true, true, false), cols = hol_cols(['#FFF6DE', '#FFF6DE', '#FFE08A', '#FFB65C', '#FF6A4D']), seed = Math.floor(H.r() * 1e6);
    H.box.add(p);
    var band = H.W.P.place === 'Marfa Lights Viewing Area' ? ORB_BAND.platform : ORB_BAND.town, base = [];
    for (var i = 0; i < N; i++) {
      var az = rf(H.r, band[0], band[1]), d = dirAzEl(az, 0), D = rf(H.r, 950, 1300);
      // magnitude +2.6 typical; brightness relative to that by Pogson's ratio
      var mag = 2.6 + (H.r() + H.r() + H.r() - 1.5) * 2.4;
      base.push({ x: d.x * D, z: d.z * D, rx: -d.z, rz: d.x, D: D, h: rf(H.r, 22, 48), L: rf(H.r, 26, 60), off: H.r() * 60,
        b: clamp(1.7 * Math.pow(10, -0.4 * (mag - 2.6)), 0.3, 4.5), dir: H.r() < 0.5 ? -1 : 1 });
    }
    var w = 0.9 * D2R / 60;                                 // 0.9 degrees a minute, in radians a second
    return function (ctx, day, a) {
      var m = 0, dark = 1 - sstep(-10, -6, ctx.sun.el);
      if (dark > 0.01) for (var i = 0; i < N; i++) {
        var o = base[i], tt = a + o.off, k = Math.floor(tt / o.L), u = tt / o.L - k;
        if (hash2(i, k, seed) >= 0.75) continue;
        // on for 10-25 s of the slot, around the 17 s median
        var on = (10 + hash2(i, k, seed + 2) * 15) / o.L, a0 = hash2(i, k, seed + 1) * (0.95 - on), a1 = a0 + on;
        var env = sstep(a0, a0 + 1.2 / o.L, u) * (1 - sstep(a1 - 1.5 / o.L, a1, u)), b = env * dark * o.b * (0.85 + 0.15 * Math.sin(tt * 2.3 + i));
        if (b <= 0.01) continue;
        var drift = o.dir * (u - a0) * o.L * w * o.D, col = cols[Math.floor(hash2(i, k, seed + 4) * 5)];
        var split = hash2(i, k, seed + 5) < 0.15 ? sstep((a0 + a1) / 2, a1, u) * 0.8 * D2R * o.D : 0;
        hol_set(p, m++, o.x + o.rx * (drift - split), o.h + Math.sin(tt * 0.5) * 0.6, o.z + o.rz * (drift - split), col, b);
        if (split > 0) hol_set(p, m++, o.x + o.rx * (drift + split), o.h + Math.sin(tt * 0.5 + 1) * 0.6, o.z + o.rz * (drift + split), col, b);
      }
      p.flush(m);
    };
  };

  // ------------------------------------------------------------ the step in the build
  function cal_holidays(S) {
    var W = S.W, P = W.P, seed = Math.floor(hashRng(P.hash, 9501)() * 4294967296) >>> 0, made = {}, pickAt = {};
    var proxy = new THREE.Mesh(new THREE.SphereBufferGeometry(4150, 16, 8, 0, 6.2832, 0, 1.5), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    proxy.visible = false; proxy.layers.set(31); S.box.add(proxy);
    var skyPick = { obj: proxy, name: 'Calendar', line: '' };
    W.picks.push(skyPick);
    function make(kind) {
      var box = new THREE.Group(), H = { S: S, W: W, R: S.R, top: S.H || 3, box: box, fs: clamp(S.R / 3, 1, 2.2), wind: W.windDir.clone().multiplyScalar(W.windSpeed || 1),
        r: seedRng((seed ^ Math.imul(kind.length * 131 + kind.charCodeAt(0) * 7 + kind.charCodeAt(1), 2654435761)) >>> 0), picks: [] };
      H.pick = function (o, fn) { var pk = { obj: o, name: '', line: '', fn: fn }; W.picks.push(pk); H.picks.push(pk); };
      S.box.add(box);
      var up = null;
      try { up = HOLB[kind](H); } catch (e) { if (root.MARFA_GEN_STRICT) throw e; if (root.console) console.warn('holiday', kind, e); }
      return { box: box, up: up, H: H };
    }
    var clockT = null, lastU = null;
    W.onUpdate(function (ctx) {
      // the same show clock as the fireworks: it follows Marfa time and keeps
      // playing while the clock is held still
      if (clockT == null || ctx.snap || ctx.fast || Math.abs(ctx.utc - lastU - ctx.dt) > 5) clockT = ctx.utc % 86400;
      else clockT += ctx.utc === lastU ? ctx.dt : ctx.utc - lastU;
      lastU = ctx.utc;
      var on = hol_active(ctx.utc, ctx.sun, P), live = {}, names = [];
      for (var name in on) {
        var kind = HOL_BUILD[name];
        if (!kind) continue;
        if (!made[kind]) made[kind] = make(kind);
        var E = made[kind];
        if (!E.up) continue;
        live[kind] = 1; names.push(name);
        E.box.visible = true;
        E.up(ctx, on[name], clockT);
        for (var i = 0; i < E.H.picks.length; i++) { var pk = E.H.picks[i]; pk.name = name; pk.line = pk.fn ? pk.fn(on[name]) : HOL_LINES[name]; }
      }
      for (var k in made) if (!live[k]) made[k].box.visible = false;
      proxy.position.copy(ctx.camera.position);
      proxy.layers.set(names.length ? 0 : 31);
      if (names.length) { skyPick.name = names.join(' · '); skyPick.line = names.map(function (n) { return HOL_LINES[n]; }).join(' '); }
      W.holidays = names;
    });
  }

  // the next day on the calendar after a moment, for the K key and the site:
  // the first evening it is on, or for a day thing, an hour before sunset
  function hol_next(utc, P, want) {
    var t0 = marfaTime(utc), cur = want ? {} : hol_active(utc, sunPos(utc), P), cf = calEvent(utc);
    if (cf) { cur = Object.assign({}, cur); cur[cf] = 1; }
    for (var i = 0; i < 800; i++) {
      var c = civilFromDays(t0.days + i), tries = [[21, 30], [18, 30], [12, 0]];
      for (var j = 0; j < tries.length; j++) {
        var u = marfaUtc(c[0], c[1], c[2], tries[j][0], tries[j][1]);
        if (u <= utc + 600) continue;
        var names = Object.keys(hol_active(u, sunPos(u), P)), fw = calEvent(u + 1650);
        if (fw && names.indexOf(fw) < 0) names.push(fw);
        if (want ? names.indexOf(want) >= 0 : names.some(function (n) { return !(n in cur); })) return { utc: fw && (!want || want === fw) ? u + 1650 : u, names: names };
      }
    }
    return null;
  }
  // every named day, for menus
  var CAL_DAYS = ['Fourth of July', 'Juneteenth', 'New Year', 'Rosh Hashanah', 'Yom Kippur', 'Sukkot', 'Simchat Torah', 'Hanukkah', 'Tu BiShvat', 'Purim', 'Passover',
    'Lag BaOmer', 'Shavuot', 'Halloween', 'Day of the Dead', 'Summer Solstice', 'Winter Solstice', 'Spring Equinox', 'Autumn Equinox', 'Residency Day', 'Marfa Lights Festival'];
