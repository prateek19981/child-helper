import bpy
from pathlib import Path

path = Path(__file__).resolve().parent / "new_char.blend"
bpy.ops.wm.open_mainfile(filepath=str(path))

print("=== OBJECTS ===")
for o in bpy.data.objects:
    extra = ""
    if o.type == "MESH" and o.data:
        sk = o.data.shape_keys
        if sk:
            extra = f" shape_keys={[k.name for k in sk.key_blocks]}"
        mats = [s.material.name if s.material else None for s in o.material_slots]
        extra += f" mats={mats[:6]}"
    print(f"  {o.name:40} {o.type:10} parent={o.parent.name if o.parent else None}{extra}")

print("\n=== ARMATURES / BONES (face-ish) ===")
for a in bpy.data.objects:
    if a.type != "ARMATURE":
        continue
    print("ARM", a.name, "bones", len(a.data.bones))
    for b in a.data.bones:
        n = b.name.lower()
        if any(k in n for k in ("jaw", "mouth", "lip", "chin", "face", "head", "tongue", "teeth")):
            print(f"  {b.name} parent={b.parent.name if b.parent else '-'}")

print("\n=== ACTIONS ===")
for act in bpy.data.actions:
    print(" ", act.name, "range", tuple(act.frame_range))

print("\n=== NLA ===")
for a in bpy.data.objects:
    if a.type != "ARMATURE" or not a.animation_data:
        continue
    print(a.name, "action", a.animation_data.action)
    for t in a.animation_data.nla_tracks:
        print("  track", t.name, "mute", t.mute, "strips", [s.name for s in t.strips])
