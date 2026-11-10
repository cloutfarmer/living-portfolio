"""The seated person: a rigged model posed at the desk, then frozen to plain meshes.

The site gets no skeleton or animation data. web/src/Life.tsx moves `Body`, `Head`, `Hair`, and `Hand` by name, and
lifts each finger with a shape key on `Hand`.
"""
from math import atan2, pi, sqrt

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

from lib.builders import SOURCE, _place
from props.input_devices import key_top

CENTER_X = -0.26
# The model is 1.86 tall. The rest of the room is sized to this: see SCALE in lib/layout.py.
SCALE = 1.1
# Where the hip joints' midpoint goes: on the seat, whose top is 0.514, with thighs level. Unlike the props, this file isn't
# scaled, so these are final positions, before the shift along x.
HIPS = Vector((CENTER_X, -0.03, 0.63))
# Forward lean at each spine joint, in radians: a slight hunch, then the neck and head come back up.
SPINE_LEAN = {'Abdomen': 0.06, 'Torso': 0.06, 'Chest': 0.05, 'Neck': -0.04, 'Head': -0.03}
# Desktop top 0.934 from y 0.273. See the keyboard in props/input_devices.py. The left side; the right mirrors it.
WRIST = Vector((-0.36, 0.315, 1.03))
HAND_POINTS = Vector((0.2, 1, -0.1))
ELBOW_POINTS = Vector((-0.5, -0.6, -1))
# The file's hands are about 1.2 times the person's proportions, and would span far too many keys.
HAND_SIZE = 0.85
# The left hand's resting keys, by finger. The right mirrors them: F and J sit evenly around the person's centre line.
HOME_KEYS = {'Index': 'F', 'Middle': 'D', 'Ring': 'S', 'Pinky': 'A', 'Thumb': 'Space_left'}
# Where a fingertip's end vertex aims above its key, since the finger's underside is lower than its end.
TIP_ABOVE = 0.005
# How far each knuckle may bend, in radians. Curling only, or the solver bends fingers backward.
MOST_CURL = 0.85
# Each finger's lift for the site's typing, in radians at the knuckle: about 8 mm at the tip.
LIFT = 0.1
THIGH_POINTS = Vector((-0.03, 1, 0))
SHIN_POINTS = Vector((0, -0.02, -1))
FOOT_TILT = 0
# How far above the Foot bone the shin's mesh ends, in the model's units.
ANKLE = 0.10

COLOURS = {'White': 'Character_Shoe', 'Purple': 'Character_Hoodie', 'Skin': 'Character_Skin', 'LightBlue': 'Character_Shorts',
           'Eyebrows': 'Character_Hair', 'Eye': 'Character_Hair', 'Hair': 'Character_Hair'}
# web/src/Life.tsx drives these shape keys, in this order.
FINGERS = ('Index', 'Middle', 'Ring', 'Pinky')
UP = Vector((0, 0, 1))


class Pose:
    """Moves bones by world-space rotations and positions, so targets read in the room's coordinates."""

    def __init__(self, armature):
        self.armature = armature
        self.inverse = armature.matrix_world.inverted()
        bpy.context.view_layer.update()
        self.rest = {bone.name: armature.matrix_world @ bone.matrix for bone in armature.pose.bones}
        self.tips = {}

    def head(self, name):
        return self.armature.matrix_world @ self.armature.pose.bones[name].head

    def rest_head(self, name):
        return self.rest[name].to_translation()

    def length(self, start, end):
        return (self.rest_head(end) - self.rest_head(start)).length

    def _set(self, name, world):
        self.armature.pose.bones[name].matrix = self.inverse @ world
        bpy.context.view_layer.update()

    def turn(self, name, axis, angle):
        """Rotates a bone in place, and its children with it."""
        bone = self.armature.pose.bones[name]
        pivot = self.head(name)
        spin = Matrix.Translation(pivot) @ Quaternion(axis.normalized(), angle).to_matrix().to_4x4() @ Matrix.Translation(-pivot)
        self._set(name, spin @ self.armature.matrix_world @ bone.matrix)

    def frame(self, name, start, end, forward, up=UP):
        """Points the bone's rest span from `start` to `end` along `forward`, with its rest up as close to `up` as it goes.

        Setting both axes rather than the shortest turn stops sleeves twisting between joints.
        """
        before = _basis(self.rest_head(end) - self.rest_head(start), UP)
        spin = (_basis(forward, up) @ before.inverted()).to_4x4()
        rest = self.rest[name]
        here = self.head(name)
        self._set(name, Matrix.Translation(here) @ spin @ Matrix.Translation(-self.rest_head(name)) @ rest)

    def learn_tip(self, name, body):
        """Records the vertex at the end of a finger's last bone, because the bone itself stops short of the fingertip."""
        group = body.vertex_groups[name].index
        points = [body.matrix_world @ vertex.co for vertex in body.data.vertices if group in {item.group for item in vertex.groups}]
        start = self.rest_head(name)
        end = self.rest[name].to_quaternion() @ Vector((0, 1, 0))
        self.tips[name] = self.rest[name].inverted() @ max(points, key=lambda point: (point - start).dot(end))

    def tip(self, name):
        return self.armature.matrix_world @ self.armature.pose.bones[name].matrix @ self.tips[name]

    def size(self, name, factor):
        """Scales a bone about its head, and its children with it."""
        pivot = self.head(name)
        grow = Matrix.Translation(pivot) @ Matrix.Scale(factor, 4) @ Matrix.Translation(-pivot)
        self._set(name, grow @ self.armature.matrix_world @ self.armature.pose.bones[name].matrix)

    def place(self, name, pivot_rest, pivot_new, spin):
        """Moves a bone with no posed parent, so `pivot_rest` lands on `pivot_new` after turning by `spin`."""
        self._set(name, Matrix.Translation(pivot_new) @ spin.to_4x4() @ Matrix.Translation(-pivot_rest) @ self.rest[name])


def _basis(forward, up):
    forward = forward.normalized()
    side = forward.cross(up).normalized()
    return Matrix((side, forward, side.cross(forward))).transposed()


def _elbow(shoulder, wrist, upper, lower, points):
    """Two-bone reach: where the elbow sits for a shoulder and wrist, pushed toward `points`."""
    span = wrist - shoulder
    reach = min(span.length, upper + lower - 0.001)
    along = (upper ** 2 - lower ** 2 + reach ** 2) / (2 * reach)
    aim = span.normalized()
    return shoulder + aim * along + (points - aim * points.dot(aim)).normalized() * sqrt(max(upper ** 2 - along ** 2, 0))


def _angle_about(axis, have, want):
    """The turn about `axis` that swings `have` toward `want`."""
    have = have - axis * have.dot(axis)
    want = want - axis * want.dot(axis)
    return atan2(axis.dot(have.cross(want)), have.dot(want))


def _fit_finger(pose, finger, side, target, across):
    """Fans the finger toward its key, then curls its joints, in turn, until the tip lands there."""
    tip = f'{finger}4.{side}'
    first = f'{finger}1.{side}'
    pose.turn(first, UP, _angle_about(UP, pose.tip(tip) - pose.head(first), target - pose.head(first)))
    curled = {joint: 0 for joint in (2, 3, 4)}
    for _ in range(16):
        for joint in (4, 3, 2):
            name = f'{finger}{joint}.{side}'
            pivot = pose.head(name)
            turn = _angle_about(across, pose.tip(tip) - pivot, target - pivot)
            turn = max(-curled[joint], min(MOST_CURL - curled[joint], turn))
            pose.turn(name, across, turn)
            curled[joint] += turn
    # Curling draws the tip in, so fan once more to land it.
    pose.turn(first, UP, _angle_about(UP, pose.tip(tip) - pose.head(first), target - pose.head(first)))


def _fit_thumb(pose, side, target):
    """Thumbs bend across the palm, so these joints can turn about any axis."""
    tip = f'Thumb3.{side}'
    for _ in range(8):
        for joint in (2, 1):
            name = f'Thumb{joint}.{side}'
            pivot = pose.head(name)
            have, want = pose.tip(tip) - pivot, target - pivot
            pose.turn(name, have.cross(want), have.angle(want))


def _pose_side(pose, side, mirror):
    flip = (lambda v: Vector((2 * CENTER_X - v.x, v.y, v.z))) if mirror else (lambda v: v.copy())
    away = (lambda v: Vector((-v.x, v.y, v.z))) if mirror else (lambda v: v.copy())
    upper, lower, wrist, knee = f'UpperArm.{side}', f'LowerArm.{side}', f'Wrist.{side}', f'LowerLeg.{side}'

    shoulder = pose.head(upper)
    wrist_at = flip(WRIST)
    elbow = _elbow(shoulder, wrist_at, pose.length(upper, lower), pose.length(lower, wrist), away(ELBOW_POINTS))
    pose.frame(upper, upper, lower, elbow - shoulder)
    pose.frame(lower, lower, wrist, wrist_at - elbow)
    forward = away(HAND_POINTS)
    pose.frame(wrist, wrist, f'Middle1.{side}', forward)
    pose.size(wrist, HAND_SIZE)
    across = UP.cross(forward).normalized()
    # Mirrored hands curl the same way about a mirrored axis, whose sign already follows `forward`.
    for finger in FINGERS:
        _fit_finger(pose, finger, side, flip(Vector(key_top(HOME_KEYS[finger]))) + UP * TIP_ABOVE, across)
    _fit_thumb(pose, side, flip(Vector(key_top(HOME_KEYS['Thumb']))) + UP * TIP_ABOVE)

    hip = pose.head(f'UpperLeg.{side}')
    thigh = pose.length(f'UpperLeg.{side}', knee)
    pose.frame(f'UpperLeg.{side}', f'UpperLeg.{side}', knee, away(THIGH_POINTS), Vector((0, 1, 0)))
    knee_at = hip + away(THIGH_POINTS).normalized() * thigh
    foot = f'Foot.{side}'
    ankle_rest = pose.rest_head(foot) + UP * ANKLE * SCALE
    shin = (pose.rest_head(knee) - ankle_rest).length
    pose.frame(knee, knee, foot, SHIN_POINTS, Vector((0, 1, 0)))
    pose.place(foot, ankle_rest, knee_at + SHIN_POINTS.normalized() * shin, Quaternion((1, 0, 0), -FOOT_TILT).to_matrix())


def _posed(armature):
    pose = Pose(armature)
    for side in 'LR':
        for name in (*(f'{finger}4.{side}' for finger in FINGERS), f'Thumb3.{side}'):
            pose.learn_tip(name, bpy.data.objects['Casual_Body'])
    for name, lean in SPINE_LEAN.items():
        pose.turn(name, Vector((1, 0, 0)), -lean)
    _pose_side(pose, 'L', False)
    _pose_side(pose, 'R', True)
    return pose


def _freeze(obj):
    """The posed mesh in world space, with no rig attached."""
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = bpy.data.meshes.new_from_object(evaluated)
    mesh.transform(obj.matrix_world)
    return mesh


def _lifted(armature, pose, side, across, body):
    """The body's mesh with each of this side's fingers raised at the knuckle, by finger."""
    lifted = {}
    for finger in FINGERS:
        name = f'{finger}2.{side}'
        bone = armature.pose.bones[name]
        kept = bone.matrix.copy()
        pose.turn(name, across, -LIFT)
        lifted[finger] = _freeze(body)
        bone.matrix = kept
        bpy.context.view_layer.update()
    return lifted


def _source_name(material):
    """The importer adds .001 when the room already has that name, as it does for Skin."""
    return material.name.split('.')[0]


def _slot(mesh, name):
    return next(index for index, material in enumerate(mesh.materials) if _source_name(material) == name)


def _cut(name, mesh, keep, origin, cap):
    """A copy of the mesh with only the faces `keep` accepts, around `origin`. The same faces give the same vertex order."""
    part = mesh.copy()
    part.name = name
    bm = bmesh.new()
    bm.from_mesh(part)
    bm.faces.ensure_lookup_table()
    drop = [bm.faces[polygon.index] for polygon in part.polygons if not keep(polygon)]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    if cap:
        # A hand cut from its sleeve is an open tube, which the scene checks read as bogus depths.
        bmesh.ops.holes_fill(bm, edges=bm.edges, sides=0)
    bm.to_mesh(part)
    bm.free()
    part.transform(Matrix.Translation(-origin))
    return part


def _part(name, mesh, keep, origin, cap=False, shapes=None):
    """A new object from the faces `keep` accepts, using shared materials, with `origin` as the pivot for the site's motion.

    `shapes` maps a shape key's name to the same mesh in another pose.
    """
    part = _cut(name, mesh, keep, origin, cap)
    # Source colours that map to one material become one slot, and unused slots go, or each would stay a draw call.
    mapped = [COLOURS[_source_name(material)] for material in part.materials]
    used = list(dict.fromkeys(mapped[polygon.material_index] for polygon in part.polygons))
    faces = [used.index(mapped[polygon.material_index]) for polygon in part.polygons]
    part.materials.clear()
    for material in used:
        part.materials.append(bpy.data.materials[material])
    for polygon, slot in zip(part.polygons, faces):
        polygon.material_index = slot
    part.update()
    obj = _place(bpy.data.objects.new(name, part), 'Character', origin, (0, 0, 0), (1, 1, 1))
    if shapes:
        obj.shape_key_add(name='Basis', from_mix=False)
        for shape, posed in shapes.items():
            moved = _cut(f'{name}_{shape}', posed, keep, origin, cap)
            key = obj.shape_key_add(name=shape, from_mix=False)
            key.value = 0
            for point, vertex in zip(key.data, moved.vertices, strict=True):
                point.co = vertex.co
            bpy.data.meshes.remove(moved)
    return obj


# Shoes off: the trainers are kicked off by the bag. The model's shoes become socks, slimmed toward each foot's middle so the
# sneaker's bulk goes. The slimming fades out up the foot, so the cuff keeps its width and still wraps the shin.
# Soles go grey, as socks do.
SOCK_SLIM = 0.88
# Shares of each foot's height: fully slimmed below the first, full width above the second.
SOCK_FADE = (0.25, 0.7)
# The shoe's collar has a tongue and heel tab that pinch around the shin, so above this share of the foot's height it's pulled
# into a round cuff, a little wider than the shin so the leg sits inside it. The pull fades out with distance from the ankle,
# over this many shin radii past the cuff, so the instep and toe keep their shape.
CUFF_FROM = 0.32
CUFF_ROOM = 1.12
CUFF_REACH = 4
# How far from the shin's middle, in shin radii, the collar's rim can be.
CUFF_RIM = 1.6
SOCK_SOLE_FACING = -0.5
# How far up from the floor the sole's grey reaches.
SOCK_SOLE_HEIGHT = 0.02


def _shin(legs, side):
    """The middle and radius of a shin's bottom ring, which ends inside the sock, from the leg mesh's vertices on that side."""
    points = [vertex.co for vertex in legs.data.vertices if side(vertex.co.x)]
    bottom = min(point.z for point in points)
    ring = [point for point in points if point.z <= bottom + 0.01]
    middle = sum((point.xy for point in ring), Vector((0, 0))) / len(ring)
    return middle, sum((point.xy - middle).length for point in ring) / len(ring)


def _socked(feet, legs):
    """Turns the shoes into socks: slimmer, with a round cuff, off-white, with grey soles."""
    mesh = feet.data
    middle = sum((vertex.co.x for vertex in mesh.vertices), 0.0) / len(mesh.vertices)
    # Vertices on the mesh's open edges: an edge with one face is part of the collar's rim.
    faces_per_edge = {}
    for polygon in mesh.polygons:
        for key in polygon.edge_keys:
            faces_per_edge[key] = faces_per_edge.get(key, 0) + 1
    edge_uses = {}
    for (a, b), uses in faces_per_edge.items():
        if uses == 1:
            edge_uses[a] = edge_uses[b] = 1
    for side in (lambda x: x < middle, lambda x: x >= middle):
        foot = [vertex for vertex in mesh.vertices if side(vertex.co.x)]
        cx = sum(vertex.co.x for vertex in foot) / len(foot)
        cy = sum(vertex.co.y for vertex in foot) / len(foot)
        low = min(vertex.co.z for vertex in foot)
        high = max(vertex.co.z for vertex in foot)
        for vertex in foot:
            up = min(1, max(0, ((vertex.co.z - low) / (high - low) - SOCK_FADE[0]) / (SOCK_FADE[1] - SOCK_FADE[0])))
            slim = SOCK_SLIM + (1 - SOCK_SLIM) * up * up * (3 - 2 * up)
            vertex.co.x = cx + (vertex.co.x - cx) * slim
            vertex.co.y = cy + (vertex.co.y - cy) * slim
        axis, radius = _shin(legs, side)
        # The sneaker's collar dips at the front, which shows the sock's inside as a dark notch. Level the open rim around the
        # ankle; other open edges, further out, belong to the shoe's other pieces and stay put.
        for vertex in foot:
            if vertex.index in edge_uses and vertex.co.z > (low + high) / 2 and (vertex.co.xy - axis).length < radius * CUFF_RIM:
                vertex.co.z = high
        for vertex in foot:
            up = ((vertex.co.z - low) / (high - low) - CUFF_FROM) / (1 - CUFF_FROM)
            if up <= 0:
                continue
            blend = min(1, up) ** 2 * (3 - 2 * min(1, up))
            offset = vertex.co.xy - axis
            if offset.length < 1e-6:
                continue
            near = 1 - (offset.length - radius * CUFF_ROOM) / (radius * CUFF_REACH)
            blend *= min(1, max(0, near))
            reach = offset.length + (radius * CUFF_ROOM - offset.length) * blend
            vertex.co.xy = axis + offset.normalized() * reach
    mesh.update()
    # The source's stored normals still point the way the shoe's faces did, which shades the reshaped ankle as creases.
    # Drop them and shade flat, like the room's other low-poly props.
    with bpy.context.temp_override(object=feet, active_object=feet, selected_objects=[feet], selected_editable_objects=[feet]):
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    mesh.shade_flat()
    mesh.materials.clear()
    mesh.materials.append(bpy.data.materials['Character_Sock'])
    mesh.materials.append(bpy.data.materials['Character_Sock_sole'])
    # Only the bottom is the sole: downward faces higher up are folds at the ankle, which would show as dark patches.
    floor = min(vertex.co.z for vertex in mesh.vertices)
    for polygon in mesh.polygons:
        polygon.material_index = 1 if polygon.normal.z < SOCK_SOLE_FACING and polygon.center.z < floor + SOCK_SOLE_HEIGHT else 0
    mesh.update()


def build():
    known = {block: set(block) for block in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.actions, bpy.data.armatures)}
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'hoodie-character.glb'))
    armature = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    armature.animation_data_clear()
    for bone in armature.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()

    # Stand it up in the room, facing the monitors, with its hip joints on HIPS.
    rig = armature.matrix_world.copy()
    bones = armature.data.bones
    hips = rig @ ((bones['UpperLeg.L'].head_local + bones['UpperLeg.R'].head_local) / 2)
    armature.matrix_world = (Matrix.Translation(HIPS) @ Matrix.Rotation(pi, 4, 'Z') @ Matrix.Scale(SCALE, 4)
                             @ Matrix.Translation(-hips) @ rig)
    bpy.context.view_layer.update()
    pose = _posed(armature)
    neck = pose.head('Neck')
    pelvis = pose.head('Hips')
    body, head, legs, feet = (_freeze(bpy.data.objects[name]) for name in ('Casual_Body', 'Casual_Head', 'Casual_Legs', 'Casual_Feet'))
    across = UP.cross(HAND_POINTS).normalized()
    source_body = bpy.data.objects['Casual_Body']
    lifted_left = _lifted(armature, pose, 'L', across, source_body)
    mirrored = Vector((-HAND_POINTS.x, HAND_POINTS.y, HAND_POINTS.z))
    lifted_right = _lifted(armature, pose, 'R', UP.cross(mirrored).normalized(), source_body)

    skin = _slot(body, 'Skin')
    hair = _slot(head, 'Hair')
    _part('Body', body, lambda face: face.material_index != skin, pelvis)
    _part('Hand', body, lambda face: face.material_index == skin and face.center.x < CENTER_X, WRIST, cap=True, shapes=lifted_left)
    _part('Hand.001', body, lambda face: face.material_index == skin and face.center.x >= CENTER_X,
          Vector((2 * CENTER_X - WRIST.x, WRIST.y, WRIST.z)), cap=True, shapes=lifted_right)
    _part('Head', head, lambda face: face.material_index != hair, neck)
    _part('Hair', head, lambda face: face.material_index == hair, neck)
    _part('Character_legs', legs, lambda face: True, HIPS)
    _socked(_part('Character_feet', feet, lambda face: True, HIPS), bpy.data.objects['Character_legs'])

    # Everything else the file brought goes: rig, animations, unposed meshes, and the source's materials.
    made = {'Body', 'Hand', 'Hand.001', 'Head', 'Hair', 'Character_legs', 'Character_feet'}
    for obj in [obj for obj in bpy.data.objects if obj not in known[bpy.data.objects] and obj.name not in made]:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in (body, head, legs, feet, *lifted_left.values(), *lifted_right.values()):
        bpy.data.meshes.remove(mesh)
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
        for item in [item for item in block if item not in known[block] and not item.users]:
            block.remove(item)
