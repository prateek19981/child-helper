"""Close-up front preview of talking mouth on new_char.blend."""
from pathlib import Path

import bpy
from mathutils import Vector

DIR = Path(__file__).resolve().parent
BLEND = DIR / "new_char.blend"
OUT = DIR / "new_char_mouth_preview.png"

bpy.ops.wm.open_mainfile(filepath=str(BLEND))

arm = bpy.data.objects.get("Armature")
lip = bpy.data.objects.get("LipUpper")
if not lip:
    raise SystemExit("LipUpper missing — run add_talking_mouth.py first")

corners = [lip.matrix_world @ Vector(c) for c in lip.bound_box]
mouth = sum(corners, Vector()) / 8

for name in list(bpy.data.objects.keys()):
    if name.startswith("Camera"):
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

bpy.ops.object.camera_add(location=(mouth.x, mouth.y - 0.7, mouth.z + 0.08))
cam = bpy.context.active_object
cam.rotation_euler = (mouth - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

# Soft key light from front
for l in list(bpy.data.lights):
    bpy.data.lights.remove(l)
bpy.ops.object.light_add(type="AREA", location=(mouth.x, mouth.y - 1.2, mouth.z + 0.6))
light = bpy.context.active_object
light.data.energy = 250
light.data.size = 1.2

scene = bpy.context.scene
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.image_settings.file_format = "PNG"

# Rest pose — verify lips sit on the painted smile
if arm:
    arm.data.pose_position = "REST"
scene.frame_set(1)
bpy.context.view_layer.update()
corners = [lip.matrix_world @ Vector(c) for c in lip.bound_box]
mouth = sum(corners, Vector()) / 8
cam.location = (mouth.x, mouth.y - 0.7, mouth.z + 0.08)
cam.rotation_euler = (mouth - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = str(OUT)
bpy.ops.render.render(write_still=True)
print("rest lip center", tuple(round(c, 3) for c in mouth))

# Open-mouth talking frame
if arm:
    arm.data.pose_position = "POSE"
scene.frame_set(40)
bpy.context.view_layer.update()
scene.render.filepath = str(DIR / "new_char_mouth_talking.png")
bpy.ops.render.render(write_still=True)
print("PREVIEW ok", OUT)
