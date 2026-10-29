from __future__ import annotations

import secrets

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from app.core.config import settings
from app.models import (
    AIFeedback,
    Attempt,
    Child,
    ChildDailyStat,
    Conversation,
    ConversationMessage,
    EmailToken,
    Lesson,
    LessonWord,
    PhonemeScore,
    PronunciationScore,
    RefreshToken,
    Reward,
    Sound,
    TalkQuestion,
    User,
    Word,
    WordSound,
)


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")
        ok_user = secrets.compare_digest(username, settings.admin_username)
        ok_pass = secrets.compare_digest(password, settings.admin_password)
        if not (ok_user and ok_pass):
            return False
        request.session.update({"admin": True})
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get("admin"))


class UserAdmin(ModelView, model=User):
    name = "Parent"
    name_plural = "Parents"
    icon = "fa-solid fa-user"
    column_list = [User.id, User.email, User.display_name, User.status, User.created_at]
    column_searchable_list = [User.email, User.display_name]
    column_sortable_list = [User.email, User.status, User.created_at]
    form_excluded_columns = [User.refresh_tokens, User.children, User.google_sub]
    column_details_exclude_list = [User.password_hash]


class ChildAdmin(ModelView, model=Child):
    name_plural = "Children"
    icon = "fa-solid fa-child"
    column_list = [Child.id, Child.display_name, Child.parent_id, Child.age_band, Child.language, Child.status]
    column_searchable_list = [Child.display_name]
    form_excluded_columns = [Child.conversations, Child.daily_stats, Child.rewards, Child.attempts]


class ChildDailyStatAdmin(ModelView, model=ChildDailyStat):
    name = "Daily stat"
    name_plural = "Daily stats"
    icon = "fa-solid fa-chart-simple"
    column_list = [
        ChildDailyStat.child_id,
        ChildDailyStat.stat_date,
        ChildDailyStat.words_practiced,
        ChildDailyStat.minutes,
        ChildDailyStat.accuracy_pct,
        ChildDailyStat.streak_days,
    ]


class RewardAdmin(ModelView, model=Reward):
    icon = "fa-solid fa-star"
    column_list = [Reward.id, Reward.child_id, Reward.title, Reward.kind, Reward.earned_at]


class LessonAdmin(ModelView, model=Lesson):
    icon = "fa-solid fa-book"
    column_list = [Lesson.id, Lesson.title, Lesson.slug, Lesson.difficulty, Lesson.estimated_minutes, Lesson.is_active]
    column_searchable_list = [Lesson.title, Lesson.slug]
    form_excluded_columns = [Lesson.lesson_words, Lesson.talk_questions]


class WordAdmin(ModelView, model=Word):
    icon = "fa-solid fa-font"
    column_list = [Word.id, Word.word, Word.language, Word.difficulty]
    column_searchable_list = [Word.word]
    form_excluded_columns = [Word.lesson_words, Word.word_sounds, Word.attempts]


class SoundAdmin(ModelView, model=Sound):
    icon = "fa-solid fa-volume-high"
    column_list = [Sound.id, Sound.sound_code, Sound.ipa, Sound.language, Sound.difficulty]
    column_searchable_list = [Sound.sound_code]
    form_excluded_columns = [Sound.word_sounds]


class LessonWordAdmin(ModelView, model=LessonWord):
    name = "Lesson word"
    name_plural = "Lesson words"
    column_list = [LessonWord.lesson_id, LessonWord.word_id, LessonWord.sequence_number]


class TalkQuestionAdmin(ModelView, model=TalkQuestion):
    name = "Talk question"
    name_plural = "Talk questions"
    icon = "fa-solid fa-comments"
    column_list = [
        TalkQuestion.id,
        TalkQuestion.lesson_id,
        TalkQuestion.sequence_number,
        TalkQuestion.prompt,
        TalkQuestion.retry_prompt,
        TalkQuestion.is_active,
    ]
    column_searchable_list = [TalkQuestion.prompt, TalkQuestion.retry_prompt]
    column_sortable_list = [TalkQuestion.sequence_number, TalkQuestion.is_active]


class WordSoundAdmin(ModelView, model=WordSound):
    name = "Word sound"
    name_plural = "Word sounds"
    column_list = [WordSound.word_id, WordSound.sound_id, WordSound.position]


class ConversationAdmin(ModelView, model=Conversation):
    icon = "fa-solid fa-comments"
    column_list = [Conversation.id, Conversation.child_id, Conversation.title, Conversation.started_at]
    form_excluded_columns = [Conversation.messages]


class ConversationMessageAdmin(ModelView, model=ConversationMessage):
    name = "Message"
    name_plural = "Messages"
    column_list = [
        ConversationMessage.id,
        ConversationMessage.conversation_id,
        ConversationMessage.sender_type,
        ConversationMessage.sequence_number,
        ConversationMessage.created_at,
    ]
    form_excluded_columns = [ConversationMessage.attempts]


class AttemptAdmin(ModelView, model=Attempt):
    icon = "fa-solid fa-microphone"
    column_list = [Attempt.id, Attempt.child_id, Attempt.target_text, Attempt.speech_to_text, Attempt.created_at]
    form_excluded_columns = [Attempt.feedback, Attempt.pronunciation_scores]


class AIFeedbackAdmin(ModelView, model=AIFeedback):
    name = "AI feedback"
    icon = "fa-solid fa-comment"
    column_list = [AIFeedback.id, AIFeedback.attempt_id, AIFeedback.feedback_type, AIFeedback.model]


class PronunciationScoreAdmin(ModelView, model=PronunciationScore):
    name = "Pronunciation score"
    name_plural = "Pronunciation scores"
    column_list = [
        PronunciationScore.id,
        PronunciationScore.attempt_id,
        PronunciationScore.overall_score,
        PronunciationScore.accuracy_score,
        PronunciationScore.provider,
    ]
    form_excluded_columns = [PronunciationScore.phoneme_scores]


class PhonemeScoreAdmin(ModelView, model=PhonemeScore):
    name = "Phoneme score"
    name_plural = "Phoneme scores"
    column_list = [
        PhonemeScore.id,
        PhonemeScore.expected_phoneme,
        PhonemeScore.detected_phoneme,
        PhonemeScore.score,
        PhonemeScore.position,
    ]


class RefreshTokenAdmin(ModelView, model=RefreshToken):
    name_plural = "Refresh tokens"
    can_create = False
    column_list = [RefreshToken.id, RefreshToken.user_id, RefreshToken.expires_at, RefreshToken.revoked]
    form_excluded_columns = [RefreshToken.token_hash]


class EmailTokenAdmin(ModelView, model=EmailToken):
    name_plural = "Email tokens"
    can_create = False
    column_list = [EmailToken.id, EmailToken.user_id, EmailToken.purpose, EmailToken.used, EmailToken.expires_at]


def setup_admin(app: FastAPI) -> Admin:
    engine = create_engine(settings.sync_database_url, pool_pre_ping=True)
    admin = Admin(
        app,
        engine,
        title="Kick Admin",
        base_url="/admin",
        authentication_backend=AdminAuth(secret_key=settings.jwt_secret),
    )
    for view in (
        UserAdmin,
        ChildAdmin,
        ChildDailyStatAdmin,
        RewardAdmin,
        LessonAdmin,
        WordAdmin,
        SoundAdmin,
        LessonWordAdmin,
        TalkQuestionAdmin,
        WordSoundAdmin,
        ConversationAdmin,
        ConversationMessageAdmin,
        AttemptAdmin,
        AIFeedbackAdmin,
        PronunciationScoreAdmin,
        PhonemeScoreAdmin,
        RefreshTokenAdmin,
        EmailTokenAdmin,
    ):
        admin.add_view(view)
    return admin
