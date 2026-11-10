from lib.builders import box

# Against the left wall's inner face, under the photo frames, in the first room's positions; lib/layout.py moves and shrinks
# it. The lowest frame starts at height 1.135, so anything placed on this table has to stop below that.
WALL = -1.96
DEPTH = 0.5
LENGTH = 1.0
MIDDLE_Y = 0.1
TOP = 0.72
THICKNESS = 0.06
LEG = 0.06
# Far enough out to clear the baseboard, whose face is at x -1.905.
LEG_X = (-1.84, -1.52)
LEG_Y = (MIDDLE_Y - LENGTH / 2 + 0.07, MIDDLE_Y + LENGTH / 2 - 0.07)


def build():
    box('Side_table_top', (WALL + DEPTH / 2, MIDDLE_Y, TOP - THICKNESS / 2), (DEPTH, LENGTH, THICKNESS), 'Warm_Oak', group='Furniture', bevel=0.012)
    index = 0
    for x in LEG_X:
        for y in LEG_Y:
            name = 'Side_table_leg' + (f'.{index:03d}' if index else '')
            box(name, (x, y, (TOP - THICKNESS) / 2), (LEG, LEG, TOP - THICKNESS), 'Charcoal', group='Furniture', bevel=0.012)
            index += 1
