"""Rules for tools/check_scene.py. Add to these only with a reason; never loosen one just to pass."""
# Object name prefixes that form one physical assembly. Parts inside an assembly may interpenetrate.
ASSEMBLIES = {
    'room': ('Floor', 'Back_wall', 'Left_wall', 'Back_baseboard', 'Left_baseboard', 'Playful_rug'),
    'desk': ('Desk_',),
    'main_monitor': ('Main_',),
    'right_monitor': ('Right_',),
    'keyboard': ('Desktop_keyboard',),
    'mouse': ('Desktop_mouse',),
    'phone': ('Phone',),
    'window': ('Window_', 'Blind_'),
    'shelf': ('Shelf',),
    'pc': ('PC_',),
    'bag': ('Bag_', 'Gym_bag'),
    'chair': ('Chair_',),
    'character': ('Character_', 'Body', 'Head', 'Hair', 'Hand', 'Forearm', 'Upper_arm', 'Thigh', 'Shin', 'Shoe'),
    'candle': ('Candle_', 'Flame_'),
    'mug': ('Mug', 'Coffee_surface', 'Coaster'),
    'empty_mug': ('Empty_mug',),
    'shake': ('Shake_',),
    'pen': ('Pen',),
    'papers': ('Paper_stack',),
    'open_book': ('Open_book',),
    'books': ('Book_',),
    'trash': ('Trashcan', 'Crumpled_paper', 'Bin_cup'),
    'tipped_cup': ('Tipped_cup',),
    'cables': ('Cable_', 'Wall_outlet'),
    'side_table': ('Side_table',),
    'protein': ('Protein_',),
    # One model each, split by colour, so the bar runs through its plates. Separate, so the pair can't sink into each other.
    'dumbbell': ('Dumbbell_',),
    'dumbbell_2': ('Dumbbell.001',),
    # The seasonal corner: the site shows only one of these at a time, so they share a spot.
    'sports': ('Ski_', 'Surfboard'),
}
# Deepest allowed penetration between assemblies. Resting props touch; they should not sink in.
MAX_PENETRATION = .005
# Depth is tested along edges at this spacing, so long parts passing through a solid are caught.
DEPTH_SAMPLE_SPACING = .02
# Two objects closer than this count as touching, for the support check.
CONTACT_GAP = .005
# The support check starts here. Everything must connect back to one of these.
GROUNDED = ('Floor', 'Back_wall', 'Left_wall')
# Things that can rest on others but hold nothing up. Hands touching the keyboard do not support it.
NOT_SUPPORT = ('character',)
# Flames hover over the wick by design.
MAY_FLOAT = ('Flame_',)
# Deliberate contact, each with its reason.
ALLOWED_OVERLAPS = {
    # Cloth is pinned into the zipper. tools/settle_belt.py measures the rest against the bag itself.
    frozenset(('bag', 'Blue_belt_settled')): 'belt is pinned into the bag',
}
# Measured in v015, recorded November 5, 2026, and left in place so the v016 rebuild would match it.
# Each value caps the issue at its measured size. Fix them and delete the entry; never raise a value.
# The two marked v017 were remeasured when depth began sampling along edges; the scene did not change.
KNOWN_OVERLAPS = {
    frozenset(('chair', 'character')): .01,  # v028: shorts press into the seat
    frozenset(('desk', 'room')): .0263,  # v017: desk legs through the rug
    frozenset(('pc', 'room')): .0055,  # PC case through the rug
    frozenset(('bag', 'room')): .0055,  # bag through the rug
}
KNOWN_FLOATING = {
    'Candle_0': 0,  # touches only its flame; 5 mm above the desk
    'Crumpled_paper': .0321,  # paper does not reach the bin
    'Desk_top': .005,  # 15 mm above its legs; this is the gap to its nearest neighbor, the candle
    'Main_Monitor_base': .0125,  # monitor above the desk
    'Right_Monitor_base': .0125,  # monitor above the desk
    'Shelf': .015,  # shelf and its contents off the back wall
}
# World-space size in metres as (min, max) per axis, for parts whose scale everything else relates to.
SIZES = {
    'Desk_top': ((2.3, 2.4), (1, 1.1), (.08, .12)),
    'Floor': ((4.3, 4.5), (3.7, 3.9), (.15, .25)),
    'Main_Display': ((.5, 1.1), (.001, .2), (.3, .8)),
}
DEFAULT_NAMES = ('Cube', 'Sphere', 'Cylinder', 'Plane', 'Circle', 'Icosphere', 'Torus', 'Cone', 'BezierCurve', 'Mesh', 'Object')
