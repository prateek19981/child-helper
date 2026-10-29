from __future__ import annotations

import base64
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.prompts import RETRY_PROMPT
from app.core.config import settings
from app.models import Child, Conversation, ConversationMessage, Lesson, SenderType, User
from app.services.dialogue import DialogueProvider, HistoryMessage
from app.services.media import save_audio
from app.services.progress import current_streak, record_speaking_day
from app.services.stt import SttProvider


def reply_accepted(text: str | None, heard_speech: bool | None) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 2:
        return False
    if heard_speech is False:
        return False
    return True


async def lesson_title_from_context(db: AsyncSession, context: str | None) -> str:
    raw = (context or "").strip()
    if not raw.startswith("lesson:"):
        return "Speaking practice"
    try:
        lesson_id = UUID(raw.removeprefix("lesson:").strip())
    except ValueError:
        return "Speaking practice"
    lesson = await db.get(Lesson, lesson_id)
    return lesson.title if lesson else "Speaking practice"


async def owned_conversation(
    db: AsyncSession,
    conversation_id: UUID,
    user: User,
) -> tuple[Conversation, Child]:
    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "Conversation not found")
    child = await db.get(Child, conv.child_id)
    if child is None or child.parent_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return conv, child


async def end_talk_session(
    db: AsyncSession,
    *,
    conversation_id: UUID,
    user: User,
) -> dict:
    conv, child = await owned_conversation(db, conversation_id, user)

    child_turn_count = int(
        await db.scalar(
            select(func.count())
            .select_from(ConversationMessage)
            .where(
                ConversationMessage.conversation_id == conv.id,
                ConversationMessage.sender_type == SenderType.child,
            )
        )
        or 0
    )

    streak_days = await current_streak(db, child.id)
    stars_earned = 0
    recorded = False
    if child_turn_count > 0:
        progress = await record_speaking_day(
            db,
            child.id,
            minutes=max(1, min(5, child_turn_count)),
            words=max(1, child_turn_count),
        )
        streak_days = progress.streak_days
        stars_earned = progress.stars_earned
        recorded = True
        await db.commit()

    return {
        "conversation_id": str(conv.id),
        "recorded": recorded,
        "streak_days": streak_days,
        "stars_earned": stars_earned,
    }


async def handle_child_reply(
    db: AsyncSession,
    *,
    conversation_id: UUID,
    user: User,
    audio_b64: str | None,
    audio_duration_ms: int | None,
    text_content: str | None,
    heard_speech: bool | None,
    stt: SttProvider,
    dialogue: DialogueProvider,
) -> dict:
    conv, child = await owned_conversation(db, conversation_id, user)

    seq = await db.scalar(
        select(func.coalesce(func.max(ConversationMessage.sequence_number), 0)).where(
            ConversationMessage.conversation_id == conv.id
        )
    )

    audio_key = None
    audio_bytes = None
    if audio_b64:
        audio_bytes = base64.b64decode(audio_b64)
        audio_key = save_audio(audio_bytes)

    explicit_text = (text_content or "").strip()
    if heard_speech is False and not explicit_text:
        transcription = ""
        stt_p, stt_m = "silence", "none"
    else:
        result = await stt.transcribe(audio_bytes, explicit_text or None)
        transcription = result.text
        stt_p, stt_m = result.provider, result.model
        if heard_speech is True and not (transcription or "").strip() and not explicit_text:
            transcription = ""

    child_seq = int(seq) + 1
    msg = ConversationMessage(
        conversation_id=conv.id,
        sender_type=SenderType.child,
        sequence_number=child_seq,
        text_content=text_content,
        transcription=transcription,
        audio_storage_key=audio_key,
        audio_duration_ms=audio_duration_ms,
        stt_provider=stt_p,
        stt_model=stt_m,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    if not reply_accepted(transcription, heard_speech):
        return {
            "id": str(msg.id),
            "sequence_number": msg.sequence_number,
            "sender_type": msg.sender_type.value,
            "transcription": transcription,
            "accepted": False,
            "action": "retry",
            "next_prompt": RETRY_PROMPT,
            "done": False,
        }

    history_rows = (
        await db.scalars(
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conv.id)
            .order_by(ConversationMessage.sequence_number.asc())
        )
    ).all()
    history: list[HistoryMessage] = []
    for row in history_rows:
        if row.sender_type == SenderType.mascot:
            text = (row.text_content or "").strip()
            if text:
                history.append(HistoryMessage(role="mascot", text=text))
        else:
            text = (row.transcription or row.text_content or "").strip()
            if text:
                history.append(HistoryMessage(role="child", text=text))

    child_turn_count = sum(1 for h in history if h.role == "child")
    lesson_title = await lesson_title_from_context(db, conv.context)

    turn = await dialogue.next_turn(
        history,
        lesson_title=lesson_title,
        max_turns=settings.llm_max_turns,
        child_turn_count=child_turn_count,
    )

    mascot = ConversationMessage(
        conversation_id=conv.id,
        sender_type=SenderType.mascot,
        sequence_number=child_seq + 1,
        text_content=turn.text,
    )
    db.add(mascot)

    streak_days = await current_streak(db, child.id)
    stars_earned = 0
    if turn.done:
        progress = await record_speaking_day(
            db,
            child.id,
            minutes=5,
            words=max(1, child_turn_count),
        )
        streak_days = progress.streak_days
        stars_earned = progress.stars_earned

    await db.commit()
    await db.refresh(mascot)

    return {
        "id": str(msg.id),
        "sequence_number": msg.sequence_number,
        "sender_type": msg.sender_type.value,
        "transcription": transcription,
        "accepted": True,
        "action": "advance",
        "next_prompt": turn.text,
        "done": turn.done,
        "streak_days": streak_days,
        "stars_earned": stars_earned,
    }
