"""Minimal logging configuration used by the FastAPI application."""

import logging
from typing import Optional


def configure_logging(level: Optional[int] = None) -> None:
    """Configure application wide logging.

    Parameters
    ----------
    level:
        Optional log level override. When omitted, INFO level logging is used.
    """

    logging.basicConfig(
        level=level or logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
