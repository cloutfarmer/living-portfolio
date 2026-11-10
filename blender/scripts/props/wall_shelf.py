"""The shorter, lower shelf under the clock, built to match the one in props/shelf.py. Placed in world positions, like the side table.

Authored in the first room's positions; lib/layout.py moves and shrinks it. The clock is built in web/src/Life.tsx above it.
The photo frames' furthest edge is y 1.295, so the shelf stays behind that and can't block a photo.
"""
from lib.builders import SOURCE, box, imported

WALL_FACE = 1.63
AIR = 0.001
LENGTH = 0.9
# Deep enough for the bushy plant's pot to sit on it with the leaves clear of the wall; still behind y 1.295.
DEPTH = 0.36
# The same board and brackets as the long shelf.
THICKNESS = 0.07
BRACKET = (0.055, 0.08, 0.24)
BRACKET_INSET = 0.12
BRACKET_FROM_BACK = 0.035
BRACKET_INTO_BOARD = 0.015
MIDDLE_X = -1.25
TOP = 1.72
BACK = WALL_FACE - AIR
MIDDLE_Y = BACK - DEPTH / 2
# Two plants off centre, the bushy one a little bigger. It's about 1.33 times as wide as it is tall, so its leaves
# just clear the wall and hang past the board's front while the whole pot stays on the board. The flower pot is about
# half as wide as it is tall, and its wide side runs along the wall. Both pots share the same charcoal.
BUSHY_HEIGHT = 0.36
BUSHY = (MIDDLE_X - 0.18, BACK - 0.26)
BUSHY_TURN = 0
FLOWER_POT = (MIDDLE_X + 0.27, MIDDLE_Y)
FLOWER_POT_HEIGHT = 0.45
FLOWER_POT_TURN = 0


def build():
    box('Shelf_low', (MIDDLE_X, MIDDLE_Y, TOP - THICKNESS / 2), (LENGTH, DEPTH, THICKNESS), 'Warm_Oak', group='Furniture', bevel=0.009, segments=2)
    bracket_y = BACK - BRACKET_FROM_BACK - BRACKET[1] / 2
    bracket_z = TOP - THICKNESS + BRACKET_INTO_BOARD - BRACKET[2] / 2
    # Numbered after the long shelf's two, so the export merges all four.
    for index, side in ((2, -1), (3, 1)):
        x = MIDDLE_X + side * (LENGTH / 2 - BRACKET_INSET)
        box(f'Shelf_bracket.{index:03d}', (x, bracket_y, bracket_z), BRACKET, 'Charcoal', group='Furniture', bevel=0.009, segments=2)
    imported('Shelf_low_plant_bushy', SOURCE / 'houseplant-bushy.glb', BUSHY_HEIGHT, (*BUSHY, TOP + AIR), rot=(0, 0, BUSHY_TURN),
             materials={'Black': 'Charcoal', 'Brown': 'Warm_Oak', 'Plant_Green': 'Bonsai_Leaf'})
    imported('Shelf_low_flower_pot', SOURCE / 'flower-pot.glb', FLOWER_POT_HEIGHT, (*FLOWER_POT, TOP + AIR), rot=(0, 0, FLOWER_POT_TURN),
             materials={'VaseFlowerPot4': 'Charcoal', 'GroundFlowerPot4': 'Warm_Oak', 'PlantFlowerPot4': 'Bonsai_Leaf'})
