"""Every material in the scene. glTF keeps base color, roughness, metallic, and emission only;
node textures reach Cycles renders but flatten to one color in the browser (see export_web_glb.py).
"""
import bpy

# name: base color, roughness, optional emission strength, optional metallic.
# Emissive materials glow in their own base color.
FLAT = {
    'Bag_Charcoal': ((.035, .045, .05), .85),
    'Bag_Trim': ((.16, .21, .2), .85),
    # Pale and warm, because they sit in the room's dim front corner, away from the candle.
    'Bag_Towel': ((.78, .74, .64), .95),
    'Bag_Shirt': ((.46, .13, .07), .9),
    'BJJ_Blue_Belt': ((.035, .15, .48), .85),
    'Bonsai_Leaf': ((.07, .36, .09), .7),
    'Candle_Flame': ((1, .28, .025), .65, 6),
    # The flame's pale base.
    'Candle_Flame_core': ((1, .78, .36), .65, 7),
    'Candle_Wax': ((1, .64, .26), .65, 0),
    # Matte, because any shine shows as grey on the hair's low-poly facets.
    'Character_Hair': ((.003, .003, .004), .95),
    'Character_Hoodie': ((.09, .12, .03), .8),
    'Character_Shoe': ((.366, .366, .366), .7),
    # Socks, since the shoes are off. Their soles are grubby.
    'Character_Sock': ((.8, .78, .72), .95),
    'Character_Sock_sole': ((.34, .32, .3), .95),
    'Character_Shorts': ((.026, .04, .05), .8),
    # About half the model's own skin, because the browser's tone mapping lifts it. Separate from `Skin`.
    'Character_Skin': ((.25, .15, .08), .72),
    # The file's near-black navy, lifted, because this side of the room is dim.
    # Black leather. A little glossier than the rest, so its highlights show the chair's shape on the dark rug.
    'Chair_Leather': ((.02, .02, .022), .45),
    'Charcoal': ((.045, .055, .06), .72),
    # The skis' graphics, after the user's own pair, and the surfboard's rails.
    'Ski_Cyan': ((.02, .42, .5), .45),
    'Ski_Magenta': ((.6, .035, .33), .45),
    # The fish surfboard: glossy, so the candle and window catch on it. Fins a deeper sea blue that goes with the rails.
    'Surfboard_Deck': ((.88, .86, .8), .14),
    'Surfboard_Rail': ((.02, .42, .5), .18),
    'Surfboard_Fin': ((.012, .12, .2), .12),
    # Kraft card, for the coffee cups' sleeves.
    'Cup_Sleeve': ((.42, .25, .12), .85),
    # Near black, so only sharp highlights show. A lighter base shows the leaned normals in props/desk_clutter.py as a dome.
    'Coffee': ((.022, .009, .004), .12),
    'Connection_MutedGreen': ((.045, .25, .24), .5),
    'Keycap': ((.3, .31, .32), .7),
    'Monitor_Accent': ((.65, .4, .22), .65, .3),
    'Monitor_Screen': ((.035, .085, .1), .65, .45),
    'Monitor_Text': ((.34, .65, .53), .65, .5),
    'Muted_Rug': ((.15, .16, .15), .92),
    'Paper_Ceramic': ((.86, .79, .62), .72),
    # Glows a little, so the text still reads in the room's dim corner, away from the candle.
    'Label_Cream': ((.92, .86, .68), .7, .35),
    'PC_teal_glow': ((.025, .5, .56), .5, 2),
    'Protein_Tub': ((.5, .05, .03), .55),
    'PC_tinted_panel': ((.045, .085, .09), .27, 0, .3),
    'Rank_Stripe_White': ((.83, .81, .72), .85),
    'Shake_Berry': ((.22, .025, .34), .45),
    'Sketch_ink': ((.08, .13, .12), .8),
    'Skin': ((.58, .35, .22), .72),
    'Sticky_Yellow': ((.95, .72, .14), .8),
    'Sweater_Ochre': ((.92, .44, .035), .72),
    'Terracotta': ((.85, .13, .22), .72),
    # Mostly not metal: the browser has no environment for full metal to reflect, so it would render near black.
    'Trophy_Gold': ((.85, .55, .06), .35, 0, .3),
    'Window_Dusk': ((.075, .15, .23), .65, .35),
    'Window_PaintedIvory': ((.73, .7, .59), .65, 0),
}


def _flat(name, color, roughness, emission=None, metallic=0):
    material = bpy.data.materials.new(name)
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission is not None:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return material


def _bumped(name, color, roughness, noise_scale, bump):
    """A flat color with fine noise relief, for walls and carpet."""
    material = _flat(name, color, roughness)
    tree = material.node_tree
    noise = tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = noise_scale
    noise.inputs['Detail'].default_value = 2
    relief = tree.nodes.new('ShaderNodeBump')
    relief.inputs['Strength'].default_value = bump
    tree.links.new(noise.outputs[0], relief.inputs['Height'])
    tree.links.new(relief.outputs['Normal'], tree.nodes['Principled BSDF'].inputs['Normal'])
    return material


def _oak():
    """Grain stretched along each part's length. The browser redraws this in web/src/Room.tsx."""
    material = _flat('Warm_Oak', (.38, .12, .075), .72)
    tree = material.node_tree
    shader = tree.nodes['Principled BSDF']
    coords = tree.nodes.new('ShaderNodeTexCoord')
    stretch = tree.nodes.new('ShaderNodeVectorMath')
    stretch.operation = 'MULTIPLY'
    stretch.inputs[1].default_value = (2, 38, 7)
    noise = tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 5
    noise.inputs['Detail'].default_value = 3
    ramp = tree.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .2
    ramp.color_ramp.elements[0].color = (.1, .035, .015, 1)
    ramp.color_ramp.elements[1].position = .8
    ramp.color_ramp.elements[1].color = (.4, .21, .085, 1)
    relief = tree.nodes.new('ShaderNodeBump')
    relief.inputs['Strength'].default_value = .12
    tree.links.new(coords.outputs['Generated'], stretch.inputs[0])
    tree.links.new(stretch.outputs[0], noise.inputs['Vector'])
    tree.links.new(noise.outputs[0], ramp.inputs['Fac'])
    tree.links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    tree.links.new(noise.outputs[0], relief.inputs['Height'])
    tree.links.new(relief.outputs['Normal'], shader.inputs['Normal'])
    return material


def build_materials():
    for name, values in FLAT.items():
        _flat(name, *values)
    glass = _flat('Smoothie_Glass', (.8, .84, .86), .15)
    glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .22
    glass.surface_render_method = 'BLENDED'
    _bumped('Neutral_Plaster', (.43, .4, .34), .92, 85, .1)
    _bumped('Neutral_Carpet', (.2, .18, .15), .92, 160, .32)
    _oak()
