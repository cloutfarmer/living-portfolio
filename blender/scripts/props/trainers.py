"""Trainers kicked off on the way in from training, in front of the dropped gym bag.

One shoe model, placed twice: one lands upright with its toe toward the chair, the other rolls onto its side behind it.
The source's toe points along its +x, and its heel is the tall end.
"""
from math import pi

from lib.builders import SOURCE, imported
from lib.layout import RUG_TOP

# The source is 9.7 long and 4.77 tall. This makes it about 0.31 long at the person's scale, a large trainer for someone 2.05 tall.
HEIGHT = 0.2
COLOURS = {'1A1A1A': 'Charcoal', 'FFFFFF': 'Paper_Ceramic'}
AIR = 0.0013
# Each is (x, y, roll onto its side, turn). The upright one points at the chair; the other came off a step later and fell over.
SHOES = (
    (1.7467, -0.5167, 0, pi - 0.35),
    (1.96, -0.2767, pi / 2 + 0.12, 2.3),
)


def build():
    for index, (x, y, roll, turn) in enumerate(SHOES):
        name = 'Trainer' + (f'.{index:03d}' if index else '')
        shoe = imported(name, SOURCE / 'trainer.glb', HEIGHT, (x, y, RUG_TOP + AIR), rot=(roll, 0, turn), materials=COLOURS)
        # A shoe on its side rests on its curved flank, not its sole, so drop whichever point is lowest onto the rug.
        shoe.data.update()
        low = min((shoe.matrix_basis @ vertex.co).z for vertex in shoe.data.vertices)
        shoe.location.z += RUG_TOP + AIR - low
