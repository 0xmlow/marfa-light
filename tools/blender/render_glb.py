"""
Render an exported Marfa Light token in Cycles, lit by the real sun.

  Blender --background --factory-startup --python tools/blender/render_glb.py -- token.glb token.json out.png [samples] [width]

The JSON (written by tools/export-glb.js) carries the token's camera and the
sun's azimuth and elevation for the exported minute. glTF is Y up and Blender
is Z up, so a three.js vector (x, y, z) becomes (x, -z, y).
"""
import bpy, json, math, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
glb, info_path, out = args[0], args[1], args[2]
samples = int(args[3]) if len(args) > 3 else 96
width = int(args[4]) if len(args) > 4 else 1800
info = json.load(open(info_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
scene = bpy.context.scene
# the GLB carries its own Sun light and Hero Camera; this script sets both itself
for o in list(scene.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)

def b(v):  # three.js to Blender axes
    return Vector((v[0], -v[2], v[1]))

def dir_az_el(az, el):
    a, e = math.radians(az), math.radians(el)
    return [math.cos(e) * math.sin(a), math.sin(e), -math.cos(e) * math.cos(a)]

# camera
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam); scene.camera = cam
cam.location = b(info['camera']['pos'])
look = b(info['camera']['target']) - cam.location
cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
cam_data.sensor_fit = 'VERTICAL'; cam_data.angle = math.radians(info['camera']['fov'])
cam_data.clip_end = 9000

# the sun, or the moon when the sun is down
sun, moon = info['sun'], info['moon']
body = sun if sun['el'] > -1 else moon
d = b(dir_az_el(body['az'], max(body['el'], 0.5)))
light_data = bpy.data.lights.new('sun', 'SUN')
light_data.energy = 4.2 if body is sun else 0.25 * moon.get('illum', 1)
light_data.angle = math.radians(0.53)
light_data.color = (1.0, 0.93, 0.82) if body is sun else (0.7, 0.78, 1.0)
light = bpy.data.objects.new('sun', light_data); scene.collection.objects.link(light)
light.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()

# a physical sky with the same sun
world = bpy.data.worlds.new('sky'); scene.world = world; world.use_nodes = True
nt = world.node_tree; bg = nt.nodes['Background']
sky = nt.nodes.new('ShaderNodeTexSky')
for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'HOSEK_WILKIE'):
    try:
        sky.sky_type = t; break
    except Exception:
        pass
try:
    sky.sun_elevation = math.radians(max(sun['el'], -5)); sky.sun_rotation = math.radians(-sun['az'] + 90)
except Exception:
    pass
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.35 if sun['el'] > 0 else 0.05

# render
scene.render.engine = 'CYCLES'
scene.cycles.samples = samples
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for dv in prefs.devices: dv.use = True
    scene.cycles.device = 'GPU'
except Exception:
    scene.cycles.device = 'CPU'
scene.render.resolution_x = width; scene.render.resolution_y = int(width * 2 / 3)
for vt in ('AgX', 'Filmic'):
    try:
        scene.view_settings.view_transform = vt; break
    except Exception:
        pass
scene.view_settings.exposure = 0.0 if sun['el'] > 8 else 0.8
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
