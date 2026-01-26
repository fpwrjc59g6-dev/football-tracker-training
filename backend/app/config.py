"""Application configuration."""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Football Tracker - AI Training Platform"
    debug: bool = False
    api_version: str = "v1"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/football_tracker"

    # JWT Authentication
    secret_key: str = "CHANGE-THIS-IN-PRODUCTION-USE-STRONG-RANDOM-KEY"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # CORS - allowed origins for frontend
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # File uploads
    max_upload_size: int = 100 * 1024 * 1024  # 100MB

    # Pagination defaults
    default_page_size: int = 50
    max_page_size: int = 500

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
