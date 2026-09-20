"""Seed catalog, demo parent, Mia, stats, attempts, and talk questions."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Attempt,
    Child,
    ChildDailyStat,
    ChildStatus,
    Lesson,
    LessonWord,
    PronunciationScore,
    Reward,
    Sound,
    TalkQuestion,
    User,
    UserStatus,
    Word,
    WordSound,
)

PARENT_EMAIL = "parent@koober.dev"

DEFAULT_TALK_QUESTIONS = [
    {
        "sequence_number": 1,
        "prompt": "Hi friend! How are you today?",
        "retry_prompt": "I didn't quite catch that. How are you today?",
    },
    {
        "sequence_number": 2,
        "prompt": "What is one thing that makes you smile?",
        "retry_prompt": "Tell me one thing that makes you smile.",
    },
    {
        "sequence_number": 3,
        "prompt": "Awesome! Are you ready to practice speaking with me?",
        "retry_prompt": "Are you ready to practice speaking with Koober?",
    },
]


async def ensure_talk_questions(db: AsyncSession, lesson_id: UUID) -> int:
    """Insert default warm-up questions for a lesson if none exist. Returns rows added."""
    existing = await db.scalar(
        select(TalkQuestion.id).where(TalkQuestion.lesson_id == lesson_id).limit(1)
    )
    if existing:
        return 0
    for q in DEFAULT_TALK_QUESTIONS:
        db.add(
            TalkQuestion(
                lesson_id=lesson_id,
                sequence_number=q["sequence_number"],
                prompt=q["prompt"],
                retry_prompt=q["retry_prompt"],
                is_active=True,
            )
        )
    return len(DEFAULT_TALK_QUESTIONS)


async def seed_talk_questions_for_all_lessons() -> None:
    """Idempotent: add default talk questions to every lesson that has none."""
    async with SessionLocal() as db:
        lessons = (await db.scalars(select(Lesson))).all()
        added = 0
        for lesson in lessons:
            added += await ensure_talk_questions(db, lesson.id)
        await db.commit()
        print(f"Talk questions: added {added} row(s) across {len(lessons)} lesson(s)")


async def seed() -> None:
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == PARENT_EMAIL))
        if existing:
            print("Already seeded — ensuring talk questions exist")
            await seed_talk_questions_for_all_lessons()
            return

        parent = User(
            email=PARENT_EMAIL,
            display_name="Alex Carter",
            password_hash=hash_password("koober-dev"),
            status=UserStatus.active,
        )
        db.add(parent)
        await db.flush()

        child = Child(
            parent_id=parent.id,
            display_name="Mia",
            age_band="4-6",
            language="en",
            status=ChildStatus.active,
        )
        db.add(child)
        await db.flush()

        sounds = [
            Sound(sound_code="k", ipa="k", description="k as in koala", difficulty=1),
            Sound(sound_code="oo", ipa="uː", description="oo as in koober", difficulty=1),
            Sound(sound_code="l", ipa="l", description="l as in lion", difficulty=2),
            Sound(sound_code="s", ipa="s", description="s as in space", difficulty=2),
            Sound(sound_code="sh", ipa="ʃ", description="sh as in ship", difficulty=3),
        ]
        db.add_all(sounds)
        await db.flush()
        sound_by = {s.sound_code: s for s in sounds}

        words_spec = [
            ("koala", ["k", "oo", "l"]),
            ("lion", ["l"]),
            ("tiger", ["t"] if False else ["l"]),
            ("hello", ["l"]),
            ("rocket", ["s"]),
            ("star", ["s"]),
        ]
        t_sound = Sound(sound_code="t", ipa="t", description="t as in tiger", difficulty=1)
        db.add(t_sound)
        await db.flush()
        sound_by["t"] = t_sound
        words_spec[2] = ("tiger", ["t"])

        words: list[Word] = []
        for w, codes in words_spec:
            word = Word(word=w, language="en", difficulty=1)
            db.add(word)
            await db.flush()
            for i, code in enumerate(codes):
                db.add(WordSound(word_id=word.id, sound_id=sound_by[code].id, position=i))
            words.append(word)

        lessons = [
            Lesson(
                title="Meet Koober!",
                description="Listen, repeat and learn fun new words.",
                difficulty=1,
                estimated_minutes=5,
                slug="meet-koober",
            ),
            Lesson(
                title="Jungle Safari",
                description="Spell jungle animals with Koober",
                difficulty=2,
                estimated_minutes=8,
                slug="jungle-safari",
            ),
            Lesson(
                title="Sound Space",
                description="Say the sounds to launch",
                difficulty=2,
                estimated_minutes=6,
                slug="sound-space",
            ),
        ]
        db.add_all(lessons)
        await db.flush()

        for lesson in lessons:
            await ensure_talk_questions(db, lesson.id)

        db.add(LessonWord(lesson_id=lessons[0].id, word_id=words[3].id, sequence_number=1))
        db.add(LessonWord(lesson_id=lessons[1].id, word_id=words[0].id, sequence_number=1))
        db.add(LessonWord(lesson_id=lessons[1].id, word_id=words[1].id, sequence_number=2))
        db.add(LessonWord(lesson_id=lessons[1].id, word_id=words[2].id, sequence_number=3))
        db.add(LessonWord(lesson_id=lessons[2].id, word_id=words[4].id, sequence_number=1))
        db.add(LessonWord(lesson_id=lessons[2].id, word_id=words[5].id, sequence_number=2))

        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        minutes = [12, 18, 8, 22, 16, 28, 4]
        words_n = [1, 2, 1, 3, 2, 2, 1]
        acc = [80, 88, 70, 92, 85, 94, 60]
        for i in range(7):
            d = week_start + timedelta(days=i)
            if d > today:
                continue
            db.add(
                ChildDailyStat(
                    child_id=child.id,
                    stat_date=d,
                    words_practiced=words_n[i],
                    minutes=minutes[i],
                    accuracy_pct=Decimal(acc[i]),
                    streak_days=4 if i >= 3 else i + 1,
                )
            )
        db.add(Reward(child_id=child.id, title="+20 stars", kind="stars", child_daily_stat_date=today))

        samples = [
            (words[0], "koala", Decimal("92")),
            (words[3], "hello", Decimal("96")),
            (words[4], "rocket", Decimal("84")),
        ]
        for word, target, score in samples:
            att = Attempt(
                child_id=child.id,
                word_id=word.id,
                target_text=target,
                speech_to_text=target,
                created_at=datetime.now(UTC),
            )
            db.add(att)
            await db.flush()
            db.add(
                PronunciationScore(
                    attempt_id=att.id,
                    provider="stub",
                    model="stub-v1",
                    overall_score=score,
                    accuracy_score=score,
                    fluency_score=score,
                    completeness_score=Decimal("100"),
                )
            )

        await db.commit()
        print(f"Seeded parent {PARENT_EMAIL} / koober-dev, child Mia id={child.id}")


if __name__ == "__main__":
    asyncio.run(seed())
