"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_status = postgresql.ENUM(
        "pending_verification", "active", "disabled", name="user_status", create_type=False
    )
    child_status = postgresql.ENUM("active", "archived", name="child_status", create_type=False)
    sender_type = postgresql.ENUM("child", "mascot", name="sender_type", create_type=False)
    email_purpose = postgresql.ENUM("verify", "reset", name="email_token_purpose", create_type=False)
    user_status.create(op.get_bind(), checkfirst=True)
    child_status.create(op.get_bind(), checkfirst=True)
    sender_type.create(op.get_bind(), checkfirst=True)
    email_purpose.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(32), unique=True),
        sa.Column("display_name", sa.String(120)),
        sa.Column("password_hash", sa.Text()),
        sa.Column("google_sub", sa.String(255), unique=True),
        sa.Column("status", user_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "email_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), unique=True, nullable=False),
        sa.Column("purpose", email_purpose, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "children",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("age_band", sa.String(32)),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("status", child_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "child_daily_stats",
        sa.Column("child_id", sa.Uuid(), sa.ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("stat_date", sa.Date(), primary_key=True),
        sa.Column("words_practiced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accuracy_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("streak_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "rewards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("child_id", sa.Uuid(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_daily_stat_date", sa.Date()),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False, server_default="stars"),
        sa.Column("earned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "lessons",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("estimated_minutes", sa.SmallInteger(), nullable=False, server_default="5"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("slug", sa.String(64), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "words",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("word", sa.String(120), nullable=False),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("image_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "lesson_words",
        sa.Column("lesson_id", sa.Uuid(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("word_id", sa.Uuid(), sa.ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sequence_number", sa.SmallInteger(), nullable=False),
    )
    op.create_table(
        "sounds",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sound_code", sa.String(32), unique=True, nullable=False),
        sa.Column("ipa", sa.String(32)),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("description", sa.Text()),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "word_sounds",
        sa.Column("word_id", sa.Uuid(), sa.ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sound_id", sa.Uuid(), sa.ForeignKey("sounds.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("position", sa.SmallInteger(), nullable=False),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("child_id", sa.Uuid(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(160)),
        sa.Column("context", sa.String(160)),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_type", sender_type, nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("text_content", sa.Text()),
        sa.Column("transcription", sa.Text()),
        sa.Column("audio_storage_key", sa.Text()),
        sa.Column("audio_duration_ms", sa.Integer()),
        sa.Column("stt_provider", sa.String(64)),
        sa.Column("stt_model", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("child_id", sa.Uuid(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("word_id", sa.Uuid(), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_message_id", sa.Uuid(), sa.ForeignKey("conversation_messages.id", ondelete="SET NULL")),
        sa.Column("target_text", sa.String(255), nullable=False),
        sa.Column("speech_to_text", sa.Text()),
        sa.Column("audio_storage_key", sa.Text()),
        sa.Column("audio_duration_ms", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "ai_feedback",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("feedback_type", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "pronunciation_scores",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("accuracy_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("fluency_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("completeness_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "phoneme_scores",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("pronunciation_score_id", sa.Uuid(), sa.ForeignKey("pronunciation_scores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sound_id", sa.Uuid(), sa.ForeignKey("sounds.id", ondelete="SET NULL")),
        sa.Column("expected_phoneme", sa.String(32), nullable=False),
        sa.Column("detected_phoneme", sa.String(32)),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    for table in [
        "phoneme_scores",
        "pronunciation_scores",
        "ai_feedback",
        "attempts",
        "conversation_messages",
        "conversations",
        "word_sounds",
        "sounds",
        "lesson_words",
        "words",
        "lessons",
        "rewards",
        "child_daily_stats",
        "children",
        "email_tokens",
        "refresh_tokens",
        "users",
    ]:
        op.drop_table(table)
    op.execute("DROP TYPE IF EXISTS email_token_purpose")
    op.execute("DROP TYPE IF EXISTS sender_type")
    op.execute("DROP TYPE IF EXISTS child_status")
    op.execute("DROP TYPE IF EXISTS user_status")
