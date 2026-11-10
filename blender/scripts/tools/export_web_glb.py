"""Export the opened .blend to a browser GLB: Blender --background <blend> --python <this> -- <out.glb>

Run through `npm run export-scene` in web/. Adapts the scene in memory for glTF and never saves.
"""
import math
import sys

import bpy

out = sys.argv[sys.argv.index('--') + 1]
scene = bpy.context.scene

# glTF has no area lights. Wide spots keep them one-sided: a point light beside the
# window would also shine backward onto the blinds.
for obj in scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'AREA':
        obj.data.type = 'SPOT'
        obj.data.spot_size = math.radians(150)
        obj.data.spot_blend = 1

# One draw call per group instead of one per object. Blender keeps the separate parts, so they stay
# editable. Each group shares a material and nothing in it moves. Never list anything in
# lib/site_contract.py here; the prefixes it needs, such as Desk_, must survive in the merged name.
MERGE = {
    'Blind_slats': 'Blind_slat', 'Blind_cords': 'Blind_cord',
    'Shelf_brackets': 'Shelf_bracket',
    'Desk_legs': 'Desk_leg', 'Side_table_legs': 'Side_table_leg', 'Window_rails': 'Window_rail', 'Window_sides': 'Window_side',
}
for merged, prefix in MERGE.items():
    parts = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render and o.name.startswith(prefix)]
    if len(parts) < 2:
        print(f'WARNING: {merged}: found {len(parts)} parts named {prefix}*; nothing merged')
        continue
    materials = {slot.material.name for part in parts for slot in part.material_slots}
    if len(materials) != 1:
        raise RuntimeError(f'{merged} spans materials {sorted(materials)}, so merging saves nothing')
    # join only carries custom normals across intact when parts share an orientation and scale.
    poses = {(tuple(round(r, 4) for r in part.rotation_euler), tuple(round(v, 4) for v in part.scale)) for part in parts}
    if len(poses) != 1:
        raise RuntimeError(f'{merged}: parts differ in rotation or scale, which would corrupt their shading')
    # Converting applies modifiers, but it also drops shape keys, so parts that carry keys (the blind slats, already
    # baked in props/window.py) skip it. join keeps keys the parts share by name.
    keyed = any(part.data.shape_keys for part in parts)
    with bpy.context.temp_override(active_object=parts[0], selected_objects=parts, selected_editable_objects=parts):
        if not keyed:
            bpy.ops.object.convert(target='MESH')
        bpy.ops.object.make_single_user(object=True, obdata=True)
        bpy.ops.object.join()
    parts[0].name = merged
    parts[0].data.name = merged

# glTF cannot carry procedural node colors, so these become one flat color.
for mat in bpy.data.materials:
    bsdf = mat.node_tree.nodes.get('Principled BSDF') if mat.node_tree else None
    base = bsdf.inputs['Base Color'] if bsdf else None
    if not base or not base.is_linked:
        continue
    link = base.links[0]
    if link.from_node.type == 'TEX_IMAGE':
        continue
    if link.from_node.type == 'VALTORGB':
        base.default_value = link.from_node.color_ramp.evaluate(0.5)
    mat.node_tree.links.remove(link)
    print(f'WARNING: {mat.name}: procedural color flattened; bake to an image to keep the detail')

# The site draws its screens and grain on its own geometry, so UVs only matter when a material samples an image.
# Without one they were about 20% of the file (docs/DECISIONS.md).
uses_images = any(
    node.type == 'TEX_IMAGE' for mat in bpy.data.materials if mat.node_tree for node in mat.node_tree.nodes
)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_renderable=True,
    export_apply=True,
    export_cameras=True,
    export_lights=True,
    export_import_convert_lighting_mode='COMPAT',
    export_animations=True,
    # The fingers' shape keys move too little to change their shading, and normals would double their size.
    export_morph_normal=False,
    export_texcoords=uses_images,
)
print(f'Exported {bpy.data.filepath} -> {out}')
