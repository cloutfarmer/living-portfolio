from math import cos, pi, sin

import bmesh
import bpy

from lib.builders import SOURCE, _finish_mesh, _new_bmesh, imported

DESK_TOP = 1.25
CANDLE_X, CANDLE_Y = 0.77, 0.78
# The jar is wider than it is tall: 0.155 tall makes it 0.19 across, near the old candle's 0.15.
HEIGHT = 0.155
# data/candle_flicker.json keys the flame's scale, so its shape is set in the mesh: as tall as the old flame, and a little narrower.
FLAME_SCALE = (0.025, 0.025, 0.0625)
# About a fifth smaller than the flame the flicker was recorded for, so it sits in proportion to the candle.
FLAME_SHAPE = (0.72, 0.72, 0.8)
FLAME_HALF_HEIGHT = FLAME_SCALE[2] * FLAME_SHAPE[2]
# The flame's base sits a little below the wick's tip, so the wick shows inside it.
FLAME_Z = DESK_TOP + HEIGHT - 0.012 + FLAME_HALF_HEIGHT
# data/candle_flicker.json keys the flame at this height, so props/lighting.py moves its keys by the difference.
RECORDED_FLAME_Z = 1.575
FLAME_DROP = FLAME_Z - RECORDED_FLAME_Z
# A faceted teardrop, (radius, height) from base to tip, both -1 to 1. Each ring turns a little, so the facets spiral.
FLAME_PROFILE = ((0.55, -0.8), (0.85, -0.45), (0.8, -0.05), (0.55, 0.35), (0.25, 0.7))
FLAME_SIDES = 7
FLAME_TWIST = 0.35
# Rings below this are the pale core, as a real flame is brightest low down; above, the orange body and tip.
CORE_RINGS = 2


def build_flame():
    bm = _new_bmesh()
    sx, sy, sz = FLAME_SHAPE
    base = bm.verts.new((0, 0, -sz))
    tip = bm.verts.new((0, 0, sz))
    rings = []
    for index, (radius, height) in enumerate(FLAME_PROFILE):
        turn = index * FLAME_TWIST
        rings.append([bm.verts.new((radius * sx * cos(turn + 2 * pi * k / FLAME_SIDES),
                                    radius * sy * sin(turn + 2 * pi * k / FLAME_SIDES), height * sz))
                      for k in range(FLAME_SIDES)])
    core = []
    for k in range(FLAME_SIDES):
        after = (k + 1) % FLAME_SIDES
        core.append(bm.faces.new((base, rings[0][after], rings[0][k])))
        bm.faces.new((tip, rings[-1][k], rings[-1][after]))
        for index, (lower, upper) in enumerate(zip(rings, rings[1:])):
            face = bm.faces.new((lower[k], lower[after], upper[after], upper[k]))
            if index + 1 < CORE_RINGS:
                core.append(face)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in core:
        face.material_index = 1
    flame = _finish_mesh('Flame_0', bm, 'Lighting', 'Candle_Flame', (0.7779, CANDLE_Y, FLAME_Z), (0, 0, 0), FLAME_SCALE,
                         0, 3, False, False)
    flame.data.materials.append(bpy.data.materials['Candle_Flame_core'])
    return flame


def build():
    # Scented candle by Poly by Google [CC-BY] via Poly Pizza. The wax's top keeps Candle_Wax, which the site makes glow.
    imported('Candle_0', SOURCE / 'scented-candle.glb', HEIGHT, (CANDLE_X, CANDLE_Y, DESK_TOP), materials={
        '_crayfishdiffuse': 'Candle_Wax', '03___Default': 'Terracotta', '07___Default': 'Paper_Ceramic', '02___Default': 'Charcoal'})
    build_flame()
