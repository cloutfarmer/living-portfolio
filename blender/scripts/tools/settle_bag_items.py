"""Drop the clothes into the open bag under gravity and store each in props/data, because a rerun will not match exactly.

Blender --background --factory-startup --python-exit-code 1 --python blender/scripts/tools/settle_bag_items.py

Builds the bag alone, at its authored size and position, which is the frame props/bag.py stores cloth in, so the result
can't drift from the room's later shift and scale. Saves no scene. Exits 1 if an item has not come to rest, has pushed
through the bag, or missed the opening, so an unsettled result can never be stored.
"""
import json
import sys
from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.builders import reset_scene  # noqa: E402
from lib.materials import build_materials  # noqa: E402
from props.bag import BAG, BAG_ROT, OPENING, build_shell  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / 'props' / 'data'
# Each starts loosely folded over the opening, as if dropped in. Its layers fall in order, each landing on the last.
# middle and turn are in the bag's frame; folds is how far the width is gathered up into pleats before it falls.
SPACING = 0.035
ITEMS = (
    # Short enough to fall into the mouth rather than bridge it. The belt ends up lying on it.
    {'name': 'Bag_towel', 'material': 'Bag_Towel', 'length': 0.35, 'width': 0.32, 'middle': (-0.01, 0.005), 'height': 0.46,
     'turn': 0.1, 'folds': 0.58, 'pleat': 0.09, 'cut': None, 'under_belt': True},
    # Sleeves toward the front and past the lip, so its own weight pulls them out over the edge. Further forward than
    # this and the whole shirt slides off, slowly, however long it runs.
    {'name': 'Bag_shirt', 'material': 'Bag_Shirt', 'length': 0.46, 'width': 0.4, 'middle': (0.075, -0.08), 'height': 0.51,
     'turn': -1.3, 'folds': 0.7, 'pleat': 0.13, 'cut': 'shirt', 'under_belt': False},
)
FRAMES = 480
WINDOW = 30
AT_REST = 0.003
MAX_DEPTH = 0.008


def to_world(x, y, z):
    c, s = cos(BAG_ROT), sin(BAG_ROT)
    return Vector((BAG[0] + c * x - s * y, BAG[1] + s * x + c * y, z))


def in_shirt(u, v):
    """A T-shape over a grid: sleeves at one end, the body narrower below them. u along its length, v across, both 0 to 1."""
    return u > 0.66 or 0.22 < v < 0.78


def sheet(item):
    columns = round(item['length'] / SPACING) + 1
    rows = round(item['width'] / SPACING) + 1
    keep = {}
    verts = []
    c, s = cos(item['turn']), sin(item['turn'])
    for column in range(columns):
        for row in range(rows):
            u, v = column / (columns - 1), row / (rows - 1)
            if item['cut'] == 'shirt' and not in_shirt(u, v):
                continue
            x = (u - 0.5) * item['length']
            across = (v - 0.5) * item['width']
            # Pleats keep the sheet's length roughly true while bunching its width, which is what makes it fall in folds.
            y = across * item['folds']
            lift = 0.035 * sin(2 * pi * across / item['pleat']) + 0.012 * sin(2 * pi * x / 0.23 + 1.1)
            keep[column, row] = len(verts)
            mx, my = item['middle']
            verts.append(tuple(to_world(mx + c * x - s * y, my + s * x + c * y, item['height'] + lift)))
    faces = []
    for column in range(columns - 1):
        for row in range(rows - 1):
            corners = [(column, row), (column + 1, row), (column + 1, row + 1), (column, row + 1)]
            if all(corner in keep for corner in corners):
                faces.append([keep[corner] for corner in corners])
    mesh = bpy.data.meshes.new(item['name'] + '_sim')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(item['name'] + '_sim', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_cloth(obj):
    cloth = obj.modifiers.new('Gravity', 'CLOTH')
    s = cloth.settings
    # Soft cotton: it barely stretches, but folds easily.
    s.quality = 24
    s.mass = 0.12
    s.air_damping = 3
    s.tension_stiffness = 70
    s.compression_stiffness = 70
    s.shear_stiffness = 45
    s.bending_stiffness = 0.3
    s.tension_damping = 25
    s.compression_damping = 25
    s.shear_damping = 25
    s.bending_damping = 1
    c = cloth.collision_settings
    c.use_collision = True
    c.collision_quality = 10
    c.distance_min = 0.006
    c.use_self_collision = True
    c.self_distance_min = 0.006
    c.self_friction = 8
    cloth.point_cache.frame_start = 1
    cloth.point_cache.frame_end = FRAMES


def make_collider(obj):
    settings = obj.modifiers.new('Item_collision', 'COLLISION')
    obj.collision.thickness_outer = 0.003
    obj.collision.cloth_friction = 80
    obj.collision.damping_factor = 1
    return settings


def mesh_copy(source, name):
    """A plain mesh of what an object looks like now, because curves can't be colliders."""
    graph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(source.evaluated_get(graph))
    copy = bpy.data.objects.new(name, mesh)
    copy.matrix_world = source.matrix_world
    bpy.context.scene.collection.objects.link(copy)
    return copy


def surface_points(obj):
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    points = [obj.matrix_world @ v.co for v in mesh.vertices]
    evaluated.to_mesh_clear()
    return points


def really_inside(evaluated, point):
    """Counts surfaces crossed going straight up. The nearest face's facing misleads around the opening's cut corners."""
    crossings, start = 0, point.copy()
    for _ in range(32):
        hit, location, _, _ = evaluated.ray_cast(start, Vector((0, 0, 1)))
        if not hit:
            break
        crossings += 1
        start = location + Vector((0, 0, 1e-4))
    return crossings % 2 == 1


def deepest_in(points, name):
    obj = bpy.data.objects[name]
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(graph)
    inverse = obj.matrix_world.inverted()
    deepest = 0
    for point in points:
        local = inverse @ point
        if really_inside(evaluated, local):
            found, location, _, _ = evaluated.closest_point_on_mesh(local)
            if found:
                deepest = max(deepest, (local - location).length)
    return deepest


def average(shapes):
    return [sum(points, Vector()) / len(points) for points in zip(*shapes)]


def inside_opening(point):
    d = point - Vector((BAG[0], BAG[1], 0))
    c, s = cos(-BAG_ROT), sin(-BAG_ROT)
    x, y = c * d.x - s * d.y, s * d.x + c * d.y
    # Above the mouth counts: the last thing in rests on what's already there, not on the floor of the opening.
    return abs(x) < OPENING['half_length'] and OPENING['front'] < y < OPENING['back'] and point.z < 0.52


def main():
    scene = reset_scene('Bag_drop')
    build_materials()
    build_shell()
    scene.gravity = (0, 0, -9.81)
    colliders = ['Gym_bag_body', 'Gym_bag_front_pocket']
    for name in colliders:
        make_collider(bpy.data.objects[name])
    # Strap and handle tubes and the belt also hold cloth up, and the rug catches anything that spills.
    for name in ('Bag_webbing', 'Bag_webbing.001', 'Bag_handle_back', 'Bag_handle_front', 'Blue_belt_settled'):
        make_collider(mesh_copy(bpy.data.objects[name], name + '_collider'))
    bpy.ops.mesh.primitive_plane_add(size=6, location=(BAG[0], BAG[1], 0.0355))
    bpy.context.active_object.name = 'Sim_floor'
    make_collider(bpy.context.active_object)

    records, problems = {}, []
    for item in ITEMS:
        scene.frame_set(1)
        bpy.data.objects['Blue_belt_settled_collider'].collision.use = not item['under_belt']
        obj = sheet(item)
        add_cloth(obj)
        recent = []
        for frame in range(1, FRAMES + 1):
            scene.frame_set(frame)
            if frame > FRAMES - 2 * WINDOW:
                recent.append(surface_points(obj))
        points = average(recent[WINDOW:])
        movement = max((a - b).length for a, b in zip(points, average(recent[:WINDOW])))
        depths = {name: deepest_in(points, name) for name in colliders}
        in_mouth = sum(inside_opening(p) for p in points)
        lowest, highest = min(p.z for p in points), max(p.z for p in points)
        print(f"SETTLE {item['name']}: {len(points)} points, drift {movement * 1000:.2f} mm, {in_mouth} inside the mouth, z {lowest:.3f} to {highest:.3f},",
              {k: round(v, 4) for k, v in depths.items()})
        if movement > AT_REST:
            problems.append(f"{item['name']} not at rest: moved {movement * 1000:.2f} mm")
        problems += [f"{item['name']} in {name} by {depth * 1000:.1f} mm" for name, depth in depths.items() if depth > MAX_DEPTH]
        if in_mouth < 12:
            problems.append(f"{item['name']} missed the opening: {in_mouth} points inside")
        faces = [list(p.vertices) for p in obj.data.polygons]
        records[item['name']] = {
            'vertices': [[round(p.x, 5), round(p.y, 5), round(p.z, 5)] for p in points],
            'faces': faces,
            'materials': [item['material']],
            'material_index': [0] * len(faces),
            'smooth': [1] * len(faces),
            'uv': [],
        }
        # What landed becomes something the next item lands on.
        mesh = bpy.data.meshes.new(item['name'] + '_landed')
        mesh.from_pydata([tuple(p) for p in points], [], faces)
        mesh.update()
        landed = bpy.data.objects.new(item['name'] + '_landed', mesh)
        scene.collection.objects.link(landed)
        # With no thickness of its own, the next item tunnels straight through it.
        landed.modifiers.new('Thick', 'SOLIDIFY').thickness = 0.012
        make_collider(landed)
        bpy.data.objects.remove(obj, do_unlink=True)
    for name, record in records.items():
        print('RESULT', name, 'faces', len(record['faces']))
    if '--force' not in sys.argv and problems:
        print('FAIL', '; '.join(problems))
        raise SystemExit(1)
    for name, record in records.items():
        (DATA / f'{name}.json').write_text(json.dumps(record))
    print('SAVED', ', '.join(records))


main()
