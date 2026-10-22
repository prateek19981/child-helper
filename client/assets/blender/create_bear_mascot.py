"""
Polished stylized bear mascot → Idle / Talking / Listening → GLB
blender --background --python create_bear_mascot.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

OUT_DIR = Path(__file__).resolve().parent.parent
BLEND_OUT = Path(__file__).resolve().parent / "koober_bear_soft.blend"
GLB_OUT = OUT_DIR / "koober_bear.glb"
PREVIEW = Path(__file__).resolve().parent / "bear_preview.png"

# Honey-brown mascot palette with clear contrast
FUR = (0.62, 0.38, 0.18, 1.0)
FUR_SHADOW = (0.42, 0.24, 0.12, 1.0)
CREAM = (0.96, 0.88, 0.72, 1.0)
NOSE_C = (0.06, 0.04, 0.04, 1.0)
EYE_BLACK = (0.05, 0.04, 0.04, 1.0)
SOCKET_C = (0.72, 0.62, 0.52, 1.0)  # soft recessed ring around eyes
BROW_C = (0.08, 0.06, 0.05, 1.0)
PAD_C = (0.85, 0.48, 0.42, 1.0)
MOUTH_IN = (0.42, 0.18, 0.16, 1.0)
TONGUE_C = (0.92, 0.55, 0.55, 1.0)
HL_C = (1.0, 1.0, 1.0, 1.0)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions, bpy.data.cameras, bpy.data.lights):
        for b in list(coll):
            try:
                coll.remove(b)
            except Exception:
                pass


def mat(name, color, *, roughness=0.55, sss=0.2):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-220, 0)
    out.location = (200, 0)
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = sss
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.4, 0.2)
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.12
        bsdf.inputs["Coat Roughness"].default_value = 0.4
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.45
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def assign(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def sphere(name, r, loc, scale=(1, 1, 1), seg=32, rings=16, *, subdiv=True):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    smooth(obj)
    if subdiv:
        mod = obj.modifiers.new("Subdiv", "SUBSURF")
        mod.levels = 1
        mod.render_levels = 2
    return obj


def join_objects(objects, name: str):
    """Join meshes into one object (keeps first object's materials)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def fuse_seamless(obj, voxel=0.04):
    """Remesh so stacked spheres become one soft continuous surface (vinyl look)."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    remesh = obj.modifiers.new("Remesh", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    subdiv = obj.modifiers.new("Subdiv", "SUBSURF")
    subdiv.levels = 1
    subdiv.render_levels = 2
    bpy.ops.object.modifier_apply(modifier=subdiv.name)
    smooth(obj)
    obj.select_set(False)
    return obj


def make_continuous_arm(name: str, x: float, sx: int, fur_mat, pad_mat):
    """
    Literally one mesh: a capsule (cylinder + capped ends) = single continuous arm.
    Matches the reference “soft tapering limb” look — no stacked balls.
    """
    # Capsule along Z, then rotate slightly outward
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.30,
        depth=1.15,
        vertices=32,
        location=(x * 0.90, 0.28, 1.05),
    )
    cyl = bpy.context.active_object
    cyl.name = f"_tmp_{name}_cyl"

    # Round caps (same object after join+boolean, or join + remesh once)
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.30, segments=32, ring_count=16, location=(x * 0.90, 0.28, 1.05 + 0.575)
    )
    top = bpy.context.active_object
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.34, segments=32, ring_count=16, location=(x * 0.90, 0.28, 1.05 - 0.575)
    )
    bot = bpy.context.active_object  # slightly larger = soft paw

    arm = join_objects([cyl, top, bot], name)
    # Melt cylinder+caps into one smooth capsule surface
    fuse_seamless(arm, voxel=0.06)

    # Tip the arm a bit (outward / forward) like a resting mascot pose
    arm.rotation_euler = (math.radians(8), 0, math.radians(-18 * sx))
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(arm, fur_mat)
    return arm


def build():
    fur = mat("Fur", FUR, roughness=0.58, sss=0.25)
    fur_d = mat("FurDark", FUR_SHADOW, roughness=0.62, sss=0.12)
    cream = mat("Cream", CREAM, roughness=0.42, sss=0.4)
    # Soft matte black nose (toy vinyl, not shiny plastic)
    nose_m = mat("Nose", NOSE_C, roughness=0.45, sss=0.05)
    eye_m = mat("EyeBlack", EYE_BLACK, roughness=0.12, sss=0.0)
    socket_m = mat("EyeSocket", SOCKET_C, roughness=0.5, sss=0.15)
    brow_m = mat("Brow", BROW_C, roughness=0.4, sss=0.0)
    pad = mat("Pad", PAD_C, roughness=0.48, sss=0.25)
    mouth_in = mat("MouthIn", MOUTH_IN, roughness=0.5, sss=0.1)
    tongue_m = mat("Tongue", TONGUE_C, roughness=0.4, sss=0.2)
    hl = mat("Highlight", HL_C, roughness=0.04, sss=0.0)

    # Character faces +Y (Blender front for our export)
    body = sphere("Body", 0.92, (0, 0, 1.05), (1.15, 0.95, 1.2), 40, 20)
    assign(body, fur)
    belly = sphere("Belly", 0.68, (0, 0.32, 0.95), (1.0, 0.55, 1.1), 32, 16)
    assign(belly, cream)

    head = sphere("Head", 0.82, (0, 0.08, 2.25), (1.08, 1.0, 0.98), 40, 20)
    assign(head, fur)

    # Soft cheeks (keep fur, sit behind cream muzzle)
    for side, x in (("L", -0.52), ("R", 0.52)):
        cheek = sphere(f"Cheek_{side}", 0.26, (x, 0.42, 2.08), (1.0, 0.7, 0.85), 24, 12)
        assign(cheek, fur)

    # Wide cream muzzle (happy face plate) — slightly heart / figure‑8 friendly
    snout = sphere("Snout", 0.50, (0, 0.70, 2.00), (1.4, 0.88, 1.05), 40, 20)
    assign(snout, cream)

    # Large horizontal oval nose on top of muzzle (like reference)
    nose = sphere(
        "Nose",
        0.16,
        (0, 0.98, 2.28),
        (1.75, 1.05, 0.85),  # wide left-right, plump front, slightly flat top
        32,
        16,
    )
    assign(nose, nose_m)
    # Soft highlight on upper-left of nose
    nose_hl = sphere("NoseHL", 0.04, (-0.06, 1.08, 2.36), (1.1, 0.9, 0.9), 12, 6)
    assign(nose_hl, hl)

    # Ears
    for side, x in (("L", -0.58), ("R", 0.58)):
        e = sphere(f"Ear_{side}", 0.34, (x, -0.05, 2.88), (1.05, 0.42, 1.1), 28, 14)
        assign(e, fur)
        p = sphere(f"EarPad_{side}", 0.2, (x, 0.1, 2.85), (0.95, 0.32, 0.95), 20, 10)
        assign(p, pad)

    # Eyes: soft socket + solid black circle + sparkle (friendly)
    for side, x in (("L", -0.28), ("R", 0.28)):
        sock = sphere(f"Socket_{side}", 0.19, (x, 0.70, 2.42), (1.15, 0.55, 1.15), 28, 14)
        assign(sock, socket_m)
        eye = sphere(f"Eye_{side}", 0.14, (x, 0.82, 2.43), (1.05, 0.7, 1.05), 28, 14)
        assign(eye, eye_m)
        h = sphere(
            f"HL_{side}",
            0.045,
            (x + (0.04 if side == "R" else -0.04), 0.92, 2.52),
            (1, 1, 1),
            12,
            6,
        )
        assign(h, hl)

    # Thick brows on the forehead, with a gap above the eyes
    for side, x, tilt in (("L", -0.34, 8), ("R", 0.34, -8)):
        brow = sphere(f"Brow_{side}", 0.09, (x, 0.74, 2.88), (2.5, 0.48, 0.95), 20, 10)
        assign(brow, brow_m)
        brow.rotation_euler = (0, 0, math.radians(tilt))
        bpy.context.view_layer.objects.active = brow
        brow.select_set(True)
        bpy.ops.object.transform_apply(rotation=True)
        brow.select_set(False)

    # Big open D-smile (joyful mouth)
    mouth = sphere("MouthCavity", 0.22, (0, 0.88, 1.88), (1.85, 0.75, 1.05), 32, 16)
    assign(mouth, mouth_in)
    smile_rim = sphere("SmileRim", 0.06, (0, 0.95, 1.72), (2.6, 0.45, 0.55), 24, 12)
    assign(smile_rim, cream)
    tongue = sphere("Tongue", 0.10, (0, 0.92, 1.78), (1.2, 0.7, 0.55), 20, 10)
    assign(tongue, tongue_m)

    # Arms are built later as separate straight hinged limbs (not joined into the torso).

    # Legs + feet
    for side, x in (("L", -0.42), ("R", 0.42)):
        lg = sphere(f"Leg_{side}", 0.42, (x, 0.12, 0.38), (1.05, 0.95, 1.2), 28, 14)
        assign(lg, fur)
        ft = sphere(f"Foot_{side}", 0.32, (x, 0.42, 0.0), (1.25, 1.5, 0.58), 28, 14)
        assign(ft, fur)
        fp = sphere(f"FootPad_{side}", 0.15, (x, 0.58, -0.02), (1.35, 1.05, 0.42), 16, 8)
        assign(fp, pad)

    parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    return parts


def apply_and_join(parts):
    # Apply subdiv then join, preserving material slots
    for obj in parts:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for mod in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception:
                pass
        obj.select_set(False)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        if obj.name in bpy.data.objects:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bear = bpy.context.active_object
    bear.name = "BearMesh"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    # Sit on ground
    zs = [(bear.matrix_world @ Vector(c)).z for c in bear.bound_box]
    bear.location.z -= min(zs)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    smooth(bear)
    return bear


def build_armature(bear):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "BearArmature"
    arm = arm_obj.data
    eb = arm.edit_bones
    root = eb[0]
    root.name = "Root"
    root.head, root.tail = (0, 0, 0), (0, 0, 0.25)

    def b(name, parent, head, tail):
        bone = eb.new(name)
        bone.head, bone.tail = head, tail
        bone.parent = parent
        bone.use_connect = False
        return bone

    spine = b("Spine", root, (0, 0, 0.35), (0, 0, 1.15))
    chest = b("Chest", spine, (0, 0, 1.15), (0, 0.05, 1.75))
    neck = b("Neck", chest, (0, 0.05, 1.75), (0, 0.1, 2.05))
    head = b("Head", neck, (0, 0.1, 2.05), (0, 0.15, 2.65))
    b("Jaw", head, (0, 0.4, 2.0), (0, 0.65, 1.8))

    # Straight arm. Pivot is just under the fur; the limb leaves the body
    # right away so only the shoulder overlaps the torso.
    def limb(side, sign):
        shoulder = (sign * 0.86, 0.10, 1.36)
        tip = (sign * 1.58, 0.36, 0.78)
        upper = b(f"UpperArm_{side}", chest, shoulder, tip)
        hand = b(f"Hand_{side}", upper, tip, (sign * 1.70, 0.48, 0.70))
        for bone in (upper, hand):
            bone.align_roll(Vector((0, 0, 1)))
        return upper

    limb("L", -1)
    limb("R", 1)

    hip_l = b("Hip_L", root, (-0.28, 0.05, 0.5), (-0.42, 0.1, 0.18))
    b("Foot_L", hip_l, (-0.42, 0.1, 0.18), (-0.42, 0.35, 0.0))
    hip_r = b("Hip_R", root, (0.28, 0.05, 0.5), (0.42, 0.1, 0.18))
    b("Foot_R", hip_r, (0.42, 0.1, 0.18), (0.42, 0.35, 0.0))

    bpy.ops.object.mode_set(mode="OBJECT")
    bear.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # Arms are separate meshes. Drop any torso weight on arm bones so the belly
    # does not stretch when the shoulder hinge swings.
    for name in [vg.name for vg in bear.vertex_groups if vg.name.startswith(("UpperArm", "Forearm", "Hand"))]:
        bear.vertex_groups.remove(bear.vertex_groups[name])
    chest_group = bear.vertex_groups.get("Chest")
    if chest_group:
        loose = []
        for v in bear.data.vertices:
            if sum(g.weight for g in v.groups) < 0.01:
                loose.append(v.index)
        if loose:
            chest_group.add(loose, 1.0, "REPLACE")
    return arm_obj


def _tube(name, head, tail, r0, r1, material):
    """Tapered limb along head→tail, with a ball at each end so the hinge stays round."""
    head_v = Vector(head)
    tail_v = Vector(tail)
    direction = tail_v - head_v
    length = max(direction.length, 1e-4)
    mid = (head_v + tail_v) / 2
    depth = length * 0.82
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=1.0, depth=depth, location=mid)
    cyl = bpy.context.active_object
    half = depth / 2
    for v in cyl.data.vertices:
        t = min(1.0, max(0.0, (v.co.z + half) / depth))
        radius = r0 * (1.0 - t) + r1 * t
        xy = Vector((v.co.x, v.co.y))
        if xy.length > 1e-8:
            xy = xy.normalized() * radius
            v.co.x, v.co.y = xy.x, xy.y
    cyl.rotation_mode = "QUATERNION"
    cyl.rotation_quaternion = direction.to_track_quat("Z", "Y")
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r0, segments=24, ring_count=12, location=head_v)
    cap_a = bpy.context.active_object
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r1 * 1.05, segments=24, ring_count=12, location=tail_v)
    cap_b = bpy.context.active_object
    obj = join_objects([cyl, cap_a, cap_b], name)
    assign(obj, material)
    smooth(obj)
    return obj


def _bind_rigid(obj, arm_obj, bone_name):
    """Whole mesh follows one bone. Torso is a different object, so it does not stretch."""
    world = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.matrix_world = world
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    group = obj.vertex_groups.new(name=bone_name)
    group.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")


def _paw(side, wrist, tip, fur, pad):
    """Open paw: chubby palm and four short fingers spread along the hand bone."""
    wrist = Vector(wrist)
    forward = Vector(tip) - wrist
    if forward.length < 1e-4:
        forward = Vector((0, 1, 0))
    forward.normalize()
    side_axis = Vector((1, 0, 0)) - forward * forward.dot(Vector((1, 0, 0)))
    if side_axis.length < 0.25:
        side_axis = Vector((0, 0, 1))
    side_axis.normalize()
    up_axis = side_axis.cross(forward).normalized()
    sign = -1 if side == "L" else 1
    palm_at = wrist + forward * 0.04
    palm = sphere(f"Palm_{side}", 0.13, palm_at, (1.25, 0.72, 0.95), 20, 12, subdiv=False)
    assign(palm, fur)
    parts = [palm]
    for i, spread in enumerate((-1.15, -0.4, 0.4, 1.15)):
        base = wrist + side_axis * (0.05 * spread) + forward * 0.07 + up_axis * 0.015
        tip_p = base + forward * 0.15 + side_axis * (0.03 * spread) + up_axis * 0.04
        parts.append(_tube(f"Finger_{side}_{i}", base, tip_p, 0.040, 0.034, fur))
    thumb_base = wrist + side_axis * (0.09 * sign) + forward * 0.02
    thumb_tip = thumb_base + side_axis * (0.09 * sign) + forward * 0.07 + up_axis * 0.04
    parts.append(_tube(f"Thumb_{side}", thumb_base, thumb_tip, 0.042, 0.034, fur))
    pad_at = wrist + forward * 0.09 - up_axis * 0.02
    pad_ball = sphere(f"PawPad_{side}", 0.055, pad_at, (1.15, 0.7, 0.85), 12, 8, subdiv=False)
    assign(pad_ball, pad)
    parts.append(pad_ball)
    paw = join_objects(parts, f"PawMesh_{side}")
    smooth(paw)
    return paw


def attach_hinged_arms(arm_obj):
    """Straight chubby arm. Inner end tucks into the body; the rest hangs free."""
    fur = bpy.data.materials["Fur"]
    pad = bpy.data.materials["Pad"]
    bones = arm_obj.data.bones
    for side in ("L", "R"):
        upper = bones[f"UpperArm_{side}"]
        hand = bones[f"Hand_{side}"]
        # Smaller inner cap so there is no ball shoulder. Outer end is the paw.
        arm_mesh = _tube(f"ArmMesh_{side}", upper.head_local, upper.tail_local, 0.16, 0.24, fur)
        fuse_seamless(arm_mesh, voxel=0.045)
        _bind_rigid(arm_mesh, arm_obj, f"UpperArm_{side}")
        paw = _paw(side, hand.head_local, hand.tail_local, fur, pad)
        _bind_rigid(paw, arm_obj, f"Hand_{side}")
    print("Hinged arms attached")


def ease_keys(action):
    """Bezier handles so the arms ease in and out instead of stepping."""
    curves = list(getattr(action, "fcurves", []) or [])
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for slot in action.slots:
                    bag = strip.channelbag(slot)
                    if bag:
                        curves.extend(bag.fcurves)
    except Exception:
        pass
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            try:
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"
            except Exception:
                pass


def animate(arm_obj):
    if arm_obj.animation_data is None:
        arm_obj.animation_data_create()
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones
    for bone in pb:
        bone.rotation_mode = "XYZ"
    bpy.context.scene.render.fps = 30

    def reset():
        for bone in pb:
            bone.location = (0, 0, 0)
            bone.rotation_euler = (0, 0, 0)
            bone.scale = (1, 1, 1)

    def key(names, frame):
        for n in names:
            pb[n].keyframe_insert("location", frame=frame)
            pb[n].keyframe_insert("rotation_euler", frame=frame)
            pb[n].keyframe_insert("scale", frame=frame)

    # Idle
    idle = bpy.data.actions.get("Idle") or bpy.data.actions.new("Idle")
    arm_obj.animation_data.action = idle
    reset()
    for frame, breath, sway in [(1, 0.0, 0.0), (30, 0.03, 0.025), (60, 0.0, 0.0)]:
        pb["Chest"].scale = (1 + breath, 1 + breath * 0.4, 1 + breath)
        pb["Spine"].rotation_euler = (sway * 0.12, 0, sway * 0.08)
        pb["Head"].rotation_euler = (-sway * 0.08, 0, sway * 0.05)
        key(["Chest", "Spine", "Head", "Root"], frame)
    idle.use_fake_user = True

    # Talking — upper arm hinges at the shoulder, elbow bends, paw follows (like a wave)
    if "Talking" in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions["Talking"])
    talking = bpy.data.actions.new("Talking")
    arm_obj.animation_data.action = talking
    reset()

    def lift_axis(bone_name, child_name):
        """Axis + sign that raises the child up and forward. +Y is the face."""
        bone = pb[bone_name]
        child = pb[child_name]
        bone.rotation_mode = "XYZ"
        rest = (arm_obj.matrix_world @ child.tail).copy()
        best = (0, 1)
        best_score = -1e9
        for axis in range(3):
            for sign in (1, -1):
                euler = [0.0, 0.0, 0.0]
                euler[axis] = sign * 1.0
                bone.rotation_euler = euler
                bpy.context.view_layer.update()
                p = arm_obj.matrix_world @ child.tail
                outward = abs(p.x) - abs(rest.x)
                score = (p.z - rest.z) * 2.2 + (p.y - rest.y) * 0.5 + outward * 0.9
                if p.y < rest.y - 0.05:
                    score -= 3.0
                if score > best_score:
                    best_score = score
                    best = (axis, sign)
        bone.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        print(bone_name, "lift", best, "score", round(best_score, 3))
        return best

    def euler_on(axis, sign, amount):
        euler = [0.0, 0.0, 0.0]
        euler[axis] = sign * amount
        return tuple(euler)

    axis_l, sign_l = lift_axis("UpperArm_L", "Hand_L")
    axis_r, sign_r = lift_axis("UpperArm_R", "Hand_R")

    def gentle(t, phase):
        """One slow rise and fall. phase delays the other arm."""
        return max(0.0, math.sin(t * math.pi + phase)) ** 0.8

    bones = ["Jaw", "Head", "UpperArm_L", "UpperArm_R", "Chest"]
    talk_end = 120
    for frame in range(1, talk_end + 1, 6):
        t = (frame - 1) / talk_end
        open_amt = 0.28 * abs(math.sin(t * math.pi * 3))
        up_l = gentle(t, 0.0)
        up_r = gentle(t, 0.55)
        pb["Jaw"].rotation_euler = (open_amt, 0, 0)
        pb["Head"].rotation_euler = (0.03 * math.sin(t * math.pi * 2), 0, 0.02 * math.sin(t * math.pi * 2))
        pb["Chest"].scale = (1.008, 1.0, 1.008)
        # Smaller swing than before so the arm drifts up instead of snapping.
        pb["UpperArm_L"].rotation_euler = euler_on(axis_l, sign_l, 0.72 * up_l)
        pb["UpperArm_R"].rotation_euler = euler_on(axis_r, sign_r, 0.72 * up_r)
        key(bones, frame)
    reset()
    key(bones, talk_end + 1)
    ease_keys(talking)
    talking.use_fake_user = True

    # Listening — both straight arms raised toward the ears
    if "Listening" in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions["Listening"])
    listening = bpy.data.actions.new("Listening")
    arm_obj.animation_data.action = listening
    reset()
    bones_l = ["UpperArm_L", "UpperArm_R", "Head", "Chest", "Spine"]
    for frame, w in [(1, 0.0), (10, 0.55), (18, 1.0), (40, 1.0), (50, 0.92), (60, 1.0)]:
        pb["UpperArm_L"].rotation_euler = euler_on(axis_l, sign_l, 0.85 * w)
        pb["UpperArm_R"].rotation_euler = euler_on(axis_r, sign_r, 0.85 * w)
        pb["Head"].rotation_euler = (0.1 * w, 0, 0)
        pb["Chest"].rotation_euler = (-0.04 * w, 0, 0)
        pb["Spine"].rotation_euler = (0.05 * w, 0, 0)
        key(bones_l, frame)
    ease_keys(listening)
    listening.use_fake_user = True

    # NLA for multi-clip glTF export
    ad = arm_obj.animation_data
    while ad.nla_tracks:
        ad.nla_tracks.remove(ad.nla_tracks[0])
    for tname, action, end in [
        ("Idle", idle, 60),
        ("Talking", talking, talk_end + 1),
        ("Listening", listening, 60),
    ]:
        track = ad.nla_tracks.new()
        track.name = tname
        strip = track.strips.new(tname, 1, action)
        strip.action_frame_end = end
    ad.action = None
    bpy.ops.object.mode_set(mode="OBJECT")


def lighting_and_camera():
    bpy.ops.object.camera_add(location=(1.85, 6.4, 1.35))
    cam = bpy.context.active_object
    cam.data.lens = 48
    direction = Vector((0.0, 0.15, 1.2)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type="AREA", location=(2.5, 3.0, 4.0))
    key = bpy.context.active_object
    key.data.energy = 500
    key.data.size = 4
    key.rotation_euler = (math.radians(50), 0, math.radians(20))

    bpy.ops.object.light_add(type="AREA", location=(-3.0, 2.0, 2.5))
    fill = bpy.context.active_object
    fill.data.energy = 180
    fill.data.size = 5
    fill.data.color = (0.85, 0.9, 1.0)

    bpy.ops.object.light_add(type="AREA", location=(0, -2.5, 3.0))
    rim = bpy.context.active_object
    rim.data.energy = 220
    rim.data.size = 3


def export_glb(arm_obj):
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    for c in arm_obj.children_recursive:
        c.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    kwargs = dict(
        filepath=str(GLB_OUT),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_force_sampling=True,
        export_skins=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    # Draco if available
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    print("GLB", GLB_OUT, "bytes", GLB_OUT.stat().st_size)


def render_preview():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.filepath = str(PREVIEW)
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    world = scene.world
    if world and world.use_nodes:
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.78, 0.86, 0.92, 1.0)
            bg.inputs[1].default_value = 0.85
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", PREVIEW)


def prepare_talking_preview(arm_obj):
    """Saved file plays ONLY Talking — stacked NLA tracks were pulling arms backward."""
    ad = arm_obj.animation_data
    talking = bpy.data.actions["Talking"]
    for track in ad.nla_tracks:
        track.mute = True
    ad.action = talking
    ad.action_slot = talking.slots[0] if getattr(talking, "slots", None) else None
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 121
    scene.frame_set(1)


def main():
    clear_scene()
    parts = build()
    bear = apply_and_join(parts)
    arm = build_armature(bear)
    attach_hinged_arms(arm)
    animate(arm)
    lighting_and_camera()
    export_glb(arm)
    prepare_talking_preview(arm)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT))
    print("BLEND", BLEND_OUT)
    bpy.context.scene.frame_set(60)
    render_preview()
    bpy.context.scene.frame_set(1)
    print("OK actions Idle Talking Listening")


if __name__ == "__main__":
    main()
