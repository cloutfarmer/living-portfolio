"""Shared Blender builders. Every prop goes through these, so bevels and naming stay consistent.

Sizes are metres. `scale` stays separate from `size` where it was authored that way, because the
bevel modifier runs before object scale and baking it in would change the bevel's look.
"""
import json
from math import cos, pi, sin
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

DATA = Path(__file__).resolve().parent.parent / 'props' / 'data'
# Licensed downloads. Each needs a row in assets/ASSET_MANIFEST.csv.
SOURCE = Path(__file__).resolve().parents[3] / 'assets' / 'source' / 'polypizza'
COLLECTIONS = ('Room', 'Furniture', 'Clutter', 'Lighting', 'Character')


def reset_scene(name):
    """Empty the file and create one scene with the standard collections."""
    for block in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.lights, bpy.data.cameras,
                  bpy.data.materials, bpy.data.collections, bpy.data.worlds):
        for item in list(block):
            block.remove(item)
    scene = bpy.context.scene
    scene.name = name
    for collection in COLLECTIONS:
        scene.collection.children.link(bpy.data.collections.new(collection))
    return scene


def _place(obj, group, loc, rot, scale):
    bpy.data.collections[group].objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = scale
    return obj


def _finish_mesh(name, bm, group, mat, loc, rot, scale, bevel, segments, weighted, smooth):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
    obj = _place(bpy.data.objects.new(name, mesh), group, loc, rot, scale)
    if mat:
        mesh.materials.append(bpy.data.materials[mat])
    if bevel:
        modifier = obj.modifiers.new('Soft_edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = segments
    if weighted:
        obj.modifiers.new('Weighted_normals', 'WEIGHTED_NORMAL')
    return obj


def _new_bmesh():
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    return bm


def box(name, loc, size, mat, group='Clutter', rot=(0, 0, 0), scale=(1, 1, 1), center=(0, 0, 0),
        bevel=0.0, segments=3, weighted=True, smooth=False):
    """A cuboid `size` across, with its middle at `center` relative to the object's origin."""
    bm = _new_bmesh()
    matrix = Matrix.Translation(center) @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1, matrix=matrix, calc_uvs=True)
    return _finish_mesh(name, bm, group, mat, loc, rot, scale, bevel, segments, weighted, smooth)


def cylinder(name, loc, radius, depth, mat, group='Clutter', rot=(0, 0, 0), scale=(1, 1, 1), center=(0, 0, 0),
             radius_top=None, vertices=24, bevel=0.0, segments=3, weighted=True, smooth=False, cap_tris=False):
    """A capped cylinder, or a cone section when `radius_top` differs from `radius`."""
    bm = _new_bmesh()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=cap_tris, segments=vertices, radius1=radius,
                          radius2=radius if radius_top is None else radius_top, depth=depth,
                          matrix=Matrix.Translation(center), calc_uvs=True)
    return _finish_mesh(name, bm, group, mat, loc, rot, scale, bevel, segments, weighted, smooth)


def lathe(name, loc, profile, mat, group='Clutter', rot=(0, 0, 0), vertices=24, bevel=0.0, segments=3, weighted=True, smooth=False):
    """A closed solid spun around z. `profile` is (radius, height from the origin) pairs, walked along its surface."""
    bm = _new_bmesh()
    rings = [[bm.verts.new((radius * cos(2 * pi * step / vertices), radius * sin(2 * pi * step / vertices), height))
              for step in range(vertices)] for radius, height in profile]
    for lower, upper in zip(rings, rings[1:]):
        for step in range(vertices):
            after = (step + 1) % vertices
            bm.faces.new((lower[step], lower[after], upper[after], upper[step]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish_mesh(name, bm, group, mat, loc, rot, (1, 1, 1), bevel, segments, weighted, smooth)


def ball(name, loc, mat, group='Character', radius=1.0, rot=(0, 0, 0), scale=(1, 1, 1), center=(0, 0, 0),
         segments_u=20, rings=12, bevel=0.0, segments=3, weighted=False, smooth=True):
    """A UV sphere. Stylized body parts are unit spheres shaped by `scale`."""
    bm = _new_bmesh()
    bmesh.ops.create_uvsphere(bm, u_segments=segments_u, v_segments=rings, radius=radius,
                              matrix=Matrix.Translation(center), calc_uvs=True)
    return _finish_mesh(name, bm, group, mat, loc, rot, scale, bevel, segments, weighted, smooth)


def icosphere(name, loc, radius, mat, group='Clutter', rot=(0, 0, 0), subdivisions=3):
    """A smooth sphere of even triangles, for when faces need coloring without pole pinching."""
    bm = _new_bmesh()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius, calc_uvs=True)
    return _finish_mesh(name, bm, group, mat, loc, rot, (1, 1, 1), 0.0, 3, False, True)


def imported(name, path, height, loc, group='Clutter', rot=(0, 0, 0), materials=None, settle=()):
    """A licensed GLB as one mesh: `height` tall, its base's middle at `loc`, using shared materials.

    `materials` maps each of the file's material names to a shared one. All of them must be listed.
    `settle` names parts the file leaves hovering, which get lowered to the model's base.
    """
    before = set(bpy.data.objects)
    known = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in new if obj.type == 'MESH']
    for obj in meshes:
        obj.data.transform(obj.matrix_world)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
    base = min(vertex.co.z for obj in meshes for vertex in obj.data.vertices)
    for obj in meshes:
        if obj.name in settle:
            obj.data.transform(Matrix.Translation((0, 0, base - min(vertex.co.z for vertex in obj.data.vertices))))
    for obj in new:
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    joined = meshes[0]
    if len(meshes) > 1:
        with bpy.context.temp_override(active_object=joined, selected_objects=meshes, selected_editable_objects=meshes):
            bpy.ops.object.join()
    mesh = joined.data
    points = [vertex.co for vertex in mesh.vertices]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    size = height / (high.z - low.z)
    mesh.transform(Matrix.Diagonal((size, size, size, 1)) @ Matrix.Translation((-(low.x + high.x) / 2, -(low.y + high.y) / 2, -low.z)))
    mesh.update()
    # Source colours that map to one shared material become one slot, or each would stay its own draw call.
    slots = [materials[material.name] for material in mesh.materials]
    shared = list(dict.fromkeys(slots))
    faces = [shared.index(slots[polygon.material_index]) for polygon in mesh.polygons]
    # Clearing the slots also resets every face's slot, so assign them afterward.
    mesh.materials.clear()
    for material in shared:
        mesh.materials.append(bpy.data.materials[material])
    for polygon, slot in zip(mesh.polygons, faces):
        polygon.material_index = slot
    for material in set(bpy.data.materials) - known:
        bpy.data.materials.remove(material)
    joined.name = name
    mesh.name = name
    # The importer leaves quaternion mode on, which would silently ignore `rot`.
    joined.rotation_mode = 'XYZ'
    for collection in list(joined.users_collection):
        collection.objects.unlink(joined)
    return _place(joined, group, loc, rot, (1, 1, 1))


def split_by_faces(source, parts, group='Clutter', sharp_angle=0.7):
    """New objects from a mesh's faces. `parts` maps a name to (test of a face's index, material)."""
    made = []
    for name, (keep, material) in parts.items():
        bm = bmesh.new()
        bm.from_mesh(source.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[face for face in bm.faces if not keep(face.index)], context='FACES')
        data = bpy.data.meshes.new(name)
        bm.to_mesh(data)
        bm.free()
        data.materials.clear()
        data.materials.append(bpy.data.materials[material])
        for polygon in data.polygons:
            polygon.material_index = 0
        data.shade_smooth()
        data.set_sharp_from_angle(angle=sharp_angle)
        made.append(_place(bpy.data.objects.new(name, data), group, source.location, source.rotation_euler, (1, 1, 1)))
    return made


def flat_text(name, text, loc, rot, width, mat, group='Clutter'):
    """Text as a flat mesh `width` across, centred on `loc`, facing its local +z. Uses no images."""
    data = bpy.data.curves.new(name, 'FONT')
    data.body = text
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    data.offset = 0.015
    data.resolution_u = 3
    holder = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(holder)
    bpy.context.view_layer.update()
    mesh = bpy.data.meshes.new_from_object(holder.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(holder, do_unlink=True)
    bpy.data.curves.remove(data)
    points = [vertex.co for vertex in mesh.vertices]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    size = width / (high.x - low.x)
    mesh.transform(Matrix.Diagonal((size, size, size, 1)) @ Matrix.Translation(-(low + high) / 2))
    mesh.update()
    mesh.name = name
    mesh.materials.clear()
    mesh.materials.append(bpy.data.materials[mat])
    return _place(bpy.data.objects.new(name, mesh), group, loc, rot, (1, 1, 1))


def frozen(name, loc, group='Clutter', rot=(0, 0, 0), scale=(1, 1, 1), bevel=0.0, segments=3, weighted=False):
    """A mesh that code cannot regenerate exactly, such as settled cloth, read from data/<name>.json."""
    record = json.loads((DATA / f'{name}.json').read_text())
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(record['vertices'], [], record['faces'])
    if record.get('uv'):
        uv = mesh.uv_layers.new(name='UVMap')
        for loop, value in zip(uv.data, record['uv']):
            loop.uv = value
    for material in record['materials']:
        mesh.materials.append(bpy.data.materials[material])
    for polygon, index, smooth in zip(mesh.polygons, record['material_index'], record['smooth']):
        polygon.material_index = index
        polygon.use_smooth = bool(smooth)
    mesh.update()
    obj = _place(bpy.data.objects.new(name, mesh), group, loc, rot, scale)
    if bevel:
        modifier = obj.modifiers.new('Soft_edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = segments
    if weighted:
        obj.modifiers.new('Weighted_normals', 'WEIGHTED_NORMAL')
    return obj


def thicken_cloth(obj, levels=1, render_levels=2, thickness=.006):
    """Turn a single-sided cloth sheet into smooth fabric with some thickness."""
    smooth = obj.modifiers.new('Cloth_smooth', 'SUBSURF')
    smooth.levels = levels
    smooth.render_levels = render_levels
    solid = obj.modifiers.new('Cloth_thickness', 'SOLIDIFY')
    solid.thickness = thickness
    solid.offset = -1
    return obj


def curve(name, spline, mat, depth, group='Clutter', loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1),
          bevel_resolution=2, resolution=12, caps=False):
    """A tube along one Bezier spline. Each point is (position, left handle, right handle)."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = depth
    data.bevel_resolution = bevel_resolution
    data.resolution_u = resolution
    data.use_fill_caps = caps
    path = data.splines.new('BEZIER')
    path.bezier_points.add(len(spline) - 1)
    path.resolution_u = resolution
    for point, (co, left, right) in zip(path.bezier_points, spline):
        point.co, point.handle_left, point.handle_right = co, left, right
    data.materials.append(bpy.data.materials[mat])
    return _place(bpy.data.objects.new(name, data), group, loc, rot, scale)


def light(name, kind, energy, color, loc, rot=(0, 0, 0), group='Lighting', radius=None, size=None, size_y=None,
          shape=None):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if radius is not None:
        data.shadow_soft_size = radius
    if kind == 'AREA':
        data.shape = shape
        data.size = size
        if size_y is not None:
            data.size_y = size_y
    return _place(bpy.data.objects.new(name, data), group, loc, rot, (1, 1, 1))


def camera(name, ortho_scale, loc, rot, group='Lighting'):
    data = bpy.data.cameras.new(name)
    data.type = 'ORTHO'
    data.ortho_scale = ortho_scale
    return _place(bpy.data.objects.new(name, data), group, loc, rot, (1, 1, 1))


def keyframes(owner, data_path, frames, index=0):
    """Key one channel with a value per frame. `frames` is [[frame, value], ...]."""
    for frame, value in frames:
        target = getattr(owner, data_path)
        if hasattr(target, '__len__'):
            target[index] = value
        else:
            setattr(owner, data_path, value)
        owner.keyframe_insert(data_path, index=index if hasattr(target, '__len__') else -1, frame=frame)


__all__ = ['ball', 'box', 'camera', 'curve', 'cylinder', 'frozen', 'keyframes', 'light', 'reset_scene', 'thicken_cloth']
