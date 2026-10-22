import bpy
from mathutils import Vector

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
head = bpy.data.objects["Boy01_Head_Geo"]
arm = bpy.data.objects["Armature"]
print("head parent", head.parent, "ptype", head.parent_type)
print("head loc", tuple(head.location), "scale", tuple(head.scale))
print("head matrix_basis translation", tuple(head.matrix_basis.translation))
print("mods", [m.type for m in head.modifiers])
print("vgroups sample", [g.name for g in head.vertex_groups][:8])

# Compare lip ChildOf vs head mouth point at frame 1 and 40
arm.data.pose_position = "POSE"
if arm.animation_data:
    act = bpy.data.actions.get("TalkingMocap")
    if act:
        arm.animation_data.action = act

def mouth_approx():
    # evaluated head center-front at smile height
    deps = bpy.context.evaluated_depsgraph_get()
    h = head.evaluated_get(deps)
    me = h.to_mesh()
    mw = h.matrix_world
    pts = [mw @ v.co for v in me.vertices]
    band = [p for p in pts if 1.50 < p.z < 1.54]
    if not band:
        h.to_mesh_clear()
        return None
    band.sort(key=lambda p: p.y)
    p = band[0]
    h.to_mesh_clear()
    return p

lip = bpy.data.objects.get("LipUpper")
for f in (1, 40):
    bpy.context.scene.frame_set(f)
    bpy.context.view_layer.update()
    m = mouth_approx()
    if lip:
        corners = [lip.matrix_world @ Vector(c) for c in lip.bound_box]
        lc = Vector((0, 0, 0))
        for c in corners:
            lc += c
        lc /= 8
        print(
            f"f{f} mouth_front",
            tuple(round(c, 3) for c in m) if m else None,
            "lip",
            tuple(round(c, 3) for c in lc),
        )
