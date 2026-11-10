"""Measure a .blend and exit 1 when it breaks a rule. Vision misses floating parts and gaps; numbers do not.

Blender --background --factory-startup <scene.blend> --python-exit-code 1 --python blender/scripts/tools/check_scene.py -- [report.json]

Failures: leftover hidden objects, floating parts, props sunk into each other, sizes out of range,
empty material slots, default names, and names the site depends on going missing.
Warnings: unapplied scale, which also distorts bevels. Rules live in lib/scene_rules.py.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib import scene_rules as rules  # noqa: E402
from lib.site_contract import EXACT_NAMES, MATERIALS, PREFIXES  # noqa: E402

scene = bpy.context.scene
graph = bpy.context.evaluated_depsgraph_get()
live = [o for o in scene.objects if not o.hide_render]
failures, warnings = [], []


def assembly(name):
    for group, prefixes in rules.ASSEMBLIES.items():
        if name.startswith(prefixes):
            return group
    return name


class Solid:
    """An object's evaluated surface in world space."""

    def __init__(self, obj):
        mesh = obj.evaluated_get(graph).to_mesh()
        matrix = obj.matrix_world
        self.name = obj.name
        self.points = [matrix @ v.co for v in mesh.vertices]
        faces = [tuple(p.vertices) for p in mesh.polygons]
        self.edges = [tuple(e.vertices) for e in mesh.edges]
        self.tree = BVHTree.FromPolygons(self.points, faces, epsilon=0.0)
        self.low = Vector(min(p[i] for p in self.points) for i in range(3))
        self.high = Vector(max(p[i] for p in self.points) for i in range(3))
        obj.evaluated_get(graph).to_mesh_clear()

    def near(self, other, gap):
        return all(self.low[i] <= other.high[i] + gap and other.low[i] <= self.high[i] + gap for i in range(3))

    def distance(self, other):
        best = float('inf')
        for a, b in ((self, other), (other, self)):
            for point in a.points:
                hit = b.tree.find_nearest(point)
                if hit[0] is not None:
                    best = min(best, hit[3])
        return 0 if self.tree.overlap(other.tree) else best

    def samples(self):
        """Vertices plus points along each edge. A long cylinder has vertices only near its ends."""
        yield from self.points
        for start, end in self.edges:
            a, b = self.points[start], self.points[end]
            steps = int((b - a).length / rules.DEPTH_SAMPLE_SPACING)
            for step in range(1, steps + 1):
                yield a.lerp(b, step / (steps + 1))

    def depth_in(self, other):
        """How far this object's surface sits inside the other, using the nearest face's facing."""
        deepest = 0
        for point in self.samples():
            location, normal, _, distance = other.tree.find_nearest(point)
            if location is not None and (point - location).dot(normal) < 0:
                deepest = max(deepest, distance)
        return deepest


solids = [Solid(o) for o in live if o.type in ('MESH', 'CURVE') and o.evaluated_get(graph).to_mesh() is not None and len(o.evaluated_get(graph).to_mesh().vertices)]
by_name = {s.name: s for s in solids}
touching = {s.name: set() for s in solids}

overlaps = []
for index, first in enumerate(solids):
    for second in solids[index + 1:]:
        if not first.near(second, rules.CONTACT_GAP):
            continue
        if first.distance(second) <= rules.CONTACT_GAP:
            touching[first.name].add(second.name)
            touching[second.name].add(first.name)
        groups = assembly(first.name), assembly(second.name)
        if groups[0] == groups[1] or not first.tree.overlap(second.tree):
            continue
        depth = max(first.depth_in(second), second.depth_in(first))
        allowed = frozenset(groups) in rules.ALLOWED_OVERLAPS
        if depth > rules.MAX_PENETRATION and not allowed:
            overlaps.append({'a': first.name, 'b': second.name, 'depth_m': round(depth, 4), 'pair': sorted(groups)})
overlaps.sort(key=lambda item: -item['depth_m'])
for item in overlaps:
    known = rules.KNOWN_OVERLAPS.get(frozenset(item['pair']))
    message = f"overlap: {item['a']} and {item['b']} by {item['depth_m'] * 1000:.0f} mm"
    # Known issues are capped at their measured depth, so getting worse still fails.
    if known is not None and item['depth_m'] <= known + .001:
        warnings.append(f'known {message}')
    else:
        failures.append(message)

# Floating: walk contact from the room. A part is held up only if a chain of contact reaches it.
reached = set()
stack = [name for name in touching if name in rules.GROUNDED]
while stack:
    name = stack.pop()
    if name not in reached:
        reached.add(name)
        # What cannot hold things up still connects its own parts, so the whole body stays reached.
        holds = assembly(name) not in rules.NOT_SUPPORT
        stack += [n for n in touching[name] if holds or assembly(n) == assembly(name)]
floating = sorted(n for n in touching if n not in reached and not n.startswith(rules.MAY_FLOAT))
# Report each unsupported cluster once, with the gap to its nearest neighbor, so the fix is obvious.
def holds_together(first, second):
    return not {assembly(first), assembly(second)} & set(rules.NOT_SUPPORT) or assembly(first) == assembly(second)


gaps = []
unassigned = set(floating)
while unassigned:
    cluster, stack = set(), [unassigned.pop()]
    while stack:
        name = stack.pop()
        cluster.add(name)
        joined = {n for n in touching[name] if n in unassigned and holds_together(name, n)}
        stack += joined
        unassigned -= joined
    best = (float('inf'), '', '')
    for name in cluster:
        for other in by_name:
            if other not in cluster and holds_together(name, other) and by_name[name].near(by_name[other], .5):
                best = min(best, (by_name[name].distance(by_name[other]), name, other))
    gaps.append({'parts': sorted(cluster), 'nearest': best[1] or sorted(cluster)[0], 'to': best[2], 'gap_m': round(best[0], 4)})
gaps.sort(key=lambda gap: gap['nearest'])
for gap in gaps:
    message = f"floating: {len(gap['parts'])} parts around {gap['nearest']}, {gap['gap_m'] * 1000:.0f} mm from {gap['to']}"
    known = rules.KNOWN_FLOATING.get(gap['nearest'])
    if known is not None and gap['gap_m'] <= known + .001:
        warnings.append(f'known {message}')
    else:
        failures.append(message)

for obj in scene.objects:
    if obj.hide_render:
        failures.append(f'leftover hidden object: {obj.name}')
for obj in live:
    data_name = obj.data.name if obj.data else ''
    if obj.name.split('.')[0] in rules.DEFAULT_NAMES or data_name.split('.')[0] in rules.DEFAULT_NAMES:
        failures.append(f'default name: {obj.name} (data {data_name})')
    if obj.type in ('MESH', 'CURVE') and (not obj.material_slots or any(s.material is None for s in obj.material_slots)):
        failures.append(f'empty material slot: {obj.name}')
    if obj.type == 'MESH' and any(abs(s - 1) > 1e-4 for s in obj.scale) and obj.modifiers:
        warnings.append(f'unapplied scale under modifiers: {obj.name} {tuple(round(s, 3) for s in obj.scale)}')

for name, ranges in rules.SIZES.items():
    solid = by_name.get(name)
    if not solid:
        failures.append(f'size check target missing: {name}')
        continue
    size = solid.high - solid.low
    for axis, (low, high) in zip('xyz', ranges):
        value = size['xyz'.index(axis)]
        if not low <= value <= high:
            failures.append(f'size: {name} {axis} is {value:.3f} m, expected {low} to {high}')

names = {o.name for o in live}
failures += [f'site needs object: {n}' for n in EXACT_NAMES if n not in names]
for prefix, count in PREFIXES.items():
    found = sum(n.startswith(prefix) for n in names)
    if found < count:
        failures.append(f'site needs {count} objects named {prefix}*, found {found}')
used = {s.material.name for o in live if o.type in ('MESH', 'CURVE') for s in o.material_slots if s.material}
failures += [f'site needs material: {m}' for m in MATERIALS if m not in used]

report = {'file': Path(bpy.data.filepath).name, 'objects': len(scene.objects), 'solids': len(solids),
          'failures': failures, 'warnings': warnings, 'overlaps': overlaps, 'floating': gaps}
if '--' in sys.argv and sys.argv.index('--') + 1 < len(sys.argv):
    Path(sys.argv[sys.argv.index('--') + 1]).write_text(json.dumps(report, indent=2))
print(f"CHECK {report['file']}: {len(failures)} failures, {len(warnings)} warnings, {len(solids)} solids")
hidden = sum(f.startswith('leftover') for f in failures)
for line in [f for f in failures if not f.startswith('leftover')]:
    print('FAIL', line)
for line in [w for w in warnings if w.startswith('known')]:
    print('KNOWN', line[6:])
if hidden:
    print(f'FAIL leftover hidden objects: {hidden}')
sys.exit(1 if failures else 0)
