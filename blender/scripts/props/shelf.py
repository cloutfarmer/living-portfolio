from lib.builders import SOURCE, box, imported

SHELF_TOP = 2.165
TROPHY_HEIGHT = 0.38
# The source's handles run along y. This squares them to the ROOM camera, so it shows both handles.
TROPHY_TURN = -0.96
BOOKS_HEIGHT = 0.42
# The source's row runs diagonally. This lays it along the shelf with the spines toward the room.
BOOKS_TURN = 0.7854
# These three hover about 2 cm above the rest in the source.
BOOKS_HOVERING = ('group1213657262', 'group200722673', 'group1575640598')
BOOK_COLOURS = {'mat10': 'Connection_MutedGreen', 'mat12': 'Sticky_Yellow', 'mat21': 'Paper_Ceramic', 'mat20': 'Charcoal',
                'mat19': 'Sweater_Ochre', 'mat13': 'Sweater_Ochre', 'mat11': 'Connection_MutedGreen', 'mat1': 'Shake_Berry',
                'mat8': 'Terracotta'}


def build():
    box('Shelf', (-0.87, 1.4, 2.13), (1.85, 0.43, 0.07), 'Warm_Oak', group='Furniture', scale=(0.83784, 1, 1), bevel=0.009, segments=2)
    box('Shelf_bracket', (-1.35, 1.54, 1.99), (0.055, 0.08, 0.24), 'Charcoal', group='Furniture', bevel=0.009, segments=2)
    box('Shelf_bracket.001', (-0.15, 1.54, 1.99), (0.055, 0.08, 0.24), 'Charcoal', group='Furniture', bevel=0.009, segments=2)
    imported('Shelf_books', SOURCE / 'boooks.glb', BOOKS_HEIGHT, (-1.155, 1.43, SHELF_TOP + 0.001), rot=(0, 0, BOOKS_TURN),
             materials=BOOK_COLOURS, settle=BOOKS_HOVERING)
    imported('Shelf_trophy', SOURCE / 'trophy.glb', TROPHY_HEIGHT, (-0.52, 1.4, SHELF_TOP + 0.001), rot=(0, 0, TROPHY_TURN),
             materials={'mat12': 'Trophy_Gold', 'mat20': 'Warm_Oak'})
