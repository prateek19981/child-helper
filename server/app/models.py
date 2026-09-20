from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class UserStatus(str, enum.Enum):
    pending_verification = "pending_verification"
    active = "active"
    disabled = "disabled"


class ChildStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class SenderType(str, enum.Enum):
    child = "child"
    mascot = "mascot"


class EmailTokenPurpose(str, enum.Enum):
    verify = "verify"
    reset = "reset"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", native_enum=False, length=32),
        default=UserStatus.pending_verification,
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    children: Mapped[list[Child]] = relationship(back_populates="parent")
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class EmailToken(Base):
    __tablename__ = "email_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    purpose: Mapped[EmailTokenPurpose] = mapped_column(
        Enum(EmailTokenPurpose, name="email_token_purpose", native_enum=False, length=16)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Child(Base, TimestampMixin):
    __tablename__ = "children"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    display_name: Mapped[str] = mapped_column(String(120))
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    age_band: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="en")
    status: Mapped[ChildStatus] = mapped_column(
        Enum(ChildStatus, name="child_status", native_enum=False, length=16), default=ChildStatus.active
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent: Mapped[User] = relationship(back_populates="children")
    conversations: Mapped[list[Conversation]] = relationship(back_populates="child")
    daily_stats: Mapped[list[ChildDailyStat]] = relationship(back_populates="child")
    rewards: Mapped[list[Reward]] = relationship(back_populates="child")
    attempts: Mapped[list[Attempt]] = relationship(back_populates="child")


class ChildDailyStat(Base):
    __tablename__ = "child_daily_stats"
    __table_args__ = (UniqueConstraint("child_id", "stat_date", name="uq_child_daily_stats"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)
    stat_date: Mapped[date] = mapped_column(Date, primary_key=True)
    words_practiced: Mapped[int] = mapped_column(Integer, default=0)
    minutes: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)

    child: Mapped[Child] = relationship(back_populates="daily_stats")


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    child_daily_stat_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(64), default="stars")
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child: Mapped[Child] = relationship(back_populates="rewards")


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(SmallInteger, default=1)
    estimated_minutes: Mapped[int] = mapped_column(SmallInteger, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)

    lesson_words: Mapped[list[LessonWord]] = relationship(back_populates="lesson")
    talk_questions: Mapped[list[TalkQuestion]] = relationship(
        back_populates="lesson",
        order_by="TalkQuestion.sequence_number",
    )


class TalkQuestion(Base, TimestampMixin):
    """Warm-up / mascot prompts shown during a lesson talk session."""

    __tablename__ = "talk_questions"
    __table_args__ = (UniqueConstraint("lesson_id", "sequence_number", name="uq_talk_questions_lesson_seq"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"))
    sequence_number: Mapped[int] = mapped_column(SmallInteger)
    prompt: Mapped[str] = mapped_column(Text)
    retry_prompt: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    lesson: Mapped[Lesson] = relationship(back_populates="talk_questions")


class Word(Base, TimestampMixin):
    __tablename__ = "words"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    word: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(16), default="en")
    difficulty: Mapped[int] = mapped_column(SmallInteger, default=1)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    lesson_words: Mapped[list[LessonWord]] = relationship(back_populates="word")
    word_sounds: Mapped[list[WordSound]] = relationship(back_populates="word")
    attempts: Mapped[list[Attempt]] = relationship(back_populates="word")


class LessonWord(Base):
    __tablename__ = "lesson_words"

    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True)
    word_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), primary_key=True)
    sequence_number: Mapped[int] = mapped_column(SmallInteger)

    lesson: Mapped[Lesson] = relationship(back_populates="lesson_words")
    word: Mapped[Word] = relationship(back_populates="lesson_words")


class Sound(Base, TimestampMixin):
    __tablename__ = "sounds"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sound_code: Mapped[str] = mapped_column(String(32), unique=True)
    ipa: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="en")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(SmallInteger, default=1)

    word_sounds: Mapped[list[WordSound]] = relationship(back_populates="sound")


class WordSound(Base):
    __tablename__ = "word_sounds"

    word_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), primary_key=True)
    sound_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sounds.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(SmallInteger)

    word: Mapped[Word] = relationship(back_populates="word_sounds")
    sound: Mapped[Sound] = relationship(back_populates="word_sounds")


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    context: Mapped[str | None] = mapped_column(String(160), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    child: Mapped[Child] = relationship(back_populates="conversations")
    messages: Mapped[list[ConversationMessage]] = relationship(back_populates="conversation")


class ConversationMessage(Base, TimestampMixin):
    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_type: Mapped[SenderType] = mapped_column(Enum(SenderType, name="sender_type", native_enum=False, length=16))
    sequence_number: Mapped[int] = mapped_column(Integer)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcription: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stt_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stt_model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    attempts: Mapped[list[Attempt]] = relationship(back_populates="message")


class Attempt(Base, TimestampMixin):
    __tablename__ = "attempts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    word_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"))
    conversation_message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conversation_messages.id", ondelete="SET NULL"), nullable=True
    )
    target_text: Mapped[str] = mapped_column(String(255))
    speech_to_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    child: Mapped[Child] = relationship(back_populates="attempts")
    word: Mapped[Word] = relationship(back_populates="attempts")
    message: Mapped[ConversationMessage | None] = relationship(back_populates="attempts")
    feedback: Mapped[list[AIFeedback]] = relationship(back_populates="attempt")
    pronunciation_scores: Mapped[list[PronunciationScore]] = relationship(back_populates="attempt")


class AIFeedback(Base, TimestampMixin):
    __tablename__ = "ai_feedback"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"))
    model: Mapped[str] = mapped_column(String(64))
    feedback_text: Mapped[str] = mapped_column(Text)
    feedback_type: Mapped[str] = mapped_column(String(32))

    attempt: Mapped[Attempt] = relationship(back_populates="feedback")


class PronunciationScore(Base, TimestampMixin):
    __tablename__ = "pronunciation_scores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(64))
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    accuracy_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    fluency_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    completeness_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))

    attempt: Mapped[Attempt] = relationship(back_populates="pronunciation_scores")
    phoneme_scores: Mapped[list[PhonemeScore]] = relationship(back_populates="pronunciation_score")


class PhonemeScore(Base, TimestampMixin):
    __tablename__ = "phoneme_scores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    pronunciation_score_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pronunciation_scores.id", ondelete="CASCADE")
    )
    sound_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sounds.id", ondelete="SET NULL"), nullable=True)
    expected_phoneme: Mapped[str] = mapped_column(String(32))
    detected_phoneme: Mapped[str | None] = mapped_column(String(32), nullable=True)
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    position: Mapped[int] = mapped_column(SmallInteger)

    pronunciation_score: Mapped[PronunciationScore] = relationship(back_populates="phoneme_scores")
