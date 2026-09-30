  // =====================================================================
  // MACHINES OF THE HIGH DESERT: a Foucault pendulum, a candle clock, a
  // railway platform clock, a football scoreboard, a pumpjack and a farm
  // windmill. Every top-level name in this file starts with mch_ so it can
  // share the one scope with the other files. It borrows the plate, rod and
  // hand helpers from 36-clocks-mechanical.js (mech_*).
  // =====================================================================
  var mch_TAU = Math.PI * 2;
  // vectors made on first use: the plan runs in node, where there is no THREE
  var mch_UP = null, mch_tmpD = null, mch_NO_WIND = null;
  function mch_init() { if (!mch_UP) { mch_UP = new THREE.Vector3(0, 1, 0); mch_tmpD = new THREE.Vector3(); mch_NO_WIND = new THREE.Vector3(1, 0, 0); } }
  // cycles of a periodic motion. Live, it runs off the real clock so every
  // viewer sees the same stroke; in a time-lapse it runs off real seconds.
  function mch_cyc(ctx, period) { return (ctx.fast ? ctx.real : ctx.utc) / period; }
  function mch_ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function mch_back(t) { t = clamp(t, 0, 1); var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function mch_v(x, y, z) { return new THREE.Vector3(x, y, z); }
  function mch_v2(x, y) { return new THREE.Vector2(x, y); }
  function mch_shape(pts) { return new THREE.Shape(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); })); }
  // unit profiles along +y, 0 to 1, that mch_span stretches between two points
  function mch_tubeGeo(rad, seg) { var geo = new THREE.CylinderBufferGeometry(rad, rad, 1, seg || 8, 1); geo.translate(0, 0.5, 0); return geo; }
  function mch_boxGeo(w, d) { var geo = new THREE.BoxBufferGeometry(w, 1, d || w); geo.translate(0, 0.5, 0); return geo; }
  function mch_angleGeo(w, t) {
    var geo = new THREE.ExtrudeBufferGeometry(mch_shape([[0, 0], [w, 0], [w, t], [t, t], [t, w], [0, w]]), { depth: 1, bevelEnabled: false });
    geo.translate(-w * 0.3, -w * 0.3, 0); geo.rotateX(-Math.PI / 2);
    return geo;
  }
  function mch_span(geo, a, b, mat, roll) {
    mch_init();
    var d = new THREE.Vector3().subVectors(b, a), L = d.length(), m = new THREE.Mesh(geo, mat);
    m.position.copy(a); m.quaternion.setFromUnitVectors(mch_UP, d.multiplyScalar(1 / L));
    if (roll) m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(mch_UP, roll));
    m.scale.set(1, L, 1);
    return m;
  }
  // re-aim a unit-profile mesh at two new points, every frame, with no allocation
  function mch_aim(m, a, b) {
    mch_init();
    mch_tmpD.subVectors(b, a); var L = mch_tmpD.length();
    m.position.copy(a); m.quaternion.setFromUnitVectors(mch_UP, mch_tmpD.multiplyScalar(1 / L)); m.scale.y = L;
  }
  // an I-beam along x, centred
  function mch_ibeam(len, h, w, tw, tf, mat) {
    var s = mch_shape([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, -h / 2 + tf], [tw / 2, -h / 2 + tf], [tw / 2, h / 2 - tf], [w / 2, h / 2 - tf], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, h / 2 - tf], [-tw / 2, h / 2 - tf], [-tw / 2, -h / 2 + tf], [-w / 2, -h / 2 + tf]]);
    var geo = new THREE.ExtrudeBufferGeometry(s, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2); geo.rotateY(Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  }
  function mch_nut(rad, h, mat) { return cyl(rad, rad, h, 6, mat); }
  // a ring of hex nuts facing +z on a plate
  function mch_boltCircle(parent, n, rad, z, nutR, mat, a0) {
    for (var i = 0; i < n; i++) {
      var a = (a0 || 0) + i / n * mch_TAU, b = mch_nut(nutR, nutR * 0.9, mat);
      b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * rad, Math.sin(a) * rad, z); parent.add(b);
    }
  }
  // text that sits on a surface without z-fighting
  function mch_text(lines, o) {
    var p = textPlane(lines, o);
    p.material.polygonOffset = true; p.material.polygonOffsetFactor = -2; p.material.polygonOffsetUnits = -2;
    return p;
  }
  // the token's wind, turned into the clock group's own frame
  function mch_localWind(ctx, grp, out) {
    mch_init();
    var w = ctx.windDir || mch_NO_WIND, a = -grp.rotation.y, c = Math.cos(a), s = Math.sin(a);
    out.x = w.x * c + w.z * s; out.z = -w.x * s + w.z * c;
    return out;
  }

  // =====================================================================
  // 1. FOUCAULT PENDULUM
  // A bob on a long wire swings in a fixed plane while the ground turns
  // under it. At latitude 30.31 N the plane turns clockwise at 15 degrees
  // per sidereal hour times sin(30.31), which is 7.59 degrees per solar
  // hour. The pendulum is restarted in the north-south plane at midnight,
  // so the plane's angle is a clock: both ends of the swing point at the
  // hour on a scale engraved round the dial, and they knock down the pegs
  // in their path as they go. The pegs are stood up again at midnight.
  // =====================================================================
  var mch_OMEGA = 360 / 86164.0905 * Math.sin(LAT * D2R);     // degrees of turn per second
  function mch_foucault(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var frameK = Tt['Frame'] || 'Tripod', bobK = Tt['Bob'] || 'Brass', pegK = Tt['Pegs'] || 'Brass Pins';
    var steel = heroMat(matName), darkM = std('#1B1C1F', 0.5, 0.6);
    var concM = mtl('#ADA699', 'concrete', 0.95, 0, 1.6), bronze = mtl('#8C6A3A', 'brushed', 0.42, 0.9, 0.4);
    var HP = 10.4, YD = 0.52, BR = 0.2, SPIKE = 0.13, AMP = 1.18, RD = 1.9, RP = 1.235;
    var bobY = YD + 0.035 + SPIKE + BR, L = HP - bobY, T = mch_TAU * Math.sqrt(L / 9.81), TH = Math.asin(AMP / L);
    var i, k, a;

    // ---- the plinth and the dial
    var step = cyl(RD + 0.34, RD + 0.4, 0.16, 72, concM); step.position.y = 0.08; g.add(step);
    var drum = cyl(RD, RD + 0.02, YD - 0.16, 72, concM); drum.position.y = 0.16 + (YD - 0.16) / 2; g.add(drum);
    var rim = new THREE.Mesh(new THREE.TorusBufferGeometry(RD, 0.028, 8, 120), bronze); rim.rotation.x = Math.PI / 2; rim.position.y = YD; g.add(rim);
    var wg = new THREE.Group(); g.add(wg);                       // turned back to true north each frame
    var dialTex = canvasTex(2048, 2048, function (gc, S) {
      var c = S / 2, kk = c / RD, h, lab;
      gc.fillStyle = '#D5CCB9'; gc.fillRect(0, 0, S, S);
      var rr = seedRng(W.P.seed + 31);
      for (i = 0; i < 2600; i++) { var v = 180 + rr() * 50 | 0; gc.fillStyle = 'rgba(' + v + ',' + (v - 8) + ',' + (v - 22) + ',0.35)'; gc.fillRect(rr() * S, rr() * S, 2 + rr() * 5, 2 + rr() * 5); }
      var ring = function (rad, w, col) { gc.strokeStyle = col; gc.lineWidth = w; gc.beginPath(); gc.arc(c, c, rad * kk, 0, mch_TAU); gc.stroke(); };
      // the peg groove and the hour band
      ring(RP, 30, 'rgba(58,50,40,0.28)'); ring(RP, 3, '#4A3F31');
      ring(1.42, 5, '#3A3128'); ring(1.8, 7, '#3A3128'); ring(1.83, 2, '#3A3128');
      gc.textAlign = 'center'; gc.textBaseline = 'middle';
      // both ends of the swing read the same scale: hour h lies at h x 7.59 degrees east of north, and again 180 on
      for (var end = 0; end < 2; end++) {
        for (var mnt = 0; mnt < 24 * 6; mnt++) {
          a = (mnt * 600 * mch_OMEGA + end * 180) * D2R; h = mnt / 6;
          if (mnt % 6 !== 0) {
            gc.save(); gc.translate(c, c); gc.rotate(a); gc.fillStyle = '#3A3128';
            gc.fillRect(-1.5, -1.8 * kk, 3, (mnt % 3 === 0 ? 0.1 : 0.06) * kk); gc.restore();
            continue;
          }
          gc.save(); gc.translate(c, c); gc.rotate(a); gc.fillStyle = '#3A3128';
          gc.fillRect(-4, -1.8 * kk, 8, 0.14 * kk);
          lab = String(h);
          gc.translate(0, -1.56 * kk); gc.rotate(Math.PI);
          gc.fillStyle = h % 6 === 0 ? '#6B3E1E' : '#2E2720';
          gc.font = (h % 6 === 0 ? '700 78px ' : '600 54px ') + FONT_SERIF; gc.fillText(lab, 0, 0);
          gc.restore();
        }
      }
      // a compass rose, and what the floor is doing
      gc.fillStyle = '#3A3128'; gc.strokeStyle = '#3A3128';
      for (i = 0; i < 16; i++) {
        var len = i % 4 === 0 ? 0.62 : i % 2 === 0 ? 0.38 : 0.22, w2 = i % 4 === 0 ? 0.07 : 0.045;
        gc.save(); gc.translate(c, c); gc.rotate(i / 16 * mch_TAU);
        gc.beginPath(); gc.moveTo(0, -len * kk); gc.lineTo(w2 * kk, 0); gc.lineTo(0, w2 * 0.6 * kk); gc.lineTo(-w2 * kk, 0); gc.closePath();
        gc.fillStyle = i === 0 ? '#6B3E1E' : (i % 2 ? '#8A7D69' : '#3A3128'); gc.fill(); gc.restore();
      }
      ring(0.7, 3, '#3A3128'); ring(0.18, 3, '#3A3128');
      gc.font = '700 64px ' + FONT_SERIF; gc.fillStyle = '#3A3128';
      ['N', 'E', 'S', 'W'].forEach(function (q, j) { var aa = j * Math.PI / 2; gc.fillText(q, c + Math.sin(aa) * 0.84 * kk, c - Math.cos(aa) * 0.84 * kk); });
      gc.font = '600 34px ' + FONT_SERIF;
      var arcText = function (txt, rad, mid, flip) {
        var n = txt.length, span = n * 0.036;
        for (var q = 0; q < n; q++) {
          var aa = mid + (flip ? -1 : 1) * (q - (n - 1) / 2) * 0.036;
          gc.save(); gc.translate(c + Math.sin(aa) * rad * kk, c - Math.cos(aa) * rad * kk); gc.rotate(aa + (flip ? Math.PI : 0)); gc.fillText(txt[q], 0, 0); gc.restore();
        }
        return span;
      };
      arcText('LATITUDE 30.31 N  THE GROUND TURNS 7.59 DEGREES AN HOUR', 1.05, Math.PI * 0.5, false);
      arcText('SET SWINGING NORTH AND SOUTH AT MIDNIGHT', 1.05, Math.PI * 1.5, true);
    });
    var dialM = new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.62, metalness: 0.05 });
    var dial = new THREE.Mesh(new THREE.CircleBufferGeometry(RD - 0.01, 120), dialM); dial.rotation.x = -Math.PI / 2; dial.position.y = YD + 0.003; wg.add(dial);
    // a bronze plaque on the plinth
    var plq = mech_bbox(1.0, 0.26, 0.05, bronze, 0.01); plq.position.set(0, 0.34, RD - 0.005); g.add(plq);
    var plt = mch_text(['FOUCAULT PENDULUM', 'MARFA  30.31 N'], { color: '#E7D6A8', font: FONT_SERIF, height: 0.2, px: 48, spacing: 0.1, pad: 0.1 });
    plt.position.set(0, 0.34, RD + 0.022); g.add(plt);

    // ---- the pegs, in a ring the tip of the bob just reaches
    var NPEG = 95, pegGeo, pegM;
    if (pegK === 'Dominoes') {
      pegGeo = new THREE.BoxBufferGeometry(0.075, 0.17, 0.024); pegGeo.translate(0, 0.085, 0);
      var domTex = canvasTex(64, 128, function (gc) {
        gc.fillStyle = '#17181B'; gc.fillRect(0, 0, 64, 128); gc.fillStyle = '#EDE8DF'; gc.fillRect(6, 62, 52, 4);
        var rr2 = seedRng(W.P.seed + 9);
        [[0, 32], [1, 96]].forEach(function (hf) { var n = 1 + Math.floor(rr2() * 5), P6 = [[32, 0], [16, -14], [48, 14], [16, 14], [48, -14], [16, 0], [48, 0]]; for (var q = 0; q < n; q++) { gc.beginPath(); gc.arc(P6[q][0], hf[1] + P6[q][1], 5, 0, mch_TAU); gc.fill(); } });
      });
      pegM = new THREE.MeshStandardMaterial({ map: domTex, roughness: 0.35, metalness: 0 });
    }
    else if (pegK === 'Blossom Pins') { var pc = new THREE.CylinderBufferGeometry(0.018, 0.022, 0.15, 10); pc.translate(0, 0.075, 0); var ph = new THREE.SphereBufferGeometry(0.03, 10, 8); ph.translate(0, 0.16, 0); pegGeo = mergeGeos([pc, ph]); pegM = std(BRAND.blue, 0.35, 0.3); }
    else { var bc = new THREE.CylinderBufferGeometry(0.014, 0.018, 0.15, 10); bc.translate(0, 0.075, 0); var bh = new THREE.SphereBufferGeometry(0.024, 10, 8); bh.translate(0, 0.16, 0); pegGeo = mergeGeos([bc, bh]); pegM = mtl('#C9A15A', 'brushed', 0.28, 1, 0.3); }
    var pegs = new THREE.InstancedMesh(pegGeo, pegM, NPEG); wg.add(pegs);
    var pegA = [], pegJit = [], pegDown = [], pegT = [], dummy = new THREE.Object3D();
    for (i = 0; i < NPEG; i++) { pegA.push((i + 0.5) / NPEG * mch_TAU); pegJit.push(rf(r, -0.25, 0.25)); pegDown.push(false); pegT.push(-99); }
    var writePeg = function (j, f) {
      var aa = pegA[j];
      dummy.position.set(Math.sin(aa) * RP, YD, -Math.cos(aa) * RP);
      dummy.rotation.set(f * 1.5, Math.atan2(Math.sin(aa), -Math.cos(aa)) + f * pegJit[j], 0, 'YXZ');
      if (f > 0.98) dummy.position.y = YD + (pegK === 'Dominoes' ? 0.012 : 0.02) - 0.01;
      dummy.updateMatrix(); pegs.setMatrixAt(j, dummy.matrix);
    };
    for (i = 0; i < NPEG; i++) writePeg(i, 0);

    // ---- the pendulum: yaw sets the plane, swing moves the bob along it
    var yg = new THREE.Group(); yg.position.y = HP; wg.add(yg);
    var sg = new THREE.Group(); yg.add(sg);
    var wireM = std('#2A2B2E', 0.35, 0.9), wire = cyl(0.009, 0.009, L - BR, 6, wireM); wire.position.y = -(L - BR) / 2; sg.add(wire);
    var bobM = bobK === 'Chrome' ? std('#DCE1E6', 0.1, 1) : bobK === 'Blossom Blue' ? std(BRAND.blue, 0.28, 0.35) : mtl('#C79E55', 'brushed', 0.22, 1, 0.3);
    var tipM = bobK === 'Blossom Blue' ? mtl('#C9A15A', 'brushed', 0.25, 1, 0.3) : darkM;
    var bob = new THREE.Group(); bob.position.y = -L; sg.add(bob);
    var bprof = [[0.001, BR * 1.02], [0.02, BR * 1.02], [0.03, BR * 0.98], [BR * 0.55, BR * 0.82], [BR * 0.86, BR * 0.5], [BR, 0.02], [BR * 0.95, -BR * 0.3], [BR * 0.7, -BR * 0.72], [BR * 0.3, -BR * 0.96], [0.001, -BR]];
    bob.add(new THREE.Mesh(new THREE.LatheBufferGeometry(bprof.map(function (q) { return mch_v2(q[0], q[1]); }), 40), bobM));
    var band = new THREE.Mesh(new THREE.TorusBufferGeometry(BR * 1.0, 0.012, 6, 48), tipM); band.rotation.x = Math.PI / 2; band.position.y = 0.02; bob.add(band);
    var spike = new THREE.Mesh(new THREE.ConeBufferGeometry(0.022, SPIKE + 0.02, 10), tipM); spike.rotation.x = Math.PI; spike.position.y = -BR - SPIKE / 2 + 0.01; bob.add(spike);
    var clampB = cyl(0.03, 0.022, 0.08, 10, tipM); clampB.position.y = BR * 1.02 + 0.03; bob.add(clampB);

    // ---- the frame
    var feet = [];
    if (frameK === 'Tripod') {
      var tubeG = mch_tubeGeo(0.07, 10), RF = 3.8;
      [Math.PI / 3, Math.PI, -Math.PI / 3].forEach(function (la) {
        var dir = mch_v(Math.sin(la), 0, Math.cos(la)), tan = mch_v(Math.cos(la), 0, -Math.sin(la));
        var foot = dir.clone().multiplyScalar(RF).setY(0.46), top = dir.clone().multiplyScalar(0.24).setY(HP + 0.12);
        var tubes = [-1, 1].map(function (sd) {
          var a0 = foot.clone().addScaledVector(tan, sd * 0.24), a1 = top.clone().addScaledVector(tan, sd * 0.1);
          g.add(mch_span(tubeG, a0, a1, steel)); return [a0, a1];
        });
        var N = 20;
        for (k = 0; k < N; k++) {
          var p0 = tubes[k % 2][0].clone().lerp(tubes[k % 2][1], k / N), p1 = tubes[(k + 1) % 2][0].clone().lerp(tubes[(k + 1) % 2][1], (k + 1) / N);
          g.add(mech_rod(p0, p1, 0.022, steel, 6));
        }
        for (k = 1; k < N; k += 4) { var q0 = tubes[0][0].clone().lerp(tubes[0][1], k / N), q1 = tubes[1][0].clone().lerp(tubes[1][1], k / N); g.add(mech_rod(q0, q1, 0.03, steel, 6)); }
        feet.push(foot);
      });
      // a tie ring of three rods with turnbuckles, a third of the way up
      var yTie = 3.4, fT = (yTie - 0.46) / (HP + 0.12 - 0.46);
      var tiePts = feet.map(function (f) { return f.clone().lerp(mch_v(f.x * 0.24 / RF, HP + 0.12, f.z * 0.24 / RF), fT); });
      for (i = 0; i < 3; i++) {
        var ta = tiePts[i], tb = tiePts[(i + 1) % 3];
        g.add(mech_rod(ta, tb, 0.018, darkM, 6));
        var tb2 = mech_rod(ta.clone().lerp(tb, 0.44), ta.clone().lerp(tb, 0.56), 0.04, darkM, 8); g.add(tb2);
        var clip = cyl(0.11, 0.11, 0.16, 12, steel); clip.position.copy(ta); g.add(clip);
      }
      // the crown the legs meet in, and the chuck the wire hangs from
      var crown = cyl(0.36, 0.4, 0.55, 24, steel); crown.position.y = HP + 0.3; g.add(crown);
      var cap = cyl(0.46, 0.46, 0.06, 24, steel); cap.position.y = HP + 0.6; g.add(cap);
      var eye = new THREE.Mesh(new THREE.TorusBufferGeometry(0.12, 0.03, 8, 20), darkM); eye.position.y = HP + 0.76; g.add(eye);
      for (i = 0; i < 8; i++) { a = i / 8 * mch_TAU; var nt = mch_nut(0.03, 0.03, darkM); nt.position.set(Math.cos(a) * 0.4, HP + 0.645, Math.sin(a) * 0.4); g.add(nt); }
    } else {
      // two A-frames and a beam across them
      var BX = 3.3, sqG = mch_boxGeo(0.2), ib = mch_ibeam(7.6, 0.4, 0.22, 0.03, 0.035, steel); ib.position.y = HP + 0.36; g.add(ib);
      [-1, 1].forEach(function (sd) {
        var top = mch_v(sd * BX, HP + 0.16, 0), fa = mch_v(sd * BX, 0.46, 2.5), fb = mch_v(sd * BX, 0.46, -2.5);
        g.add(mch_span(sqG, fa, top, steel)); g.add(mch_span(sqG, fb, top, steel));
        var y1 = 3.6, f1 = (y1 - 0.46) / (HP + 0.16 - 0.46);
        var sa = fa.clone().lerp(top, f1), sb = fb.clone().lerp(top, f1);
        g.add(mech_rod(sa, sb, 0.06, steel, 8));
        var y2 = 7.0, f2 = (y2 - 0.46) / (HP + 0.16 - 0.46), sa2 = fa.clone().lerp(top, f2), sb2 = fb.clone().lerp(top, f2);
        g.add(mech_rod(sa2, sb2, 0.05, steel, 8));
        g.add(mech_rod(sa, sb2, 0.018, darkM, 6)); g.add(mech_rod(sb, sa2, 0.018, darkM, 6));
        // knee braces to the beam
        g.add(mech_rod(mch_v(sd * BX, HP - 1.3, 0), mch_v(sd * (BX - 1.4), HP + 0.16, 0), 0.05, steel, 8));
        var gus = mech_bbox(0.5, 0.5, 0.03, steel, 0.008); gus.position.set(sd * BX, HP, 0.13); g.add(gus);
        var gus2 = gus.clone(); gus2.position.z = -0.13; g.add(gus2);
        feet.push(fa, fb);
      });
      var blk = mech_bbox(0.34, 0.2, 0.3, darkM, 0.02); blk.position.y = HP + 0.06; g.add(blk);
    }
    feet.forEach(function (f) {
      var pad = cyl(0.55, 0.62, 0.46, 16, concM); pad.position.set(f.x, 0.23, f.z); g.add(pad);
      var bp = mech_bbox(0.62, 0.04, 0.62, steel, 0.008); bp.position.set(f.x, 0.48, f.z); bp.rotation.y = Math.atan2(f.x, f.z); g.add(bp);
      for (var q = 0; q < 4; q++) { var qa = Math.atan2(f.x, f.z) + Math.PI / 4 + q * Math.PI / 2, nt2 = mch_nut(0.035, 0.04, darkM); nt2.position.set(f.x + Math.sin(qa) * 0.36, 0.52, f.z + Math.cos(qa) * 0.36); g.add(nt2); }
    });
    // the chuck and the Charron ring that stops the swing going elliptical
    var chuck = cyl(0.05, 0.08, 0.2, 12, darkM); chuck.position.y = HP + 0.04; g.add(chuck);
    var charron = new THREE.Mesh(new THREE.TorusBufferGeometry(0.075, 0.014, 8, 28), bronze); charron.rotation.x = Math.PI / 2; charron.position.y = HP - 0.32; g.add(charron);
    for (i = 0; i < 3; i++) { a = i / 3 * mch_TAU; g.add(mech_rod(mch_v(Math.cos(a) * 0.075, HP - 0.32, Math.sin(a) * 0.075), mch_v(Math.cos(a) * 0.2, HP + 0.04, Math.sin(a) * 0.2), 0.01, darkM, 5)); }
    // a lamp under the crown for the dial at night
    var shadeG = new THREE.Group(); shadeG.position.set(0.42, HP - 0.1, 0.1); g.add(shadeG);
    var lampShade = new THREE.Mesh(new THREE.ConeBufferGeometry(0.16, 0.18, 16, 1, true), std('#1A1B1E', 0.5, 0.6, { side: THREE.DoubleSide })); shadeG.add(lampShade);
    var bulbM = W.glow(glowMat('#FFE7C0', 0.1), 0.05, 2.2), bulb = sph(0.05, bulbM, 10, 8); bulb.position.y = -0.06; shadeG.add(bulb);
    W.lamp('#FFE4B8', 2.3, 13, mch_v(0.3, HP - 0.8, 0.1), g);
    // museum stanchions and a rope
    var postM = mtl('#8C6A3A', 'brushed', 0.38, 0.9, 0.4), ropeM = std('#6A1E1C', 0.95, 0), RS = RD + 0.85, NS = 12, tops = [];
    for (i = 0; i < NS; i++) {
      a = (i + 0.5) / NS * mch_TAU; var px = Math.sin(a) * RS, pz = Math.cos(a) * RS;
      if (pz > RS * 0.8) { tops.push(null); continue; }                 // leave the side facing the viewer open
      var sp = new THREE.Mesh(new THREE.LatheBufferGeometry([[0.001, 0], [0.16, 0], [0.16, 0.03], [0.05, 0.07], [0.028, 0.12], [0.022, 0.9], [0.04, 0.93], [0.045, 0.97], [0.001, 1.0]].map(function (q) { return mch_v2(q[0], q[1]); }), 14), postM);
      sp.position.set(px, 0.16, pz); g.add(sp); tops.push(mch_v(px, 1.08, pz));
    }
    for (i = 0; i < NS; i++) {
      var t0 = tops[i], t1 = tops[(i + 1) % NS];
      if (!t0 || !t1) continue;
      var pts = [];
      for (k = 0; k <= 8; k++) { var f0 = k / 8, pp = t0.clone().lerp(t1, f0); pp.y -= Math.sin(f0 * Math.PI) * 0.18; pts.push(pp); }
      g.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 5, false), ropeM));
    }
    mech_mergeStatic(g);
    shade(g);
    pegs.castShadow = true; pegs.receiveShadow = true;
    var last = { key: -1 };
    return {
      group: g, R: 4.4, lookY: 4.4, dist: rf(r, 19, 21.5), camH: [2.4, 3.6], face: true, shadowPad: 8,
      close: { zoom: 0.36, el: 0.34, look: -3.5 },
      pendulum: { L: L, period: T },
      update: function (ctx) {
        var t = ctx.t, j;
        wg.rotation.y = -g.rotation.y;
        var S = mch_OMEGA * t.sec, A = S * D2R;                  // the plane, in degrees east of north
        yg.rotation.y = Math.PI / 2 - A;
        sg.rotation.z = TH * Math.sin(mch_cyc(ctx, T) * mch_TAU);
        var busy = false, real = ctx.real;
        for (j = 0; j < NPEG; j++) {
          var rel = pegA[j] * R2D, down = rel <= S || (rel >= 180 && rel - 180 <= S);
          if (down !== pegDown[j]) { pegDown[j] = down; pegT[j] = down && !ctx.snap ? real : -99; busy = true; writePeg(j, down ? (pegT[j] > -99 ? 0 : 1) : 0); }
          else if (down && pegT[j] > -99) {
            var u = (real - pegT[j]) / 0.5;
            if (u >= 1) { pegT[j] = -99; writePeg(j, 1); } else writePeg(j, u * u);
            busy = true;
          }
        }
        if (busy || last.key < 0) { pegs.instanceMatrix.needsUpdate = true; last.key = 1; }
      }
    };
  }

  // =====================================================================
  // 2. CANDLE CLOCK
  // Twelve candles, one for each hour of the half day. The candle for this
  // hour burns down through its bands as the hour goes; the ones before it
  // are stubs, the ones after it are new. At noon and midnight all twelve
  // are replaced.
  // =====================================================================
  var mch_ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  function mch_candles(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var standK = Tt['Stand'] || 'Row', waxK = Tt['Wax'] || 'Beeswax', markK = Tt['Marks'] || 'Quarters';
    var iron = heroMat(matName); iron.roughness = Math.max(iron.roughness, 0.5);
    var md = MATERIALS[matName] || MATERIALS['Ink Black'];
    var wax = { 'Beeswax': ['#D6A246', '#B47A2A', '#6B2E10'], 'Tallow': ['#EEE6D2', '#D8CAAB', '#8E2A22'], 'Oxblood': ['#7A2320', '#5A1614', '#E9DCC0'] }[waxK] || ['#D6A246', '#B47A2A', '#6B2E10'];
    var nb = { 'Quarters': 4, 'Ten Minutes': 6, 'Five Minutes': 12 }[markK] || 4;
    var CH = 0.66, CR = 0.055, STUB = 0.05, i, k, a;
    var stone = mtl('#A89F91', 'stone', 0.9, 0, 1.0), panM = iron;
    // the bands, painted once; v runs from the foot of the candle (0) to its top (1)
    var bandTex = canvasTex(64, 1024, function (gc, w, h) {
      gc.fillStyle = wax[0]; gc.fillRect(0, 0, w, h);
      var y0 = (1 - STUB / CH) * h, bh = y0 / nb;
      for (var b = 0; b < nb; b++) {
        var yTop = y0 - (b + 1) * bh;
        gc.fillStyle = b % 2 ? wax[0] : wax[1]; gc.fillRect(0, yTop, w, bh);
        gc.fillStyle = wax[2]; gc.fillRect(0, yTop - 3, w, 6);
      }
      gc.fillStyle = wax[2]; gc.fillRect(0, y0 - 3, w, 6);
      for (var s = 0; s < 40; s++) { gc.fillStyle = 'rgba(255,255,255,0.05)'; gc.fillRect(s * 1.6, 0, 1, h); }
    });
    var waxOpts = function (m) { m.roughness = 0.62; m.metalness = 0; return m; };
    var fullM = waxOpts(new THREE.MeshStandardMaterial({ map: bandTex, color: C('#FFFFFF') }));
    var burnTex = bandTex.clone(); burnTex.needsUpdate = true;
    var burnM = waxOpts(new THREE.MeshStandardMaterial({ map: burnTex, color: C('#FFFFFF'), emissive: C('#FF8A3A'), emissiveIntensity: 0 }));
    W.glow(burnM, 0, 0.1);
    var stubM = std(wax[1], 0.6, 0), wickM = std('#1C1714', 0.9, 0), charM = std('#2A1E16', 0.9, 0);
    var candleGeo = new THREE.CylinderBufferGeometry(CR * 0.97, CR, CH, 24, 1); candleGeo.translate(0, CH / 2, 0);
    var stubGeo = new THREE.CylinderBufferGeometry(CR * 1.02, CR * 1.1, STUB, 20, 1); stubGeo.translate(0, STUB / 2, 0);
    // slots: where each candle stands, in the group's frame
    var slots = [], Y0;
    if (standK === 'Ring') {
      var RR = 0.9; Y0 = 1.04;
      for (i = 0; i < 12; i++) { a = i / 12 * mch_TAU; slots.push(mch_v(Math.sin(a) * RR, Y0, -Math.cos(a) * RR)); }
      var base = cyl(1.18, 1.26, 0.16, 48, stone); base.position.y = 0.08; g.add(base);
      var colP = [[0.001, 0.16], [0.22, 0.16], [0.22, 0.2], [0.12, 0.26], [0.075, 0.36], [0.06, 0.5], [0.085, 0.58], [0.06, 0.66], [0.05, 0.86], [0.08, 0.9], [0.11, 0.93], [0.11, 0.97], [0.001, 0.98]];
      g.add(new THREE.Mesh(new THREE.LatheBufferGeometry(colP.map(function (q) { return mch_v2(q[0], q[1]); }), 24), iron));
      var ringT = new THREE.Mesh(new THREE.TorusBufferGeometry(RR, 0.022, 8, 96), iron); ringT.rotation.x = Math.PI / 2; ringT.position.y = 0.95; g.add(ringT);
      var bandR = new THREE.Mesh(new THREE.CylinderBufferGeometry(RR + 0.12, RR + 0.12, 0.08, 96, 1, true), iron); bandR.position.y = 0.93; g.add(bandR);
      var bandIn = new THREE.Mesh(new THREE.CylinderBufferGeometry(RR + 0.115, RR + 0.115, 0.08, 96, 1, true), iron.clone()); bandIn.material.side = THREE.BackSide; bandIn.position.y = 0.93; g.add(bandIn);
      for (i = 0; i < 6; i++) {
        a = (i + 0.5) / 6 * mch_TAU;
        var armG = new THREE.Group(); armG.add(mech_bar([0.05, 0], [RR + 0.12, 0], 0, 0.035, 0.03, iron));
        armG.rotation.y = -a + Math.PI / 2; armG.position.y = 0.95; g.add(armG);
        // a scroll under each arm
        var sc = new THREE.Mesh(new THREE.TorusBufferGeometry(0.16, 0.012, 6, 20, Math.PI * 1.4), iron); sc.position.set(0.3, -0.17, 0); sc.rotation.z = -0.4; armG.add(sc);
      }
      for (i = 0; i < 3; i++) {
        a = i / 3 * mch_TAU + 0.3;
        var ft = new THREE.Mesh(new THREE.TorusBufferGeometry(0.12, 0.018, 6, 16, Math.PI), iron); ft.position.set(Math.sin(a) * 0.3, 0.2, Math.cos(a) * 0.3); ft.rotation.y = a + Math.PI / 2; g.add(ft);
      }
    } else {
      var SP = 0.36; Y0 = 1.1;
      for (i = 0; i < 12; i++) slots.push(mch_v((i - 5.5) * SP, Y0, 0));
      var slab = mech_bbox(4.8, 0.14, 1.15, stone, 0.02); slab.position.y = 0.07; g.add(slab);
      var rail = mech_bbox(4.46, 0.04, 0.16, iron, 0.006); rail.position.y = 1.04; g.add(rail);
      var apron = mech_bbox(4.46, 0.09, 0.025, iron, 0.004); apron.position.set(0, 0.975, 0.07); g.add(apron);
      var apron2 = apron.clone(); apron2.position.z = -0.07; g.add(apron2);
      var stretch = mech_bbox(4.1, 0.04, 0.05, iron, 0.006); stretch.position.y = 0.42; g.add(stretch);
      // twisted square balusters between the rail and the stretcher
      var twG = new THREE.BoxBufferGeometry(0.024, 0.56, 0.024, 1, 24, 1), tp = twG.attributes.position;
      for (k = 0; k < tp.count; k++) { var ty = tp.getY(k), ang = ty * 14, tx = tp.getX(k), tz = tp.getZ(k); tp.setXYZ(k, tx * Math.cos(ang) - tz * Math.sin(ang), ty, tx * Math.sin(ang) + tz * Math.cos(ang)); }
      twG.computeVertexNormals();
      for (i = -5; i <= 5; i += 2) { var tw = new THREE.Mesh(twG, iron); tw.position.set(i * SP, 0.72, 0); g.add(tw); }
      // trestle legs with scrolled feet
      [-2.08, 2.08].forEach(function (x) {
        [-1, 1].forEach(function (sd) {
          g.add(mech_rod(mch_v(x, 1.02, 0), mch_v(x, 0.24, sd * 0.4), 0.018, iron, 6));
          var ftS = new THREE.Mesh(new THREE.TorusBufferGeometry(0.075, 0.016, 6, 16, Math.PI * 1.3), iron);
          ftS.position.set(x, 0.23, sd * 0.47); ftS.rotation.set(0, Math.PI / 2, sd > 0 ? -0.3 : Math.PI + 0.3); g.add(ftS);
        });
        g.add(mech_rod(mch_v(x, 0.42, -0.26), mch_v(x, 0.42, 0.26), 0.014, iron, 6));
      });
    }
    // pans, prickets and hour tags
    var panP = [[0.001, 0], [0.07, 0], [0.095, 0.012], [0.108, 0.03], [0.1, 0.034], [0.08, 0.018], [0.001, 0.018]];
    var panGeo = new THREE.LatheBufferGeometry(panP.map(function (q) { return mch_v2(q[0], q[1]); }), 24);
    var trim = md.trim;
    slots.forEach(function (p, j) {
      var pan = new THREE.Mesh(panGeo, panM); pan.position.set(p.x, p.y - 0.035, p.z); g.add(pan);
      var col = cyl(0.02, 0.026, 0.06, 10, panM); col.position.set(p.x, p.y - 0.06, p.z); g.add(col);
      var tagOut = standK === 'Ring' ? mch_v(p.x, 0, p.z).normalize() : mch_v(0, 0, 1);
      var tag = mch_text(mch_ROMAN[j], { color: trim === '#1A1C20' ? '#1A1C20' : '#E8DFC8', font: FONT_SERIF, height: 0.075, px: 60, pad: 0.12, bg: trim === '#1A1C20' ? '#D8CFBD' : '#221F1D' });
      var tg = new THREE.Group(); tg.add(tag);
      var tb = mech_bbox(tag.userData.w + 0.02, 0.09, 0.008, panM, 0.002); tb.position.z = -0.006; tg.add(tb);
      if (standK === 'Ring') { tg.position.set(tagOut.x * 1.025, 0.93, tagOut.z * 1.025); tg.rotation.y = Math.atan2(tagOut.x, tagOut.z); }
      else { tg.position.set(p.x, 0.9, 0.09); var hk = new THREE.Mesh(new THREE.TorusBufferGeometry(0.012, 0.003, 4, 10), panM); hk.position.set(0, 0.055, 0); tg.add(hk); }
      g.add(tg);
    });
    // candles: new ones, stubs, and the one that is burning
    var fulls = [], stubs = [];
    slots.forEach(function (p) {
      var fg = new THREE.Group(); fg.position.copy(p);
      fg.add(new THREE.Mesh(candleGeo, fullM));
      var wk = cyl(0.003, 0.003, 0.025, 5, wickM); wk.position.y = CH + 0.01; fg.add(wk);
      g.add(fg); fulls.push(fg);
      var stg = new THREE.Group(); stg.position.copy(p);
      stg.add(new THREE.Mesh(stubGeo, stubM));
      var pool = sph(CR * 1.35, stubM, 14, 6); pool.scale.set(1, 0.12, 1); pool.position.y = 0.004; stg.add(pool);
      var cw = cyl(0.003, 0.004, 0.014, 5, charM); cw.position.y = STUB + 0.006; cw.rotation.z = 0.5; stg.add(cw);
      var scorch = new THREE.Mesh(new THREE.CircleBufferGeometry(CR * 0.95, 16), charM); scorch.rotation.x = -Math.PI / 2; scorch.position.y = STUB + 0.001; stg.add(scorch);
      for (k = 0; k < 3; k++) { var dr = sph(0.012, stubM, 6, 5); a = rf(r, 0, mch_TAU); dr.scale.set(1, 2.4, 1); dr.position.set(Math.sin(a) * CR * 1.02, STUB * 0.4, Math.cos(a) * CR * 1.02); stg.add(dr); }
      mech_mergeStatic(stg); g.add(stg); stubs.push(stg);
    });
    var burnG = new THREE.Group(); g.add(burnG);
    var burnMesh = new THREE.Mesh(candleGeo, burnM); burnG.add(burnMesh);
    var topG = new THREE.Group(); burnG.add(topG);
    var cup = new THREE.Mesh(new THREE.TorusBufferGeometry(CR * 0.8, 0.012, 6, 24), stubM); cup.rotation.x = Math.PI / 2; topG.add(cup);
    var poolT = new THREE.Mesh(new THREE.CircleBufferGeometry(CR * 0.8, 20), std('#E8B45C', 0.15, 0, { emissive: C('#FFB050'), emissiveIntensity: 0 })); poolT.rotation.x = -Math.PI / 2; poolT.position.y = -0.004; topG.add(poolT);
    W.glow(poolT.material, 0.05, 0.9);
    var wick = cyl(0.0035, 0.0035, 0.03, 5, wickM); wick.position.y = 0.012; wick.rotation.z = 0.12; topG.add(wick);
    var dripM = std(wax[0], 0.5, 0);
    for (k = 0; k < 4; k++) {
      var drip = sph(0.011, dripM, 6, 5); a = k * 1.7 + 0.5;
      drip.scale.set(1, 2.2 + k * 0.6, 0.9); drip.position.set(Math.sin(a) * CR * 1.0, -0.02 - k * 0.012, Math.cos(a) * CR * 1.0); topG.add(drip);
    }
    var flameG = new THREE.Group(); flameG.position.y = 0.026; topG.add(flameG);
    var fOut = new THREE.MeshBasicMaterial({ color: C('#FF8A2A'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    var fIn = new THREE.MeshBasicMaterial({ color: C('#FFE9A8'), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    var fBlue = new THREE.MeshBasicMaterial({ color: C('#3C6BFF'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    var flOut = sph(0.019, fOut, 12, 10); flOut.scale.set(1, 2.7, 1); flOut.position.y = 0.036; flameG.add(flOut);
    var flIn = sph(0.011, fIn, 10, 8); flIn.scale.set(1, 2.3, 1); flIn.position.y = 0.026; flameG.add(flIn);
    var flB = sph(0.009, fBlue, 8, 6); flB.scale.set(1.2, 1, 1.2); flB.position.y = 0.006; flameG.add(flB);
    var lamp = W.lamp('#FF9C4A', 1.5, 6.5, mch_v(0, Y0 + CH + 0.1, 0), g);
    mech_mergeStatic(g);
    shade(g);
    [flOut, flIn, flB].forEach(function (m) { m.castShadow = false; m.receiveShadow = false; });
    var lastK = -1, wl = new THREE.Vector3();
    var ring = standK === 'Ring';
    return {
      group: g, R: ring ? 1.6 : 2.7, lookY: ring ? 1.05 : 1.15, dist: ring ? rf(r, 5.2, 6.0) : rf(r, 5.9, 6.7), camH: ring ? [2.3, 2.9] : [1.55, 2.1], face: true,
      close: { zoom: 0.46, el: 0.05, look: 0.15 },
      update: function (ctx) {
        var t = ctx.t, kk = t.h % 12, f = (t.m * 60 + (t.sec % 60)) / 3600;
        if (kk !== lastK) {
          for (var j = 0; j < 12; j++) { fulls[j].visible = j > kk; stubs[j].visible = j < kk; }
          burnG.position.copy(slots[kk]); lastK = kk;
        }
        var hNow = STUB + (CH - STUB) * (1 - f);
        burnMesh.scale.y = hNow / CH; burnTex.repeat.y = hNow / CH; topG.position.y = hNow;
        lamp.position.set(burnG.position.x, burnG.position.y + hNow + 0.12, burnG.position.z);
        // the flame breathes, and leans with the wind
        mch_localWind(ctx, g, wl);
        var rl = ctx.real, fl = 1 + 0.1 * Math.sin(rl * 11.3) + 0.06 * Math.sin(rl * 23.7 + 1.3), wv = (ctx.wind || 0.5);
        flameG.scale.set(1, fl, 1);
        flameG.rotation.x = wl.z * 0.22 * wv + 0.05 * Math.sin(rl * 5.1); flameG.rotation.z = -wl.x * 0.22 * wv + 0.05 * Math.sin(rl * 4.3 + 2);
        fOut.opacity = lerp(0.55, 0.9, ctx.night); fIn.opacity = lerp(0.7, 1, ctx.night);
        lamp.userData.full = 1.5 * (0.85 + 0.15 * fl);
      }
    };
  }

  // =====================================================================
  // 3. STATION CLOCK
  // A double-sided platform clock. The second hand sweeps its circle in
  // 58.5 seconds, stops at twelve, and waits for the pulse from the master
  // clock that moves the minute hand on, which is how railway clocks kept
  // a whole line to the same minute.
  // =====================================================================
  function mch_stationDial(kind) {
    var pal = { 'White Enamel': ['#F3F2EC', '#131417', '#5A5E66'], 'Black Enamel': ['#141518', '#F1EFE8', '#9AA0A8'], 'Cream': ['#EDE3C8', '#1C2846', '#6B6450'] }[kind] || ['#F3F2EC', '#131417', '#5A5E66'];
    return {
      pal: pal,
      tex: canvasTex(1024, 1024, function (gc, S) {
        var c = S / 2;
        gc.fillStyle = pal[0]; gc.fillRect(0, 0, S, S);
        var gr = gc.createRadialGradient(c * 0.8, c * 0.7, 20, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)'); gc.fillStyle = gr; gc.fillRect(0, 0, S, S);
        gc.fillStyle = pal[1]; gc.strokeStyle = pal[1];
        gc.lineWidth = 5; gc.beginPath(); gc.arc(c, c, c * 0.975, 0, mch_TAU); gc.stroke();
        gc.lineWidth = 2; gc.beginPath(); gc.arc(c, c, c * 0.8, 0, mch_TAU); gc.stroke();
        for (var m = 0; m < 60; m++) {
          gc.save(); gc.translate(c, c); gc.rotate(m / 60 * mch_TAU);
          if (m % 5) { gc.beginPath(); gc.arc(0, -c * 0.885, 8, 0, mch_TAU); gc.fill(); }
          else { gc.beginPath(); gc.moveTo(-15, -c * 0.95); gc.lineTo(15, -c * 0.95); gc.lineTo(8, -c * 0.81); gc.lineTo(-8, -c * 0.81); gc.closePath(); gc.fill(); }
          gc.restore();
        }
        gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '600 64px ' + FONT_SANS;
        for (var h = 1; h <= 12; h++) { var a = h / 12 * mch_TAU; gc.fillText(String(h), c + Math.sin(a) * c * 0.68, c - Math.cos(a) * c * 0.68 + 3); }
        gc.font = '700 38px ' + FONT_SANS;
        var word = 'MARFA', x = c - 2.2 * 38 * 0.95 * 1.1; for (var q = 0; q < word.length; q++) gc.fillText(word[q], c + (q - 2) * 44, c * 0.55);
        gc.fillStyle = pal[2]; gc.font = '500 24px ' + FONT_SANS;
        gc.fillText('CENTRAL TIME', c, c * 1.43);
      })
    };
  }
  function mch_station(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var mountK = Tt['Mount'] || 'Post', dialK = Tt['Dial'] || 'White Enamel', signK = Tt['Sign'] || 'Enamel Blue';
    var paintM = heroMat(matName), md = MATERIALS[matName];
    paintM.roughness = Math.max(paintM.roughness, 0.52);           // a fluted column in polished metal throws the low sun into the bloom
    var ironM = mtl('#23252A', 'paint', 0.55, 0.45, 0.8), darkM = std('#17181B', 0.45, 0.6);
    var concM = mtl('#B2AB9E', 'concrete', 0.95, 0, 1.8), copeM = mtl('#CFC8B8', 'stone', 0.85, 0, 1.2);
    var YP = 0.55, RC = 0.5, DD = 0.28, i, k;
    // ---- the platform, its coping, the safety line, and a siding behind
    var plat = mech_bbox(12.4, YP, 4.6, concM, 0.02); plat.position.y = YP / 2; g.add(plat);
    var cope = mech_bbox(12.5, 0.07, 0.55, copeM, 0.01); cope.position.set(0, YP + 0.02, -2.05); g.add(cope);
    var cope2 = mech_bbox(12.5, 0.07, 0.35, copeM, 0.01); cope2.position.set(0, YP + 0.02, 2.15); g.add(cope2);
    var lineM = std('#E2B53A', 0.7, 0), sline = box(12.4, 0.006, 0.1, lineM); sline.position.set(0, YP + 0.057, -1.62); g.add(sline);
    var tact = new THREE.InstancedMesh(new THREE.CylinderBufferGeometry(0.012, 0.014, 0.008, 6), std('#D7A631', 0.7, 0), 240);
    var dmy = new THREE.Object3D(), nT = 0;
    for (i = 0; i < 120; i++) for (k = 0; k < 2; k++) { if (nT >= 240) break; dmy.position.set(-6.1 + i * 0.1 + (k % 2) * 0.05, YP + 0.059, -1.49 + k * 0.05); dmy.updateMatrix(); tact.setMatrixAt(nT++, dmy.matrix); }
    tact.count = nT; g.add(tact);
    var ballast = new THREE.Mesh(new THREE.CylinderBufferGeometry(1.4, 1.9, 0.32, 4, 1), mtl('#6E665C', 'stone', 1, 0, 0.35));
    ballast.geometry.rotateY(Math.PI / 4); ballast.scale.set(7.9 / 1.34, 1, 1); ballast.position.set(0, 0.16, -4.3); g.add(ballast);
    var tieM = mtl('#4A3B2E', 'wood', 0.95, 0, 0.6), NTIE = 26, ties = new THREE.InstancedMesh(new THREE.BoxBufferGeometry(0.24, 0.15, 2.5), tieM, NTIE);
    for (i = 0; i < NTIE; i++) { dmy.position.set(-7.6 + i * 0.61, 0.36, -4.3); dmy.rotation.y = rf(r, -0.02, 0.02); dmy.updateMatrix(); ties.setMatrixAt(i, dmy.matrix); }
    g.add(ties);
    var railM = mtl('#6B6258', 'rust', 0.55, 0.7, 0.6);
    [-0.72, 0.72].forEach(function (dz) {
      var rl = mch_ibeam(15.6, 0.15, 0.13, 0.03, 0.035, railM); rl.position.set(0, 0.51, -4.3 + dz); g.add(rl);
      var head = box(15.6, 0.02, 0.065, mtl('#B9BBBE', 'brushed', 0.3, 1, 0.4)); head.position.set(0, 0.59, -4.3 + dz); g.add(head);
    });

    // ---- the clock head: drum, two faces, hands
    var dial = mch_stationDial(dialK), pal = dial.pal;
    var faceM = new THREE.MeshStandardMaterial({ map: dial.tex, roughness: 0.3, metalness: 0, emissive: C('#FFF6E6'), emissiveMap: dial.tex, emissiveIntensity: 0 });
    W.glow(faceM, 0, 0.6);
    var handM = std(pal[1], 0.35, 0.3), secM = std('#C8261E', 0.35, 0.2);
    var mount = new THREE.Group(); g.add(mount);
    var head = new THREE.Group(); mount.add(head);
    var drumG = new THREE.CylinderBufferGeometry(RC + 0.06, RC + 0.06, DD, 64, 1, true); drumG.rotateX(Math.PI / 2);
    var drumM = paintM.clone(); drumM.side = THREE.DoubleSide; head.add(new THREE.Mesh(drumG, drumM));
    var faces = [];
    [0, 1].forEach(function (sd) {
      var fg = new THREE.Group(); fg.rotation.y = sd * Math.PI; head.add(fg);
      var fc = new THREE.Mesh(new THREE.CircleBufferGeometry(RC, 72), faceM); fc.position.z = DD / 2 - 0.02; fg.add(fc);
      var bz = new THREE.Mesh(new THREE.TorusBufferGeometry(RC + 0.045, 0.032, 10, 72), paintM); bz.position.z = DD / 2; fg.add(bz);
      var bz2 = new THREE.Mesh(new THREE.TorusBufferGeometry(RC + 0.012, 0.012, 6, 72), darkM); bz2.position.z = DD / 2 - 0.004; fg.add(bz2);
      var hh = mech_hand({ style: 'baton', L: RC * 0.56, w: 0.05, tail: 0.09, th: 0.012 }, handM); hh.position.z = DD / 2 - 0.006; fg.add(hh);
      var mh = mech_hand({ style: 'baton', L: RC * 0.86, w: 0.036, tail: 0.11, th: 0.012 }, handM); mh.position.z = DD / 2 + 0.004; fg.add(mh);
      // the second hand: a needle with a diamond near the tip and a counterweight tail
      var sh = new THREE.Group(); sh.position.z = DD / 2 + 0.014; fg.add(sh);
      var sL = RC * 0.9, sw = 0.008;
      sh.add(new THREE.Mesh(mech_extrude(mch_shape([[-sw, -0.12], [sw, -0.12], [sw * 0.6, sL], [-sw * 0.6, sL]]), 0.006, 0), secM));
      sh.add(new THREE.Mesh(mech_extrude(mch_shape([[0, sL * 0.62], [0.024, sL * 0.7], [0, sL * 0.8], [-0.024, sL * 0.7]]), 0.006, 0), secM));
      var cw = new THREE.Mesh(mech_extrude(mch_shape([[-0.024, -0.2], [0.024, -0.2], [0.018, -0.12], [-0.018, -0.12]]), 0.008, 0), secM); sh.add(cw);
      var hub = mech_dome(0.022, secM); hub.position.z = 0.006; sh.add(hub);
      faces.push({ hh: hh, mh: mh, sh: sh });
    });
    var yT, hx = 0, cy;
    if (mountK === 'Bracket') {
      var px = -0.62, topY = YP + 4.05;
      var post = mech_bbox(0.15, topY - YP, 0.15, paintM, 0.01); post.position.set(px, (topY + YP) / 2, 0); mount.add(post);
      var pcap = mech_bbox(0.22, 0.05, 0.22, darkM, 0.01); pcap.position.set(px, topY + 0.025, 0); mount.add(pcap);
      var bplate = mech_bbox(0.4, 0.03, 0.4, darkM, 0.006); bplate.position.set(px, YP + 0.015, 0); mount.add(bplate);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { var nt = mch_nut(0.025, 0.03, darkM); nt.position.set(px + q[0] * 0.15, YP + 0.045, q[1] * 0.15); mount.add(nt); });
      var armL = 1.45, armY = topY - 0.12, arm = mech_bbox(armL, 0.1, 0.1, paintM, 0.008); arm.position.set(px + armL / 2, armY, 0); mount.add(arm);
      mount.add(mech_rod(mch_v(px + 0.07, armY - 0.95, 0), mch_v(px + 0.85, armY - 0.05, 0), 0.03, paintM, 8));
      var scr = new THREE.Mesh(new THREE.TorusBufferGeometry(0.2, 0.018, 6, 20, Math.PI * 1.2), paintM); scr.position.set(px + 0.3, armY - 0.28, 0); scr.rotation.z = Math.PI * 0.9; mount.add(scr);
      hx = px + 1.08; cy = armY - 0.05 - 0.22 - (RC + 0.06);
      [-0.16, 0.16].forEach(function (dx) { mount.add(mech_rod(mch_v(hx + dx, armY - 0.05, 0), mch_v(hx + dx * 0.6, cy + RC + 0.05, 0), 0.016, darkM, 6)); });
      var hang = new THREE.Mesh(new THREE.TorusBufferGeometry(RC + 0.09, 0.022, 6, 40, Math.PI * 0.5), darkM); hang.rotation.z = Math.PI / 4; hang.position.set(hx, cy, 0); mount.add(hang);
    } else {
      // a fluted cast iron column with a cradle for the drum
      var prof = [[0.001, 0], [0.27, 0], [0.27, 0.1], [0.23, 0.14], [0.21, 0.46], [0.17, 0.52], [0.135, 0.6], [0.115, 0.7], [0.1, 2.62], [0.13, 2.7], [0.165, 2.78], [0.165, 2.86], [0.11, 2.9], [0.075, 3.0], [0.001, 3.0]];
      var colGeo = new THREE.LatheBufferGeometry(prof.map(function (q) { return mch_v2(q[0], q[1]); }), 32), cp = colGeo.attributes.position;
      for (k = 0; k < cp.count; k++) {
        var yy = cp.getY(k); if (yy < 0.74 || yy > 2.58) continue;
        var ax = cp.getX(k), az = cp.getZ(k), f = 1 + 0.07 * Math.max(0, Math.cos(16 * Math.atan2(ax, az)));
        cp.setX(k, ax * f); cp.setZ(k, az * f);
      }
      colGeo.computeVertexNormals();
      var colM = new THREE.Mesh(colGeo, paintM); colM.position.y = YP; mount.add(colM);
      yT = YP + 3.0; cy = yT + 0.1 + RC + 0.1;
      var neck = cyl(0.06, 0.08, 0.12, 16, paintM); neck.position.y = yT + 0.05; mount.add(neck);
      var cradle = new THREE.Mesh(new THREE.TorusBufferGeometry(RC + 0.1, 0.03, 8, 48, Math.PI), paintM); cradle.rotation.z = Math.PI; cradle.position.y = cy; mount.add(cradle);
      [-1, 1].forEach(function (sd) {
        var bs = mech_zcyl(0.06, DD * 0.55, darkM, 12); bs.position.set(sd * (RC + 0.1), cy, 0); mount.add(bs);
        var sc2 = new THREE.Mesh(new THREE.TorusBufferGeometry(0.13, 0.02, 6, 20, Math.PI * 1.3), paintM); sc2.position.set(sd * 0.2, yT + 0.2, 0); sc2.rotation.z = sd > 0 ? -0.5 : Math.PI - 0.8; mount.add(sc2);
      });
      var fin = new THREE.Mesh(new THREE.LatheBufferGeometry([[0.001, 0], [0.05, 0], [0.05, 0.03], [0.07, 0.07], [0.04, 0.12], [0.012, 0.2], [0.001, 0.26]].map(function (q) { return mch_v2(q[0], q[1]); }), 16), paintM);
      fin.position.y = cy + RC + 0.05; mount.add(fin);
    }
    head.position.set(hx, cy, 0);
    mount.rotation.y = (r() < 0.5 ? -1 : 1) * rf(r, 0.34, 0.5);
    // a lamp over the face for the night
    var lampG = new THREE.Group(); lampG.position.set(hx, cy + RC + 0.46, 0.36); mount.add(lampG);
    var armTop = mch_v(hx, cy + RC + 0.52, 0.02);
    mount.add(mech_rod(mch_v(hx, cy + RC + 0.12, 0), armTop, 0.014, darkM, 6));
    mount.add(mech_rod(armTop, mch_v(hx, cy + RC + 0.52, 0.36), 0.014, darkM, 6));
    var aTip = sph(0.022, darkM, 8, 6); aTip.position.copy(armTop); mount.add(aTip);
    var lsh = new THREE.Mesh(new THREE.ConeBufferGeometry(0.12, 0.1, 16, 1, true), std('#1F4A3A', 0.45, 0.3, { side: THREE.DoubleSide })); lsh.position.y = 0.0; lampG.add(lsh);
    var lbM = W.glow(glowMat('#FFE9C2', 0.1), 0.05, 2.2), lb = sph(0.035, lbM, 8, 6); lb.position.y = -0.04; lampG.add(lb);
    W.lamp('#FFE6BC', 1.3, 6, mch_v(hx, cy + RC + 0.3, 0.55), mount);

    // ---- the station name board
    var sgn = { 'Enamel Blue': ['#1E3C87', '#F4F1E8'], 'Black and White': ['#F2F0E8', '#15161A'], 'Depot Green': ['#23452F', '#EFE3C2'] }[signK] || ['#1E3C87', '#F4F1E8'];
    var sG = new THREE.Group(); sG.position.set(3.7, YP, -1.2); g.add(sG);
    var nm = mch_text('MARFA', { bg: sgn[0], color: sgn[1], font: FONT_SANS, height: 0.62, px: 120, spacing: 0.22, pad: 0.55 });
    var bw = nm.userData.w, sy = 2.45;
    nm.position.set(0, sy, 0.036); sG.add(nm);
    var nmB = nm.clone(); nmB.rotation.y = Math.PI; nmB.position.z = -0.036; sG.add(nmB);
    var frame = mech_bbox(bw + 0.08, 0.7, 0.06, darkM, 0.01); frame.position.y = sy; sG.add(frame);
    var sub = mch_text('ELEV 4685 FT', { bg: sgn[0], color: sgn[1], font: FONT_SANS, height: 0.2, px: 70, spacing: 0.12, pad: 0.3 });
    sub.position.set(0, sy - 0.55, 0.021); sG.add(sub);
    var subB = sub.clone(); subB.rotation.y = Math.PI; subB.position.z = -0.021; sG.add(subB);
    var subF = mech_bbox(sub.userData.w + 0.04, 0.24, 0.035, darkM, 0.006); subF.position.y = sy - 0.55; sG.add(subF);
    [-1, 1].forEach(function (sd) {
      var sp = cyl(0.045, 0.05, sy + 0.4, 12, darkM); sp.position.set(sd * (bw / 2 - 0.1), (sy + 0.4) / 2, -0.07); sG.add(sp);
      var spc = sph(0.06, darkM, 10, 8); spc.position.set(sd * (bw / 2 - 0.1), sy + 0.42, -0.07); sG.add(spc);
      [0.2, -0.2].forEach(function (dy) { var cl = box(0.14, 0.04, 0.04, darkM); cl.position.set(sd * (bw / 2 - 0.1), sy + dy, -0.035); sG.add(cl); });
    });
    // ---- a bench with its back to us, and a platform lamp
    var bench = new THREE.Group(); bench.position.set(-3.1, YP, -0.35); bench.rotation.y = Math.PI; g.add(bench);
    var slatM = mtl('#7A5A3C', 'wood', 0.9, 0, 0.5);
    for (i = 0; i < 4; i++) { var sl = mech_bbox(1.9, 0.035, 0.09, slatM, 0.006); sl.position.set(0, 0.45, -0.16 + i * 0.105); bench.add(sl); }
    for (i = 0; i < 3; i++) { var bl = mech_bbox(1.9, 0.09, 0.03, slatM, 0.006); bl.position.set(0, 0.6 + i * 0.13, -0.24 - i * 0.03); bl.rotation.x = -0.2; bench.add(bl); }
    var endS = mch_shape([[-0.24, 0], [-0.17, 0], [-0.15, 0.2], [0.12, 0.2], [0.17, 0], [0.24, 0], [0.18, 0.43], [0.2, 0.46], [-0.2, 0.46], [-0.24, 0.5], [-0.3, 0.92], [-0.35, 0.92], [-0.29, 0.46]]);
    [-0.86, 0.86].forEach(function (x) { var e = new THREE.Mesh(mech_extrude(endS, 0.05, 0.008), ironM); e.rotation.y = Math.PI / 2; e.position.set(x, 0, 0); bench.add(e); });
    var lampPost = new THREE.Group(); lampPost.position.set(-5.4, YP, -1.4); g.add(lampPost);
    var lpole = cyl(0.05, 0.08, 3.4, 12, darkM); lpole.position.y = 1.7; lampPost.add(lpole);
    var lbase = cyl(0.14, 0.18, 0.4, 12, darkM); lbase.position.y = 0.2; lampPost.add(lbase);
    var lanM = W.glow(glowMat('#FFE2B0', 0.15), 0.08, 2.4), lan = mech_bbox(0.22, 0.3, 0.22, lanM, 0.01); lan.position.y = 3.58; lampPost.add(lan);
    var lcap = new THREE.Mesh(new THREE.ConeBufferGeometry(0.2, 0.16, 4), darkM); lcap.rotation.y = Math.PI / 4; lcap.position.y = 3.81; lampPost.add(lcap);
    W.lamp('#FFE0AE', 1.5, 9, mch_v(-5.4, YP + 3.5, -1.1), g);

    [mount, sG, bench, lampPost].forEach(mech_mergeStatic);
    mech_mergeStatic(g);
    shade(g);
    var lookY = 2.75;
    return {
      group: g, R: 7.2, lookY: lookY, dist: rf(r, 11.5, 13), camH: [1.6, 2.4], face: true, shadowPad: 7,
      close: { zoom: 0.28, el: 0.03, look: cy - lookY },
      update: function (ctx) {
        var t = ctx.t, s = t.sec % 60;
        var sa = Math.min(s / 58.5, 1);                              // sweeps a little fast, then waits at twelve
        var jump = ctx.snap ? 1 : mch_back(s / 0.3);                   // the minute pulse
        var mm = t.m - 1 + jump, hA = ((t.h % 12) + mm / 60) / 12 * mch_TAU;
        for (var j = 0; j < 2; j++) {
          var fc = faces[j];
          fc.sh.rotation.z = -sa * mch_TAU; fc.mh.rotation.z = -mm / 60 * mch_TAU; fc.hh.rotation.z = -hA;
        }
      }
    };
  }

  // =====================================================================
  // 4. SCOREBOARD
  // A small-town football scoreboard on two poles. HOME is the hour and
  // GUEST the minute; the game clock runs down the seconds to the next
  // minute; QTR is the quarter of the day. Bulb digits, lit at night.
  // =====================================================================
  var mch_SEG = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F];
  // twenty bulbs to a digit: corners on a four by seven grid, each lit by
  // any of the segments it belongs to
  var mch_BULBS = (function () {
    var out = [], seen = {};
    var segs = [[[0, 6], [3, 6]], [[3, 3], [3, 6]], [[3, 0], [3, 3]], [[0, 0], [3, 0]], [[0, 0], [0, 3]], [[0, 3], [0, 6]], [[0, 3], [3, 3]]];
    segs.forEach(function (s, si) {
      var a = s[0], b = s[1], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (var i = 0; i <= n; i++) {
        var x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n, key = x + ',' + y;
        if (seen[key] == null) { seen[key] = out.length; out.push({ x: x, y: y, mask: 0 }); }
        out[seen[key]].mask |= 1 << si;
      }
    });
    return out;
  })();
  function mch_scoreboard(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var team = Tt['Home'] || 'SHORTHORNS', paintK = Tt['Paint'] || 'Maroon', bulbK = Tt['Bulbs'] || 'Amber';
    var pole = heroMat(matName), darkM = std('#16171A', 0.55, 0.4), concM = mtl('#ABA497', 'concrete', 0.95, 0, 1.4);
    var pal = { 'Maroon': ['#5C1A22', '#F1ECE1', '#F1ECE1'], 'Royal Blue': ['#1C3C8C', '#F3D35A', '#F4F1E8'], 'Forest Green': ['#1E4A2F', '#F1ECE1', '#F1ECE1'], 'Black and Gold': ['#17181B', '#D9AA3C', '#D9AA3C'] }[paintK] || ['#5C1A22', '#F1ECE1', '#F1ECE1'];
    var bulbHex = { 'Amber': '#FFB54A', 'White': '#FFF0D2', 'Red': '#FF5A34' }[bulbK] || '#FFB54A';
    var boardM = mtl(pal[0], 'paint', 0.62, 0.15, 1.1), headM = mtl(pal[1], 'paint', 0.6, 0.1, 1.1);
    var BW = 6.6, BH = 3.3, YB = 3.3, ZF = 0.26, PX = 2.35, i, k;
    // ---- poles, footings, girts
    var poleTop = YB + BH + 1.2;
    [-1, 1].forEach(function (sd) {
      var p = cyl(0.165, 0.165, poleTop, 20, pole); p.position.set(sd * PX, poleTop / 2, -0.2); g.add(p);
      var pc = cyl(0.19, 0.19, 0.05, 20, darkM); pc.position.set(sd * PX, poleTop + 0.025, -0.2); g.add(pc);
      var ft = cyl(0.38, 0.42, 0.3, 20, concM); ft.position.set(sd * PX, 0.15, -0.2); g.add(ft);
      [YB + 0.3, YB + BH - 0.3, YB + BH + 0.65].forEach(function (y) {
        var ub = new THREE.Mesh(new THREE.TorusBufferGeometry(0.18, 0.018, 6, 16, Math.PI), darkM); ub.rotation.x = Math.PI / 2; ub.rotation.z = Math.PI; ub.position.set(sd * PX, y, -0.2); g.add(ub);
        [-1, 1].forEach(function (s2) { var nt = mch_nut(0.03, 0.04, darkM); nt.rotation.x = Math.PI / 2; nt.position.set(sd * PX + s2 * 0.18, y, 0.0); g.add(nt); });
      });
    });
    [YB + 0.3, YB + BH - 0.3].forEach(function (y) { var gi = mch_ibeam(BW - 0.4, 0.14, 0.06, 0.012, 0.012, darkM); gi.position.set(0, y, -0.02); g.add(gi); });
    // ---- the board, its trim, and the digit panels
    var board = mech_bbox(BW, BH, 0.24, boardM, 0.03); board.position.set(0, YB + BH / 2, ZF - 0.12); g.add(board);
    var trimM = std(pal[2], 0.6, 0.1);
    [[0, BH / 2 - 0.1, BW - 0.2, 0.035], [0, -BH / 2 + 0.1, BW - 0.2, 0.035], [BW / 2 - 0.1, 0, 0.035, BH - 0.2], [-BW / 2 + 0.1, 0, 0.035, BH - 0.2]].forEach(function (q) {
      var tr = box(q[2], q[3], 0.01, trimM); tr.position.set(q[0], YB + BH / 2 + q[1], ZF + 0.003); g.add(tr);
    });
    var header = mech_bbox(BW - 0.3, 0.95, 0.2, headM, 0.025); header.position.set(0, YB + BH + 0.55, ZF - 0.12); g.add(header);
    var hdr = mch_text(['HOME OF THE ' + team], { color: pal[0], font: FONT_SANS, height: 0.5, px: 110, spacing: 0.06, pad: 0.1, weight: '900' });
    var hs = Math.min(1, (BW - 0.8) / hdr.userData.w); hdr.scale.set(hs, hs, 1); hdr.position.set(0, YB + BH + 0.55, ZF - 0.015); g.add(hdr);
    var lower = mech_bbox(3.6, 0.5, 0.12, headM, 0.02); lower.position.set(0, YB - 0.45, ZF - 0.12); g.add(lower);
    var lw = mch_text('CLASS OF 2027', { color: pal[0], font: FONT_SANS, height: 0.3, px: 90, spacing: 0.12, pad: 0.1, weight: '800' });
    lw.position.set(0, YB - 0.45, ZF - 0.055); g.add(lw);
    [-1.5, 1.5].forEach(function (x) { g.add(mech_rod(mch_v(x, YB - 0.2, ZF - 0.14), mch_v(x, YB + 0.05, ZF - 0.14), 0.015, darkM, 6)); });
    var label = function (txt, x, y, h) { var p = mch_text(txt, { color: pal[2], font: FONT_SANS, height: h, px: 90, spacing: 0.1, pad: 0.05, weight: '800' }); p.position.set(x, YB + y, ZF + 0.005); g.add(p); };
    label('HOME', -2.2, 2.9, 0.34); label('GUEST', 2.2, 2.9, 0.34); label('QTR', -0.55, 0.62, 0.26);
    var panelM = std('#0E0F11', 0.7, 0.1);
    var panel = function (x, y, w, h) { var p = mech_bbox(w, h, 0.05, panelM, 0.015); p.position.set(x, YB + y, ZF + 0.02); g.add(p); };
    // digits: [centre x, centre y, height]
    var DIG = [[-2.6, 1.72, 1.1], [-1.8, 1.72, 1.1], [1.8, 1.72, 1.1], [2.6, 1.72, 1.1], [-0.62, 2.12, 0.82], [0.12, 2.12, 0.82], [0.7, 2.12, 0.82], [0.25, 0.62, 0.62]];
    panel(-2.2, 1.72, 1.7, 1.4); panel(2.2, 1.72, 1.7, 1.4); panel(0.0, 2.12, 2.0, 1.1); panel(0.25, 0.62, 0.55, 0.85);
    var pos = [], di, b;
    DIG.forEach(function (d) { var sp = d[2] / 6; mch_BULBS.forEach(function (q) { pos.push([d[0] + (q.x - 1.5) * sp, d[1] + (q.y - 3) * sp]); }); });
    var colon = [[-0.26, 2.28], [-0.26, 1.96]]; colon.forEach(function (q) { pos.push(q); });
    var sockGeo = new THREE.SphereBufferGeometry(0.036, 8, 6), bulbGeo = new THREE.SphereBufferGeometry(0.043, 10, 8);
    var socks = new THREE.InstancedMesh(sockGeo, std('#24211E', 0.3, 0.5), pos.length);
    var litM = W.glow(glowMat(bulbHex, 1.0), 1.15, 2.3); litM.color = C(bulbHex).multiplyScalar(0.6);
    var lit = new THREE.InstancedMesh(bulbGeo, litM, pos.length);
    var dmy = new THREE.Object3D();
    pos.forEach(function (q, j) { dmy.position.set(q[0], YB + q[1], ZF + 0.045); dmy.updateMatrix(); socks.setMatrixAt(j, dmy.matrix); });
    g.add(socks); g.add(lit); lit.count = 0;
    W.lamp(bulbHex, 1.2, 12, mch_v(0, YB + 1.6, 1.8), g);
    // ---- a ladder, a horn, conduit
    var lx = PX + 0.32;
    [-0.2, 0.2].forEach(function (dz) { var lr = cyl(0.02, 0.02, YB - 0.2, 6, pole); lr.position.set(lx, 0.3 + (YB - 0.2) / 2, -0.2 + dz); g.add(lr); });
    for (k = 0; k < 10; k++) { var rung = cyl(0.014, 0.014, 0.4, 5, pole); rung.rotation.x = Math.PI / 2; rung.position.set(lx, 0.6 + k * 0.3, -0.2); g.add(rung); }
    g.add(mech_rod(mch_v(PX + 0.17, 2.0, -0.2), mch_v(lx, 2.0, -0.2), 0.02, pole, 6));
    var hornM = std('#5B5F64', 0.5, 0.6, { side: THREE.DoubleSide });
    [-0.14, 0.14].forEach(function (dx) {
      var horn = new THREE.Mesh(new THREE.LatheBufferGeometry([[0.035, 0], [0.05, 0.18], [0.08, 0.3], [0.16, 0.4], [0.17, 0.42]].map(function (q) { return mch_v2(q[0], q[1]); }), 16), hornM);
      horn.rotation.x = Math.PI / 2; horn.position.set(-PX + dx, poleTop + 0.1, -0.05); g.add(horn);
    });
    var hbr = mech_bbox(0.5, 0.05, 0.12, darkM, 0.01); hbr.position.set(-PX, poleTop + 0.03, -0.2); g.add(hbr);
    
    var cond = cyl(0.025, 0.025, YB - 0.6, 6, pole); cond.position.set(-PX - 0.2, 0.9 + (YB - 0.6) / 2, -0.2); g.add(cond);
    var jb = mech_bbox(0.3, 0.4, 0.16, darkM, 0.02); jb.position.set(-PX - 0.2, 1.1, -0.05); g.add(jb);
    mech_mergeStatic(g);
    shade(g);
    lit.castShadow = false;
    var lastS = -1;
    var setDigit = function (list, d, val) {
      if (val < 0) return;
      var bits = mch_SEG[val], D = DIG[d], sp = D[2] / 6;
      for (var q = 0; q < mch_BULBS.length; q++) if (mch_BULBS[q].mask & bits) list.push(d * mch_BULBS.length + q);
    };
    var on = [];
    return {
      group: g, R: 3.8, lookY: 4.4, dist: rf(r, 16.5, 19), camH: [1.6, 2.4], face: true,
      close: { zoom: 0.42, el: 0.04, look: 0.8 },
      board: { team: team },
      update: function (ctx) {
        var t = ctx.t, s = Math.floor(t.sec % 60), key = t.days * 86400 + Math.floor(t.sec);
        if (key === lastS) return;
        lastS = key;
        var h12 = t.h % 12 === 0 ? 12 : t.h % 12, m = t.m, left = 60 - s, q = Math.floor(t.h / 6) + 1;
        on.length = 0;
        setDigit(on, 0, h12 >= 10 ? Math.floor(h12 / 10) : -1); setDigit(on, 1, h12 % 10);
        setDigit(on, 2, m >= 10 ? Math.floor(m / 10) : -1); setDigit(on, 3, m % 10);
        setDigit(on, 4, Math.floor(left / 60)); setDigit(on, 5, Math.floor((left % 60) / 10)); setDigit(on, 6, left % 10);
        setDigit(on, 7, q);
        var nd = DIG.length * mch_BULBS.length; on.push(nd, nd + 1);
        for (var j = 0; j < on.length; j++) {
          var p = pos[on[j]];
          dmy.position.set(p[0], YB + p[1], ZF + 0.05); dmy.updateMatrix(); lit.setMatrixAt(j, dmy.matrix);
        }
        lit.count = on.length; lit.instanceMatrix.needsUpdate = true;
      }
    };
  }

  // =====================================================================
  // 5. PUMPJACK
  // A beam pump, geared up right. The crank turns once a stroke; the
  // pitman arms pull the back of the walking beam down and the horse head
  // lifts, and the bridle rides the arc of the head so the polished rod
  // goes straight up and down into the stuffing box. The beam's angle is
  // solved from the linkage every frame. A counter bolted to the Samson
  // post rolls its number wheels over on the minute.
  // =====================================================================
  function mch_digitWheel(tex, rv, w, mat) {
    var pos = [], uv = [], idx = [], nor = [], n = 10, half = Math.PI / n;
    for (var k = 0; k < n; k++) {
      var a = -k * mch_TAU / n, a0 = a - half, a1 = a + half, v0 = 1 - (k + 1) / n, v1 = 1 - k / n, b = pos.length / 3;
      var y0 = rv * Math.sin(a0), z0 = rv * Math.cos(a0), y1 = rv * Math.sin(a1), z1 = rv * Math.cos(a1), ny = Math.sin(a), nz = Math.cos(a);
      pos.push(-w / 2, y0, z0, w / 2, y0, z0, w / 2, y1, z1, -w / 2, y1, z1);
      uv.push(0, v0 + 0.004, 1, v0 + 0.004, 1, v1 - 0.004, 0, v1 - 0.004);
      for (var q = 0; q < 4; q++) nor.push(0, ny, nz);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, mat));
    return grp;
  }
  function mch_pumpjack(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var paintK = Tt['Paint'] || 'Safety Yellow', ctrK = Tt['Counter'] || 'White Wheels', leaseK = Tt['Lease'] || 'PRESIDIO 317 No. 1';
    var paintHex = { 'Safety Yellow': '#D6A21E', 'Rig Red': '#8E2B22', 'Faded Blue': '#46698A', 'Tractor Green': '#3A7045' }[paintK] || '#D6A21E';
    var paint = mtl(paintHex, 'paint', 0.6, 0.25, 1.1), steel = heroMat(matName);
    var darkM = std('#1A1B1D', 0.5, 0.6), greaseM = std('#141312', 0.35, 0.5), concM = mtl('#A9A294', 'concrete', 0.95, 0, 1.6);
    var pipeM = mtl('#6F6A63', 'rust', 0.6, 0.6, 0.8), shinyM = mtl('#D5D8DC', 'brushed', 0.12, 1, 0.3);
    var i, k, a;
    // the linkage, in metres, in the beam's plane (x along the unit, y up)
    var O = mch_v2(0, 4.25), A1 = 3.0, A2 = 2.4, EQY = -0.3, Cc = mch_v2(-2.4, 1.62), RCR = 0.76;
    var reX = -A2, reY = EQY, RE = Math.hypot(reX, reY), BASE = Math.atan2(reY, reX);
    var LP = Math.hypot(O.x + reX - Cc.x, O.y + reY - Cc.y);
    var ZC = 0.5, ZP = 0.82, PERIOD = 6.4;
    // ---- pad, skid and the Samson post
    var pad = mech_bbox(6.6, 0.26, 2.7, concM, 0.03); pad.position.set(-1.55, 0.13, 0); g.add(pad);
    [-0.98, 0.98].forEach(function (z) { var sk = mch_ibeam(6.2, 0.3, 0.2, 0.02, 0.025, steel); sk.position.set(-1.5, 0.41, z); g.add(sk); });
    for (i = 0; i < 5; i++) { if (i === 1 || i === 2) continue; var cm = mch_ibeam(2.0, 0.18, 0.12, 0.015, 0.02, steel); cm.rotation.y = Math.PI / 2; cm.position.set(-4.3 + i * 1.3, 0.35, 0); g.add(cm); }
    var tubeG = mch_tubeGeo(0.085, 10);
    var sTop = mch_v(O.x, O.y - 0.34, 0);
    [-1, 1].forEach(function (sd) {
      var fb = mch_v(O.x + 0.95, 0.56, sd * 0.98);
      g.add(mch_span(mch_boxGeo(0.17), fb, mch_v(sTop.x + 0.05, sTop.y, sd * 0.16), steel));
      var bp = mech_bbox(0.34, 0.03, 0.34, steel, 0.006); bp.position.copy(fb).setY(0.575); g.add(bp);
    });
    var rb = mch_v(O.x - 1.45, 0.56, 0);
    g.add(mch_span(mch_boxGeo(0.16), rb, mch_v(sTop.x - 0.06, sTop.y, 0), steel));
    [1.2, 2.5].forEach(function (y) {
      var f = (y - 0.56) / (sTop.y - 0.56), xa = lerp(O.x + 0.95, sTop.x + 0.05, f), za = lerp(0.98, 0.16, f);
      g.add(mech_rod(mch_v(xa, y, za), mch_v(xa, y, -za), 0.035, steel, 6));
      g.add(mech_rod(mch_v(xa, y, za), mch_v(lerp(rb.x, sTop.x, f), y, 0), 0.03, steel, 6));
      g.add(mech_rod(mch_v(xa, y, -za), mch_v(lerp(rb.x, sTop.x, f), y, 0), 0.03, steel, 6));
    });
    g.add(mech_rod(mch_v(O.x + 0.95 - 0.04, 0.7, 0.9), mch_v(lerp(O.x + 0.95, sTop.x, 0.62), 2.5, -0.38), 0.022, steel, 6));
    g.add(mech_rod(mch_v(O.x + 0.95 - 0.04, 0.7, -0.9), mch_v(lerp(O.x + 0.95, sTop.x, 0.62), 2.5, 0.38), 0.022, steel, 6));
    // the saddle bearing on top of the post
    var saddle = mech_bbox(0.5, 0.2, 0.46, steel, 0.02); saddle.position.set(O.x, O.y - 0.26, 0); g.add(saddle);
    var brg = mech_zcyl(0.13, 0.5, darkM, 16); brg.position.set(O.x, O.y, 0); g.add(brg);
    // ---- gear reducer on its pedestal, and the motor
    var ped = mech_bbox(1.5, Cc.y - 0.48 - 0.72, 0.8, steel, 0.02); ped.position.set(Cc.x, (0.72 + Cc.y - 0.48) / 2, 0); g.add(ped);
    [-0.6, 0.6].forEach(function (x) { var cr = mch_ibeam(2.1, 0.16, 0.12, 0.015, 0.02, steel); cr.rotation.y = Math.PI / 2; cr.position.set(Cc.x + x, 0.64, 0); g.add(cr); });
    var gb = new THREE.Mesh(mech_extrude(mech_rrect(2.1, 0.96, 0.46), 0.66, 0.03), paint); gb.position.set(Cc.x + 0.1, Cc.y + 0.02, 0); g.add(gb);
    var seam = box(2.16, 0.03, 0.7, darkM); seam.position.set(Cc.x + 0.1, Cc.y + 0.02, 0); g.add(seam);
    var gbCap = mech_zcyl(0.2, 0.74, paint, 20); gbCap.position.set(Cc.x - 0.62, Cc.y + 0.1, 0); g.add(gbCap);
    var shaft = mech_zcyl(0.1, 2 * ZC + 0.18, darkM, 16); shaft.position.set(Cc.x, Cc.y, 0); g.add(shaft);
    var motor = new THREE.Group(); motor.position.set(-4.15, 1.02, -0.05); g.add(motor);
    motor.add(mech_zcyl(0.27, 0.62, std('#3E5B4B', 0.55, 0.4), 20));
    for (k = 0; k < 7; k++) { var fin = mech_zcyl(0.3, 0.02, std('#3E5B4B', 0.55, 0.4), 20); fin.position.z = -0.24 + k * 0.08; motor.add(fin); }
    var mjb = mech_bbox(0.2, 0.18, 0.2, darkM, 0.02); mjb.position.set(0, 0.34, 0); motor.add(mjb);
    var slide = mech_bbox(0.8, 0.36, 0.7, steel, 0.02); slide.position.set(-4.15, 0.74, 0); g.add(slide);
    var guard = new THREE.Mesh(mech_extrude(mch_shape([[-0.32, -0.3], [0.3, -0.3], [1.05, 0.2], [1.05, 0.72], [0.8, 0.8], [-0.32, 0.32]]), 0.14, 0.02), paint);
    guard.position.set(-4.15, 1.0, 0.33); g.add(guard);
    // ---- the fence round the crank
    var fM = mtl('#8A8C8F', 'rust', 0.55, 0.6, 0.8), fx0 = -4.75, fx1 = -0.95, fz = 1.45;
    var fpts = [[fx0, -fz], [fx1, -fz], [fx1, fz], [fx0, fz]];
    fpts.forEach(function (p) { var fp = cyl(0.035, 0.035, 1.1, 8, fM); fp.position.set(p[0], 0.81, p[1]); g.add(fp); });
    [[-1, 0.7], [-1, 1.3]].forEach(function (q) {
      for (var j = 0; j < 4; j++) {
        var p0 = fpts[j], p1 = fpts[(j + 1) % 4];
        if (j === 1) continue;                                          // open toward the wellhead for the pumper
        g.add(mech_rod(mch_v(p0[0], q[1], p0[1]), mch_v(p1[0], q[1], p1[1]), 0.025, fM, 6));
      }
    });
    var dg = mch_text(['DANGER', 'KEEP CLEAR', 'AUTOMATIC EQUIPMENT', 'MAY START AT ANY TIME'], { bg: '#F2EFE6', color: '#1A1A1A', font: FONT_SANS, height: 0.34, px: 50, pad: 0.3 });
    var dgs = mch_text('DANGER', { bg: '#B8201C', color: '#FFFFFF', font: FONT_SANS, height: 0.1, px: 50, pad: 0.2 });
    dg.position.set(-2.2, 1.0, fz + 0.03); g.add(dg); dgs.position.set(-2.2, 1.14, fz + 0.035); dgs.scale.x = dg.userData.w / dgs.userData.w; g.add(dgs);

    // ---- moving parts: cranks with counterweights, pitman arms, the beam
    var crankG = new THREE.Group(); crankG.position.set(Cc.x, Cc.y, 0); g.add(crankG);
    var weightM = mtl('#3B3D40', 'rust', 0.7, 0.5, 0.6);
    var ctr = mech_zcyl(0.2, 2 * ZC + 0.3, darkM, 16); crankG.add(ctr);
    [-1, 1].forEach(function (sd) {
      var arm = new THREE.Mesh(mech_extrude(mch_shape([[-0.28, -0.2], [0.02, -0.2], [RCR + 0.28, -0.13], [RCR + 0.28, 0.13], [0.02, 0.2], [-0.28, 0.2]]), 0.12, 0.012), paint);
      arm.position.z = sd * ZC; crankG.add(arm);
      var wS = new THREE.Shape(); wS.absarc(0, 0, 1.12, -0.36, 0.36, false); wS.absarc(0, 0, 0.5, 0.36, -0.36, true);
      var wt = new THREE.Mesh(mech_extrude(wS, 0.16, 0.02, 16), weightM); wt.position.z = sd * (ZC + 0.14); crankG.add(wt);
      for (k = 0; k < 3; k++) { var hole = mech_zcyl(0.05, 0.14, greaseM, 10); hole.position.set(RCR - 0.36 + k * 0.2, 0, sd * ZC); crankG.add(hole); }
      [0.6, 0.95].forEach(function (rr) { [-0.2, 0.2].forEach(function (aa) { var nt = mch_nut(0.045, 0.05, darkM); nt.rotation.x = Math.PI / 2; nt.position.set(Math.cos(aa) * rr, Math.sin(aa) * rr, sd * (ZC + 0.24)); crankG.add(nt); }); });
      var pin = mech_zcyl(0.07, ZP - ZC + 0.16, shinyM, 12); pin.position.set(RCR, 0, sd * (ZC + ZP) / 2); crankG.add(pin);
    });
    var pitG = [], pitGeo = mch_boxGeo(0.14, 0.1);
    [-1, 1].forEach(function (sd) {
      var pg = new THREE.Group(); pg.position.z = sd * ZP; g.add(pg);
      var bar = new THREE.Mesh(pitGeo, paint); bar.scale.y = LP; pg.add(bar);
      var b0 = mech_zcyl(0.13, 0.16, darkM, 14); pg.add(b0);
      var b1 = mech_zcyl(0.12, 0.16, darkM, 14); b1.position.y = LP; pg.add(b1);
      pitG.push(pg);
    });
    var beamG = new THREE.Group(); beamG.position.set(O.x, O.y, 0); g.add(beamG);
    var beam = mch_ibeam(A1 + A2 - 0.35, 0.5, 0.32, 0.03, 0.04, paint); beam.position.set((A1 - A2) / 2 - 0.35, 0.3, 0); beamG.add(beam);
    for (k = 0; k < 8; k++) { var st = box(0.02, 0.42, 0.28, paint); st.position.set(-A2 + 0.3 + k * (A1 + A2 - 1.2) / 7, 0.3, 0); beamG.add(st); }
    var cbrg = mech_bbox(0.48, 0.14, 0.4, darkM, 0.02); cbrg.position.set(0, 0.0, 0); beamG.add(cbrg);
    var eqBar = mech_zcyl(0.1, 2 * ZP + 0.2, paint, 12); eqBar.position.set(reX, reY, 0); beamG.add(eqBar);
    var eqBlk = mech_bbox(0.4, 0.34, 0.34, paint, 0.02); eqBlk.position.set(reX, reY + 0.16, 0); beamG.add(eqBlk);
    [-1, 1].forEach(function (sd) { var eb = mech_zcyl(0.12, 0.14, darkM, 12); eb.position.set(reX, reY, sd * ZP); beamG.add(eb); });
    // the horse head: its front is an arc about the saddle bearing
    var hA0 = -0.46, hA1 = 0.42, hp = [];
    for (k = 0; k <= 16; k++) { a = lerp(hA0, hA1, k / 16); hp.push([A1 * Math.cos(a), A1 * Math.sin(a)]); }
    hp.push([A1 - 0.85, A1 * Math.sin(hA1) - 0.05], [A1 - 1.5, 0.62], [A1 - 1.5, 0.06], [A1 * Math.cos(hA0) - 0.55, A1 * Math.sin(hA0) + 0.1]);
    var hh = new THREE.Mesh(mech_extrude(mch_shape(hp), 0.34, 0.03, 24), paint); beamG.add(hh);
    [-1, 1].forEach(function (sd) {
      var ap = [];
      for (k = 0; k <= 20; k++) { a = lerp(hA0 + 0.02, hA1 - 0.02, k / 20); ap.push(mch_v((A1 + 0.03) * Math.cos(a), (A1 + 0.03) * Math.sin(a), sd * 0.13)); }
      beamG.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(ap), 30, 0.03, 6, false), darkM));
    });
    for (k = 0; k < 5; k++) { a = lerp(hA0 + 0.12, hA1 - 0.1, k / 4); var hb = mch_nut(0.035, 0.04, darkM); hb.rotation.x = Math.PI / 2; hb.position.set((A1 - 0.25) * Math.cos(a), (A1 - 0.25) * Math.sin(a), 0.19); beamG.add(hb); }
    // ---- bridle, carrier bar, polished rod and the wellhead
    var WX = O.x + A1, LB = 1.55, wireGeo = mch_tubeGeo(0.013, 6), bridle = [];
    [-0.08, 0.08].forEach(function (z) { var wm = new THREE.Mesh(wireGeo, darkM); wm.position.set(WX + 0.02, 0, z); g.add(wm); bridle.push(wm); });
    var carrier = new THREE.Group(); g.add(carrier);
    var cbar = mech_bbox(0.14, 0.09, 0.42, darkM, 0.01); carrier.add(cbar);
    var rodM = new THREE.Mesh(mch_tubeGeo(0.022, 10), shinyM); rodM.scale.y = 3.1; rodM.position.set(WX + 0.02, -2.85, 0); carrier.add(rodM);
    var clampR = cyl(0.06, 0.06, 0.12, 10, darkM); clampR.position.set(WX + 0.02, 0.12, 0); carrier.add(clampR);
    cbar.position.set(WX + 0.02, 0, 0);
    var well = new THREE.Group(); well.position.set(WX + 0.02, 0, 0); g.add(well);
    var cellar = mech_bbox(1.5, 0.16, 1.5, concM, 0.02); cellar.position.y = 0.08; well.add(cellar);
    var wp = [[0.001, 0.16], [0.26, 0.16], [0.26, 0.26], [0.14, 0.28], [0.14, 0.52], [0.21, 0.52], [0.21, 0.6], [0.1, 0.62], [0.1, 0.9], [0.16, 0.9], [0.16, 1.02], [0.09, 1.05], [0.09, 1.28], [0.07, 1.32], [0.07, 1.46], [0.001, 1.46]];
    well.add(new THREE.Mesh(new THREE.LatheBufferGeometry(wp.map(function (q) { return mch_v2(q[0], q[1]); }), 18), pipeM));
    var tee = mech_zcyl(0.09, 0.7, pipeM, 12); tee.position.y = 0.76; well.add(tee);
    var flow = [mch_v(0, 0.76, 0.35), mch_v(0, 0.76, 0.9), mch_v(0.25, 0.7, 1.1), mch_v(1.2, 0.35, 1.2), mch_v(3.0, 0.2, 1.3)];
    well.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(flow), 30, 0.07, 8, false), pipeM));
    var valve = mech_zcyl(0.12, 0.16, std('#8E2B22', 0.6, 0.3), 12); valve.position.set(0, 0.76, 0.6); well.add(valve);
    var hw = new THREE.Mesh(new THREE.TorusBufferGeometry(0.12, 0.014, 6, 18), std('#8E2B22', 0.6, 0.3)); hw.position.set(0, 0.95, 0.6); hw.rotation.x = Math.PI / 2; well.add(hw);
    var vst = cyl(0.015, 0.015, 0.17, 6, darkM); vst.position.set(0, 0.86, 0.6); well.add(vst);
    var gauge = new THREE.Group(); gauge.position.set(0.18, 1.1, 0.02); well.add(gauge);
    var gtx = canvasTex(128, 128, function (gc) { gc.fillStyle = '#F2EFE6'; gc.beginPath(); gc.arc(64, 64, 62, 0, mch_TAU); gc.fill(); gc.strokeStyle = '#222'; gc.lineWidth = 3; for (var q = 0; q < 11; q++) { var aa = (-135 + q * 27) * D2R; gc.beginPath(); gc.moveTo(64 + Math.sin(aa) * 48, 64 - Math.cos(aa) * 48); gc.lineTo(64 + Math.sin(aa) * 58, 64 - Math.cos(aa) * 58); gc.stroke(); } gc.strokeStyle = '#B8201C'; gc.lineWidth = 5; gc.beginPath(); gc.moveTo(64, 64); gc.lineTo(64 + Math.sin(0.5) * 44, 64 - Math.cos(0.5) * 44); gc.stroke(); });
    var gf = new THREE.Mesh(new THREE.CircleBufferGeometry(0.07, 20), new THREE.MeshStandardMaterial({ map: gtx, roughness: 0.3 })); gf.position.z = 0.035; gauge.add(gf);
    var gcase = mech_zcyl(0.078, 0.06, shinyM, 20); gauge.add(gcase);
    var gst = cyl(0.012, 0.012, 0.14, 6, pipeM); gst.rotation.z = Math.PI / 2; gst.position.set(-0.1, 0, -0.02); gauge.add(gst);
    // ---- the counter: four number wheels in a box on the Samson post
    var ctrG = new THREE.Group(); ctrG.position.set(O.x + 0.52, 1.72, 1.02); g.add(ctrG);
    var ink = ctrK === 'Brass Wheels' ? '#2A1E0E' : '#141414', wface = ctrK === 'Brass Wheels' ? '#C9A45C' : '#EFEBE0';
    var wTex = canvasTex(128, 1280, function (gc) {
      gc.fillStyle = wface; gc.fillRect(0, 0, 128, 1280);
      gc.fillStyle = ink; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '700 104px ' + FONT_MONO;
      for (var q = 0; q < 10; q++) { gc.fillText(String(q), 64, q * 128 + 68); gc.fillStyle = 'rgba(0,0,0,0.18)'; gc.fillRect(0, q * 128, 128, 3); gc.fillStyle = ink; }
    });
    var wM = new THREE.MeshStandardMaterial({ map: wTex, roughness: ctrK === 'Brass Wheels' ? 0.35 : 0.5, metalness: ctrK === 'Brass Wheels' ? 0.6 : 0 });
    var RV = 0.13, WW = 0.14, wheels = [], wxs = [-0.33, -0.17, 0.09, 0.25];
    wxs.forEach(function (x) {
      var wh = mch_digitWheel(wTex, RV, WW, wM); wh.position.set(x, 0, -0.05); ctrG.add(wh);
      [-1, 1].forEach(function (sd) { var sdisc = new THREE.Mesh(new THREE.CylinderBufferGeometry(RV * 0.99, RV * 0.99, 0.006, 24), darkM); sdisc.rotation.z = Math.PI / 2; sdisc.position.x = sd * WW / 2; wh.add(sdisc); });
      wheels.push({ g: wh, cur: 0 });
    });
    var ctrBody = paint.clone();
    var box0 = mech_bbox(0.95, 0.44, 0.34, ctrBody, 0.03); box0.position.z = -0.12; ctrG.add(box0);
    var winS = mech_rrect(0.92, 0.42, 0.04), winHole = new THREE.Path(); winHole.moveTo(-0.42, -0.1); winHole.lineTo(0.34, -0.1); winHole.lineTo(0.34, 0.1); winHole.lineTo(-0.42, 0.1); winHole.lineTo(-0.42, -0.1);
    winS.holes.push(winHole);
    var bez = new THREE.Mesh(mech_extrude(winS, 0.03, 0.006), darkM); bez.position.set(0, 0, 0.08); ctrG.add(bez);
    var dotM = std(wface, 0.5, 0.2);
    [0.035, -0.035].forEach(function (y) { var dt = sph(0.014, dotM, 8, 6); dt.position.set(-0.04, y, 0.1); ctrG.add(dt); });
    var glass = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.76, 0.2), new THREE.MeshStandardMaterial({ color: C('#CFE0E4'), roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false }));
    glass.position.set(-0.04, 0, 0.098); ctrG.add(glass);
    var cl = mch_text('HRS    MIN', { color: '#F2EFE6', font: FONT_MONO, height: 0.05, px: 40, pad: 0.1, spacing: 0.1 }); cl.position.set(-0.04, -0.15, 0.097); ctrG.add(cl);
    [-0.38, 0.38].forEach(function (x) { var sc = mech_dome(0.018, darkM); sc.position.set(x, 0.15, 0.098); ctrG.add(sc); var sc2 = sc.clone(); sc2.position.y = -0.15; ctrG.add(sc2); });
    ctrG.add(mech_rod(mch_v(-0.2, -0.2, -0.15), mch_v(-0.2, -0.46, -0.72), 0.02, steel, 6));
    ctrG.add(mech_rod(mch_v(0.2, -0.2, -0.15), mch_v(0.2, -0.46, -0.72), 0.02, steel, 6));
    ctrG.add(mech_rod(mch_v(-0.2, 0.2, -0.28), mch_v(-0.2, 0.2, -0.62), 0.02, steel, 6));
    var lever = new THREE.Group(); lever.position.set(0.5, 0.1, -0.12); ctrG.add(lever);
    var lvb = box(0.03, 0.2, 0.03, darkM); lvb.position.y = 0.1; lever.add(lvb);
    var lvRod = new THREE.Mesh(mch_tubeGeo(0.016, 6), darkM); g.add(lvRod);
    // the lease sign
    var ls = new THREE.Group(); ls.position.set(WX + 1.35, 0, 1.25); g.add(ls);
    var lsp = cyl(0.04, 0.04, 1.6, 8, pipeM); lsp.position.y = 0.8; ls.add(lsp);
    var lsT = mch_text(['SLOW TIME OPERATING CO', 'LEASE  ' + leaseK, 'PRESIDIO COUNTY TX', 'RRC 317'], { bg: '#EDEAE1', color: '#1C1C1C', font: FONT_SANS, height: 0.42, px: 44, pad: 0.35 });
    lsT.position.set(0, 1.45, 0.026); ls.add(lsT);
    var lsB = mech_bbox(lsT.userData.w + 0.03, 0.45, 0.04, darkM, 0.006); lsB.position.y = 1.45; ls.add(lsB);
    // a light on the post for the counter at night
    var ctrLampM = W.glow(glowMat('#FFE3B4', 0.1), 0.05, 2.0), cLamp = sph(0.04, ctrLampM, 8, 6); cLamp.position.set(0, 0.32, 0.12); ctrG.add(cLamp);
    var cHood = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.03, 0.08, 0.06, 12, 1, true), std('#1A1B1D', 0.5, 0.6, { side: THREE.DoubleSide })); cHood.position.set(0, 0.35, 0.12); ctrG.add(cHood);
    W.lamp('#FFE3B4', 0.9, 4, mch_v(0, 0.3, 0.5), ctrG);
    W.lamp('#FFD9A0', 1.0, 10, mch_v(WX - 1.0, 5.4, 1.5), g);
    [beamG, crankG, ctrG, well, ls].forEach(mech_mergeStatic);
    mech_mergeStatic(g);
    shade(g);
    // ---- solve the linkage
    var P = new THREE.Vector2(), E = new THREE.Vector2(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), vL = new THREE.Vector3();
    var solve = function (phi) {
      P.set(Cc.x + RCR * Math.cos(phi), Cc.y + RCR * Math.sin(phi));
      var dx = P.x - O.x, dy = P.y - O.y, d = Math.hypot(dx, dy);
      var aa = (RE * RE - LP * LP + d * d) / (2 * d), hh2 = Math.sqrt(Math.max(0, RE * RE - aa * aa));
      var mx = O.x + aa * dx / d, my = O.y + aa * dy / d;
      var e1x = mx + hh2 * dy / d, e1y = my - hh2 * dx / d, e2x = mx - hh2 * dy / d, e2y = my + hh2 * dx / d;
      if (e1y > e2y) E.set(e1x, e1y); else E.set(e2x, e2y);
      var th = Math.atan2(E.y - O.y, E.x - O.x) - BASE;
      return Math.atan2(Math.sin(th), Math.cos(th));                  // about -0.32 to 0.34 rad
    };
    var lastMin = null, ROLL = 0.7;
    var setWheel = function (w, prev, target, u) {
      // roll from the digit before to this one
      var e = mch_ease(u);
      var from = -prev * mch_TAU / 10, to = -target * mch_TAU / 10;
      if (target === 0 && prev === 9) to = from - mch_TAU / 10;
      w.g.rotation.x = lerp(from, to, e);
    };
    var dg = [0, 0, 0, 0], pd = [0, 0, 0, 0];
    return {
      group: g, R: 5.0, lookY: 2.5, dist: rf(r, 14, 16), camH: [1.6, 2.4], face: true, shadowPad: 7,
      close: { zoom: 0.26, el: 0.0, look: 1.72 - 2.5 },
      update: function (ctx) {
        var t = ctx.t, phi = -mch_cyc(ctx, PERIOD) * mch_TAU;
        var th = solve(phi);
        crankG.rotation.z = phi;
        beamG.rotation.z = th;
        for (var j = 0; j < 2; j++) { pitG[j].position.x = P.x; pitG[j].position.y = P.y; pitG[j].rotation.z = Math.atan2(E.y - P.y, E.x - P.x) - Math.PI / 2; }
        var cy = O.y - LB + A1 * th;                                   // the bridle rides the arc
        carrier.position.y = cy;
        for (j = 0; j < 2; j++) { bridle[j].position.y = cy; bridle[j].scale.y = O.y - cy; }
        // the counter's rocker follows the beam through a link
        var ps = -th * 1.6; lever.rotation.z = ps;
        var cth = Math.cos(th), sth = Math.sin(th);
        vA.set(O.x + 0.95 * cth - 0.05 * sth, O.y + 0.95 * sth + 0.05 * cth, 0.2);
        vB.set(ctrG.position.x + lever.position.x - 0.2 * Math.sin(ps), ctrG.position.y + lever.position.y + 0.2 * Math.cos(ps), ctrG.position.z + lever.position.z);
        mch_aim(lvRod, vB, vA);
        // HH:MM on the wheels; they roll on the minute like an odometer
        var s = t.sec % 60, u = ctx.snap ? 1 : clamp(s / ROLL, 0, 1);
        var pm = t.m - 1, ph = t.h; if (pm < 0) { pm = 59; ph = (t.h + 23) % 24; }
        dg[0] = Math.floor(t.h / 10); dg[1] = t.h % 10; dg[2] = Math.floor(t.m / 10); dg[3] = t.m % 10;
        pd[0] = Math.floor(ph / 10); pd[1] = ph % 10; pd[2] = Math.floor(pm / 10); pd[3] = pm % 10;
        for (j = 0; j < 4; j++) {
          if (u < 1 && pd[j] !== dg[j]) setWheel(wheels[j], pd[j], dg[j], u);
          else wheels[j].g.rotation.x = -dg[j] * mch_TAU / 10;
        }
      }
    };
  }

  // =====================================================================
  // 6. WINDMILL CLOCK
  // A farm windmill on a lattice tower over a stock tank. The wheel turns
  // with the token's wind and the tail vane holds it into the wind; the
  // back gearing works the pump rod once for every 3.29 turns of the
  // wheel. A clock hangs under the platform, facing the road.
  // =====================================================================
  function mch_windmill(W, matName) {
    var r = W.r, g = new THREE.Group(), Tt = W.P.clockTraits || {};
    var wheelK = Tt['Wheel'] || 'Galvanized', tailK = Tt['Tail'] || 'Plain', tankK = Tt['Tank'] || 'Galvanized';
    var tower = heroMat(matName), darkM = std('#1C1D20', 0.5, 0.6), concM = mtl('#A9A294', 'concrete', 0.95, 0, 1.6);
    var galv = mtl('#B9BEC2', 'brushed', 0.42, 0.85, 0.6), woodM = mtl('#8A7157', 'wood', 0.95, 0, 0.7);
    var HT = 9.2, B0 = 1.55, B1 = 0.26, HH = HT + 1.95, i, k, a;
    var half = function (y) { return lerp(B0, B1, y / HT); };
    // ---- the tower: four legs of angle iron, girts, rod bracing, a ladder
    var angG = mch_angleGeo(0.08, 0.008), corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    corners.forEach(function (q, j) {
      var a0 = mch_v(q[0] * B0, 0.3, q[1] * B0), a1 = mch_v(q[0] * B1, HT, q[1] * B1);
      g.add(mch_span(angG, a0, a1, tower, Math.PI * 0.75 - j * Math.PI / 2));
      var ft = cyl(0.26, 0.3, 0.42, 10, concM); ft.position.set(a0.x, 0.12, a0.z); g.add(ft);
      var anc = cyl(0.03, 0.03, 0.12, 6, darkM); anc.position.set(a0.x * 1.04, 0.36, a0.z * 1.04); g.add(anc);
    });
    var girtY = [1.25, 3.05, 4.75, 6.3, 7.7, HT - 0.05];
    var angS = mch_angleGeo(0.055, 0.006);
    for (k = 0; k < girtY.length; k++) {
      var y = girtY[k], hb = half(y);
      for (var j = 0; j < 4; j++) {
        var p0 = corners[j], p1 = corners[(j + 1) % 4];
        g.add(mch_span(angS, mch_v(p0[0] * hb, y, p0[1] * hb), mch_v(p1[0] * hb, y, p1[1] * hb), tower, 0));
        if (k === 0) continue;
        var yl = girtY[k - 1], hl = half(yl);
        g.add(mech_rod(mch_v(p0[0] * hl, yl, p0[1] * hl), mch_v(p1[0] * hb, y, p1[1] * hb), 0.009, darkM, 4));
        g.add(mech_rod(mch_v(p1[0] * hl, yl, p1[1] * hl), mch_v(p0[0] * hb, y, p0[1] * hb), 0.009, darkM, 4));
      }
    }
    for (k = 1; k < girtY.length; k++) {
      var yb = girtY[k - 1], yt2 = girtY[k], hb2 = half(yb), ht2 = half(yt2);
      for (j = 0; j < 4; j++) {
        var c0 = corners[j], c1 = corners[(j + 1) % 4];
        // the bracing rods from 0.3 to the first girt
        if (k === 1) { var hl0 = half(0.3); g.add(mech_rod(mch_v(c0[0] * hl0, 0.3, c0[1] * hl0), mch_v(c1[0] * hb2, yb, c1[1] * hb2), 0.009, darkM, 4)); g.add(mech_rod(mch_v(c1[0] * hl0, 0.3, c1[1] * hl0), mch_v(c0[0] * hb2, yb, c0[1] * hb2), 0.009, darkM, 4)); }
      }
    }
    // ladder up the front right leg
    var lq = corners[0], lOut = mch_v(lq[0], 0, lq[1]).normalize();
    var lside = mch_v(lq[1], 0, -lq[0]).normalize();
    var la0 = mch_v(lq[0] * B0, 0.3, lq[1] * B0).addScaledVector(lOut, 0.18), la1 = mch_v(lq[0] * B1, HT, lq[1] * B1).addScaledVector(lOut, 0.18);
    [-0.2, 0.2].forEach(function (sd) { g.add(mech_rod(la0.clone().addScaledVector(lside, sd), la1.clone().addScaledVector(lside, sd), 0.016, tower, 5)); });
    var nR = 28;
    for (k = 1; k < nR; k++) { var lp = la0.clone().lerp(la1, k / nR); g.add(mech_rod(lp.clone().addScaledVector(lside, -0.2), lp.clone().addScaledVector(lside, 0.2), 0.011, tower, 5)); }
    // ---- the platform: planks on angle iron, the mast up through it
    var deckY = HT + 0.04, DW = 1.05;
    for (k = 0; k < 8; k++) {
      var pl = mech_bbox(2 * DW, 0.04, 0.24, woodM, 0.006); pl.position.set(0, deckY, -DW + 0.13 + k * 0.261); pl.rotation.y = rf(r, -0.008, 0.008);
      if (k === 3 || k === 4) { var pa = mech_bbox(DW - 0.12, 0.04, 0.24, woodM, 0.006); pa.position.set(-(DW + 0.12) / 2 - 0.0, deckY, pl.position.z); g.add(pa); var pb = pa.clone(); pb.position.x = (DW + 0.12) / 2; g.add(pb); continue; }
      g.add(pl);
    }
    [[-1, 0], [1, 0]].forEach(function (q) { g.add(mch_span(angS, mch_v(q[0] * DW, deckY - 0.08, -DW), mch_v(q[0] * DW, deckY - 0.08, DW), tower, 0)); });
    corners.forEach(function (q) { g.add(mech_rod(mch_v(q[0] * B1, HT - 0.02, q[1] * B1), mch_v(q[0] * DW * 0.95, deckY - 0.06, q[1] * DW * 0.95), 0.02, tower, 5)); });
    var mast = cyl(0.075, 0.075, HH - (HT - 2.2), 14, galv); mast.position.y = (HH + HT - 2.2) / 2; g.add(mast);
    [HT - 2.1, HT - 0.9].forEach(function (y) { var hb3 = half(y); corners.forEach(function (q) { g.add(mech_rod(mch_v(0, y, 0), mch_v(q[0] * hb3, y, q[1] * hb3), 0.012, darkM, 4)); }); });
    // ---- the clock, hung under the front of the platform
    var RC = 0.58, cz = DW + 0.12, cyC = HT - 0.72;
    var clockG = new THREE.Group(); clockG.position.set(0, cyC, cz); g.add(clockG);
    var cface = canvasTex(1024, 1024, function (gc, S) {
      var c = S / 2, rr = seedRng(W.P.seed + 5);
      gc.fillStyle = '#EEEAE0'; gc.fillRect(0, 0, S, S);
      for (i = 0; i < 90; i++) { var x = rr() * S, y = rr() * S, len = 40 + rr() * 200, sg = gc.createLinearGradient(0, y, 0, y + len); sg.addColorStop(0, 'rgba(120,70,40,' + (0.08 + rr() * 0.18) + ')'); sg.addColorStop(1, 'rgba(120,70,40,0)'); gc.fillStyle = sg; gc.fillRect(x, y, 3 + rr() * 5, len); }
      gc.fillStyle = '#16171A';
      for (var m = 0; m < 60; m++) { gc.save(); gc.translate(c, c); gc.rotate(m / 60 * mch_TAU); if (m % 5) gc.fillRect(-4, -c * 0.93, 8, 26); else gc.fillRect(-11, -c * 0.93, 22, 66); gc.restore(); }
      gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.font = '800 132px ' + FONT_SANS;
      for (var h = 1; h <= 12; h++) { a = h / 12 * mch_TAU; gc.fillText(String(h), c + Math.sin(a) * c * 0.66, c - Math.cos(a) * c * 0.66 + 6); }
      gc.font = '700 34px ' + FONT_MONO; gc.fillText('WIND AND HANDS', c, c * 1.38);
      gc.font = '700 30px ' + FONT_MONO; gc.fillText('MARFA TX', c, c * 0.62);
    });
    var cfM = new THREE.MeshStandardMaterial({ map: cface, roughness: 0.55, emissive: C('#FFF1D8'), emissiveMap: cface, emissiveIntensity: 0 }); W.glow(cfM, 0, 0.45);
    var cfc = new THREE.Mesh(new THREE.CircleBufferGeometry(RC, 72), cfM); cfc.position.z = 0.074; clockG.add(cfc);
    var cdrum = mech_zcyl(RC + 0.05, 0.14, galv, 64); clockG.add(cdrum);
    var cbz = new THREE.Mesh(new THREE.TorusBufferGeometry(RC + 0.03, 0.035, 8, 64), tower); cbz.position.z = 0.078; clockG.add(cbz);
    mch_boltCircle(clockG, 12, RC + 0.03, 0.112, 0.014, darkM, 0.13);
    var chM = std('#131417', 0.4, 0.5);
    var chh = mech_hand({ style: 'spade', L: RC * 0.58, w: 0.045, tail: 0.1, th: 0.016, spade: 0.05 }, chM); chh.position.z = 0.088; clockG.add(chh);
    var cmh = mech_hand({ style: 'spade', L: RC * 0.86, w: 0.034, tail: 0.13, th: 0.016, spade: 0.038 }, chM); cmh.position.z = 0.106; clockG.add(cmh);
    var csM = std('#B32A1E', 0.4, 0.3), csh = mech_hand({ style: 'baton', L: RC * 0.9, w: 0.012, tail: 0.14, th: 0.008 }, csM); csh.position.z = 0.122; clockG.add(csh);
    var chub = mech_dome(0.04, chM); chub.position.z = 0.13; clockG.add(chub);
    // two hangers from the deck and two struts back to the tower
    [-1, 1].forEach(function (sd) {
      g.add(mch_span(angS, mch_v(sd * 0.42, deckY - 0.04, cz - 0.1), mch_v(sd * 0.42, cyC - 0.2, cz - 0.1), tower, Math.PI));
      var hb4 = half(cyC);
      g.add(mech_rod(mch_v(sd * 0.42, cyC, cz - 0.1), mch_v(sd * hb4, cyC, hb4), 0.02, tower, 5));
    });
    var cbulbM = W.glow(glowMat('#FFE6BC', 0.1), 0.05, 2.0), cbulb = sph(0.04, cbulbM, 8, 6); cbulb.position.set(0, deckY - 0.09, cz + 0.36); g.add(cbulb);
    g.add(mech_rod(mch_v(0, deckY - 0.05, DW), mch_v(0, deckY - 0.05, cz + 0.36), 0.012, darkM, 5));
    var cgd = new THREE.Mesh(new THREE.ConeBufferGeometry(0.09, 0.08, 12, 1, true), std('#1C1D20', 0.5, 0.6, { side: THREE.DoubleSide })); cgd.position.set(0, deckY - 0.06, cz + 0.36); g.add(cgd);
    W.lamp('#FFE2B2', 1.2, 4, mch_v(0, cyC + 0.3, cz + 0.8), g);
    // ---- the head: turntable, gear case, wheel, tail
    var headG = new THREE.Group(); headG.position.y = HH; g.add(headG);
    var tt = cyl(0.16, 0.16, 0.14, 16, galv); tt.position.y = -0.05; headG.add(tt);
    var gcase = new THREE.Mesh(mech_extrude(mech_rrect(0.46, 0.5, 0.16), 0.36, 0.03), galv); gcase.rotation.y = Math.PI / 2; gcase.position.set(0, 0.24, 0.02); headG.add(gcase);
    var hood = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.2, 0.22, 0.56, 16, 1, false, 0, Math.PI), galv); hood.rotation.set(Math.PI / 2, 0, Math.PI / 2); hood.position.set(0, 0.48, 0.02); headG.add(hood);
    var oilc = cyl(0.03, 0.03, 0.06, 8, darkM); oilc.position.set(0, 0.72, -0.1); headG.add(oilc);
    var mshaft = mech_zcyl(0.04, 0.5, darkM, 10); mshaft.position.set(0, 0.28, 0.42); headG.add(mshaft);
    var wheelG = new THREE.Group(); wheelG.position.set(0, 0.28, 0.66); headG.add(wheelG);
    var R0 = 0.52, R1 = 1.52, NB = 18;
    var bladeGeo = (function () {
      var pos = [], idx = [], NU = 4, NV = 3;
      for (var u = 0; u <= NU; u++) for (var v = 0; v <= NV; v++) {
        var rr = lerp(R0, R1, u / NU), w = lerp(0.19, 0.44, u / NU) / 2, cv = (v / NV) * 2 - 1;
        var x = cv * w, z = (cv * cv - 1) * 0.022, p = 0.62;
        pos.push(x * Math.cos(p) - 0 * Math.sin(p), rr, x * Math.sin(p) + z);
      }
      for (u = 0; u < NU; u++) for (v = 0; v < NV; v++) { var q0 = u * (NV + 1) + v, q1 = q0 + NV + 1; idx.push(q0, q1, q0 + 1, q0 + 1, q1, q1 + 1); }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    })();
    var bladeA = wheelK === 'Weathered' ? mtl('#7E5A3E', 'rust', 0.75, 0.4, 0.5) : wheelK === 'Red and White' ? mtl('#A3281F', 'paint', 0.55, 0.2, 0.6) : mtl('#C4C8CC', 'brushed', 0.4, 0.85, 0.5);
    var bladeB = wheelK === 'Red and White' ? mtl('#EDE9E0', 'paint', 0.55, 0.1, 0.6) : bladeA;
    bladeA.side = THREE.DoubleSide; bladeB.side = THREE.DoubleSide;
    for (k = 0; k < NB; k++) { var bl = new THREE.Mesh(bladeGeo, k % 2 ? bladeB : bladeA); bl.rotation.z = k / NB * mch_TAU; wheelG.add(bl); }
    [R0, (R0 + R1) / 2 + 0.05, R1 - 0.04].forEach(function (rr, j2) { var rim = new THREE.Mesh(new THREE.TorusBufferGeometry(rr, j2 === 2 ? 0.018 : 0.014, 5, 72), tower); rim.position.z = -0.03; wheelG.add(rim); });
    for (k = 0; k < 6; k++) { a = k / 6 * mch_TAU; wheelG.add(mech_rod(mch_v(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.16), mch_v(Math.cos(a) * (R1 - 0.04), Math.sin(a) * (R1 - 0.04), -0.03), 0.014, tower, 5)); wheelG.add(mech_rod(mch_v(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.1), mch_v(Math.cos(a) * R0, Math.sin(a) * R0, -0.03), 0.012, tower, 5)); }
    var hubM = mech_zcyl(0.1, 0.3, galv, 14); hubM.position.z = -0.03; wheelG.add(hubM);
    var hubC = mech_dome(0.1, galv); hubC.position.z = 0.12; wheelG.add(hubC);
    mech_mergeStatic(wheelG);
    // the tail: a boom of two angles and a vane
    var tailG = new THREE.Group(); tailG.position.set(0, 0.3, -0.18); headG.add(tailG);
    var TL = 2.5, vane0 = TL - 0.1;
    [-0.09, 0.09].forEach(function (x) { tailG.add(mch_span(angS, mch_v(x, 0.1, 0), mch_v(x * 0.2, 0.28, -TL + 0.4), tower, Math.PI / 4)); });
    tailG.add(mech_rod(mch_v(0, -0.1, 0), mch_v(0, 0.24, -TL + 0.4), 0.012, darkM, 4));
    var vaneTex = canvasTex(512, 256, function (gc) {
      gc.fillStyle = '#B7BCC0'; gc.fillRect(0, 0, 512, 256);
      var rr = seedRng(W.P.seed + 11);
      for (i = 0; i < 26; i++) { gc.fillStyle = 'rgba(0,0,0,0.06)'; gc.fillRect(i * 20, 0, 2, 256); }
      for (i = 0; i < 40; i++) { var x = rr() * 512, y = rr() * 256, sg2 = gc.createLinearGradient(0, y, 0, y + 60); sg2.addColorStop(0, 'rgba(120,64,30,0.35)'); sg2.addColorStop(1, 'rgba(120,64,30,0)'); gc.fillStyle = sg2; gc.fillRect(x, y, 3, 60); }
      if (tailK === 'Lone Star') {
        gc.fillStyle = '#A3281F'; gc.beginPath();
        for (var q = 0; q < 10; q++) { var ra = q % 2 ? 42 : 100, an = -Math.PI / 2 + q * Math.PI / 5; gc.lineTo(290 + Math.cos(an) * ra, 132 + Math.sin(an) * ra); }
        gc.closePath(); gc.fill();
      } else if (tailK === '317') {
        gc.fillStyle = '#1C1D20'; gc.font = '900 150px ' + FONT_SANS; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText('317', 280, 136);
      }
    });
    var vaneS = mch_shape([[0, -0.32], [1.62, -0.52], [1.62, 0.52], [0, 0.32]]);
    var vgeo = new THREE.ShapeBufferGeometry(vaneS); var vuv = vgeo.attributes.uv, vp = vgeo.attributes.position;
    for (k = 0; k < vuv.count; k++) vuv.setXY(k, vp.getX(k) / 1.62, (vp.getY(k) + 0.52) / 1.04);
    var vM = new THREE.MeshStandardMaterial({ map: vaneTex, roughness: 0.5, metalness: 0.6 });
    var vgeoB = new THREE.ShapeBufferGeometry(mch_shape([[-1.62, -0.52], [0, -0.32], [0, 0.32], [-1.62, 0.52]])), vuvB = vgeoB.attributes.uv, vpB = vgeoB.attributes.position;
    for (k = 0; k < vuvB.count; k++) vuvB.setXY(k, (vpB.getX(k) + 1.62) / 1.62, (vpB.getY(k) + 0.52) / 1.04);
    var vmA = new THREE.Mesh(vgeo, vM); vmA.rotation.y = Math.PI / 2; vmA.position.set(0.006, 0.28, -vane0 + 0.1); tailG.add(vmA);
    var vmB = new THREE.Mesh(vgeoB, vM); vmB.rotation.y = -Math.PI / 2; vmB.position.set(-0.006, 0.28, -vane0 + 0.1); tailG.add(vmB);
    var vf = [[0, -0.32], [1.62, -0.52], [1.62, 0.52], [0, 0.32]];
    for (k = 0; k < 4; k++) { var f0 = vf[k], f1 = vf[(k + 1) % 4]; tailG.add(mech_rod(mch_v(0, 0.28 + f0[1], -vane0 + 0.1 - f0[0]), mch_v(0, 0.28 + f1[1], -vane0 + 0.1 - f1[0]), 0.014, tower, 5)); }
    tailG.add(mech_rod(mch_v(0, 0.28, -vane0 + 0.1), mch_v(0, 0.28, -vane0 - 1.52), 0.012, tower, 5));
    // pump rod down the middle, the pump, and the pipe to the tank
    var prod = new THREE.Mesh(mch_tubeGeo(0.022, 6), woodM); prod.scale.y = HT - 2.4 - 0.9; prod.position.set(0, 0.9, 0); g.add(prod);
    var pumpG = new THREE.Group(); g.add(pumpG);
    var pst = cyl(0.07, 0.08, 0.95, 12, pipeMat()); pst.position.y = 0.48; pumpG.add(pst);
    var ph2 = cyl(0.09, 0.09, 0.12, 12, pipeMat()); ph2.position.y = 0.96; pumpG.add(ph2);
    function pipeMat() { return mtl('#6E6862', 'rust', 0.6, 0.55, 0.7); }
    var TR = tankK === 'Stone' ? 2.1 : 1.95, TX = 1.55 + TR + 0.75, TZ = 1.35, TH = tankK === 'Stone' ? 0.72 : 0.62;
    var toTank = mch_v(TX, 0, TZ).normalize();
    var spoutEnd = mch_v(TX - toTank.x * (TR - 0.28), TH + 0.08, TZ - toTank.z * (TR - 0.28));
    var pp = [mch_v(0, 0.86, 0), mch_v(toTank.x * 0.5, 0.86, toTank.z * 0.5), mch_v(spoutEnd.x - toTank.x * 0.6, TH + 0.18, spoutEnd.z - toTank.z * 0.6), spoutEnd];
    pumpG.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(pp, false, 'centripetal'), 28, 0.035, 8, false), pipeMat()));
    var streamM = new THREE.MeshStandardMaterial({ color: C('#CFE3EA'), roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false });
    var stream = cyl(0.014, 0.022, 1, 8, streamM); stream.geometry.translate(0, -0.5, 0); stream.position.copy(spoutEnd); stream.scale.y = 0.2; g.add(stream);
    // ---- the stock tank; the water holds the sky
    var tankG = new THREE.Group(); tankG.position.set(TX, 0, TZ); g.add(tankG);
    if (tankK === 'Stone') {
      var sw = new THREE.Mesh(new THREE.CylinderBufferGeometry(TR, TR + 0.08, TH, 64, 1, true), mtl('#9A8C78', 'stone', 0.95, 0, 0.5)); sw.material.side = THREE.DoubleSide; sw.position.y = TH / 2; tankG.add(sw);
      var sw2 = new THREE.Mesh(new THREE.CylinderBufferGeometry(TR - 0.3, TR - 0.3, TH, 64, 1, true), mtl('#8E8170', 'stone', 0.95, 0, 0.5)); sw2.material.side = THREE.BackSide; sw2.position.y = TH / 2; tankG.add(sw2);
      var scap = new THREE.Mesh(new THREE.RingBufferGeometry(TR - 0.3, TR + 0.02, 64, 1), mtl('#B4A58C', 'concrete', 0.95, 0, 0.8)); scap.rotation.x = -Math.PI / 2; scap.position.y = TH; tankG.add(scap);
    } else {
      var tg = new THREE.CylinderBufferGeometry(TR, TR, TH, 96, 30, true), tpp = tg.attributes.position;
      for (k = 0; k < tpp.count; k++) { var ty2 = tpp.getY(k), f2 = 1 + 0.006 * Math.cos((ty2 + TH / 2) / TH * 30 * Math.PI) / TR * 3; tpp.setX(k, tpp.getX(k) * f2); tpp.setZ(k, tpp.getZ(k) * f2); }
      tg.computeVertexNormals();
      var tankM = mtl('#AEB4B8', 'rust', 0.45, 0.85, 0.5); tankM.side = THREE.DoubleSide;
      var tw = new THREE.Mesh(tg, tankM); tw.position.y = TH / 2; tankG.add(tw);
      var roll = new THREE.Mesh(new THREE.TorusBufferGeometry(TR, 0.035, 8, 96), galv); roll.rotation.x = Math.PI / 2; roll.position.y = TH; tankG.add(roll);
    }
    var WR = tankK === 'Stone' ? TR - 0.3 : TR - 0.01, WY = TH - 0.1;
    var waterM = new THREE.MeshStandardMaterial({ color: C('#7F9AA2'), roughness: 0.04, metalness: 1.0 });
    waterM.envMapIntensity = 1.0;
    var water = new THREE.Mesh(new THREE.CircleBufferGeometry(WR, 72), waterM); water.rotation.x = -Math.PI / 2; water.position.y = WY; tankG.add(water);
    var scum = new THREE.Mesh(new THREE.RingBufferGeometry(WR - 0.05, WR, 72, 1), std('#4F5A3A', 0.9, 0)); scum.rotation.x = -Math.PI / 2; scum.position.y = WY + 0.002; tankG.add(scum);
    var tbot = new THREE.Mesh(new THREE.CircleBufferGeometry(WR, 48), std('#3F4A40', 1, 0)); tbot.rotation.x = -Math.PI / 2; tbot.position.y = 0.02; tankG.add(tbot);
    var ripple = new THREE.Mesh(new THREE.RingBufferGeometry(0.05, 0.1, 32, 1), new THREE.MeshBasicMaterial({ color: C('#E8F2F4'), transparent: true, opacity: 0.4, depthWrite: false }));
    ripple.rotation.x = -Math.PI / 2; ripple.position.set(spoutEnd.x - TX, WY + 0.004, spoutEnd.z - TZ); tankG.add(ripple);
    // a furl wire and lever at the foot of the tower
    g.add(mech_rod(mch_v(0.05, 0.9, 0), mch_v(0.05, HT - 2.3, 0), 0.004, darkM, 3));
    var flever = box(0.04, 0.5, 0.04, darkM); flever.position.set(0.32, 0.95, 0.3); flever.rotation.z = 0.5; g.add(flever);
    [headG, tailG, clockG, tankG, pumpG].forEach(mech_mergeStatic);
    mech_mergeStatic(g);
    shade(g);
    water.receiveShadow = true; stream.castShadow = false; ripple.castShadow = false;
    var wl = new THREE.Vector3(), yaw = null, spin = r() * mch_TAU, lastReal = null;
    return {
      group: g, R: TX + TR + 0.3, lookY: 6.0, dist: rf(r, 23, 26), camH: [1.6, 2.6], face: true, shadowPad: 8,
      close: { zoom: 0.28, el: 0.22, look: cyC - 6.0 },
      update: function (ctx) {
        var t = ctx.t, sec = t.sec % 43200, wv = ctx.wind == null ? 1 : ctx.wind;
        chh.rotation.z = -sec / 43200 * mch_TAU; cmh.rotation.z = -(sec % 3600) / 3600 * mch_TAU; csh.rotation.z = -Math.floor(t.sec % 60) / 60 * mch_TAU;
        mch_localWind(ctx, g, wl);
        var target = Math.atan2(-wl.x, -wl.z) + 0.06 * Math.sin(ctx.real * 0.37) * wv;
        if (yaw === null || ctx.snap) yaw = target;
        else { var dd = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw)); yaw += dd * Math.min(1, ctx.dt * 0.8); }
        headG.rotation.y = yaw;
        var gust = 1 + 0.25 * Math.sin(ctx.real * 0.7) + 0.15 * Math.sin(ctx.real * 1.9 + 1.0);
        var om = (0.3 + 2.4 * wv) * gust;
        if (ctx.snap) spin = spin + (ctx.utc % 1000) * 0.37; else spin += om * Math.min(ctx.dt, 0.1);
        wheelG.rotation.z = -spin;
        var stroke = Math.sin(spin / 3.29);
        prod.position.y = 0.9 + 0.09 * stroke;
        var flowOn = stroke > 0 ? 1 : 0.25;
        stream.scale.y = TH + 0.08 - WY + 0.001; stream.visible = wv > 0.4;
        stream.scale.x = stream.scale.z = 0.6 + 0.4 * flowOn;
        ripple.scale.setScalar(1 + ((ctx.real * 0.9) % 1) * 2.5); ripple.material.opacity = stream.visible ? 0.4 * (1 - ((ctx.real * 0.9) % 1)) : 0;
      }
    };
  }

  // ------------------------------------------------------------ register
  defineClock('Foucault Pendulum', { w: 8, keeps: 'The Earth', height: 11.3, build: mch_foucault,
    mats: ['Weathering Steel', 'Ink Black', 'Mill Aluminum', 'Bone White', 'Blossom Blue'],
    line: 'A nine metre pendulum left to swing while the Earth turns under it, 7.6 degrees an hour at latitude 30.3. The pegs it knocks down read the hour, and they are stood up again at midnight.',
    traits: function (r) { return { 'Frame': pickW(r, [['Tripod', 60], ['A-Frame', 40]]), 'Bob': pickW(r, [['Brass', 45], ['Chrome', 30], ['Blossom Blue', 25]]), 'Pegs': pickW(r, [['Brass Pins', 45], ['Dominoes', 30], ['Blossom Pins', 25]]) }; } });
  defineClock('Candle Clock', { w: 9, keeps: 'Fire', height: 1.9, build: mch_candles,
    mats: ['Ink Black', 'Weathering Steel', 'Brass', 'Patinated Copper'],
    line: 'Twelve candles, one for each hour. The lit one burns down through its bands as the hour goes, and at noon and midnight all twelve are new.',
    traits: function (r) { return { 'Stand': pickW(r, [['Row', 55], ['Ring', 45]]), 'Wax': pickW(r, [['Beeswax', 40], ['Tallow', 35], ['Oxblood', 25]]), 'Marks': pickW(r, [['Quarters', 45], ['Ten Minutes', 35], ['Five Minutes', 20]]) }; } });
  defineClock('Station Clock', { w: 9, keeps: 'Hands', height: 4.9, build: mch_station,
    mats: ['Ink Black', 'Bone White', 'Blossom Blue', 'Cherokee Red', 'Mill Aluminum', 'Patinated Copper'],
    line: 'A platform clock with two faces and no train. The second hand sweeps a little fast, waits at twelve, and lets the minute hand go.',
    traits: function (r) { return { 'Mount': pickW(r, [['Post', 55], ['Bracket', 45]]), 'Dial': pickW(r, [['White Enamel', 45], ['Black Enamel', 30], ['Cream', 25]]), 'Sign': pickW(r, [['Enamel Blue', 40], ['Black and White', 35], ['Depot Green', 25]]) }; } });
  defineClock('Scoreboard', { w: 9, keeps: 'Bulbs', outdoor: true, height: 7.8, build: mch_scoreboard,
    mats: ['Mill Aluminum', 'Ink Black', 'Weathering Steel', 'Bone White'],
    line: 'Friday night, every night. HOME is the hour, GUEST is the minute, the game clock runs out every sixty seconds, and QTR is the quarter of the day.',
    traits: function (r) { return { 'Home': pickW(r, [['SHORTHORNS', 34], ['PRONGHORNS', 18], ['JACKRABBITS', 16], ['JAVELINAS', 16], ['NIGHTHAWKS', 16]]), 'Paint': pickW(r, [['Maroon', 30], ['Royal Blue', 25], ['Forest Green', 20], ['Black and Gold', 25]]), 'Bulbs': pickW(r, [['Amber', 50], ['White', 30], ['Red', 20]]) }; } });
  defineClock('Pumpjack', { w: 9, keeps: 'Strokes', outdoor: true, height: 6.3, build: mch_pumpjack,
    mats: ['Weathering Steel', 'Ink Black', 'Mill Aluminum'],
    line: 'A pumpjack nodding over a well that gives nothing but time. The counter on the post rolls its wheels over on the minute.',
    traits: function (r) { return { 'Paint': pickW(r, [['Safety Yellow', 30], ['Rig Red', 25], ['Faded Blue', 25], ['Tractor Green', 20]]), 'Counter': pickW(r, [['White Wheels', 60], ['Brass Wheels', 40]]), 'Lease': pickW(r, [['PRESIDIO 317 No. 1', 30], ['HIGH LONESOME No. 3', 25], ['CIBOLO FLATS No. 2', 25], ['SLOW WATER No. 7', 20]]) }; } });
  defineClock('Windmill Clock', { w: 10, keeps: 'Wind and Hands', outdoor: true, height: 12.8, build: mch_windmill,
    mats: ['Mill Aluminum', 'Weathering Steel', 'Ink Black', 'Bone White'],
    line: 'A farm windmill over a stock tank. The wheel turns with the wind and the tail holds it into it; the clock under the platform keeps Marfa time whichever way it blows.',
    traits: function (r) { return { 'Wheel': pickW(r, [['Galvanized', 50], ['Red and White', 25], ['Weathered', 25]]), 'Tail': pickW(r, [['Plain', 45], ['Lone Star', 30], ['317', 25]]), 'Tank': pickW(r, [['Galvanized', 60], ['Stone', 40]]) }; } });
