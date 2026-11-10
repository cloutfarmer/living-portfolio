"""What web/src depends on. Renaming or merging any of these breaks motion, framing, or the desk click."""
# web/src/Room.tsx and web/src/Life.tsx look these up by exact name.
EXACT_NAMES = ('ROOM', 'Main_Display', 'Right_Display', 'Shake_lid', 'Body', 'Head', 'Hair', 'Phone_glass',
               'Soft_window', 'Warm_fill', 'Window_soft_light', 'Ski_set', 'Surfboard')
# At least this many objects must match each prefix.
PREFIXES = {'Candle_light': 1, 'Flame': 1, 'Hand': 2, 'Main_Display_line': 6, 'Right_Display_line': 6,
            'Desk_': 2, 'Main_Monitor': 3, 'Right_Monitor': 3, 'Shake_': 3}
MATERIALS = ('Warm_Oak', 'Monitor_Screen', 'Window_Dusk', 'Candle_Flame', 'Candle_Wax', 'PC_teal_glow')
