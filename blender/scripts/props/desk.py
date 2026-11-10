from lib.builders import box


def build():
    box('Desk_leg_1', (-1.6, -0.02, 0.55), (0.12, 0.12, 1.1), 'Charcoal', group='Furniture', bevel=0.025)
    box('Desk_leg_2', (1.2, -0.02, 0.55), (0.12, 0.12, 1.1), 'Charcoal', group='Furniture', bevel=0.025)
    box('Desk_leg_3', (-1.6, 1.06, 0.55), (0.12, 0.12, 1.1), 'Charcoal', group='Furniture', bevel=0.025)
    box('Desk_leg_4', (1.2, 1.06, 0.55), (0.12, 0.12, 1.1), 'Charcoal', group='Furniture', bevel=0.025)
    box('Desk_top', (-0.2, 0.52, 1.18), (2.6, 1.05, 0.13), 'Warm_Oak', group='Furniture', scale=(1.21154, 1.33333, 1), bevel=0.045)
