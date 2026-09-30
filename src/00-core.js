  // =====================================================================
  // CORE: place, randomness, noise, Marfa time, the sun and the moon
  // =====================================================================
  var THREE = root.THREE;
  var LAT = 30.3095, LON = -104.0206;               // Marfa, Texas
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var PHI = LAT * D2R, SPHI = Math.sin(PHI), CPHI = Math.cos(PHI);

  // ------------------------------------------------------------ randomness
  function sfc32(a, b, c, d) {
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function hashRng(hash, salt) {
    var h = hash.slice(2), s = [], k;
    for (var i = 0; i < 4; i++) {
      s.push((parseInt(h.substr(i * 8, 8), 16) ^ parseInt(h.substr(32 + i * 8, 8), 16) ^ Math.imul((salt || 0) + i, 0x9E3779B1)) >>> 0);
    }
    var r = sfc32(s[0], s[1], s[2], s[3]);
    for (k = 0; k < 24; k++) r();
    return r;
  }
  function seedRng(n) {
    var r = sfc32(n >>> 0, (n ^ 0x9E3779B9) >>> 0, Math.imul(n, 0x85EBCA6B) >>> 0, 0x317);
    for (var k = 0; k < 16; k++) r();
    return r;
  }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function rf(r, a, b) { return a + (b - a) * r(); }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function pickW(r, t) {
    var total = 0, i;
    for (i = 0; i < t.length; i++) total += t[i][1];
    var x = r() * total;
    for (i = 0; i < t.length; i++) { x -= t[i][1]; if (x < 0) return t[i][0]; }
    return t[t.length - 1][0];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ------------------------------------------------------------ noise
  function hash2(ix, iy, s) {
    var h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash2(ix, iy, s), hash2(ix + 1, iy, s), ux), lerp(hash2(ix, iy + 1, s), hash2(ix + 1, iy + 1, s), ux), uy);
  }
  function fbm(x, y, s, oct) {
    var v = 0, amp = 0.5, f = 1;
    for (var i = 0; i < (oct || 4); i++) { v += amp * vnoise(x * f, y * f, s + i * 17); f *= 2.03; amp *= 0.5; }
    return v;
  }

  // ------------------------------------------------------------ Marfa time
  // Civil calendar arithmetic (Howard Hinnant). No Date object is needed.
  function daysFromCivil(y, m, d) {
    y -= (m <= 2) ? 1 : 0;
    var era = Math.floor(y / 400), yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function civilFromDays(z) {
    z += 719468;
    var era = Math.floor(z / 146097), doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400, doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp + (mp < 10 ? 3 : -9);
    return [y + (m <= 2 ? 1 : 0), m, d];
  }
  function weekday(days) { return (((days % 7) + 7) % 7 + 4) % 7; }   // 0 is Sunday
  function nthSunday(y, m, n) {
    var d1 = daysFromCivil(y, m, 1);
    return d1 + ((7 - weekday(d1)) % 7) + 7 * (n - 1);
  }
  // US Central: daylight time from 2:00 on the second Sunday in March to
  // 2:00 on the first Sunday in November.
  function marfaOffset(utc) {
    var y = civilFromDays(Math.floor(utc / 86400))[0];
    var s = nthSunday(y, 3, 2) * 86400 + 8 * 3600, e = nthSunday(y, 11, 1) * 86400 + 7 * 3600;
    return (utc >= s && utc < e) ? -5 : -6;
  }
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function marfaTime(utc) {
    var off = marfaOffset(utc), l = utc + off * 3600, days = Math.floor(l / 86400), sec = l - days * 86400;
    var ymd = civilFromDays(days);
    return {
      utc: utc, off: off, dst: off === -5, zone: off === -5 ? 'CDT' : 'CST', days: days,
      y: ymd[0], mo: ymd[1], d: ymd[2], sec: sec,
      h: Math.floor(sec / 3600), m: Math.floor(sec / 60) % 60, s: Math.floor(sec) % 60, hours: sec / 3600
    };
  }
  function marfaUtc(y, mo, d, h, mi) {
    var guess = daysFromCivil(y, mo, d) * 86400 + h * 3600 + mi * 60 + 6 * 3600;
    return guess + (-6 - marfaOffset(guess)) * 3600;
  }

  // ------------------------------------------------------------ astronomy
  function jd(utc) { return utc / 86400 + 2440587.5; }
  function lst(utc) {
    var n = jd(utc) - 2451545.0;
    var g = (18.697374558 + 24.06570982441908 * n) % 24;
    return (((g * 15 + LON) % 360) + 360) % 360 * D2R;
  }
  function altAz(ra, dec, L) {
    var H = L - ra;
    var el = Math.asin(SPHI * Math.sin(dec) + CPHI * Math.cos(dec) * Math.cos(H)) * R2D;
    var az = Math.atan2(-Math.sin(H), Math.tan(dec) * CPHI - SPHI * Math.cos(H)) * R2D;
    return { el: el, az: (az + 360) % 360 };
  }
  function sunEq(utc) {
    var n = jd(utc) - 2451545.0;
    var L = (280.46 + 0.9856474 * n) % 360;
    var g = ((357.528 + 0.9856003 * n) % 360) * D2R;
    var lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
    var eps = 23.439 * D2R;
    return {
      ra: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)),
      dec: Math.asin(Math.sin(eps) * Math.sin(lam)), lon: lam
    };
  }
  function sunPos(utc) {
    var q = sunEq(utc), p = altAz(q.ra, q.dec, lst(utc));
    p.dec = q.dec; return p;
  }
  // The moon, after Paul Schlyter's low precision method. Good to a fraction
  // of a degree, which is finer than a pixel of its disc.
  function moonPos(utc) {
    var d = jd(utc) - 2451543.5;
    var N = (125.1228 - 0.0529538083 * d) * D2R, inc = 5.1454 * D2R;
    var w = (318.0634 + 0.1643573223 * d) * D2R, a = 60.2666, e = 0.0549;
    var M = ((115.3654 + 13.0649929509 * d) % 360) * D2R;
    var E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (var k = 0; k < 3; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    var xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    var v = Math.atan2(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
    var xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(inc));
    var yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(inc));
    var zh = r * Math.sin(v + w) * Math.sin(inc);
    var lon = Math.atan2(yh, xh) * R2D, lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) * R2D;
    var Ms = (356.0470 + 0.9856002585 * d) % 360, ws = 282.9404 + 4.70935e-5 * d;
    var Ls = Ms + ws, Mm = M * R2D, Lm = N * R2D + w * R2D + Mm, D = Lm - Ls, F = Lm - N * R2D;
    var s = function (x) { return Math.sin(x * D2R); };
    lon += -1.274 * s(Mm - 2 * D) + 0.658 * s(2 * D) - 0.186 * s(Ms) - 0.059 * s(2 * Mm - 2 * D)
      - 0.057 * s(Mm - 2 * D + Ms) + 0.053 * s(Mm + 2 * D) + 0.046 * s(2 * D - Ms) + 0.041 * s(Mm - Ms)
      - 0.035 * s(D) - 0.031 * s(Mm + Ms) - 0.015 * s(2 * F - 2 * D) + 0.011 * s(Mm - 4 * D);
    lat += -0.173 * s(F - 2 * D) - 0.055 * s(Mm - F - 2 * D) - 0.046 * s(Mm + F - 2 * D) + 0.033 * s(F + 2 * D) + 0.017 * s(2 * Mm + F);
    var ecl = (23.4393 - 3.563e-7 * d) * D2R, lo = lon * D2R, la = lat * D2R;
    var xe = Math.cos(la) * Math.cos(lo), ye = Math.cos(la) * Math.sin(lo), ze = Math.sin(la);
    var y2 = ye * Math.cos(ecl) - ze * Math.sin(ecl), z2 = ye * Math.sin(ecl) + ze * Math.cos(ecl);
    var ra = Math.atan2(y2, xe), dec = Math.atan2(z2, Math.sqrt(xe * xe + y2 * y2));
    var p = altAz(ra, dec, lst(utc));
    var dl = ((lon - Ls) % 360 + 360) % 360;
    var elong = Math.acos(Math.cos(dl * D2R) * Math.cos(la));
    p.illum = (1 - Math.cos(elong)) / 2;
    p.waxing = dl < 180;
    p.age = dl / 360;
    return p;
  }
  function moonName(m) {
    var a = m.age;
    if (a < 0.03 || a > 0.97) return 'NEW MOON';
    if (a < 0.22) return 'WAXING CRESCENT';
    if (a < 0.28) return 'FIRST QUARTER';
    if (a < 0.47) return 'WAXING GIBBOUS';
    if (a < 0.53) return 'FULL MOON';
    if (a < 0.72) return 'WANING GIBBOUS';
    if (a < 0.78) return 'LAST QUARTER';
    return 'WANING CRESCENT';
  }
  // a direction from azimuth (clockwise from north) and elevation, in the
  // scene's frame: +x east, +y up, -z north
  function dirAzEl(az, el, out) {
    var a = az * D2R, e = el * D2R;
    return (out || new THREE.Vector3()).set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a));
  }
  // hour angle of the sun, in degrees, when a clock on Central Standard Time
  // reads H. Marfa sits 14 degrees west of the zone meridian, so the sun is
  // 56 minutes behind the clock.
  function haForClock(H) { return 15 * (H + (LON + 90) / 15 - 12); }
  var _events = {};
  function sunEvents(t) {
    if (_events[t.days]) return _events[t.days];
    var base = t.days * 86400 - t.off * 3600, prev = null, rise = null, set = null, m, el;
    for (m = 0; m <= 1440; m += 5) {
      el = sunPos(base + m * 60).el + 0.833;
      if (prev !== null) {
        if (prev < 0 && el >= 0) rise = m - 5 + 5 * (-prev / (el - prev));
        if (prev >= 0 && el < 0) set = m - 5 + 5 * (prev / (prev - el));
      }
      prev = el;
    }
    var fmt = function (mm) {
      if (mm === null) return '--:--';
      mm = Math.round(mm);
      return pad2(Math.floor(mm / 60) % 24) + ':' + pad2(mm % 60);
    };
    return (_events[t.days] = { rise: fmt(rise), set: fmt(set) });
  }

  // ------------------------------------------------------------ registries
  // Every clock, place and easter egg registers itself here. The hash picks
  // from these by weight, in file order, so adding one never reshuffles the
  // rest unless its weight is nonzero.
  //
  //   defineClock(name, { w, mats: [...], keeps, traits: function (r) {...}, build: function (W) {...} })
  //   definePlace(name, { w, build: function (W) {...}, interior?: bool })
  //   defineEgg(name,   { w, build: function (W) {...}, places?: [...], line: '...' })
  var CLOCK_DEFS = {}, PLACE_DEFS = {}, EGG_DEFS = {};
  function defineClock(name, d) { d.name = name; CLOCK_DEFS[name] = d; }
  function definePlace(name, d) { d.name = name; PLACE_DEFS[name] = d; }
  function defineEgg(name, d) { d.name = name; EGG_DEFS[name] = d; }
  function weighted(defs, filter) {
    var t = [];
    for (var k in defs) if (defs[k].w > 0 && (!filter || filter(defs[k]))) t.push([k, defs[k].w]);
    return t;
  }

  // ------------------------------------------------------------ more sky arithmetic
  function dayOfYear(t) { return daysFromCivil(t.y, t.mo, t.d) - daysFromCivil(t.y, 1, 1) + 1; }
  var _mev = {};
  function moonEvents(t) {
    if (_mev[t.days]) return _mev[t.days];
    var base = t.days * 86400 - t.off * 3600, prev = null, rise = null, set = null, m, el;
    for (m = 0; m <= 1440; m += 10) {
      el = moonPos(base + m * 60).el + 0.3;
      if (prev !== null) {
        if (prev < 0 && el >= 0) rise = m - 10 + 10 * (-prev / (el - prev));
        if (prev >= 0 && el < 0) set = m - 10 + 10 * (prev / (prev - el));
      }
      prev = el;
    }
    var fmt = function (mm) { if (mm === null) return '--:--'; mm = Math.round(mm); return pad2(Math.floor(mm / 60) % 24) + ':' + pad2(mm % 60); };
    return (_mev[t.days] = { rise: fmt(rise), set: fmt(set) });
  }
  // the season, for things that bloom: 0 bud, 1 bloom, 2 peak, 3 wilt, 4 frost, 5 regrowth
  function bloomState(t) {
    var d = dayOfYear(t);
    if (d < 60) return 4; if (d < 95) return 5; if (d < 130) return 0; if (d < 180) return 1; if (d < 250) return 2; if (d < 320) return 3; return 4;
  }
  var BLOOM_NAMES = ['BUD', 'BLOOM', 'PEAK', 'WILT', 'FROST', 'REGROWTH'];
