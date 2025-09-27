"""Configuration settings for the rules engine service."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from the environment when available."""

    app_name: str = Field(default="BLP Rules Engine", description="Human readable application name")
    version: str = Field(default="0.1.0", description="Application version exposed via OpenAPI")
    debug: bool = Field(default=False, description="Toggle FastAPI debug mode")


@lru_cache()
def get_settings() -> Settings:
    """Return a cached settings instance."""

    return Settings()


settings = get_settings()
