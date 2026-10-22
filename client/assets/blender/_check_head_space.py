import bpy
from mathutils import Vector

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
arm = bpy.data.objects["Armature"]
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
head = bpy.data.objects["Boy01_Head_Geo"]
print("arm.mw scale", arm.matrix_world.to_scale())
print("head.mw", head.matrix_world)
print("head.mpi", head.matrix_parent_inverse)
v0 = head.data.vertices[0].co
print("v0 local", tuple(round(c, 4) for c in v0))
print("v0 world", tuple(round(c, 4) for c in (head.matrix_world @ v0)))

lip = bpy.data.objects["LipUpper"]
print("lip.mw", lip.matrix_world)
print("lip.mpi", lip.matrix_parent_inverse)
print("lip.parent", lip.parent)
lv = lip.data.vertices[0].co
print("lip v0 local", tuple(round(c, 4) for c in lv))
print("lip v0 world", tuple(round(c, 4) for c in (lip.matrix_world @ lv)))
# depsgraph evaluated
deps = bpy.context.evaluated_depsgraph_get()
le = lip.evaluated_get(deps)
print("lip eval mw translation", tuple(round(c, 4) for c in le.matrix_world.translation))
me = le.to_mesh()
print("lip eval v0", tuple(round(c, 4) for c in (le.matrix_world @ me.vertices[0].co)))
le.to_mesh_clear()
