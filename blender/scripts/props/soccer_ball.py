"""A soccer ball under the desk. Its dark patches sit over the twelve corners of an icosahedron."""
from math import sqrt

import bpy
from mathutils import Vector

from lib.builders import icosphere
from lib.layout import RUG_TOP

RADIUS = 0.15
# Not today's sport: pushed back under the desk, left of the PC, resting on the rug.
POSITION = (0.2233, 0.59, RUG_TOP + RADIUS + 0.001)
# Tipped so that the patches don't line up with the room.
TILT = (0.5, 0.3, 0.2)
PATCH_SPREAD = 0.31

PHI = (1 + sqrt(5)) / 2
PATCHES = [Vector(corner).normalized() for a in (1, -1) for b in (PHI, -PHI)
           for corner in ((0, a, b), (a, b, 0), (b, 0, a))]


def build():
    ball = icosphere('Soccer_ball', POSITION, RADIUS, 'Paper_Ceramic', rot=TILT)
    ball.data.materials.append(bpy.data.materials['Charcoal'])
    for polygon in ball.data.polygons:
        direction = polygon.center.normalized()
        polygon.material_index = int(any(direction.angle(patch) < PATCH_SPREAD for patch in PATCHES))
