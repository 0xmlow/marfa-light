  // =====================================================================
  // THE GENERATIVE LAYER: nine traits every token carries, whatever its
  // clock and its place.
  //   Lens          24, 35, 50 or 85 mm. Field of view and distance move
  //                 together so the clock stays framed.
  //   Framing       centred, on a third (a lens shift), low or high.
  //   Condition     pristine, weathered, dusted, overgrown, calcified.
  //   Ground Bloom  bluebonnets, marigold, firewheel, cholla, or a mix.
  //   Visitors      nobody, one person, pilgrims, an opening night.
  //   Light Work    a Flavin barrier, luminarias, a searchlight.
  //   Birds         swallows, vultures, sandhill cranes, an owl.
  //   Sky Event     contrail, rainbow, sun dogs, virga, meteor shower,
  //                 each computed from the real sun and sky.
  //   Anomaly       rare: levitating, a mirror twin, gilded, glass.
  // The plan draws only from hashRng(hash, 11) and the build only from
  // seedRng(P.gen.seed), so no draw anywhere else moves. Prefix gen_.
  // =====================================================================

  var GEN_INDOOR = { 'Artillery Shed': 1 };
  // clocks read from above: a low camera would lose the face
  var GEN_TOPVIEW = { 'Horizontal Sundial': 1, 'Analemmatic Sundial': 1, 'Kinetic Pin Field': 1 };
  // vertical field of view on a full frame body; 38 is the engine's own 35 mm
  var GEN_FOV = { '28mm': 46.4, '35mm': 38, '50mm': 27, '85mm': 16.1 };   // vertical field of view; 24mm stretched the frame edges
  var GEN_SKY_EVENTS = {
    'Clear':        [['None', 58], ['Contrail', 26], ['Meteor Shower', 16]],
    'Scattered':    [['None', 44], ['Contrail', 18], ['Sun Dogs', 14], ['Virga', 12], ['Meteor Shower', 12]],
    'Monsoon':      [['None', 34], ['Rainbow', 40], ['Virga', 20], ['Contrail', 6]],
    'Dust':         [['None', 70], ['Contrail', 18], ['Meteor Shower', 12]],
    'Blue Norther': [['None', 40], ['Sun Dogs', 26], ['Contrail', 22], ['Virga', 6], ['Meteor Shower', 6]]
  };
  function gen_tab(t, drop) {
    var out = t.filter(function (q) { return !drop || drop.indexOf(q[0]) < 0; });
    return out.length ? out : [t[0]];
  }

  // ------------------------------------------------------------ plan (no WebGL)
  // one draw per trait, always, so a filtered table never shifts the next trait
  function genPlan(hash, clock, cd, place, pd, sky) {
    var r = hashRng(hash, 11), indoor = !!GEN_INDOOR[place], solar = !!(cd && cd.solar), top = !!GEN_TOPVIEW[clock];
    var lens = pickW(r, gen_tab([['35mm', 38], ['50mm', 26], ['28mm', 21], ['85mm', 15]], indoor ? ['85mm'] : null));
    var framing = pickW(r, gen_tab([['Centered', 40], ['Left Third', 17], ['Right Third', 17], ['Low Angle', 14], ['High Angle', 12]],
      (indoor ? ['High Angle'] : []).concat(top ? ['Low Angle', 'Left Third', 'Right Third'] : [])));   // a dial seen from above is framed tight: it needs the middle
    var condition = pickW(r, [['Pristine', 38], ['Weathered', 26], ['Dusted', 18], ['Overgrown', 12], ['Calcified', 6]]);
    var bloom = pickW(r, indoor ? [['None', 1]] : [['None', 45], ['Bluebonnets', 14], ['Desert Marigold', 12], ['Firewheel', 11], ['Mixed Wildflowers', 10], ['Cholla in Bloom', 8]]);
    var visitors = pickW(r, [['Empty', 42], ['Lone Visitor', 26], ['Pilgrims', 20], ['Opening Night', 12]]);
    var light = pickW(r, gen_tab([['None', 64], ['Luminarias', 14], ['Fluorescent Barrier', 12], ['Searchlight', 10]], indoor ? ['Searchlight'] : null));
    var birds = pickW(r, indoor ? [['None', 70], ['Swallows', 30]] : [['None', 45], ['Swallows', 20], ['Vultures', 15], ['Sandhill Cranes', 12], ['Great Horned Owl', 8]]);
    // a sun clock keeps the camera on its south side, where an evening bow never shows
    var skyEvent = pickW(r, indoor ? [['None', 1]] : gen_tab(GEN_SKY_EVENTS[sky] || [['None', 60], ['Contrail', 25], ['Meteor Shower', 15]], solar ? ['Rainbow'] : null));
    var anomaly = pickW(r, gen_tab([['None', 90], ['Levitating', 3.5], ['Mirror Twin', 2.5], ['Gilded', 2.5], ['Glass', 1.5]], solar ? ['Mirror Twin', 'Glass'] : null));
    var seed = Math.floor(r() * 4294967296) >>> 0, jit = r();
    return {
      lens: lens, framing: framing, condition: condition, bloom: bloom, visitors: visitors, light: light, birds: birds,
      skyEvent: skyEvent, anomaly: anomaly, seed: seed, jit: jit,
      features: {
        'Lens': lens, 'Framing': framing, 'Condition': condition, 'Ground Bloom': bloom, 'Visitors': visitors,
        'Light Work': light, 'Birds': birds, 'Sky Event': skyEvent, 'Anomaly': anomaly
      }
    };
  }

  // ------------------------------------------------------------ camera
  function gen_shift(g) { return g.framing === 'Left Third' ? 0.16 : g.framing === 'Right Third' ? -0.16 : 0; }
  // how full the frame is: the largest |NDC| over a cylinder of radius Rw and
  // height H at the origin, seen from (0, h, d) looking at (0, look, 0), for a
  // 3:2 frame. Over 1 means something is cut off.
  function gen_fit(d, h, look, H, Rw, fov, shift) {
    var tv = Math.tan(fov * D2R / 2), th = tv * 1.5, L = Math.sqrt(d * d + (look - h) * (look - h));
    var fy = (look - h) / L, fz = -d / L, worst = 0;
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * 6.2832, x = Math.cos(a) * Rw, z = Math.sin(a) * Rw;
      for (var k = 0; k < 2; k++) {
        var vy = (k ? H : 0) - h, vz = z - d, dep = vy * fy + vz * fz;
        if (dep < 0.3) return 9;
        var ver = (vy * -fz + vz * fy) / dep / tv, hor = x / dep / th - 2 * shift;
        worst = Math.max(worst, Math.abs(ver), Math.abs(hor));
      }
    }
    return worst;
  }
  function genCamera(P, hero) {
    var g = P.gen;
    if (!g || !g.lens) return null;
    var cd = CLOCK_DEFS[P.clock] || {}, fov = GEN_FOV[g.lens] || 38, fr = g.framing;
    var H = cd.height || hero.lookY * 2, Rw = hero.R * 0.9, look = hero.lookY;
    var d0 = hero.dist * P.camK, h0 = lerp(hero.camH[0], hero.camH[1], P.camHk), shift = gen_shift(g);
    // never ask for a tighter frame than the clock's own author chose
    var target = Math.max(0.86, gen_fit(d0, h0, look, H, Rw, 38, 0)), minD = Math.min(d0, hero.R + 1.2);
    // a clock set off to one side has less room: it must fit, even where its
    // author framed it tight
    if (shift) target = Math.min(target, 0.9);
    var d = d0 * Math.tan(19 * D2R) / Math.tan(fov * D2R / 2), h = h0;
    if (fr === 'Low Angle') h = clamp(Math.min(h0 * 0.4, look * 0.5), 0.55, 1.1);
    if (fr === 'High Angle') h = look + d * Math.tan(31 * D2R);
    for (var k = 0; k < 90 && (gen_fit(d, h, look, H, Rw, fov, shift) > target || d < minD); k++) {
      d *= 1.04;
      if (fr === 'High Angle') h = look + d * Math.tan(31 * D2R);
    }
    // a rainbow stands opposite the sun and sun dogs beside it: turn the
    // camera toward where they stand on a residency afternoon (sun in the west)
    var azOff = 0, want = null;
    if (g.skyEvent === 'Rainbow') want = 253 + (g.jit - 0.5) * 24;   // looking along the bow's northern leg
    if (g.skyEvent === 'Sun Dogs') want = 105 + (g.jit - 0.5) * 30;
    if (want != null) {
      if (cd.solar) want = want > 180 ? Math.min(want, 235) : Math.max(want, 125);
      azOff = ((want - P.camAz) % 360 + 540) % 360 - 180;
    }
    return { fov: fov, distK: d / d0, hK: h / h0, azOff: azOff };
  }

  // ------------------------------------------------------------ build helpers
  function gen_shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  // hide or show a thing and take it off the click layer while hidden
  function gen_show(o, on) {
    if (o.userData.genOn === on) return;
    o.userData.genOn = on; o.visible = on;
    o.traverse(function (c) { c.layers.set(on ? 0 : 31); });
  }
  function gen_T(geo, x, y, z, rx, ry, rz, sx, sy, sz) {
    var m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')),
      new THREE.Vector3(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz));
    geo.applyMatrix4(m);
    return geo;
  }
  // [[geometry, colour], ...] -> one indexed geometry with vertex colours
  function gen_merge(parts) {
    var pos = [], nor = [], col = [], idx = [], off = 0;
    parts.forEach(function (q) {
      var g = q[0], c = typeof q[1] === 'string' ? C(q[1]) : q[1], i;
      if (!g.attributes.normal) g.computeVertexNormals();
      var p = g.attributes.position.array, n = g.attributes.normal.array, cnt = p.length / 3, vc = g.attributes.color;
      for (i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      for (i = 0; i < cnt; i++) { if (vc) col.push(vc.getX(i), vc.getY(i), vc.getZ(i)); else col.push(c.r, c.g, c.b); }
      if (g.index) { var ia = g.index.array; for (i = 0; i < ia.length; i++) idx.push(ia[i] + off); }
      else for (i = 0; i < cnt; i++) idx.push(i + off);
      off += cnt; g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.setIndex(idx);
    return out;
  }
  function gen_vmat(rough, extra) {
    var m = std('#FFFFFF', rough == null ? 0.85 : rough, 0);
    m.vertexColors = true;
    if (extra) for (var k in extra) m[k] = extra[k];
    return m;
  }
  function gen_inst(geo, mat, n, cast) {
    var m = new THREE.InstancedMesh(geo, mat, Math.max(n, 1));
    m.count = n; m.castShadow = !!cast; m.receiveShadow = true; m.frustumCulled = false;
    return m;
  }
  // the camera frame as it was built: a direction for a point in NDC (the
  // lens shift of a thirds framing included), and NDC for a world point
  function gen_basis(S) {
    var c = S.W.cam, f = new THREE.Vector3(-c.pos.x, c.lookY - c.pos.y, -c.pos.z).normalize();
    var rt = new THREE.Vector3(-f.z, 0, f.x).normalize(), up = new THREE.Vector3().crossVectors(rt, f);
    S.f = f; S.rt = rt; S.up = up; S.tv = Math.tan(S.fov * D2R / 2); S.th = S.tv * 1.5;
  }
  function gen_dir(S, fx, fy, out) {
    return (out || new THREE.Vector3()).copy(S.f).addScaledVector(S.rt, (fx + 2 * S.shift) * S.th).addScaledVector(S.up, fy * S.tv).normalize();
  }
  function gen_ndc(S, x, y, z) {
    var c = S.W.cam.pos, vx = x - c.x, vy = y - c.y, vz = z - c.z;
    var dep = vx * S.f.x + vy * S.f.y + vz * S.f.z;
    return { dep: dep, x: (vx * S.rt.x + vz * S.rt.z) / dep / S.th - 2 * S.shift, y: (vx * S.up.x + vy * S.up.y + vz * S.up.z) / dep / S.tv };
  }
  function gen_gy(S, x, z) { return S.W.groundAt ? S.W.groundAt(x, z) : 0; }
  // open ground for low things (flowers, bags): claimed ground is off limits,
  // the sightline is not; the clock itself counts at 85% of its footprint
  function gen_open(S, x, z, rad, heroK) {
    var occ = S.W.occupied, R = S.R * (heroK == null ? 0.85 : heroK);
    if (x * x + z * z < (R + rad) * (R + rad)) return false;
    for (var i = 0; i < occ.length; i++) {
      var o = occ[i], dx = x - o[0], dz = z - o[1];
      if (o[0] === 0 && o[1] === 0) continue;
      if (dx * dx + dz * dz < (rad + o[2]) * (rad + o[2])) return false;
    }
    var rd = S.W.road;
    if (rd && Math.abs((x - rd.center.x) * rd.across.x + (z - rd.center.z) * rd.across.z) < rd.width / 2 + 2) return false;
    var c = S.W.cam.pos;
    return (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) > 2.2;
  }
  // a free spot near the clock that the camera can see. It samples the frame
  // itself (NDC x, distance from the camera) and keeps points whose place round
  // the clock fits: psi is the angle from the side facing the camera (0 in
  // front, 180 behind), side its sign (+1 the camera's right).
  function gen_spot(S, o) {
    var W = S.W, r = S.r, c = W.cam, lim = o.ndc || 0.86;
    var fx = -c.dir.x, fz = -c.dir.z, toCam = Math.atan2(c.pos.x, c.pos.z);
    for (var i = 0; i < (o.tries || 160); i++) {
      var grow = 1 + Math.floor(i / 50) * 0.4;
      var nx = rf(r, -lim, lim), dep = rf(r, Math.max(1.5, c.dist - o.dB * grow - S.R), c.dist + o.dB * grow + S.R);
      var lat = (nx + 2 * S.shift) * S.th * dep;
      var x = c.pos.x + c.dir.x * dep + c.right.x * lat, z = c.pos.z + c.dir.z * dep + c.right.z * lat;
      var d = Math.sqrt(x * x + z * z);
      if (d < o.dA || d > o.dB * grow) continue;
      var psi = Math.acos(clamp((x * fx + z * fz) / (d || 1), -1, 1)) * R2D, sd = (x * c.right.x + z * c.right.z) >= 0 ? 1 : -1;
      if (psi < o.psiA || psi > o.psiB * (grow > 1 ? 1.15 : 1) || (o.side && sd !== o.side)) continue;
      if (!W.free(x, z, o.rad) || !gen_inside(S, x, z, o.rad + 1)) continue;
      var n = gen_ndc(S, x, (o.y || 0) + gen_gy(S, x, z), z);
      if (n.dep < 2 || Math.abs(n.x) > lim || n.y < -0.97 || n.y > 0.97) continue;
      if (!o.noClaim) W.claim(x, z, o.rad);
      return { x: x, z: z, y: gen_gy(S, x, z), psi: psi * sd };
    }
    return null;
  }
  // inside the walls of a courtyard or a shed, when the place has them
  function gen_inside(S, x, z, margin) {
    var ct = S.W.court;
    if (!ct || !ct.group) return true;
    var th = ct.group.rotation.y, lx = x * Math.cos(th) - z * Math.sin(th), lz = x * Math.sin(th) + z * Math.cos(th);
    if (ct.interior) return Math.abs(lx) < 13 - margin;
    return Math.abs(lx) < ct.half - margin && Math.abs(lz) < ct.half - margin;
  }
  // low flat things the place built (pads, plazas, floors, slabs): flowers
  // do not grow on them. Kept as world boxes, found once.
  function gen_floors(S) {
    if (S.floors) return S.floors;
    var out = [], b = new THREE.Box3(), skip = {};
    S.parts.concat([S.box]).forEach(function (p) { skip[p.uuid] = 1; });
    S.W.root.children.forEach(function (ch) {
      if (skip[ch.uuid]) return;
      ch.traverse(function (o) {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry || o.userData.gen) return;
        var m = o.material;
        if (m && (m.transparent || m.isShaderMaterial)) return;
        b.setFromObject(o);
        var sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, sy = b.max.y - b.min.y;
        if (sy < 1.2 && b.max.y > -0.3 && b.max.y < 1.4 && sx * sz > 2.5 && sx < 600 && sz < 600) out.push([b.min.x, b.max.x, b.min.z, b.max.z]);
      });
    });
    return (S.floors = out);
  }
  function gen_onFloor(S, x, z) {
    var f = gen_floors(S);
    for (var i = 0; i < f.length; i++) if (x > f[i][0] && x < f[i][1] && z > f[i][2] && z < f[i][3]) return true;
    return false;
  }
  // a ray against the clock only; returns the first solid hit and its normal
  function gen_caster(S) {
    var ray = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), m4 = new THREE.Matrix4(), parts = S.parts;
    return function (ox, oy, oz, dx, dy, dz, far) {
      o.set(ox, oy, oz); d.set(dx, dy, dz).normalize(); ray.set(o, d); ray.far = far || 100;
      var hs = ray.intersectObjects(parts, true);
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i], ob = h.object;
        if (!ob.isMesh || ob.userData.gen || !gen_shown(ob)) continue;
        var n = h.face ? h.face.normal.clone() : d.clone().negate();
        if (h.face) {
          if (ob.isInstancedMesh && h.instanceId != null) { ob.getMatrixAt(h.instanceId, m4); n.transformDirection(m4); }
          n.transformDirection(ob.matrixWorld);
        }
        if (n.dot(d) > 0) n.negate();
        return { p: h.point.clone(), n: n };
      }
      return null;
    };
  }
  // an orthonormal frame with z along n: for leaves and crystals on a surface
  function gen_alignM(m4, pos, n, twist, sx, sy, sz, r) {
    var z = n.clone().normalize(), a = Math.abs(z.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    var x = new THREE.Vector3().crossVectors(a, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    x.applyAxisAngle(z, twist); y.applyAxisAngle(z, twist);
    m4.makeBasis(x.multiplyScalar(sx), y.multiplyScalar(sy), z.multiplyScalar(sz)).setPosition(pos);
    return m4;
  }
  // canvas soft dot, shared
  var gen_dotT = null;
  function gen_dotTex() {
    if (!gen_dotT) {
      gen_dotT = canvasTex(64, 64, function (g) {
        var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
      gen_dotT.userData = { shared: true };
    }
    return gen_dotT;
  }

  // ------------------------------------------------------------ the build
  function genBuild(W, hero) {
    var g = W.P.gen;
    if (!g || !g.features) return;
    var cd = CLOCK_DEFS[W.P.clock] || {};
    var S = { W: W, hero: hero, g: g, r: seedRng(g.seed), cd: cd, R: hero.R, H: cd.height || hero.lookY * 2,
      fov: GEN_FOV[g.lens] || 38, shift: gen_shift(g), box: new THREE.Group(), heroPick: null };
    S.box.userData.plcY = 0; S.box.userData.plcSkip = true;
    // a clock may W.add parts of itself instead of putting them in its group:
    // everything the root held before the group arrived belongs to the clock
    var hi = W.root.children.indexOf(hero.group);
    S.parts = [hero.group].concat(hi > 0 ? W.root.children.slice(0, hi) : []);
    W.add(S.box);
    (W.picks || []).forEach(function (p) { if (!S.heroPick && p.obj === hero.group) S.heroPick = p; });
    W.root.updateMatrixWorld(true);
    gen_basis(S);
    S.cast = gen_caster(S);
    var gc = W.groundColor ? W.groundColor.clone() : C('#B39A64');
    S.dust = gc.multiplyScalar(1.3); S.dust.r = Math.min(S.dust.r, 0.9); S.dust.g = Math.min(S.dust.g, 0.85); S.dust.b = Math.min(S.dust.b, 0.75);
    var steps = [gen_frame, gen_condition, gen_anomaly, gen_bloom, gen_visitors, gen_lightWork, gen_birds, gen_skyEvent, pal_bloom, sky_write];
    for (var i = 0; i < steps.length; i++) {
      try { steps[i](S); } catch (e) {
        if (root.MARFA_GEN_STRICT) throw e;
        if (root.console) console.warn('generative layer', e);
      }
    }
  }
  function gen_say(S, line) { if (S.heroPick) S.heroPick.line += ' ' + line; }

  // ------------------------------------------------------------ framing
  // thirds are a lens shift: the projection slides, the camera still looks
  // at the clock, so every view and every click stays true
  function gen_frame(S) {
    if (!S.shift) return;
    var px = S.shift * 1000;
    S.W.onUpdate(function (ctx) {
      var cam = ctx.camera;
      if (!cam || !cam.setViewOffset) return;
      if (!cam.view || !cam.view.enabled || cam.view.offsetX !== px) cam.setViewOffset(1000, 1000, px, 0, 1000, 1000);
    });
  }

  // ------------------------------------------------------------ surfaces
  var GEN_GLSL = [
    'varying vec3 vGnW; varying vec3 vGnN;',
    'uniform vec3 gnOrigin; uniform vec3 gnTint; uniform float gnK;',
    'float gnH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float gnN3(vec3 x) {',
    '  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(gnH(i), gnH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(gnH(i + vec3(0.0, 1.0, 0.0)), gnH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),',
    '             mix(mix(gnH(i + vec3(0.0, 0.0, 1.0)), gnH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(gnH(i + vec3(0.0, 1.0, 1.0)), gnH(i + vec3(1.0)), f.x), f.y), f.z);',
    '}',
    'float gnF(vec3 p) { return 0.5 * gnN3(p) + 0.25 * gnN3(p * 2.03 + 1.7) + 0.125 * gnN3(p * 4.11 + 3.1) + 0.0625 * gnN3(p * 8.3 + 5.3); }'
  ].join('\n');
  // what each condition does to a surface, in world metres from the clock's foot
  var GEN_COND_GLSL = {
    'Weathered': [
      'float gnS = gnF(vec3(gnP.x * 5.0, gnP.y * 0.3, gnP.z * 5.0));',
      'float gnG = smoothstep(0.36, 0.68, gnS) * (1.0 - abs(gnNn.y) * 0.6);',
      'float gnB = 1.0 - smoothstep(0.0, 1.1, gnP.y);',
      'float gnT = smoothstep(0.5, 0.95, gnNn.y);',
      'vec3 gnC = diffuseColor.rgb;',
      'gnC = mix(gnC, vec3(dot(gnC, vec3(0.3, 0.59, 0.11))) * vec3(1.05, 1.0, 0.92), 0.45 * gnK);',
      'gnC *= mix(1.0, 0.32, gnG * gnK);',
      'gnC = mix(gnC, gnTint * 0.55, gnB * 0.6 * gnK);',
      'gnC = mix(gnC, gnTint * 0.8, gnT * 0.3 * gnK);',
      'gnC *= 0.72 + 0.5 * gnF(gnP * 1.9 + 9.0);',
      'diffuseColor.rgb = gnC; gnRT = 0.95; gnRA = 0.45 * gnK; gnMK = 1.0 - 0.45 * gnK;'
    ].join('\n'),
    'Dusted': [
      'float gnU = smoothstep(0.15, 0.75, gnNn.y);',
      'float gnL = 1.0 - smoothstep(0.0, 1.2, gnP.y);',
      'float gnZ = gnF(gnP * 2.6);',
      'gnD = clamp(gnU * (0.45 + 0.8 * gnZ) + gnL * (0.25 + 0.6 * gnZ) + 0.18 * gnZ, 0.0, 1.0) * gnK;',
      'diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.25 * gnK), gnTint * (0.8 + 0.35 * gnN3(gnP * 30.0)), gnD);',
      'gnRT = 1.0; gnRA = gnD; gnMK = 1.0 - gnD;'
    ].join('\n'),
    'Overgrown': [
      'float gnL = 1.0 - smoothstep(0.0, 2.4, gnP.y);',
      'float gnM = smoothstep(0.48, 0.7, gnF(gnP * 2.4 + 4.0)) * (0.08 + 0.92 * gnL);',
      'vec3 gnMoss = mix(vec3(0.035, 0.06, 0.015), vec3(0.16, 0.2, 0.07), gnN3(gnP * 12.0));',
      'diffuseColor.rgb = mix(diffuseColor.rgb * mix(1.0, 0.72, gnL * gnK), gnMoss, gnM * 0.92 * gnK);',
      'gnRT = 0.95; gnRA = max(gnM, 0.3) * gnK; gnMK = 1.0 - gnM * gnK;'
    ].join('\n'),
    'Calcified': [
      'float gnE = gnF(gnP * 1.3 + 2.0);',
      'float gnW2 = smoothstep(0.55, 0.62, gnE);',
      'vec3 gnAsh = gnTint * (0.78 + 0.4 * gnN3(gnP * 16.0));',
      'vec3 gnCal = mix(vec3(0.03, 0.25, 0.5), vec3(0.3, 0.7, 0.85), gnN3(gnP * 22.0));',
      'vec3 gnC = mix(diffuseColor.rgb, gnAsh, 0.88 * gnK);',
      'diffuseColor.rgb = mix(gnC, gnCal, gnW2 * gnK);',
      'gnD = gnK; gnRT = mix(0.95, 0.12, gnW2); gnRA = gnK; gnMK = 1.0 - gnK;'
    ].join('\n')
  };
  function gen_inject(shader, U, mode, gild, glass) {
    shader.uniforms.gnOrigin = U.gnOrigin; shader.uniforms.gnTint = U.gnTint; shader.uniforms.gnK = U.gnK;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGnW;\nvarying vec3 vGnN;')
      .replace('#include <project_vertex>', ['#include <project_vertex>',
        'vec4 gnW4 = vec4(transformed, 1.0);', 'vec3 gnNv = objectNormal;',
        '#ifdef USE_INSTANCING', '  gnW4 = instanceMatrix * gnW4; gnNv = mat3(instanceMatrix) * gnNv;', '#endif',
        'vGnW = (modelMatrix * gnW4).xyz;', 'vGnN = normalize(mat3(modelMatrix) * gnNv);'].join('\n'));
    var body = GEN_COND_GLSL[mode] || '';
    // gold leaf goes on in squares, each a slightly different gold
    if (gild) body += '\ndiffuseColor.rgb *= 0.84 + 0.3 * gnH(floor(gnP * 6.0) + 0.5);';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GEN_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 gnP = vGnW - gnOrigin; vec3 gnNn = normalize(vGnN); float gnD = 0.0; float gnRT = 0.0; float gnRA = 0.0; float gnMK = 1.0;\n' + body)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, gnRT, gnRA);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= gnMK;');
    if (glass) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\nfloat gnFr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);\ndiffuseColor.a = max(mix(0.1, 0.85, gnFr), gnD);');
  }
  // Clone every hero material (they may be shared), rewrite the clone's
  // shader for the condition and anomaly, and copy anything the clock's own
  // update changes on the original (colour, glow, maps) onto the clone.
  function gen_skin(S, groups, originObj, cond, anom) {
    var W = S.W, gild = anom === 'Gilded', glass = anom === 'Glass', mode = cond === 'Pristine' ? '' : cond;
    if (!mode && !gild && !glass) return;
    // gold leaf and glass wear their condition lightly, or it would hide them
    var U = { gnOrigin: { value: new THREE.Vector3() }, gnTint: { value: (cond === 'Calcified' ? C('#CFCBC2') : S.dust).clone() }, gnK: { value: gild || glass ? (cond === 'Calcified' ? 0.55 : 0.4) : 1 } };
    var cache = {}, pairs = [], glassy = {}, glows = W.glows.map(function (q) { return q[0]; });
    function conv(m) {
      if (!m) return m;
      if (cache[m.uuid]) return cache[m.uuid];
      var lit = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * m.emissiveIntensity > 0.06;
      if (!m.isMeshStandardMaterial || m.transparent || m.opacity < 1 || lit || glows.indexOf(m) >= 0 || (m.userData && m.userData.genSkip)) return (cache[m.uuid] = m);
      var lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11, dark = lum < 0.035;
      var isGlass = glass && !dark && !m.map, isGild = gild && !dark;
      var c = m.clone(), ob = m.onBeforeCompile, ok = m.customProgramCacheKey.call(m);
      c.userData = m.userData; c.extensions = m.extensions;
      var key = 'gen1|' + mode + '|' + (isGild ? 'g' : '') + (isGlass ? 'x' : '') + '|' + ok;
      c.onBeforeCompile = function (sh, rd) { ob.call(this, sh, rd); gen_inject(sh, U, mode, isGild, isGlass); };
      c.customProgramCacheKey = function () { return key; };
      var own = false;
      if (gild) {
        own = true;
        if (dark) { c.color.setRGB(0.012, 0.012, 0.014); c.roughness = 0.32; c.metalness = 0.15; }
        else { c.color.setRGB(1.0, 0.6, 0.16); c.roughness = 0.34; c.metalness = 1; }
      }
      if (glass) {
        own = true;
        if (isGlass) { c.color.setRGB(0.74, 0.88, 0.92); c.roughness = 0.04; c.metalness = 0; c.transparent = true; c.depthWrite = false; c.envMapIntensity = 2; glassy[c.uuid] = 1; }
        else if (dark) { c.color.setRGB(0.008, 0.008, 0.01); c.roughness = 0.18; c.metalness = 0.3; }
        else own = false;
      }
      pairs.push([m, c, own]);
      return (cache[m.uuid] = c);
    }
    [].concat(groups).forEach(function (group) {
      group.traverse(function (o) {
        if (!o.isMesh || !o.material || o.userData.gen) return;
        o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
        if (glass && [].concat(o.material).some(function (mm) { return glassy[mm.uuid]; })) o.castShadow = false;
      });
    });
    W.onUpdate(function () {
      U.gnOrigin.value.copy(originObj.position);
      for (var i = 0; i < pairs.length; i++) {
        var m = pairs[i][0], c = pairs[i][1];
        if (!pairs[i][2]) { c.color.copy(m.color); c.roughness = m.roughness; c.metalness = m.metalness; }
        c.emissive.copy(m.emissive); c.emissiveIntensity = m.emissiveIntensity;
        if (c.map !== m.map) { c.map = m.map; c.needsUpdate = true; }
        c.visible = m.visible;
      }
    });
  }

  // ------------------------------------------------------------ condition
  var GEN_COND_LINE = {
    'Weathered': 'It has stood out here a long time: rain streaks, sun-bleached colour, grit splashed up round the base.',
    'Dusted': 'Playa dust has settled on every flat surface and banked against the base. Nobody has been out to wipe it.',
    'Overgrown': 'The desert is taking it back: grass at the foot, vines climbing, lichen in the shade.',
    'Calcified': 'Calcified, after Daniel Arsham: the surface has gone to ash and blue calcite grows where it wore through. It still keeps the time.'
  };
  function gen_condition(S) {
    var g = S.g, W = S.W, hero = S.hero;
    S.condGroup = new THREE.Group(); S.condGroup.userData.gen = true;   // rides on the clock (levitation, the twin)
    hero.group.add(S.condGroup);
    gen_skin(S, S.parts, hero.group, g.condition, g.anomaly);
    if (g.condition === 'Pristine') return;
    gen_say(S, GEN_COND_LINE[g.condition]);
    W.root.updateMatrixWorld(true);
    gen_foot(S);
    if (g.condition === 'Dusted') gen_drift(S);
    if (g.condition === 'Weathered') gen_drift(S, 0.45);
    if (g.condition === 'Overgrown') gen_overgrow(S);
    if (g.condition === 'Calcified') gen_calcite(S);
  }
  // where the clock meets the ground: horizontal rays in from all round
  function gen_foot(S) {
    var out = [], R = S.R;
    for (var k = 0; k < 2; k++) for (var i = 0; i < 40; i++) {
      var a = (i + k * 0.5) / 40 * 6.2832, cx = Math.cos(a), cz = Math.sin(a), y = k ? 0.4 : 0.1;
      var h = S.cast(cx * (R + 3), y + gen_gy(S, cx * (R + 3), cz * (R + 3)), cz * (R + 3), -cx, 0, -cz, R + 3);
      if (h) { h.n.y = 0; if (h.n.lengthSq() < 0.01) h.n.set(cx, 0, cz); h.n.normalize(); out.push(h); }
    }
    S.foot = out;
    return out;
  }
  // sand banked against the base: flattened mounds along the footprint
  function gen_drift(S, k) {
    k = k || 1;
    var W = S.W, r = S.r, foot = S.foot, list = [], i;
    if (foot.length < 6) {
      for (i = 0; i < 30; i++) { var a = i / 30 * 6.2832; foot.push({ p: new THREE.Vector3(Math.cos(a) * S.R * 0.5, 0, Math.sin(a) * S.R * 0.5), n: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) }); }
    }
    var n = Math.round(foot.length * (k < 1 ? 0.5 : 1.3));
    for (i = 0; i < n; i++) {
      var f = foot[Math.floor(r() * foot.length)], out = rf(r, 0.05, 0.5) * k, x = f.p.x + f.n.x * out + rf(r, -0.2, 0.2), z = f.p.z + f.n.z * out + rf(r, -0.2, 0.2);
      var sx = rf(r, 0.35, 0.8) * (0.6 + 0.4 * k), sy = rf(r, 0.06, 0.16) * k;
      list.push([x, gen_gy(S, x, z), z, sx, sy, sx * rf(r, 0.6, 1), r() * 6.28]);
    }
    var im = gen_inst(new THREE.SphereBufferGeometry(1, 14, 7, 0, 6.2832, 0, Math.PI / 2), std(gen_hexOf(k < 1 ? S.dust.clone().multiplyScalar(0.8) : S.dust), 1, 0, { tex: 'sand', tile: 1.4 }), list.length, false), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(function (d, i) { im.setMatrixAt(i, m4.compose(new THREE.Vector3(d[0], d[1] - 0.01, d[2]), q.setFromEuler(e.set(0, d[6], 0)), new THREE.Vector3(d[3], d[4], d[5]))); });
    S.box.add(im);
    if (k < 1) return;
    W.pick(im, 'Dusted', GEN_COND_LINE.Dusted);
    // a tumbleweed fetched up against it
    var twM = std('#8C6F4E', 0.9, 0, { wireframe: true });
    for (i = 0; i < 1 + (r() < 0.5 ? 1 : 0); i++) {
      var tw = new THREE.Group(), s2 = rf(r, 0.35, 0.55), f2 = foot[Math.floor(r() * foot.length)];
      tw.add(new THREE.Mesh(new THREE.IcosahedronBufferGeometry(s2, 1), twM));
      var inner = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(s2 * 0.7, 1), twM); inner.rotation.set(0.5, 0.3, 0.2); tw.add(inner);
      var tx = f2.p.x + f2.n.x * (s2 + 0.05), tz = f2.p.z + f2.n.z * (s2 + 0.05);
      tw.position.set(tx, s2 * 0.9 + gen_gy(S, tx, tz), tz);
      tw.rotation.set(r() * 6, r() * 6, 0); shade(tw);
      S.box.add(tw); W.pick(tw, 'Dusted', GEN_COND_LINE.Dusted);
    }
  }
  // r124's clone() of an InstancedMesh passes no count and drops instanceColor,
  // and the renderer then reads a null attribute. Rebuild instanced meshes whole.
  function gen_cloneDeep(o) {
    var c;
    if (o.isInstancedMesh) {
      c = new THREE.InstancedMesh(o.geometry, o.material, o.count);
      c.instanceMatrix.array.set(o.instanceMatrix.array);
      if (o.instanceColor) c.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(o.instanceColor.array), 3);
      c.castShadow = o.castShadow; c.receiveShadow = o.receiveShadow; c.frustumCulled = o.frustumCulled;
      c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale); c.visible = o.visible;
    } else c = o.clone(false);
    for (var i = 0; i < o.children.length; i++) c.add(gen_cloneDeep(o.children[i]));
    return c;
  }
  function gen_hexOf(c) { return '#' + c.clone().convertLinearToSRGB().getHexString(); }
  // vines climb the clock where a ray finds it, grass takes the foot and any
  // low ledge the rain reaches
  function gen_overgrow(S) {
    var W = S.W, r = S.r, R = S.R, H = S.H, cast = S.cast, hero = S.hero.group;
    var inv = new THREE.Matrix4().copy(hero.matrixWorld).invert();
    var nv = clamp(Math.round(4 + R * 1.5), 5, 12), yMax = Math.min(H * rf(r, 0.55, 0.9), 4.2), tubes = [], leaves = [];
    for (var v = 0; v < nv; v++) {
      var a0 = v / nv * 6.2832 + rf(r, -0.3, 0.3), ph = r() * 6.28, lean = rf(r, -0.3, 0.3), top = yMax * rf(r, 0.45, 1), pts = [], nrm = [];
      for (var y = 0.04; y < top; y += 0.1) {
        var a = a0 + Math.sin(y * 1.9 + ph) * 0.16 + lean * y, cx = Math.cos(a), cz = Math.sin(a);
        var h = cast(cx * (R + 3), y, cz * (R + 3), -cx, 0, -cz, R + 3);
        if (!h) break;
        if (pts.length && h.p.distanceTo(pts[pts.length - 1]) > 0.5) break;
        pts.push(h.p.addScaledVector(h.n, 0.022)); nrm.push(h.n);
      }
      if (pts.length < 4) continue;
      tubes.push(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, rf(r, 0.012, 0.02), 4, false));
      for (var k = 0; k < pts.length; k++) {
        var nl = k < 3 ? 3 : ri(r, 1, 3);
        for (var j = 0; j < nl; j++) leaves.push([pts[k].clone().add(new THREE.Vector3(rf(r, -0.05, 0.05), rf(r, -0.04, 0.04), rf(r, -0.05, 0.05))), nrm[k].clone().add(new THREE.Vector3(rf(r, -0.5, 0.5), rf(r, -0.2, 0.5), rf(r, -0.5, 0.5))).normalize(), rf(r, 0.05, 0.1)]);
      }
    }
    var grp = S.condGroup;
    if (tubes.length) {
      var vg = mergeGeos(tubes); vg.applyMatrix4(inv);
      var vine = new THREE.Mesh(vg, std('#4A4526', 0.95)); vine.castShadow = true; vine.receiveShadow = true; vine.userData.gen = true;
      grp.add(vine);
      var lg = new THREE.CircleBufferGeometry(0.5, 5); lg.translate(0, 0.5, 0);
      var lm = std('#FFFFFF', 0.7, 0, { side: THREE.DoubleSide });
      var li = gen_inst(lg, lm, leaves.length, true), m4 = new THREE.Matrix4(), cols = ['#3F5A24', '#56702C', '#6E8235', '#4B6A2A', '#8A8C3A'];
      leaves.forEach(function (q, i) {
        gen_alignM(m4, q[0], q[1], r() * 6.28, q[2], q[2] * 1.2, q[2], r);
        m4.premultiply(inv); li.setMatrixAt(i, m4); li.setColorAt(i, C(pick(r, cols)));
      });
      li.userData.gen = true; grp.add(li);
      W.pick(grp, 'Overgrown', GEN_COND_LINE.Overgrown);
    }
    // grass: straight down from 2 m, onto low ledges of the clock or the ground
    var onHero = [], onGround = [], rr = R * 1.05 + 1.1;
    for (var i = 0; i < 520; i++) {
      var d = Math.sqrt(r()) * rr, an = r() * 6.2832, x = Math.cos(an) * d, z = Math.sin(an) * d;
      var hit = cast(x, 2.2, z, 0, -1, 0, 2.6);
      if (hit) {
        // a ledge wide enough to hold soil: four neighbours at the same height
        if (hit.n.y > 0.85 && hit.p.y < 0.75 && hit.p.y > 0.03 && r() < 0.8) {
          var flat = true;
          for (var q2 = 0; q2 < 4 && flat; q2++) { var hn = cast(x + (q2 === 0 ? 0.12 : q2 === 1 ? -0.12 : 0), 2.2, z + (q2 === 2 ? 0.12 : q2 === 3 ? -0.12 : 0), 0, -1, 0, 2.6); flat = !!hn && Math.abs(hn.p.y - hit.p.y) < 0.03; }
          if (flat) onHero.push(hit.p);
        }
        continue;
      }
      if (d < R * 0.35 && r() < 0.5) continue;
      if (r() < 0.25 + 0.75 * (1 - d / rr) && !(d > S.R * 1.02 && gen_onFloor(S, x, z))) onGround.push(new THREE.Vector3(x, gen_gy(S, x, z), z));
    }
    var tg = tuftGeometry(), gm = swayMat(std('#FFFFFF', 0.95, 0), W), gcol = ['#6F7D3A', '#7E8B44', '#8F8A4A', '#5E6E33'];
    [[onHero, true], [onGround, false]].forEach(function (q) {
      if (!q[0].length) return;
      var im = gen_inst(q[1] ? tg.clone() : tg, gm, q[0].length, false), m = new THREE.Matrix4(), e = new THREE.Euler(), qq = new THREE.Quaternion();
      q[0].forEach(function (p, i) {
        var s = rf(r, 0.28, 0.6);
        m.compose(p, qq.setFromEuler(e.set(rf(r, -0.12, 0.12), r() * 6.28, rf(r, -0.12, 0.12))), new THREE.Vector3(s, s * rf(r, 0.9, 1.5), s));
        if (q[1]) m.premultiply(inv);
        im.setMatrixAt(i, m); im.setColorAt(i, C(pick(r, gcol)));
      });
      im.userData.gen = true;
      if (q[1]) grp.add(im); else { S.box.add(im); W.pick(im, 'Overgrown', GEN_COND_LINE.Overgrown); }
    });
  }
  // blue calcite, in clusters of hexagonal prisms, where the surface wore through
  function gen_calcite(S) {
    var W = S.W, r = S.r, R = S.R, H = S.H, cast = S.cast, hero = S.hero.group;
    var inv = new THREE.Matrix4().copy(hero.matrixWorld).invert(), sites = [], ground = [], i;
    var yTop = Math.min(H, 4.5);
    for (i = 0; i < 260 && sites.length < 34; i++) {
      var a = r() * 6.2832, y = (sites.length < 28 ? Math.min(yTop, 1.4) : yTop) * Math.pow(r(), 1.7), ty = y + rf(r, -0.6, 0.6);
      var h = cast(Math.cos(a) * (R + 3), y, Math.sin(a) * (R + 3), -Math.cos(a), (ty - y) / (R + 3), -Math.sin(a), R + 4);
      if (h) sites.push([h.p, h.n, 1 - y / (yTop + 0.01)]);
    }
    var foot = S.foot;
    for (i = 0; i < 80 && ground.length < 22 && foot.length; i++) {
      var f = foot[Math.floor(r() * foot.length)], out = rf(r, 0.04, 0.4), x = f.p.x + f.n.x * out, z = f.p.z + f.n.z * out;
      ground.push([new THREE.Vector3(x, gen_gy(S, x, z), z), f.n.clone().multiplyScalar(0.5).add(new THREE.Vector3(rf(r, -0.2, 0.2), 1, rf(r, -0.2, 0.2))).normalize(), 1]);
    }
    var cg = mergeGeos([new THREE.CylinderBufferGeometry(1, 1, 1, 6).translate(0, 0.5, 0), new THREE.ConeBufferGeometry(1, 0.7, 6).translate(0, 1.35, 0)]);
    cg.rotateX(Math.PI / 2);   // along +z, so a basis with z on the normal points it out
    var mat = std('#FFFFFF', 0.1, 0, { flatShading: true, envMapIntensity: 1.6 }), cols = ['#5DB8DA', '#8ED6EC', '#D8F2F8', '#3A92C0', '#A9E2F0'];
    function fill(list, local) {
      var ms = [], m4 = new THREE.Matrix4();
      list.forEach(function (s) {
        var k = ri(r, 3, 8), big = 0.6 + 0.8 * s[2];
        for (var j = 0; j < k; j++) {
          var dir = s[1].clone().add(new THREE.Vector3(rf(r, -0.7, 0.7), rf(r, -0.5, 0.7), rf(r, -0.7, 0.7))).normalize();
          var len = rf(r, 0.06, 0.3) * big, rad = len * rf(r, 0.16, 0.26), p = s[0].clone().addScaledVector(dir, -len * 0.25).add(new THREE.Vector3(rf(r, -0.06, 0.06), rf(r, -0.04, 0.04), rf(r, -0.06, 0.06)));
          gen_alignM(m4, p, dir, r() * 6.28, rad, rad, len, r);
          if (local) m4.premultiply(inv);
          ms.push(m4.clone());
        }
      });
      if (!ms.length) return null;
      var im = gen_inst(cg, mat, ms.length, true);
      ms.forEach(function (m, i) { im.setMatrixAt(i, m); im.setColorAt(i, C(pick(r, cols))); });
      im.userData.gen = true;
      return im;
    }
    var a1 = fill(sites, true), a2 = fill(ground, false);
    if (a1) { S.condGroup.add(a1); W.pick(S.condGroup, 'Calcified', GEN_COND_LINE.Calcified); }
    if (a2) { S.box.add(a2); W.pick(a2, 'Calcified', GEN_COND_LINE.Calcified); }
  }

  // ------------------------------------------------------------ anomaly
  var GEN_ANOM_LINE = {
    'Levitating': 'It floats 40 cm off the ground and has since the day it was installed. The shadow is real.',
    'Mirror Twin': 'A mirror twin stands behind it, reversed left to right, keeping the same time. Nobody has said which one is the reflection.',
    'Gilded': 'Gilded: every surface in gold leaf, laid in squares. The dark parts stay dark so it can still be read.',
    'Glass': 'Glass: the whole clock cast clear. The dark parts stay dark so it can still be read.'
  };
  function gen_anomaly(S) {
    var a = S.g.anomaly, W = S.W, hero = S.hero;
    if (a === 'None') return;
    if (a === 'Gilded' || a === 'Glass') { gen_say(S, GEN_ANOM_LINE[a]); return; }   // the materials were done with the condition
    if (a === 'Levitating') {
      gen_say(S, GEN_ANOM_LINE.Levitating);
      var y0 = hero.group.position.y, r = S.r, R = S.R, base = S.parts.map(function (p) { return p.position.y; });
      // a few stones lifted with it, hanging in the gap
      var n = ri(r, 7, 12), geo = new THREE.DodecahedronBufferGeometry(1, 0), mat = std('#8C7B66', 1, 0, { flatShading: true, tex: 'stone', tile: 0.6 });
      var im = gen_inst(geo, mat, n, true), st = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      for (var i = 0; i < n; i++) {
        var an = Math.atan2(W.cam.pos.x, W.cam.pos.z) + rf(r, -1.3, 1.3), d = R * rf(r, 0.55, 0.95);
        st.push({ x: Math.sin(an) * d, z: Math.cos(an) * d, y: rf(r, 0.06, 0.3), s: rf(r, 0.03, 0.09), ph: r() * 6.28, rx: r() * 6, ry: r() * 6 });
      }
      S.box.add(im);
      var proxy = new THREE.Mesh(new THREE.CylinderBufferGeometry(R * 0.7, R * 0.7, 0.4, 16), new THREE.MeshBasicMaterial());
      proxy.visible = false; proxy.position.y = y0 + 0.2; S.box.add(proxy);
      W.pick(proxy, 'Levitating', GEN_ANOM_LINE.Levitating); W.pick(im, 'Levitating', GEN_ANOM_LINE.Levitating);
      W.onUpdate(function (ctx) {
        var t = ctx.real;
        var lift = 0.4 + 0.03 * Math.sin(t * 0.45);
        for (var k = 0; k < S.parts.length; k++) S.parts[k].position.y = base[k] + lift;
        for (var i = 0; i < st.length; i++) {
          var s = st[i];
          v.set(s.x, y0 + s.y + 0.025 * Math.sin(t * 0.6 + s.ph), s.z);
          q.setFromEuler(e.set(s.rx + t * 0.05, s.ry + t * 0.07, 0));
          im.setMatrixAt(i, m4.compose(v, q, sc.set(s.s, s.s * 0.7, s.s)));
        }
        im.instanceMatrix.needsUpdate = true;
      });
      return;
    }
    if (a === 'Mirror Twin') gen_twin(S);
  }
  // the same clock built again from its own definition, so it keeps its own
  // time, then mirrored and stood behind the first
  function gen_twin(S) {
    var W = S.W, P = W.P, cd = S.cd, r = S.r, hero = S.hero, R = S.R, c = W.cam;
    var saveR = W.r, n0 = W.root.children.length, tw;
    W.r = seedRng(S.g.seed ^ 0x51F7);
    try { tw = cd.build(W, P.material); } finally { W.r = saveR; }
    var holder = new THREE.Group();
    var extra = W.root.children.slice(n0);
    extra.forEach(function (o) { if (o !== S.box) holder.add(o); });
    holder.add(tw.group);
    var Rt = tw.R || R, dir = c.dir, rt = c.right, side = S.shift > 0 ? 1 : S.shift < 0 ? -1 : (r() < 0.5 ? -1 : 1), spot = null;
    // behind and to one side, far enough over that the camera sees both
    var heroX = -2 * S.shift, heroHalf = R * 0.9 / (c.dist * S.th), Ht = S.H;
    for (var i = 0; i < 60 && !spot; i++) {
      var sd = i < 40 ? side : -side, back = R + Rt + 3 + (i % 5) * 4, latK = 0.5 + Math.floor((i % 40) / 5) * 0.3;
      var lat = sd * latK * (R + Rt), x = dir.x * back + rt.x * lat, z = dir.z * back + rt.z * lat;
      if (!W.free(x, z, Rt * 0.9) || !gen_inside(S, x, z, Rt)) continue;
      var nd = gen_ndc(S, x, Ht * 0.5, z), half = Rt * 0.9 / (nd.dep * S.th);
      if (nd.dep > 2 && Math.abs(nd.x - heroX) > heroHalf * 0.85 + half * 0.4 && Math.abs(nd.x) + half * 0.85 < 1) spot = [x, z];
    }
    if (!spot) spot = [dir.x * (R + Rt + 6) + rt.x * side * R, dir.z * (R + Rt + 6) + rt.z * side * R];
    W.claim(spot[0], spot[1], Rt);
    holder.position.set(spot[0], gen_gy(S, spot[0], spot[1]), spot[1]);
    // turn to the camera, then mirror in the holder's own x
    holder.rotation.y = Math.atan2(c.pos.x - spot[0], c.pos.z - spot[1]);
    if (!tw.face) { tw.group.rotation.y = -holder.rotation.y; }
    holder.scale.x = -1;
    var bs = blobShadow(Rt * 2.4, Rt * 2.4, 0.3); holder.add(bs);
    S.box.add(holder);
    shade(tw.group);
    // the twin ages the same way
    if (S.condGroup && S.condGroup.children.length) tw.group.add(gen_cloneDeep(S.condGroup));
    W.root.updateMatrixWorld(true);
    gen_skin(S, [holder], holder, S.g.condition, 'None');
    if (tw.update) W.onUpdate(function (ctx) { tw.update(ctx); });
    W.pick(holder, 'Mirror Twin', GEN_ANOM_LINE['Mirror Twin']);
  }

  // ------------------------------------------------------------ ground bloom
  var GEN_BLOOM_LINE = {
    'Bluebonnets': 'Big Bend bluebonnets, the tall ones. They come up after a wet winter and are gone by May.',
    'Desert Marigold': 'Desert marigold: woolly grey leaves and yellow flowers for most of the year, along every road out of Marfa.',
    'Firewheel': 'Firewheel, also called Indian blanket. Red at the centre, yellow at the tips.',
    'Cholla in Bloom': 'Tree cholla in bloom. Magenta for a few weeks in spring. Do not touch.',
    'Mixed Wildflowers': 'Bluebonnets, marigold, firewheel and pink evening primrose, all at once. It happens after a good wet winter.'
  };
  // a flat ring of petals, coloured from the centre out
  function gen_fan(n, rIn, rOut, cIn, cTip, cup, wide, midK) {
    var pos = [], col = [], a = C(cIn), b = C(cTip), w = (wide || 0.5) * Math.PI / n, mk = midK || 0.5;
    var mc = a.clone().lerp(b, 0.15), rM = lerp(rIn, rOut, mk);
    function quad(q0, q1, q2, q3, c0, c1) {
      pos.push.apply(pos, q0.concat(q1, q2, q0, q2, q3));
      col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c1.r, c1.g, c1.b);
    }
    for (var i = 0; i < n; i++) {
      var t = i / n * 6.2832;
      var p0 = [Math.cos(t - w) * rIn, 0, Math.sin(t - w) * rIn], p1 = [Math.cos(t + w) * rIn, 0, Math.sin(t + w) * rIn];
      var m1 = [Math.cos(t + w * 0.9) * rM, cup * mk, Math.sin(t + w * 0.9) * rM], m0 = [Math.cos(t - w * 0.9) * rM, cup * mk, Math.sin(t - w * 0.9) * rM];
      var p2 = [Math.cos(t + w * 0.6) * rOut, cup, Math.sin(t + w * 0.6) * rOut], p3 = [Math.cos(t - w * 0.6) * rOut, cup, Math.sin(t - w * 0.6) * rOut];
      quad(p0, p1, m1, m0, a, mc);
      quad(m0, m1, p2, p3, mc, b);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  var GEN_FLOWER = {
    'Bluebonnets': function (r) {
      var P = [[gen_T(new THREE.IcosahedronBufferGeometry(0.075, 0), 0, 0.03, 0, 0, 0, 0, 1, 0.35, 1), '#4E6B32'],
        [new THREE.CylinderBufferGeometry(0.006, 0.009, 0.4, 4).translate(0, 0.2, 0), '#56743A']];
      for (var k = 0; k < 12; k++) {
        var t = k / 11, y = 0.17 + t * 0.26, a = k * 2.4, rr = 0.024 * (1 - t * 0.6);
        P.push([gen_T(new THREE.OctahedronBufferGeometry(0.021 * (1 - t * 0.45)), Math.cos(a) * rr, y, Math.sin(a) * rr), t > 0.8 ? '#F1F2F6' : t > 0.45 ? '#3651C9' : '#28379E']);
      }
      return gen_merge(P);
    },
    'Desert Marigold': function (r) {
      var P = [[gen_T(new THREE.IcosahedronBufferGeometry(0.085, 0), 0, 0.035, 0, 0, 0, 0, 1, 0.5, 1), '#8D9B7B']];
      for (var k = 0; k < 3; k++) {
        var h = 0.2 + k * 0.04, a = k * 2.1, m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3));
        P.push([new THREE.CylinderBufferGeometry(0.003, 0.005, h, 3).translate(0, h / 2, 0).applyMatrix4(m), '#7F8E68']);
        var tp = new THREE.Vector3(0, h, 0).applyMatrix4(m);
        P.push([new THREE.CylinderBufferGeometry(0.03, 0.028, 0.007, 10).translate(tp.x, tp.y, tp.z), '#F2C12E']);
        P.push([new THREE.CylinderBufferGeometry(0.011, 0.011, 0.012, 6).translate(tp.x, tp.y + 0.004, tp.z), '#C98E14']);
      }
      return gen_merge(P);
    },
    'Firewheel': function (r) {
      var P = [[gen_T(new THREE.IcosahedronBufferGeometry(0.06, 0), 0, 0.03, 0, 0, 0, 0, 1, 0.45, 1), '#5E7240']];
      for (var k = 0; k < 2; k++) {
        var h = 0.24 + k * 0.07, a = k * 3.1 + 0.4, m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25));
        P.push([new THREE.CylinderBufferGeometry(0.003, 0.005, h, 3).translate(0, h / 2, 0).applyMatrix4(m), '#5B7A3A']);
        var tp = new THREE.Vector3(0, h, 0).applyMatrix4(m), tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5));
        P.push([gen_fan(12, 0.012, 0.045, '#B3160F', '#F6C63A', 0.012, 0.8, 0.68).applyMatrix4(tilt).translate(tp.x, tp.y, tp.z), '#FFFFFF']);
        P.push([gen_T(new THREE.SphereBufferGeometry(0.013, 6, 4), tp.x, tp.y + 0.004, tp.z, 0, 0, 0, 1, 0.8, 1), '#4E160F']);
      }
      return gen_merge(P);
    },
    'Primrose': function (r) {
      var P = [[gen_T(new THREE.IcosahedronBufferGeometry(0.055, 0), 0, 0.025, 0, 0, 0, 0, 1, 0.45, 1), '#5F7A42']];
      var h = 0.16, m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, 0, -0.15));
      P.push([new THREE.CylinderBufferGeometry(0.003, 0.005, h, 3).translate(0, h / 2, 0).applyMatrix4(m), '#5B7A3A']);
      var tp = new THREE.Vector3(0, h, 0).applyMatrix4(m);
      P.push([gen_fan(4, 0.006, 0.04, '#FFF2C4', '#F29BC0', 0.02, 1.7, 0.3).translate(tp.x, tp.y, tp.z), '#FFFFFF']);
      return gen_merge(P);
    },
    'Cholla': function (r) {
      var P = [], green = '#6C8A55', mag = '#D0287C';
      var trunk = rf(r, 0.35, 0.55);
      P.push([new THREE.CylinderBufferGeometry(0.05, 0.07, trunk, 6).translate(0, trunk / 2, 0), '#6A7550']);
      function arm(base, dir, len, depth) {
        var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        var g = new THREE.CylinderBufferGeometry(0.032, 0.04, len, 6).translate(0, len / 2, 0);
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)).translate(base.x, base.y, base.z);
        P.push([g, green]);
        var tip = base.clone().addScaledVector(dir, len);
        if (depth < 2) {
          var nb = ri(r, 1, 3);
          for (var i = 0; i < nb; i++) {
            var d2 = dir.clone().add(new THREE.Vector3(rf(r, -0.9, 0.9), rf(r, 0.1, 0.8), rf(r, -0.9, 0.9))).normalize();
            arm(tip, d2, len * rf(r, 0.75, 1), depth + 1);
          }
        } else {
          P.push([new THREE.CylinderBufferGeometry(0.045, 0.014, 0.04, 8).translate(tip.x, tip.y + 0.02, tip.z), mag]);
          P.push([new THREE.SphereBufferGeometry(0.012, 5, 3).translate(tip.x, tip.y + 0.04, tip.z), '#F2D65A']);
        }
      }
      for (var i = 0; i < ri(r, 2, 4); i++) {
        var a = r() * 6.28;
        arm(new THREE.Vector3(0, trunk * rf(r, 0.7, 1), 0), new THREE.Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize(), rf(r, 0.26, 0.36), 0);
      }
      return gen_merge(P);
    }
  };
  function gen_bloom(S) {
    var kind = S.g.bloom, W = S.W, r = S.r, c = W.cam;
    if (kind === 'None') return;
    var sd = S.g.seed % 991, line = GEN_BLOOM_LINE[kind];
    if (kind === 'Cholla in Bloom') {
      // a few stiff shrubs, scattered through the view, each one its own shape
      var n = ri(r, 12, 22), geos = [GEN_FLOWER.Cholla(r), GEN_FLOWER.Cholla(r), GEN_FLOWER.Cholla(r)];
      var mat = gen_vmat(0.8, { flatShading: true }), lists = [[], [], []], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (var i = 0; i < n * 8 && lists[0].length + lists[1].length + lists[2].length < n; i++) {
        var p = W.inView(rf(r, -36, 36), rf(r, 3, c.dist + 30));
        if (!gen_open(S, p.x, p.z, 0.7, 1) || !W.free(p.x, p.z, 0.5) || !gen_inside(S, p.x, p.z, 1) || gen_onFloor(S, p.x, p.z)) continue;
        var s = rf(r, 0.8, 1.6);
        lists[i % 3].push(m4.compose(new THREE.Vector3(p.x, gen_gy(S, p.x, p.z), p.z), q.setFromEuler(e.set(0, r() * 6.28, 0)), new THREE.Vector3(s, s, s)).clone());
        W.claim(p.x, p.z, 0.6);
      }
      lists.forEach(function (L, k) {
        if (!L.length) return;
        var im = gen_inst(geos[k], mat, L.length, true);
        L.forEach(function (m, j) { im.setMatrixAt(j, m); });
        S.box.add(im); W.pick(im, kind, line);
      });
      return;
    }
    var species = kind === 'Mixed Wildflowers' ? ['Bluebonnets', 'Desert Marigold', 'Firewheel', 'Primrose'] : [kind];
    var target = kind === 'Mixed Wildflowers' ? 2000 : kind === 'Desert Marigold' ? 900 : 1500;
    var lists = species.map(function () { return []; }), made = 0, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    var Rmax = c.dist + 38, lowCam = c.h < 1.3;
    for (var i = 0; i < target * 7 && made < target; i++) {
      var x, z;
      if (r() < 0.72) { var p = W.inView(rf(r, -40, 40), rf(r, 1.5, Rmax)); x = p.x; z = p.z; }
      else { var a = r() * 6.2832, d = S.R + Math.sqrt(r()) * 40; x = Math.sin(a) * d; z = Math.cos(a) * d; }
      // drifts: dense where the noise is high, thin elsewhere; thicker near the clock
      var near = 1 - sstep(S.R, S.R + 16, Math.sqrt(x * x + z * z)), dens = fbm(x / 8, z / 8, sd, 3) + near * 0.18;
      if (dens < 0.5 || r() > sstep(0.5, 0.66, dens)) continue;
      if (!gen_open(S, x, z, 0.08) || !gen_inside(S, x, z, 0.6) || gen_onFloor(S, x, z)) continue;
      if (lowCam) {
        var cx2 = x - c.pos.x, cz2 = z - c.pos.z, dc = Math.sqrt(cx2 * cx2 + cz2 * cz2), along = cx2 * c.dir.x + cz2 * c.dir.z, off = Math.abs(cx2 * c.right.x + cz2 * c.right.z);
        if (dc < 5 || (along > 0 && along < c.dist && off < 1.4)) continue;
      }
      var k = 0;
      if (species.length > 1) { var f2 = fbm(x / 6 + 40, z / 6, sd + 7, 2); k = Math.floor(clamp((f2 - 0.2) / 0.36 + rf(r, -0.15, 0.15), 0, 0.999) * 4); }
      var s = rf(r, 0.75, 1.35) * (species[k] === 'Bluebonnets' ? rf(r, 1, 1.5) : 1);
      m4.compose(v.set(x, gen_gy(S, x, z), z), q.setFromEuler(e.set(rf(r, -0.12, 0.12), r() * 6.28, rf(r, -0.12, 0.12))), sc.set(s, s, s));
      lists[k].push(m4.clone()); made++;
    }
    var mat = swayMat(gen_vmat(0.75, { side: THREE.DoubleSide }), W);
    species.forEach(function (sp, k) {
      var L = lists[k];
      if (!L.length) return;
      var im = gen_inst(GEN_FLOWER[sp](r), mat, L.length, false), col = new THREE.Color();
      L.forEach(function (m, j) { im.setMatrixAt(j, m); col.setRGB(1, 1, 1).multiplyScalar(rf(r, 0.82, 1.1)); im.setColorAt(j, col); });
      S.box.add(im); W.pick(im, kind, line);
    });
  }

  // ------------------------------------------------------------ visitors
  var GEN_SKIN = ['#8D5524', '#C68642', '#E0AC69', '#F1C27D', '#FFDBAC', '#5C3A21', '#A86B3C'];
  var GEN_HAIR = ['#1B1714', '#3B2A1E', '#6B4A2B', '#A67B4F', '#D9C4A0', '#8C8C8C', '#E8E4DC', '#1B1714'];
  var GEN_WEAR = {
    day:   ['#E9E2D3', '#C9B48E', '#7A6A55', '#3E4A5C', '#8C3B2E', '#556045', '#F2EFE8', '#2F3A4F', '#B8683A', '#2962FF', '#D9CBB0', '#6B7F8C'],
    low:   ['#3A3F47', '#4F5A3E', '#6E5A43', '#2E3440', '#8A7A62', '#1F2328', '#5C6670'],
    night: ['#111214', '#1C1D21', '#2A2B30', '#EDEAE3', '#111214', '#7B1E22', '#1C2A44', '#C9C2B4', '#111214']
  };
  var GEN_VIS_LINE = {
    'Lone Visitor': 'A visitor. They drove three hours to look at a clock and are in no hurry.',
    'Pilgrims': 'Pilgrims. Marfa gets them every weekend, people who come a long way to stand in front of things that stand very still.',
    'Opening Night': 'Opening night. Plastic cups, string lights, everyone looking at the clock and then at their phones.'
  };
  // a simple, faceted person facing +z. Body, head and arms are four meshes.
  function gen_person(S, r, o) {
    var skin = pick(r, GEN_SKIN), hair = pick(r, GEN_HAIR), top = o.top, low = o.low;
    var B = [], Hd = [], dress = o.cut === 'dress', coat = o.cut === 'coat';
    // shoes and legs
    [-1, 1].forEach(function (sd) {
      B.push([gen_T(new THREE.BoxBufferGeometry(0.1, 0.07, 0.25), sd * 0.09, 0.035, 0.035), o.shoe]);
      if (dress) B.push([new THREE.CylinderBufferGeometry(0.045, 0.04, 0.42, 6).translate(sd * 0.085, 0.27, 0), o.legs || skin]);
      else if (o.cut === 'shorts') {
        B.push([new THREE.CylinderBufferGeometry(0.052, 0.045, 0.6, 6).translate(sd * 0.09, 0.36, 0), skin]);
        B.push([new THREE.CylinderBufferGeometry(0.085, 0.08, 0.26, 7).translate(sd * 0.09, 0.8, 0), low]);
      } else B.push([new THREE.CylinderBufferGeometry(0.075, 0.058, 0.88, 7).translate(sd * 0.09, 0.5, 0), low]);
    });
    var prof = dress ? [[0, 0.42], [0.27, 0.42], [0.2, 0.7], [0.15, 0.98], [0.14, 1.1], [0.17, 1.3], [0.185, 1.42], [0.15, 1.49], [0.06, 1.52], [0, 1.52]]
      : coat ? [[0, 0.52], [0.24, 0.52], [0.205, 0.78], [0.175, 1.0], [0.165, 1.12], [0.19, 1.3], [0.205, 1.42], [0.17, 1.49], [0.07, 1.53], [0, 1.53]]
      : [[0, 0.9], [0.165, 0.9], [0.17, 1.0], [0.158, 1.12], [0.185, 1.3], [0.2, 1.42], [0.17, 1.49], [0.07, 1.53], [0, 1.53]];
    var lat = new THREE.LatheBufferGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 8);
    B.push([gen_T(lat, 0, 0, 0, 0, 0, 0, 1, 1, 0.74), top]);
    if (o.accent) B.push([new THREE.TorusBufferGeometry(0.1, 0.03, 5, 10).rotateX(Math.PI / 2).translate(0, 1.5, 0), o.accent]);
    B.push([new THREE.CylinderBufferGeometry(0.045, 0.05, 0.1, 6).translate(0, 1.56, 0), skin]);
    if (o.bag === 'backpack') B.push([gen_T(new THREE.BoxBufferGeometry(0.3, 0.4, 0.15), 0, 1.2, -0.19), o.bagC]);
    if (o.bag === 'tote') {
      B.push([gen_T(new THREE.BoxBufferGeometry(0.05, 0.34, 0.3), -0.25, 0.98, 0), o.bagC]);
      B.push([gen_T(new THREE.BoxBufferGeometry(0.02, 0.5, 0.03), -0.2, 1.3, 0, 0, 0, 0.25), o.bagC]);
    }
    // head, hair, hat: pivots at the neck
    Hd.push([gen_T(new THREE.IcosahedronBufferGeometry(0.1, 1), 0, 0.1, 0.005, 0, 0, 0, 0.92, 1.1, 1), skin]);
    Hd.push([gen_T(new THREE.SphereBufferGeometry(0.107, 10, 6, 0, 6.2832, 0, 1.75), 0, 0.115, -0.012, -0.25), hair]);
    if (o.longHair) Hd.push([new THREE.CylinderBufferGeometry(0.095, 0.115, 0.26, 8, 1, true).translate(0, 0.0, -0.035), hair]);
    if (o.hat === 'cowboy') {
      Hd.push([gen_T(new THREE.CylinderBufferGeometry(0.2, 0.2, 0.012, 16), 0, 0.185, 0, 0, 0, 0, 1, 1, 1.12), o.hatC]);
      Hd.push([new THREE.CylinderBufferGeometry(0.075, 0.095, 0.12, 10).translate(0, 0.25, 0), o.hatC]);
    } else if (o.hat === 'sun') {
      Hd.push([new THREE.CylinderBufferGeometry(0.24, 0.24, 0.01, 18).translate(0, 0.175, 0), o.hatC]);
      Hd.push([new THREE.SphereBufferGeometry(0.105, 10, 5, 0, 6.2832, 0, 1.5).translate(0, 0.16, 0), o.hatC]);
    } else if (o.hat === 'cap') {
      Hd.push([new THREE.SphereBufferGeometry(0.11, 10, 5, 0, 6.2832, 0, 1.45).translate(0, 0.13, 0), o.hatC]);
      Hd.push([gen_T(new THREE.BoxBufferGeometry(0.14, 0.012, 0.11), 0, 0.14, 0.11), o.hatC]);
    }
    var mat = S.personMat, g = new THREE.Group();
    var body = new THREE.Mesh(gen_merge(B), mat); g.add(body);
    var head = new THREE.Group(); head.position.y = 1.6; head.add(new THREE.Mesh(gen_merge(Hd), mat)); g.add(head);
    var arms = [-1, 1].map(function (sd) {
      var ag = new THREE.Group(), sleeve = o.short ? skin : top;
      var A = [[new THREE.CylinderBufferGeometry(0.047, 0.038, 0.56, 6).translate(0, -0.28, 0), sleeve], [gen_T(new THREE.IcosahedronBufferGeometry(0.042, 0), 0, -0.6, 0), skin]];
      if (o.short) A.push([new THREE.CylinderBufferGeometry(0.052, 0.05, 0.2, 6).translate(0, -0.1, 0), top]);
      ag.add(new THREE.Mesh(gen_merge(A), mat));
      ag.position.set(sd * 0.215, 1.46, 0); ag.rotation.z = sd * 0.07;
      g.add(ag);
      return ag;
    });
    // poses: arms hang along -y; a negative x turn swings them forward
    var aL = arms[0], aR = arms[1], pose = o.pose, prop = null;
    if (pose === 'point') { aR.rotation.x = -1.95; aR.rotation.z = 0.12; }
    if (pose === 'photo') {
      aL.rotation.x = aR.rotation.x = -1.42; aL.rotation.z = 0.42; aR.rotation.z = -0.42;
      prop = new THREE.Group();
      var ph = box(0.075, 0.15, 0.012, S.phoneMat); prop.add(ph);
      var scr = new THREE.Mesh(S.screenGeo, S.screenMat); scr.position.z = -0.007; scr.rotation.y = Math.PI; prop.add(scr);
      prop.position.set(-0.05, -0.62, 0.02); prop.rotation.x = 1.42; aR.add(prop);
    }
    if (pose === 'behind') { aL.rotation.x = aR.rotation.x = 0.32; aL.rotation.z = 0.2; aR.rotation.z = -0.2; }
    if (pose === 'glass') {
      aR.rotation.x = -0.95;
      prop = new THREE.Group();
      var cup = cyl(0.035, 0.028, 0.1, 8, S.cupMat); cup.position.y = 0.05; prop.add(cup);
      prop.position.set(0, -0.62, 0.02); prop.rotation.x = 0.95; aR.add(prop);
    }
    if (pose === 'stick') {
      aR.rotation.x = -0.35;
      var stk = cyl(0.014, 0.014, 1.5, 5, S.stickMat); stk.position.set(0, -0.45 + 0.0, 0.0); stk.rotation.x = 0.35;
      aR.add(stk); stk.position.y = -0.62;
    }
    g.scale.setScalar(o.scale);
    shade(g);
    return { g: g, head: head, aL: aL, aR: aR, pose: pose, ph: r() * 6.28, look: 0, baseL: aL.rotation.x, baseR: aR.rotation.x };
  }
  function gen_dress(S, r, style) {
    var wear = GEN_WEAR[style === 'night' ? 'night' : 'day'], o = {};
    o.top = pick(r, wear); o.low = pick(r, style === 'night' ? GEN_WEAR.night : GEN_WEAR.low);
    var cut = r();
    o.cut = cut < 0.24 ? 'dress' : cut < 0.42 ? 'coat' : (style === 'pilgrim' && cut < 0.62) ? 'shorts' : 'plain';
    o.short = o.cut !== 'coat' && style !== 'night' && r() < 0.4;
    o.shoe = pick(r, ['#1A1A1A', '#3B2A1E', '#E8E4DC', '#6B4A2B']);
    o.legs = o.cut === 'dress' && r() < 0.5 ? '#1A1A1A' : null;
    o.longHair = r() < 0.4;
    var hr = r();
    o.hat = style === 'night' ? (hr < 0.12 ? 'cowboy' : 'none') : style === 'pilgrim' ? (hr < 0.35 ? 'sun' : hr < 0.6 ? 'cap' : hr < 0.8 ? 'cowboy' : 'none') : (hr < 0.3 ? 'cowboy' : hr < 0.45 ? 'sun' : hr < 0.6 ? 'cap' : 'none');
    o.hatC = pick(r, ['#B08D5A', '#1A1A1A', '#E6D9B8', '#D8C391', '#6E4B2F', BRAND.blue]);
    o.bag = style === 'pilgrim' ? (r() < 0.6 ? 'backpack' : 'tote') : r() < 0.25 ? 'tote' : 'none';
    o.bagC = pick(r, ['#E9E2D3', '#3E4A5C', '#8C3B2E', '#556045', '#C9B48E']);
    o.accent = r() < 0.2 ? pick(r, [BRAND.blue, '#FF6B00', '#D1495B', '#EDAE49', BRAND.cyan]) : null;
    o.scale = rf(r, 0.93, 1.08);
    // a borrowed palette dresses some of the visitors, from its own stream
    if (S && S.W && pal_on(S.W)) {
      S.palK = (S.palK || 0) + 1;
      var pr = seedRng(((S.W.P.palette.seed ^ 0x9E37) + S.palK * 7919) >>> 0), pn = 5;
      if (pr() < 0.6) o.top = palColor(S.W, Math.floor(pr() * pn), pn, false);
      o.accent = palColor(S.W, Math.floor(pr() * pn), pn, false);
      if (pr() < 0.5) o.bagC = palColor(S.W, Math.floor(pr() * pn), pn, false);
    }
    return o;
  }
  function gen_visitors(S) {
    var kind = S.g.visitors, W = S.W, r = S.r, R = S.R, H = S.H;
    if (kind === 'Empty') return;
    S.personMat = gen_vmat(0.85, { flatShading: true });
    S.phoneMat = std('#16181C', 0.4, 0.3);
    S.screenMat = W.glow(glowMat('#CFE3FF', 0.4), 0.4, 1.4);
    S.screenGeo = new THREE.PlaneBufferGeometry(0.065, 0.135);
    S.cupMat = std('#F4F1EA', 0.5, 0);
    S.stickMat = mtl('#6B5238', 'wood', 1, 0, 0.8);
    var people = [], line = GEN_VIS_LINE[kind];
    function place(p, faceX, faceZ, o) {
      var pp = gen_person(S, r, o);
      pp.g.position.set(p.x, p.y, p.z);
      pp.g.rotation.y = Math.atan2(faceX - p.x, faceZ - p.z);
      var dd = Math.sqrt(p.x * p.x + p.z * p.z);
      pp.head.rotation.x = -clamp(Math.atan2(Math.min(H * 0.6, 8) - 1.6, dd), 0, 0.45);
      S.box.add(pp.g); W.pick(pp.g, kind, line);
      people.push(pp);
      return pp;
    }
    var pose = function () { var x = r(); return x < 0.34 ? 'photo' : x < 0.52 ? 'point' : x < 0.78 ? 'behind' : 'stand'; };
    if (kind === 'Lone Visitor') {
      var p = gen_spot(S, { dA: R + 1.2, dB: R + 4.5, psiA: 15, psiB: 150, rad: 0.45, y: 1.3, ndc: 0.8 });
      if (p) { var o = gen_dress(S, r, 'day'); o.pose = pose(); place(p, 0, 0, o); }
    }
    if (kind === 'Pilgrims') {
      var n = ri(r, 3, 6), ctr = gen_spot(S, { dA: R + 2, dB: R + 6.5, psiA: 15, psiB: 150, rad: 0.2, noClaim: true, y: 1.3, ndc: 0.65 });
      if (ctr) {
        for (var i = 0, tries = 0; i < n && tries < 80; tries++) {
          var x = ctr.x + rf(r, -1.8, 1.8), z = ctr.z + rf(r, -1.8, 1.8);
          if (!W.free(x, z, 0.42) || !gen_inside(S, x, z, 0.6) || x * x + z * z < (R + 0.9) * (R + 0.9)) continue;
          var nd = gen_ndc(S, x, 1.3 + gen_gy(S, x, z), z);
          if (nd.dep < 2 || Math.abs(nd.x) > 0.8) continue;
          W.claim(x, z, 0.42);
          var o2 = gen_dress(S, r, 'pilgrim'); o2.pose = i === 0 ? 'point' : i === 1 ? 'photo' : r() < 0.35 ? 'stick' : pose();
          place({ x: x, y: gen_gy(S, x, z), z: z }, 0, 0, o2); i++;
        }
      }
    }
    if (kind === 'Opening Night') gen_opening(S, place);
    if (!people.length) return;
    W.onUpdate(function (ctx) {
      var t = ctx.real;
      for (var i = 0; i < people.length; i++) {
        var q = people[i];
        q.g.rotation.z = Math.sin(t * 0.5 + q.ph) * 0.012;
        q.head.rotation.y = q.look + Math.sin(t * 0.19 + q.ph) * 0.3 + Math.sin(t * 0.07 + q.ph * 2) * 0.25;
        if (q.pose === 'photo') { var k = Math.sin(t * 0.3 + q.ph) * 0.05; q.aL.rotation.x = q.baseL + k; q.aR.rotation.x = q.baseR + k; }
        if (q.pose === 'point') q.aR.rotation.x = q.baseR + Math.sin(t * 0.8 + q.ph) * 0.04;
      }
    });
  }
  // a small crowd, a bar, and string lights that come on at dusk
  function gen_opening(S, place) {
    var W = S.W, r = S.r, R = S.R, c = W.cam, groups = ri(r, 3, 4), made = 0, target = ri(r, 9, 14), ctrs = [];
    for (var k = 0; k < groups && made < target; k++) {
      var ctr = gen_spot(S, { dA: R + 2, dB: R + 7, psiA: 20, psiB: 140, rad: 0.3, noClaim: true, y: 1.3, ndc: 0.85 });
      if (!ctr) continue;
      ctrs.push(ctr);
      var n = Math.min(ri(r, 2, 5), target - made), talk = r() < 0.5;
      for (var i = 0, tries = 0; i < n && tries < 60; tries++) {
        var a = r() * 6.28, d = rf(r, 0.55, 1.2), x = ctr.x + Math.cos(a) * d, z = ctr.z + Math.sin(a) * d;
        if (!W.free(x, z, 0.4) || !gen_inside(S, x, z, 0.6) || x * x + z * z < (R + 0.9) * (R + 0.9)) continue;
        var nd = gen_ndc(S, x, 1.3 + gen_gy(S, x, z), z);
        if (nd.dep < 2 || Math.abs(nd.x) > 1.02) continue;
        W.claim(x, z, 0.4);
        var o = gen_dress(S, r, 'night'), pz = r();
        o.pose = pz < 0.4 ? 'glass' : pz < 0.58 ? 'photo' : pz < 0.7 ? 'point' : pz < 0.85 ? 'behind' : 'stand';
        var fx = talk && o.pose !== 'photo' && o.pose !== 'point' ? ctr.x : 0, fz = talk && o.pose !== 'photo' && o.pose !== 'point' ? ctr.z : 0;
        place({ x: x, y: gen_gy(S, x, z), z: z }, fx, fz, o); i++; made++;
      }
    }
    // the bar
    var bp = gen_spot(S, { dA: R + 4, dB: R + 9, psiA: 55, psiB: 130, rad: 1.4 });
    if (bp) {
      // one merged mesh: a clothed table, bottles, cups, a tub of ice
      var BP = [[new THREE.BoxBufferGeometry(2.2, 0.9, 0.7).translate(0, 0.45, 0), '#F2EFE8']];
      for (var b = 0; b < 7; b++) {
        var bx = -0.95 + b * 0.16, bz = rf(r, -0.2, 0.1), bc = b % 3 ? '#1E3A26' : '#C9D6D2';
        BP.push([new THREE.CylinderBufferGeometry(0.035, 0.037, 0.3, 8).translate(bx, 1.05, bz), bc]);
        BP.push([new THREE.CylinderBufferGeometry(0.013, 0.02, 0.09, 6).translate(bx, 1.245, bz), bc]);
      }
      for (b = 0; b < 12; b++) BP.push([new THREE.CylinderBufferGeometry(0.035, 0.028, 0.1, 8).translate(rf(r, 0.35, 1.0), 0.95, rf(r, -0.25, 0.25)), '#F4F1EA']);
      BP.push([new THREE.CylinderBufferGeometry(0.2, 0.17, 0.25, 12).translate(-0.15, 1.02, 0.12), '#AEB4B8']);
      var bar = new THREE.Mesh(gen_merge(BP), gen_vmat(0.55));
      bar.position.set(bp.x, bp.y, bp.z); W.face(bar); shade(bar);
      S.box.add(bar); W.pick(bar, 'Opening Night', 'The bar: wine, water, a tub of ice slowly going back to water.');
      if (!ctrs.length) ctrs.push(bp);
    }
    // string lights on poles round the far side of the crowd
    var toCam = Math.atan2(c.pos.x, c.pos.z), sd = r() < 0.5 ? -1 : 1, poles = [], np = ri(r, 3, 4);
    for (var j = 0; j < np; j++) {
      var psi = (70 + j * (110 / (np - 1)) + rf(r, -8, 8)) * sd * D2R, dd = R + rf(r, 5.5, 8.5);
      var px = Math.sin(toCam + psi) * dd, pz = Math.cos(toCam + psi) * dd;
      if (!W.free(px, pz, 0.3)) { dd += 3; px = Math.sin(toCam + psi) * dd; pz = Math.cos(toCam + psi) * dd; }
      poles.push(new THREE.Vector3(px, gen_gy(S, px, pz), pz)); W.claim(px, pz, 0.3);
    }
    var poleM = mtl('#5B4B3B', 'wood', 1, 0, 1.2), wireM = new THREE.LineBasicMaterial({ color: C('#1A1715') });
    var bulbs = [], PH = 3.3;
    poles.forEach(function (p, i) {
      var pl = cyl(0.06, 0.07, PH, 6, poleM); pl.position.set(p.x, p.y + PH / 2, p.z); pl.castShadow = true; S.box.add(pl);
      if (i === 0) return;
      var a = poles[i - 1], pts = [];
      for (var k2 = 0; k2 <= 24; k2++) {
        var t = k2 / 24, q = new THREE.Vector3().lerpVectors(a, p, t);
        q.y += PH - 0.1 - Math.sin(t * Math.PI) * 0.7;
        pts.push(q); if (k2 > 0 && k2 < 24) bulbs.push(q);
      }
      S.box.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    });
    if (bulbs.length) {
      var bm = W.glow(glowMat('#FFC98A', 0.08), 0.08, 2.8);
      bm.color = C('#F4E8D2');
      var bi = gen_inst(new THREE.SphereBufferGeometry(0.05, 6, 5), bm, bulbs.length, false), m4 = new THREE.Matrix4();
      bulbs.forEach(function (q, i) { bi.setMatrixAt(i, m4.makeTranslation(q.x, q.y - 0.06, q.z)); });
      S.box.add(bi); W.pick(bi, 'Opening Night', GEN_VIS_LINE['Opening Night']);
      var mid = poles[Math.floor(poles.length / 2)];
      W.lamp('#FFB870', 1.1, 18, new THREE.Vector3(mid.x * 0.6, mid.y + 3, mid.z * 0.6));
    }
  }

  // ------------------------------------------------------------ light work
  var GEN_LIGHT_LINE = {
    'Fluorescent Barrier': 'A barrier of fluorescent tubes, one colour facing you and another facing away, a homage to Dan Flavin’s untitled (Marfa project) at Chinati. Best after dark.',
    'Luminarias': 'Luminarias: paper bags, a little sand, a candle in each. They mark the way to the clock after dark.',
    'Searchlight': 'A searchlight on a trailer. After dark it sweeps the sky over the clock as if something were opening. Something is: the next minute.'
  };
  function gen_lightWork(S) {
    var kind = S.g.light;
    if (kind === 'Fluorescent Barrier') gen_flavin(S);
    if (kind === 'Luminarias') gen_luminarias(S);
    if (kind === 'Searchlight') gen_searchlight(S);
  }
  function gen_flavin(S) {
    var W = S.W, r = S.r, R = S.R, c = W.cam, line = GEN_LIGHT_LINE['Fluorescent Barrier'];
    var pair = pick(r, [['#FF4FA0', '#52F08A'], ['#FFE14D', '#4D7BFF'], ['#FF4FA0', '#FFE14D'], ['#52F08A', '#4D7BFF']]);
    var pal = pal_on(W);   // a borrowed palette recolours the tubes; the draw above still happens
    if (pal) pair = [palColor(W, 0, 2, true), palColor(W, pal.spectrum ? 1 : 1, 2, true)];
    var n = ri(r, 12, 18), gap = 0.62;
    // a curved form needs more, closer tubes to trace its Squiggle (the draw above still happens)
    if (W.P.forms && /Squiggle|Slinky/.test(W.P.forms.barrier) && W.P.gen.light === 'Fluorescent Barrier') { n = W.P.forms.barrier === 'Slinky' ? 22 : 30; gap = W.P.forms.barrier === 'Slinky' ? 0.5 : 0.4; }
    var len = (n - 1) * gap, side = S.shift > 0 ? 1 : S.shift < 0 ? -1 : (r() < 0.5 ? -1 : 1), best = null;
    // a straight run across the frame beside the clock, on the open side
    var curvy = W.P.forms && /Squiggle|Slinky/.test(W.P.forms.barrier) && W.P.gen.light === 'Fluorescent Barrier' ? sqgPathFn(W.P.forms.path) : null;
    // three passes, each looser: tight to the frame, wider, then anywhere the camera can see it
    for (var i = 0; i < 480 && !best; i++) {
      var pass = i < 160 ? 0 : i < 320 ? 1 : 2, far = pass === 2 ? 2.2 : pass === 1 ? 1.5 : 1;
      var sd = i % 3 < 2 ? side : -side, back = rf(r, -R - 3, (R + 8) * far), lat = sd * (R + 1.2 + len * 0.5 + rf(r, 0, 3 * far) + Math.floor((i % 160) / 20) * 0.8 - len * rf(r, 0, 0.45));
      var cx = c.dir.x * back + c.right.x * lat, cz = c.dir.z * back + c.right.z * lat, ok = true;
      // test where the tubes will actually stand: the row turns to face the camera from (cx, cz)
      var tdx = c.pos.x - cx, tdz = c.pos.z - cz, tl = Math.sqrt(tdx * tdx + tdz * tdz) || 1; tdx /= tl; tdz /= tl;
      for (var k = 0; k < n && ok; k += curvy ? 2 : Math.max(1, Math.floor(n / 4))) {
        var lx = -len / 2 + k * gap, lz = curvy ? 1.7 * curvy(n > 1 ? k / (n - 1) : 0) : 0;
        var xx = cx + tdz * lx + tdx * lz, zz = cz - tdx * lx + tdz * lz;
        ok = W.free(xx, zz, pass === 2 ? 0.32 : 0.45) && gen_inside(S, xx, zz, 0.6) && xx * xx + zz * zz > (R + 0.8) * (R + 0.8);
      }
      var nd = ok && gen_ndc(S, cx, 0.6 + gen_gy(S, cx, cz), cz);
      if (ok && nd.dep > 2 && Math.abs(nd.x) < (i < 110 ? 0.6 : pass < 2 ? 0.85 : 0.97) && nd.y > -0.95 && nd.y < 0.9) best = [cx, cz];
    }
    if (W.P.forms) W.P.forms.built = !!best;
    if (!best) return;
    for (k = -2; k <= 2; k++) { var t2 = k / 2 * len / 2; W.claim(best[0] + c.right.x * t2, best[1] + c.right.z * t2, curvy ? 1.9 : 0.5); }
    var grp = new THREE.Group(); grp.position.set(best[0], gen_gy(S, best[0], best[1]), best[1]);
    grp.rotation.y = Math.atan2(c.pos.x - best[0], c.pos.z - best[1]);   // local +z to the camera, x along the row
    // Barrier Form (54-squiggle-forms.js): Straight is Flavin's row; Squiggle lays the row along a
    // real Squiggle's curve, so from above the barrier draws it; Slinky turns tubes into hoops along
    // that curve; Bold doubles the tube; Ribbed darkens every third bay, as Ribbed Squiggles do
    var form = (W.P.forms && W.P.forms.barrier) || 'Straight', curved = form === 'Squiggle' || form === 'Slinky';
    var yAt = curved ? sqgPathFn(W.P.forms.path) : function () { return 0; }, A = curved ? 1.7 : 0, lay = [];
    for (i = 0; i < n; i++) {
      var u = n > 1 ? i / (n - 1) : 0, du = 0.5 / Math.max(1, n - 1);
      var dz = A * (yAt(Math.min(1, u + du)) - yAt(Math.max(0, u - du)));
      lay.push([-len / 2 + i * gap, A * yAt(u), Math.atan2(-dz, gap)]);
    }
    var tr = form === 'Bold' ? 0.042 : 0.019, m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    var tg = new THREE.CylinderBufferGeometry(tr, tr, 1.17, 8);
    function at(L, off, y) { var th = L[2]; return m4.compose(v4.set(L[0] + Math.sin(th) * off, y, L[1] + Math.cos(th) * off), q4.setFromEuler(e4.set(0, th, 0)), one); }
    function glowFor(hex) { var mm = W.glow(glowMat(hex, 0.9), 0.9, 3.4); mm.color = C(hex).lerp(C('#FFFFFF'), 0.6); return mm; }
    var colorAt = function (i2, sideB) { return pal && pal.spectrum ? palColor(W, sideB ? n - 1 - i2 : i2, n, true) : pair[sideB ? 1 : 0]; };
    if (form === 'Slinky') {
      // glowing hoops standing across the path, like the circles of a Slinky Squiggle
      var hoop = new THREE.TorusBufferGeometry(0.5, tr * 1.2, 8, 48);
      for (i = 0; i < n; i++) {
        var hm = new THREE.Mesh(hoop, glowFor(colorAt(i, i % 2 === 1 && !(pal && pal.spectrum))));
        hm.position.set(lay[i][0], 0.6, lay[i][1]); hm.rotation.y = lay[i][2] + Math.PI / 2; grp.add(hm);
      }
    } else {
      var pan = gen_inst(new THREE.BoxBufferGeometry(form === 'Bold' ? 0.16 : 0.1, 1.22, form === 'Bold' ? 0.14 : 0.08), std('#E9E9E6', 0.5, 0.3), n, true);
      var dark = std('#26282B', 0.6, 0.4), off = form === 'Bold' ? 0.09 : 0.06;
      for (i = 0; i < n; i++) {
        pan.setMatrixAt(i, at(lay[i], 0, 0.63));
        var ribbed = form === 'Ribbed' && i % 3 === 2;
        [0, 1].forEach(function (sb) {
          var tm = new THREE.Mesh(tg, ribbed ? dark : glowFor(colorAt(i, sb === 1)));
          tm.applyMatrix4(at(lay[i], sb ? -off : off, 0.63)); grp.add(tm);
        });
      }
      grp.add(pan);
    }
    // light spilled on the ground, one colour each side
    var spill = function (hex, z) {
      var m = new THREE.MeshBasicMaterial({ map: gen_dotTex(), color: C(hex), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
      var pl = new THREE.Mesh(new THREE.PlaneBufferGeometry(len + 3, 3.2), m); pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.02, z); pl.renderOrder = 2;
      grp.add(pl); return m;
    };
    var sA = spill(pair[0], 1.3), sB = spill(pair[1], -1.3);
    W.lamp(pair[0], 2.2, 9, new THREE.Vector3(0, 0.8, 1.2), grp);
    W.lamp(pair[1], 2.2, 9, new THREE.Vector3(0, 0.8, -1.2), grp);
    S.box.add(grp); W.pick(grp, 'Fluorescent Barrier', line);
    W.onUpdate(function (ctx) { sA.opacity = sB.opacity = 0.55 * ctx.night; });
  }
  function gen_luminarias(S) {
    var W = S.W, r = S.r, R = S.R, c = W.cam, pts = [], cp = c.pos, i;
    // a path from near the camera to the clock, then a half ring round its front
    var toCam = Math.atan2(cp.x, cp.z), ring = R + 0.7, sway = rf(r, -0.25, 0.25), lateral = rf(r, 0.85, 1.1);
    var d0 = ring, d1 = c.dist * 0.72;
    for (var s = d0 + 0.8; s < d1; s += 0.85) {
      var bend = Math.sin((s - d0) / (d1 - d0) * Math.PI) * sway * (s - d0);
      [-1, 1].forEach(function (sd) {
        var off = sd * lateral + bend;
        pts.push([Math.sin(toCam) * s + Math.cos(toCam) * off, Math.cos(toCam) * s - Math.sin(toCam) * off]);
      });
    }
    var span = rf(r, 70, 110) * D2R;
    for (var a = -span; a <= span + 1e-6; a += 0.8 / ring) pts.push([Math.sin(toCam + a) * ring, Math.cos(toCam + a) * ring]);
    pts = pts.filter(function (p) { return gen_open(S, p[0], p[1], 0.12, 0.8) && gen_inside(S, p[0], p[1], 0.4); });
    if (!pts.length) return;
    var mat = W.glow(std('#D8B98C', 0.9, 0), 0, 0.8);
    mat.emissive = C('#F08A2E');
    var bag = gen_merge([[new THREE.BoxBufferGeometry(0.15, 0.2, 0.1).translate(0, 0.1, 0), '#B98E5A'],
      [new THREE.BoxBufferGeometry(0.158, 0.035, 0.108).translate(0, 0.205, 0), '#CDA676'],
      [new THREE.PlaneBufferGeometry(0.142, 0.092).rotateX(-Math.PI / 2).translate(0, 0.19, 0), '#3A2614']]);
    mat.vertexColors = true; mat.color = new THREE.Color(1, 1, 1);
    var lpal = pal_on(W);   // coloured paper bags, the candle still warm inside
    if (lpal) mat.emissive = C(palColor(W, 0, 1, true)).lerp(C('#F08A2E'), 0.45);
    var im = gen_inst(bag, mat, pts.length, true), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    if (lpal) for (var li = 0; li < pts.length; li++) im.setColorAt(li, C(palColor(W, li, pts.length, false)).lerp(new THREE.Color(1, 1, 1), 0.3));
    pts.forEach(function (p, i) {
      var s = rf(r, 0.9, 1.1);
      im.setMatrixAt(i, m4.compose(new THREE.Vector3(p[0], gen_gy(S, p[0], p[1]), p[1]), q.setFromEuler(e.set(0, r() * 6.28, rf(r, -0.05, 0.05))), new THREE.Vector3(s, s * rf(r, 0.92, 1.08), s)));
    });
    S.box.add(im); W.pick(im, 'Luminarias', GEN_LIGHT_LINE.Luminarias);
    W.lamp('#FFB060', 1.8, 9, new THREE.Vector3(Math.sin(toCam) * (ring + 0.6), 0.35, Math.cos(toCam) * (ring + 0.6)));
  }
  function gen_searchlight(S) {
    var W = S.W, r = S.r, R = S.R, c = W.cam;
    var p = gen_spot(S, { dA: R + 4, dB: R + 12, psiA: 115, psiB: 165, rad: 1.3, side: S.shift > 0 ? 1 : S.shift < 0 ? -1 : 0 });
    if (!p) p = gen_spot(S, { dA: R + 4, dB: R + 14, psiA: 60, psiB: 175, rad: 1.3 });
    if (!p) return;
    var dev = new THREE.Group(), steel = mtl('#4A4E54', 'brushed', 0.5, 0.7, 0.8), paint = std('#6E7A5A', 0.7, 0.2), rub = std('#151515', 0.9);
    var bed = box(1.6, 0.18, 1.0, paint); bed.position.y = 0.55; dev.add(bed);
    [-1, 1].forEach(function (sd) { var wh = cyl(0.3, 0.3, 0.16, 14, rub); wh.rotation.x = Math.PI / 2; wh.position.set(0, 0.3, sd * 0.56); dev.add(wh); });
    var tongue = box(0.9, 0.06, 0.08, paint); tongue.position.set(1.2, 0.5, 0); dev.add(tongue);
    var yoke = new THREE.Group(); yoke.position.y = 0.64; dev.add(yoke);
    [-1, 1].forEach(function (sd) { var arm = box(0.06, 0.75, 0.06, steel); arm.position.set(0, 0.38, sd * 0.5); yoke.add(arm); });
    var drum = new THREE.Group(); drum.position.y = 0.72; yoke.add(drum);
    var body = cyl(0.44, 0.4, 0.75, 20, steel); drum.add(body);
    var lensM = W.glow(glowMat('#FFF6E0', 0.1), 0.1, 3.2);
    var lens = new THREE.Mesh(new THREE.CircleBufferGeometry(0.41, 20), lensM); lens.rotation.x = -Math.PI / 2; lens.position.y = 0.38; drum.add(lens);
    shade(dev);
    dev.position.set(p.x, p.y, p.z);
    S.box.add(dev); W.pick(dev, 'Searchlight', GEN_LIGHT_LINE.Searchlight);
    // the beam: an open cone, bright at the lamp, gone by two kilometres
    var L = 2600, beamM = new THREE.ShaderMaterial({
      uniforms: { vis: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying float vA; varying vec3 vN; varying vec3 vV; void main(){ vA = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float vis; varying float vA; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.5); float a = pow(1.0 - vA, 2.2) * (0.2 + 0.8 * pow(1.0 - vA, 16.0)); gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * a * e * vis * 0.14, 1.0); }'
    });
    var beam = new THREE.Mesh(new THREE.CylinderBufferGeometry(22, 0.4, L, 24, 1, true).translate(0, L / 2, 0), beamM);
    beam.frustumCulled = false; beam.renderOrder = 3;
    var bh = new THREE.Group(); bh.position.set(p.x, p.y + 1.36, p.z); bh.add(beam); S.box.add(bh);
    var baseAz = Math.atan2(-c.dir.x, -c.dir.z) + Math.PI + (r() < 0.5 ? -1 : 1) * rf(r, 0.7, 1.1), ph = r() * 6.28, ph2 = r() * 6.28;
    var fw = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    W.onUpdate(function (ctx) {
      var t = ctx.real, az = baseAz + 0.55 * Math.sin(t * 0.21 + ph), el = (52 + 10 * Math.sin(t * 0.13 + ph2)) * D2R;
      fw.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      q.setFromUnitVectors(up, fw); bh.quaternion.copy(q);
      yoke.rotation.y = az - Math.PI / 2 - dev.rotation.y;
      drum.rotation.z = -(Math.PI / 2 - el);
      beamM.uniforms.vis.value = ctx.night;
      gen_show(bh, ctx.night > 0.02);
    });
  }

  // ------------------------------------------------------------ birds
  var GEN_BIRD_LINE = {
    'Swallows': 'Cliff swallows. They nest under anything with an edge and feed on the wing all afternoon.',
    'Vultures': 'Turkey vultures on a thermal. They hold their wings in a shallow V and almost never flap. They leave when the ground cools.',
    'Sandhill Cranes': 'Sandhill cranes passing over in a loose V. They winter south of here and go north in spring.',
    'Great Horned Owl': 'A great horned owl. It arrives at dusk, takes the highest perch, and watches the clock all night.'
  };
  // a wing: flat, root at x = 0, reaching +x (mirror for the left)
  function gen_wing(span, chord, sweep, cRoot, cTip, sgn) {
    var s = sgn || 1, pos = [0, 0, chord * 0.5, 0, 0, -chord * 0.5, s * span, 0, -chord * 0.5 - sweep, 0, 0, chord * 0.5, s * span, 0, -chord * 0.5 - sweep, s * span * 0.9, 0, chord * 0.2 - sweep * 0.8];
    var a = C(cRoot), b = C(cTip), col = [];
    [0, 0, 1, 0, 1, 1].forEach(function (k) { var cc = k ? b : a; col.push(cc.r, cc.g, cc.b); });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  // three instanced parts (body, left wing, right wing) posed each frame
  function gen_flock(S, n, bodyGeo, wingL, wingR, mat) {
    var b = gen_inst(bodyGeo, mat, n, true), l = gen_inst(wingL, mat, n, true), rr = gen_inst(wingR, mat, n, true);
    [b, l, rr].forEach(function (m) { S.box.add(m); });
    var M = new THREE.Matrix4(), F = new THREE.Matrix4(), T = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    return {
      parts: [b, l, rr],
      set: function (i, pos, yaw, pitch, roll, flap, s) {
        q.setFromEuler(e.set(pitch, yaw, roll, 'YXZ'));
        M.compose(pos, q, one.set(s, s, s));
        b.setMatrixAt(i, M);
        F.makeRotationZ(flap); T.multiplyMatrices(M, F); l.setMatrixAt(i, T);
        F.makeRotationZ(-flap); T.multiplyMatrices(M, F); rr.setMatrixAt(i, T);
      },
      done: function () { b.instanceMatrix.needsUpdate = l.instanceMatrix.needsUpdate = rr.instanceMatrix.needsUpdate = true; }
    };
  }
  function gen_birds(S) {
    var kind = S.g.birds;
    if (kind === 'Swallows') gen_swallows(S);
    if (kind === 'Vultures') gen_vultures(S);
    if (kind === 'Sandhill Cranes') gen_cranes(S);
    if (kind === 'Great Horned Owl') gen_owl(S);
  }
  function gen_swallows(S) {
    var W = S.W, r = S.r, R = S.R, H = S.H, n = ri(r, 9, 15), line = GEN_BIRD_LINE.Swallows;
    var body = gen_merge([[gen_T(new THREE.SphereBufferGeometry(0.03, 6, 4), 0, 0, 0, 0, 0, 0, 0.9, 0.75, 2.6), '#1C2438'],
      [gen_T(new THREE.SphereBufferGeometry(0.022, 5, 3), 0, -0.006, 0.045), '#B5663E'],
      [gen_wing(0.07, 0.03, 0.05, '#1C2438', '#1C2438', 1).rotateY(Math.PI / 2 + 0.4).translate(0.004, 0, -0.07), '#FFFFFF'],
      [gen_wing(0.07, 0.03, 0.05, '#1C2438', '#1C2438', -1).rotateY(-Math.PI / 2 - 0.4).translate(-0.004, 0, -0.07), '#FFFFFF']]);
    var wl = gen_wing(0.17, 0.05, 0.07, '#222A3E', '#141A28', 1), wr = gen_wing(0.17, 0.05, 0.07, '#222A3E', '#141A28', -1);
    var fl = gen_flock(S, n, body, wl, wr, gen_vmat(0.7, { side: THREE.DoubleSide }));
    fl.parts.forEach(function (m) { W.pick(m, 'Swallows', line); });
    var yc = clamp(H * 0.75, 2.2, 8), birds = [];
    for (var i = 0; i < n; i++) birds.push({ ax: rf(r, R + 1, R + 7), az: rf(r, R + 1, R + 7), ay: rf(r, 0.6, 2.6), y: yc * rf(r, 0.4, 1.2),
      w1: rf(r, 0.5, 1.0), w2: rf(r, 0.5, 1.0), w3: rf(r, 1.2, 2.2), w4: rf(r, 0.6, 1.4), p1: r() * 6.28, p2: r() * 6.28, p3: r() * 6.28, p4: r() * 6.28, ph: r() * 6.28 });
    var p = new THREE.Vector3(), p2 = new THREE.Vector3();
    function at(b, t, out) {
      return out.set(b.ax * Math.sin(b.w1 * t + b.p1) + 1.4 * Math.sin(b.w3 * t + b.p3), b.y + b.ay * Math.sin(b.w4 * t + b.p4), b.az * Math.cos(b.w2 * t + b.p2) + 1.2 * Math.cos(b.w3 * 0.8 * t + b.p2));
    }
    W.onUpdate(function (ctx) {
      var on = ctx.sun.el > -5;
      fl.parts.forEach(function (m) { gen_show(m, on); });
      if (!on) return;
      var t = ctx.real + 7.3;
      for (var i = 0; i < birds.length; i++) {
        var b = birds[i];
        at(b, t, p); at(b, t + 0.05, p2); p2.sub(p);
        var yaw = Math.atan2(p2.x, p2.z), pitch = -Math.atan2(p2.y, Math.sqrt(p2.x * p2.x + p2.z * p2.z));
        var beat = Math.sin(t * 0.9 + b.ph) > -0.2 ? Math.sin(t * 70 + b.ph) * 0.7 : 0.15;
        p.y += gen_gy(S, p.x, p.z);
        fl.set(i, p, yaw, pitch, Math.sin(b.w1 * t + b.p1) * 0.6, beat, 1);
      }
      fl.done();
    });
  }
  function gen_vultures(S) {
    var W = S.W, r = S.r, n = ri(r, 3, 6), line = GEN_BIRD_LINE.Vultures;
    // wings in a shallow V, dark on top, silver flight feathers beneath
    var span = 0.9, parts = [[gen_T(new THREE.SphereBufferGeometry(0.1, 7, 5), 0, 0, 0, 0, 0, 0, 0.9, 0.7, 3.2), '#221D19'],
      [gen_T(new THREE.SphereBufferGeometry(0.045, 6, 4), 0, 0.01, 0.34), '#A83A2A'],
      [gen_T(new THREE.ConeBufferGeometry(0.1, 0.3, 4), 0, 0, -0.42, -Math.PI / 2, 0, 0, 1, 1, 0.3), '#221D19']];
    [-1, 1].forEach(function (sd) {
      var w = gen_wing(span, 0.36, 0.08, '#2A231E', '#8E8A86', sd);
      w.applyMatrix4(new THREE.Matrix4().makeRotationZ(sd * 0.2));
      parts.push([w, '#FFFFFF']);
    });
    var geo = gen_merge(parts), im = gen_inst(geo, gen_vmat(0.9, { side: THREE.DoubleSide }), n, true);
    S.box.add(im); W.pick(im, 'Vultures', line);
    var D = rf(r, 70, 120), ctr = S.W.cam.pos.clone().addScaledVector(gen_dir(S, rf(r, -0.35, 0.35) - S.shift, rf(r, 0.55, 0.75)), D);
    var rad = D * S.th * 0.26, birds = [];
    for (var i = 0; i < n; i++) birds.push({ a: r() * 6.28, rr: rad * rf(r, 0.6, 1.2), y: rf(r, -1, 1) * D * S.tv * 0.1, w: rf(r, 0.1, 0.17) * (r() < 0.8 ? 1 : -1), s: rf(r, 1.6, 2.0) });
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    W.onUpdate(function (ctx) {
      var on = ctx.sun.el > 3;
      gen_show(im, on);
      if (!on) return;
      for (var i = 0; i < birds.length; i++) {
        var b = birds[i], a = b.a + ctx.real * b.w;
        v.set(ctr.x + Math.cos(a) * b.rr, ctr.y + b.y + Math.sin(a * 0.5) * 2, ctr.z + Math.sin(a) * b.rr);
        var yaw = Math.atan2(-Math.sin(a) * b.w, Math.cos(a) * b.w);
        q.setFromEuler(e.set(0, yaw, (b.w > 0 ? -1 : 1) * 0.32, 'YXZ'));
        im.setMatrixAt(i, m4.compose(v, q, sc.set(b.s, b.s, b.s)));
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }
  function gen_cranes(S) {
    var W = S.W, r = S.r, n = ri(r, 9, 15), line = GEN_BIRD_LINE['Sandhill Cranes'];
    var body = gen_merge([[gen_T(new THREE.SphereBufferGeometry(0.12, 7, 5), 0, 0, 0, 0, 0, 0, 0.9, 0.8, 2.6), '#9A9690'],
      [new THREE.CylinderBufferGeometry(0.025, 0.04, 0.55, 5).rotateX(Math.PI / 2).translate(0, 0.02, 0.5), '#A5A19B'],
      [gen_T(new THREE.SphereBufferGeometry(0.045, 6, 4), 0, 0.025, 0.79), '#B23A2E'],
      [new THREE.ConeBufferGeometry(0.014, 0.14, 4).rotateX(Math.PI / 2).translate(0, 0.02, 0.9), '#2A2622'],
      [new THREE.CylinderBufferGeometry(0.01, 0.01, 0.7, 4).rotateX(Math.PI / 2).translate(0.03, -0.02, -0.6), '#2A2622'],
      [new THREE.CylinderBufferGeometry(0.01, 0.01, 0.7, 4).rotateX(Math.PI / 2).translate(-0.03, -0.02, -0.6), '#2A2622']]);
    var wl = gen_wing(0.95, 0.34, 0.1, '#99958F', '#3A3734', 1), wr = gen_wing(0.95, 0.34, 0.1, '#99958F', '#3A3734', -1);
    var fl = gen_flock(S, n, body, wl, wr, gen_vmat(0.9, { side: THREE.DoubleSide }));
    fl.parts.forEach(function (m) { W.pick(m, 'Sandhill Cranes', line); });
    var D = rf(r, 70, 120), c = W.cam.pos, dirMid = gen_dir(S, -S.shift, rf(r, 0.55, 0.78));
    var anchor = c.clone().addScaledVector(dirMid, D), sgn = r() < 0.5 ? -1 : 1, yaw0 = rf(r, -0.25, 0.25);
    var fwd = S.rt.clone().multiplyScalar(sgn).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw0).normalize();
    var lat = new THREE.Vector3(-fwd.z, 0, fwd.x), Lh = D * S.th * 1.5 + 40, s0 = rf(r, -0.25, 0.25) * D * S.th, sp = rf(r, 12, 16);
    var offs = [];
    for (var i = 0; i < n; i++) {
      var k = Math.ceil(i / 2), sd = i % 2 ? 1 : -1;
      offs.push({ b: -k * 2.3 + rf(r, -0.4, 0.4), l: sd * k * 1.7 + rf(r, -0.3, 0.3), y: rf(r, -0.5, 0.5) - k * 0.15, ph: k * 0.55 + r() * 0.3 });
    }
    var p = new THREE.Vector3(), yaw = Math.atan2(fwd.x, fwd.z);
    W.onUpdate(function (ctx) {
      var on = ctx.sun.el > -9;
      fl.parts.forEach(function (m) { gen_show(m, on); });
      if (!on) return;
      var t = ctx.real, s = ((t * sp + s0 + Lh) % (2 * Lh) + 2 * Lh) % (2 * Lh) - Lh;
      for (var i = 0; i < offs.length; i++) {
        var o = offs[i];
        p.copy(anchor).addScaledVector(fwd, s + o.b).addScaledVector(lat, o.l);
        p.y += o.y + Math.sin(t * 0.6 + o.ph) * 0.3;
        fl.set(i, p, yaw, 0, 0, Math.sin(t * 4.2 - o.ph) * 0.45, 1);
      }
      fl.done();
    });
  }
  function gen_owl(S) {
    var W = S.W, r = S.r, R = S.R, H = S.H, cast = S.cast, hero = S.hero.group, line = GEN_BIRD_LINE['Great Horned Owl'];
    // the highest level ledge of the clock, if it has one within reach
    var best = null;
    for (var i = 0; i < 60; i++) {
      var a = r() * 6.28, d = Math.sqrt(r()) * R * 0.6, x = Math.cos(a) * d, z = Math.sin(a) * d;
      var h = cast(x, H + 3, z, 0, -1, 0, H + 3);
      if (h && h.n.y > 0.8 && h.p.y > H * 0.55 && (!best || h.p.y > best.y)) best = h.p;
    }
    var owl = new THREE.Group(), brown = std('#6B5540', 0.95), belly = std('#B09878', 0.95), face = std('#C49A6C', 0.9);
    var bd = sph(0.13, brown, 10, 8); bd.scale.set(1, 1.45, 0.95); bd.position.y = 0.2; owl.add(bd);
    var bl = sph(0.1, belly, 10, 8); bl.scale.set(1, 1.35, 0.6); bl.position.set(0, 0.18, 0.06); owl.add(bl);
    var tail = box(0.1, 0.14, 0.03, brown); tail.position.set(0, 0.04, -0.09); tail.rotation.x = 0.3; owl.add(tail);
    var head = new THREE.Group(); head.position.y = 0.39; owl.add(head);
    var hd = sph(0.105, brown, 10, 8); hd.scale.set(1.1, 0.95, 1); head.add(hd);
    var fd = sph(0.085, face, 10, 8); fd.scale.set(1.15, 0.95, 0.4); fd.position.z = 0.065; head.add(fd);
    var eyeM = W.glow(glowMat('#FFC21A', 0.15), 0.15, 0.9); eyeM.color = C('#E8A812');
    var pupil = std('#050505', 0.2);
    [-1, 1].forEach(function (sd) {
      var ey = sph(0.024, eyeM, 8, 6); ey.position.set(sd * 0.038, 0.012, 0.092); head.add(ey);
      var pu = sph(0.012, pupil, 6, 4); pu.position.set(sd * 0.038, 0.012, 0.113); head.add(pu);
      var tuft = new THREE.Mesh(new THREE.ConeBufferGeometry(0.022, 0.08, 4), brown); tuft.position.set(sd * 0.06, 0.1, 0); tuft.rotation.z = -sd * 0.35; head.add(tuft);
    });
    var bk = new THREE.Mesh(new THREE.ConeBufferGeometry(0.012, 0.035, 4), pupil); bk.rotation.x = Math.PI / 2 + 0.6; bk.position.set(0, -0.02, 0.11); head.add(bk);
    shade(owl);
    var perch;
    if (best && best.y < 14) {
      var local = hero.worldToLocal(best.clone());
      owl.position.copy(local); hero.add(owl);
      owl.rotation.y = Math.atan2(W.cam.pos.x - best.x, W.cam.pos.z - best.z) - hero.rotation.y + rf(r, -0.5, 0.5);
      owl.scale.setScalar(clamp(H / 6, 1, 1.6));
    } else {
      // a dead snag near the clock
      var sp = gen_spot(S, { dA: R + 1.5, dB: R + 9, psiA: 12, psiB: 165, rad: 0.8, y: 2.5, ndc: 0.85 });
      if (!sp) return;
      perch = new THREE.Group(); var wood = mtl('#8A8175', 'wood', 1, 0, 0.8), sh = rf(r, 2.6, 3.4);
      var tr = cyl(0.07, 0.13, sh, 7, wood); tr.position.y = sh / 2; perch.add(tr);
      for (i = 0; i < 4; i++) {
        var bl2 = rf(r, 0.5, 1.1), br = cyl(0.02, 0.045, bl2, 5, wood), ba = r() * 6.28, by = sh * rf(r, 0.45, 0.85);
        br.geometry.translate(0, bl2 / 2, 0); br.position.set(0, by, 0); br.rotation.set(Math.cos(ba) * 0.9, 0, Math.sin(ba) * 0.9); perch.add(br);
      }
      shade(perch); perch.position.set(sp.x, sp.y, sp.z); S.box.add(perch);
      W.pick(perch, 'Great Horned Owl', 'A dead snag. After dark a great horned owl sits on top of it.');
      owl.position.set(0, sh - 0.02, 0); owl.rotation.y = Math.atan2(W.cam.pos.x - sp.x, W.cam.pos.z - sp.z); perch.add(owl);
    }
    W.pick(owl, 'Great Horned Owl', line);
    var looks = [0, -1.2, 0.3, 1.5, -0.4, 0.9], ph = r() * 20;
    W.onUpdate(function (ctx) {
      var on = ctx.sun.el < 4;
      gen_show(owl, on);
      if (!on) return;
      var t = ctx.real + ph, k = Math.floor(t / 5.5), f = sstep(0, 0.12, (t / 5.5) - k);
      head.rotation.y = lerp(looks[(k + 5) % 6], looks[k % 6], f);
      var bl3 = (t % 7.3) < 0.14 ? 0.15 : 1;
      head.children.forEach(function (o) { if (o.material === eyeM) o.scale.y = bl3; });
    });
  }

  // ------------------------------------------------------------ sky events
  var GEN_SKY_LINE = {
    'Contrail': 'A contrail at about ten kilometres. Up there the sun sets a few minutes later, so it stays pink after the ground goes blue.',
    'Rainbow': 'A monsoon rainbow, 42 degrees from the point opposite the sun, with the faint second bow outside it. It only stands while the sun is low and behind you.',
    'Sun Dogs': 'Sun dogs: two bright spots either side of the sun, from flat ice crystals in thin cloud. They sit 22 degrees out and drift wider as the sun climbs.',
    'Virga': 'Virga: rain that falls out of the cloud and dries up before it reaches the desert.',
    'Meteor Shower': 'A meteor shower. Every streak runs back to one radiant, placed for tonight: the Lyrids in April, the Perseids in August, the Geminids in December.'
  };
  function gen_skyEvent(S) {
    var kind = S.g.skyEvent, W = S.W;
    if (kind === 'None') return;
    // clicking the sky tells you what is in it, while it is there
    var proxy = new THREE.Mesh(new THREE.SphereBufferGeometry(4200, 16, 8, 0, 6.2832, 0, 1.5), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    proxy.visible = false; S.box.add(proxy); W.pick(proxy, kind, GEN_SKY_LINE[kind]);
    S.skyProxy = proxy;
    var fn = { 'Contrail': gen_contrail, 'Rainbow': gen_halo, 'Sun Dogs': gen_halo, 'Virga': gen_virga, 'Meteor Shower': gen_meteors }[kind];
    var upd = fn(S, kind);
    W.onUpdate(function (ctx) {
      proxy.position.copy(ctx.camera.position);
      var on = upd(ctx);
      proxy.layers.set(on ? 0 : 31);
    });
  }
  // rainbow and sun dogs: a shader on a sphere round the camera, the angles
  // measured from the real sun every frame
  function gen_halo(S, kind) {
    var rain = kind === 'Rainbow';
    var U = { sunDir: { value: new THREE.Vector3(0, 1, 0) }, vis: { value: 0 }, p1: { value: new THREE.Vector3() }, p2: { value: new THREE.Vector3() }, dD: { value: 22 }, ph: { value: S.r() * 6.28 } };
    var mat = new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      defines: rain ? { GEN_RAIN: 1 } : { GEN_DOGS: 1 },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 sunDir; uniform float vis; uniform vec3 p1; uniform vec3 p2; uniform float dD; uniform float ph;',
        'varying vec3 vDir;',
        'vec3 spec(float x) { float h = (1.0 - clamp(x, 0.0, 1.0)) * 0.76; vec3 p = abs(fract(vec3(h) + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return clamp(p - 1.0, 0.0, 1.0); }',
        'float band(float x) { return smoothstep(0.0, 0.3, x) * (1.0 - smoothstep(0.7, 1.0, x)); }',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  if (d.y < -0.005) discard;',
        '  vec3 col = vec3(0.0);',
        '#ifdef GEN_RAIN',
        '  float a = degrees(acos(clamp(dot(d, -sunDir), -1.0, 1.0)));',
        '  float x1 = (a - 40.5) / 2.0;',
        '  col += spec(x1) * band(x1) * 0.42;',
        '  float x2 = (53.8 - a) / 3.4;',
        '  col += spec(x2) * band(x2) * 0.13;',
        '  col += vec3(0.05, 0.055, 0.06) * (1.0 - smoothstep(30.0, 40.5, a));',
        '  float az = atan(d.x, d.z);',
        '  col *= (0.55 + 0.45 * sin(az * 3.0 + ph)) * smoothstep(-0.005, 0.05, d.y);',
        '#endif',
        '#ifdef GEN_DOGS',
        '  float a = degrees(acos(clamp(dot(d, sunDir), -1.0, 1.0)));',
        '  col += mix(vec3(0.9, 0.35, 0.12), vec3(0.9, 0.95, 1.0), smoothstep(21.4, 23.6, a)) * exp(-pow((a - 22.3) / 0.9, 2.0)) * 0.07;',
        '  float el = asin(clamp(sunDir.y, -1.0, 1.0)), de = degrees(asin(clamp(d.y, -1.0, 1.0)) - el);',
        '  for (int i = 0; i < 2; i++) {',
        '    vec3 p = i == 0 ? p1 : p2;',
        '    float ad = degrees(acos(clamp(dot(d, p), -1.0, 1.0)));',
        '    float dh = sqrt(max(ad * ad - de * de, 0.0));',
        '    float out1 = step(degrees(acos(clamp(dot(p, sunDir), -1.0, 1.0))), a);',
        '    float spot = exp(-de * de / 0.7 - dh * dh / 1.1);',
        '    float tail = exp(-de * de / 0.35) * exp(-dh / 5.0) * out1 * 0.35;',
        '    vec3 c = mix(vec3(1.0, 0.42, 0.16), vec3(0.95, 0.97, 1.0), smoothstep(dD - 0.7, dD + 1.4, a));',
        '    col += c * (spot * 1.1 + tail * 0.4);',
        '  }',
        '  col += vec3(1.0) * exp(-de * de / 0.12) * 0.035 * smoothstep(40.0, 10.0, abs(a - dD));',
        '#endif',
        '  gl_FragColor = vec4(col * vis, 1.0);',
        '}'
      ].join('\n')
    });
    var sph2 = new THREE.Mesh(new THREE.SphereBufferGeometry(4000, 96, 48), mat);
    sph2.frustumCulled = false; sph2.renderOrder = 2;
    S.box.add(sph2);
    return function (ctx) {
      var sun = ctx.sun, v;
      sph2.position.copy(ctx.camera.position);
      dirAzEl(sun.az, sun.el, U.sunDir.value);
      if (rain) v = sstep(0.3, 2.5, sun.el) * (1 - sstep(38, 42, sun.el));
      else {
        var e = Math.max(sun.el, 0) * D2R, n = 1.31, np = Math.sqrt(n * n - Math.sin(e) * Math.sin(e)) / Math.cos(e), sd = np * 0.5;
        var D = sd < 1 ? 2 * Math.asin(sd) * R2D - 60 : 90;
        U.dD.value = D;
        dirAzEl(sun.az - D, sun.el, U.p1.value); dirAzEl(sun.az + D, sun.el, U.p2.value);
        v = sstep(-1, 1.5, sun.el) * (1 - sstep(45, 58, sun.el));
      }
      U.vis.value = v;
      gen_show(sph2, v > 0.003);
      return v > 0.003;
    };
  }
  function gen_contrail(S) {
    var r = S.r, N = 64, R0 = 3900, pos = new Float32Array((N + 1) * 2 * 3), al = new Float32Array((N + 1) * 2), xs = new Float32Array((N + 1) * 2), idx = [];
    for (var i = 0; i < N; i++) { var a = i * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, b, c2, b, d, c2); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('gnA', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage));
    for (i = 0; i <= N; i++) { xs[i * 2] = -1; xs[i * 2 + 1] = 1; }
    geo.setAttribute('gnX', new THREE.BufferAttribute(xs, 1));
    geo.setIndex(idx);
    var U = { col: { value: new THREE.Color(1, 1, 1) }, vis: { value: 0 } };
    var mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      vertexShader: 'attribute float gnA; attribute float gnX; varying float vA; varying float vX; void main(){ vA = gnA; vX = gnX; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 col; uniform float vis; varying float vA; varying float vX; void main(){ gl_FragColor = vec4(col, vA * exp(-vX * vX * 3.0) * vis); }'
    });
    var m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 1;
    S.box.add(m);
    // a great circle across the top of the frame, entering and leaving it
    var y1 = rf(r, 0.35, 0.8), y2 = y1 + rf(r, -0.3, 0.3), sgn = r() < 0.5 ? -1 : 1;
    var dA = gen_dir(S, -1.5 * sgn - S.shift, y1), dB = gen_dir(S, 1.5 * sgn - S.shift, y2);
    [dA, dB].forEach(function (d) { if (d.y < 0.08) { d.y = 0.08; d.normalize(); } });
    var om = Math.acos(clamp(dA.dot(dB), -1, 1)), so = Math.sin(om), s0 = rf(r, 0.62, 0.95), speed = 0.0035, trail = 0.75;
    var P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), X = new THREE.Vector3(), V = new THREE.Vector3();
    var pink = C('#FF9A7A'), white = new THREE.Color(1, 1, 1);
    function at(s, out) { return out.copy(dA).multiplyScalar(Math.sin((1 - s) * om) / so).addScaledVector(dB, Math.sin(s * om) / so).normalize(); }
    return function (ctx) {
      var el = ctx.sun.el, v = sstep(-7, -1.5, el) * (S.W.P.sky === 'Monsoon' ? 0.6 : 1);
      gen_show(m, v > 0.01);
      if (v <= 0.01) return false;
      U.vis.value = v; U.col.value.copy(pink).lerp(white, sstep(-1, 9, el)).multiplyScalar(0.55 + 0.45 * sstep(-4, 8, el));
      var head = ((s0 + ctx.real * speed) % 1.6) - 0.1, cp = ctx.camera.position;
      for (var i = 0; i <= N; i++) {
        var u = i / N, s = head - trail * u;
        at(s, P); at(s + 0.002, Q); T.copy(Q).sub(P).normalize();
        X.crossVectors(T, P).normalize();
        var w = R0 * (0.0018 + 0.018 * Math.pow(u, 0.8));
        var alpha = Math.pow(1 - u, 1.2) * sstep(0, 0.02, u) * (1 - 0.35 * u) * 0.85;
        V.copy(P).multiplyScalar(R0).add(cp);
        pos[i * 6] = V.x + X.x * w; pos[i * 6 + 1] = V.y + X.y * w; pos[i * 6 + 2] = V.z + X.z * w;
        pos[i * 6 + 3] = V.x - X.x * w; pos[i * 6 + 4] = V.y - X.y * w; pos[i * 6 + 5] = V.z - X.z * w;
        al[i * 2] = al[i * 2 + 1] = alpha;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.gnA.needsUpdate = true;
      return true;
    };
  }
  function gen_virga(S) {
    var W = S.W, r = S.r, c = W.cam.pos, tex = canvasTex(512, 512, function (g, w, h) {
      var rr = seedRng(S.g.seed ^ 77), i;
      g.clearRect(0, 0, w, h);
      // streaks first, slanted with the wind, fading downward
      var slant = rf(rr, -0.25, 0.25);
      for (i = 0; i < 220; i++) {
        var x = w * (0.12 + 0.76 * rr()), len = h * rf(rr, 0.25, 0.62), y0 = h * 0.26, lw = rf(rr, 1.5, 7);
        var gr = g.createLinearGradient(0, y0, 0, y0 + len);
        var a = rf(rr, 0.05, 0.16) * (1 - Math.abs(x / w - 0.5) * 1.3);
        gr.addColorStop(0, 'rgba(120,128,142,' + a + ')'); gr.addColorStop(1, 'rgba(120,128,142,0)');
        g.strokeStyle = gr; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + slant * len * 0.3, y0 + len * 0.5, x + slant * len, y0 + len); g.stroke();
      }
      // the cloud: soft lumps, dark underneath
      for (i = 0; i < 60; i++) {
        var cx = w * rf(rr, 0.1, 0.9), cy = h * rf(rr, 0.12, 0.28), rx = w * rf(rr, 0.05, 0.14);
        var gg = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
        var tone = Math.floor(rf(rr, 150, 205));
        gg.addColorStop(0, 'rgba(' + tone + ',' + tone + ',' + (tone + 8) + ',0.55)'); gg.addColorStop(1, 'rgba(' + tone + ',' + tone + ',' + (tone + 8) + ',0)');
        g.fillStyle = gg; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.55, 0, 0, 6.2832); g.fill();
      }
    });
    var mats = [], meshes = [];
    for (var k = 0; k < 2; k++) {
      var D = rf(r, 2300, 2800), fx = (k ? rf(r, -0.9, -0.3) : rf(r, 0.2, 0.8)) * (r() < 0.5 ? 1 : -1) - S.shift;
      var d0 = gen_dir(S, fx, 0), baseEl = Math.asin(d0.y);
      // the frame's own top edge decides how high the cloud can sit
      var topEl = Math.asin(gen_dir(S, fx, 0.95).y), cloudEl = Math.min(topEl - 1.2 * D2R, 13 * D2R), lowEl = Math.max(2.2 * D2R, cloudEl - 9 * D2R);
      if (cloudEl < lowEl + 2 * D2R) cloudEl = lowEl + 3 * D2R;
      // texture: cloud base at 28% from the top, streaks gone by 90%
      var az = Math.atan2(d0.x, -d0.z), botY = c.y + D * Math.tan(lowEl), cloudY = c.y + D * Math.tan(cloudEl);
      var hgt = (cloudY - botY) / 0.62, width = hgt * rf(r, 1.1, 1.8) * (k ? 0.7 : 1);
      var mid = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az)).multiplyScalar(D);
      mid.y = cloudY + 0.28 * hgt - 0.5 * hgt;
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1, 1, 1) });
      var pl = new THREE.Mesh(new THREE.PlaneBufferGeometry(width, hgt), mat);
      pl.position.set(c.x + mid.x, mid.y, c.z + mid.z); pl.lookAt(c.x, mid.y, c.z); pl.renderOrder = 1;
      if (k) pl.scale.x = -1;
      S.box.add(pl); mats.push(mat); meshes.push(pl);
    }
    var warm = C('#F2B48C'), day = new THREE.Color(1, 1, 1), night = C('#3A4258');
    return function (ctx) {
      var el = ctx.sun.el, lit = sstep(-8, 8, el);
      for (var i = 0; i < mats.length; i++) {
        mats[i].color.copy(night).lerp(day, lit).lerp(warm, (1 - sstep(2, 14, el)) * lit * 0.6);
        mats[i].opacity = 0.35 + 0.65 * lit;
      }
      return true;
    };
  }
  // meteor showers by peak day of year: RA hours, Dec degrees
  var GEN_SHOWERS = [[3, 15.33, 49.5], [112, 18.07, 33.6], [126, 22.5, -1], [224, 3.2, 58], [294, 6.33, 15.8], [321, 10.28, 21.6], [348, 7.47, 32.5]];
  function gen_meteors(S) {
    var r = S.r, N = 16, R0 = 3800, pos = new Float32Array(N * 4 * 3), col = new Float32Array(N * 4 * 3), idx = [];
    for (var i = 0; i < N; i++) { var b = i * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    var m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 1;
    S.box.add(m);
    var met = [], rad = new THREE.Vector3(), A = new THREE.Vector3(), T = new THREE.Vector3(), H = new THREE.Vector3(), Tl = new THREE.Vector3(), X = new THREE.Vector3(), V = new THREE.Vector3(), E = new THREE.Vector3();
    for (i = 0; i < N; i++) met.push({ on: false, s: new THREE.Vector3(), t: new THREE.Vector3(), len: 0, dur: 1, u: 0, b: 1 });
    var wait = 0, started = false, tint = C('#D8F0FF');
    function spawn(M, cam, inFrame, u0) {
      // a start point: in the frame, or anywhere above the horizon
      for (var k = 0; k < 12; k++) {
        if (inFrame) {
          var fx = rf(r, -0.95, 0.95), fy = rf(r, -0.2, 0.95), tv = Math.tan(cam.fov * D2R / 2);
          A.set(fx * tv * cam.aspect, fy * tv, -1).applyQuaternion(cam.quaternion).normalize();
        } else A.set(rf(r, -1, 1), rf(r, 0.08, 1), rf(r, -1, 1)).normalize();
        if (A.y < 0.06) continue;
        var cr = A.dot(rad);
        if (cr > 0.985) continue;
        T.copy(A).addScaledVector(rad, -cr).normalize();   // away from the radiant
        M.s.copy(A).addScaledVector(T, -rf(r, 0.02, 0.12)).normalize();
        M.t.copy(T); M.len = rf(r, 0.1, 0.4); M.dur = rf(r, 0.35, 1.0); M.u = u0; M.b = rf(r, 0.5, 1.2); M.on = true;
        return;
      }
    }
    return function (ctx) {
      var el = ctx.sun.el, v = sstep(-6, -12, el) * (S.W.P.sky === 'Dust' ? 0.55 : 1);
      gen_show(m, v > 0.01);
      if (v <= 0.01) { started = false; return false; }
      // the radiant for the nearest shower, in the sky right now
      var doy = dayOfYear(ctx.t), best = GEN_SHOWERS[0], bd = 999;
      for (var i = 0; i < GEN_SHOWERS.length; i++) { var dd = Math.abs(((doy - GEN_SHOWERS[i][0]) % 365 + 547) % 365 - 182); if (dd < bd) { bd = dd; best = GEN_SHOWERS[i]; } }
      var Hh = lst(ctx.utc) - best[1] * 15 * D2R, dec = best[2] * D2R;
      var ralt = Math.asin(SPHI * Math.sin(dec) + CPHI * Math.cos(dec) * Math.cos(Hh)) * R2D;
      var raz = Math.atan2(-Math.sin(Hh), Math.tan(dec) * CPHI - SPHI * Math.cos(Hh)) * R2D;
      dirAzEl(raz, ralt, rad);
      var cam = ctx.camera, cp = cam.position;
      if (!started || ctx.snap) {
        started = true;
        for (i = 0; i < N; i++) met[i].on = false;
        var k0 = ri(r, 6, 9);
        for (i = 0; i < k0; i++) spawn(met[i], cam, i < k0 - 2, rf(r, 0.25, 0.85));
      }
      wait -= ctx.dt;
      if (wait <= 0) {
        wait = rf(r, 0.25, 1.2);
        for (i = 0; i < N; i++) if (!met[i].on) { spawn(met[i], cam, r() < 0.45, 0); break; }
      }
      for (i = 0; i < N; i++) {
        var M = met[i], o = i * 12;
        if (M.on) { M.u += ctx.dt / M.dur; if (M.u >= 1) M.on = false; }
        if (!M.on) { for (var z = 0; z < 12; z++) { pos[o + z] = 0; col[o + z] = 0; } continue; }
        var hd = M.len * M.u, tl = Math.max(0, hd - M.len * 0.55);
        H.copy(M.s).addScaledVector(M.t, hd).normalize(); Tl.copy(M.s).addScaledVector(M.t, tl).normalize();
        X.crossVectors(M.t, H).normalize();
        var br = Math.sin(Math.PI * M.u) * M.b * v, w = R0 * 0.0011 * (0.6 + br);
        V.copy(H).multiplyScalar(R0).add(cp); E.copy(Tl).multiplyScalar(R0).add(cp);
        pos[o] = V.x + X.x * w; pos[o + 1] = V.y + X.y * w; pos[o + 2] = V.z + X.z * w;
        pos[o + 3] = V.x - X.x * w; pos[o + 4] = V.y - X.y * w; pos[o + 5] = V.z - X.z * w;
        pos[o + 6] = E.x + X.x * w * 0.3; pos[o + 7] = E.y + X.y * w * 0.3; pos[o + 8] = E.z + X.z * w * 0.3;
        pos[o + 9] = E.x - X.x * w * 0.3; pos[o + 10] = E.y - X.y * w * 0.3; pos[o + 11] = E.z - X.z * w * 0.3;
        for (z = 0; z < 2; z++) { col[o + z * 3] = tint.r * br * 2.2; col[o + z * 3 + 1] = tint.g * br * 2.2; col[o + z * 3 + 2] = tint.b * br * 2.2; }
        for (z = 2; z < 4; z++) { col[o + z * 3] = 0; col[o + z * 3 + 1] = 0; col[o + z * 3 + 2] = 0; }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      return true;
    };
  }
