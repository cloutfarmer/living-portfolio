"""The seasonal corner: skis and poles in winter, a surfboard the rest of the year, leaning on the left wall where the floor
was empty, for skiing in winter and surfing in summer. Both are built here; web/src/Room.tsx shows one by the NJ date.

They share one spot, so check_scene.py treats them as one assembly (lib/scene_rules.py). Blender stills show both.
Authored in the side table's positions: lib/layout.py moves the group with the left wall and shrinks it to the person.
"""
from math import pi, sin

import bmesh
import bpy
import numpy
from mathutils import Matrix, Vector

from lib.builders import SOURCE

# The left wall's inner face, the baseboard's face, and the floor, in this group's authored positions.
WALL = -1.96
BASEBOARD = -1.905
AIR = 0.0013
# Both lean back this far from upright, their tops resting on the wall, in front of the pinboard's span (y above -0.3).
LEAN = 0.13

# Skis by apelab, recoloured after the user's own: black and white, with teal and magenta mountains running up them.
SKIS = SOURCE / 'skis.glb'
SKI_LENGTH = 2.75
# Bands up the top sheet from tail to tip, as (where the band ends, material).
SKI_BANDS = ((.07, 'Ski_Magenta'), (.2, 'Rank_Stripe_White'), (.33, 'Ski_Cyan'), (.42, 'Ski_Magenta'), (.58, 'Charcoal'),
             (.7, 'Rank_Stripe_White'), (.8, 'Ski_Cyan'), (.88, 'Ski_Magenta'), (1.01, 'Charcoal'))
# Where each ski and pole stands along the wall, and a little turn so the pair isn't a matched set.
SKI_SPOTS = ((-0.86, 0.04), (-1.07, -0.05))
POLE_SPOTS = ((-1.26, 0.08), (-1.33, -0.06))
# The file's parts: the ski with its binding, the pole, and the pole's strap.
SKI_NODE, POLE_NODE, STRAP_NODE = 'group915994952', 'group1189042932', 'group700172888'
POLE_COLOURS = {'mat20': 'Keycap', 'mat23': 'Charcoal', 'mat19': 'Ski_Cyan'}

# A fish: short and wide, round-nosed, with a swallow tail and two keel fins. It stands on its tail with the deck to the wall,
# so its bottom and fins face the room.
# Half-widths along it from tail to nose, as shares of the widest; the tail's notch cuts in from between the two tips.
BOARD_LENGTH = 2.2
BOARD_SPOT = -0.98
# Turned a little from the wall's line toward the Room view's camera, so the fins face it.
BOARD_TURN = -0.35
BOARD_WIDTHS = ((0, .62), (.08, .76), (.2, .9), (.4, 1), (.6, .96), (.75, .84), (.86, .66), (.93, .46), (.97, .28), (1, 0))
BOARD_HALF_WIDTH = 0.34
SWALLOW = 0.1
# Thickest through the middle, thin at the nose and tail.
BOARD_THICK = (0.015, 0.03)
# The rail rounds in: the deck and bottom edges sit this far inside the rail's widest line.
RAIL_TUCK = 0.94
# Each keel fin: from and to along the board, how far it stands off the bottom, how far in from the rail, and its thickness.
FIN = {'from': .03, 'to': .21, 'depth': .12, 'inset': .78, 'thick': .012}

def _joined(objects, name):
    """Joins meshes into one object with its transforms applied."""
    for obj in objects:
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
    with bpy.context.temp_override(active_object=objects[0], selected_objects=objects, selected_editable_objects=objects):
        bpy.ops.object.join()
    objects[0].name = objects[0].data.name = name
    objects[0].rotation_mode = 'XYZ'
    return objects[0]


def _material(mesh, old, new):
    for slot, material in enumerate(mesh.materials):
        if material.name == old:
            mesh.materials[slot] = bpy.data.materials[new]


def _stand_up(mesh, top_hint):
    """Turns a long part to stand along +z with its face toward +x (the room), from its own principal axes.

    `top_hint` is a point on the side that should face the room; the tip is whichever end the hint is nearer.
    """
    points = numpy.array([vertex.co[:] for vertex in mesh.vertices])
    middle = points.mean(axis=0)
    _, axes = numpy.linalg.eigh(numpy.cov((points - middle).T))
    thin, _, long = (Vector(axes[:, index]) for index in range(3))
    hint = Vector(top_hint) - Vector(middle)
    if hint.dot(thin) < 0:
        thin = -thin
    if hint.dot(long) < 0:
        long = -long
    across = long.cross(thin)
    # Rows are where each new axis comes from: +x from the face, +y across, +z along.
    turn = Matrix((thin, across, long)).to_4x4()
    mesh.transform(turn @ Matrix.Translation(-Vector(middle)))


def _lean_on_wall(obj, along_y, turn):
    """Tilts a standing part back onto the wall at `along_y`, resting on the floor, its top 1.3 mm off the wall."""
    obj.data.transform(Matrix.Rotation(turn, 4, 'Z'))
    obj.data.transform(Matrix.Rotation(-LEAN, 4, 'Y'))
    points = [vertex.co for vertex in obj.data.vertices]
    low = min(point.z for point in points)
    back = min(point.x for point in points)
    obj.data.transform(Matrix.Translation((WALL + AIR - back, along_y - (min(p.y for p in points) + max(p.y for p in points)) / 2, AIR - low)))
    foot = min((point for point in obj.data.vertices), key=lambda vertex: vertex.co.z).co
    assert foot.x > BASEBOARD, f'{obj.name} stands in the baseboard'


def _banded(obj, length, bands, keep):
    """Cuts a standing part across at each band's end and colours its faces by band, all but materials in `keep`."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    low = min(vertex.co.z for vertex in bm.verts)
    for end, _ in bands[:-1]:
        geometry = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geometry, plane_co=(0, 0, low + end * length), plane_no=(0, 0, 1))
    keep_slots = {slot for slot, material in enumerate(obj.data.materials) if material.name in keep}
    names = [material.name for material in obj.data.materials]
    for _, material in bands:
        if material not in names:
            obj.data.materials.append(bpy.data.materials[material])
            names.append(material)
    for face in bm.faces:
        if face.material_index in keep_slots:
            continue
        share = (face.calc_center_median().z - low) / length
        face.material_index = names.index(next(material for end, material in bands if share < end))
    bm.to_mesh(obj.data)
    bm.free()


def skis():
    before = set(bpy.data.objects)
    known = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(SKIS))
    new = [obj for obj in bpy.data.objects if obj not in before]
    by_node = {obj.name: obj for obj in new}
    parts = []
    for spot, turn in SKI_SPOTS:
        ski = by_node[SKI_NODE].copy()
        ski.data = by_node[SKI_NODE].data.copy()
        bpy.context.scene.collection.objects.link(ski)
        ski.data.transform(ski.matrix_world)
        ski.matrix_world = Matrix.Identity(4)
        # The binding sits on the top sheet, so its middle marks the side that faces the room.
        binding = [ski.matrix_world @ ski.data.vertices[v].co for p in ski.data.polygons if ski.data.materials[p.material_index].name == 'mat20'
                   for v in p.vertices]
        _stand_up(ski.data, sum(binding, Vector()) / len(binding))
        size = SKI_LENGTH / (max(v.co.z for v in ski.data.vertices) - min(v.co.z for v in ski.data.vertices))
        ski.data.transform(Matrix.Diagonal((size, size, size, 1)))
        _material(ski.data, 'mat20', 'Charcoal')
        _banded(ski, SKI_LENGTH, SKI_BANDS, keep={'Charcoal'})
        _lean_on_wall(ski, spot, turn)
        parts.append(ski)
    for spot, turn in POLE_SPOTS:
        pole = by_node[POLE_NODE].copy()
        pole.data = by_node[POLE_NODE].data.copy()
        strap = by_node[STRAP_NODE].copy()
        strap.data = by_node[STRAP_NODE].data.copy()
        for part in (pole, strap):
            bpy.context.scene.collection.objects.link(part)
        pole = _joined([pole, strap], 'Ski_pole')
        for old, new_name in POLE_COLOURS.items():
            _material(pole.data, old, new_name)
        # A pole's length runs from the basket up to the grip: stand it on its tip, grip up.
        points = [v.co for v in pole.data.vertices]
        grip = max(points, key=lambda point: point.z)
        _stand_up(pole.data, grip + Vector((0.01, 0, 0)))
        if max(v.co.z for v in pole.data.vertices) < -min(v.co.z for v in pole.data.vertices):
            pole.data.transform(Matrix.Rotation(pi, 4, 'X'))
        # Poles come to about two thirds of the skis' height.
        size = SKI_LENGTH * .67 / (max(v.co.z for v in pole.data.vertices) - min(v.co.z for v in pole.data.vertices))
        pole.data.transform(Matrix.Diagonal((size, size, size, 1)))
        _lean_on_wall(pole, spot, turn)
        parts.append(pole)
    for obj in new:
        bpy.data.objects.remove(obj, do_unlink=True)
    winter = _joined(parts, 'Ski_set')
    for collection in list(winter.users_collection):
        collection.objects.unlink(winter)
    bpy.data.collections['Furniture'].objects.link(winter)
    for polygon in winter.data.polygons:
        polygon.use_smooth = False
    # The skis' original colour is painted over everywhere, so drop its slot rather than export an empty one.
    with bpy.context.temp_override(object=winter, active_object=winter):
        bpy.ops.object.material_slot_remove_unused()
    # Later imports reuse the file's material names, so its own materials have to go, as imported() does.
    for material in set(bpy.data.materials) - known:
        bpy.data.materials.remove(material)


def surfboard():
    """A glossy fish: deck and bottom faces, a rounded rail around them, and two keel fins near the tail tips."""
    def width(share):
        for (before, low), (after, high) in zip(BOARD_WIDTHS, BOARD_WIDTHS[1:]):
            if share <= after:
                return BOARD_HALF_WIDTH * (low + (high - low) * (share - before) / (after - before))
        return 0.0

    def thick(share):
        return BOARD_THICK[0] + BOARD_THICK[1] * sin(pi * share) ** .7

    # The outline, counterclockwise seen from the deck: the notch, out to the right tip, up the rail, round the nose, and back.
    shares = [share for share, _ in BOARD_WIDTHS]
    outline = [(0.0, SWALLOW)] + [(width(share), share) for share in shares] + [(-width(share), share) for share in reversed(shares[:-1])]
    bm = bmesh.new()
    rings = []
    for y, share in outline:
        z, t = share * BOARD_LENGTH, thick(share)
        rings.append((bm.verts.new((t, y * RAIL_TUCK, z)), bm.verts.new((0, y, z)), bm.verts.new((-t, y * RAIL_TUCK, z))))
    deck, rail, fin = 0, 1, 2
    bm.faces.new([ring[0] for ring in rings]).material_index = deck
    bm.faces.new([ring[2] for ring in reversed(rings)]).material_index = deck
    for here, after in zip(rings, rings[1:] + rings[:1]):
        bm.faces.new((here[0], after[0], after[1], here[1])).material_index = rail
        bm.faces.new((here[1], after[1], after[2], here[2])).material_index = rail
    for side in (1, -1):
        y = side * width(FIN['from']) * FIN['inset']
        low, high = FIN['from'] * BOARD_LENGTH, FIN['to'] * BOARD_LENGTH
        bottom = -thick(FIN['from'])
        # Long-based and raked back toward the tail, like a keel.
        outline_fin = [(bottom + .002, low), (bottom + .002, high), (bottom - FIN['depth'], low + .02)]
        near = [bm.verts.new((x, y - FIN['thick'] / 2, z)) for x, z in outline_fin]
        far = [bm.verts.new((x, y + FIN['thick'] / 2, z)) for x, z in outline_fin]
        faces = [near[::-1], far] + [(near[i], near[(i + 1) % 3], far[(i + 1) % 3], far[i]) for i in range(3)]
        for verts in faces:
            bm.faces.new(verts).material_index = fin
    # The deck and bottom are concave at the notch, so triangulate them here rather than leave it to the exporter.
    bmesh.ops.triangulate(bm, faces=[face for face in bm.faces if len(face.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new('Surfboard')
    bm.to_mesh(mesh)
    bm.free()
    for material in ('Surfboard_Deck', 'Surfboard_Rail', 'Surfboard_Fin'):
        mesh.materials.append(bpy.data.materials[material])
    # Bottom out: half a turn about its length puts the deck against the wall and the fins toward the room.
    mesh.transform(Matrix.Rotation(pi, 4, 'Z'))
    board = bpy.data.objects.new('Surfboard', mesh)
    bpy.data.collections['Furniture'].objects.link(board)
    _lean_on_wall(board, BOARD_SPOT, BOARD_TURN)

def build():
    skis()
    surfboard()
