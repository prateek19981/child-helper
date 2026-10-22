import bpy
from mathutils import Vector

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
arm = bpy.data.objects["Armature"]
print("arm scale", tuple(arm.scale), "loc", tuple(arm.location))
head = bpy.data.objects["Boy01_Head_Geo"]
mw = head.matrix_world
front = sorted((mw @ v.co for v in head.data.vertices), key=lambda p: p.y)[:12]
print("most -Y head verts:")
for p in front:
    print(" ", tuple(round(c, 4) for c in p))

# mouth band
band = [mw @ v.co for v in head.data.vertices if 1.48 < (mw @ v.co).z < 1.58 and abs((mw @ v.co).x) < 0.12]
band.sort(key=lambda p: p.y)
print("mouth-band front8:")
for p in band[:8]:
    print(" ", tuple(round(c, 4) for c in p))
print("mouth-band y", min(p.y for p in band), max(p.y for p in band) if band else None)

for name in ("LipUpper", "LipLower", "MouthCavity"):
    o = bpy.data.objects.get(name)
    if not o:
        print(name, "MISSING")
        continue
    print(name, "parent", o.parent, "ptype", o.parent_type, "pbone", o.parent_bone)
    print("  matrix_world.translation", tuple(round(c, 4) for c in o.matrix_world.translation))
    corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
    ctr = sum(corners, Vector()) / 8
    print("  center", tuple(round(c, 4) for c in ctr))
    print("  nverts", len(o.data.vertices))
