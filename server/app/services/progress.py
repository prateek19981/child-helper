from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChildDailyStat, Reward

STARS_PER_DAY = 5


@dataclass
class SpeakingDayResult:
    stat: ChildDailyStat
    streak_days: int
    stars_earned: int


async def _stat_for(db: AsyncSession, child_id: UUID, on: date) -> ChildDailyStat | None:
    return await db.scalar(
        select(ChildDailyStat).where(
            ChildDailyStat.child_id == child_id,
            ChildDailyStat.stat_date == on,
        )
    )


async def current_streak(db: AsyncSession, child_id: UUID) -> int:
    today = date.today()
    today_stat = await _stat_for(db, child_id, today)
    if today_stat is not None and today_stat.streak_days > 0:
        return int(today_stat.streak_days)
    yesterday_stat = await _stat_for(db, child_id, today - timedelta(days=1))
    if yesterday_stat is not None and yesterday_stat.streak_days > 0:
        return int(yesterday_stat.streak_days)
    return 0


async def record_speaking_day(
    db: AsyncSession,
    child_id: UUID,
    *,
    minutes: int = 5,
    words: int = 1,
) -> SpeakingDayResult:
    today = date.today()
    today_stat = await _stat_for(db, child_id, today)
    first_today = today_stat is None or (
        today_stat.minutes == 0 and today_stat.words_practiced == 0
    )

    stars_earned = 0
    if today_stat is None:
        today_stat = ChildDailyStat(
            child_id=child_id,
            stat_date=today,
            words_practiced=0,
            minutes=0,
            streak_days=0,
        )
        db.add(today_stat)

    if first_today:
        yesterday = await _stat_for(db, child_id, today - timedelta(days=1))
        today_stat.streak_days = (int(yesterday.streak_days) + 1) if yesterday is not None else 1
        db.add(
            Reward(
                child_id=child_id,
                title=f"+{STARS_PER_DAY} stars",
                kind="stars",
                child_daily_stat_date=today,
            )
        )
        stars_earned = STARS_PER_DAY

    today_stat.minutes = int(today_stat.minutes) + max(0, minutes)
    today_stat.words_practiced = int(today_stat.words_practiced) + max(0, words)

    await db.flush()
    return SpeakingDayResult(
        stat=today_stat,
        streak_days=int(today_stat.streak_days),
        stars_earned=stars_earned,
    )
