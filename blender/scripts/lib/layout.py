"""Where whole groups sit in the room. Props are authored around the desk's first position, and
build_scene.py shifts each file's objects along x by these amounts.

Anything stored or keyed in world space has to apply the shift itself: lights and the flame's
keyframes in props/lighting.py, the rug in props/room.py, and the belt in tools/settle_belt.py.
The site's own positions don't follow this: see "Where things sit" in docs/ASSET_GENERATION.md.
"""
from mathutils import Matrix

# Centred the desk on the first room's back wall, x -1.96 to 3.70. The wall now spans x -1.06 to 3.20, and SCALE
# below then shrinks the desk's group toward DESK_PIVOT.
DESK_SHIFT = 1.1
# Puts the window's centre at x 2.2. The monitors may cover a little of it, but not all of it.
WINDOW_SHIFT = 1.24
# The left wall came in by this once everything was sized to the person, so what hangs on or stands by it follows.
LEFT_WALL_SHIFT = 0.9
# Over the monitors, so it clears the clock now the left wall is closer.
SHELF_SHIFT = DESK_SHIFT + 0.38

SHIFTS = {
    'desk': DESK_SHIFT,
    'monitors': DESK_SHIFT,
    'input_devices': DESK_SHIFT,
    'desk_clutter': DESK_SHIFT,
    'smoothie': DESK_SHIFT,
    'cables': DESK_SHIFT,
    'candle': DESK_SHIFT,
    'shelf': SHELF_SHIFT,
    'wall_shelf': LEFT_WALL_SHIFT,
    'side_table': LEFT_WALL_SHIFT,
    'table_items': LEFT_WALL_SHIFT,
    'sports_corner': LEFT_WALL_SHIFT,
    'pc': DESK_SHIFT,
    'bag': DESK_SHIFT,
    'soccer_ball': DESK_SHIFT,
    'trainers': DESK_SHIFT,
    'chair': DESK_SHIFT,
    'character': DESK_SHIFT,
    'window': WINDOW_SHIFT,
}

# Everything but the room is sized to the seated person, who is about 2.05 tall standing. Each group shrinks by this
# toward a point that keeps it in place: the desk's group toward the back wall, shelves toward their mounts, and the side
# table toward the left wall. Parts stay in contact, and cables stay attached, because a whole group scales together.
SCALE = 0.75
WALL_Y = 1.63
RUG_TOP = 0.0355
DESK_PIVOT = (0.9, WALL_Y, 0)
SHELF_PIVOT = (0.61, WALL_Y, 2.095)
LOW_SHELF_PIVOT = (-0.35, WALL_Y, 1.72)
SIDE_TABLE_PIVOT = (-1.06, 0.1, 0)
PIVOTS = {name: DESK_PIVOT for name in ('desk', 'monitors', 'input_devices', 'desk_clutter', 'smoothie', 'cables', 'candle',
                                        'pc', 'bag', 'trainers', 'soccer_ball', 'chair')}
PIVOTS.update(shelf=SHELF_PIVOT, wall_shelf=LOW_SHELF_PIVOT, side_table=SIDE_TABLE_PIVOT, table_items=SIDE_TABLE_PIVOT, sports_corner=SIDE_TABLE_PIVOT)
# These rest on the rug rather than the floor, so they shrink toward its top.
ON_RUG = ('Trashcan', 'Crumpled_paper', 'PC_', 'Bag_', 'Gym_bag', 'Blue_belt', 'Chair_', 'Trainer', 'Soccer_ball', 'Bin_cup')


def scaled(point, pivot=DESK_PIVOT):
    """Where a world point in a scaled group ends up."""
    return tuple(middle + (value - middle) * SCALE for value, middle in zip(point, pivot))


def scale_to_person(obj, prop):
    """Shrinks one object of a prop file, after its shift along x."""
    pivot = PIVOTS.get(prop)
    if pivot is None:
        return
    if pivot is DESK_PIVOT and obj.name.startswith(ON_RUG):
        pivot = (pivot[0], pivot[1], RUG_TOP)
    obj.location = scaled(obj.location, pivot)
    if obj.type != 'MESH':
        obj.scale = [value * SCALE for value in obj.scale]
        return
    # Into the mesh, not the object: the site and the checks expect no new scale under a bevel.
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    obj.data.transform(Matrix.Diagonal((SCALE, SCALE, SCALE, 1)))
    for modifier in obj.modifiers:
        if modifier.type == 'BEVEL':
            modifier.width *= SCALE
