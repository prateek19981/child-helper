"""Backward-compatible re-exports. Prefer app.services.stt / scoring / media. """

from app.services.media import audio_suffix as _audio_suffix
from app.services.media import save_audio
from app.services.scoring import (
    ScoreResult,
    ScoringProvider,
    StubScoringProvider,
    build_scoring_provider,
    scoring_provider,
)
from app.services.stt import (
    FasterWhisperSttProvider,
    StubSttProvider,
    SttProvider,
    SttResult,
    build_stt_provider,
    stt_provider,
)

__all__ = [
    "FasterWhisperSttProvider",
    "ScoreResult",
    "ScoringProvider",
    "StubScoringProvider",
    "StubSttProvider",
    "SttProvider",
    "SttResult",
    "_audio_suffix",
    "build_scoring_provider",
    "build_stt_provider",
    "save_audio",
    "scoring_provider",
    "stt_provider",
]
