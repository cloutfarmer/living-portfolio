from lib.builders import box
from lib.layout import DESK_SHIFT


def build():
    box('Back_baseboard', (0, 1.59, 0.1), (4.2, 0.05, 0.16), 'Warm_Oak', center=(1.0, 0, 0), group='Room', bevel=0.025)
    box('Back_wall', (0, 1.7, 1.45), (4.4, 0.14, 3), 'Neutral_Plaster', center=(1.0, 0, 0), group='Room', bevel=0.025)
    box('Floor', (0, 0, -0.1), (4.4, 3.8, 0.2), 'Neutral_Carpet', center=(1.0, -0.15, 0), group='Room', bevel=0.025)
    box('Left_baseboard', (-1.03, 0, 0.1), (0.05, 3.6, 0.16), 'Warm_Oak', center=(0, -0.15, 0), group='Room', bevel=0.025)
    box('Left_wall', (-1.13, 0, 1.45), (0.14, 3.8, 3), 'Neutral_Plaster', center=(0, -0.15, 0), group='Room', bevel=0.025)
    box('Playful_rug', (-0.12 + DESK_SHIFT, -0.22, 0.018), (2.45, 1.8, 0.035), 'Muted_Rug', group='Room', scale=(1.36735, 1.38889, 1), bevel=0.025)
