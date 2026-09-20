from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import get_active_user, owned_child
from app.models import (
    AIFeedback,
    Attempt,
    Child,
    ChildDailyStat,
    ChildStatus,
    Conversation,
    ConversationMessage,
    Lesson,
    LessonWord,
    PhonemeScore,
    PronunciationScore,
    Reward,
    SenderType,
    TalkQuestion,
    User,
    Word,
)
from app.seed import ensure_talk_questions
from app.services.speech import save_audio, scoring_provider, stt_provider

router = APIRouter(tags=["domain"])

PARENT_TIPS = [
    {
        "id": "playful",
        "title": "Make practice playful",
        "body": "Turn tricky words into a silly song or a family guessing game.",
        "read_minutes": 2,
    },
    {
        "id": "listen",
        "title": "Listen before correcting",
        "body": "Celebrate the effort first, then model the sound slowly and clearly.",
        "read_minutes": 3,
    },
    {
        "id": "routine",
        "title": "Build a tiny routine",
        "body": "Five calm minutes after story time can create lasting progress.",
        "read_minutes": 2,
    },
]


class ChildIn(BaseModel):
    display_name: str
    avatar_url: str | None = None
    age_band: str | None = None
    language: str = "en"


class ChildPatch(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    age_band: str | None = None
    language: str | None = None
    status: ChildStatus | None = None


class ConversationIn(BaseModel):
    child_id: UUID
    title: str | None = None
    context: str | None = None


class MessageIn(BaseModel):
    sender_type: SenderType
    text_content: str | None = None
    audio_b64: str | None = None
    audio_duration_ms: int | None = None


class ChildReplyIn(BaseModel):
    audio_b64: str | None = None
    audio_duration_ms: int | None = None
    text_content: str | None = None
    # Client-side metering: False = silence → always retry
    heard_speech: bool | None = None


def _reply_accepted(text: str | None, heard_speech: bool | None) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 2:
        return False
    # Explicit silence from client must never advance
    if heard_speech is False:
        return False
    return True


class AttemptIn(BaseModel):
    child_id: UUID
    word_id: UUID
    conversation_message_id: UUID | None = None
    target_text: str
    audio_b64: str | None = None
    audio_duration_ms: int | None = None


def child_out(c: Child) -> dict:
    return {
        "id": str(c.id),
        "parent_id": str(c.parent_id),
        "display_name": c.display_name,
        "avatar_url": c.avatar_url,
        "age_band": c.age_band,
        "language": c.language,
        "status": c.status.value,
    }


@router.get("/children")
async def list_children(user: User = Depends(get_active_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Child).where(Child.parent_id == user.id))).all()
    return [child_out(c) for c in rows]


@router.post("/children")
async def create_child(body: ChildIn, user: User = Depends(get_active_user), db: AsyncSession = Depends(get_db)):
    child = Child(parent_id=user.id, **body.model_dump())
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child_out(child)


@router.patch("/children/{child_id}")
async def patch_child(body: ChildPatch, child: Child = Depends(owned_child), db: AsyncSession = Depends(get_db)):
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(child, k, v)
    await db.commit()
    await db.refresh(child)
    return child_out(child)


@router.get("/lessons")
async def list_lessons(db: AsyncSession = Depends(get_db), user: User = Depends(get_active_user)):
    lessons = (await db.scalars(select(Lesson).where(Lesson.is_active.is_(True)))).all()
    return [
        {
            "id": str(l.id),
            "title": l.title,
            "description": l.description,
            "difficulty": l.difficulty,
            "estimated_minutes": l.estimated_minutes,
            "slug": l.slug,
        }
        for l in lessons
    ]


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_active_user)):
    lesson = await db.scalar(
        select(Lesson)
        .where(Lesson.id == lesson_id)
        .options(selectinload(Lesson.lesson_words).selectinload(LessonWord.word).selectinload(Word.word_sounds))
    )
    if lesson is None:
        raise HTTPException(404, "Lesson not found")
    words = sorted(lesson.lesson_words, key=lambda lw: lw.sequence_number)
    return {
        "id": str(lesson.id),
        "title": lesson.title,
        "description": lesson.description,
        "difficulty": lesson.difficulty,
        "estimated_minutes": lesson.estimated_minutes,
        "slug": lesson.slug,
        "words": [
            {
                "id": str(lw.word.id),
                "word": lw.word.word,
                "language": lw.word.language,
                "difficulty": lw.word.difficulty,
                "image_url": lw.word.image_url,
                "sequence_number": lw.sequence_number,
            }
            for lw in words
        ],
    }


@router.get("/lessons/{lesson_id}/talk-script")
async def talk_script(lesson_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_active_user)):
    lesson = await db.get(Lesson, lesson_id)
    if lesson is None or not lesson.is_active:
        raise HTTPException(404, "Lesson not found")

    rows = (
        await db.scalars(
            select(TalkQuestion)
            .where(
                TalkQuestion.lesson_id == lesson.id,
                TalkQuestion.is_active.is_(True),
            )
            .order_by(TalkQuestion.sequence_number)
        )
    ).all()

    # Existing DBs / new lessons: auto-seed defaults once
    if not rows:
        await ensure_talk_questions(db, lesson.id)
        await db.commit()
        rows = (
            await db.scalars(
                select(TalkQuestion)
                .where(
                    TalkQuestion.lesson_id == lesson.id,
                    TalkQuestion.is_active.is_(True),
                )
                .order_by(TalkQuestion.sequence_number)
            )
        ).all()

    return {
        "lesson_id": str(lesson.id),
        "title": lesson.title,
        "questions": [
            {
                "id": str(q.id),
                "prompt": q.prompt,
                "retry": q.retry_prompt,
            }
            for q in rows
        ],
    }


@router.get("/children/{child_id}/home")
async def home(child: Child = Depends(owned_child), db: AsyncSession = Depends(get_db)):
    lessons = (await db.scalars(select(Lesson).where(Lesson.is_active.is_(True)).order_by(Lesson.title))).all()
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    stats = (
        await db.scalars(
            select(ChildDailyStat).where(ChildDailyStat.child_id == child.id, ChildDailyStat.stat_date >= week_start)
        )
    ).all()
    streak = max((s.streak_days for s in stats), default=0)
    stars = await db.scalar(select(func.count()).select_from(Reward).where(Reward.child_id == child.id))
    continue_lesson = next((l for l in lessons if l.slug == "meet-koober"), lessons[0] if lessons else None)
    games = [l for l in lessons if l.slug != "meet-koober"]
    return {
        "child": child_out(child),
        "greeting": f"Good morning, {child.display_name}!",
        "headline": "Ready to speak?",
        "streak_days": streak,
        "stars": int(stars or 0),
        "continue_lesson": None
        if continue_lesson is None
        else {
            "id": str(continue_lesson.id),
            "title": continue_lesson.title,
            "description": continue_lesson.description,
            "estimated_minutes": continue_lesson.estimated_minutes,
            "slug": continue_lesson.slug,
            "index": 1,
            "total": len(lessons) or 1,
        },
        "games": [
            {
                "id": str(l.id),
                "title": l.title,
                "description": l.description,
                "slug": l.slug,
            }
            for l in games
        ],
    }


@router.get("/children/{child_id}/activity")
async def activity(child: Child = Depends(owned_child), db: AsyncSession = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    stats = (
        await db.scalars(
            select(ChildDailyStat).where(ChildDailyStat.child_id == child.id, ChildDailyStat.stat_date >= week_start)
        )
    ).all()
    by_day = {s.stat_date: s for s in stats}
    days = []
    words = minutes = 0
    accs: list[Decimal] = []
    streak = 0
    for i in range(7):
        d = week_start + timedelta(days=i)
        s = by_day.get(d)
        minutes_val = s.minutes if s else 0
        days.append({"label": d.strftime("%a")[0], "minutes": minutes_val, "date": d.isoformat()})
        if s:
            words += s.words_practiced
            minutes += s.minutes
            accs.append(s.accuracy_pct)
            streak = max(streak, s.streak_days)
    accuracy = int(sum(accs) / len(accs)) if accs else 0

    attempts = (
        await db.scalars(
            select(Attempt)
            .where(Attempt.child_id == child.id)
            .options(selectinload(Attempt.word), selectinload(Attempt.pronunciation_scores))
            .order_by(Attempt.created_at.desc())
            .limit(20)
        )
    ).all()

    # collapse to lesson-like history using word text
    history = []
    for a in attempts[:8]:
        score = a.pronunciation_scores[0].overall_score if a.pronunciation_scores else None
        history.append(
            {
                "id": str(a.id),
                "title": a.word.word if a.word else a.target_text,
                "subtitle": a.target_text,
                "when": a.created_at.date().isoformat(),
                "score_label": f"{int(score)}%" if score is not None else "Great!",
                "score": float(score) if score is not None else None,
            }
        )

    return {
        "child": child_out(child),
        "week": {
            "words_practiced": words,
            "streak_days": streak,
            "minutes": minutes,
            "accuracy_pct": accuracy,
            "days": days,
        },
        "history": history,
    }


@router.get("/children/{child_id}/parent-hub")
async def parent_hub(child: Child = Depends(owned_child), db: AsyncSession = Depends(get_db)):
    act = await activity(child, db)
    words = act["week"]["words_practiced"]
    return {
        "child": child_out(child),
        "headline": "Confidence is blooming 🌸",
        "summary": f"She practiced {words} words and improved 3 tricky sounds.",
        "week_label": f"{child.display_name}'s week",
        "tips": PARENT_TIPS,
        "week": act["week"],
    }


@router.post("/conversations")
async def create_conversation(
    body: ConversationIn, user: User = Depends(get_active_user), db: AsyncSession = Depends(get_db)
):
    child = await db.get(Child, body.child_id)
    if child is None or child.parent_id != user.id:
        raise HTTPException(404, "Child not found")
    conv = Conversation(child_id=child.id, title=body.title, context=body.context)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"id": str(conv.id), "child_id": str(conv.child_id), "title": conv.title}


@router.post("/conversations/{conversation_id}/messages")
async def add_message(
    conversation_id: UUID,
    body: MessageIn,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "Conversation not found")
    child = await db.get(Child, conv.child_id)
    if child is None or child.parent_id != user.id:
        raise HTTPException(404, "Conversation not found")
    seq = await db.scalar(
        select(func.coalesce(func.max(ConversationMessage.sequence_number), 0)).where(
            ConversationMessage.conversation_id == conv.id
        )
    )
    audio_key = None
    transcription = None
    stt_p = stt_m = None
    audio_bytes = None
    if body.audio_b64:
        import base64

        audio_bytes = base64.b64decode(body.audio_b64)
        audio_key = save_audio(audio_bytes)
    if body.audio_b64 or body.text_content:
        stt = await stt_provider.transcribe(audio_bytes, body.text_content)
        transcription = stt.text
        stt_p, stt_m = stt.provider, stt.model
    msg = ConversationMessage(
        conversation_id=conv.id,
        sender_type=body.sender_type,
        sequence_number=int(seq) + 1,
        text_content=body.text_content,
        transcription=transcription,
        audio_storage_key=audio_key,
        audio_duration_ms=body.audio_duration_ms,
        stt_provider=stt_p,
        stt_model=stt_m,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {
        "id": str(msg.id),
        "sequence_number": msg.sequence_number,
        "text_content": msg.text_content,
        "transcription": msg.transcription,
        "stt_provider": msg.stt_provider,
    }


@router.post("/conversations/{conversation_id}/child-reply")
async def child_reply(
    conversation_id: UUID,
    body: ChildReplyIn,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "Conversation not found")
    child = await db.get(Child, conv.child_id)
    if child is None or child.parent_id != user.id:
        raise HTTPException(404, "Conversation not found")

    seq = await db.scalar(
        select(func.coalesce(func.max(ConversationMessage.sequence_number), 0)).where(
            ConversationMessage.conversation_id == conv.id
        )
    )

    audio_key = None
    audio_bytes = None
    if body.audio_b64:
        import base64

        audio_bytes = base64.b64decode(body.audio_b64)
        audio_key = save_audio(audio_bytes)

    explicit_text = (body.text_content or "").strip()
    # Silence / no speech → empty transcript so the client retries
    if body.heard_speech is False and not explicit_text:
        transcription = ""
        stt_p, stt_m = "stub", "stub-v1"
    elif explicit_text:
        stt = await stt_provider.transcribe(audio_bytes, explicit_text)
        transcription = stt.text
        stt_p, stt_m = stt.provider, stt.model
    elif body.heard_speech is True:
        # Stub until real STT: client metering detected speech
        transcription = "I'm good"
        stt_p, stt_m = "stub", "stub-v1"
    else:
        stt = await stt_provider.transcribe(audio_bytes, None)
        transcription = stt.text
        stt_p, stt_m = stt.provider, stt.model

    msg = ConversationMessage(
        conversation_id=conv.id,
        sender_type=SenderType.child,
        sequence_number=int(seq) + 1,
        text_content=body.text_content,
        transcription=transcription,
        audio_storage_key=audio_key,
        audio_duration_ms=body.audio_duration_ms,
        stt_provider=stt_p,
        stt_model=stt_m,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    accepted = _reply_accepted(transcription, body.heard_speech)
    return {
        "id": str(msg.id),
        "transcription": transcription,
        "accepted": accepted,
        "action": "advance" if accepted else "retry",
    }


@router.post("/attempts")
async def create_attempt(body: AttemptIn, user: User = Depends(get_active_user), db: AsyncSession = Depends(get_db)):
    child = await db.get(Child, body.child_id)
    if child is None or child.parent_id != user.id:
        raise HTTPException(404, "Child not found")
    word = await db.get(Word, body.word_id)
    if word is None:
        raise HTTPException(404, "Word not found")
    audio_key = None
    if body.audio_b64:
        import base64

        audio_key = save_audio(base64.b64decode(body.audio_b64))
    stt = await stt_provider.transcribe(None, body.target_text)
    scored = await scoring_provider.score(body.target_text, stt.text)
    attempt = Attempt(
        child_id=child.id,
        word_id=word.id,
        conversation_message_id=body.conversation_message_id,
        target_text=body.target_text,
        speech_to_text=stt.text,
        audio_storage_key=audio_key,
        audio_duration_ms=body.audio_duration_ms,
    )
    db.add(attempt)
    await db.flush()
    ps = PronunciationScore(
        attempt_id=attempt.id,
        provider="stub",
        model="stub-v1",
        overall_score=scored.overall,
        accuracy_score=scored.accuracy,
        fluency_score=scored.fluency,
        completeness_score=scored.completeness,
    )
    db.add(ps)
    await db.flush()
    for expected, detected, score, pos in scored.phonemes:
        db.add(
            PhonemeScore(
                pronunciation_score_id=ps.id,
                expected_phoneme=expected,
                detected_phoneme=detected,
                score=score,
                position=pos,
            )
        )
    db.add(
        AIFeedback(
            attempt_id=attempt.id,
            model="stub-v1",
            feedback_text=scored.feedback,
            feedback_type="encouragement",
        )
    )
    await db.commit()
    await db.refresh(attempt)
    return {
        "id": str(attempt.id),
        "speech_to_text": attempt.speech_to_text,
        "overall_score": float(scored.overall),
        "feedback": scored.feedback,
    }
