from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass
from decimal import Decimal
from hashlib import md5
from pathlib import Path
from uuid import uuid4

from app.core.config import settings


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
        # Dev shortcut: explicit text still wins (simulate reply)
        if hint and hint.strip():
            return SttResult(text=hint.strip(), provider="faster-whisper", model=self._model_name)

        if not audio_bytes:
            return SttResult(text="", provider="faster-whisper", model=self._model_name)

        suffix = _audio_suffix(audio_bytes)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            path = tmp.name

        try:
            text = await asyncio.to_thread(self._transcribe_sync, path)
            return SttResult(text=text, provider="faster-whisper", model=self._model_name)
        finally:
            Path(path).unlink(missing_ok=True)


@dataclass
class ScoreResult:
    overall: Decimal
    accuracy: Decimal
    fluency: Decimal
    completeness: Decimal
    phonemes: list[tuple[str, str, Decimal, int]]
    feedback: str


class ScoringProvider:
    async def score(self, target: str, transcript: str) -> ScoreResult:
        raise NotImplementedError


class StubScoringProvider(ScoringProvider):
    async def score(self, target: str, transcript: str) -> ScoreResult:
        digest = md5(f"{target}:{transcript}".encode()).hexdigest()
        n = int(digest[:4], 16) % 12
        overall = Decimal(84 + n)
        if overall > 99:
            overall = Decimal("99")
        phonemes = [
            (ch, ch, overall, i) for i, ch in enumerate(target.replace(" ", "")[:4] or "a")
        ]
        return ScoreResult(
            overall=overall,
            accuracy=overall,
            fluency=overall - Decimal("2"),
            completeness=Decimal("100"),
            phonemes=phonemes,
            feedback="Great effort! Keep practicing with Koober.",
        )


def _audio_suffix(raw: bytes) -> str:
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
    key = f"{uuid4().hex}{_audio_suffix(raw)}"
    (folder / key).write_bytes(raw)
    return key


def build_stt_provider() -> SttProvider:
    name = (settings.stt_provider or "faster_whisper").strip().lower()
    if name in {"stub", "none", "off"}:
        return StubSttProvider()
    return FasterWhisperSttProvider()


stt_provider: SttProvider = build_stt_provider()
scoring_provider: ScoringProvider = StubScoringProvider()
