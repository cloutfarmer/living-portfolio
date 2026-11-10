"""What stands on the side table. The user plans to add more, so keep the rest of the top clear."""
from math import cos, pi, sin

from lib.builders import SOURCE, flat_text, imported
from props.side_table import MIDDLE_Y, TOP, WALL

# Tall enough for the label to read, and its top at 1.08 still clears the frames at 1.135.
TUB_HEIGHT = 0.36
# Toward the table's front end, so the rest stays free.
TUB = (WALL + 0.27, MIDDLE_Y - 0.32)
# The tub is a hexagonal prism. This turns its flat +x side toward the ROOM camera.
TUB_TURN = -0.967
# Measured on the source model and scaled to TUB_HEIGHT: the flat side's distance from the middle,
# the flat side's width, and the height of its middle above the tub's base.
TUB_SCALE = TUB_HEIGHT / 0.269
FACE_DISTANCE = 0.075 * TUB_SCALE
FACE_WIDTH = 0.0866 * TUB_SCALE
FACE_MIDDLE = 0.1195 * TUB_SCALE
AIR = 0.001
# Within reach, unlike a high shelf: someone has to tend it. Big enough to read from the room, while its top still
# clears the frames at 1.135 and its canopy stays off the left wall.
BONSAI = (WALL + 0.26, MIDDLE_Y + 0.18)
BONSAI_HEIGHT = 0.55
# Turns the tree's wide side toward the room while it still fits the table's depth.
BONSAI_TURN = 1.0


def build():
    imported('Protein_tub', SOURCE / 'protein-powder.glb', TUB_HEIGHT, (*TUB, TOP + AIR), rot=(0, 0, TUB_TURN),
             materials={'Plastic1Protein1': 'Protein_Tub', 'Lid1Protein1': 'Charcoal'})
    imported('Bonsai', SOURCE / 'bonsai.glb', BONSAI_HEIGHT, (*BONSAI, TOP + AIR), rot=(0, 0, BONSAI_TURN),
             materials={'mat17': 'Charcoal', 'mat11': 'Connection_MutedGreen', 'mat20': 'Warm_Oak', 'mat10': 'Bonsai_Leaf', 'mat8': 'Protein_Tub',
                        'mat25': 'Smoothie_Glass', 'mat15': 'Paper_Ceramic', 'mat16': 'Bag_Trim'})
    spot = (TUB[0] + (FACE_DISTANCE + AIR) * cos(TUB_TURN), TUB[1] + (FACE_DISTANCE + AIR) * sin(TUB_TURN), TOP + AIR + FACE_MIDDLE)
    flat_text('Protein_label', 'GAINS', spot, (pi / 2, 0, TUB_TURN + pi / 2), FACE_WIDTH * 0.9, 'Label_Cream')
