from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT / ".env"), extra="ignore")

    database_url: str = "postgresql+asyncpg://koober:koober@127.0.0.1:5432/koober"
    jwt_secret: str = "dev-change-me-please-use-32-bytes-min"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 14
    google_client_id: str = ""
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_from: str = "koober@localhost"
    app_base_url: str = "http://127.0.0.1:8000"
    cors_origins: str = "http://localhost:8081,http://localhost:19006"
    media_dir: str = "media"
    admin_username: str = "admin"
    admin_password: str = "koober-admin"
    # faster-whisper: tiny/base/small/medium/large-v3 — tiny/base are best for local CPU
    stt_provider: str = "faster_whisper"
    stt_model: str = "base"
    stt_device: str = "cpu"
    stt_compute_type: str = "int8"
    stt_language: str = "en"
    # Talk followups: groq (free Llama API) or stub (offline canned lines)
    llm_provider: str = "stub"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    llm_max_turns: int = 5
    llm_timeout_seconds: float = 8.0
    # Set false on corp networks that MITM HTTPS (self-signed proxy certs)
    llm_ssl_verify: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg", "postgresql+psycopg").replace(
            "sqlite+aiosqlite", "sqlite"
        )


settings = Settings()
