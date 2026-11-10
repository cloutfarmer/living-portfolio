"""Build the corner desk from source. Refuses to overwrite a checkpoint.

/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 \
  --python blender/scripts/build_scene.py -- blender/scenes/corner-desk-vNNN.blend
"""
import importlib
import re
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.builders import reset_scene  # noqa: E402
from lib.layout import SHIFTS, scale_to_person  # noqa: E402
from lib.materials import build_materials  # noqa: E402

PROPS = ('room', 'desk', 'monitors', 'input_devices', 'desk_clutter', 'smoothie', 'cables', 'candle', 'window', 'shelf', 'pc',
         'bag', 'trainers', 'dumbbells', 'soccer_ball', 'side_table', 'table_items', 'sports_corner', 'wall_shelf', 'chair',
         'character', 'lighting')  # lighting last: it keys the candle's flame.

out = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
assert not out.exists(), f'Refusing to overwrite checkpoint {out}'
version = re.search(r'v(\d+)\.blend$', out.name)
assert version, 'Output must be named like corner-desk-v016.blend'

scene = reset_scene(f'CornerDesk_v{version[1]}')
build_materials()
for name in PROPS:
    before = {obj.name for obj in bpy.data.objects}
    importlib.import_module(f'props.{name}').build()
    for obj in bpy.data.objects:
        if obj.name not in before:
            obj.location.x += SHIFTS.get(name, 0)
            scale_to_person(obj, name)

world = bpy.data.worlds.new('Cozy_world')
background = world.node_tree.nodes['Background']
background.inputs['Color'].default_value = (.035, .018, .075, 1)
background.inputs['Strength'].default_value = .18
scene.world = world

scene.camera = bpy.data.objects['ROOM']
scene.render.engine = 'CYCLES'
scene.render.resolution_x = scene.render.resolution_y = 1000
scene.render.fps = 24
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 12
scene.view_settings.view_transform = 'AgX'
scene.frame_start, scene.frame_end = 1, 120
scene.frame_set(18)

# The factory Shading workspace keeps a file browser whose folder defaults to the home folder, and the saved file
# would publish that path. Point it at the file's own folder instead.
for screen in bpy.data.screens:
    for area in screen.areas:
        for space in area.spaces:
            if space.type == 'FILE_BROWSER' and space.params:
                space.params.directory = b'//'

bpy.ops.wm.save_as_mainfile(filepath=str(out))
print(f'Built {out}: {len(scene.objects)} objects')
