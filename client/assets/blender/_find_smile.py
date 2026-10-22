import bpy
from mathutils import Vector

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
arm = bpy.data.objects["Armature"]
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
head = bpy.data.objects["Boy01_Head_Geo"]
mw = head.matrix_world
pts = [mw @ v.co for v in head.data.vertices]
min_y = min(p.y for p in pts)
front = [p for p in pts if p.y < min_y + 0.08]
print("front n", len(front), "z", min(p.z for p in front), max(p.z for p in front))
print("x", min(p.x for p in front), max(p.x for p in front))

# Nose tip: most forward in mid-upper face
nose = sorted(
    [p for p in front if 1.50 < p.z < 1.62],
    key=lambda p: p.y,
)[:5]
print("nose tips", [(round(p.x,3), round(p.y,3), round(p.z,3)) for p in nose])

# Chin: lowest front
chin = sorted(front, key=lambda p: p.z)[:5]
print("chin", [(round(p.x,3), round(p.y,3), round(p.z,3)) for p in chin])

# Eyes-ish: high front
eyes = sorted([p for p in front if p.z > 1.58], key=lambda p: p.y)[:5]
print("eye front", [(round(p.x,3), round(p.y,3), round(p.z,3)) for p in eyes])

# Try fractions
z_lo, z_hi = min(p.z for p in front), max(p.z for p in front)
for f in (0.12, 0.18, 0.22, 0.25, 0.30, 0.35):
    print(f"frac {f}", round(z_lo + f * (z_hi - z_lo), 3))
