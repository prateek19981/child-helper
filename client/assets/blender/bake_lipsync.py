"""
Bake James's lip-sync shape keys from a voice clip and put the clip on the timeline.

  blender --background --python bake_lipsync.py -- james2.blend voice.wav

Needs the shape keys from add_lipsync_mouth.py. Loud frames open the
mouth, bright sounds (EE, S) lean on mouth_wide, dark sounds (OO, OH)
lean on mouth_round, and quiet frames close it (M, B, P). Any format
Blender can play works (wav, mp3, ogg, flac).
"""
from __future__ import annotations

import sys
from pathlib import Path

import aud
import bpy
import numpy as np

DIR = Path(__file__).resolve().parent
CARD = "h_Geo"
STRIP = "LipSyncVoice"
ACTION = "LipSync"
# Mouth shapes read better when they land a frame before the sound.
LEAD_FRAMES = 1
TAIL_FRAMES = 6


def resolve(arg: str) -> Path:
    p = Path(arg)
    if p.is_absolute():
        return p
    return p if p.exists() else DIR / p


def load_mono(path: Path):
    sound = aud.Sound(str(path))
    rate = int(sound.specs[0])
    data = np.asarray(sound.data(), dtype=np.float32)
    if data.ndim == 2:
        data = data.mean(axis=1)
    return data, rate


def analyse(samples, rate, fps):
    n_frames = int(np.ceil(len(samples) / rate * fps))
    hop = rate / fps
    win = int(hop * 2)
    window = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1.0 / rate)
    band = (freqs > 80) & (freqs < 8000)

    loud = np.zeros(n_frames)
    bright = np.zeros(n_frames)
    for f in range(n_frames):
        start = max(0, int((f + LEAD_FRAMES) * hop + hop / 2 - win / 2))
        seg = samples[start : start + win]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        loud[f] = np.sqrt(np.mean(seg**2))
        mag = np.abs(np.fft.rfft(seg * window))[band]
        if mag.sum() > 1e-9:
            bright[f] = (freqs[band] * mag).sum() / mag.sum()

    voiced = loud[loud > 1e-5]
    ref = np.percentile(voiced, 95) if len(voiced) else 1.0
    level = np.clip(loud / max(ref, 1e-6), 0.0, 1.0)
    level = np.clip((level - 0.1) / 0.9, 0.0, 1.0)

    smooth = np.zeros(n_frames)
    for f in range(n_frames):
        prev = smooth[f - 1] if f else 0.0
        rate_ = 0.75 if level[f] > prev else 0.5
        smooth[f] = prev + (level[f] - prev) * rate_
    # Deepen the dips between syllables so the mouth doesn't hang open mid-sentence.
    peak = np.array([smooth[max(0, f - 4) : f + 5].max() for f in range(n_frames)])
    contrast = smooth / np.maximum(peak, 1e-3)
    openness = (smooth * (0.4 + 0.6 * contrast**2)) ** 0.8

    # Compare each frame against this voice's own range, so kid and adult voices both work.
    spoken = bright[level > 0.2]
    if len(spoken) < 4:
        spoken = bright
    lo, mid_lo, mid_hi, hi = np.percentile(spoken, [8, 30, 70, 95])
    wide = np.clip((bright - mid_hi) / max(hi - mid_hi, 1.0), 0.0, 1.0) * 0.85
    rnd = np.clip((mid_lo - bright) / max(mid_lo - lo, 1.0), 0.0, 1.0) * 0.8
    curves = {
        "mouth_open": openness * (1.0 - 0.6 * wide - 0.5 * rnd),
        "mouth_wide": openness * wide,
        "mouth_round": openness * rnd,
    }
    return n_frames, curves


def bake(key, curves, start, n_frames):
    key.animation_data_clear()
    blocks = key.key_blocks
    for f in range(n_frames + TAIL_FRAMES):
        for name, values in curves.items():
            kb = blocks[name]
            kb.value = float(values[f]) if f < n_frames else 0.0
            kb.keyframe_insert("value", frame=start + f)
    key.animation_data.action.name = ACTION


def add_voice(scene, path: Path, start: int):
    se = scene.sequence_editor or scene.sequence_editor_create()
    strips = se.strips if hasattr(se, "strips") else se.sequences
    for s in list(strips):
        if s.name.startswith(STRIP):
            strips.remove(s)
    strip = strips.new_sound(STRIP, str(path), 1, start)
    strip.sound.filepath = bpy.path.relpath(str(path))
    try:
        scene.sync_mode = "AUDIO_SYNC"
    except Exception:
        pass


def main():
    extra = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(extra) < 2:
        raise SystemExit("usage: blender --background --python bake_lipsync.py -- <file.blend> <voice.wav>")
    blend, voice = resolve(extra[0]), resolve(extra[1])

    bpy.ops.wm.open_mainfile(filepath=str(blend))
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    scene = bpy.context.scene
    key = bpy.data.objects[CARD].data.shape_keys
    if key is None or "mouth_open" not in key.key_blocks:
        raise SystemExit("run add_lipsync_mouth.py first")

    samples, rate = load_mono(voice)
    fps = scene.render.fps / scene.render.fps_base
    n_frames, curves = analyse(samples, rate, fps)
    start = scene.frame_start
    bake(key, curves, start, n_frames)
    add_voice(scene, voice, start)
    scene.frame_end = start + n_frames + TAIL_FRAMES
    print("baked %d frames (%.2fs) from %s" % (n_frames, len(samples) / rate, voice.name))
    for name, values in curves.items():
        print("  %-12s max %.2f mean %.2f" % (name, values.max(), values.mean()))

    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    print("SAVED", blend)


if __name__ == "__main__":
    main()
