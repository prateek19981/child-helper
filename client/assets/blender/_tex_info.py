import bpy
from mathutils import Vector
import numpy as np

bpy.ops.wm.open_mainfile(
    filepath="/Users/mmt13022/mmt_workspace/zutshi/client/assets/blender/new_char.blend"
)
arm = bpy.data.objects["Armature"]
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
head = bpy.data.objects["Boy01_Head_Geo"]
print("mats", [m.name if m else None for m in head.data.materials])

img = None
for m in head.data.materials:
    if not m or not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            img = n.image
            print("tex", img.name, tuple(img.size))

if not img:
    raise SystemExit("no image")

# Ensure pixels loaded
img.pixels[0]
w, h = img.size
pixels = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)

# Find reddish smile pixels (not skin): high R, low G/B relative
r, g, b = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
mask = (r > 0.45) & (r > g * 1.25) & (r > b * 1.25) & (g < 0.45)
ys, xs = np.where(mask)
print("red pixels", len(xs))
if len(xs) == 0:
    # looser
    mask = (r > 0.35) & ((r - g) > 0.12) & ((r - b) > 0.12)
    ys, xs = np.where(mask)
    print("red pixels loose", len(xs))

if len(xs):
    # Focus on lower-mid face of atlas — print bbox in UV
    u0, u1 = xs.min() / w, xs.max() / w
    v0, v1 = ys.min() / h, ys.max() / h
    print("uv bbox", round(u0, 3), round(u1, 3), round(v0, 3), round(v1, 3))
    # centroid of reddest cluster
    score = r[ys, xs] - 0.5 * (g[ys, xs] + b[ys, xs])
    # take top scoring pixels
    top = np.argsort(score)[-max(20, len(score) // 20) :]
    cu = xs[top].mean() / w
    cv = ys[top].mean() / h
    print("uv centroid", round(cu, 3), round(cv, 3))

    # Map UV to mesh: find faces with UV near centroid, average world pos
    uv_layer = head.data.uv_layers.active
    mw = head.matrix_world
    hits = []
    for poly in head.data.polygons:
        uvs = [uv_layer.data[li].uv for li in poly.loop_indices]
        cu_p = sum(u.x for u in uvs) / len(uvs)
        cv_p = sum(u.y for u in uvs) / len(uvs)
        if abs(cu_p - cu) < 0.03 and abs(cv_p - cv) < 0.03:
            acc = Vector((0, 0, 0))
            for i in poly.vertices:
                acc += mw @ head.data.vertices[i].co
            hits.append(acc / len(poly.vertices))
    print("hit faces", len(hits))
    if hits:
        p = Vector((0, 0, 0))
        for h in hits:
            p += h
        p /= len(hits)
        print("smile world", tuple(round(c, 4) for c in p))

    # Also: project each front vert's UV and score by redness
    # Need loop UV average per vertex (approx)
    from collections import defaultdict
    v_uvs = defaultdict(list)
    for li, loop in enumerate(head.data.loops):
        uv = uv_layer.data[li].uv
        v_uvs[loop.vertex_index].append((uv.x, uv.y))
    best = None
    best_score = -1
    for vi, uvs in v_uvs.items():
        u = sum(x for x, _ in uvs) / len(uvs)
        v = sum(y for _, y in uvs) / len(uvs)
        px = min(w - 1, max(0, int(u * (w - 1))))
        py = min(h - 1, max(0, int(v * (h - 1))))
        pr, pg, pb = float(r[py, px]), float(g[py, px]), float(b[py, px])
        score = pr - 0.5 * (pg + pb)
        wp = mw @ head.data.vertices[vi].co
        # Prefer front of face
        if wp.y > -0.2:
            continue
        if score > best_score and pr > 0.4:
            best_score = score
            best = (wp, u, v, pr, pg, pb)
    if best:
        wp, u, v, pr, pg, pb = best
        print(
            "reddest front vert",
            tuple(round(c, 4) for c in wp),
            "uv",
            round(u, 3),
            round(v, 3),
            "rgb",
            round(pr, 2),
            round(pg, 2),
            round(pb, 2),
        )
