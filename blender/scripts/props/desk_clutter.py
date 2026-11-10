from math import atan2, cos, pi, sin

from mathutils import Vector

import bpy

from lib.builders import SOURCE, box, cylinder, frozen, imported, lathe, split_by_faces

DESK_TOP = 1.245
# Where the seated person's head is. The desk is messy, but it's their mess: nothing here faces away from them.
READER = (-0.28, -0.48)


def facing(x, y, off=0):
    """The turn that points an object's -y edge at the reader, plus a little deliberate carelessness."""
    return atan2(READER[0] - x, y - READER[1]) + off


# Things in use sit within reach, and things finished with get pushed back. Each spot is (x, y, turn).
OPEN_BOOK = (-1.33, 0.44, facing(-1.33, 0.44))
OPEN_BOOK_HEIGHT = 0.09
BOOK_STACK = (-1.22, 1.02, facing(-1.22, 1.02, 0.14))
BOOK_STACK_HEIGHT = 0.31
# Just put down along the open book's near edge, a little off its line.
PEN = (-1.03, 0.27, OPEN_BOOK[2] + 0.12)
PEN_RADIUS = 0.012
PAPER_HEIGHT = 0.05
PAPER_COLOURS = {'mat21': 'Paper_Ceramic', 'mat15': 'Rank_Stripe_White'}
# Pulled over to read on the left. The right side stays clear of paper, near the candle.
PAPERS = ((-0.82, 0.55, DESK_TOP + 0.001, facing(-0.82, 0.55, 0.26)),)
# The coffee in use, on its coaster right of the phone, within reach of the right hand. Stacked up from the desk.
MUG = (1.0, 0.17)
# The handle's turn about the mug, from +x. Toward the reader, as a mug is put back down after a sip.
MUG_HANDLE_TURN = -0.6
# An earlier one, drunk and pushed aside past the candle: it's been a long session.
# Pushed back into the desk's back-right corner with the tipped cup, so the empties read as one pile, clear of the candle.
EMPTY_MUG = (1.2, 1.0433)
EMPTY_HANDLE_TURN = 2.6
# What's left in the bottom of the empty mug, a millimetre above its floor like the full mug's coffee.
DREGS_DEPTH = 0.003
COASTER_DEPTH = 0.02
MUG_RADIUS = 0.085
# The mug is hollow, and the coffee sits below its rim as if some has been drunk. From the ROOM camera the near rim hides
# about 2.2 times this drop, so much deeper would hide the coffee.
MUG_INNER_RADIUS = 0.072
COFFEE_DROP = 0.022
# Seated 0.5 mm into the mug's wall, so no gap shows around it.
COFFEE_RADIUS = MUG_INNER_RADIUS + 0.0005
COFFEE_DEPTH = 0.005
# How far the coffee's normals lean at its rim, as a tangent. Less moves the candle's highlight behind the near rim.
COFFEE_RIM_LEAN = 1.2
MUG_DEPTH = 0.18
MUG_MIDDLE = DESK_TOP + COASTER_DEPTH + MUG_DEPTH / 2
EMPTY_MIDDLE = DESK_TOP + 0.001 + MUG_DEPTH / 2
# The empty mug's floor, from its base: the same wall thickness as the base of the full one's cavity.
EMPTY_FLOOR = 0.016
HANDLE_REACH = 0.11
# At the desk's left end, in front of its front-left leg and clear of the side table, which keeps the right side's
# floor for the gym things. Its mesh is authored away from its origin, so this differs from where it ends up.
BIN = (-2.5867, -1.05)
# Lifts the bin and its contents out of the rug, so they rest on top of it.
BIN_LIFT = 0.017
# From the bin's middle, sitting on its contents as before.
BIN_MIDDLE = (BIN[0] + 0.62, BIN[1] + 0.9)
# Takeaway coffee cups: a long session's worth in the bin, and the latest knocked over on the desk, drained, its lid gone.
CUP_HEIGHT = 0.2
# Bands of the source cup, as shares of its height from the base: the card sleeve, and the lid from its rim up.
CUP_SLEEVE = (0.18, 0.59)
CUP_LID = 0.75
# (x, y, base height, tilt about x, tilt about y, turn). Leaning among the crumpled paper.
BIN_CUPS = ((BIN_MIDDLE[0] + 0.06, BIN_MIDDLE[1] + 0.05, 0.36 + BIN_LIFT, 0.42, 0.15, 0.9),
            (BIN_MIDDLE[0] - 0.07, BIN_MIDDLE[1] + 0.07, 0.38 + BIN_LIFT, -0.35, 0.2, 2.6))
# On its side in front of the empty mug, open end toward the person, as if knocked over once it was empty.
TIPPED_CUP = (1.2267, 0.7767)
NOTE_SIZE = (0.075, 0.002, 0.075)
# Stuck over the screens' outer edges, with a millimetre of air so they don't cut into the glass.
# Each is (screen middle, screen's turn, distance along it, height, tilt on the screen, material).
SCREEN_FRONT = 0.0045
NOTE_STANDOFF = SCREEN_FRONT + 0.001 + NOTE_SIZE[1] / 2
MAIN_SCREEN = (-0.57, 0.821)
RIGHT_SCREEN = (0.14339, 0.85176)
RIGHT_TURN = -0.23
STICKY_NOTES = (
    (MAIN_SCREEN, 0, -0.32, 1.68, 0.07, 'Sticky_Yellow'),
    (RIGHT_SCREEN, RIGHT_TURN, 0.29, 1.86, -0.05, 'Sticky_Yellow'),
    (RIGHT_SCREEN, RIGHT_TURN, 0.28, 1.77, 0.09, 'Paper_Ceramic'),
)


def numbered(name, index):
    """Blender's numbering: the first has no suffix."""
    return name + (f'.{index:03d}' if index else '')


def coffee_surface():
    """A flat disc with its top's normals leaning outward, like a slight meniscus.

    A truly flat surface mirrors one direction only, which misses the candle from both camera views, and the
    browser has no environment to reflect. Leaning the normals puts the highlight on the coffee without a bulge.
    """
    disc = cylinder('Coffee_surface', (*MUG, MUG_MIDDLE + MUG_DEPTH / 2 - COFFEE_DROP - COFFEE_DEPTH / 2), COFFEE_RADIUS, COFFEE_DEPTH, 'Coffee', weighted=False, smooth=True, cap_tris=True)
    mesh = disc.data
    normals = []
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            if polygon.normal.z > 0.9:
                x, y, _ = mesh.vertices[mesh.loops[loop].vertex_index].co
                lean = COFFEE_RIM_LEAN / COFFEE_RADIUS
                normals.append(Vector((x * lean, y * lean, 1)).normalized())
            else:
                normals.append(polygon.normal.copy())
    mesh.normals_split_custom_set(normals)


def mug(name, spot, middle, floor, handle_turn):
    """A hollow mug whose cavity stops `floor` above its base, with the stored handle turned `handle_turn` about it."""
    top = MUG_DEPTH / 2
    lathe(name, (*spot, middle), ((MUG_RADIUS, -top), (MUG_RADIUS, top), (MUG_INNER_RADIUS, top), (MUG_INNER_RADIUS, floor - top)),
          'Paper_Ceramic', bevel=0.004, segments=2)
    handle = frozen('Mug_handle', (spot[0] + HANDLE_REACH * cos(handle_turn), spot[1] + HANDLE_REACH * sin(handle_turn), middle),
                    rot=(1.5708, -0, handle_turn))
    handle.name = handle.data.name = name + '_handle'


def coffee_cup(name, loc, rot, lid=True):
    """A takeaway cup in three shared colours: white card, a kraft sleeve, and a dark lid unless it's been taken off."""
    source = imported(name + '_source', SOURCE / 'coffee-cup.glb', CUP_HEIGHT, loc, rot=rot, materials={'Material.005': 'Paper_Ceramic'})
    share = [polygon.center.z / CUP_HEIGHT for polygon in source.data.polygons]
    parts = {
        name: (lambda index: share[index] < CUP_SLEEVE[0] or CUP_SLEEVE[1] <= share[index] < CUP_LID, 'Paper_Ceramic'),
        name + '_sleeve': (lambda index: CUP_SLEEVE[0] <= share[index] < CUP_SLEEVE[1], 'Cup_Sleeve'),
    }
    if lid:
        parts[name + '_lid'] = (lambda index: share[index] >= CUP_LID, 'Charcoal')
    made = split_by_faces(source, parts)
    bpy.data.objects.remove(source, do_unlink=True)
    return made


def rest_on(parts, height):
    """Lowers parts together until their lowest point sits `height` up, as something lying on its side has to."""
    low = min((part.matrix_basis @ vertex.co).z for part in parts for vertex in part.data.vertices)
    for part in parts:
        part.location.z += height - low


def build():
    imported('Book_stack', SOURCE / 'book-stack.glb', BOOK_STACK_HEIGHT, (*BOOK_STACK[:2], DESK_TOP + 0.001), rot=(0, 0, BOOK_STACK[2]),
             materials={'mat10': 'Connection_MutedGreen', 'mat23': 'Charcoal', 'mat21': 'Paper_Ceramic', 'mat4': 'Connection_MutedGreen',
                        'mat8': 'Terracotta', 'mat5': 'BJJ_Blue_Belt', 'mat3': 'Connection_MutedGreen', 'mat17': 'Charcoal',
                        'mat16': 'Bag_Trim', 'mat1': 'Shake_Berry'})
    imported('Open_book', SOURCE / 'open-book.glb', OPEN_BOOK_HEIGHT, (*OPEN_BOOK[:2], DESK_TOP + 0.001), rot=(0, 0, OPEN_BOOK[2]),
             materials={'Teal': 'Connection_MutedGreen', 'Beige': 'Paper_Ceramic', 'DarkRed': 'Terracotta'})
    cylinder('Coaster', (*MUG, DESK_TOP + COASTER_DEPTH / 2), 0.12, COASTER_DEPTH, 'Warm_Oak', bevel=0.008, segments=2)
    coffee_surface()
    frozen('Crumpled_paper', (BIN_MIDDLE[0] - 0.06, BIN_MIDDLE[1] - 0.02, 0.38 + BIN_LIFT), scale=(1, 0.8, 0.85))
    frozen('Crumpled_paper.001', (BIN_MIDDLE[0] - 0.005, BIN_MIDDLE[1] + 0.04, 0.395 + BIN_LIFT), scale=(1, 0.8, 0.85))
    frozen('Crumpled_paper.002', (BIN_MIDDLE[0] + 0.05, BIN_MIDDLE[1] - 0.02, 0.41 + BIN_LIFT), scale=(1, 0.8, 0.85))
    mug('Mug', MUG, MUG_MIDDLE, MUG_DEPTH - COFFEE_DROP - 2 * COFFEE_DEPTH, MUG_HANDLE_TURN)
    mug('Empty_mug', EMPTY_MUG, EMPTY_MIDDLE, EMPTY_FLOOR, EMPTY_HANDLE_TURN)
    cylinder('Empty_mug_dregs', (*EMPTY_MUG, EMPTY_MIDDLE - MUG_DEPTH / 2 + EMPTY_FLOOR + 0.001 + DREGS_DEPTH / 2), COFFEE_RADIUS, DREGS_DEPTH, 'Coffee',
             weighted=False, cap_tris=True)
    for index, (x, y, z, turn) in enumerate(PAPERS):
        imported(numbered('Paper_stack', index), SOURCE / 'paper-stack.glb', PAPER_HEIGHT, (x, y, z), rot=(0, 0, turn), materials=PAPER_COLOURS)
    cylinder('Pen', (*PEN[:2], DESK_TOP + PEN_RADIUS + 0.001), PEN_RADIUS, 0.3, 'Charcoal', rot=(0, 1.5708, PEN[2]), bevel=0.008, segments=2)
    frozen('Trashcan', (*BIN, BIN_LIFT))
    for index, (x, y, z, tilt_x, tilt_y, turn) in enumerate(BIN_CUPS):
        coffee_cup(numbered('Bin_cup', index), (x, y, z), (tilt_x, tilt_y, turn))
    x, y = TIPPED_CUP
    rest_on(coffee_cup('Tipped_cup', (x, y, DESK_TOP), (pi / 2 + 0.08, 0, facing(x, y, 0.35)), lid=False), DESK_TOP + 0.001)

    for index, ((x, y), turn, along, height, tilt, material) in enumerate(STICKY_NOTES):
        spot = (x + along * cos(turn) + NOTE_STANDOFF * sin(turn), y + along * sin(turn) - NOTE_STANDOFF * cos(turn), height)
        box(numbered('Sticky_note', index), spot, NOTE_SIZE, material, rot=(0, tilt, turn))
