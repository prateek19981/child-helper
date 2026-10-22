"""
Split James's mouth card (h_Geo) into upper and lower lips and add
lip-sync shape keys.

h_Geo is one flat card showing a mouth picture from
Boy01_FacialAnimMap.png. The lips are only painted on it, so pulling the
card down stretches the whole picture. This rebuilds the card with a cut
along the painted lip line, adds a hidden mouth inside (dark, teeth,
tongue) that only shows when the lips part, and adds shape keys:

  Basis        closed   M / B / P
  mouth_open   A / AH
  mouth_wide   E / EE / S
  mouth_round  O / OO / U

  blender --background --python add_lipsync_mouth.py -- james2.blend

Re-run safe: the original card is kept in the file as mesh "h_Geo_original".
"""
from __future__ import annotations

import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.geometry import barycentric_transform, intersect_point_tri_2d

DIR = Path(__file__).resolve().parent
BLEND = DIR / "james2.blend"
if "--" in sys.argv:
    extra = sys.argv[sys.argv.index("--") + 1 :]
    if extra:
        BLEND = Path(extra[0])
        if not BLEND.is_absolute():
            BLEND = DIR / BLEND

CARD = "h_Geo"
ORIGINAL = "h_Geo_original"
HEAD_GROUP = "mixamorig:Head"
UV_NAMES = ("map1", "map11", "map12")

# Atlas cell holding the closed-mouth picture the card shows.
SPRITE_CELL = (0.600, 0.700, 0.925, 0.985)
# Part of the card to rebuild: the painted lips plus a transparent margin.
CARD_U = (0.614, 0.686)
CARD_V = (0.937, 0.966)
COLS = 41
ROWS_UP = 6
ROWS_DOWN = 8
CAVITY_COLS = 31
# Mesh units are cm here; the card floats ~0.36 in front of the face.
CAVITY_DEPTH = 0.14

# open: lower-lip drop at the center (UV), lift: upper-lip share of it,
# scale: mouth width, push: lips forward (cm), power: opening shape,
# teeth / tongue: share of the opening they fill.
KEYS = {
    "mouth_open": dict(open=0.0105, lift=0.22, scale=0.96, push=0.0, power=1.2, teeth=0.22, tongue=0.30),
    "mouth_wide": dict(open=0.0040, lift=0.35, scale=1.13, push=0.0, power=0.6, teeth=0.45, tongue=0.15),
    "mouth_round": dict(open=0.0080, lift=0.30, scale=0.72, push=0.12, power=0.7, teeth=0.12, tongue=0.25),
}

MOUTH_IN = (0.035, 0.008, 0.012, 1.0)
TEETH = (0.93, 0.91, 0.87, 1.0)
TONGUE = (0.42, 0.10, 0.12, 1.0)


def solid_mat(name, color, roughness):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    spec = bsdf.inputs.get("Specular IOR Level")
    if spec:
        spec.default_value = 0.25
    m.diffuse_color = color
    return m


def surface_from(mesh):
    """Return at(u, v) -> mesh-space point on the original card for texture UV (u, v)."""
    mesh.calc_loop_triangles()
    uvs = mesh.uv_layers[UV_NAMES[0]].data
    if mesh.shape_keys:
        cos = [p.co.copy() for p in mesh.shape_keys.reference_key.data]
    else:
        cos = [v.co.copy() for v in mesh.vertices]
    tris = []
    for tri in mesh.loop_triangles:
        tuv = [Vector((uvs[li].uv.x, uvs[li].uv.y, 0.0)) for li in tri.loops]
        tco = [cos[mesh.loops[li].vertex_index] for li in tri.loops]
        tris.append((tuv, tco))

    def at(u, v):
        p = Vector((u, v, 0.0))
        for tuv, tco in tris:
            if intersect_point_tri_2d(p.xy, tuv[0].xy, tuv[1].xy, tuv[2].xy):
                return barycentric_transform(p, *tuv, *tco)
        tuv, tco = min(tris, key=lambda t: (p - (t[0][0] + t[0][1] + t[0][2]) / 3).length)
        return barycentric_transform(p, *tuv, *tco)

    return at


def lip_lines(img):
    """Per texture column: the dark line between the lips, and the lips' top and bottom."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    u0, u1, v0, v1 = SPRITE_CELL
    x0, x1, y0, y1 = int(u0 * w), int(u1 * w), int(v0 * h), int(v1 * h)
    crop = px[y0:y1, x0:x1]
    alpha = crop[..., 3]
    lum = crop[..., :3] @ np.array([0.3, 0.59, 0.11], dtype=np.float32)

    us, seam, top, bot = [], [], [], []
    for cx in range(crop.shape[1]):
        solid = alpha[:, cx] > 0.5
        rows = np.nonzero(solid)[0]
        if len(rows) < 2:
            continue
        us.append((x0 + cx + 0.5) / w)
        seam.append((y0 + int(np.argmin(np.where(solid, lum[:, cx], 9.0))) + 0.5) / h)
        top.append((y0 + rows.max() + 1.0) / h)
        bot.append((y0 + rows.min()) / h)
    if len(us) < 10:
        raise SystemExit("no painted lips found in the mouth sprite")

    k = 15
    seam = np.convolve(np.pad(seam, k // 2, mode="edge"), np.ones(k) / k, mode="valid")
    print("lips u %.4f..%.4f  seam v %.4f..%.4f" % (us[0], us[-1], seam.min(), seam.max()))
    return np.array(us), seam, np.array(top), np.array(bot)


def build_mouth(at, lines):
    us, seam, top, bot = lines
    u_left, u_right = float(us[0]), float(us[-1])
    uc = (u_left + u_right) / 2
    hw = (u_right - u_left) / 2

    def seam_at(u):
        return float(np.interp(u, us, seam))

    def top_at(u):
        return float(np.interp(u, us, top))

    def bot_at(u):
        return float(np.interp(u, us, bot))

    def prof(u, power):
        t = (u - uc) / hw
        return max(0.0, 1.0 - t * t) ** power

    def place(u, v, k, depth=0.0):
        push = 0.0
        if k:
            push = k["push"] * max(0.0, 1.0 - ((u - uc) / hw) ** 2)
            u = uc + (u - uc) * k["scale"]
        p = at(u, v)
        p.z += push - depth
        return p

    def target(rec, k):
        kind, u, v, row = rec
        if kind == "cavity":
            s = seam_at(u)
            if not k:
                return place(u, s, None, CAVITY_DEPTH)
            p = prof(u, k["power"])
            upper = s + k["open"] * k["lift"] * p
            lower = s - k["open"] * p
            gap = upper - lower
            # Edges tuck behind the painted lips; fade that out at the corners.
            cover = min(1.0, 2.0 * p)
            v = (
                upper + 0.45 * (top_at(u) - s) * cover,
                upper - k["teeth"] * gap,
                lower + k["tongue"] * gap,
                lower - 0.45 * (s - bot_at(u)) * cover,
            )[row]
            return place(u, v, k, CAVITY_DEPTH)
        if not k:
            return place(u, v, None)
        p = prof(u, k["power"])
        dv = k["open"] * k["lift"] * p if kind == "upper" else -k["open"] * p
        return place(u, v + dv, k)

    bm = bmesh.new()
    uv_layers = [bm.loops.layers.uv.new(n) for n in UV_NAMES]
    recs = []
    vert_uv = {}

    def vert(rec, uv):
        bv = bm.verts.new(target(rec, None))
        recs.append(rec)
        vert_uv[bv] = uv
        return bv

    def quad(a, b, c, d, mat):
        f = bm.faces.new((a, b, c, d))
        f.material_index = mat
        f.smooth = True
        for loop in f.loops:
            for lay in uv_layers:
                loop[lay].uv = vert_uv[loop.vert]

    cols = np.linspace(CARD_U[0], CARD_U[1], COLS)
    upper, lower = [], []
    for u in cols:
        u = float(u)
        s = seam_at(u)
        col = []
        for j in range(ROWS_UP + 1):
            v = s + (CARD_V[1] - s) * (j / ROWS_UP) ** 1.6
            col.append(vert(("upper", u, v, j), (u, v)))
        upper.append(col)
        col = []
        for j in range(ROWS_DOWN + 1):
            v = s - (s - CARD_V[0]) * (j / ROWS_DOWN) ** 1.6
            col.append(vert(("lower", u, v, j), (u, v)))
        lower.append(col)

    # The two seam rows sit on top of each other but share no vertices:
    # that is the cut between the lips.
    for i in range(COLS - 1):
        for j in range(ROWS_UP):
            quad(upper[i][j], upper[i + 1][j], upper[i + 1][j + 1], upper[i][j + 1], 0)
        for j in range(ROWS_DOWN):
            quad(lower[i][j + 1], lower[i + 1][j + 1], lower[i + 1][j], lower[i][j], 0)

    cavity = []
    for u in np.linspace(u_left, u_right, CAVITY_COLS):
        u = float(u)
        cavity.append([vert(("cavity", u, 0.0, r), (0.5, 0.5)) for r in range(4)])
    band_mat = (2, 1, 3)  # teeth, mouth inside, tongue
    for i in range(CAVITY_COLS - 1):
        for r in range(3):
            quad(cavity[i][r + 1], cavity[i + 1][r + 1], cavity[i + 1][r], cavity[i][r], band_mat[r])

    bm.verts.index_update()
    return bm, recs, target


def main():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    card = bpy.data.objects[CARD]
    original = bpy.data.meshes.get(ORIGINAL)
    if original is None:
        original = card.data.copy()
        original.name = ORIGINAL
        original.use_fake_user = True

    card_mat = original.materials[0]
    img = next(n.image for n in card_mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)

    at = surface_from(original)
    lines = lip_lines(img)
    bm, recs, target = build_mouth(at, lines)

    mesh = bpy.data.meshes.new(CARD + "_lips")
    bm.to_mesh(mesh)
    bm.free()
    for m in (
        card_mat,
        solid_mat("LipSync_MouthIn", MOUTH_IN, 0.85),
        solid_mat("LipSync_Teeth", TEETH, 0.4),
        solid_mat("LipSync_Tongue", TONGUE, 0.7),
    ):
        mesh.materials.append(m)

    old = card.data
    card.data = mesh
    if old is not original and old.users == 0:
        bpy.data.meshes.remove(old)
    mesh.name = CARD

    # Vertex group names live on the mesh, so the new mesh needs the head group again.
    head = card.vertex_groups.get(HEAD_GROUP) or card.vertex_groups.new(name=HEAD_GROUP)
    head.add(range(len(mesh.vertices)), 1.0, "REPLACE")

    card.shape_key_add(name="Basis", from_mix=False)
    for name, k in KEYS.items():
        kb = card.shape_key_add(name=name, from_mix=False)
        kb.data.foreach_set("co", [c for rec in recs for c in target(rec, k)])
        kb.value = 0.0
    card.active_shape_key_index = 0
    print("mouth verts", len(mesh.vertices), "faces", len(mesh.polygons), "keys", list(KEYS))

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("SAVED", BLEND)


if __name__ == "__main__":
    main()
