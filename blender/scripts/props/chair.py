"""The person's office chair: a licensed model, sized to them, with its gas column lowered to the seat they sit on."""
from math import pi

from lib.builders import SOURCE, imported
from lib.layout import RUG_TOP, SCALE

# Heights in the file, in metres.
MODEL_HEIGHT = 1.237
MODEL_SEAT = 0.65
# The column runs between the base's hub and the seat's underside. Only this band gets squashed, so the rest keeps its shape.
COLUMN = (0.19, 0.48)
# How big the chair is against the file, so its arms clear the person's thighs.
SIZE = 1.05
# Where the person sits. Keep in step with HIPS in props/character.py.
SEAT_TOP = 0.514
SPOT = (-0.28, -0.60)


def build():
    # Authored sizes get shrunk by SCALE later, so this works in authored units throughout.
    unit = SIZE / SCALE
    chair = imported('Chair_executive', SOURCE / 'executive-chair.glb', MODEL_HEIGHT * unit, (*SPOT, RUG_TOP + 0.0013), group='Furniture',
                     rot=(0, 0, pi), materials={'LeatherExecutiveChair1': 'Chair_Leather'})
    low, high = COLUMN[0] * unit, COLUMN[1] * unit
    drop = MODEL_SEAT * unit - (SEAT_TOP - RUG_TOP) / SCALE
    for vertex in chair.data.vertices:
        if vertex.co.z >= high:
            vertex.co.z -= drop
        elif vertex.co.z > low:
            vertex.co.z -= drop * (vertex.co.z - low) / (high - low)
    chair.data.update()
