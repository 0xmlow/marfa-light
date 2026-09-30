"""Pack the Blender relic JSON into src/06-relics.js as quantized base64.
Positions become 16 bit integers inside each relic's bounding box, indices
16 bit. Normals are recomputed in the browser, so they cost nothing."""
import json, base64, struct, glob, os, sys
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(os.path.dirname(here))
out = ['  // =====================================================================',
       '  // RELICS: sculpted in Blender (tools/blender/relics.py), packed here',
       '  // Positions are 16 bit inside each bounding box; indices are 16 bit.',
       '  // =====================================================================',
       '  var RELIC_DATA = {']
total = 0
for f in sorted(glob.glob(os.path.join(here, 'out', '*.json'))):
    d = json.load(open(f))
    p = d['pos']; n = len(p) // 3
    mn = [min(p[k::3]) for k in range(3)]; mx = [max(p[k::3]) for k in range(3)]
    sc = [(mx[k] - mn[k]) or 1 for k in range(3)]
    q = b''.join(struct.pack('<H', int(round((p[i * 3 + k] - mn[k]) / sc[k] * 65535))) for i in range(n) for k in range(3))
    ix = b''.join(struct.pack('<H', i) for i in d['idx'])
    pb, ib = base64.b64encode(q).decode(), base64.b64encode(ix).decode()
    total += len(pb) + len(ib)
    g = [[round(v, 3) for v in row] for row in d['geodes']]
    # 8 KB pieces: one long string cannot be line-wrapped, and ABX joins onchain chunks with a newline
    cut = lambda b64: '[%s]' % ', '.join("'%s'" % b64[k:k + 8000] for k in range(0, len(b64), 8000))
    out.append("    '%s': { box: %s, p: %s, i: %s, geodes: %s }," % (d['name'], json.dumps([round(v, 4) for v in mn + sc]), cut(pb), cut(ib), json.dumps(g)))
out += ['  };',
        '  var _relicGeo = {};',
        '  function relicBytes(s) { if (typeof s !== "string") s = s.join(""); var b = (typeof atob === "function") ? atob(s) : Buffer.from(s, "base64").toString("binary"); var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }',
        '  function relicGeometry(name) {',
        '    if (_relicGeo[name]) return _relicGeo[name];',
        '    var d = RELIC_DATA[name], pb = relicBytes(d.p), ib = relicBytes(d.i);',
        '    var pv = new DataView(pb.buffer), iv = new DataView(ib.buffer), n = pb.length / 6, pos = new Float32Array(n * 3), idx = new Uint16Array(ib.length / 2);',
        '    for (var i = 0; i < n * 3; i++) pos[i] = d.box[i % 3] + pv.getUint16(i * 2, true) / 65535 * d.box[3 + i % 3];',
        '    for (i = 0; i < idx.length; i++) idx[i] = iv.getUint16(i * 2, true);',
        '    var g = new THREE.BufferGeometry();',
        '    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));',
        '    g.setIndex(new THREE.BufferAttribute(idx, 1));',
        '    g.computeVertexNormals();',
        '    g.userData = { shared: true };',
        '    return (_relicGeo[name] = g);',
        '  }']
open(os.path.join(root, 'src', '06-relics.js'), 'w').write('\n'.join(out) + '\n')
print('packed, base64 bytes:', total)
