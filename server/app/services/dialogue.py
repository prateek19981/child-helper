from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

import httpx

from app.content.prompts import RETRY_PROMPT, STUB_FOLLOWUPS, SYSTEM_PROMPT, WRAP_UP_PROMPT
from app.core.config import settings

logger = logging.getLogger(__name__)

# Re-export for callers that still import prompts from dialogue.
__all__ = [
    "DialogueProvider",
    "DialogueTurn",
    "GroqDialogueProvider",
    "HistoryMessage",
    "RETRY_PROMPT",
    "STUB_FOLLOWUPS",
    "SYSTEM_PROMPT",
    "StubDialogueProvider",
    "WRAP_UP_PROMPT",
    "build_dialogue_provider",
    "dialogue_provider",
]


@dataclass
class DialogueTurn:
    text: str
    done: bool


@dataclass
class HistoryMessage:
    role: str  # "mascot" | "child"
    text: str


class DialogueProvider:
    async def next_turn(
        self,
        messages: list[HistoryMessage],
        *,
        lesson_title: str,
        max_turns: int,
        child_turn_count: int,
    ) -> DialogueTurn:
        raise NotImplementedError


class StubDialogueProvider(DialogueProvider):
    async def next_turn(
        self,
        messages: list[HistoryMessage],
        *,
        lesson_title: str,
        max_turns: int,
        child_turn_count: int,
    ) -> DialogueTurn:
        if child_turn_count >= max_turns:
            return DialogueTurn(text=WRAP_UP_PROMPT, done=True)
        idx = max(0, child_turn_count - 1) % len(STUB_FOLLOWUPS)
        return DialogueTurn(text=STUB_FOLLOWUPS[idx], done=False)


class GroqDialogueProvider(DialogueProvider):
    def __init__(self) -> None:
        self._fallback = StubDialogueProvider()

    async def next_turn(
        self,
        messages: list[HistoryMessage],
        *,
        lesson_title: str,
        max_turns: int,
        child_turn_count: int,
    ) -> DialogueTurn:
        # Hard wrap-up is owned by the server — do not rely on the model for "done".
        if child_turn_count >= max_turns:
            return DialogueTurn(text=WRAP_UP_PROMPT, done=True)

        if not settings.groq_api_key.strip():
            logger.warning("GROQ_API_KEY missing; using stub dialogue")
            return await self._fallback.next_turn(
                messages,
                lesson_title=lesson_title,
                max_turns=max_turns,
                child_turn_count=child_turn_count,
            )

        chat_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Lesson: {lesson_title or 'Speaking warm-up for Math Puzzles'}\n"
                    f"Child turns so far: {child_turn_count} of {max_turns}.\n"
                    "Build a deeper conversation: react to their last message, ask one follow-up "
                    "that goes further (not a brand-new topic), and only invite Math Puzzles "
                    "when you already know something real about them.\n"
                    f"Conversation:\n{_format_history(messages)}\n\n"
                    "Write Kick's next spoken line only."
                ),
            },
        ]

        try:
            async with httpx.AsyncClient(
                timeout=settings.llm_timeout_seconds,
                verify=settings.llm_ssl_verify,
            ) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.groq_model,
                        "messages": chat_messages,
                        "temperature": 0.7,
                        "max_tokens": 256,
                    },
                )
                if resp.status_code >= 400:
                    logger.error(
                        "Groq HTTP %s model=%s body=%s",
                        resp.status_code,
                        settings.groq_model,
                        resp.text[:500],
                    )
                resp.raise_for_status()
                data = resp.json()
            message = data["choices"][0]["message"]
            content = (message.get("content") or "").strip()
            # Some gpt-oss responses put text only in reasoning; prefer content.
            if not content:
                content = (message.get("reasoning") or "").strip()
            text = _parse_spoken_line(content)
            if not text:
                raise ValueError("empty reply from Groq")
            logger.info("Groq dialogue ok (%d chars)", len(text))
            return DialogueTurn(text=text, done=False)
        except Exception:
            logger.exception("Groq dialogue failed; falling back to stub")
            return await self._fallback.next_turn(
                messages,
                lesson_title=lesson_title,
                max_turns=max_turns,
                child_turn_count=child_turn_count,
            )


def _format_history(messages: list[HistoryMessage]) -> str:
    lines: list[str] = []
    for m in messages[-12:]:
        who = "Kick" if m.role == "mascot" else "Child"
        lines.append(f"{who}: {m.text}")
    return "\n".join(lines) if lines else "(no prior messages)"


def _parse_spoken_line(content: str) -> str:
    """Accept plain speech, or legacy JSON {\"reply\": \"...\"} if the model returns it."""
    cleaned = content.strip()
    if not cleaned:
        return ""
    if cleaned.startswith("{"):
        try:
            data = json.loads(cleaned)
            cleaned = str(data.get("reply") or data.get("text") or "").strip()
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group(0))
                    cleaned = str(data.get("reply") or data.get("text") or cleaned).strip()
                except json.JSONDecodeError:
                    pass
    # Drop accidental wrapping quotes
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in "\"'":
        cleaned = cleaned[1:-1].strip()
    return cleaned[:280]


def build_dialogue_provider() -> DialogueProvider:
    name = (settings.llm_provider or "stub").strip().lower()
    if name == "groq":
        return GroqDialogueProvider()
    return StubDialogueProvider()


dialogue_provider: DialogueProvider = build_dialogue_provider()
