import bpy

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    mods = [(m.name, m.type, getattr(m, "object", None)) for m in o.modifiers]
    print(o.name, "parent", o.parent.name if o.parent else None, "mods", mods)
