"""Drop the belt under gravity and store the result in props/data, because a rerun will not match exactly.

Stale: this still simulates at the room's size before SCALE in lib/layout.py, while the bag it reads has since shrunk.
Fix that before re-dropping. The stored belt was shortened by removing rows from its straight tail, to keep its shape.

Blender --background --factory-startup <scene.blend> --python-exit-code 1 --python blender/scripts/tools/settle_belt.py

Reads the bag and floor from the scene and saves nothing back to it. Exits 1 if the belt has not
come to rest or has pushed through the bag, so an unsettled result can never be stored.
"""
import json
import sys
from math import cos, sin
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.layout import DESK_SHIFT  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / 'props' / 'data' / 'Blue_belt_settled.json'

BAG = Vector((1.65 + DESK_SHIFT, -0.32, 0))
BAG_ROT = -0.38
# Kept off the rug's right edge at x 2.655: a belt straddling that 35 mm step rocks and never settles.
# The front hangs close to the pocket: any slack here buckles and pops instead of settling.
# Mouth of the belt at the zipper, over the bag's front, down the pocket, then along the floor.
# The tail angles over the rug so the site's first-load hint cannot cover the stripe. It stays
# straight, because a wide ribbon curved sideways on the floor sticks and slips and never settles.
# In the bag's own frame: x along its length, y front (negative) to back, z up from the floor.
PATH = ((-0.11, 0.03, 0.395), (-0.11, 0.0, 0.42), (-0.11, -0.06, 0.435), (-0.105, -0.13, 0.43),
        (-0.1, -0.2, 0.395), (-0.095, -0.26, 0.355), (-0.09, -0.283, 0.3), (-0.085, -0.285, 0.2),
        (-0.08, -0.285, 0.12), (-0.08, -0.3, 0.07), (-0.11, -0.39, 0.06), (-0.209, -0.663, 0.06))
WIDTH = 0.07
ROW_SPACING = 0.03
COLUMNS = 3
PINNED_ROWS = 2
# Measured back from the free end: a short blue tip, then the black rank bar. One white stripe
# sits near the bar's tip end, with a little black showing on either side of it.
BLUE_TIP = 0.03
RANK_BAR = 0.2
STRIPE = 0.03
STRIPE_INSET = 0.03
FRAMES = 300
# At rest, the average shape over two windows of frames must match this closely. The later one is
# stored. A failure here has meant slack or a straddled edge, not a run that was too short.
WINDOW = 30
AT_REST = 0.001
# Deepest the belt may sit in the bag's surface, past the rows pinned at the zipper.
MAX_DEPTH = 0.005
COLLIDERS = ('Gym_bag_body', 'Gym_bag_front_pocket', 'Floor', 'Playful_rug')


def to_world(point):
    x, y, z = point
    c, s = cos(BAG_ROT), sin(BAG_ROT)
    return Vector((BAG.x + c * x - s * y, BAG.y + s * x + c * y, z))


def even_points(path, spacing):
    """Points along the path at equal spacing, so the cloth starts with no stretch."""
    points = [to_world(p) for p in path]
    lengths = [(b - a).length for a, b in zip(points, points[1:])]
    total = sum(lengths)
    count = round(total / spacing) + 1
    placed, index, walked = [], 0, 0
    for row in range(count):
        target = total * row / (count - 1)
        while index < len(lengths) - 1 and walked + lengths[index] < target:
            walked += lengths[index]
            index += 1
        placed.append(points[index].lerp(points[index + 1], (target - walked) / lengths[index]))
    return placed, total


def build_ribbon(rows):
    across = (Vector((cos(BAG_ROT), sin(BAG_ROT), 0))) * WIDTH
    verts, faces = [], []
    for point in rows:
        for column in range(COLUMNS):
            verts.append(tuple(point + across * (column / (COLUMNS - 1) - 0.5)))
    for row in range(len(rows) - 1):
        for column in range(COLUMNS - 1):
            a = row * COLUMNS + column
            faces.append((a, a + 1, a + COLUMNS + 1, a + COLUMNS))
    mesh = bpy.data.meshes.new('Belt_sim')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    belt = bpy.data.objects.new('Belt_sim', mesh)
    bpy.context.scene.collection.objects.link(belt)
    return belt


def add_cloth(belt):
    pin = belt.vertex_groups.new(name='Pinned_at_zipper')
    pin.add(list(range(PINNED_ROWS * COLUMNS)), 1, 'REPLACE')
    cloth = belt.modifiers.new('Gravity', 'CLOTH')
    s = cloth.settings
    # Thick woven cotton: barely stretches and resists kinking, so it falls in long curves.
    s.quality = 30
    s.mass = 0.15
    # Heavy damping, so contact energy dies away.
    s.air_damping = 10
    s.tension_damping = 25
    s.compression_damping = 25
    s.shear_damping = 25
    s.bending_damping = 2
    s.tension_stiffness = 60
    s.compression_stiffness = 60
    s.shear_stiffness = 40
    s.bending_stiffness = 12
    s.vertex_group_mass = pin.name
    c = cloth.collision_settings
    c.use_collision = True
    c.collision_quality = 12
    # With the collider's 2 mm below, this clears the 6 mm of thickness thicken_cloth adds later.
    c.distance_min = 0.006
    c.use_self_collision = False
    cloth.point_cache.frame_start = 1
    cloth.point_cache.frame_end = FRAMES


def surface_points(belt):
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = belt.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    points = [belt.matrix_world @ v.co for v in mesh.vertices]
    evaluated.to_mesh_clear()
    return points


def deepest_in(points, name):
    """How far points sit inside an object, by the nearest face's facing."""
    obj = bpy.data.objects[name]
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(graph)
    inverse = obj.matrix_world.inverted()
    deepest = 0
    for point in points:
        found, location, normal, _ = evaluated.closest_point_on_mesh(inverse @ point)
        if found and (inverse @ point - location).dot(normal) < 0:
            deepest = max(deepest, (inverse @ point - location).length)
    return deepest


def average(shapes):
    return [sum(points, Vector()) / len(points) for points in zip(*shapes)]


def rank_faces(row_count):
    """Material per face row, counted from the free end."""
    materials = []
    for row in range(row_count - 1):
        from_end = (row_count - 2 - row + 0.5) * ROW_SPACING
        if BLUE_TIP + STRIPE_INSET <= from_end <= BLUE_TIP + STRIPE_INSET + STRIPE:
            materials.append(2)
        elif BLUE_TIP <= from_end <= BLUE_TIP + RANK_BAR:
            materials.append(1)
        else:
            materials.append(0)
    return materials


def main():
    scene = bpy.context.scene
    old = bpy.data.objects.get('Blue_belt_settled')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    for name in COLLIDERS:
        obj = bpy.data.objects[name]
        obj.modifiers.new('Belt_collision', 'COLLISION')
        obj.collision.thickness_outer = 0.002
        obj.collision.cloth_friction = 8
        obj.collision.damping_factor = 1
    rows, length = even_points(PATH, ROW_SPACING)
    belt = build_ribbon(rows)
    add_cloth(belt)
    scene.gravity = (0, 0, -9.81)
    recent = []
    for frame in range(1, FRAMES + 1):
        scene.frame_set(frame)
        if frame > FRAMES - 2 * WINDOW:
            recent.append(surface_points(belt))
    points = average(recent[WINDOW:])
    movement = max((a - b).length for a, b in zip(points, average(recent[:WINDOW])))
    chatter = max((a - b).length for shape in recent[WINDOW:] for a, b in zip(shape, points))
    free = points[PINNED_ROWS * COLUMNS:]
    depths = {name: deepest_in(free, name) for name in COLLIDERS}
    print(f'SETTLE rows {len(rows)}, length {length:.3f} m, drift {movement * 1000:.2f} mm, chatter {chatter * 1000:.2f} mm')
    print('SETTLE lowest', round(min(p.z for p in points), 4), 'depth', {k: round(v, 4) for k, v in depths.items()})
    print('SETTLE tip', [round(v, 3) for v in points[-1]])
    problems = []
    if movement > AT_REST:
        problems.append(f'not at rest: moved {movement * 1000:.2f} mm')
    problems += [f'{name} by {depth * 1000:.1f} mm' for name, depth in depths.items() if depth > MAX_DEPTH]
    if problems:
        print('FAIL', '; '.join(problems))
        raise SystemExit(1)
    faces = [list(p.vertices) for p in belt.data.polygons]
    per_row = rank_faces(len(rows))
    record = {
        # Stored unshifted, like the rest of props/bag.py, because build_scene.py shifts the file.
        'vertices': [[round(p.x - DESK_SHIFT, 5), round(p.y, 5), round(p.z, 5)] for p in points],
        'faces': faces,
        'materials': ['BJJ_Blue_Belt', 'Bag_Charcoal', 'Rank_Stripe_White'],
        'material_index': [per_row[i // (COLUMNS - 1)] for i in range(len(faces))],
        'smooth': [1] * len(faces),
        'uv': [],
    }
    DATA.write_text(json.dumps(record))
    print('SAVED', DATA.name)


main()
