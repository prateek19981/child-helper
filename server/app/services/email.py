from __future__ import annotations

from typing import Protocol

from app.core.config import settings
from app.models import User


class EmailSender(Protocol):
    async def send(self, to: str, subject: str, body: str) -> None: ...


class SmtpEmailSender:
    async def send(self, to: str, subject: str, body: str) -> None:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        await aiosmtplib.send(msg, hostname=settings.smtp_host, port=settings.smtp_port)


class LoggingEmailSender:
    """Dev / test fallback that prints instead of sending SMTP."""

    async def send(self, to: str, subject: str, body: str) -> None:
        print(f"[email fallback] to={to} subject={subject}\n{body}")


class FallbackEmailSender:
    """Try SMTP first; fall back to logging on any failure."""

    def __init__(self, primary: EmailSender | None = None, fallback: EmailSender | None = None) -> None:
        self._primary = primary or SmtpEmailSender()
        self._fallback = fallback or LoggingEmailSender()

    async def send(self, to: str, subject: str, body: str) -> None:
        try:
            await self._primary.send(to, subject, body)
        except Exception:
            await self._fallback.send(to, subject, body)


def build_email_sender() -> EmailSender:
    return FallbackEmailSender()


email_sender: EmailSender = build_email_sender()


async def send_verify_email(user: User, raw_token: str, sender: EmailSender | None = None) -> None:
    link = f"{settings.app_base_url}/auth/verify-email?token={raw_token}"
    mailer = sender or email_sender
    await mailer.send(user.email, "Verify your Kick account", f"Verify: {link}")


async def send_reset_email(user: User, raw_token: str, sender: EmailSender | None = None) -> None:
    mailer = sender or email_sender
    await mailer.send(user.email, "Reset your Kick password", f"Reset token: {raw_token}")
