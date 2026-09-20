from app.models import EmailTokenPurpose, User
from app.core.config import settings


async def send_email(to: str, subject: str, body: str) -> None:
    try:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        await aiosmtplib.send(msg, hostname=settings.smtp_host, port=settings.smtp_port)
    except Exception:
        print(f"[email fallback] to={to} subject={subject}\n{body}")


async def send_verify_email(user: User, raw_token: str) -> None:
    link = f"{settings.app_base_url}/auth/verify-email?token={raw_token}"
    await send_email(user.email, "Verify your Koober account", f"Verify: {link}")


async def send_reset_email(user: User, raw_token: str) -> None:
    await send_email(user.email, "Reset your Koober password", f"Reset token: {raw_token}")


# keep purpose enum import used by callers
_ = EmailTokenPurpose
