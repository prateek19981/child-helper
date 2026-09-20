"""Add talk_questions table for mascot warm-up prompts."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_talk_questions"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "talk_questions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("lesson_id", sa.Uuid(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sequence_number", sa.SmallInteger(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("retry_prompt", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("lesson_id", "sequence_number", name="uq_talk_questions_lesson_seq"),
    )
    op.create_index("ix_talk_questions_lesson_id", "talk_questions", ["lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_talk_questions_lesson_id", table_name="talk_questions")
    op.drop_table("talk_questions")
