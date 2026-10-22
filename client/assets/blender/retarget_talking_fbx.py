"""
Retarget Mixamo Talking.fbx onto the bear WITHOUT world-matrix copy.

The bear uses straight hinged arms — full Mixamo world rotations crush the mesh.
Instead:
  - Head/Neck: rest-relative rotation, heavily damped
  - Arms: map Mixamo arm *raise amount* onto the bear's hinge euler (same as Talking)
  - Jaw: light chatter
  - Legs/Root/Spine/Chest: untouched

Writes: koober_bear_talking_mocap.blend  (no app GLB)

  blender --background --python retarget_talking_fbx.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector  # noqa: F401 — Vector used for camera aim

DIR = Path(__file__).resolve().parent
# Prefer the clean arms_final (._final was altered by iris/pupil experiments).
SRC_BLEND = DIR / "koober_bear_arms_final.blend"
FBX = DIR / "Talking.fbx"
OUT_BLEND = DIR / "koober_bear_talking_mocap.blend"


def clear_pose(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for b in arm.pose.bones:
        b.location = (0, 0, 0)
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = (1, 0, 0, 0)
        b.rotation_euler = (0, 0, 0)
        b.scale = (1, 1, 1)
        for c in list(b.constraints):
            b.constraints.remove(c)
    bpy.ops.object.mode_set(mode="OBJECT")


def world_height(arm) -> float:
    bpy.context.view_layer.update()
    zs = []
    for b in arm.data.bones:
        zs.append((arm.matrix_world @ b.head_local).z)
        zs.append((arm.matrix_world @ b.tail_local).z)
    return max(zs) - min(zs) if zs else 1.0


def bone_rest_world(arm, name: str) -> Matrix:
    return arm.matrix_world @ arm.data.bones[name].matrix_local


def bone_pose_world(arm, name: str) -> Matrix:
    bpy.context.view_layer.update()
    return arm.matrix_world @ arm.pose.bones[name].matrix


def set_pose_world_matrix(arm, name: str, world_matrix: Matrix):
    pb = arm.pose.bones[name]
    pb.rotation_mode = "QUATERNION"
    pb.matrix = arm.matrix_world.inverted() @ world_matrix


def lift_axis(arm, bone_name: str, child_name: str):
    """Same idea as create_bear_mascot: axis/sign that raises the child."""
    pb = arm.pose.bones
    bone = pb[bone_name]
    child = pb[child_name]
    bone.rotation_mode = "XYZ"
    rest = (arm.matrix_world @ child.tail).copy()
    best = (0, 1)
    best_score = -1e9
    for axis in range(3):
        for sign in (1, -1):
            euler = [0.0, 0.0, 0.0]
            euler[axis] = sign * 1.0
            bone.rotation_euler = euler
            bpy.context.view_layer.update()
            p = arm.matrix_world @ child.tail
            outward = abs(p.x) - abs(rest.x)
            score = (p.z - rest.z) * 2.2 + (p.y - rest.y) * 0.5 + outward * 0.9
            if p.y < rest.y - 0.05:
                score -= 3.0
            if score > best_score:
                best_score = score
                best = (axis, sign)
    bone.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    print(bone_name, "lift", best)
    return best


def euler_on(axis, sign, amount):
    e = [0.0, 0.0, 0.0]
    e[axis] = sign * amount
    return tuple(e)


def mixamo_arm_raise(src, side: str, rest_dir: Vector) -> float:
    """0 = down (rest), 1 = fully raised. side = 'Left' or 'Right'."""
    name = f"mixamorig:{side}Arm"
    pb = src.pose.bones[name]
    head = src.matrix_world @ pb.head
    tail = src.matrix_world @ pb.tail
    direction = (tail - head).normalized()
    # How much the arm points up vs rest
    up = Vector((0, 0, 1))
    raise_now = max(0.0, direction.dot(up))
    raise_rest = max(0.0, rest_dir.dot(up))
    # Also use difference from rest direction
    delta = 1.0 - max(-1.0, min(1.0, direction.dot(rest_dir)))
    amount = max(raise_now - raise_rest, 0.0) * 0.7 + delta * 0.5
    return max(0.0, min(1.0, amount))


def main():
    if not SRC_BLEND.exists():
        raise SystemExit(f"missing {SRC_BLEND}")
    if not FBX.exists():
        raise SystemExit(f"missing {FBX}")

    bpy.ops.wm.open_mainfile(filepath=str(SRC_BLEND))
    bear = bpy.data.objects["BearArmature"]

    ad = bear.animation_data
    if ad:
        for t in ad.nla_tracks:
            t.mute = True
        ad.action = None
    clear_pose(bear)

    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(
        filepath=str(FBX),
        automatic_bone_orientation=True,
        ignore_leaf_bones=True,
    )
    new_objs = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in new_objs if o.type == "ARMATURE")
    src.name = "MixamoTalking"
    for o in list(new_objs):
        if o != src:
            bpy.data.objects.remove(o, do_unlink=True)

    scale = world_height(bear) / max(world_height(src), 1e-4)
    src.scale = (scale, scale, scale)
    bpy.context.view_layer.objects.active = src
    src.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    src.location = (3.5, 0.0, 0.0)
    print("scale", round(scale, 3))

    src_action = src.animation_data.action if src.animation_data else None
    if not src_action:
        src_action = next(a for a in bpy.data.actions if "mixamo" in a.name.lower())
    src.animation_data.action = src_action
    f0, f1 = int(src_action.frame_range[0]), int(src_action.frame_range[1])
    scene = bpy.context.scene
    scene.frame_start = f0
    scene.frame_end = f1

    # Bear hinge axes
    bpy.context.view_layer.objects.active = bear
    bpy.ops.object.mode_set(mode="POSE")
    axis_l, sign_l = lift_axis(bear, "UpperArm_L", "Hand_L")
    axis_r, sign_r = lift_axis(bear, "UpperArm_R", "Hand_R")
    bpy.ops.object.mode_set(mode="OBJECT")

    # Mixamo arm rest directions (from edit bones)
    def rest_dir(arm, bone_name):
        b = arm.data.bones[bone_name]
        d = (arm.matrix_world @ b.tail_local) - (arm.matrix_world @ b.head_local)
        return d.normalized()

    left_rest = rest_dir(src, "mixamorig:LeftArm")
    right_rest = rest_dir(src, "mixamorig:RightArm")

    if "TalkingMocap" in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions["TalkingMocap"])
    talking = bpy.data.actions.new("TalkingMocap")
    if bear.animation_data is None:
        bear.animation_data_create()
    bear.animation_data.action = talking
    if getattr(talking, "slots", None):
        try:
            bear.animation_data.action_slot = talking.slots[0]
        except Exception:
            pass

    bpy.context.view_layer.objects.active = bear
    bpy.ops.object.mode_set(mode="POSE")
    for b in bear.pose.bones:
        b.rotation_mode = "XYZ"

    max_arm = 0.55  # keep below crushing the shoulder fur

    for frame in range(f0, f1 + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()

        # --- Arms via hinge only (safe for this rig) ---
        lift_l = mixamo_arm_raise(src, "Left", left_rest)
        lift_r = mixamo_arm_raise(src, "Right", right_rest)
        pb = bear.pose.bones
        pb["UpperArm_L"].rotation_mode = "XYZ"
        pb["UpperArm_R"].rotation_mode = "XYZ"
        pb["UpperArm_L"].rotation_euler = euler_on(axis_l, sign_l, max_arm * lift_l)
        pb["UpperArm_R"].rotation_euler = euler_on(axis_r, sign_r, max_arm * lift_r)
        pb["Hand_L"].rotation_euler = (0, 0, 0)
        pb["Hand_R"].rotation_euler = (0, 0, 0)
        pb["UpperArm_L"].keyframe_insert("rotation_euler", frame=frame)
        pb["UpperArm_R"].keyframe_insert("rotation_euler", frame=frame)
        pb["Hand_L"].keyframe_insert("rotation_euler", frame=frame)
        pb["Hand_R"].keyframe_insert("rotation_euler", frame=frame)

        # --- Soft head nod from Mixamo head pitch only (local X), no full retarget ---
        src_head = src.pose.bones["mixamorig:Head"]
        # Mixamo head local euler — take a gentle nod/turn
        src_head.rotation_mode = "XYZ"
        hx, hy, hz = src_head.rotation_euler
        pb["Head"].rotation_mode = "XYZ"
        pb["Head"].rotation_euler = (
            max(-0.15, min(0.15, hx * 0.25)),
            0.0,
            max(-0.2, min(0.2, hz * 0.2)),
        )
        pb["Head"].keyframe_insert("rotation_euler", frame=frame)

        # --- Jaw chatter ---
        if "Jaw" in pb:
            jaw = pb["Jaw"]
            jaw.rotation_mode = "XYZ"
            t = (frame - f0) / max(f1 - f0, 1)
            # Tiny open — snout verts are jaw-weighted; big values float the muzzle.
            jaw.rotation_euler = (0.08 * abs(math.sin(t * math.pi * 7)), 0, 0)
            jaw.keyframe_insert("rotation_euler", frame=frame)

        if frame == f0 or frame % 50 == 0 or frame == f1:
            print("keyed", frame, "arms", round(lift_l, 2), round(lift_r, 2))

    bpy.ops.object.mode_set(mode="OBJECT")

    # Ease keys
    curves = []
    try:
        for layer in talking.layers:
            for strip in layer.strips:
                for slot in talking.slots:
                    bag = strip.channelbag(slot)
                    if bag:
                        curves.extend(bag.fcurves)
    except Exception:
        curves = list(getattr(talking, "fcurves", []) or [])
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            try:
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"
            except Exception:
                pass
    talking.use_fake_user = True

    ad = bear.animation_data
    for t in ad.nla_tracks:
        t.mute = True
    track = ad.nla_tracks.new()
    track.name = "TalkingMocap"
    strip = track.strips.new("TalkingMocap", f0, talking)
    strip.action_frame_end = f1
    ad.action = talking
    if getattr(talking, "slots", None):
        try:
            ad.action_slot = talking.slots[0]
        except Exception:
            pass

    # 3/4 camera (readable mascot framing).
    for name in list(bpy.data.objects.keys()):
        if name.startswith("Camera"):
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    bpy.ops.object.camera_add(location=(2.8, 6.5, 2.0))
    cam = bpy.context.active_object
    cam.name = "Camera"
    direction = Vector((0.0, 0.2, 1.6)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    # Lids occlude sclera/iris in this rig's rest — hide for talking mocap preview.
    for name in ("LidUpper_L", "LidUpper_R", "LidLower_L", "LidLower_R"):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.hide_render = True
            obj.hide_viewport = True

    src.hide_render = True
    src.hide_viewport = False

    scene.frame_set(max(f0, 60))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print("SAVED", OUT_BLEND)


if __name__ == "__main__":
    main()
