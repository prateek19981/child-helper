from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_token
from app.models import Child, User, UserStatus

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials)
        user_id = payload.get("sub")
        if payload.get("typ") != "access" or not user_id:
            raise InvalidTokenError()
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from None
    user = await db.get(User, UUID(str(user_id)))
    if user is None or user.status == UserStatus.disabled:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid user")
    return user


async def get_active_user(user: User = Depends(get_current_user)) -> User:
    if user.status != UserStatus.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email not verified")
    return user


async def owned_child(child_id: UUID, user: User = Depends(get_active_user), db: AsyncSession = Depends(get_db)) -> Child:
    child = await db.get(Child, child_id)
    if child is None or child.parent_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child
