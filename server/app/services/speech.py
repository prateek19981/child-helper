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


def save_audio(raw: bytes) -> str:
    folder = Path(settings.media_dir)
    folder.mkdir(parents=True, exist_ok=True)
    key = f"{uuid4().hex}.bin"
    (folder / key).write_bytes(raw)
    return key


stt_provider: SttProvider = StubSttProvider()
scoring_provider: ScoringProvider = StubScoringProvider()
