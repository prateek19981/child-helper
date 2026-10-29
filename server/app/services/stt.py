from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings
from app.services.media import audio_suffix


@dataclass
class SttResult:
    text: str
    provider: str
    model: str


class SttProvider:
    async def transcribe(self, audio_bytes: bytes | None, hint: str | None) -> SttResult:
        raise NotImplementedError


class StubSttProvider(SttProvider):
    async def transcribe(self, audio_bytes: bytes | None, hint: str | None) -> SttResult:
        # Only trust an explicit text hint. Raw audio size is NOT speech —
        # silent recordings are still large files and must not invent replies.
        if hint and hint.strip():
            return SttResult(text=hint.strip(), provider="stub", model="stub-v1")
        return SttResult(text="", provider="stub", model="stub-v1")


class FasterWhisperSttProvider(SttProvider):
    """Local STT via faster-whisper. Needs ffmpeg on PATH for m4a/aac from Expo."""

    def __init__(self) -> None:
        self._model = None
        self._model_name = settings.stt_model

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(
                settings.stt_model,
                device=settings.stt_device,
                compute_type=settings.stt_compute_type,
            )
            self._model_name = settings.stt_model
        return self._model

    def _transcribe_sync(self, path: str) -> str:
        model = self._get_model()
        language = settings.stt_language or None
        segments, _info = model.transcribe(
            path,
            language=language,
            vad_filter=True,
            beam_size=1,
        )
        return " ".join(seg.text.strip() for seg in segments if seg.text).strip()

    async def transcribe(self, audio_bytes: bytes | None, hint: str | None) -> SttResult:
        if hint and hint.strip():
            return SttResult(text=hint.strip(), provider="faster-whisper", model=self._model_name)

        if not audio_bytes:
            return SttResult(text="", provider="faster-whisper", model=self._model_name)

        suffix = audio_suffix(audio_bytes)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            path = tmp.name

        try:
            text = await asyncio.to_thread(self._transcribe_sync, path)
            return SttResult(text=text, provider="faster-whisper", model=self._model_name)
        finally:
            Path(path).unlink(missing_ok=True)


def build_stt_provider() -> SttProvider:
    name = (settings.stt_provider or "faster_whisper").strip().lower()
    if name in {"stub", "none", "off"}:
        return StubSttProvider()
    return FasterWhisperSttProvider()


stt_provider: SttProvider = build_stt_provider()
