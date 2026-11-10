from math import cos, sin

import bpy
from mathutils import Matrix

from lib.builders import SOURCE, box, imported, split_by_faces
from lib.layout import DESK_PIVOT, DESK_SHIFT, SCALE

DESK_TOP = 1.245
# Dropped on the desk beside the mouse pad at a casual angle, not squared up to anything.
PHONE = (0.655, 0.03)
PHONE_ROT = 0.55

# Everything sized here is in the room's final metres, and real sizes are multiplied by 1.17: the person is 2.05 tall.
# The file's keys are 16.8 of its units apart, and real ones are 19.05 mm.
KEY_PITCH = 0.0223
UNIT = KEY_PITCH / 16.8
# The file's bounds, in its own units: left to right, back to front (z grows toward the typist), and height.
MODEL_X = (-207.61, 207.14)
MODEL_Z = (-79.007, 76.243)
MODEL_HEIGHT = 15.645
KEY_TOP_ABOVE_BASE = MODEL_HEIGHT * UNIT
# The gap between G and H sits on the person's centre line, so the numpad runs off to their right.
PERSON_X = 0.84
GH_GAP = -71.5
# Set back from the desk's front edge, at y 0.273, leaving room for the forearms.
FRONT_Y = 0.415
CENTRE_X = PERSON_X + ((MODEL_X[0] + MODEL_X[1]) / 2 - GH_GAP) * UNIT
CENTRE_Y = FRONT_Y + (MODEL_Z[1] - MODEL_Z[0]) / 2 * UNIT
BASE_Z = DESK_TOP * SCALE + 0.00075
# Key centres in the file's units: its x, then its z.
KEYS = {'A': (-147, -2.4), 'S': (-130, -2.4), 'D': (-113, -2.4), 'F': (-97, -2.4), 'Space_left': (-85, 31.2)}

MOUSE_PAD = (0.3867, 0.11)
# A real mouse is 62 x 115 x 38 mm. Sized by its height and length, the file is too wide for its length.
MOUSE_HEIGHT = 0.044
MOUSE_NARROWED = 0.75
# Its back swings toward the person, the way a hand coming in from the left leaves it.
MOUSE_TURN = -0.18


def key_top(key):
    """A key's top centre in the room, before the shift along x. props/character.py aims the fingers at these."""
    x, z = KEYS[key]
    return (CENTRE_X + (x - (MODEL_X[0] + MODEL_X[1]) / 2) * UNIT - DESK_SHIFT,
            CENTRE_Y + ((MODEL_Z[0] + MODEL_Z[1]) / 2 - z) * UNIT,
            BASE_Z + KEY_TOP_ABOVE_BASE)


def _authored(x, y):
    """Where to build something so that lib/layout.py's shift and shrink land it on this room position."""
    return (DESK_PIVOT[0] + (x - DESK_PIVOT[0]) / SCALE - DESK_SHIFT, DESK_PIVOT[1] + (y - DESK_PIVOT[1]) / SCALE)


def _keyboard():
    source = imported('Keyboard_source', SOURCE / 'keyboard.glb', MODEL_HEIGHT * UNIT / SCALE,
                      (*_authored(CENTRE_X, CENTRE_Y), BASE_Z / SCALE), materials={'lambert3SG': 'Charcoal'})
    points = source.data.vertices
    top = max(vertex.co.z for vertex in points) - 1e-5
    tops = {polygon.index for polygon in source.data.polygons if all(points[index].co.z >= top for index in polygon.vertices)}
    split_by_faces(source, {
        'Desktop_keyboard': (lambda index: index not in tops, 'Charcoal'),
        # A step lighter than the case, or the keys merge into a slab under the browser's flat light.
        'Desktop_keyboard_keys': (lambda index: index in tops, 'Keycap'),
    })
    bpy.data.objects.remove(source, do_unlink=True)


def build():
    _keyboard()
    mouse = imported('Desktop_mouse', SOURCE / 'computer-mouse.glb', MOUSE_HEIGHT / SCALE,
                     (*MOUSE_PAD, DESK_TOP + 0.012 + 0.001), rot=(0, 0, MOUSE_TURN), materials={'Material': 'Paper_Ceramic'})
    mouse.data.transform(Matrix.Diagonal((MOUSE_NARROWED, 1, 1, 1)))
    box('Mouse_pad', (*MOUSE_PAD, DESK_TOP + 0.006), (0.3, 0.31, 0.012), 'Charcoal', bevel=0.012)
    box('Phone', (*PHONE, DESK_TOP + 0.009), (0.16, 0.29, 0.025), 'Charcoal', rot=(0, 0, PHONE_ROT), scale=(0.5625, 0.62069, 0.72), bevel=0.025)
    box('Phone_earpiece', (PHONE[0] - 0.063 * sin(PHONE_ROT), PHONE[1] + 0.063 * cos(PHONE_ROT), DESK_TOP + 0.023), (0.025, 0.006, 0.002), 'Charcoal', rot=(0, 0, PHONE_ROT), bevel=0.005, weighted=False)
    box('Phone_glass', (*PHONE, DESK_TOP + 0.02), (0.079, 0.157, 0.003), 'Monitor_Screen', rot=(0, 0, PHONE_ROT), bevel=0.005, weighted=False)
