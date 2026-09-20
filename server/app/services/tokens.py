from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_token, new_raw_token
from app.models import RefreshToken, User


async def issue_tokens(db: AsyncSession, user: User) -> dict:
    access = create_access_token(user.id)
    raw_refresh = new_raw_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_days),
        )
    )
    await db.flush()
    return {
        "access_token": access,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "status": user.status.value,
        },
    }


def as_uuid(value: str | UUID) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
