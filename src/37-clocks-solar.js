  // =====================================================================
  // SOLAR CLOCKS: six instruments that read the sky over Marfa. A
  // heliochronometer, a noon cannon, a meridian obelisk, a declining wall
  // dial, a nocturnal that reads the stars, and a bow dial. Every hour line,
  // date curve and pointer is computed from the sun and star model in
  // 00-core.js for latitude 30.3095 N. Every top-level name in this file
  // starts with sol_ so nothing collides with the files written beside it.
  // =====================================================================

  // ------------------------------------------------------------ sky arithmetic (no THREE, runs in node)
  // Frames: +x east, +y up, -z north. P is the celestial pole, Q the point of
  // the equator on the meridian (up and south), E east. A body at hour angle
  // H (west positive) and declination d points at cos d (cos H Q - sin H E) + sin d P.
  var SOL_E = [1, 0, 0], SOL_P = [0, SPHI, -CPHI], SOL_Q = [0, CPHI, SPHI];
  var SOL_OBLIQ = 23.44;
  function sol_dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sol_wrap(d) { return ((d % 360) + 540) % 360 - 180; }
  function sol_eqDir(ha, dec) {
    var h = ha * D2R, d = dec * D2R, a = Math.cos(d) * Math.cos(h), b = -Math.cos(d) * Math.sin(h), c = Math.sin(d);
    return [a * SOL_Q[0] + b * SOL_E[0] + c * SOL_P[0], a * SOL_Q[1] + b * SOL_E[1] + c * SOL_P[1], a * SOL_Q[2] + b * SOL_E[2] + c * SOL_P[2]];
  }
  function sol_azDir(az, el) { var a = az * D2R, e = el * D2R; return [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)]; }
  // the sun's true (apparent) hour angle in degrees, from the same model as sunPos
  function sol_ha(utc) { var q = sunEq(utc); return sol_wrap((lst(utc) - q.ra) * R2D); }
  // Central Standard hours for a moment
  function sol_cst(utc) { var h = (utc / 3600 - 6) % 24; return h < 0 ? h + 24 : h; }
  // the equation of time in minutes (sun fast is positive)
  function sol_eot(utc) { return sol_wrap(sol_ha(utc) - haForClock(sol_cst(utc))) * 4; }
  // Central Standard hours from a Marfa time
  function sol_tcst(t) { return t.hours - (t.dst ? 1 : 0); }
  function sol_hourLabel(H, dst, roman) {
    var n = (Math.round(H) + (dst ? 1 : 0) + 24) % 24;
    if (!roman) return String(n);
    return ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][n % 12];
  }
  // the ground point under a nodus at height h for a sun direction s, [x, z]
  function sol_tip(s, h) { return [-s[0] * h / s[1], -s[2] * h / s[1]]; }
  // A vertical wall whose face looks toward azimuth 180 + D (D west positive).
  // Returns its frame: n (out of the face), u (right, seen from the front).
  function sol_wallFrame(D) {
    var d = D * D2R, n = [-Math.sin(d), 0, Math.cos(d)];
    return { n: n, u: [Math.cos(d), 0, Math.sin(d)], v: [0, 1, 0] };
  }
  // The hour line of a polar style on that wall, as a unit 2D direction in
  // the wall's (u, v) from the root of the style, or null when the sun can
  // never light the wall at that hour. The line is where the plane through
  // the style and the sun meets the wall.
  function sol_wallLine(D, ha) {
    var f = sol_wallFrame(D), np = sol_dot(f.n, SOL_P), s = null;
    for (var dec = -SOL_OBLIQ; dec <= SOL_OBLIQ; dec += 1) {
      var sd = sol_eqDir(ha, dec);
      if (sd[1] > 0.02 && sol_dot(f.n, sd) > 0.02) { s = sd; break; }
    }
    if (!s) return null;
    // any declination gives the same plane; use one whose sun is in front of the wall
    var k = sol_dot(f.n, s) / np, dir = [k * SOL_P[0] - s[0], k * SOL_P[1] - s[1], k * SOL_P[2] - s[2]];
    var x = sol_dot(dir, f.u), y = sol_dot(dir, f.v), L = Math.sqrt(x * x + y * y);
    return [x / L, y / L];
  }
  // where the shadow of a style (root at the wall origin) falls for a sun
  // direction s, as a 2D (u, v) direction; used to check the painted lines
  function sol_wallShadow(D, s, len) {
    var f = sol_wallFrame(D), sp = [-SOL_P[0] * len, -SOL_P[1] * len, -SOL_P[2] * len];
    var t = sol_dot(f.n, sp) / sol_dot(f.n, s), q = [sp[0] - s[0] * t, sp[1] - s[1] * t, sp[2] - s[2] * t];
    return [sol_dot(q, f.u), sol_dot(q, f.v)];
  }
  // pointer stars of the Plough, J2000 (the Guards: Dubhe and Merak)
  var SOL_DIPPER = [[165.93, 61.75], [165.46, 56.38], [178.46, 53.69], [183.86, 57.03], [193.51, 55.96], [200.98, 54.93], [206.89, 49.31], [37.95, 89.26]];
  var SOL_GUARDS_RA = 165.70;
  // the nocturnal's arm angle (radians, anticlockwise from the zenith side of
  // the pole as you face north) for a moment
  function sol_guardAngle(utc) { return lst(utc) - SOL_GUARDS_RA * D2R; }
  // the angle its hour disc is set to for the night that has its midnight at
  // `midDays` (a local day number), in a zone `off` hours from UTC
  function sol_noctSet(midDays, off) { return sol_guardAngle(midDays * 86400 - off * 3600); }

  var SOL_MOTTOS = ['SINE SOLE SILEO', 'LUX ET UMBRA', 'IT IS LATER THAN YOU THINK', 'THE SUN KEEPS THE TIME HERE', 'MAS TARDE', 'I WAIT FOR THE LIGHT', 'NOW OR LATER', 'THE SHADOW WAS HERE FIRST'];

  // ------------------------------------------------------------ build helpers (browser only)
  function sol_v(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
  // a group whose local x, y, z are east, the pole and the equator's meridian point
  function sol_eqGroup() {
    var q = new THREE.Group();
    q.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sol_v(SOL_E), sol_v(SOL_P), sol_v(SOL_Q)));
    return q;
  }
  function sol_ext(shape, depth, bev, seg) {
    var b = bev || 0, d = Math.max(depth - 2 * b, 0.0005);
    var geo = new THREE.ExtrudeBufferGeometry(shape, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: seg || 16 });
    geo.translate(0, 0, -d / 2);
    return geo;
  }
  function sol_rect(w, h) { return new THREE.Shape([new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(w / 2, -h / 2), new THREE.Vector2(w / 2, h / 2), new THREE.Vector2(-w / 2, h / 2)]); }
  // a box with bevelled edges, centred
  function sol_bbox(w, h, d, mat, b) {
    b = b == null ? Math.min(0.025, w * 0.12, h * 0.12, d * 0.12) : b;
    return new THREE.Mesh(sol_ext(sol_rect(w - 2 * b, h - 2 * b), d, b, 4), mat);
  }
  function sol_circle(rad, n, a0) { var p = []; for (var i = 0; i < n; i++) { var a = (a0 || 0) + i / n * SOL_TAU; p.push(new THREE.Vector2(rad * Math.cos(a), rad * Math.sin(a))); } return p; }
  var SOL_TAU = Math.PI * 2;
  function sol_annulus(ro, ri, n) { var s = new THREE.Shape(sol_circle(ro, n || 96)); s.holes.push(new THREE.Path(sol_circle(ri, n || 96).reverse())); return s; }
  function sol_lathe(pts, seg, mat) { return new THREE.Mesh(new THREE.LatheBufferGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48), mat); }
  function sol_rod(a, b, rad, mat, seg) {
    var d = b.clone().sub(a), m = cyl(rad, rad, d.length(), seg || 10, mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  function sol_hero(name) { var m = heroMat(name); m.roughness = Math.max(m.roughness, 0.38); return m; }
  function sol_bronze() { return mtl('#8C6A3E', 'brushed', 0.46, 0.9, 0.45); }
  function sol_gilt() { return std('#D6AE5C', 0.3, 1); }
  function sol_iron() { return mtl('#26282A', 'brushed', 0.5, 0.75, 0.5); }
  function sol_blued() { return std('#1C2B4A', 0.3, 0.9); }
  // a canvas face: the material a plate wears when text is cut into it
  function sol_faceMat(tex, md, o) {
    o = o || {};
    var m = new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough == null ? md.rough : o.rough, metalness: o.metal == null ? md.metal * 0.8 : o.metal });
    if (o.poly) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    if (o.detail) detail(m, md.tex, { tile: md.tile, albedo: 0.3 });
    return m;
  }
  function sol_speck(g, w, h, rr, n, a) {
    for (var i = 0; i < n; i++) {
      g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + a + ')';
      g.fillRect(rr() * w, rr() * h, 1 + rr() * 3, 1 + rr() * 3);
    }
  }
  // cut text: a dark fill with a light lip below, the way a chisel leaves it
  function sol_cut(g, text, x, y, dark, light, off) {
    off = off || 2;
    g.fillStyle = light; g.fillText(text, x + off * 0.6, y + off);
    g.fillStyle = dark; g.fillText(text, x, y);
  }
  // text round a circle, upright at the top (or at the bottom when `under`)
  function sol_arcText(g, text, cx, cy, rad, mid, under) {
    var n = text.length, step = (g.measureText('M').width * 0.95) / rad, span = step * (n - 1);
    for (var i = 0; i < n; i++) {
      var a = under ? mid + span / 2 - i * step : mid - span / 2 + i * step;
      g.save(); g.translate(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
      g.rotate(under ? a - Math.PI / 2 : a + Math.PI / 2);
      g.fillText(text[i], 0, 0); g.restore();
    }
  }
  // engraving that reads: dark cut on light metal, filled light on dark metal
  function sol_ink(hex) {
    var c = new THREE.Color(hex), l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
    return l < 0.45 ? '#EDE3CC' : '#22190E';
  }
  function sol_mix(a, b, t) {
    var ca = new THREE.Color(a), cb = new THREE.Color(b);
    return '#' + ca.lerp(cb, t).getHexString();
  }

  // =====================================================================
  // 1. HELIOCHRONOMETER
  // After the precision dials of the 1900s. A sighting arm turns on a polar
  // axle. Sun through a slit at one end throws a bar of light on a screen at
  // the other; when the bar sits on the index the pointer reads clock time on
  // the chapter ring. The index is moved by a cam cut to the equation of
  // time, and a bridge across the slit leaves a gap in the bar that reads the
  // date on the screen's declination scale.
  // =====================================================================
  function sol_helio(W, matName) {
    var r = W.r, T = W.P.clockTraits, md = MATERIALS[matName], dst = W.dst, g = new THREE.Group();
    var metal = sol_hero(matName), dark = sol_iron(), blued = sol_blued(), roman = T['Numerals'] === 'Roman';
    var ink = sol_ink(md.color);
    var stoneHex = pick(r, ['#CFC3AE', '#BDB3A4', '#C8A983', '#9E968B']), stone = mtl(stoneHex, 'stone', 0.85, 0, 1.1);
    var y0 = 1.12, ped = T['Pedestal'];
    // ---- the pedestal
    if (ped === 'Fluted Column') {
      var pl = sol_bbox(0.86, 0.16, 0.86, stone, 0.02); pl.position.y = 0.08; g.add(pl);
      var base = sol_lathe([[0, 0], [0.36, 0], [0.36, 0.06], [0.31, 0.1], [0.3, 0.14], [0.26, 0.17], [0.25, 0.2], [0, 0.2]], 48, stone); base.position.y = 0.16; g.add(base);
      var fm = stone.clone(); fm.flatShading = true;
      var sh = cyl(0.22, 0.25, y0 - 0.62, 20, fm); sh.position.y = 0.36 + (y0 - 0.62) / 2; g.add(sh);
      var cap = sol_lathe([[0, 0], [0.24, 0], [0.26, 0.03], [0.3, 0.07], [0.35, 0.12], [0.35, 0.18], [0, 0.18]], 48, stone); cap.position.y = y0 - 0.26; g.add(cap);
      var ab = sol_bbox(0.8, 0.08, 0.8, stone, 0.015); ab.position.y = y0 - 0.04; g.add(ab);
    } else if (ped === 'Square Pier') {
      var p1 = sol_bbox(0.9, 0.2, 0.9, stone, 0.03); p1.position.y = 0.1; g.add(p1);
      var p2 = sol_bbox(0.74, 0.1, 0.74, stone, 0.02); p2.position.y = 0.25; g.add(p2);
      var p3 = sol_bbox(0.52, y0 - 0.5, 0.52, stone, 0.02); p3.position.y = 0.3 + (y0 - 0.5) / 2; g.add(p3);
      var p4 = sol_bbox(0.7, 0.1, 0.7, stone, 0.02); p4.position.y = y0 - 0.15; g.add(p4);
      var p5 = sol_bbox(0.8, 0.1, 0.8, stone, 0.02); p5.position.y = y0 - 0.05; g.add(p5);
      // a panel sunk in the south face
      var pan = textPlane(['CLOCK TIME', 'BY THE SUN'], { color: sol_mix(stoneHex, '#000000', 0.55), font: FONT_SERIF, height: 0.16, px: 70, pad: 0.1 });
      pan.position.set(0, 0.3 + (y0 - 0.5) * 0.62, 0.262); g.add(pan);
    } else {
      var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(0.36, 0.02, 8, 48), dark); ring.rotation.x = Math.PI / 2; ring.position.y = 0.46; g.add(ring);
      for (var k = 0; k < 3; k++) {
        var a = k * SOL_TAU / 3 + Math.PI / 6;
        var foot = new THREE.Vector3(Math.sin(a) * 0.62, 0.02, Math.cos(a) * 0.62), top = new THREE.Vector3(Math.sin(a) * 0.14, y0 - 0.1, Math.cos(a) * 0.14);
        g.add(sol_rod(foot, top, 0.028, dark, 10));
        var shoe = cyl(0.07, 0.08, 0.04, 16, dark); shoe.position.copy(foot); g.add(shoe);
      }
      var col = cyl(0.07, 0.09, y0 - 0.1, 20, dark); col.position.y = (y0 - 0.1) / 2; g.add(col);
      var cp = cyl(0.3, 0.16, 0.08, 32, dark); cp.position.y = y0 - 0.04; g.add(cp);
    }
    // ---- the base plate, levelled, with a compass rose cut into it
    var bp = new THREE.Mesh(sol_ext(new THREE.Shape(sol_circle(0.6, 96)), 0.035, 0.008), metal);
    bp.rotation.x = -Math.PI / 2; bp.position.y = y0 + 0.018; g.add(bp);
    var btex = canvasTex(1024, 1024, function (gc, S) {
      var c = S / 2, k = S / 2 / 0.6;
      gc.fillStyle = md.color; gc.fillRect(0, 0, S, S); sol_speck(gc, S, S, seedRng(W.P.seed + 31), 5000, 0.05);
      gc.strokeStyle = ink; gc.fillStyle = ink; gc.lineWidth = 3;
      [0.585, 0.56, 0.4].forEach(function (rr) { gc.beginPath(); gc.arc(c, c, rr * k, 0, SOL_TAU); gc.stroke(); });
      for (var i = 0; i < 360; i += 5) {
        var a = i * D2R, l = i % 45 === 0 ? 0.05 : 0.022;
        gc.lineWidth = i % 45 === 0 ? 4 : 2; gc.beginPath();
        gc.moveTo(c + Math.sin(a) * 0.56 * k, c - Math.cos(a) * 0.56 * k); gc.lineTo(c + Math.sin(a) * (0.56 - l) * k, c - Math.cos(a) * (0.56 - l) * k); gc.stroke();
      }
      // rose points
      for (i = 0; i < 8; i++) {
        var aa = i * Math.PI / 4, L = i % 2 ? 0.2 : 0.36, wdt = 0.045;
        gc.beginPath(); gc.moveTo(c + Math.sin(aa) * L * k, c - Math.cos(aa) * L * k);
        gc.lineTo(c + Math.sin(aa + Math.PI / 2) * wdt * k, c - Math.cos(aa + Math.PI / 2) * wdt * k);
        gc.lineTo(c, c); gc.closePath(); gc.fill();
        gc.beginPath(); gc.moveTo(c + Math.sin(aa) * L * k, c - Math.cos(aa) * L * k);
        gc.lineTo(c + Math.sin(aa - Math.PI / 2) * wdt * k, c - Math.cos(aa - Math.PI / 2) * wdt * k);
        gc.lineTo(c, c); gc.closePath(); gc.stroke();
      }
      gc.font = '700 46px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (q) { var a = q[1] * D2R; gc.fillText(q[0], c + Math.sin(a) * 0.47 * k, c - Math.cos(a) * 0.47 * k); });
      gc.font = '400 26px ' + FONT_MONO;
      sol_arcText(gc, 'LAT 30.3095 N   LON 104.0206 W   MARFA TEXAS', c, c, 0.515 * k, Math.PI / 2, true);
      sol_arcText(gc, T['Motto'], c, c, 0.515 * k, -Math.PI / 2, false);
    });
    var bface = new THREE.Mesh(new THREE.CircleBufferGeometry(0.6, 96), sol_faceMat(btex, md, { poly: true }));
    bface.rotation.x = -Math.PI / 2; bface.position.y = y0 + 0.036; g.add(bface);
    // ---- the polar head
    var Cc = new THREE.Vector3(0, y0 + 0.82, 0), eq = sol_eqGroup(); eq.position.copy(Cc); g.add(eq);
    // the bracket, in the meridian plane, north of the chapter ring. Points in world (z, y).
    var yC = Cc.y;
    function wpt(u, q) { return [u * SOL_P[2] + q * SOL_Q[2], yC + u * SOL_P[1] + q * SOL_Q[1]]; }
    var nb = wpt(0.62, 0), rb = wpt(0, -0.6);
    var br = [[0.05, y0 + 0.03], [-0.62, y0 + 0.03], [nb[0] - 0.04, nb[1] + 0.02], [nb[0] + 0.08, nb[1] + 0.07], [rb[0] + 0.12, rb[1] + 0.02], [-0.16, y0 + 0.14]];
    var bs = new THREE.Shape(br.map(function (p) { return new THREE.Vector2(-p[0], p[1]); }));
    var hole = sol_circle(0.07, 32).map(function (p) { return new THREE.Vector2(p.x - (-0.36), p.y + y0 + 0.36); });
    bs.holes.push(new THREE.Path(hole.reverse()));
    var brk = new THREE.Mesh(sol_ext(bs, 0.05, 0.01), metal); brk.rotation.y = Math.PI / 2; g.add(brk);
    // axle, bearing and finials (eq frame: y is the pole)
    var axle = cyl(0.02, 0.02, 1.34, 12, dark); axle.position.y = 0.04; eq.add(axle);
    var brg = cyl(0.05, 0.05, 0.1, 20, metal); brg.position.y = 0.62; eq.add(brg);
    var fin = sol_lathe([[0, 0], [0.035, 0], [0.04, 0.03], [0.02, 0.07], [0.012, 0.1], [0, 0.12]], 20, metal); fin.position.y = 0.67; eq.add(fin);
    var fin2 = fin.clone(); fin2.rotation.x = Math.PI; fin2.position.y = -0.63; eq.add(fin2);
    // the chapter ring, parallel to the equator
    var ringM = new THREE.Mesh(sol_ext(sol_annulus(0.64, 0.47, 128), 0.025, 0.006), metal);
    ringM.rotation.x = Math.PI / 2; eq.add(ringM);
    for (k = 0; k < 3; k++) {
      var sa = Math.PI + (k - 1) * 0.9, sp = box(0.03, 0.012, 0.46, metal);
      sp.position.set(Math.sin(sa) * 0.25, 0, Math.cos(sa) * 0.25); sp.rotation.y = sa; eq.add(sp);
    }
    var rtex = canvasTex(1536, 1536, function (gc, S) {
      var c = S / 2, k = S / 2 / 0.64;
      gc.fillStyle = md.color; gc.fillRect(0, 0, S, S); sol_speck(gc, S, S, seedRng(W.P.seed + 32), 7000, 0.05);
      gc.strokeStyle = ink; gc.fillStyle = ink;
      gc.lineWidth = 4; [0.63, 0.6, 0.48].forEach(function (rr) { gc.beginPath(); gc.arc(c, c, rr * k, 0, SOL_TAU); gc.stroke(); });
      for (var m = 5 * 60; m <= 20 * 60; m += 5) {
        var H = m / 60, A = haForClock(H) * D2R, x = -Math.sin(A), y = Math.cos(A), full = m % 60 === 0, half = m % 30 === 0;
        var r0 = full ? 0.48 : half ? 0.555 : 0.575;
        gc.lineWidth = full ? 6 : half ? 4 : 2; gc.beginPath();
        gc.moveTo(c + x * r0 * k, c - y * r0 * k); gc.lineTo(c + x * 0.6 * k, c - y * 0.6 * k); gc.stroke();
        if (full) {
          gc.save(); gc.translate(c + x * 0.515 * k, c - y * 0.515 * k); gc.rotate(Math.atan2(x, y));
          gc.font = '700 ' + (roman ? 44 : 54) + 'px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
          gc.fillText(sol_hourLabel(H, dst, roman), 0, 0); gc.restore();
        }
      }
      gc.font = '400 24px ' + FONT_MONO; gc.textBaseline = 'middle';
      sol_arcText(gc, (dst ? 'CENTRAL DAYLIGHT TIME' : 'CENTRAL STANDARD TIME') + '   MLOW.XYZ', c, c, 0.615 * k, Math.PI / 2, true);
    });
    var rface = new THREE.Mesh(new THREE.RingBufferGeometry(0.47, 0.64, 128, 1), sol_faceMat(rtex, md, { poly: true }));
    rface.rotation.x = Math.PI / 2; rface.position.y = -0.0126; eq.add(rface);
    // ---- the sighting arm. Arm frame: z toward the sun, y along the pole.
    var a = 0.25, xo = 0.09, arm = new THREE.Group(); arm.position.y = -0.33; eq.add(arm);
    var hub = cyl(0.045, 0.045, 0.09, 20, metal); arm.add(hub);
    var spine = sol_bbox(0.026, 0.02, 2 * a + 0.02, metal, 0.005); spine.position.x = -0.022; arm.add(spine);
    [-1, 1].forEach(function (sd) {
      var rail = sol_bbox(0.3, 0.018, 2 * a + 0.02, metal, 0.004); rail.position.set(xo, sd * 0.31, 0); arm.add(rail);
    });
    // the slit plate: two cheeks and a bridge across the slit
    var slitW = 0.007, cheekL = xo - slitW / 2 - (-0.06), cheekR = 0.24 - (xo + slitW / 2);
    var ch1 = box(cheekL, 0.62, 0.012, metal); ch1.position.set(-0.06 + cheekL / 2, 0, a); arm.add(ch1);
    var ch2 = box(cheekR, 0.62, 0.012, metal); ch2.position.set(0.24 - cheekR / 2, 0, a); arm.add(ch2);
    var brd = box(slitW + 0.002, 0.014, 0.01, metal); brd.position.set(xo, 0, a); arm.add(brd);
    // the pointer, run out along the arm to the chapter ring
    var pb = sol_bbox(0.03, 0.012, 0.36, metal, 0.004); pb.position.set(0, 0.3, a + 0.17); arm.add(pb);
    var tipS = new THREE.Shape([new THREE.Vector2(-0.018, 0), new THREE.Vector2(0.018, 0), new THREE.Vector2(0, 0.16)]);
    var ptip = new THREE.Mesh(sol_ext(tipS, 0.006, 0), blued); ptip.rotation.x = -Math.PI / 2; ptip.position.set(0, 0.3, a + 0.34); arm.add(ptip);
    // the screen, with its minute scale (x) and declination scale (y)
    var scrW = 0.3, scrH = 0.6, sxc = xo;
    var back = box(scrW + 0.02, scrH + 0.02, 0.012, metal); back.position.set(sxc, 0, -a - 0.004); arm.add(back);
    var decY = function (dd) { return -2 * a * Math.tan(dd * D2R); };
    var sx = function (min) { return 2 * a * Math.tan(min / 4 * D2R); };
    var stex = canvasTex(512, 1024, function (gc, Wc, Hc) {
      var kx = Wc / scrW, ky = Hc / scrH, X = function (x) { return (x + scrW / 2) * kx; }, Y = function (y) { return (scrH / 2 - y) * ky; };
      gc.fillStyle = '#D8D0BE'; gc.fillRect(0, 0, Wc, Hc); sol_speck(gc, Wc, Hc, seedRng(W.P.seed + 33), 1500, 0.04);
      gc.strokeStyle = '#1D1B18'; gc.fillStyle = '#1D1B18'; gc.textBaseline = 'middle';
      // declination scale: the date the bridge's gap sits on
      gc.lineWidth = 3;
      [[23.44, 'JUN 21'], [0, 'EQUINOX'], [-23.44, 'DEC 21']].forEach(function (q) {
        var y = Y(decY(q[0])); gc.beginPath(); gc.moveTo(X(-0.13), y); gc.lineTo(X(0.13), y); gc.stroke();
        gc.font = '700 26px ' + FONT_MONO; gc.textAlign = 'center'; gc.fillText(q[1], X(0), y + (q[0] > 0 ? 24 : -24));
      });
      gc.lineWidth = 2; gc.font = '400 22px ' + FONT_MONO;
      var d0 = daysFromCivil(2027, 1, 1);
      for (var mo = 1; mo <= 12; mo++) {
        var q2 = sunEq(daysFromCivil(2027, mo, 1) * 86400 + 18 * 3600), y2 = Y(decY(q2.dec * R2D)), left = mo <= 6;
        gc.beginPath(); gc.moveTo(X(left ? -0.14 : 0.09), y2); gc.lineTo(X(left ? -0.09 : 0.14), y2); gc.stroke();
        gc.textAlign = left ? 'left' : 'right'; gc.fillText(MONTHS[mo - 1], X(left ? -0.085 : 0.085), y2);
      }
      // minute scale across the foot of the screen
      var yb = Y(-0.262);
      gc.lineWidth = 2; gc.beginPath(); gc.moveTo(X(sx(-16)), yb); gc.lineTo(X(sx(16)), yb); gc.stroke();
      for (var m = -16; m <= 16; m++) {
        var xx = X(sx(m)), l = m % 5 === 0 ? 22 : 11;
        gc.lineWidth = m % 5 === 0 ? 3 : 1.5; gc.beginPath(); gc.moveTo(xx, yb); gc.lineTo(xx, yb - l); gc.stroke();
      }
      gc.font = '700 20px ' + FONT_MONO; gc.textAlign = 'center';
      gc.fillText('SLOW', X(sx(-11)), yb + 20); gc.fillText('FAST', X(sx(11)), yb + 20); gc.fillText('0', X(0), yb + 20);
      gc.font = '400 18px ' + FONT_MONO; gc.fillText('EQUATION OF TIME, MIN', X(0), Y(-0.29));
      gc.fillText('BRIDGE GAP READS THE DATE', X(0), Y(0.288));
    });
    var scr = new THREE.Mesh(new THREE.PlaneBufferGeometry(scrW, scrH), sol_faceMat(stex, md, { metal: 0, rough: 0.7 }));
    scr.position.set(sxc, 0, -a + 0.0025); arm.add(scr);
    // the bar of light, in two pieces either side of the bridge's gap
    var barM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.38, 1.1), transparent: true, opacity: 1, depthWrite: false });
    var bars = [0, 1].map(function () { var b = new THREE.Mesh(new THREE.PlaneBufferGeometry(slitW, 1), barM); b.position.z = -a + 0.004; b.visible = false; arm.add(b); return b; });
    // the index: two blued pointers on a slider, moved by the cam
    var idx = new THREE.Group(); idx.position.z = -a + 0.006; arm.add(idx);
    [-1, 1].forEach(function (sd) {
      var tri = new THREE.Mesh(new THREE.ConeBufferGeometry(0.012, 0.035, 3), blued);
      tri.rotation.z = sd > 0 ? Math.PI : 0; tri.position.y = sd * (scrH / 2 + 0.02); idx.add(tri);
    });
    // the cam, cut to the equation of time for 2027, and its push rod
    var camX = 0.42, camY = -0.33, eotTab = [], d0 = daysFromCivil(2027, 1, 1), kc = 0.0016;
    for (k = 0; k < 365; k++) eotTab.push(sol_eot((d0 + k) * 86400 + 18 * 3600));
    var camPts = [];
    for (k = 0; k < 365; k += 2) { var ang = k / 365 * SOL_TAU, rr = 0.07 + kc * eotTab[k]; camPts.push(new THREE.Vector2(Math.cos(ang) * rr, Math.sin(ang) * rr)); }
    var camS = new THREE.Shape(camPts); camS.holes.push(new THREE.Path(sol_circle(0.01, 16).reverse()));
    var cam = new THREE.Group(); cam.position.set(camX, camY, -a); arm.add(cam);
    cam.add(new THREE.Mesh(sol_ext(camS, 0.014, 0.003), metal));
    var ctex = canvasTex(256, 256, function (gc, S) {
      var c = S / 2, k2 = S / 2 / 0.045;
      gc.fillStyle = md.color; gc.fillRect(0, 0, S, S);
      gc.fillStyle = ink; gc.strokeStyle = ink; gc.font = '700 20px ' + FONT_MONO; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      for (var mo = 0; mo < 12; mo++) {
        var ang = -(daysFromCivil(2027, mo + 1, 15) - d0) / 365 * SOL_TAU;
        gc.save(); gc.translate(c + Math.cos(ang) * 0.034 * k2, c + Math.sin(ang) * 0.034 * k2); gc.rotate(ang + Math.PI / 2); gc.fillText(MONTHS[mo][0], 0, 0); gc.restore();
      }
      gc.lineWidth = 2; gc.beginPath(); gc.arc(c, c, 0.042 * k2, 0, SOL_TAU); gc.stroke();
    });
    var cface = new THREE.Mesh(new THREE.CircleBufferGeometry(0.045, 48), sol_faceMat(ctex, md, { poly: true }));
    cface.position.z = 0.0075; cam.add(cface);
    var rod = box(1, 0.008, 0.008, dark); rod.position.set(0, camY, -a + 0.012); arm.add(rod);
    var rodDrop = box(0.006, Math.abs(camY) - scrH / 2 - 0.02, 0.006, dark); idx.add(rodDrop); rodDrop.position.y = -(scrH / 2 + 0.02 + (Math.abs(camY) - scrH / 2 - 0.02) / 2) + 0.0;
    shade(g);
    [scr, rface, bface].forEach(function (m) { m.castShadow = false; });
    bars.forEach(function (b) { b.castShadow = false; b.receiveShadow = false; });
    var DAY0 = -1;
    return {
      group: g, R: 1.05, lookY: y0 + 0.62, dist: rf(r, 4.4, 5.2), camH: [1.8, 2.6], face: false, shadowPad: 5,
      close: { zoom: 0.5, el: -0.12, look: 0.2 },
      update: function (ctx) {
        var t = ctx.t, A = haForClock(sol_tcst(t)), Ht = sol_ha(ctx.utc), h = sol_wrap(Ht - A);
        arm.rotation.y = -A * D2R;
        // the cam turns with the date; the index follows it
        var doy = dayOfYear(t) - 1;
        if (doy !== DAY0) { DAY0 = doy; cam.rotation.z = Math.PI + doy / 365 * SOL_TAU; }
        var eotNow = sol_eot(ctx.utc), xi = xo + sx(eotNow);
        idx.position.x = xi;
        var rEdge = camX - (0.07 + kc * eotTab[Math.min(doy, 364)]);
        rod.scale.x = Math.max(0.01, rEdge - xi); rod.position.x = (rEdge + xi) / 2;
        // the bar: sunlight through the slit, traced to the screen
        var dec = ctx.sun.dec, ch = Math.cos(h * D2R), up = sstep(-0.5, 1.5, ctx.sun.el);
        var show = up > 0 && ch > 0.2;
        if (show) {
          var bx = xo + 2 * a * Math.tan(h * D2R), dy = -2 * a * Math.tan(dec) / ch;
          var segs = [[-0.29, -0.007], [0.007, 0.29]];
          for (var i = 0; i < 2; i++) {
            var y1 = clamp(segs[i][0] + dy, -scrH / 2, scrH / 2), y2 = clamp(segs[i][1] + dy, -scrH / 2, scrH / 2);
            bars[i].visible = y2 - y1 > 0.002 && Math.abs(bx - sxc) < scrW / 2;
            bars[i].scale.y = Math.max(0.001, y2 - y1); bars[i].position.set(bx, (y1 + y2) / 2, -a + 0.004);
          }
          barM.opacity = up * (1 - 0.6 * ctx.night);
        } else { bars[0].visible = bars[1].visible = false; }
      }
    };
  }

  // =====================================================================
  // 2. NOON CANNON
  // A bronze gun on a stone dial with a burning glass over the touch hole.
  // The glass rides a quadrant set each day to the height of the noon sun, so
  // its focus lands on the touch hole at local apparent noon, between 13:39
  // and 14:11 by the clock in Marfa. A small horizontal dial keeps the rest
  // of the day.
  // =====================================================================
  function sol_cannon(W, matName) {
    var r = W.r, T = W.P.clockTraits, md = MATERIALS[matName], dst = W.dst, g = new THREE.Group();
    var stone = heroMat(matName), trimHex = md.trim, dark = sol_iron(), bronzeD = sol_bronze(), gilt = sol_gilt();
    var bm = { 'Bronze': sol_bronze(), 'Blackened Iron': mtl('#2E2C2A', 'rust', 0.62, 0.6, 0.6), 'Verdigris': mtl('#5E9C8C', 'rust', 0.66, 0.5, 0.7) }[T['Barrel']];
    var m = r() < 0.5 ? 1 : -1;                    // the muzzle points east (+1) or west (-1)
    var Wx = 2.1, Dz = 1.6, Hs = 0.86, y0 = Hs;
    var step = sol_bbox(Wx + 0.5, 0.14, Dz + 0.5, mtl('#A99F90', 'concrete', 0.95, 0, 1.6), 0.02); step.position.y = 0.07; g.add(step);
    var blk = sol_bbox(Wx - 0.1, Hs - 0.24, Dz - 0.1, stone, 0.03); blk.position.y = 0.14 + (Hs - 0.24) / 2; g.add(blk);
    var slab = sol_bbox(Wx + 0.06, 0.1, Dz + 0.06, stone, 0.025); slab.position.y = Hs - 0.05; g.add(slab);
    var yb = y0 + 0.3, zc = -0.18;
    // ---- the barrel, turned on a lathe. Axial y from breech (-) to muzzle (+).
    var prof = [[0, -0.66], [0.035, -0.66], [0.045, -0.63], [0.03, -0.6], [0.028, -0.58], [0.1, -0.57], [0.135, -0.55], [0.14, -0.52], [0.132, -0.5],
      [0.13, -0.2], [0.138, -0.19], [0.138, -0.16], [0.124, -0.15], [0.12, 0.12], [0.128, 0.13], [0.128, 0.155], [0.112, 0.165],
      [0.098, 0.5], [0.108, 0.53], [0.122, 0.57], [0.126, 0.6], [0.12, 0.62], [0.05, 0.62], [0.048, 0.3]];
    var bgeo = new THREE.LatheBufferGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40);
    bgeo.rotateZ(-m * Math.PI / 2);
    var barrel = new THREE.Mesh(bgeo, bm); barrel.position.set(0, yb, zc); g.add(barrel);
    var trn = cyl(0.045, 0.045, 0.36, 16, bm); trn.rotation.x = Math.PI / 2; trn.position.set(m * 0.02, yb, zc); g.add(trn);
    // the touch hole, on a raised vent field near the breech
    var xv = -m * 0.4, rv = 0.13, Tv = new THREE.Vector3(xv, yb + rv + 0.012, zc);
    var vf = box(0.07, 0.02, 0.07, bm); vf.position.set(xv, yb + rv + 0.002, zc); g.add(vf);
    var vent = cyl(0.009, 0.009, 0.004, 12, std('#050505', 0.9)); vent.position.copy(Tv); vent.position.y += 0.001; g.add(vent);
    // ---- the carriage
    var car = T['Carriage'], wood = mtl('#6B4A2E', 'wood', 0.8, 0, 0.6);
    if (car === 'Timber Truck') {
      [-1, 1].forEach(function (sd) {
        var cs = new THREE.Shape([new THREE.Vector2(-0.48, 0), new THREE.Vector2(0.42, 0), new THREE.Vector2(0.42, 0.2), new THREE.Vector2(0.1, 0.2), new THREE.Vector2(0.1, 0.25), new THREE.Vector2(-0.2, 0.25), new THREE.Vector2(-0.2, 0.15), new THREE.Vector2(-0.48, 0.15)]);
        var cheek = new THREE.Mesh(sol_ext(cs, 0.07, 0.01), wood); cheek.scale.x = m; cheek.position.set(0, y0 + 0.08, zc + sd * 0.19); g.add(cheek);
        [-0.32, 0.3].forEach(function (x) {
          var wh = cyl(0.1, 0.1, 0.06, 20, wood); wh.rotation.x = Math.PI / 2; wh.position.set(m * x, y0 + 0.1, zc + sd * 0.26); g.add(wh);
          var hb = cyl(0.03, 0.03, 0.08, 10, dark); hb.rotation.x = Math.PI / 2; hb.position.set(m * x, y0 + 0.1, zc + sd * 0.27); g.add(hb);
        });
        var cap = sol_bbox(0.1, 0.03, 0.08, dark, 0.005); cap.position.set(m * 0.02, yb + 0.04, zc + sd * 0.19); g.add(cap);
      });
      [-0.32, 0.3].forEach(function (x) { var ax = sol_bbox(0.1, 0.08, 0.6, wood, 0.01); ax.position.set(m * x, y0 + 0.1, zc); g.add(ax); });
    } else if (car === 'Stone Saddles') {
      [-0.3, 0.26].forEach(function (x) {
        var ss = new THREE.Shape(); ss.moveTo(-0.22, 0); ss.lineTo(0.22, 0); ss.lineTo(0.22, 0.24);
        ss.absarc(0, 0.3, 0.145, -0.42, Math.PI + 0.42, true); ss.lineTo(-0.22, 0.24); ss.lineTo(-0.22, 0);
        var sd = new THREE.Mesh(sol_ext(ss, 0.16, 0.012), stone); sd.rotation.y = Math.PI / 2; sd.position.set(m * x, y0, zc); g.add(sd);
      });
    } else {
      [-0.3, 0.26].forEach(function (x) {
        [-1, 1].forEach(function (sd) {
          g.add(sol_rod(new THREE.Vector3(m * x - 0.12, y0, zc + sd * 0.2), new THREE.Vector3(m * x, yb - 0.08, zc + sd * 0.15), 0.018, dark));
          g.add(sol_rod(new THREE.Vector3(m * x + 0.12, y0, zc + sd * 0.2), new THREE.Vector3(m * x, yb - 0.08, zc + sd * 0.15), 0.018, dark));
        });
        var cr = new THREE.Mesh(new THREE.TorusBufferGeometry(0.15, 0.018, 8, 24, Math.PI), dark);
        cr.rotation.y = Math.PI / 2; cr.rotation.z = Math.PI; cr.position.set(m * x, yb, zc); g.add(cr);
      });
      var bar = sol_rod(new THREE.Vector3(-0.35, y0 + 0.03, zc), new THREE.Vector3(0.35, y0 + 0.03, zc), 0.02, dark); g.add(bar);
    }
    // ---- the burning glass on its quadrant, centred on the touch hole
    var f = 0.44, e0 = 32 * D2R, e1 = 86 * D2R;
    [-1, 1].forEach(function (sd) {
      var tg = new THREE.TorusBufferGeometry(f, 0.011, 6, 40, e1 - e0); tg.rotateZ(e0);
      var rail = new THREE.Mesh(tg, bronzeD); rail.rotation.y = -Math.PI / 2; rail.position.set(xv + sd * 0.075, Tv.y, zc); g.add(rail);
      var lowEnd = new THREE.Vector3(xv + sd * 0.075, Tv.y + f * Math.sin(e0), zc + f * Math.cos(e0));
      g.add(sol_rod(new THREE.Vector3(lowEnd.x, y0, lowEnd.z + 0.05), lowEnd, 0.016, bronzeD));
      var knob = sph(0.02, bronzeD, 12, 8); knob.position.set(xv + sd * 0.075, Tv.y + f * Math.sin(e1), zc + f * Math.cos(e1)); g.add(knob);
    });
    var foot = sol_bbox(0.24, 0.03, 0.08, bronzeD, 0.006); foot.position.set(xv, y0 + 0.015, zc + f * Math.cos(e0) + 0.05); g.add(foot);
    // the quadrant: a bronze sector beside the rails, cut with the noon height of the sun for each month
    var qs = new THREE.Shape(); qs.absarc(0, 0, f + 0.035, e0, e1, false); qs.absarc(0, 0, f - 0.1, e1, e0, true);
    var quad = new THREE.Mesh(sol_ext(qs, 0.008, 0.002, 48), bronzeD); quad.rotation.y = -Math.PI / 2; quad.position.set(xv + 0.098, Tv.y, zc); g.add(quad);
    var qtex = canvasTex(1024, 1024, function (gc, S) {
      var k = S / (2 * (f + 0.04)), c = S / 2, P = function (a, rad) { return [c + Math.cos(a) * rad * k, c - Math.sin(a) * rad * k]; };
      gc.fillStyle = '#9A7644'; gc.fillRect(0, 0, S, S); sol_speck(gc, S, S, seedRng(W.P.seed + 42), 3000, 0.06);
      gc.strokeStyle = '#2A1C0C'; gc.fillStyle = '#2A1C0C'; gc.lineWidth = 3;
      gc.beginPath(); gc.arc(c, c, (f - 0.005) * k, -e1, -e0); gc.stroke();
      for (var dgr = 32; dgr <= 86; dgr += 2) { var a = dgr * D2R, p0 = P(a, f - 0.005), p1 = P(a, f - (dgr % 10 === 0 ? 0.04 : 0.022)); gc.lineWidth = dgr % 10 === 0 ? 4 : 2; gc.beginPath(); gc.moveTo(p0[0], p0[1]); gc.lineTo(p1[0], p1[1]); gc.stroke(); }
      gc.font = '700 26px ' + FONT_MONO; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      for (var mo = 1; mo <= 12; mo += (mo === 6 || mo === 12 ? 1 : 1)) {
        var q = sunEq(daysFromCivil(2027, mo, 1) * 86400 + 19 * 3600), a2 = (90 - LAT) * D2R + q.dec, p2 = P(a2, f - 0.065);
        gc.save(); gc.translate(p2[0], p2[1]); gc.rotate(-a2); gc.fillText(MONTHS[mo - 1], mo <= 6 ? -26 : 26, 0); gc.restore();
      }
    });
    // the sector's faces carry their shape coordinates as uv, in metres: map them onto the drawing
    qtex.repeat.set(1 / (2 * (f + 0.04)), 1 / (2 * (f + 0.04))); qtex.offset.set(0.5, 0.5);
    quad.material = new THREE.MeshStandardMaterial({ map: qtex, roughness: 0.45, metalness: 0.8 });
    // quadrant scale: degrees of noon sun, cut into a bronze sector between the rails
    var lens = new THREE.Group(); g.add(lens);
    var lr = new THREE.Mesh(new THREE.TorusBufferGeometry(0.062, 0.012, 8, 32), bronzeD); lens.add(lr);
    var glass = new THREE.Mesh(new THREE.CircleBufferGeometry(0.058, 32), new THREE.MeshStandardMaterial({ color: C('#CFE3E6'), roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    glass.castShadow = false; lens.add(glass);
    [-1, 1].forEach(function (sd) { var lug = box(0.02, 0.022, 0.03, bronzeD); lug.position.set(sd * 0.07, 0, 0); lens.add(lug); });
    // the focus of the glass, and its halo
    var spotM = new THREE.MeshBasicMaterial({ color: C('#FFF0C0'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var spot = new THREE.Mesh(new THREE.CircleBufferGeometry(1, 24), spotM); spot.rotation.x = -Math.PI / 2; spot.visible = false; g.add(spot);
    // a glow round the focus: three additive discs, each wider and fainter
    var haloM = new THREE.MeshBasicMaterial({ color: C('#FFB860'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var halo = new THREE.Group(); halo.rotation.x = -Math.PI / 2; halo.visible = false; g.add(halo);
    [0.5, 0.75, 1].forEach(function (k, i) { var d = new THREE.Mesh(new THREE.CircleBufferGeometry(k, 24), haloM); d.position.z = i * 0.0003; halo.add(d); });
    // ---- the hour dial, a small horizontal sundial let into the slab
    var Rd = 0.27, dx = m * 0.62, dz = 0.42, dtex = canvasTex(1024, 1024, function (gc, S) {
      var c = S / 2, k = S / 2 / Rd;
      gc.fillStyle = '#B08A52'; gc.fillRect(0, 0, S, S); sol_speck(gc, S, S, seedRng(W.P.seed + 41), 5000, 0.06);
      gc.strokeStyle = '#2A1C0C'; gc.fillStyle = '#2A1C0C';
      gc.lineWidth = 5; gc.beginPath(); gc.arc(c, c, 0.255 * k, 0, SOL_TAU); gc.stroke();
      gc.lineWidth = 2; gc.beginPath(); gc.arc(c, c, 0.2 * k, 0, SOL_TAU); gc.stroke();
      for (var q = 6 * 4; q <= 20 * 4; q++) {
        var H = q / 4, ha = haForClock(H) * D2R, th = Math.atan2(SPHI * Math.sin(ha), Math.cos(ha)), full = q % 4 === 0;
        if (Math.abs(haForClock(H)) > 112) continue;
        gc.lineWidth = full ? 6 : 2.5; gc.beginPath();
        var r0 = full ? 0.05 : 0.17;
        gc.moveTo(c + Math.sin(th) * r0 * k, c - Math.cos(th) * r0 * k); gc.lineTo(c + Math.sin(th) * 0.2 * k, c - Math.cos(th) * 0.2 * k); gc.stroke();
        if (full) {
          gc.save(); gc.translate(c + Math.sin(th) * 0.228 * k, c - Math.cos(th) * 0.228 * k); gc.rotate(th);
          gc.font = '700 60px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText(sol_hourLabel(H, dst), 0, 0); gc.restore();
        }
      }
      gc.font = '400 24px ' + FONT_MONO; gc.textAlign = 'center'; gc.fillText(dst ? 'CDT' : 'CST', c, c + 0.12 * k);
    });
    var dplate = new THREE.Mesh(new THREE.CylinderBufferGeometry(Rd, Rd + 0.01, 0.025, 64), bronzeD); dplate.position.set(dx, y0 + 0.0125, dz); g.add(dplate);
    var dface = new THREE.Mesh(new THREE.CircleBufferGeometry(Rd, 64), sol_faceMat(dtex, { rough: 0.45, metal: 0.8 }, { poly: true }));
    dface.rotation.x = -Math.PI / 2; dface.position.set(dx, y0 + 0.026, dz); g.add(dface);
    var Lg = Rd * 0.72, gsh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(Lg, 0), new THREE.Vector2(Lg, Lg * Math.tan(PHI))]);
    var gn = new THREE.Mesh(sol_ext(gsh, 0.012, 0), bronzeD); gn.rotation.y = Math.PI / 2; gn.position.set(dx, y0 + 0.026, dz); g.add(gn);
    // ---- the slab's top: the meridian through the touch hole, the motto, the latitude
    var ttex = canvasTex(2048, 1600, function (gc, Wc, Hc) {
      var kx = Wc / (Wx + 0.06), X = function (x) { return (x + (Wx + 0.06) / 2) * kx; }, Z = function (z) { return (z + (Dz + 0.06) / 2) * kx; };
      gc.fillStyle = 'rgba(0,0,0,0)'; gc.clearRect(0, 0, Wc, Hc);
      var darkStone = sol_ink(md.color) !== '#22190E', dk = darkStone ? '#D8D0C0' : sol_mix(md.color, '#000000', 0.55), lt = darkStone ? '#000000' : sol_mix(md.color, '#FFFFFF', 0.35);
      gc.strokeStyle = dk; gc.lineWidth = 5;
      gc.strokeRect(X(-Wx / 2 + 0.04), Z(-Dz / 2 + 0.04), (Wx - 0.08) * kx, (Dz - 0.08) * kx);
      gc.lineWidth = 7; gc.beginPath(); gc.moveTo(X(xv), Z(-Dz / 2 + 0.05)); gc.lineTo(X(xv), Z(Dz / 2 - 0.05)); gc.stroke();
      gc.font = '700 44px ' + FONT_SERIF; gc.textBaseline = 'middle'; gc.textAlign = 'center';
      sol_cut(gc, 'N', X(xv), Z(-Dz / 2 + 0.12), dk, lt);
      gc.font = '700 40px ' + FONT_SERIF;
      sol_cut(gc, T['Motto'], X(-m * 0.25), Z(Dz / 2 - 0.11), dk, lt);
      gc.font = '400 28px ' + FONT_MONO;
      sol_cut(gc, 'FIRES AT APPARENT NOON  30.31 N  104.02 W', X(0), Z(-Dz / 2 + 0.12) + (xv > 0 ? 0 : 0), dk, lt, 1.5);
    });
    var tface = new THREE.Mesh(new THREE.PlaneBufferGeometry(Wx + 0.06, Dz + 0.06), new THREE.MeshStandardMaterial({ map: ttex, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    tface.rotation.x = -Math.PI / 2; tface.position.y = y0 + 0.001; tface.receiveShadow = true; g.add(tface);
    // ---- smoke, fired at apparent noon, and the flash
    var puffs = [], pg = new THREE.IcosahedronBufferGeometry(1, 2), prr = seedRng(W.P.seed + 43), NV = 6, NP = 28;
    var muzzle = new THREE.Vector3(m * 0.66, yb, zc);
    for (var i = 0; i < NP; i++) {
      var atVent = i >= NP - NV, pm = new THREE.MeshStandardMaterial({ color: C('#DAD6CF'), emissive: C('#6E6A64'), emissiveIntensity: 0.35, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
      var pu = new THREE.Mesh(pg, pm); pu.visible = false; g.add(pu);
      var fr = prr(), sp0 = atVent ? 0.05 + fr * 0.35 : 0.2 + fr * 1.3;
      puffs.push({ m: pu, o: atVent ? Tv : muzzle, v: atVent ? new THREE.Vector3((prr() - 0.5) * 0.25, 1, (prr() - 0.5) * 0.25).normalize() : new THREE.Vector3(m, (prr() - 0.35) * 0.5, (prr() - 0.5) * 0.6).normalize(), d: sp0, s: atVent ? 0.03 + prr() * 0.04 : 0.07 + 0.12 * (1 - fr) + prr() * 0.06, rise: 0.01 + prr() * 0.02, v0: 0.6 + prr() * 0.8 });
    }
    var flash = sph(0.18, new THREE.MeshBasicMaterial({ color: C('#FFB25A'), transparent: true, opacity: 0.9, depthWrite: false }), 12, 8);
    flash.position.copy(muzzle).x += m * 0.12; flash.visible = false; g.add(flash);
    shade(g);
    spot.castShadow = false; halo.traverse(function (m) { m.castShadow = false; m.receiveShadow = false; }); glass.castShadow = false; tface.castShadow = false;
    puffs.forEach(function (p) { p.m.castShadow = false; p.m.receiveShadow = false; });
    var sN = new THREE.Vector3(), sd = new THREE.Vector3(), Lp = new THREE.Vector3(), zAx = new THREE.Vector3(0, 0, 1);
    return {
      group: g, R: 1.6, lookY: y0 + 0.2, dist: rf(r, 4.6, 5.4), camH: [1.9, 2.8], face: false, shadowPad: 5,
      close: { zoom: 0.42, el: 0.12, look: 0.12 },
      update: function (ctx) {
        // set the quadrant to today's noon sun
        var E0 = (90 - LAT) * D2R + ctx.sun.dec;
        sN.set(0, Math.sin(E0), Math.cos(E0));
        Lp.copy(Tv).addScaledVector(sN, f); lens.position.copy(Lp);
        lens.quaternion.setFromUnitVectors(zAx, sN);
        // the focus, traced from the real sun through the glass
        dirAzEl(ctx.sun.az, ctx.sun.el, sd);
        var el = ctx.sun.el, vis = false;
        if (el > 3 && sd.y > 0.05) {
          var t1 = (Lp.y - Tv.y) / sd.y, px = Lp.x - t1 * sd.x, pz = Lp.z - t1 * sd.z, py = Tv.y, dzb = pz - zc;
          var onBarrel = Math.abs(dzb) < rv * 0.8 && Math.abs(px) < 0.55;
          if (onBarrel) {
            py = yb + Math.sqrt(rv * rv - dzb * dzb) + 0.003; t1 = (Lp.y - py) / sd.y; px = Lp.x - t1 * sd.x; pz = Lp.z - t1 * sd.z;
            // the raised vent field round the touch hole
            if (Math.abs(px - xv) < 0.036 && Math.abs(pz - zc) < 0.036) { py = Tv.y + 0.0015; t1 = (Lp.y - py) / sd.y; px = Lp.x - t1 * sd.x; pz = Lp.z - t1 * sd.z; }
          }
          else { py = y0 + 0.004; t1 = (Lp.y - py) / sd.y; px = Lp.x - t1 * sd.x; pz = Lp.z - t1 * sd.z; }
          vis = Math.abs(px) < Wx / 2 && Math.abs(pz) < Dz / 2;
          if (vis) {
            var blur = 0.116 * Math.abs(t1 - f) / f + 0.007;
            spot.position.set(px, py, pz); spot.scale.set(Math.max(0.009, blur / 2), Math.max(0.009, blur / 2) / Math.max(0.3, sd.y), 1);
            spot.rotation.z = -Math.atan2(sd.x, -sd.z);
            spotM.opacity = clamp(Math.pow(0.02 / blur, 1.2), 0.18, 1) * sstep(3, 12, el);
          }
        }
        spot.visible = vis; halo.visible = vis;
        if (vis) { halo.position.copy(spot.position); halo.position.y += 0.002; var hs = 0.03 + 2.2 * spot.scale.x; halo.scale.set(hs, hs, 1); haloM.opacity = spotM.opacity * 0.22; }
        // minutes since apparent noon: the gun fires as the hour angle crosses zero
        var mins = sol_ha(ctx.utc) * 4, age = mins * 60, on = age >= 0 && age < 420 && el > 0;
        for (var i = 0; i < puffs.length; i++) {
          var p = puffs[i];
          p.m.visible = on;
          if (!on) continue;
          var tr = p.d * (1 - Math.exp(-age / p.v0)), drift = 0.011 * age * (0.5 + 0.5 * (ctx.wind || 1));
          p.m.position.copy(p.o).addScaledVector(p.v, tr);
          if (ctx.windDir) p.m.position.addScaledVector(ctx.windDir, drift);
          p.m.position.y += p.rise * Math.min(age, 240) * 0.2 + (i >= NP - NV ? 0.022 * Math.sqrt(age) : 0);
          var sc = p.s * (0.7 + 1.5 * Math.sqrt(Math.min(age, 300) / 40));
          p.m.scale.set(sc, sc * 0.85, sc);
          p.m.material.opacity = 0.42 * sstep(0, 0.2, age) * (1 - sstep(30, 420, age)) / (1 + 0.003 * age);
        }
        flash.visible = age >= 0 && age < 0.35;
      }
    };
  }

  // =====================================================================
  // 3. MERIDIAN OBELISK
  // The gilt tip of the obelisk is the nodus. Its shadow crosses a
  // pavement laid out for Marfa: hour lines (or the figure eight of each
  // clock hour) and the curves the tip traces on the solstices and the
  // equinox. The real shadow reads the hour and the date.
  // =====================================================================
  var SOL_OB_H = { '7 m': 7, '9 m': 9, '11 m': 11 };
  function sol_obelisk(W, matName) {
    var r = W.r, T = W.P.clockTraits, md = MATERIALS[matName], dst = W.dst, g = new THREE.Group();
    var hN = SOL_OB_H[T['Height']] || 9, eights = T['Hour Marks'] === 'Figure Eights', hero = heroMat(matName), motto = pick(r, SOL_MOTTOS);
    var Rp = 1.14 * hN, cz = 0.5 * hN, bw0 = 0.1 * hN, tw = bw0 * 0.66, pyrH = tw * 0.95;
    var stepM = mtl('#B7AC9A', 'stone', 0.9, 0, 1.4);
    // ---- plinth and steps
    var yP = 0.13, sy = yP, steps = [[bw0 * 3.0, 0.2], [bw0 * 2.4, 0.2], [bw0 * 1.9, 0.18]];
    steps.forEach(function (s) { var b = sol_bbox(s[0], s[1], s[0], stepM, 0.02); b.position.y = sy + s[1] / 2; g.add(b); sy += s[1]; });
    var dieH = hN * 0.1, dieW = bw0 * 1.5;
    var faces = [['LAT 30.3095 N', 'LON 104.0206 W'], ['NODUS ' + hN.toFixed(2) + ' M', 'ABOVE THE PAVEMENT'], null, null, [motto, 'THE TIP READS THE HOUR AND THE DAY'], ['MLOW', 'MARFA LIGHT']];
    var obDark = sol_ink(md.color) !== '#22190E', dk = obDark ? '#D9CFB8' : sol_mix(md.color, '#000000', 0.6), lt = obDark ? '#000000' : sol_mix(md.color, '#FFFFFF', 0.3);
    var dieMats = faces.map(function (lines) {
      if (!lines) return hero;
      var tex = canvasTex(1024, Math.round(1024 * dieH / dieW), function (gc, Wc, Hc) {
        gc.fillStyle = md.color; gc.fillRect(0, 0, Wc, Hc); sol_speck(gc, Wc, Hc, seedRng(W.P.seed + 51), 4000, 0.06);
        gc.strokeStyle = dk; gc.lineWidth = 6; gc.strokeRect(40, 40, Wc - 80, Hc - 80);
        var fs = Math.min(84, Math.floor((Wc - 160) / Math.max(lines[0].length, lines[1].length) * 1.6));
        gc.font = '700 ' + fs + 'px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
        sol_cut(gc, lines[0], Wc / 2, Hc / 2 - fs * 0.7, dk, lt, 3); sol_cut(gc, lines[1], Wc / 2, Hc / 2 + fs * 0.7, dk, lt, 3);
      });
      var m = new THREE.MeshStandardMaterial({ map: tex, roughness: md.rough, metalness: md.metal * 0.6 });
      return m;
    });
    var die = new THREE.Mesh(new THREE.BoxBufferGeometry(dieW, dieH, dieW), dieMats); die.position.y = sy + dieH / 2; g.add(die);
    sy += dieH;
    var cor = sol_bbox(dieW + 0.16, 0.12, dieW + 0.16, stepM, 0.02); cor.position.y = sy + 0.06; g.add(cor); sy += 0.12;
    // ---- the shaft, tapering, and the pyramidion
    var Hsh = yP + hN - sy - pyrH, sg = new THREE.BoxBufferGeometry(bw0, Hsh, bw0, 1, 1, 1), pa = sg.attributes.position, kk = tw / bw0;
    for (var i = 0; i < pa.count; i++) if (pa.getY(i) > 0) pa.setXYZ(i, pa.getX(i) * kk, pa.getY(i), pa.getZ(i) * kk);
    sg.computeVertexNormals();
    var shaft = new THREE.Mesh(sg, hero); shaft.position.y = sy + Hsh / 2; g.add(shaft);
    // a column of cut letters down the south face of the shaft
    var colTxt = ['M', 'A', 'R', 'F', 'A', '', '3', '0', '°', '1', '8', '′', 'N', '', 'S', 'O', 'L'];
    var itex = canvasTex(128, 1024, function (gc, Wc, Hc) {
      gc.clearRect(0, 0, Wc, Hc); gc.font = '700 50px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      colTxt.forEach(function (ch, i) { sol_cut(gc, ch, Wc / 2, 40 + i * 57, dk, lt, 2); });
    });
    var ih = Hsh * 0.42, iw = ih / 8, insc = new THREE.Mesh(new THREE.PlaneBufferGeometry(iw, ih), new THREE.MeshStandardMaterial({ map: itex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
    var zf = (bw0 - (bw0 - tw) * 0.72) / 2 + 0.004;
    insc.position.set(0, sy + Hsh * 0.72, zf); insc.rotation.x = -Math.atan((bw0 - tw) / 2 / Hsh); g.add(insc);
    var pm = { 'Gilt': sol_gilt(), 'Bronze': sol_bronze(), 'Mirror Steel': std('#D8DCE0', 0.14, 1) }[T['Pyramidion']] || sol_gilt();
    pm = pm.clone(); pm.flatShading = true;
    var pyr = new THREE.Mesh(new THREE.ConeBufferGeometry(tw / Math.SQRT2, pyrH, 4, 1), pm);
    pyr.rotation.y = Math.PI / 4; pyr.position.y = yP + hN - pyrH / 2; g.add(pyr);
    // ---- the pavement, drawn from the shadow of the tip
    var S = 2560, lineHex = '#6E4E26', pave = pick(r, ['#D6CAB2', '#CFC6B7', '#D9C7A6']);
    var ptex = canvasTex(S, S, function (gc) {
      var k = S / (2 * Rp), X = function (x) { return (x + Rp) * k; }, Z = function (z) { return (z + cz + Rp) * k; };
      var rr = seedRng(W.P.seed + 52), lim = Rp * 0.965;
      gc.fillStyle = pave; gc.fillRect(0, 0, S, S);
      // slabs: rings and radial joints, each slab its own tone
      var ringW = 1.1, nR = Math.ceil((Rp + cz) / ringW);
      for (var ri = 1; ri < nR; ri++) {
        var r0 = ri * ringW, r1 = r0 + ringW, n = Math.max(6, Math.round(SOL_TAU * r0 / 1.4)), off = rr() * SOL_TAU;
        for (var si = 0; si < n; si++) {
          var a0 = off + si / n * SOL_TAU, a1 = off + (si + 1) / n * SOL_TAU, v = (rr() - 0.5) * 0.08;
          gc.fillStyle = v > 0 ? 'rgba(255,255,255,' + v + ')' : 'rgba(0,0,0,' + (-v) + ')';
          gc.beginPath(); gc.arc(X(0), Z(0), r1 * k, a0, a1); gc.arc(X(0), Z(0), r0 * k, a1, a0, true); gc.closePath(); gc.fill();
          gc.strokeStyle = 'rgba(60,50,40,0.35)'; gc.lineWidth = 2; gc.stroke();
        }
      }
      sol_speck(gc, S, S, rr, 30000, 0.05);
      function ok(p) { return p && p[0] * p[0] + (p[1] + cz) * (p[1] + cz) < lim * lim && p[0] * p[0] + p[1] * p[1] > (bw0 * 1.6) * (bw0 * 1.6); }
      function poly(pts, w, col, dash) {
        gc.strokeStyle = col; gc.lineWidth = w; gc.setLineDash(dash || []); gc.lineJoin = 'round'; gc.beginPath();
        var pen = false;
        pts.forEach(function (p) { if (!ok(p)) { pen = false; return; } if (pen) gc.lineTo(X(p[0]), Z(p[1])); else gc.moveTo(X(p[0]), Z(p[1])); pen = true; });
        gc.stroke(); gc.setLineDash([]);
      }
      function tipAt(ha, dec) { var s = sol_eqDir(ha, dec); return s[1] > 0.05 ? sol_tip(s, hN) : null; }
      // the true meridian
      gc.strokeStyle = '#8A6A3A'; gc.lineWidth = 0.06 * k; gc.beginPath(); gc.moveTo(X(0), Z(-bw0 * 1.6)); gc.lineTo(X(0), Z(-cz - lim)); gc.stroke();
      // date curves: solstices and equinox bold, the months between light
      var decs = [[23.44, 6, 'JUN 21'], [20.15, 2.5], [11.47, 2.5], [0, 6, 'MAR 20  SEP 22'], [-11.47, 2.5], [-20.15, 2.5], [-23.44, 6, 'DEC 21']];
      decs.forEach(function (q) {
        var pts = [], lastIn = null;
        for (var ha = -125; ha <= 125; ha += 0.5) { var p = tipAt(ha, q[0]); pts.push(p); if (ok(p) && ha < 0) lastIn = lastIn || p; }
        poly(pts, q[1] > 3 ? 0.05 * k : 0.022 * k, lineHex, q[1] > 3 ? null : [0.15 * k, 0.1 * k]);
        if (q[2]) {
          var lp = null; for (var hb = 125; hb >= -125; hb -= 0.5) { var p2 = tipAt(hb, q[0]); if (ok(p2)) { lp = p2; break; } }
          if (lp) { gc.save(); gc.fillStyle = lineHex; gc.font = '700 ' + Math.round(0.36 * k) + 'px ' + FONT_SERIF; gc.textAlign = 'right'; gc.textBaseline = 'middle'; gc.translate(X(lp[0]), Z(lp[1])); gc.fillText(q[2] + '  ', 0, q[0] < 0 ? -0.3 * k : 0.3 * k); gc.restore(); }
        }
      });
      // hour marks, mean time corrected for Marfa's longitude
      gc.fillStyle = lineHex; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      for (var H = 6; H <= 20.01; H += eights ? 1 : 0.5) {
        var ha = haForClock(H), full = Math.abs(H - Math.round(H)) < 0.01, pts2 = [], d, outer = null;
        if (eights) {
          var y0 = daysFromCivil(2027, 1, 1);
          for (d = 0; d <= 366; d += 1) {
            var sp = sunPos((y0 + d) * 86400 + (H + 6) * 3600);
            pts2.push(sp.el > 3 ? sol_tip(sol_azDir(sp.az, sp.el), hN) : null);
          }
          poly(pts2, 0.04 * k, lineHex);
          // the winter end, where the label sits
          for (d = 340; d <= 366; d++) { if (ok(pts2[d])) outer = pts2[d]; }
          if (!outer) for (d = 0; d < 366; d++) if (ok(pts2[d])) { var pp = pts2[d]; if (!outer || pp[0] * pp[0] + pp[1] * pp[1] > outer[0] * outer[0] + outer[1] * outer[1]) outer = pp; }
        } else {
          for (var dec = -23.44; dec <= 23.45; dec += 0.5) pts2.push(tipAt(ha, dec));
          poly(pts2, (full ? 0.045 : 0.02) * k, lineHex);
          for (d = 0; d < pts2.length; d++) if (ok(pts2[d])) outer = pts2[d];
        }
        if (full && outer) {
          var L = Math.sqrt(outer[0] * outer[0] + outer[1] * outer[1]), ox = outer[0] / L, oz = outer[1] / L;
          var lx = outer[0] + ox * 0.5, lz = outer[1] + oz * 0.5;
          if (lx * lx + (lz + cz) * (lz + cz) > (lim - 0.3) * (lim - 0.3)) { lx = outer[0] - ox * 0.45; lz = outer[1] - oz * 0.45; }
          gc.font = '700 ' + Math.round(0.5 * k) + 'px ' + FONT_SERIF;
          gc.save(); gc.translate(X(lx), Z(lz)); gc.rotate(Math.atan2(ox, -oz)); gc.fillText(sol_hourLabel(H, dst), 0, 0); gc.restore();
        }
      }
      // the rim: compass and the name of the time
      gc.strokeStyle = lineHex; gc.lineWidth = 0.05 * k; gc.beginPath(); gc.arc(X(0), Z(-cz), (Rp - 0.08) * k, 0, SOL_TAU); gc.stroke();
      gc.font = '700 ' + Math.round(0.3 * k) + 'px ' + FONT_MONO; gc.textBaseline = 'middle';
      sol_arcText(gc, (dst ? 'CENTRAL DAYLIGHT TIME' : 'CENTRAL STANDARD TIME') + '   MARFA   ' + (eights ? 'CLOCK TIME ON THE FIGURE EIGHTS' : 'HOUR LINES READ SUN TIME, EQUATION ON THE DIE'), X(0), Z(-cz), (Rp - 0.3) * k, -Math.PI / 2, false);
      gc.font = '700 ' + Math.round(0.6 * k) + 'px ' + FONT_SERIF; gc.textAlign = 'center';
      gc.fillText('N', X(0), Z(-cz - Rp + 0.8));
    });
    // a low platform, so the pavement stands clear of whatever ground the place lays
    var plat = new THREE.Mesh(new THREE.CylinderBufferGeometry(Rp + 0.2, Rp + 0.26, yP, 128), stepM); plat.position.set(0, yP / 2 - 0.005, -cz); g.add(plat);
    var pav = new THREE.Mesh(new THREE.CircleBufferGeometry(Rp, 128), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.85, metalness: 0 }));
    pav.rotation.x = -Math.PI / 2; pav.position.set(0, yP + 0.002, -cz); g.add(pav);
    shade(g);
    pav.castShadow = false; insc.castShadow = false;
    return { group: g, R: Rp + cz + 0.3, lookY: hN * 0.32, dist: hN * rf(r, 2.5, 2.9), camH: [hN * 0.55, hN * 0.85], face: false, shadowPad: 4,
      close: { zoom: 0.62, el: 0.55, look: -hN * 0.2 } };
  }

  // =====================================================================
  // 4. WALL DIAL
  // A vertical declining sundial painted on a freestanding adobe wall. The
  // wall faces a little off south and the hour lines are drawn for that
  // facing at latitude 30.3; the style is set parallel to the earth's axis.
  // =====================================================================
  var SOL_FACING = { 'Due South': 0, '15° East': -15, '30° East': -30, '12° West': 12, '24° West': 24, '36° West': 36 };
  function sol_wall(W, matName) {
    var r = W.r, T = W.P.clockTraits, md = MATERIALS[matName], dst = W.dst, g = new THREE.Group(), wall = new THREE.Group();
    var D = SOL_FACING[T['Facing']] || 0, roman = r() < 0.5;
    wall.rotation.y = -D * D2R; g.add(wall);
    var Ww = 5.4, Hw = 3.8, Tw = 0.5, fw = 3.3, fh = 2.2, fy = 1.9, fx = 0, hb = 0.46;
    var wallHex = matName === 'Blossom Blue' ? sol_mix(md.color, '#E8E4DA', 0.22) : md.color, plaster = mtl(wallHex, 'plaster', 0.95, 0, 1.3);
    var border = pick(r, ['#2D3E6B', '#8E3B22', '#C08A2E', '#2F5D50']), lineC = pick(r, ['#7A2718', '#1E1B18']);
    // the style root, placed so the fan of lines sits in the field
    var f = sol_wallFrame(D);
    var sd = [-SOL_P[0], -SOL_P[1], -SOL_P[2]], sdl = [sol_dot(sd, f.u), sol_dot(sd, f.v), sol_dot(sd, f.n)];
    var ox = fx + clamp(-sdl[0] / Math.max(0.2, -sdl[1]) * 1.2, -0.9, 0.9), oy = fy + fh / 2 - 0.34;
    var lines = [];
    for (var q = 5 * 4; q <= 20 * 4; q += 2) {
      var H = q / 4, dir = sol_wallLine(D, haForClock(H));
      if (dir) lines.push([H, dir]);
    }
    // field clip: the point where a ray from the root leaves the inner rectangle
    function exitAt(dir, inset) {
      var x0 = fx - fw / 2 + inset, x1 = fx + fw / 2 - inset, y0 = fy - fh / 2 + inset, y1 = fy + fh / 2 - inset, t = 99;
      if (dir[0] > 1e-6) t = Math.min(t, (x1 - ox) / dir[0]); if (dir[0] < -1e-6) t = Math.min(t, (x0 - ox) / dir[0]);
      if (dir[1] > 1e-6) t = Math.min(t, (y1 - oy) / dir[1]); if (dir[1] < -1e-6) t = Math.min(t, (y0 - oy) / dir[1]);
      return t;
    }
    var PX = 400, cw = Math.round(Ww * PX), chh = Math.round(Hw * PX);
    var ftex = canvasTex(cw, chh, function (gc) {
      var X = function (x) { return (x + Ww / 2) * PX; }, Y = function (y) { return (Hw - y) * PX; }, rr = seedRng(W.P.seed + 61);
      gc.fillStyle = wallHex; gc.fillRect(0, 0, cw, chh);
      // plaster, mottled, with the mud bricks showing where it fell away
      for (var i = 0; i < 260; i++) {
        var x = rr() * cw, y = rr() * chh, rad = 20 + rr() * 120, v = (rr() - 0.5) * 0.12;
        var gr = gc.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, v > 0 ? 'rgba(255,255,255,' + v + ')' : 'rgba(60,40,20,' + (-v) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        gc.fillStyle = gr; gc.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (i = 0; i < 5; i++) {
        var bx = rr() * (cw - 500), by = chh - (0.1 + rr() * 0.9) * PX * (rr() < 0.6 ? 1 : 2.4), bw = 160 + rr() * 300, bh = 80 + rr() * 140;
        if (bx + bw > X(fx - fw / 2 - 0.1) && bx < X(fx + fw / 2 + 0.1) && by < Y(fy - fh / 2 - 0.1)) continue;
        gc.save(); gc.beginPath(); gc.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, rr() - 0.5, 0, SOL_TAU); gc.clip();
        gc.fillStyle = '#8C6848'; gc.fillRect(bx, by, bw, bh);
        gc.strokeStyle = '#6E5238'; gc.lineWidth = 6;
        for (var yy = Math.floor(by / 48) * 48; yy < by + bh; yy += 48) { gc.beginPath(); gc.moveTo(bx, yy); gc.lineTo(bx + bw, yy); gc.stroke(); for (var xx = bx + ((yy / 48) % 2) * 60; xx < bx + bw; xx += 120) { gc.beginPath(); gc.moveTo(xx, yy); gc.lineTo(xx, yy + 48); gc.stroke(); } }
        gc.restore();
      }
      // the painted field
      var X0 = X(fx - fw / 2), Y0 = Y(fy + fh / 2), FW = fw * PX, FH = fh * PX, bd = 0.2 * PX, HB = hb * PX;
      gc.fillStyle = border; gc.fillRect(X0 - bd, Y0 - bd - HB, FW + 2 * bd, FH + 2 * bd + HB);
      gc.fillStyle = '#EFE7D4'; gc.fillRect(X0, Y0, FW, FH);
      gc.strokeStyle = '#EFE7D4'; gc.lineWidth = 4; gc.strokeRect(X0 - bd + 10, Y0 - bd - HB + 10, FW + 2 * bd - 20, FH + 2 * bd + HB - 20);
      gc.beginPath(); gc.moveTo(X0 - bd + 10, Y0 - bd + 4); gc.lineTo(X0 + FW + bd - 10, Y0 - bd + 4); gc.stroke();
      // hour lines from the root of the style
      var OX = X(ox), OY = Y(oy);
      gc.strokeStyle = lineC; gc.fillStyle = lineC; gc.lineCap = 'round';
      lines.forEach(function (L) {
        var H = L[0], dir = L[1], full = Math.abs(H - Math.round(H)) < 0.01, t1 = exitAt(dir, 0.04), t0 = full ? 0.28 : 0.62;
        if (t1 < t0 + 0.05) return;
        gc.lineWidth = full ? 9 : 4; gc.beginPath(); gc.moveTo(OX + dir[0] * t0 * PX, OY - dir[1] * t0 * PX); gc.lineTo(OX + dir[0] * t1 * PX, OY - dir[1] * t1 * PX); gc.stroke();
        if (full) {
          // numerals ride the border band
          var tb = exitAt(dir, -0.1);
          gc.save(); gc.fillStyle = '#EFE7D4'; gc.font = '700 60px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
          gc.fillText(sol_hourLabel(H, dst, roman), OX + dir[0] * tb * PX, OY - dir[1] * tb * PX); gc.restore();
        }
      });
      // the sun painted at the root
      gc.save(); gc.translate(OX, OY);
      gc.fillStyle = '#D9A33A';
      for (i = 0; i < 16; i++) { var aa = i / 16 * SOL_TAU; gc.beginPath(); gc.moveTo(Math.cos(aa - 0.12) * 60, Math.sin(aa - 0.12) * 60); gc.lineTo(Math.cos(aa) * (i % 2 ? 105 : 130), Math.sin(aa) * (i % 2 ? 105 : 130)); gc.lineTo(Math.cos(aa + 0.12) * 60, Math.sin(aa + 0.12) * 60); gc.fill(); }
      gc.beginPath(); gc.arc(0, 0, 64, 0, SOL_TAU); gc.fill();
      gc.fillStyle = '#7A4E14'; gc.beginPath(); gc.arc(-20, -12, 7, 0, SOL_TAU); gc.arc(20, -12, 7, 0, SOL_TAU); gc.fill();
      gc.lineWidth = 5; gc.strokeStyle = '#7A4E14'; gc.beginPath(); gc.arc(0, 8, 24, 0.3, Math.PI - 0.3); gc.stroke();
      gc.restore();
      // the motto in the head band, the facing under it
      gc.fillStyle = '#EFE7D4'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      gc.font = '700 ' + (T['Motto'].length > 18 ? 72 : 92) + 'px ' + FONT_SERIF;
      gc.fillText(T['Motto'], X(fx), Y0 - bd - HB * 0.52);
      gc.font = '400 30px ' + FONT_MONO;
      gc.fillText('MARFA 30.31 N   ' + (D === 0 ? 'FACING DUE SOUTH' : 'DECLINING ' + Math.abs(D) + (D > 0 ? ' WEST' : ' EAST')) + '   ' + (dst ? 'CDT' : 'CST'), X(fx), Y0 - bd - HB * 0.13);
      // weather: flakes of paint gone back to plaster, and cracks
      for (i = 0; i < 90; i++) {
        var px = X0 + rr() * FW, py = Y0 + rr() * FH, pr = 3 + rr() * 16;
        gc.fillStyle = sol_mix('#EFE7D4', '#B3A690', 0.45 + rr() * 0.35); gc.beginPath(); gc.ellipse(px, py, pr * 0.8, pr * (0.3 + rr() * 0.6), rr() * 3, 0, SOL_TAU); gc.fill();
      }
      gc.strokeStyle = 'rgba(70,50,30,0.5)'; gc.lineWidth = 2;
      for (i = 0; i < 14; i++) { var cx2 = rr() * cw, cy2 = rr() * chh; gc.beginPath(); gc.moveTo(cx2, cy2); for (var kx = 0; kx < 7; kx++) { cx2 += (rr() - 0.5) * 70; cy2 += rr() * 40; gc.lineTo(cx2, cy2); } gc.stroke(); }
      // rain stains under the coping
      for (i = 0; i < 30; i++) { var sx2 = rr() * cw, sl = 60 + rr() * 260; var gr2 = gc.createLinearGradient(0, 0, 0, sl); gr2.addColorStop(0, 'rgba(70,50,30,0.22)'); gr2.addColorStop(1, 'rgba(70,50,30,0)'); gc.fillStyle = gr2; gc.fillRect(sx2, 0, 6 + rr() * 16, sl); }
    });
    var front = new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.95, metalness: 0 });
    detail(front, 'plaster', { tile: 1.3, albedo: 0.25 });
    var body = new THREE.Mesh(new THREE.BoxBufferGeometry(Ww, Hw, Tw), [plaster, plaster, plaster, plaster, front, plaster]);
    body.position.y = Hw / 2; wall.add(body);
    // rounded adobe top, battered buttresses behind, a bench in front
    var capG = new THREE.CylinderBufferGeometry(Tw / 2, Tw / 2, Ww, 16, 1, false, 0, Math.PI); capG.rotateZ(Math.PI / 2); capG.rotateX(Math.PI / 2);
    var capM = new THREE.Mesh(capG, plaster); capM.position.y = Hw; wall.add(capM);
    [-1, 1].forEach(function (sd2) {
      var bg = new THREE.BoxBufferGeometry(0.6, 2.6, 1.1), bp = bg.attributes.position;
      for (var i = 0; i < bp.count; i++) if (bp.getY(i) > 0 && bp.getZ(i) < 0) bp.setZ(i, bp.getZ(i) * 0.1);
      bg.computeVertexNormals();
      var bt = new THREE.Mesh(bg, plaster); bt.position.set(sd2 * (Ww / 2 - 0.3), 1.3, -Tw / 2 - 0.5); wall.add(bt);
    });
    var bench = sol_bbox(3.6, 0.42, 0.46, plaster, 0.06); bench.position.set(0, 0.21, Tw / 2 + 0.23); wall.add(bench);
    // a little tiled hood over the painting
    var hoodW = fw + 0.8, hood = new THREE.Group(); hood.position.set(fx, fy + fh / 2 + 0.2 + hb + 0.1, Tw / 2); wall.add(hood);
    var board = sol_bbox(hoodW, 0.05, 0.36, mtl('#5A3E26', 'wood', 0.85, 0, 0.6), 0.01); board.rotation.x = 0.32; board.position.set(0, 0.02, 0.16); hood.add(board);
    var nT = Math.floor(hoodW / 0.17), tg = new THREE.CylinderBufferGeometry(0.075, 0.085, 0.42, 10, 1, true, 0, Math.PI); tg.rotateX(Math.PI / 2);
    var tiles = new THREE.InstancedMesh(tg, std('#A0522D', 0.85, 0, { side: THREE.DoubleSide }), nT), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0, 0));
    for (var ti = 0; ti < nT; ti++) { m4.compose(new THREE.Vector3(-hoodW / 2 + 0.085 + ti * 0.17, 0.08, 0.17), qq, new THREE.Vector3(1, 1, 1)); tiles.setMatrixAt(ti, m4); }
    tiles.castShadow = true; tiles.receiveShadow = true; hood.add(tiles);
    // ---- the style, parallel to the earth's axis, in world coordinates
    var styleM = T['Style'] === 'Bronze Plate' ? sol_bronze() : sol_iron(), Ls = 0.95;
    var O = new THREE.Vector3(ox, oy, Tw / 2);
    var dirL = new THREE.Vector3(sdl[0], sdl[1], sdl[2]).normalize(), tipP = O.clone().addScaledVector(dirL, Ls);
    if (T['Style'] === 'Bronze Plate') {
      // a triangle in the plane of the style and its substyle
      var Xs = new THREE.Vector3(sdl[0], sdl[1], 0).normalize(), Yn = new THREE.Vector3(0, 0, 1), Zs = new THREE.Vector3().crossVectors(Xs, Yn);
      var lx = dirL.dot(Xs) * Ls, ly = dirL.dot(Yn) * Ls;
      var tri = new THREE.Mesh(sol_ext(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(lx, 0), new THREE.Vector2(lx, ly)]), 0.016, 0), styleM);
      tri.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xs, Yn, Zs)); tri.position.copy(O); wall.add(tri);
    } else {
      wall.add(sol_rod(O, tipP, 0.014, styleM, 8));
      var foot = O.clone().add(new THREE.Vector3(sdl[0], sdl[1], 0).normalize().multiplyScalar(0.62));
      wall.add(sol_rod(foot, O.clone().addScaledVector(dirL, Ls * 0.62), 0.01, styleM, 6));
      if (T['Style'] === 'Scrolled Iron') {
        var sc = new THREE.Mesh(new THREE.TorusBufferGeometry(0.07, 0.008, 6, 24, Math.PI * 1.6), styleM);
        var mid = foot.clone().lerp(O.clone().addScaledVector(dirL, Ls * 0.62), 0.5);
        sc.position.copy(mid); sc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(sdl[0], sdl[1], 0).normalize().cross(new THREE.Vector3(0, 0, 1))); wall.add(sc);
      }
      var knob = sph(0.022, styleM, 10, 8); knob.position.copy(tipP); wall.add(knob);
    }
    var ros = cyl(0.05, 0.06, 0.02, 16, styleM); ros.rotation.x = Math.PI / 2; ros.position.copy(O); wall.add(ros);
    // the style's shadow, traced from the sun onto the wall, so it reads even where the
    // place widens the shadow map past what a 3 cm rod can show
    // an umbra strip and a wider, fainter penumbra under it
    var wsM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    var wsh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), wsM); wsh.visible = false; wall.add(wsh);
    var wpen = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 2.2), wsM); wpen.position.z = -0.0005; wsh.add(wpen);
    var sunW = new THREE.Vector3(), uW = sol_v(f.u), vW = sol_v(f.v), nW = sol_v(f.n);
    shade(g); [wsh, wpen].forEach(function (m) { m.castShadow = false; m.receiveShadow = false; });
    return { group: g, R: 3.1, lookY: 1.9, dist: rf(r, 8.6, 9.8), camH: [1.5, 2.3], face: false, shadowPad: 5,
      close: { zoom: 0.5, el: 0.05, look: 0.25 },
      update: function (ctx) {
        dirAzEl(ctx.sun.az, ctx.sun.el, sunW);
        var sx = sunW.dot(uW), sy = sunW.dot(vW), sz = sunW.dot(nW), on = ctx.sun.el > 0 && sz > 0.02;
        wsh.visible = on;
        if (!on) return;
        // the tip's shadow on the face (z = Tw / 2), in wall coordinates
        var k = (tipP.z - Tw / 2) / sz, qx = tipP.x - sx * k, qy = tipP.y - sy * k, dx = qx - O.x, dy = qy - O.y, L = Math.sqrt(dx * dx + dy * dy);
        wsh.position.set(O.x + dx / 2, O.y + dy / 2, Tw / 2 + 0.003); wsh.rotation.z = Math.atan2(dy, dx);
        wsh.scale.set(Math.max(L, 0.001), 0.022 + 0.006 * Ls, 1);
        wsM.opacity = 0.32 * sstep(0, 4, ctx.sun.el) * sstep(0.02, 0.15, sz);
      } };
  }

  // =====================================================================
  // 5. NOCTURNAL
  // A star clock the size of a door. You sight Polaris through the pivot,
  // 30.3 degrees above the north horizon, and lay the arm along the Guards,
  // the two pointer stars of the Plough. Where the arm crosses the hour disc,
  // set each day to the date, is the time. By day the Guards are still up
  // there behind the blue; a small sun rides the rim where the real sun is.
  // =====================================================================
  function sol_nocturnal(W, matName) {
    var r = W.r, T = W.P.clockTraits, md = MATERIALS[matName], dst = W.dst, g = new THREE.Group();
    var metal = sol_hero(matName), gilt = sol_gilt(), dark = sol_iron(), roman = T['Numerals'] === 'Roman';
    var ink = sol_ink(md.color), off = dst ? -5 : -6;
    // the hour disc in a second metal and the arm in blued steel, so the three parts read apart
    var vHex = matName === 'Brass' ? '#C9CDD2' : '#B58B4C', vMetal = std(vHex, 0.38, 0.95, { tex: 'brushed', tile: 0.8 }), vInk = sol_ink(vHex);
    var armMat = matName === 'Ink Black' ? gilt : sol_blued();
    var Cn = new THREE.Vector3(0, 2.4, 0), nc = new THREE.Group();
    nc.position.copy(Cn);
    // local x east, y toward the zenith side of the pole, z toward you (south and down)
    nc.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sol_v(SOL_E), sol_v(SOL_Q), new THREE.Vector3(-SOL_P[0], -SOL_P[1], -SOL_P[2])));
    g.add(nc);
    var Rd = 0.82, hole = function () { return new THREE.Path(sol_circle(0.022, 20).reverse()); };
    // ---- the mater: the date plate and its handle
    var ms = new THREE.Shape(), a0 = -Math.PI / 2 + 0.16, a1 = 3 * Math.PI / 2 - 0.16;
    ms.moveTo(Math.cos(a0) * Rd, Math.sin(a0) * Rd);
    ms.absarc(0, 0, Rd, a0, a1, false);
    ms.lineTo(-0.075, -1.14); ms.absarc(0, -1.2, 0.09, Math.PI - 0.6, 0.6, false); ms.lineTo(Math.cos(a0) * Rd, Math.sin(a0) * Rd);
    ms.holes.push(hole()); ms.holes.push(new THREE.Path(sol_circle(0.035, 20).map(function (p) { return new THREE.Vector2(p.x, p.y - 1.2); }).reverse()));
    var mater = new THREE.Mesh(sol_ext(ms, 0.03, 0.007, 48), metal); nc.add(mater);
    // the date ring: each day of 2027 sits where the hour disc's midnight tooth points on that day
    var d0 = daysFromCivil(2027, 1, 1);
    function psiDay(k) { return sol_noctSet(d0 + k, off); }
    var dtex = canvasTex(2048, 2048, function (gc, S) {
      var c = S / 2, k = S / 2 / Rd, P = function (ang, rad) { return [c - Math.sin(ang) * rad * k, c - Math.cos(ang) * rad * k]; };
      gc.fillStyle = md.color; gc.fillRect(0, 0, S, S); sol_speck(gc, S, S, seedRng(W.P.seed + 71), 9000, 0.05);
      gc.strokeStyle = ink; gc.fillStyle = ink;
      gc.lineWidth = 4; [0.805, 0.77, 0.7, 0.62].forEach(function (rr) { gc.beginPath(); gc.arc(c, c, rr * k, 0, SOL_TAU); gc.stroke(); });
      for (var dd = 0; dd < 365; dd++) {
        var tm = civilFromDays(d0 + dd), ang = psiDay(dd), first = tm[2] === 1, ten = tm[2] % 5 === 0;
        var r0 = first ? 0.62 : ten ? 0.73 : 0.75, p0 = P(ang, r0), p1 = P(ang, 0.77);
        gc.lineWidth = first ? 5 : ten ? 3 : 1.5; gc.beginPath(); gc.moveTo(p0[0], p0[1]); gc.lineTo(p1[0], p1[1]); gc.stroke();
        if (tm[2] === 15) {
          var q = P(ang, 0.66);
          gc.save(); gc.translate(q[0], q[1]); gc.rotate(-ang); gc.font = '700 50px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
          gc.fillText(MONTHS[tm[1] - 1], 0, 0); gc.restore();
        }
      }
      gc.font = '400 30px ' + FONT_MONO; gc.textBaseline = 'middle';
      sol_arcText(gc, 'SIGHT POLARIS THROUGH THE PIVOT   LAY THE ARM ON THE GUARDS   30.3 N', c, c, 0.787 * k, -Math.PI / 2, false);
    });
    var dface = new THREE.Mesh(new THREE.CircleBufferGeometry(Rd, 128), sol_faceMat(dtex, md, { poly: true, metal: Math.min(0.4, md.metal), rough: 0.5 }));
    dface.position.z = 0.0152; nc.add(dface);
    // ---- the volvelle: 24 hours, a midnight tooth, the day shaded
    var vol = new THREE.Group(); vol.position.z = 0.03; nc.add(vol);
    var Rv = 0.585, vs, rim = T['Rim'];
    if (rim === 'Toothed') {
      var pts = [];
      for (var i = 0; i < 24 * 8; i++) {
        var ang = i / (24 * 8) * SOL_TAU + Math.PI / 2, ph = i % 8, rad = Rv + (ph >= 3 && ph <= 5 ? 0.028 : 0) + (i < 4 || i > 24 * 8 - 4 ? 0.07 : 0);
        pts.push(new THREE.Vector2(Math.cos(ang) * rad, Math.sin(ang) * rad));
      }
      vs = new THREE.Shape(pts);
    } else {
      vs = new THREE.Shape(); var ta = 0.07;
      vs.moveTo(Math.cos(Math.PI / 2 + ta) * Rv, Math.sin(Math.PI / 2 + ta) * Rv);
      vs.absarc(0, 0, Rv, Math.PI / 2 + ta, Math.PI / 2 - ta + SOL_TAU, false);
      vs.lineTo(0, Rv + 0.085);
    }
    vs.holes.push(hole());
    vol.add(new THREE.Mesh(sol_ext(vs, 0.018, 0.004, 64), vMetal));
    var vtex = canvasTex(1536, 1536, function (gc, S) {
      var c = S / 2, k = S / 2 / 0.57, P = function (ang, rad) { return [c - Math.sin(ang) * rad * k, c - Math.cos(ang) * rad * k]; };
      gc.fillStyle = vHex; gc.fillRect(0, 0, S, S); sol_speck(gc, S, S, seedRng(W.P.seed + 72), 6000, 0.05);
      // day hours shaded: between six in the morning and six at night
      gc.fillStyle = 'rgba(0,0,0,0.12)'; gc.beginPath();
      gc.arc(c, c, 0.56 * k, -Math.PI / 2 - 6 * 15 * D2R, -Math.PI / 2 - 18 * 15 * D2R, true); gc.arc(c, c, 0.36 * k, -Math.PI / 2 - 18 * 15 * D2R, -Math.PI / 2 - 6 * 15 * D2R, false); gc.fill();
      gc.strokeStyle = vInk; gc.fillStyle = vInk;
      gc.lineWidth = 4; [0.56, 0.52, 0.36].forEach(function (rr) { gc.beginPath(); gc.arc(c, c, rr * k, 0, SOL_TAU); gc.stroke(); });
      for (var q = 0; q < 96; q++) {
        var ang = q / 96 * SOL_TAU, full = q % 4 === 0, half = q % 2 === 0, p0 = P(ang, full ? 0.36 : half ? 0.49 : 0.505), p1 = P(ang, 0.52);
        gc.lineWidth = full ? 5 : 2.5; gc.beginPath(); gc.moveTo(p0[0], p0[1]); gc.lineTo(p1[0], p1[1]); gc.stroke();
        if (full) {
          var hr = q / 4, lab = roman ? ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][hr % 12] : String(hr === 0 ? 24 : hr), pl = P(ang, 0.44);
          gc.save(); gc.translate(pl[0], pl[1]); gc.rotate(-ang); gc.font = '700 ' + (roman ? 48 : 56) + 'px ' + FONT_SERIF; gc.textAlign = 'center'; gc.textBaseline = 'middle';
          gc.fillText(lab, 0, 0); gc.restore();
        }
      }
      // the Plough, drawn small in the middle, with the Guards picked out
      gc.font = '400 28px ' + FONT_MONO; gc.textAlign = 'center';
      gc.fillText('NOCTURNAL', c, c - 0.22 * k); gc.fillText('MARFA  ' + (dst ? 'CDT' : 'CST'), c, c + 0.24 * k);
      var st = [[-0.17, 0.02], [-0.16, 0.1], [-0.07, 0.11], [-0.05, 0.03], [0.03, 0.0], [0.1, -0.02], [0.18, -0.07]];
      gc.lineWidth = 2; gc.beginPath(); st.forEach(function (p, i) { if (i) gc.lineTo(c + p[0] * k, c - p[1] * k); else gc.moveTo(c + p[0] * k, c - p[1] * k); }); gc.lineTo(c + st[0][0] * k, c - st[0][1] * k); gc.stroke();
      st.forEach(function (p, i) { gc.beginPath(); gc.arc(c + p[0] * k, c - p[1] * k, i < 2 ? 12 : 7, 0, SOL_TAU); gc.fill(); });
      gc.font = '400 22px ' + FONT_MONO; gc.fillText('THE GUARDS', c - 0.17 * k, c - 0.16 * k);
    });
    var vface = new THREE.Mesh(new THREE.CircleBufferGeometry(0.57, 128), sol_faceMat(vtex, { rough: 0.45, metal: 0.45 }, { poly: true }));
    vface.position.z = 0.0092; vol.add(vface);
    // ---- the arm, its edge through the pivot, with the two Guards set in it
    var arm = new THREE.Group(); arm.position.z = 0.052; nc.add(arm);
    var as = new THREE.Shape([new THREE.Vector2(0, -0.3), new THREE.Vector2(0.06, -0.24), new THREE.Vector2(0.075, 0), new THREE.Vector2(0.03, 1.2), new THREE.Vector2(0, 1.3)]);
    as.holes.push(hole());
    var armM = new THREE.Mesh(sol_ext(as, 0.012, 0.003), armMat); arm.add(armM);
    var boss = new THREE.Mesh(sol_ext(sol_annulus(0.07, 0.022, 32), 0.02, 0.004), armMat); boss.position.z = 0.006; arm.add(boss);
    var starM = W.glow(new THREE.MeshStandardMaterial({ color: C('#F4E2B0'), roughness: 0.3, metalness: 0.6, emissive: C('#FFE7B0'), emissiveIntensity: 0 }), 0.0, 0.9);
    var starS = new THREE.Shape(); for (i = 0; i < 10; i++) { var sa = i / 10 * SOL_TAU + Math.PI / 2, sr = i % 2 ? 0.012 : 0.03; if (i) starS.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr); else starS.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr); }
    [0.92, 1.12].forEach(function (y) { var s = new THREE.Mesh(sol_ext(starS, 0.006, 0), starM); s.position.set(0.028, y, 0.009); arm.add(s); });
    // ---- the sun hand: where the sun stands round the pole, day and night
    var sunH = new THREE.Group(); sunH.position.z = 0.075; nc.add(sunH);
    var sh = box(0.012, 0.66, 0.006, gilt); sh.position.y = 0.33 + 0.03; sunH.add(sh);
    var sunM = W.glow(new THREE.MeshStandardMaterial({ color: C('#E2B659'), roughness: 0.3, metalness: 0.9, emissive: C('#FFB84A'), emissiveIntensity: 0.3 }), 0.3, 0.0);
    var sunS = new THREE.Shape(); for (i = 0; i < 24; i++) { var ra = i / 24 * SOL_TAU, rr2 = i % 2 ? 0.038 : 0.06; if (i) sunS.lineTo(Math.cos(ra) * rr2, Math.sin(ra) * rr2); else sunS.moveTo(Math.cos(ra) * rr2, Math.sin(ra) * rr2); }
    var sun = new THREE.Mesh(sol_ext(sunS, 0.012, 0.002), sunM); sun.position.y = 0.72; sunH.add(sun);
    // the pivot: a gilt sighting tube
    var tube = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.03, 0.03, 0.22, 24, 1, true), new THREE.MeshStandardMaterial({ color: C('#D6AE5C'), roughness: 0.3, metalness: 1, side: THREE.DoubleSide }));
    tube.rotation.x = Math.PI / 2; tube.position.z = 0.04; nc.add(tube);
    var coll = new THREE.Mesh(new THREE.TorusBufferGeometry(0.034, 0.01, 8, 24), gilt); coll.position.z = 0.15; nc.add(coll);
    var coll2 = coll.clone(); coll2.position.z = -0.07; nc.add(coll2);
    // ---- the stand, behind the plate
    var Ct = new THREE.Vector3(0, 2.02, -1.0), back = Cn.clone().addScaledVector(sol_v(SOL_P), 0.03);
    if (T['Stand'] === 'Stone Pillar') {
      var sm = mtl('#B8AE9E', 'stone', 0.9, 0, 1.2);
      var pb = sol_bbox(0.62, 0.16, 0.62, sm, 0.02); pb.position.set(0, 0.08, Ct.z); g.add(pb);
      var pp = sol_bbox(0.4, 1.3, 0.4, sm, 0.02); pp.position.set(0, 0.16 + 0.65, Ct.z); g.add(pp);
      var pc = sol_bbox(0.52, 0.1, 0.52, sm, 0.02); pc.position.set(0, 1.51, Ct.z); g.add(pc);
      g.add(sol_rod(new THREE.Vector3(0, 1.56, Ct.z), Ct, 0.045, dark, 14));
    } else {
      g.add(sol_rod(new THREE.Vector3(0, 0.55, Ct.z), Ct, 0.04, dark, 14));
      for (i = 0; i < 3; i++) {
        var la = i * SOL_TAU / 3 + 0.4, ft = new THREE.Vector3(Math.sin(la) * 0.75, 0.03, Ct.z + Math.cos(la) * 0.75);
        g.add(sol_rod(ft, new THREE.Vector3(0, 0.62, Ct.z), 0.028, dark, 10));
        var shoe = cyl(0.06, 0.07, 0.04, 14, dark); shoe.position.copy(ft); g.add(shoe);
      }
      var hubS = cyl(0.07, 0.07, 0.16, 16, dark); hubS.position.set(0, 0.6, Ct.z); g.add(hubS);
    }
    g.add(sol_rod(Ct, back, 0.035, dark, 12));
    var knuckle = sph(0.06, dark, 14, 10); knuckle.position.copy(Ct); g.add(knuckle);
    var bearing = cyl(0.07, 0.07, 0.05, 20, dark); bearing.position.copy(back); bearing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sol_v(SOL_P)); g.add(bearing);
    // ---- the Plough and Polaris, placed in the sky where they really are
    var sp = [], sc = [];
    SOL_DIPPER.forEach(function (s, i) {
      var ra = s[0] * D2R, de = s[1] * D2R;
      sp.push(Math.cos(de) * Math.cos(ra) * 4150, -Math.cos(de) * Math.sin(ra) * 4150, Math.sin(de) * 4150);
      var b = i < 2 || i === 7 ? 1.9 : 1.5; sc.push(b, b * 0.97, b * 0.9);
    });
    var sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sgeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    var spts = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 4.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    spts.matrixAutoUpdate = false; spts.frustumCulled = false; spts.renderOrder = -8; W.add(spts);
    shade(g);
    [dface, vface].forEach(function (m) { m.castShadow = false; });
    var day = -1e9, psi = 0;
    return {
      group: g, R: 1.3, lookY: 2.25, dist: rf(r, 5.2, 6.2), camH: [1.5, 2.2], face: false, shadowPad: 5,
      close: { zoom: 0.55, el: 0.05, look: 0.2 },
      update: function (ctx) {
        var t = ctx.t, hd = sol_tcst(t) + (dst ? 1 : 0);           // hours on the engraved zone
        // the hour disc is set once a day, to the night whose midnight is nearest
        var ref = t.days + (hd >= 12 ? 1 : 0);
        if (ref !== day) { day = ref; psi = sol_noctSet(ref, off); }
        vol.rotation.z = psi;
        arm.rotation.z = sol_guardAngle(ctx.utc);
        sunH.rotation.z = sol_ha(ctx.utc) * D2R;
        if (W.stars) { spts.matrix.copy(W.stars.matrix); spts.material.opacity = W.stars.material.opacity; }
      }
    };
  }

  // =====================================================================
  // 6. BOW DIAL
  // A steel bow in the plane of the meridian, strung with a wire that runs
  // parallel to the earth's axis. Across the bow hangs a band set in the
  // plane of the equator; the wire's shadow walks it at fifteen degrees an
  // hour. The plinth carries the equation of time for the months.
  // =====================================================================
  function sol_bow(W, matName) {
    var r = W.r, T = W.P.clockTraits, md = MATERIALS[matName], dst = W.dst, g = new THREE.Group();
    var steel = sol_hero(matName), numer = T['Numerals'], dark = sol_iron(), motto = pick(r, SOL_MOTTOS);
    var Rb = T['Scale'] === 'Monumental' ? 2.1 : 1.55, wb = Rb * 0.16, tb = 0.03, Lw = Rb * 2.7;
    var P3 = sol_v(SOL_P), Q3 = sol_v(SOL_Q);
    // centre height: the bow's lowest point sits on the plinth
    var spineOff = Rb + tb + 0.03;
    function bowPts(Cy) {
      var A = [0, Cy - Lw / 2 * SPHI, Lw / 2 * CPHI], D = [0, Cy + Lw / 2 * SPHI, -Lw / 2 * CPHI], B = [0, Cy - spineOff * CPHI, -spineOff * SPHI];
      // circle through A, B, D in the (z, y) plane
      var ax = A[2], ay = A[1], bx = B[2], by = B[1], dx = D[2], dy = D[1];
      var dd = 2 * (ax * (by - dy) + bx * (dy - ay) + dx * (ay - by));
      var ux = ((ax * ax + ay * ay) * (by - dy) + (bx * bx + by * by) * (dy - ay) + (dx * dx + dy * dy) * (ay - by)) / dd;
      var uy = ((ax * ax + ay * ay) * (dx - bx) + (bx * bx + by * by) * (ax - dx) + (dx * dx + dy * dy) * (bx - ax)) / dd;
      var R = Math.hypot(ax - ux, ay - uy), aA = Math.atan2(ay - uy, ax - ux), aB = Math.atan2(by - uy, bx - ux), aD = Math.atan2(dy - uy, dx - ux);
      // go from A to D the way that passes B
      var norm = function (x) { while (x < aA) x += SOL_TAU; while (x >= aA + SOL_TAU) x -= SOL_TAU; return x; };
      var bB = norm(aB), bD = norm(aD), ccw = bB < bD, span = ccw ? bD - aA : -(aA + SOL_TAU - bD);
      var pts = [], low = 99, lowZ = 0;
      for (var i = 0; i <= 96; i++) { var a = aA + span * i / 96, z = ux + R * Math.cos(a), y = uy + R * Math.sin(a); pts.push([z, y]); if (y < low) { low = y; lowZ = z; } }
      return { pts: pts, low: low, lowZ: lowZ, A: A, D: D, B: B };
    }
    var plH = 0.95, Cy = 3.0, bp = bowPts(Cy);
    Cy += plH + 0.02 - bp.low; bp = bowPts(Cy);
    var C3 = new THREE.Vector3(0, Cy, 0);
    // the bow: a flat steel strip, broad face east and west
    var bw = Rb * 0.075, bt = 0.045, outer = [], inner = [];
    for (var i = 0; i < bp.pts.length; i++) {
      var p = bp.pts[i], q = bp.pts[Math.min(i + 1, bp.pts.length - 1)], o = bp.pts[Math.max(i - 1, 0)];
      var tz = q[0] - o[0], ty = q[1] - o[1], tl = Math.hypot(tz, ty), nz = ty / tl, ny = -tz / tl;
      // normal pointing away from the wire (toward the bow's outside)
      var mz = (bp.A[2] + bp.D[2]) / 2, my = (bp.A[1] + bp.D[1]) / 2;
      if ((p[0] - mz) * nz + (p[1] - my) * ny < 0) { nz = -nz; ny = -ny; }
      var taper = 0.55 + 0.45 * Math.sin(i / (bp.pts.length - 1) * Math.PI);
      outer.push(new THREE.Vector2(-(p[0] + nz * bt * taper), p[1] + ny * bt * taper));
      inner.push(new THREE.Vector2(-(p[0] - nz * bt * taper * 0.2), p[1] - ny * bt * taper * 0.2));
    }
    var bs = new THREE.Shape(outer.concat(inner.reverse()));
    var bow = new THREE.Mesh(sol_ext(bs, bw, 0.008, 4), steel); bow.rotation.y = Math.PI / 2; g.add(bow);
    // the wire, and a turnbuckle at each nock
    var A3 = new THREE.Vector3(0, bp.A[1], bp.A[2]), D3 = new THREE.Vector3(0, bp.D[1], bp.D[2]);
    var wireM = std('#DADDE0', 0.25, 1);
    g.add(sol_rod(A3, D3, 0.009, wireM, 6));
    [A3, D3].forEach(function (e, j) {
      var nock = sph(bw * 0.45, steel, 14, 10); nock.position.copy(e); g.add(nock);
      var tbk = cyl(0.018, 0.018, 0.16, 10, dark); tbk.position.copy(e).addScaledVector(P3, j ? -0.14 : 0.14); tbk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), P3); g.add(tbk);
    });
    // the band in the plane of the equator, hung from the bow at noon
    var eq = sol_eqGroup(); eq.position.copy(C3); g.add(eq);
    var hLo = -108, hHi = 108, bandS = new THREE.Shape(), aLo = (90 - hHi) * D2R, aHi = (90 - hLo) * D2R;
    // shape angle measured from +x; point (sin h, cos h) sits at angle 90 - h
    bandS.absarc(0, 0, Rb + tb, aLo, aHi, false); bandS.absarc(0, 0, Rb, aHi, aLo, true);
    var bandG = sol_ext(bandS, wb, 0.006, 96); bandG.rotateX(-Math.PI / 2);
    // shape (X, Y) goes to eq (x, -Y) after that turn, so (sin h, cos h) lands on the shadow side
    var band = new THREE.Mesh(bandG, steel); eq.add(band);
    // the hour scale on the band's inner face (eq frame: cylinder about y)
    var th0 = Math.PI - hHi * D2R, thL = (hHi - hLo) * D2R, pxPerRad = 900;
    var tw = Math.round(thL * pxPerRad), th = 256;
    var htex = canvasTex(tw, th, function (gc) {
      // an enamelled strip, so the wire's thin shadow reads on any metal
      gc.fillStyle = '#ECE5D3'; gc.fillRect(0, 0, tw, th); sol_speck(gc, tw, th, seedRng(W.P.seed + 82), 2500, 0.04);
      var col = '#1A1714';
      gc.fillStyle = col; gc.strokeStyle = col; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      // u runs with theta; theta = pi - h, so u = (hHi - h) / (hHi - hLo); seen from inside, mirror
      var U = function (h) { return (1 - (hHi - h) / (hHi - hLo)) * tw; };
      for (var q = 6 * 12; q <= 20 * 12; q++) {
        var H = q / 12, h = haForClock(H);
        if (h < hLo + 2 || h > hHi - 2) continue;
        var full = q % 12 === 0, half = q % 6 === 0, x = U(h), L = full ? 0.56 : half ? 0.34 : 0.16;
        gc.lineWidth = full ? 7 : half ? 4 : 2;
        gc.beginPath(); gc.moveTo(x, th * 0.04); gc.lineTo(x, th * (0.04 + L * 0.5)); gc.stroke();
        gc.beginPath(); gc.moveTo(x, th * 0.96); gc.lineTo(x, th * (0.96 - L * 0.5)); gc.stroke();
        if (full && numer !== 'Ticks Only') {
          gc.font = '700 ' + (numer === 'Roman' ? 58 : 70) + 'px ' + FONT_SERIF;
          gc.fillText(sol_hourLabel(H, dst, numer === 'Roman'), x, th * 0.5);
        }
      }
    });
    var hsg = new THREE.CylinderBufferGeometry(Rb - 0.002, Rb - 0.002, wb - 0.02, 96, 1, true, th0, thL), huv = hsg.attributes.uv;
    for (var ui = 0; ui < huv.count; ui++) huv.setX(ui, 1 - huv.getX(ui));   // seen from inside, so read it the right way round
    var hscale = new THREE.Mesh(hsg,
      new THREE.MeshStandardMaterial({ map: htex, side: THREE.BackSide, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2 }));
    eq.add(hscale);
    // the wire's shadow, traced from the sun: a dark line on the inner face
    // umbra of the cable plus the penumbra of the sun's half degree at this radius
    var shM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    var wS = 0.02 / Rb, wP = (0.02 + 2 * Rb * 0.0047) / Rb, shL = new THREE.Mesh(new THREE.CylinderBufferGeometry(Rb - 0.004, Rb - 0.004, wb - 0.004, 2, 1, true, -wS / 2, wS), shM);
    shL.add(new THREE.Mesh(new THREE.CylinderBufferGeometry(Rb - 0.0035, Rb - 0.0035, wb - 0.004, 3, 1, true, -wP / 2, wP), shM));
    shL.visible = false; eq.add(shL);
    // the clamp that hangs the band from the bow
    var clampP = C3.clone().addScaledVector(Q3, -(Rb + tb + 0.02));
    var clampB = sol_bbox(bw * 1.4, 0.07, wb * 0.9, dark, 0.01); clampB.position.copy(clampP);
    clampB.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), Q3, P3)); g.add(clampB);
    // ---- plinth, with the equation of time cut into its south face
    var pm = T['Plinth'] === 'Rammed Earth' ? mtl('#B9865C', 'concrete', 0.95, 0, 0.9) : T['Plinth'] === 'Steel Foot' ? dark : mtl('#C9C0AE', 'stone', 0.9, 0, 1.3);
    var pw = 1.3, pd = 1.0, pz = bp.lowZ;
    var eotRows = [];
    for (var mo = 1; mo <= 12; mo++) eotRows.push([MONTHS[mo - 1], sol_eot(daysFromCivil(2027, mo, 1) * 86400 + 18 * 3600), sol_eot(daysFromCivil(2027, mo, 15) * 86400 + 18 * 3600)]);
    var faceHex = T['Plinth'] === 'Steel Foot' ? '#2B2C2E' : T['Plinth'] === 'Rammed Earth' ? '#B9865C' : '#C9C0AE';
    var ptex = canvasTex(1040, 760, function (gc, Wc, Hc) {
      gc.fillStyle = faceHex; gc.fillRect(0, 0, Wc, Hc); sol_speck(gc, Wc, Hc, seedRng(W.P.seed + 81), 3000, 0.06);
      if (T['Plinth'] === 'Rammed Earth') for (var s = 0; s < 9; s++) { gc.fillStyle = 'rgba(' + (s % 2 ? '255,240,220,0.08' : '60,30,10,0.09') + ')'; gc.fillRect(0, s * Hc / 9, Wc, Hc / 9); }
      var dk = T['Plinth'] === 'Steel Foot' ? '#D8D2C4' : sol_mix(faceHex, '#000000', 0.62), lt = T['Plinth'] === 'Steel Foot' ? '#111' : sol_mix(faceHex, '#FFFFFF', 0.3);
      gc.textAlign = 'center'; gc.textBaseline = 'middle';
      gc.font = '700 56px ' + FONT_SERIF; sol_cut(gc, motto, Wc / 2, 70, dk, lt, 2);
      gc.font = '400 26px ' + FONT_MONO; sol_cut(gc, 'SUN TIME TO CLOCK TIME   ADD WHEN SLOW, TAKE AWAY WHEN FAST', Wc / 2, 128, dk, lt, 1.5);
      gc.font = '700 30px ' + FONT_MONO;
      eotRows.forEach(function (row, i) {
        var col = i < 6 ? 0 : 1, rI = i % 6, x = col ? Wc * 0.74 : Wc * 0.26, y = 200 + rI * 72;
        var f1 = function (v) { var m = Math.round(-v); return (m > 0 ? '+' : m < 0 ? '-' : ' ') + Math.abs(m); };
        sol_cut(gc, row[0] + '  1 ' + f1(row[1]) + '   15 ' + f1(row[2]), x, y, dk, lt, 1.5);
      });
      gc.font = '400 24px ' + FONT_MONO; sol_cut(gc, 'MARFA 30.31 N   MINUTES   ' + (dst ? 'CDT' : 'CST'), Wc / 2, Hc - 44, dk, lt, 1.5);
    });
    var pmats = [pm, pm, pm, pm, new THREE.MeshStandardMaterial({ map: ptex, roughness: T['Plinth'] === 'Steel Foot' ? 0.5 : 0.9, metalness: T['Plinth'] === 'Steel Foot' ? 0.6 : 0 }), pm];
    var plinth = new THREE.Mesh(new THREE.BoxBufferGeometry(pw, plH, pd), pmats); plinth.position.set(0, plH / 2, pz); g.add(plinth);
    var cap = sol_bbox(pw + 0.08, 0.05, pd + 0.08, T['Plinth'] === 'Steel Foot' ? dark : pm, 0.012); cap.position.set(0, plH + 0.0, pz); g.add(cap);
    var shoe = sol_bbox(bw * 2.2, 0.1, 0.5, dark, 0.01); shoe.position.set(0, plH + 0.06, pz); g.add(shoe);
    shade(g);
    hscale.castShadow = false; shL.traverse(function (m) { m.castShadow = false; m.receiveShadow = false; });
    var top = Math.max(bp.D[1], Cy + Rb * 0.3) + 0.1;
    return {
      group: g, R: Math.max(Rb + 0.4, Lw / 2 * CPHI + 0.3), lookY: Cy * 0.72, dist: rf(r, 1.0, 1.15) * (5.2 + Rb * 2.2), camH: [1.8, 2.8 + Rb * 0.4], face: false, shadowPad: 5,
      close: { zoom: 0.5, el: 0.15, look: Cy * 0.2 },
      update: function (ctx) {
        var h = sol_ha(ctx.utc), up = sstep(0, 3, ctx.sun.el);
        shL.visible = up > 0 && h > hLo + 3 && h < hHi - 3;
        if (shL.visible) { shL.rotation.y = (180 - h) * D2R; shM.opacity = 0.5 * up; }
      },
      top: top
    };
  }

  defineClock('Heliochronometer', { w: 8, keeps: 'Sunlight', solar: true, height: 2.3, build: sol_helio,
    mats: ['Brass', 'Patinated Copper', 'Mill Aluminum', 'Ink Black', 'Weathering Steel'],
    line: 'A sighting arm on a polar axle. When the bar of sunlight sits on the index, the pointer reads clock time, the equation of time already taken out by a cam, and the gap in the bar reads the date.',
    traits: function (r) { return { 'Pedestal': pick(r, ['Fluted Column', 'Square Pier', 'Iron Tripod']), 'Numerals': pick(r, ['Roman', 'Arabic']), 'Motto': pick(r, SOL_MOTTOS) }; } });
  defineClock('Noon Cannon', { w: 8, keeps: 'Burning Glass', solar: true, height: 1.9, build: sol_cannon,
    mats: ['Travertine', 'Desert Sandstone', 'Caliche Stone', 'Concrete', 'Obsidian', 'Terrazzo'],
    line: 'A burning glass set to the noon sun lights the touch hole at local apparent noon, which in Marfa falls between 13:39 and 14:11 by the clock. The small dial keeps the rest of the day.',
    traits: function (r) { return { 'Carriage': pick(r, ['Timber Truck', 'Stone Saddles', 'Iron Cradle']), 'Barrel': pickW(r, [['Bronze', 50], ['Blackened Iron', 30], ['Verdigris', 20]]), 'Motto': pick(r, ['I SPEAK ONCE A DAY', 'NOON HERE IS NOT NOON THERE', 'LET THE SUN LIGHT IT', 'MIDI', 'SOLE ACCENSUS']) }; } });
  defineClock('Meridian Obelisk', { w: 9, keeps: 'Shadow', solar: true, height: 11.2, build: sol_obelisk,
    mats: ['Desert Sandstone', 'Travertine', 'Obsidian', 'Concrete', 'Weathering Steel', 'Bone White'],
    line: 'The tip of the obelisk is the nodus. Its shadow crosses hour marks and the curves it draws on the solstices and the equinox, so one point of shade reads the hour and the date.',
    traits: function (r) { return { 'Height': pickW(r, [['7 m', 30], ['9 m', 45], ['11 m', 25]]), 'Hour Marks': pickW(r, [['Lines', 60], ['Figure Eights', 40]]), 'Pyramidion': pickW(r, [['Gilt', 50], ['Bronze', 30], ['Mirror Steel', 20]]) }; } });
  defineClock('Wall Dial', { w: 9, keeps: 'Shadow', solar: true, height: 4.1, build: sol_wall,
    mats: ['Caliche Stone', 'Bone White', 'Desert Sandstone', 'Cherokee Red', 'Blossom Blue'],
    line: 'A sundial painted on an adobe wall that faces a little off south. The hour lines are drawn for that facing at latitude 30.3, and the style points at the celestial pole.',
    traits: function (r) { return { 'Facing': pickW(r, [['Due South', 20], ['15° East', 15], ['30° East', 10], ['12° West', 20], ['24° West', 20], ['36° West', 15]]), 'Style': pick(r, ['Iron Rod', 'Bronze Plate', 'Scrolled Iron']), 'Motto': pick(r, SOL_MOTTOS) }; } });
  defineClock('Nocturnal', { w: 8, keeps: 'Stars', solar: true, height: 3.7, build: sol_nocturnal,
    mats: ['Brass', 'Patinated Copper', 'Mill Aluminum', 'Weathering Steel', 'Ink Black'],
    line: 'A star clock. Sight Polaris through the pivot, lay the arm along the Guards of the Plough, and read the hour where it crosses the disc set to tonight. By day the Guards are still there behind the blue, and the little sun shows where the real one stands.',
    traits: function (r) { return { 'Stand': pick(r, ['Tripod', 'Stone Pillar']), 'Rim': pick(r, ['Toothed', 'Plain']), 'Numerals': pick(r, ['Roman', 'Arabic']) }; } });
  defineClock('Bow Dial', { w: 9, keeps: 'Shadow', solar: true, height: 4.9, build: sol_bow,
    mats: ['Weathering Steel', 'Ink Black', 'Mill Aluminum', 'Brass', 'Blossom Blue', 'Patinated Copper'],
    line: 'A steel bow strung with a wire parallel to the earth’s axis. The wire’s shadow walks a band set in the plane of the equator at fifteen degrees an hour; the plinth gives the equation of time.',
    traits: function (r) { return { 'Scale': pickW(r, [['Large', 65], ['Monumental', 35]]), 'Numerals': pick(r, ['Roman', 'Arabic', 'Ticks Only']), 'Plinth': pick(r, ['Cut Stone', 'Rammed Earth', 'Steel Foot']) }; } });
