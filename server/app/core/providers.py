"""FastAPI dependency providers for injectable service ports."""

from __future__ import annotations

from app.services.dialogue import DialogueProvider, dialogue_provider
from app.services.email import EmailSender, email_sender
from app.services.scoring import ScoringProvider, scoring_provider
from app.services.stt import SttProvider, stt_provider
from app.services.tts import TtsProvider, tts_provider


def get_dialogue() -> DialogueProvider:
    return dialogue_provider


def get_stt() -> SttProvider:
    return stt_provider


def get_tts() -> TtsProvider:
    return tts_provider


def get_scoring() -> ScoringProvider:
    return scoring_provider


def get_email_sender() -> EmailSender:
    return email_sender
