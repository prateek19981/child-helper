from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Koober, a friendly koala mascot helping young children (ages 4–8) practice speaking English.
Keep every reply warm, simple, and short: at most 1–2 sentences, ending with exactly one easy question.
Stay kid-safe: no violence, adult topics, medical or legal advice, scares, or personal data requests.
If the child says something unclear or off-topic, gently redirect to a friendly everyday topic.
This is a short warm-up before word practice — do not give long lectures start with asking children to introduce themselves if they fail then ask them to repeat after you then ask other questions.

Reply with ONLY the words Koober should say out loud. No JSON, no labels, no quotes, no markdown."""

RETRY_PROMPT = "I didn't quite catch that. Can you say it again?"

WRAP_UP_PROMPT = "You did great talking with me! Ready to practice some words next?"

STUB_FOLLOWUPS = [
    "That sounds wonderful! What else makes you happy?",
    "I love hearing that! Who do you like to play with?",
    "Awesome! What is your favorite thing to do outside?",
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
                    f"Lesson: {lesson_title or 'Speaking practice'}\n"
                    f"Child turns so far: {child_turn_count} of {max_turns} "
                    f"(keep chatting unless the child wants to stop).\n"
                    f"Conversation:\n{_format_history(messages)}\n\n"
                    "Write Koober's next spoken line only."
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
        who = "Koober" if m.role == "mascot" else "Child"
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
