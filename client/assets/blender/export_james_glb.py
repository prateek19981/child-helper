"""
Export james2.blend for the React Native app.

Writes, next to this script's parent assets folder:
  james.glb        skinned mesh, Talking clip, mouth shape keys, no images
  james-body.jpg   body color
  james-face.png   eyes, brows and mouth (the facial sprite sheet)
  james.png        still used while the model loads

  blender --background --python export_james_glb.py
"""
from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector

DIR = Path(__file__).resolve().parent
BLEND = DIR / "james2.blend"
ASSETS = DIR.parent
GLB = ASSETS / "james.glb"

KEEP = ("Armature", "Boy01_Body_Geo", "Boy01_Brows_Geo", "Boy01_Eyes_Geo", "h_Geo")


def save_image(name: str, path: Path, fmt: str, size: int | None = None) -> None:
    img = bpy.data.images[name]
    if size and tuple(img.size) != (size, size):
        img.scale(size, size)
    img.filepath_raw = str(path)
    img.file_format = fmt
    img.save()
    print("image", path.name, img.size[:], path.stat().st_size)


def render_still() -> None:
    arm = bpy.data.objects["Armature"]
    arm.data.pose_position = "POSE"
    keys = bpy.data.objects["h_Geo"].data.shape_keys
    if keys and keys.animation_data:
        keys.animation_data_clear()
    if keys:
        for kb in keys.key_blocks:
            kb.value = 0.0
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()

    for obj in list(bpy.data.objects):
        if obj.type in ("CAMERA", "LIGHT"):
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.camera_add(location=(0.0, -2.4, 1.15))
    cam = bpy.context.active_object
    target = Vector((0.0, 0.0, 0.95))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    bpy.ops.object.light_add(type="AREA", location=(0.4, -1.6, 2.2))
    light = bpy.context.active_object
    light.data.energy = 250
    light.data.size = 2.0

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(ASSETS / "james.png")
    bpy.ops.render.render(write_still=True)
    print("still", scene.render.filepath)


def export_glb() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    keys = bpy.data.objects["h_Geo"].data.shape_keys
    if keys and keys.animation_data:
        keys.animation_data_clear()
    for kb in keys.key_blocks:
        kb.value = 0.0

    action = bpy.data.actions.get("mixamo.com") or bpy.data.actions.get("Talking")
    if action and action.name != "Talking":
        action.name = "Talking"
    scene = bpy.context.scene
    if action:
        # frame_start/frame_end stay 0 unless the action has a manual range.
        # frame_range is the span of the curves.
        scene.frame_start = int(action.frame_range[0])
        scene.frame_end = int(action.frame_range[1])
    scene.frame_set(scene.frame_start)
    bpy.context.view_layer.update()

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for uv in list(obj.data.uv_layers)[1:]:
            obj.data.uv_layers.remove(uv)

    bpy.ops.object.select_all(action="DESELECT")
    for name in KEEP:
        bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects["Armature"]

    bpy.ops.export_scene.gltf(
        filepath=str(GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_skins=True,
        export_morph=True,
        export_animations=True,
        # Sample the evaluated pose. Reading the layered Mixamo action directly
        # exported two identical keys, so the app had nothing to play.
        export_animation_mode="SCENE",
        export_bake_animation=True,
        export_frame_range=True,
        export_frame_step=1,
        export_optimize_animation_size=False,
        export_morph_animation=False,
        export_image_format="NONE",
        export_materials="EXPORT",
    )
    print("glb", GLB, GLB.stat().st_size)


def check_roundtrip() -> None:
    src_uv = None
    me = bpy.data.objects["h_Geo"].data
    for poly in me.polygons:
        for li in poly.loop_indices:
            src_uv = tuple(me.uv_layers.active.data[li].uv)
            break
        if src_uv:
            break

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    print("imported", [o.name for o in bpy.data.objects])
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        keys = [k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else []
        print(" mesh", o.name, "verts", len(o.data.vertices), "mats", [s.material.name if s.material else None for s in o.material_slots], "morphs", keys)
        if o.data.uv_layers and src_uv and "h_Geo" in o.name or (keys and src_uv):
            uv = o.data.uv_layers.active.data[0].uv
            print("  uv src", tuple(round(c, 4) for c in src_uv), "gltf", tuple(round(c, 4) for c in uv))
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    print("actions", [a.name for a in bpy.data.actions])
    print("bones", len(arm.data.bones))


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    save_image("Boy01_diffuse.jpg", ASSETS / "james-body.jpg", "JPEG")
    save_image("Boy01_FacialAnimMap.png", ASSETS / "james-face.png", "PNG", 2048)
    render_still()
    export_glb()
    check_roundtrip()


if __name__ == "__main__":
    main()
