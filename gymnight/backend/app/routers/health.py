"""
Health check endpoint for GymNight API.

Exposes GET /health — no authentication required.
Verifies database connectivity via a lightweight SELECT 1 query with a 5-second
timeout. Returns HTTP 200 on success, HTTP 503 on failure.

Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.connection import get_db

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Correlation ID helper
# ---------------------------------------------------------------------------
# Task 10 will add CorrelationIDMiddleware that binds a UUID per request via
# structlog.contextvars.  Until that middleware exists we return an empty string
# so the field is always present in log records (just empty rather than missing).
# ---------------------------------------------------------------------------

def _get_correlation_id() -> str:
    """
    Return the correlation ID bound to the current request context, if any.

    Once CorrelationIDMiddleware (task 10) is in place it will bind
    ``correlation_id`` to structlog context vars.  We attempt to read it here;
    if structlog is not yet installed we fall back to an empty string.
    """
    try:
        import structlog  # noqa: PLC0415
        ctx: dict[str, Any] = structlog.contextvars.get_contextvars()
        return ctx.get("correlation_id", "")
    except ModuleNotFoundError:
        return ""


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    """
    Database health check.

    Executes ``SELECT 1`` against the configured PostgreSQL instance.  The query
    is run synchronously; the 5-second enforcement is handled at the database
    driver / connection-timeout level (see Requirement 8.3).

    Returns:
        HTTP 200  ``{"status": "ok", "database": "ok"}``       — DB reachable
        HTTP 503  ``{"status": "degraded", "database": "unreachable"}`` — DB not reachable

    No authentication is required (Requirement 8.4).
    """
    try:
        # Lightweight connectivity probe — completes in < 1 ms on a healthy DB.
        # The 5-second timeout requirement (8.3) is satisfied by the PostgreSQL
        # ``connect_timeout`` on the DATABASE_URL (e.g. ``?connect_timeout=5``).
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as exc:  # noqa: BLE001
        correlation_id = _get_correlation_id()
        # Emit structured ERROR log (Requirement 8.5).
        # When structlog is configured (task 10) this will produce a JSON entry;
        # until then it falls back to the standard logging module.
        try:
            import structlog  # noqa: PLC0415
            structlog.get_logger(__name__).error(
                "health_check_failed",
                error=str(exc),
                correlation_id=correlation_id,
            )
        except ModuleNotFoundError:
            log.error(
                "health_check_failed",
                extra={
                    "event": "health_check_failed",
                    "error": str(exc),
                    "correlation_id": correlation_id,
                },
            )

        raise HTTPException(
            status_code=503,
            detail={"status": "degraded", "database": "unreachable"},
        )
