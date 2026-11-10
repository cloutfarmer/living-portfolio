"""Measure the exported file, since that is what visitors load. Exits 1 when the site would break.

python3 blender/scripts/tools/check_glb.py assets/processed/corner-desk.glb

Sizes are reported, not enforced, until browser profiling on real hardware sets budgets.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.glb import Glb  # noqa: E402
from lib.site_contract import EXACT_NAMES, MATERIALS, PREFIXES  # noqa: E402

path = sys.argv[1]
glb = Glb(path)
data = glb.json
names = {node.get('name', '') for node in data['nodes']}
materials = {material['name'] for material in data.get('materials', [])}
meshes = data.get('meshes', [])
failures = [f'site needs node: {name}' for name in EXACT_NAMES if name not in names]
for prefix, count in PREFIXES.items():
    found = sum(name.startswith(prefix) for name in names)
    if found < count:
        failures.append(f'site needs {count} nodes named {prefix}*, found {found}')
failures += [f'site needs material: {name}' for name in MATERIALS if name not in materials]
if not data.get('animations'):
    failures.append('candle flicker animation is missing')

triangles = sorted(((glb.triangles(mesh), mesh['name']) for mesh in meshes), reverse=True)
print(f'{Path(path).name}: {os.path.getsize(path) / 1e6:.2f} MB, {len(data["nodes"])} nodes, {glb.primitives()} primitives '
      f'(draw calls before shadows and effects), {sum(t for t, _ in triangles):,} triangles, {len(data.get("images", []))} images')
print('Heaviest: ' + ', '.join(f'{name} {count}' for count, name in triangles[:5]))
print('\n'.join(f'FAIL {line}' for line in failures) or 'Contract OK')
sys.exit(1 if failures else 0)
