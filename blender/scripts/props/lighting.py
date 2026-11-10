import json

import bpy

from lib.builders import DATA, camera, keyframes, light
from lib.layout import DESK_SHIFT, WINDOW_SHIFT, scaled
from props.candle import FLAME_DROP


def _scaled_axis(value, axis):
    point = [0, 0, 0]
    point[axis] = value
    return scaled(point)[axis]


def build():
    light('Soft_window', 'AREA', 55, (.6, .69, 1), (1, -2.5, 4), rot=(.6995, 0, .38051), radius=0, size=4, size_y=.25, shape='DISK')
    light('Warm_fill', 'AREA', 30, (1, .79, .55), (-1, -1, 3.5), rot=(.48249, 0, -.7854), radius=0, size=3, size_y=.25, shape='DISK')
    light('Window_soft_light', 'AREA', 12, (.42, .6, 1), (.96 + WINDOW_SHIFT, 1.25, 2.35), rot=(.87585, 0, 2.257), radius=0, size=1.1, size_y=.8, shape='RECTANGLE')
    light('PC_soft_glow', 'POINT', 2, (.1, .65, .75), scaled((.9 + DESK_SHIFT, .25, .35)), radius=.25)
    candle = light('Candle_light_0', 'POINT', 18, (1, .32, .065), scaled((.77 + DESK_SHIFT, .78, 1.6 + FLAME_DROP)), radius=.12)

    camera('ROOM', 5.9, (5, -7, 5), (1.14447, 0, .60375))
    camera('DESK', 3.4, (2, -3, 4), (.97493, 0, .5649))

    # One value per frame, so the flame and its light flicker together.
    flicker = json.loads((DATA / 'candle_flicker.json').read_text())
    for owner, channels in ((bpy.data.objects['Flame_0'], flicker['Flame_0']), (candle.data, flicker['Candle_light_0'])):
        for channel in channels:
            keys = channel['keys']
            # The flame's keys are absolute, so they would otherwise pull it back to its old place.
            index = channel['index']
            if channel['path'] == 'location':
                # The flicker was recorded over the old, taller candle.
                shift = (DESK_SHIFT, 0, FLAME_DROP)[index]
                keys = [[frame, _scaled_axis(value + shift, index)] for frame, value in keys]
            keyframes(owner, channel['path'], keys, channel['index'])
