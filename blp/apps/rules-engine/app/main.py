"""FastAPI application entry point for the rules engine."""

from __future__ import annotations

from fastapi import FastAPI

from app.api.routes_eval import router as eval_router
from app.api.routes_rules import router as rules_router
from app.core.config import settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""

    configure_logging()
    app = FastAPI(title=settings.app_name, version=settings.version)
    app.include_router(rules_router)
    app.include_router(eval_router)
    return app


app = create_app()
