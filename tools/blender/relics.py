"""
Marfa Light relics, sculpted headless in Blender and packed into the token.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/relics.py -- out_dir

Each relic is built from primitives, voxel remeshed into one skin, eroded with
fractal noise on one side (Daniel Arsham's fictional archaeology: an object
found a thousand years from now), decimated to a small budget, and written as
JSON: positions, triangle indices, and the points where erosion ran deepest,
which is where the token grows blue calcite crystals.
"""
import bpy, bmesh, json, math, sys, os
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()


def cube(name, size, loc, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = o.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 3
        bpy.ops.object.modifier_apply(modifier='bev')
    return o


def cyl(name, r, depth, loc, rot):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=32)
    o = bpy.context.active_object
    o.name = name
    return o


def join(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    # bake the object's own transform into the mesh, so local coordinates are world coordinates
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def remesh(o, voxel, smooth=2):
    m = o.modifiers.new('rem', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='rem')
    if smooth:
        s = o.modifiers.new('sm', 'SMOOTH'); s.iterations = smooth; s.factor = 0.5
        bpy.ops.object.modifier_apply(modifier='sm')


def relax(o, it=3):
    s = o.modifiers.new('sm2', 'SMOOTH'); s.iterations = it; s.factor = 0.35
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='sm2')


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def erode(o, mask, depth, freq, thresh, seed):
    """Push vertices inward along their normals where fractal noise exceeds a
    threshold inside the mask, and pit the whole surface a little."""
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.normal_update()
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    deep = []
    for v in bm.verts:
        p = v.co
        n = noise.fractal(p * freq + off, 0.7, 2.1, 5)
        m = mask(p)
        d = max(0.0, n - thresh) * depth * m
        v.co = p - v.normal * d
        deep.append((d, tuple(v.co), tuple(v.normal)))
    bm.to_mesh(me); bm.free()
    deep.sort(key=lambda q: -q[0])
    # spread the crystal points out so they do not all land in one pit
    picked = []
    for d, co, nr in deep:
        if d <= 0.02:
            break
        if all((Vector(co) - Vector(q[0])).length > 0.22 for q in picked):
            picked.append((co, nr, d))
        if len(picked) >= 14:
            break
    return picked


def decimate(o, tris):
    me = o.data
    cur = sum(len(p.vertices) - 2 for p in me.polygons)
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1.0, tris / max(cur, 1))
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='dec')


def export(o, name, geodes, meta):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.index_update()
    pos = [c for v in bm.verts for c in (v.co.x, v.co.z, -v.co.y)]   # Blender Z up -> three Y up
    idx = [v.index for f in bm.faces for v in f.verts]
    gd = [[co[0], co[2], -co[1], nr[0], nr[2], -nr[1], d] for co, nr, d in geodes]
    bm.free()
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump({'name': name, 'pos': pos, 'idx': idx, 'geodes': gd, 'meta': meta}, f)
    print('RELIC', name, 'verts', len(pos) // 3, 'tris', len(idx) // 3, 'geodes', len(gd))


# ------------------------------------------------------------------ the taxi
# A 2010s NYC sedan cab, 4.9 m long, 1.9 m wide, 1.55 m tall, with its roof
# light. Eroded on the passenger side and the roof toward the back.
clear()
parts = [
    cube('body', (4.9, 1.9, 0.72), (0, 0, 0.62), 0.12),
    cube('cabin', (2.5, 1.72, 0.62), (-0.25, 0, 1.25), 0.18),
    cube('hood', (1.2, 1.84, 0.12), (1.7, 0, 1.0), 0.05),
    cube('topper', (1.1, 0.26, 0.34), (-0.25, 0, 1.72), 0.04),
]
for x in (1.55, -1.55):
    for y in (0.86, -0.86):
        parts.append(cyl('wheel', 0.34, 0.28, (x, y, 0.34), (math.pi / 2, 0, 0)))
taxi = join(parts)
remesh(taxi, 0.035)
mask = lambda p: smoothstep(0.1, 0.8, -p.y * 0.9 + 0.3 * (p.z - 0.8) - 0.25 * p.x)
geodes = erode(taxi, mask, 0.6, 1.2, 0.05, 3)
relax(taxi, 2)
decimate(taxi, 3000)
export(taxi, 'calcified_taxi', geodes, {'len': 4.9})

# ------------------------------------------------------------------ the eye
# The MLOW evil eye as a monolith: a standing stone disc with four concentric
# raised rings, broken open at the lower right.
clear()
disc = cyl('disc', 1.25, 0.42, (0, 0, 1.45), (math.pi / 2, 0, 0))
rings = []
for r, h in ((1.05, 0.08), (0.72, 0.1), (0.5, 0.12)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=h, location=(0, -0.2, 1.45), rotation=(math.pi / 2, 0, 0), major_segments=64, minor_segments=12)
    rings.append(bpy.context.active_object)
pupil = cyl('pupil', 0.3, 0.2, (0, -0.24, 1.45), (math.pi / 2, 0, 0))
base = cube('base', (1.3, 0.8, 0.3), (0, 0, 0.15), 0.06)
eye = join([disc, pupil, base] + rings)
remesh(eye, 0.03)
mask = lambda p: smoothstep(0.1, 0.9, (p.x * 0.8 - (p.z - 1.45) * 0.9) / 1.2)
geodes = erode(eye, mask, 0.45, 1.5, 0.05, 7)
relax(eye, 2)
decimate(eye, 2400)
export(eye, 'eroded_eye', geodes, {'center': [0, 1.45, 0]})
