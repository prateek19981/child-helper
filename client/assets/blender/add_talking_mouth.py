"""
Add a jaw bone + visible talking lips to a Mixamo Boy01 blend.

Face points toward -Y. Re-run safe:

  blender --background --python add_talking_mouth.py
  blender --background --python add_talking_mouth.py -- james.blend
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

DIR = Path(__file__).resolve().parent
BLEND = DIR / "new_char.blend"
if "--" in sys.argv:
    extra = sys.argv[sys.argv.index("--") + 1 :]
    if extra:
        BLEND = Path(extra[0])
        if not BLEND.is_absolute():
            BLEND = DIR / BLEND

LIP_COLOR = (0.70, 0.20, 0.26, 1.0)
MOUTH_IN = (0.16, 0.04, 0.05, 1.0)


def mat(name, color, *, roughness=0.45):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def assign(obj, material):
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)


def bind_like_body(obj, arm, bone_name, space_obj):
    """Match Boy01_Head_Geo parenting/space + Armature mod + 100% bone weight."""
    for c in list(obj.constraints):
        obj.constraints.remove(c)
    for mod in list(obj.modifiers):
        obj.modifiers.remove(mod)
    for vg in list(obj.vertex_groups):
        obj.vertex_groups.remove(vg)

    world_verts = [obj.matrix_world @ v.co.copy() for v in obj.data.vertices]
    space = space_obj.matrix_world.copy()

    obj.parent = arm
    obj.parent_type = "OBJECT"
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.matrix_world = space

    inv = space.inverted()
    for v, wco in zip(obj.data.vertices, world_verts):
        v.co = inv @ wco

    vg = obj.vertex_groups.new(name=bone_name)
    vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    mod.use_vertex_groups = True
    print(f"bound {obj.name} -> {bone_name}")


def ensure_head_armature_mod(head, arm):
    """Boy01_Head_Geo was missing its Armature modifier — without it the face won't follow mocap."""
    mod = None
    for m in head.modifiers:
        if m.type == "ARMATURE":
            mod = m
            break
    if mod is None:
        mod = head.modifiers.new("Armature", "ARMATURE")
        print("added Armature modifier to Boy01_Head_Geo")
    mod.object = arm
    mod.use_vertex_groups = True


def head_points(head):
    """World-space verts. On a combined body mesh, keep the head weights only."""
    mw = head.matrix_world
    group = head.vertex_groups.get("mixamorig:Head")
    gi = group.index if group else None
    pts = []
    for v in head.data.vertices:
        if gi is not None:
            weight = 0.0
            for g in v.groups:
                if g.group == gi:
                    weight = g.weight
                    break
            if weight < 0.5:
                continue
        pts.append(mw @ v.co)
    if len(pts) < 20:
        pts = [mw @ v.co for v in head.data.vertices]
    return pts


def find_mouth_center(head) -> Vector:
    """Most-forward point just under the nose (painted smile height)."""
    pts = head_points(head)
    min_y = min(p.y for p in pts)
    front = [p for p in pts if p.y < min_y + 0.10]

    nose = sorted((p for p in front if 1.53 < p.z < 1.60), key=lambda p: p.y)[:5]
    if nose:
        nose_p = Vector((0, 0, 0))
        for p in nose:
            nose_p += p
        nose_p /= len(nose)
    else:
        nose_p = Vector((-0.12, -0.33, 1.55))

    # The painted smile is well below the nose tip. The darkest pixels
    # just under the nose are nostril shadow, so don't snap to those.
    z_mouth = nose_p.z - 0.078
    band = [p for p in front if abs(p.z - z_mouth) < 0.02 and abs(p.x) < 0.05]
    if len(band) < 3:
        band = [p for p in front if abs(p.z - z_mouth) < 0.04 and abs(p.x) < 0.08]
    band.sort(key=lambda p: p.y)
    tip = band[: max(3, len(band) // 5)]
    acc = Vector((0, 0, 0))
    for p in tip:
        acc += p
    c = acc / len(tip)
    return Vector((0.0, c.y - 0.008, z_mouth))


def make_lip_mesh(name, center: Vector, *, width=0.09, radius=0.012, smile=0.012, n=24):
    """Build a thick smiling lip in local space, then place at center."""
    # Local arc: ends up (smile), slight forward bulge at center
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = (t - 0.5) * 2.0 * width
        # smile > 0 → ends higher in Z (classic smile curve)
        z = smile * ((2 * t - 1) ** 2)
        y = -0.003 * (1.0 - (2 * t - 1) ** 2)
        pts.append(Vector((x, y, z)))

    curve_data = bpy.data.curves.new(name + "_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 4
    curve_data.resolution_u = 8
    curve_data.fill_mode = "FULL"
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(pts) - 1)
    for sp, p in zip(spline.points, pts):
        sp.co = (p.x, p.y, p.z, 1.0)

    curve_obj = bpy.data.objects.new(name + "_curve", curve_data)
    bpy.context.collection.objects.link(curve_obj)
    curve_obj.location = center
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    lip = bpy.context.active_object
    lip.name = name
    # Keep origin at mouth center (do NOT apply location)
    bpy.ops.object.shade_smooth()
    return lip


def ensure_jaw_bone(arm, mouth_w: Vector):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    if "mixamorig:Head" not in eb:
        bpy.ops.object.mode_set(mode="OBJECT")
        raise SystemExit("mixamorig:Head missing")
    if "mixamorig:Jaw" in eb:
        eb.remove(eb["mixamorig:Jaw"])
    bpy.ops.object.mode_set(mode="OBJECT")

    # Hinge sits back in the skull. Lips at the pivot only spin in place.
    hinge_w = mouth_w + Vector((0.0, 0.11, 0.0))
    chin_w = mouth_w + Vector((0.0, 0.005, -0.04))
    aw_inv = arm.matrix_world.inverted()
    jaw_head = aw_inv @ hinge_w
    jaw_tail = aw_inv @ chin_w

    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    jaw = eb.new("mixamorig:Jaw")
    jaw.head = jaw_head
    jaw.tail = jaw_tail
    jaw.parent = eb["mixamorig:Head"]
    jaw.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    print("Jaw", tuple(round(c, 4) for c in jaw_head), "->", tuple(round(c, 4) for c in jaw_tail))
    return "mixamorig:Jaw"


def weight_chin_to_jaw(head_obj, jaw_name, mouth_w: Vector):
    mw = head_obj.matrix_world
    if jaw_name not in [g.name for g in head_obj.vertex_groups]:
        head_obj.vertex_groups.new(name=jaw_name)
    jaw_g = head_obj.vertex_groups[jaw_name]
    head_g = head_obj.vertex_groups.get("mixamorig:Head")
    n = 0
    for v in head_obj.data.vertices:
        w = mw @ v.co
        if w.y > mouth_w.y + 0.07:
            continue
        if w.z < mouth_w.z - 0.10 or w.z > mouth_w.z + 0.03:
            continue
        if abs(w.x - mouth_w.x) > 0.14:
            continue
        t = max(0.0, min(1.0, (mouth_w.z + 0.015 - w.z) / 0.1))
        jaw_w = 0.25 + 0.55 * t
        jaw_g.add([v.index], jaw_w, "REPLACE")
        if head_g:
            head_g.add([v.index], max(0.05, 1.0 - jaw_w), "REPLACE")
        n += 1
    print("chin verts weighted", n)


def key_jaw(arm, jaw_name, action, f0, f1, *, open_scale=0.55):
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if getattr(action, "slots", None):
        try:
            arm.animation_data.action_slot = action.slots[0]
        except Exception:
            pass

    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    jaw = arm.pose.bones[jaw_name]
    jaw.rotation_mode = "XYZ"

    for frame in range(f0, f1 + 1, 2):
        t = (frame - f0) / max(f1 - f0, 1)
        open_amt = open_scale * (
            0.55 * abs(math.sin(t * math.pi * 9))
            + 0.30 * abs(math.sin(t * math.pi * 17 + 0.4))
            + 0.15 * abs(math.sin(t * math.pi * 5 + 1.1))
        )
        jaw.rotation_euler = (open_amt, 0.0, 0.0)
        jaw.keyframe_insert("rotation_euler", frame=frame)

    curves = []
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for slot in action.slots:
                    bag = strip.channelbag(slot)
                    if bag:
                        curves.extend(bag.fcurves)
    except Exception:
        curves = list(getattr(action, "fcurves", []) or [])
    for fc in curves:
        if "Jaw" not in fc.data_path:
            continue
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            try:
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"
            except Exception:
                pass
    bpy.ops.object.mode_set(mode="OBJECT")
    print(f"keyed jaw on {action.name} {f0}-{f1}")


def world_center(obj) -> Vector:
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(corners, Vector()) / 8


def main():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    scene = bpy.context.scene
    scene.frame_set(1)

    arm = bpy.data.objects["Armature"]
    head = None
    for name in ("Boy01_Head_Geo", "Boy01_Body_Geo"):
        obj = bpy.data.objects.get(name)
        if obj and obj.type == "MESH":
            head = obj
            break
    if head is None:
        raise SystemExit("no Boy01 head or body mesh")
    print("head mesh", head.name)

    # Build against bind/rest pose so lips line up with the mesh, not mocap frame 1
    saved_action = None
    saved_slot = None
    if arm.animation_data:
        saved_action = arm.animation_data.action
        saved_slot = getattr(arm.animation_data, "action_slot", None)
        arm.animation_data.action = None
    arm.data.pose_position = "REST"
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.transforms_clear()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()

    for name in (
        "LipUpper", "LipLower", "MouthCavity",
        "LipUpper_curve", "LipLower_curve",
    ):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

    mouth_w = find_mouth_center(head)
    print("mouth_w", tuple(round(c, 3) for c in mouth_w))

    jaw_name = ensure_jaw_bone(arm, mouth_w)

    lip_mat = mat("TalkLips", LIP_COLOR, roughness=0.35)
    mouth_mat = mat("TalkMouthIn", MOUTH_IN, roughness=0.55)

    upper = make_lip_mesh(
        "LipUpper",
        mouth_w + Vector((0.0, 0.0, 0.005)),
        width=0.048,
        radius=0.006,
        smile=0.007,
    )
    lower = make_lip_mesh(
        "LipLower",
        mouth_w + Vector((0.0, -0.001, -0.007)),
        width=0.045,
        radius=0.006,
        smile=0.007,
    )
    assign(upper, lip_mat)
    assign(lower, lip_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.028,
        location=mouth_w + Vector((0.0, 0.006, -0.002)),
        segments=16,
        ring_count=10,
    )
    cavity = bpy.context.active_object
    cavity.name = "MouthCavity"
    cavity.scale = (1.65, 0.5, 0.48)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(cavity, mouth_mat)
    bpy.ops.object.shade_smooth()

    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    ensure_head_armature_mod(head, arm)
    bind_like_body(upper, arm, "mixamorig:Head", head)
    bind_like_body(cavity, arm, "mixamorig:Head", head)
    bind_like_body(lower, arm, jaw_name, head)
    weight_chin_to_jaw(head, jaw_name, mouth_w)

    bpy.context.view_layer.update()
    for name in ("LipUpper", "LipLower", "MouthCavity"):
        o = bpy.data.objects[name]
        print(name, "rest", tuple(round(c, 3) for c in world_center(o)))

    arm.data.pose_position = "POSE"
    if arm.animation_data and saved_action:
        arm.animation_data.action = saved_action
        if saved_slot is not None:
            try:
                arm.animation_data.action_slot = saved_slot
            except Exception:
                pass

    for act_name in ("TalkingMocap", "Talking", "mixamo.com"):
        act = bpy.data.actions.get(act_name)
        if not act:
            continue
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        key_jaw(arm, jaw_name, act, f0, f1, open_scale=0.22)

    prefer = bpy.data.actions.get("TalkingMocap") or bpy.data.actions.get("mixamo.com")
    if prefer and arm.animation_data:
        arm.animation_data.action = prefer
        if getattr(prefer, "slots", None):
            try:
                arm.animation_data.action_slot = prefer.slots[0]
            except Exception:
                pass
        scene.frame_start = int(prefer.frame_range[0])
        scene.frame_end = int(prefer.frame_range[1])

    scene.frame_set(1)
    bpy.context.view_layer.update()
    for name in ("LipUpper", "LipLower", "MouthCavity"):
        o = bpy.data.objects[name]
        print(name, "f1", tuple(round(c, 3) for c in world_center(o)), "pbone", o.parent_bone)

    mix = bpy.data.objects.get("MixamoTalking")
    if mix:
        mix.hide_viewport = True
        mix.hide_render = True

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("SAVED", BLEND)


if __name__ == "__main__":
    main()
