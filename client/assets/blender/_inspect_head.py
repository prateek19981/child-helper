import bpy
from mathutils import Vector
from pathlib import Path

bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).resolve().parent / "new_char.blend"))
head = bpy.data.objects["Boy01_Head_Geo"]
print("verts", len(head.data.vertices), "shape_keys", head.data.shape_keys)
print("vgroups", [g.name for g in head.vertex_groups])
corners = [head.matrix_world @ Vector(c) for c in head.bound_box]
xs=[c.x for c in corners]; ys=[c.y for c in corners]; zs=[c.z for c in corners]
print(f"bounds x={min(xs):.3f}..{max(xs):.3f} y={min(ys):.3f}..{max(ys):.3f} z={min(zs):.3f}..{max(zs):.3f}")

# Sample mouth-ish verts: front of face, lower half of head
mw = head.matrix_world
mouthish = []
for v in head.data.vertices:
    w = mw @ v.co
    if w.y > 0.05 and 1.45 < w.z < 1.65 and abs(w.x) < 0.08:
        mouthish.append(w)
print("mouthish count", len(mouthish))
if mouthish:
    avg = sum(mouthish, Vector()) / len(mouthish)
    print("mouthish avg", tuple(round(c,3) for c in avg))

# Head bone
arm = bpy.data.objects["Armature"]
hb = arm.data.bones.get("mixamorig:Head")
print("Head bone", hb.head_local, "->", hb.tail_local)

# Check active action length
print("active", arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else None)
