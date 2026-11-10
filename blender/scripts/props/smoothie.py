"""The desk's smoothie, from an imported model. Replaces the shake that was built here.

The source is one mesh in three loose pieces: the outer cup with its lid, the drink inside, and the
straw. Part names keep the Shake_ prefix and Shake_lid, which web/src/Room.tsx and lib/site_contract.py use.
"""
import bpy

from lib.builders import SOURCE, imported, split_by_faces

DESK_TOP = 1.245
# About a quarter shorter than the first import, which stood well over twice the mugs and read too big.
HEIGHT = 0.34
# The recovery drink after training: within reach of the right hand, just past the mouse pad and behind the phone.
# Stood 1 mm clear of the desk.
SPOT = (0.66, 0.31, DESK_TOP + 0.001)
# Turns the straw's lean toward the seated person.
TURN = 0.0
# The source cup's lip starts here, as a share of the model's height from its base.
LID_STARTS = (1.5 + 2.166) / 6.262


def loose_pieces(mesh):
    """Face indices of each loose piece. Faces join by position, because import splits vertices at UV seams."""
    def spot(vertex):
        return tuple(round(value, 5) for value in mesh.vertices[vertex].co)

    faces_at = {}
    for polygon in mesh.polygons:
        for vertex in polygon.vertices:
            faces_at.setdefault(spot(vertex), []).append(polygon.index)
    pieces, seen = [], set()
    for polygon in mesh.polygons:
        if polygon.index in seen:
            continue
        piece, stack = set(), [polygon.index]
        while stack:
            index = stack.pop()
            if index in piece:
                continue
            piece.add(index)
            stack += [other for vertex in mesh.polygons[index].vertices for other in faces_at[spot(vertex)]]
        seen |= piece
        pieces.append(piece)
    return pieces


def build():
    source = imported('Smoothie_source', SOURCE / 'smoothie.glb', HEIGHT, SPOT, rot=(0, 0, TURN), materials={'initialShadingGroup': 'Smoothie_Glass'})
    pieces = sorted(loose_pieces(source.data), key=len, reverse=True)
    outer, drink_or_straw = pieces[0], pieces[1:]
    # The straw is the piece that reaches the top of the model.
    top = {index: max(source.data.vertices[v].co.z for v in polygon.vertices) for index, polygon in enumerate(source.data.polygons)}
    straw = max(drink_or_straw, key=lambda piece: max(top[index] for index in piece))
    drink = next(piece for piece in drink_or_straw if piece is not straw)
    lid_height = HEIGHT * LID_STARTS

    def is_lid(index):
        return index in outer and source.data.polygons[index].center.z >= lid_height

    split_by_faces(source, {
        'Shake_cup': (lambda index: index in outer and not is_lid(index), 'Smoothie_Glass'),
        'Shake_lid': (is_lid, 'Smoothie_Glass'),
        'Shake_drink': (lambda index: index in drink, 'Shake_Berry'),
        'Shake_straw': (lambda index: index in straw, 'Terracotta'),
    })
    bpy.data.objects.remove(source, do_unlink=True)
