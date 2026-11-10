"""Read a GLB without dependencies. No Blender needed, so checks can run anywhere."""
import json
import struct
from array import array

COMPONENT = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


class Glb:
    def __init__(self, path):
        with open(path, 'rb') as file:
            magic, _, _ = struct.unpack('<III', file.read(12))
            assert magic == 0x46546C67, f'{path} is not a GLB'
            size, _ = struct.unpack('<II', file.read(8))
            self.json = json.loads(file.read(size))
            size, _ = struct.unpack('<II', file.read(8))
            self.bin = file.read(size)

    def accessor(self, index):
        """Return an accessor's values as a list of tuples."""
        accessor = self.json['accessors'][index]
        view = self.json['bufferViews'][accessor['bufferView']]
        code, size = COMPONENT[accessor['componentType']]
        width = WIDTH[accessor['type']]
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride') or size * width
        assert stride == size * width, 'Interleaved buffers are not supported'
        values = array(code)
        values.frombytes(self.bin[start:start + accessor['count'] * stride])
        return [tuple(values[i:i + width]) for i in range(0, len(values), width)]

    def world_matrices(self):
        """Map node index to its world matrix (16 floats, column major)."""
        nodes = self.json['nodes']
        result = {}

        def walk(index, parent):
            result[index] = multiply(parent, local_matrix(nodes[index]))
            for child in nodes[index].get('children', []):
                walk(child, result[index])

        for root in self.json['scenes'][self.json.get('scene', 0)]['nodes']:
            walk(root, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        return result

    def primitives(self):
        return sum(len(mesh['primitives']) for mesh in self.json.get('meshes', []))

    def triangles(self, mesh):
        total = 0
        for primitive in mesh['primitives']:
            source = primitive['indices'] if 'indices' in primitive else primitive['attributes']['POSITION']
            total += self.json['accessors'][source]['count'] // 3
        return total


def local_matrix(node):
    if 'matrix' in node:
        return node['matrix']
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    sx, sy, sz = node.get('scale', (1, 1, 1))
    tx, ty, tz = node.get('translation', (0, 0, 0))
    return [
        (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
        2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
        2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        tx, ty, tz, 1,
    ]


def multiply(a, b):
    return [sum(a[r + 4 * k] * b[k + 4 * c] for k in range(4)) for c in range(4) for r in range(4)]


def transform(matrix, point):
    x, y, z = point
    return tuple(matrix[i] * x + matrix[4 + i] * y + matrix[8 + i] * z + matrix[12 + i] for i in range(3))
