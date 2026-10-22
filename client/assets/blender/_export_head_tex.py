from pathlib import Path

import bpy

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
head = bpy.data.objects["Boy01_Head_Geo"]
out = Path("/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/_boy_head_diffuse.png")
for m in head.data.materials:
    if not m or not m.node_tree:
        continue
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            n.image.filepath_raw = str(out)
            n.image.file_format = "PNG"
            n.image.save()
            print("saved", out, tuple(n.image.size))
