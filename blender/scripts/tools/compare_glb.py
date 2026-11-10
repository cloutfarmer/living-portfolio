"""Compare two exported GLBs node by node; exit 1 on any difference. Written to prove a rebuild changed nothing.

python3 blender/scripts/tools/compare_glb.py <baseline.glb> <candidate.glb> [--tolerance-mm 1]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.glb import Glb, transform  # noqa: E402

args = sys.argv[1:]
tolerance = .001
if '--tolerance-mm' in args:
    at = args.index('--tolerance-mm')
    tolerance = float(args[at + 1]) / 1000
    del args[at:at + 2]
base_path, other_path = args


def summarize(glb):
    """Everything a viewer can see about each node, in world space."""
    data = glb.json
    matrices = glb.world_matrices()
    lights = data.get('extensions', {}).get('KHR_lights_punctual', {}).get('lights', [])
    result = {}
    for index, node in enumerate(data['nodes']):
        entry = {'kind': 'empty', 'origin': transform(matrices.get(index, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), (0, 0, 0))}
        if 'mesh' in node:
            points, materials, triangles = [], [], 0
            mesh = data['meshes'][node['mesh']]
            normals = []
            for primitive in mesh['primitives']:
                points += [transform(matrices[index], p) for p in glb.accessor(primitive['attributes']['POSITION'])]
                material = data['materials'][primitive['material']] if 'material' in primitive else {}
                pbr = material.get('pbrMetallicRoughness', {})
                materials.append((material.get('name'), tuple(round(v, 4) for v in pbr.get('baseColorFactor', (1, 1, 1, 1))),
                                  round(pbr.get('roughnessFactor', 1), 4), round(pbr.get('metallicFactor', 1), 4),
                                  tuple(round(v, 4) for v in material.get('emissiveFactor', (0, 0, 0))),
                                  round(material.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 1), 4)))
                normals += glb.accessor(primitive['attributes']['NORMAL'])
            entry = {'kind': 'mesh', 'triangles': glb.triangles(mesh), 'materials': sorted(materials, key=str),
                     'low': [min(p[i] for p in points) for i in range(3)], 'high': [max(p[i] for p in points) for i in range(3)],
                     'surface': list(zip(points, normals))}
        elif 'camera' in node:
            camera = data['cameras'][node['camera']]
            entry = {'kind': 'camera', 'origin': transform(matrices[index], (0, 0, 0)), 'target': transform(matrices[index], (0, 0, -1)),
                     'mag': [camera.get('orthographic', {}).get('xmag', 0), camera.get('orthographic', {}).get('ymag', 0)]}
        elif 'extensions' in node and 'KHR_lights_punctual' in node['extensions']:
            light = lights[node['extensions']['KHR_lights_punctual']['light']]
            entry = {'kind': 'light', 'origin': transform(matrices[index], (0, 0, 0)), 'target': transform(matrices[index], (0, 0, -1)),
                     'type': light['type'], 'color': list(light.get('color', (1, 1, 1))), 'intensity': [light.get('intensity', 1)],
                     'spot': list(light.get('spot', {}).values())}
        result[node.get('name')] = entry
    return result


def unmatched(ours, theirs):
    """Count vertices with no counterpart at the same place facing the same way.

    Vertex counts alone can differ harmlessly: exporters split a vertex wherever normals differ
    by rounding error. Rotation is ignored, so normals here are object-space.
    """
    size = tolerance * 2
    cell = lambda p: tuple(int(c // size) for c in p)
    grid = {}
    for point, normal in theirs:
        grid.setdefault(cell(point), []).append((point, normal))
    missing = 0
    for point, normal in ours:
        x, y, z = cell(point)
        near = (candidate for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1) for candidate in grid.get((x + i, y + j, z + k), ()))
        if not any(max(abs(a - b) for a, b in zip(point, p)) <= tolerance and max(abs(a - b) for a, b in zip(normal, n)) <= .02 for p, n in near):
            missing += 1
    return missing


def animations(glb):
    result = {}
    for animation in glb.json.get('animations', []):
        for channel in animation['channels']:
            sampler = animation['samplers'][channel['sampler']]
            node = glb.json['nodes'][channel['target']['node']].get('name')
            result[node, channel['target']['path']] = (glb.accessor(sampler['input']), glb.accessor(sampler['output']))
    return result


base, other = Glb(base_path), Glb(other_path)
a, b = summarize(base), summarize(other)
problems = [f'missing: {n}' for n in sorted(a.keys() - b.keys())] + [f'extra: {n}' for n in sorted(b.keys() - a.keys())]
for name in sorted(a.keys() & b.keys()):
    for field, value in a[name].items():
        theirs = b[name].get(field)
        if field == 'surface':
            missing = unmatched(value, theirs) + unmatched(theirs, value)
            if missing:
                problems.append(f'{name}.surface: {missing} of {len(value) + len(theirs)} vertices have no match')
            continue
        if isinstance(value, (list, tuple)) and value and isinstance(value[0], (int, float)):
            limit = tolerance if field in ('low', 'high', 'origin', 'target') else .02
            worst = max((abs(x - y) for x, y in zip(value, theirs)), default=0) if len(value) == len(theirs) else float('inf')
            if worst > limit:
                problems.append(f'{name}.{field}: off by {worst:.5f} ({value} vs {theirs})')
        elif value != theirs:
            problems.append(f'{name}.{field}: {value} vs {theirs}')

clips_a, clips_b = animations(base), animations(other)
if clips_a.keys() != clips_b.keys():
    problems.append(f'animation channels differ: {sorted(clips_a)} vs {sorted(clips_b)}')
for key in clips_a.keys() & clips_b.keys():
    times_a, values_a = clips_a[key]
    times_b, values_b = clips_b[key]
    if len(values_a) != len(values_b):
        problems.append(f'animation {key}: {len(values_a)} vs {len(values_b)} samples')
        continue
    worst = max(abs(x - y) for p, q in zip(values_a, values_b) for x, y in zip(p, q))
    if worst > tolerance:
        problems.append(f'animation {key}: off by {worst:.5f}')

print(f'Compared {len(a)} nodes, {len(clips_a)} animation channels, tolerance {tolerance * 1000:g} mm')
print('\n'.join(problems) or 'No differences')
sys.exit(1 if problems else 0)
