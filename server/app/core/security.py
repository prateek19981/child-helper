from datetime import UTC, datetime, timedelta
from hashlib import sha256
import secrets
import uuid

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def hash_token(raw: str) -> str:
    return sha256(raw.encode()).hexdigest()


def new_raw_token() -> str:
    return secrets.token_urlsafe(32)


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def create_access_token(user_id: uuid.UUID) -> str:
    exp = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_minutes)
    return jwt.encode({"sub": str(user_id), "exp": exp, "typ": "access"}, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
