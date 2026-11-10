import bpy
from mathutils import Matrix

from lib.builders import box

# The slats' tilt about their long axis today, and how far they turn when the visitor closes them in web/src/Room.tsx.
SLAT_TILT = .22
SLAT_CLOSED = 1.35


def closable(slat):
    """Bakes a slat's modifiers into its mesh, then keys it turned shut, which the site plays as a morph target.

    The exporter can't apply modifiers to a mesh with shape keys, so the bevel has to be in the mesh first.
    """
    bpy.context.view_layer.update()
    baked = bpy.data.meshes.new_from_object(slat.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    old = slat.data
    slat.modifiers.clear()
    slat.data = baked
    baked.name = slat.name
    bpy.data.meshes.remove(old)
    slat.shape_key_add(name='Basis')
    closed = slat.shape_key_add(name='Closed')
    closed.value = 0
    turn = Matrix.Rotation(SLAT_CLOSED - SLAT_TILT, 3, 'X')
    for point in closed.data:
        point.co = turn @ point.co


def build():
    box('Blind_cord', (0.366, 1.3, 2.432), (0.009, 0.009, 0.72), 'Paper_Ceramic', group='Room', scale=(1.1, 1, 1.06), bevel=0.002)
    box('Blind_cord.001', (1.554, 1.3, 2.432), (0.009, 0.009, 0.72), 'Paper_Ceramic', group='Room', scale=(1.1, 1, 1.06), bevel=0.002)
    box('Blind_header', (0.96, 1.36, 2.856), (1.51, 0.14, 0.09), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    for index in range(9):
        name = 'Blind_slat' + (f'.{index:03d}' if index else '')
        closable(box(name, (.96, 1.36, 2.7606 - 0.07738 * index), (1.38, .09, .026), 'Window_PaintedIvory', group='Room',
                     rot=(SLAT_TILT, 0, 0), scale=(1.1, 1, 1.06), bevel=.005))
    box('Window_center', (0.96, 1.468, 2.22), (0.035, 0.035, 1.15), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_dusk_pane', (0.96, 1.505, 2.22), (1.3, 0.012, 1.08), 'Window_Dusk', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_rail', (0.96, 1.47, 1.5628), (1.5, 0.14, 0.075), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_rail.001', (0.96, 1.47, 2.8772), (1.5, 0.14, 0.075), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_recess', (0.96, 1.57, 2.22), (1.42, 0.11, 1.19), 'Charcoal', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_sash', (0.96, 1.45, 1.9656), (1.38, 0.045, 0.045), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_side', (0.179, 1.47, 2.22), (0.075, 0.14, 1.27), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_side.001', (1.741, 1.47, 2.22), (0.075, 0.14, 1.27), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
    box('Window_sill', (0.96, 1.38, 1.5416), (1.57, 0.34, 0.065), 'Window_PaintedIvory', group='Room', scale=(1.1, 1, 1.06), bevel=0.012)
