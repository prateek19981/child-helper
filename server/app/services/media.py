from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.core.config import settings


def audio_suffix(raw: bytes) -> str:
    # Expo HIGH_QUALITY recordings are typically Apple M4A / AAC
    if len(raw) >= 12 and raw[4:8] == b"ftyp":
        return ".m4a"
    if raw[:4] == b"RIFF":
        return ".wav"
    if raw[:3] == b"ID3" or raw[:2] == b"\xff\xfb":
        return ".mp3"
    return ".bin"


def save_audio(raw: bytes) -> str:
    folder = Path(settings.media_dir)
    folder.mkdir(parents=True, exist_ok=True)
    key = f"{uuid4().hex}{audio_suffix(raw)}"
    (folder / key).write_bytes(raw)
    return key
