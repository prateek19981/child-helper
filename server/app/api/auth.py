from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.providers import get_email_sender
from app.core.security import as_utc, hash_password, hash_token, new_raw_token, verify_password
from app.models import Child, ChildStatus, EmailToken, EmailTokenPurpose, RefreshToken, User, UserStatus
from app.services.email import EmailSender, send_reset_email, send_verify_email
from app.services.google import verify_google_id_token
from app.services.tokens import create_token_pair, user_auth_payload

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str | None = None
    phone: str | None = None
    child_name: str = Field(min_length=1, max_length=120)

    @field_validator("child_name")
    @classmethod
    def child_name_required(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("child_name is required")
        return name


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleIn(BaseModel):
    id_token: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenIn(BaseModel):
    token: str


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8)


class ForgotIn(BaseModel):
    email: EmailStr


def _auth_tokens_response(pair, user: User) -> dict:
    return {**pair.as_dict(), "user": user_auth_payload(user)}


@router.post("/register")
async def register(
    body: RegisterIn,
    db: AsyncSession = Depends(get_db),
    mailer: EmailSender = Depends(get_email_sender),
):
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=body.email.lower(),
        phone=body.phone,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        status=UserStatus.pending_verification,
    )
    db.add(user)
    await db.flush()
    raw = new_raw_token()
    db.add(
        EmailToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            purpose=EmailTokenPurpose.verify,
            expires_at=datetime.now(UTC) + timedelta(days=2),
        )
    )
    db.add(
        Child(
            parent_id=user.id,
            display_name=body.child_name,
            age_band="4-6",
            language="en",
            status=ChildStatus.active,
        )
    )
    await db.commit()
    await send_verify_email(user, raw, sender=mailer)
    print("email sent", raw)
    return {"message": "Check your email to verify your account", "dev_verify_token": raw}


@router.get("/verify-email")
@router.post("/verify-email")
async def verify_email(token: str | None = None, body: TokenIn | None = None, db: AsyncSession = Depends(get_db)):
    raw = token or (body.token if body else None)
    if not raw:
        raise HTTPException(400, "token required")
    rec = await db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == hash_token(raw),
            EmailToken.purpose == EmailTokenPurpose.verify,
            EmailToken.used.is_(False),
        )
    )
    if rec is None or as_utc(rec.expires_at) < datetime.now(UTC):
        raise HTTPException(400, "Invalid or expired token")
    user = await db.get(User, rec.user_id)
    if user is None:
        raise HTTPException(400, "Invalid token")
    user.status = UserStatus.active
    rec.used = True
    pair = await create_token_pair(db, user)
    await db.commit()
    return _auth_tokens_response(pair, user)


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    print("starting login")
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    print(user)
    if user is None or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if user.status == UserStatus.disabled:
        raise HTTPException(403, "Account disabled")
    if user.status != UserStatus.active:
        raise HTTPException(403, "Email not verified")
    pair = await create_token_pair(db, user)
    await db.commit()
    return _auth_tokens_response(pair, user)


@router.post("/google")
async def google(body: GoogleIn, db: AsyncSession = Depends(get_db)):
    try:
        info = verify_google_id_token(body.id_token)
    except Exception as exc:
        raise HTTPException(401, "Invalid Google token") from exc
    sub = info.get("sub")
    email = (info.get("email") or "").lower()
    if not sub or not email:
        raise HTTPException(400, "Google token missing email")
    user = await db.scalar(select(User).where((User.google_sub == sub) | (User.email == email)))
    if user is None:
        user = User(
            email=email,
            display_name=info.get("name"),
            google_sub=sub,
            status=UserStatus.active,
        )
        db.add(user)
        await db.flush()
        db.add(
            Child(
                parent_id=user.id,
                display_name=(info.get("name") or "Explorer").split()[0],
                language="en",
                status=ChildStatus.active,
            )
        )
    else:
        user.google_sub = user.google_sub or sub
        user.status = UserStatus.active
    pair = await create_token_pair(db, user)
    await db.commit()
    return _auth_tokens_response(pair, user)


@router.post("/refresh")
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    rec = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(body.refresh_token),
            RefreshToken.revoked.is_(False),
        )
    )
    if rec is None or as_utc(rec.expires_at) < datetime.now(UTC):
        raise HTTPException(401, "Invalid refresh token")
    rec.revoked = True
    user = await db.get(User, rec.user_id)
    if user is None:
        raise HTTPException(401, "Invalid refresh token")
    pair = await create_token_pair(db, user)
    await db.commit()
    return _auth_tokens_response(pair, user)


@router.post("/forgot-password")
async def forgot(
    body: ForgotIn,
    db: AsyncSession = Depends(get_db),
    mailer: EmailSender = Depends(get_email_sender),
):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user:
        raw = new_raw_token()
        db.add(
            EmailToken(
                user_id=user.id,
                token_hash=hash_token(raw),
                purpose=EmailTokenPurpose.reset,
                expires_at=datetime.now(UTC) + timedelta(hours=2),
            )
        )
        await db.commit()
        await send_reset_email(user, raw, sender=mailer)
        return {"message": "If that email exists, a reset was sent", "dev_reset_token": raw}
    return {"message": "If that email exists, a reset was sent"}


@router.post("/reset-password")
async def reset(body: ResetIn, db: AsyncSession = Depends(get_db)):
    rec = await db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == hash_token(body.token),
            EmailToken.purpose == EmailTokenPurpose.reset,
            EmailToken.used.is_(False),
        )
    )
    if rec is None or as_utc(rec.expires_at) < datetime.now(UTC):
        raise HTTPException(400, "Invalid or expired token")
    user = await db.get(User, rec.user_id)
    if user is None:
        raise HTTPException(400, "Invalid token")
    user.password_hash = hash_password(body.password)
    user.status = UserStatus.active
    rec.used = True
    await db.commit()
    return {"message": "Password updated"}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "status": user.status.value,
        "phone": user.phone,
    }
