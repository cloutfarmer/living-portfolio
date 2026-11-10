"""Render one sheet of fixed views. The same angles every round make changes comparable, and they
catch what the 3/4 ROOM view hides. Never saves the scene.

Blender --background --factory-startup <scene.blend> --python-exit-code 1 --python blender/scripts/tools/review_sheet.py -- <out.png>

Top row: ROOM as lit, then orthographic top, front, right, and from the wall side.
Bottom row: four perspective corners around the desk. Those views use flat grey light and
hide the walls, because the job here is reading shapes rather than judging the mood.
"""
import sys
import tempfile
from pathlib import Path

import bpy
import numpy
from mathutils import Vector

CELL = 480
DESK = Vector((.9, .5, 1.3))
ORTHO = [('top', (0, 0, 8), 6.5), ('front', (0, -8, 0), 6.5), ('right', (8, 0, 0), 6.5), ('wall_side', (-8, 4, 3), 6.5)]
CORNERS = [(-1.9, -3, 2.6), (4.1, -3, 2.6), (4.1, 3.2, 2.6), (-1.9, 3.2, 2.6)]
WALLS = ('Back_wall', 'Left_wall', 'Back_baseboard', 'Left_baseboard', 'Blind_', 'Window_', 'Shelf', 'Spine_label')

out = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
scene = bpy.context.scene
scene.render.resolution_x = scene.render.resolution_y = CELL
scene.render.image_settings.file_format = 'PNG'
scene.cycles.samples = 16


def shoot(camera, path):
    scene.camera = camera
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def aimed_camera(name, position, target, ortho=None):
    data = bpy.data.cameras.new(name)
    if ortho:
        data.type = 'ORTHO'
        data.ortho_scale = ortho
    else:
        data.lens = 35
    camera = bpy.data.objects.new(name, data)
    scene.collection.objects.link(camera)
    camera.location = position
    camera.rotation_euler = (target - Vector(position)).to_track_quat('-Z', 'Y').to_euler()
    return camera


with tempfile.TemporaryDirectory() as folder:
    shots = [Path(folder) / 'room.png']
    shoot(bpy.data.objects['ROOM'], shots[0])

    # Flat, even light for reading shape. All of this is in memory only.
    for obj in scene.objects:
        if obj.type == 'LIGHT':
            obj.hide_render = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.8, .8, .8, 1)
    background.inputs['Strength'].default_value = 1
    walls = [o for o in scene.objects if o.name.startswith(WALLS)]

    center = Vector((.8, 0, 1.2))
    for name, offset, size in ORTHO:
        path = Path(folder) / f'{name}.png'
        camera = aimed_camera(name, center + Vector(offset), center, ortho=size)
        for wall in walls:
            wall.hide_render = name in ('wall_side',)
        shoot(camera, path)
        shots.append(path)
    # Sideways: the wall hides the desk from three of these corners, so walls stay off.
    for wall in walls:
        wall.hide_render = True
    for index, position in enumerate(CORNERS):
        path = Path(folder) / f'corner{index}.png'
        shoot(aimed_camera(f'corner{index}', position, DESK), path)
        shots.append(path)

    # Tile: ROOM plus the four orthographic views on top, the corners underneath.
    tiles = []
    for shot in shots:
        image = bpy.data.images.load(str(shot))
        pixels = numpy.empty(CELL * CELL * 4, numpy.float32)
        image.pixels.foreach_get(pixels)
        tiles.append(pixels.reshape(CELL, CELL, 4))
        bpy.data.images.remove(image)
    blank = numpy.ones((CELL, CELL, 4), numpy.float32) * numpy.array((.05, .05, .05, 1), numpy.float32)
    # Image rows run bottom-up, so the corners come first in the stack.
    sheet = numpy.vstack((numpy.hstack(tiles[5:9] + [blank]), numpy.hstack(tiles[0:5])))
    height, width = sheet.shape[:2]
    result = bpy.data.images.new('review', width, height, alpha=True)
    result.pixels.foreach_set(sheet.ravel())
    result.filepath_raw = str(out)
    result.file_format = 'PNG'
    out.parent.mkdir(parents=True, exist_ok=True)
    result.save()
print(f'Review sheet: {out}')
