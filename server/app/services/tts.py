from __future__ import annotations

import asyncio
import io
import logging
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.core.config import settings

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24_000
# Official model blobs for kokoro-onnx (works on Python 3.14; pip `kokoro` needs <3.13)
KOKORO_MODEL_URL = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
)
KOKORO_VOICES_URL = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
)

# Short codes (Kokoro/Misaki) and aliases → kokoro-onnx lang=
_LANG_ALIASES: dict[str, str] = {
    "a": "en-us",
    "en": "en-us",
    "en-us": "en-us",
    "en_us": "en-us",
    "b": "en-gb",
    "en-gb": "en-gb",
    "en_gb": "en-gb",
    "h": "hi",
    "hi": "hi",
    "hi-in": "hi",
    "hindi": "hi",
    "e": "es",
    "es": "es",
    "f": "fr-fr",
    "fr": "fr-fr",
    "fr-fr": "fr-fr",
    "i": "it",
    "it": "it",
    "j": "ja",
    "ja": "ja",
    "p": "pt-br",
    "pt": "pt-br",
    "pt-br": "pt-br",
    "z": "cmn",
    "cmn": "cmn",
    "zh": "cmn",
}

# Voice prefix → lang when KOKORO_LANG is empty / auto
_VOICE_PREFIX_LANG: dict[str, str] = {
    "af": "en-us",
    "am": "en-us",
    "bf": "en-gb",
    "bm": "en-gb",
    "hf": "hi",
    "hm": "hi",
    "ef": "es",
    "em": "es",
    "ff": "fr-fr",
    "if": "it",
    "im": "it",
    "jf": "ja",
    "jm": "ja",
    "pf": "pt-br",
    "pm": "pt-br",
    "zf": "cmn",
    "zm": "cmn",
}


def resolve_kokoro_lang(configured: str | None, voice: str) -> str:
    """Map KOKORO_LANG / voice prefix to a kokoro-onnx language id."""
    raw = (configured or "").strip().lower()
    if raw and raw not in {"auto", "from_voice"}:
        if raw in _LANG_ALIASES:
            return _LANG_ALIASES[raw]
        return raw
    prefix = (voice or "").strip().lower()[:2]
    return _VOICE_PREFIX_LANG.get(prefix, "en-us")


@dataclass
class TtsResult:
    audio: bytes
    content_type: str
    provider: str
    voice: str
    sample_rate: int
    fallback: bool = False


class TtsProvider:
    async def synthesize(self, text: str, *, voice: str | None = None) -> TtsResult:
        raise NotImplementedError


class StubTtsProvider(TtsProvider):
    """No neural TTS — client should fall back to expo-speech."""

    async def synthesize(self, text: str, *, voice: str | None = None) -> TtsResult:
        return TtsResult(
            audio=b"",
            content_type="audio/wav",
            provider="stub",
            voice=voice or "none",
            sample_rate=SAMPLE_RATE,
            fallback=True,
        )


class KokoroTtsProvider(TtsProvider):
    """Kokoro-82M via ONNX. Voices: af_heart (EN), hf_alpha (HI), bf_emma (GB), …"""

    def __init__(self) -> None:
        self._kokoro = None
        self._model_dir = Path(settings.kokoro_model_dir)

    def _ensure_files(self) -> tuple[Path, Path]:
        self._model_dir.mkdir(parents=True, exist_ok=True)
        model = self._model_dir / "kokoro-v1.0.onnx"
        voices = self._model_dir / "voices-v1.0.bin"
        if not model.exists():
            logger.info("Downloading Kokoro ONNX model to %s", model)
            urllib.request.urlretrieve(KOKORO_MODEL_URL, model)
        if not voices.exists():
            logger.info("Downloading Kokoro voices to %s", voices)
            urllib.request.urlretrieve(KOKORO_VOICES_URL, voices)
        return model, voices

    def _get_kokoro(self):
        if self._kokoro is None:
            from kokoro_onnx import Kokoro

            model, voices = self._ensure_files()
            self._kokoro = Kokoro(str(model), str(voices))
        return self._kokoro

    def _synthesize_sync(self, text: str, voice: str, lang: str) -> bytes:
        import numpy as np
        import soundfile as sf

        kokoro = self._get_kokoro()
        speed = float(settings.tts_speed or 1.0)
        samples, sample_rate = kokoro.create(text, voice=voice, speed=speed, lang=lang)
        waveform = np.asarray(samples, dtype=np.float32)
        buf = io.BytesIO()
        sf.write(buf, waveform, int(sample_rate), format="WAV", subtype="PCM_16")
        return buf.getvalue()

    async def synthesize(self, text: str, *, voice: str | None = None) -> TtsResult:
        cleaned = (text or "").strip()
        if not cleaned:
            raise ValueError("empty TTS text")
        voice_id = (voice or settings.kokoro_voice or "af_heart").strip()
        lang = resolve_kokoro_lang(settings.kokoro_lang, voice_id)
        audio = await asyncio.to_thread(self._synthesize_sync, cleaned, voice_id, lang)
        return TtsResult(
            audio=audio,
            content_type="audio/wav",
            provider="kokoro",
            voice=voice_id,
            sample_rate=SAMPLE_RATE,
            fallback=False,
        )


def save_tts_audio(raw: bytes, *, suffix: str = ".wav") -> str:
    folder = Path(settings.media_dir)
    folder.mkdir(parents=True, exist_ok=True)
    key = f"tts_{uuid4().hex}{suffix}"
    (folder / key).write_bytes(raw)
    return key


def build_tts_provider() -> TtsProvider:
    name = (settings.tts_provider or "stub").strip().lower()
    if name in {"stub", "none", "off", "expo"}:
        return StubTtsProvider()
    if name == "kokoro":
        try:
            import kokoro_onnx  # noqa: F401

            return KokoroTtsProvider()
        except Exception:
            logger.exception("Kokoro unavailable; TTS falling back to stub (expo-speech)")
            return StubTtsProvider()
    logger.warning("Unknown TTS_PROVIDER=%s; using stub", name)
    return StubTtsProvider()


tts_provider: TtsProvider = build_tts_provider()
