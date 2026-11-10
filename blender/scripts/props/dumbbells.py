"""A pair of hex dumbbells set down in the back-right corner under the window, past the end of the desk and off the rug.

One model, placed twice, both lying roughly along the wall so neither shows a plate end-on to the room camera: set down
side by side, a few degrees apart and offset, not lined up.
Plates in charcoal, and the bar, collars, and ends a step lighter, as on the keyboard, so the two read apart under the
browser's flat light.

Not in lib/layout.py's SHIFTS or PIVOTS, so these are final room positions and sizes.
"""
import bpy

from lib.builders import SOURCE, imported, split_by_faces

# Lying on a flat of its hex plates. The source is 2.9 times as long as it is tall, so this makes it about 0.39 long,
# a heavy hex dumbbell next to the person, who is about 1.54 tall.
HEIGHT = 0.135
AIR = 0.001
# The plates sit between these shares of the half-length from the middle; the bar, collars, and ends are outside them.
PLATES = (0.37, 0.575)
# Each is (x, y, turn). The wall's face is at y 1.565 and the wall outlet's cable stops at x 2.47.
PAIR = (
    (2.8, 1.4, 0.16),
    (2.87, 1.17, -0.09),
)


def build():
    for index, (x, y, turn) in enumerate(PAIR):
        name = 'Dumbbell' + (f'.{index:03d}' if index else '')
        source = imported(f'{name}_source', SOURCE / 'dumbbell.glb', HEIGHT, (x, y, AIR), rot=(0, 0, turn),
                          materials={'Material': 'Charcoal'})
        points = source.data.vertices
        half = max(abs(vertex.co.x) for vertex in points)

        def on_plate(face, data=source.data, half=half):
            share = abs(data.polygons[face].center.x) / half
            return PLATES[0] <= share <= PLATES[1]

        split_by_faces(source, {
            f'{name}_plates': (on_plate, 'Charcoal'),
            f'{name}_bar': (lambda face, on_plate=on_plate: not on_plate(face), 'Keycap'),
        })
        bpy.data.objects.remove(source, do_unlink=True)
