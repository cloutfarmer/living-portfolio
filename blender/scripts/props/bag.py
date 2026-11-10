from math import cos, sin

import bpy

from lib.builders import box, curve, frozen, thicken_cloth

# The bag's origin and turn, which the opening and tools/settle_bag_items.py are measured from.
BAG = (1.65, -0.32)
BAG_ROT = -0.38
# In the bag's own frame: x along its length, y front (negative) to back. The straps cross the top at x +-0.21, so it stops short of them.
# The floor is high because only the top of the bag can be seen, and it keeps what's dropped in where it shows.
OPENING = {'half_length': 0.19, 'front': -0.1, 'back': 0.11, 'floor': 0.33, 'bevel': 0.025}
# Lying open, the handles flop outward from where they meet the top.
HANDLE_BASE = 0.4
HANDLE_FLOP = 1.25
# Dropped into the opening by tools/settle_bag_items.py. Stored, because a rerun will not match exactly.
ITEMS = ('Bag_towel', 'Bag_shirt')
# Everything here, the stored clothes and belt included, is authored and settled at the spot above, then moved as one
# by this, back beside the dumbbells so the gym things read as one group. The settle tools work before the move.
MOVE = (0.1333, 0.7333)


def _flopped(points, outward):
    """Tilts a handle's points about the line where it meets the bag, in its authored frame."""
    def tilt(point):
        x, y, z = point
        rise = z - HANDLE_BASE
        return x, y + outward * rise * sin(HANDLE_FLOP), HANDLE_BASE + rise * cos(HANDLE_FLOP)
    return [tuple(tilt(point) for point in triple) for triple in points]


def _cut_opening(body):
    """Cuts the mouth into the body and bakes it, so no cutter object stays in the scene."""
    length = OPENING['half_length'] * 2
    width = OPENING['back'] - OPENING['front']
    # Well past the top, and down to a floor: nothing below it can be seen through the mouth.
    top = 0.6
    middle_z = (OPENING['floor'] + top) / 2 - body.location.z
    cutter = box('Bag_cutter', body.location, (length, width, top - OPENING['floor']), None, rot=body.rotation_euler,
                 center=(0, (OPENING['back'] + OPENING['front']) / 2, middle_z), bevel=OPENING['bevel'], weighted=False)
    body.modifiers.remove(body.modifiers['Weighted_normals'])
    hole = body.modifiers.new('Opening', 'BOOLEAN')
    hole.operation = 'DIFFERENCE'
    hole.solver = 'EXACT'
    hole.object = cutter
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    baked = bpy.data.meshes.new_from_object(body.evaluated_get(graph))
    baked.materials.clear()
    baked.materials.append(bpy.data.materials['Bag_Charcoal'])
    for polygon in baked.polygons:
        polygon.material_index = 0
    old = body.data
    body.data = baked
    baked.name = body.name
    bpy.data.meshes.remove(old)
    body.modifiers.clear()
    body.modifiers.new('Weighted_normals', 'WEIGHTED_NORMAL')
    mesh = cutter.data
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.data.meshes.remove(mesh)


def build_shell():
    """Everything but the dropped items, which the drop needs to land on."""
    loc, rot = (0.1959, -0.10533, 0), (0, 0, BAG_ROT)
    curve('Bag_handle_back', _flopped([((1.25, 0.43, 0.4), (1.23048, 0.43, 0.33753), (1.26952, 0.43, 0.46247)), ((1.3, 0.43, 0.56), (1.24727, 0.43, 0.52123), (1.37864, 0.43, 0.61781)), ((1.55, 0.43, 0.56), (1.46832, 0.43, 0.61342), (1.60706, 0.43, 0.52268)), ((1.62, 0.43, 0.4), (1.59267, 0.43, 0.46247), (1.64733, 0.43, 0.33753))], 1), 'Bag_Charcoal', 0.018, loc=loc, rot=rot)
    curve('Bag_handle_front', _flopped([((1.25, 0.22, 0.4), (1.23048, 0.22, 0.33363), (1.26952, 0.22, 0.46637)), ((1.3, 0.22, 0.57), (1.24461, 0.22, 0.52855), (1.37815, 0.22, 0.62847)), ((1.55, 0.22, 0.57), (1.4689, 0.22, 0.62431), (1.60964, 0.22, 0.53006)), ((1.62, 0.22, 0.4), (1.59267, 0.22, 0.46637), (1.64733, 0.22, 0.33363))], -1), 'Bag_Charcoal', 0.018, loc=loc, rot=rot)
    curve('Bag_webbing', [((1.22, 0.12, 0.1), (1.22, 0.12781, 0.0063), (1.22, 0.11219, 0.1937)), ((1.22, 0.1, 0.34), (1.22, 0.05209, 0.2591), (1.22, 0.13919, 0.40617)), ((1.22, 0.28, 0.42), (1.22, 0.20312, 0.41826), (1.22, 0.3764, 0.42218)), ((1.22, 0.51, 0.33), (1.22, 0.45059, 0.40595), (1.22, 0.56579, 0.25867)), ((1.22, 0.54, 0.1), (1.22, 0.52829, 0.18979), (1.22, 0.55171, 0.01021))], 'Bag_Trim', 0.017, loc=loc, rot=rot)
    curve('Bag_webbing.001', [((1.64, 0.12, 0.1), (1.64, 0.12781, 0.0063), (1.64, 0.11219, 0.1937)), ((1.64, 0.1, 0.34), (1.64, 0.05209, 0.2591), (1.64, 0.13919, 0.40617)), ((1.64, 0.28, 0.42), (1.64, 0.20312, 0.41826), (1.64, 0.3764, 0.42218)), ((1.64, 0.51, 0.33), (1.64, 0.45059, 0.40595), (1.64, 0.56579, 0.25867)), ((1.64, 0.54, 0.1), (1.64, 0.52829, 0.18979), (1.64, 0.55171, 0.01021))], 'Bag_Trim', 0.017, loc=loc, rot=rot)
    box('Bag_zip_pull', (1.86917, -0.41831, 0.43), (0.045, 0.025, 0.012), 'Bag_Trim', rot=(0, 0, BAG_ROT), bevel=0.005)
    # One line of teeth along each lip. The curve's frame is the bag's, with its middle at (1.43, 0.34).
    half = OPENING['half_length'] + 0.01
    for name, y in (('Bag_zipper_front', OPENING['front']), ('Bag_zipper_back', OPENING['back'])):
        y += 0.34
        curve(name, [((1.43 - half, y, 0.402), (1.43 - half - 0.08, y, 0.4), (1.43 - half + 0.08, y, 0.406)), ((1.43, y, 0.41), (1.43 - 0.1, y, 0.41), (1.43 + 0.1, y, 0.41)), ((1.43 + half, y, 0.402), (1.43 + half - 0.08, y, 0.406), (1.43 + half + 0.08, y, 0.4))], 'Rank_Stripe_White', 0.005, loc=loc, rot=rot)
    # Settled by tools/settle_belt.py and stored, because a rerun will not match exactly.
    thicken_cloth(frozen('Blue_belt_settled', (0, 0, 0)))
    body = box('Gym_bag_body', (BAG[0], BAG[1], 0.22), (0.7, 0.4, 0.38), 'Bag_Charcoal', rot=(0, 0, BAG_ROT), bevel=0.13)
    _cut_opening(body)
    box('Gym_bag_front_pocket', (1.56283, -0.53824, 0.23), (0.44, 0.07, 0.21), 'Bag_Trim', rot=(0, 0, BAG_ROT), bevel=0.045)


def build():
    before = set(bpy.data.objects.keys())
    build_shell()
    for name in ITEMS:
        thicken_cloth(frozen(name, (0, 0, 0)))
    for obj in bpy.data.objects:
        if obj.name not in before:
            obj.location.x += MOVE[0]
            obj.location.y += MOVE[1]
