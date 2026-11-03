"""
Backend Configuration and Environment Settings.
Reads all configurations and secrets from environment variables (with APATH_ prefix).
"""

from pathlib import Path
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = "ADAPTIVE-PATH Studio API"
    app_version: str = "1.0.0"
    environment: Literal["development", "testing", "production"] = "development"
    debug: bool = False

    # Server settings
    host: str = "0.0.0.0"
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Database & Storage
    database_url: str = "sqlite:///./adaptive_path.db"
    storage_dir: Path = Path("./storage")
    redis_url: str = "redis://localhost:6379/0"

    # Security & Tokens
    jwt_secret: str = "insecure-dev-secret-change-me-in-production-sih2026-apath"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    csrf_secret: str = "csrf-insecure-dev-secret-sih2026-apath"

    # Rate Limiting & Lockout
    max_login_attempts: int = 5
    lockout_duration_seconds: int = 300  # 5 minutes
    rate_limit_per_minute: int = 120

    # Quota Defaults
    default_max_concurrent_runs: int = 3
    default_daily_run_limit: int = 100

    # Engine Execution
    engine_adapter_default: str = "python"
    worker_concurrency: int = 4
    worker_max_retries: int = 2
    worker_retry_backoff_base_s: float = 1.0

    # Google OAuth (Optional)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/oauth/google/callback"

    model_config = SettingsConfigDict(
        env_prefix="APATH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
settings.storage_dir.mkdir(parents=True, exist_ok=True)
(settings.storage_dir / "runs").mkdir(parents=True, exist_ok=True)
(settings.storage_dir / "reports").mkdir(parents=True, exist_ok=True)
