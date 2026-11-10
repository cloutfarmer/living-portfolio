from lib.builders import box, frozen


def build():
    box('PC_case', (0.75, 0.55, 0.38), (0.34, 0.5, 0.7), 'Bag_Charcoal', bevel=0.035)
    frozen('PC_front_fan_ring', (0.75, 0.294, 0.23), rot=(1.5708, -0, 0))
    frozen('PC_front_fan_ring.001', (0.75, 0.294, 0.48), rot=(1.5708, -0, 0))
    box('PC_power_button', (0.75, 0.292, 0.67), (0.025, 0.008, 0.012), 'PC_teal_glow', bevel=0.004)
    box('PC_side_light', (0.934, 0.55, 0.4), (0.009, 0.27, 0.015), 'PC_teal_glow', bevel=0.003)
    box('PC_side_panel', (0.925, 0.55, 0.4), (0.012, 0.4, 0.53), 'PC_tinted_panel', bevel=0.012)
