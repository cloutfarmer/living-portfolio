"""Cables from the monitors down to the PC, and from the PC to a wall outlet.

Each route is a list of points the cable passes through. Heights are worked out from what it lies on:
desktop top 1.245, floor 0, and rug top 0.0355 up to y 1.03. Ends stop at the surface they plug into.
"""
from mathutils import Vector

from lib.builders import box, curve

RADIUS = 0.006
# A millimetre of air, so a cable lies on a surface without passing through it.
ON_DESK = 1.245 + RADIUS + 0.001
ON_FLOOR = RADIUS + 0.001
# Back of the PC case is y 0.8; back of the wall's plaster is y 1.63.
ROUTES = {
    'Cable_main_monitor': [
        (-0.57, 0.9235, 1.42), (-0.56, 0.975, 1.325), (-0.5, 1.07, ON_DESK), (-0.42, 1.19, ON_DESK),
        (-0.38, 1.25, 1.19), (-0.35, 1.27, 0.9), (-0.2, 1.3, 0.3), (0.05, 1.32, ON_FLOOR),
        (0.45, 1.25, ON_FLOOR), (0.66, 1.0, 0.09), (0.66, 0.806, 0.3),
    ],
    'Cable_right_monitor': [
        (0.167, 0.952, 1.42), (0.19, 1.04, 1.325), (0.24, 1.12, ON_DESK), (0.28, 1.19, ON_DESK),
        (0.31, 1.25, 1.19), (0.33, 1.27, 0.9), (0.42, 1.28, 0.3), (0.55, 1.2, ON_FLOOR),
        (0.74, 1.0, 0.09), (0.74, 0.806, 0.34),
    ],
    'Cable_pc_power': [
        (0.82, 0.806, 0.25), (0.84, 0.98, 0.08), (0.95, 1.14, ON_FLOOR), (1.4, 1.42, ON_FLOOR),
        (1.72, 1.47, ON_FLOOR), (1.82, 1.53, 0.30), (1.85, 1.59, 0.33), (1.85, 1.618, 0.33),
    ],
}


def smooth(points):
    """Bezier handles from each point's neighbors, so the cable passes through every point."""
    # Read before converting: Vector stores single precision, so its z no longer equals the constants.
    lying = [point[2] in (ON_DESK, ON_FLOOR) for point in points]
    points = [Vector(point) for point in points]
    spline = []
    for index, point in enumerate(points):
        before = points[max(index - 1, 0)]
        after = points[min(index + 1, len(points) - 1)]
        handle = (after - before) / 6
        # Level where it lies on something, or the curve would dip through the surface.
        if lying[index]:
            handle.z = 0
        spline.append((tuple(point), tuple(point - handle), tuple(point + handle)))
    return spline


def build():
    box('Wall_outlet', (1.85, 1.624, 0.33), (0.09, 0.012, 0.13), 'Paper_Ceramic', group='Room', bevel=0.003)
    for name, route in ROUTES.items():
        curve(name, smooth(route), 'Charcoal', RADIUS, bevel_resolution=1, resolution=4, caps=True)
