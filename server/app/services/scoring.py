from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from hashlib import md5

from app.core.config import settings


@dataclass
class ScoreResult:
    overall: Decimal
    accuracy: Decimal
    fluency: Decimal
    completeness: Decimal
    phonemes: list[tuple[str, str, Decimal, int]]
    feedback: str
    provider: str = "stub"


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
            feedback="Great effort! Keep practicing with Kick.",
            provider="stub",
        )


def build_scoring_provider() -> ScoringProvider:
    name = (getattr(settings, "scoring_provider", None) or "stub").strip().lower()
    if name in {"stub", "none", "off"}:
        return StubScoringProvider()
    return StubScoringProvider()


scoring_provider: ScoringProvider = build_scoring_provider()
