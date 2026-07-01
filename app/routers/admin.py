"""
Admin endpoints for GymNight API.

Exposes:
  POST /admin/cleanup-tombstones — remove obsolete tombstone records from
    the deleted_records table based on TOMBSTONE_RETENTION_DAYS.

Authentication: Bearer <ADMIN_SECRET> via Authorization header.

Requirements: 10.1, 10.2, 10.3, 10.4
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.connection import get_db
from app.database.models import DeletedRecord

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Security scheme — Bearer token
# ---------------------------------------------------------------------------

bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_correlation_id() -> str:
    """Return the correlation ID bound to the current request context, if any."""
    try:
        ctx: dict[str, Any] = structlog.contextvars.get_contextvars()
        return ctx.get("correlation_id", "")
    except Exception:  # noqa: BLE001
        return ""


def _get_retention_days() -> int:
    """
    Read TOMBSTONE_RETENTION_DAYS from settings and validate the range.

    Returns the validated integer value.

    Raises:
        HTTPException 422: If the value is outside [1, 3650].
    """
    retention = settings.TOMBSTONE_RETENTION_DAYS
    if not (1 <= retention <= 3650):
        raise HTTPException(
            status_code=422,
            detail=(
                f"TOMBSTONE_RETENTION_DAYS must be between 1 and 3650 days "
                f"(inclusive), got {retention}."
            ),
        )
    return retention


# ---------------------------------------------------------------------------
# Admin authentication dependency (Req 10.3)
# ---------------------------------------------------------------------------


def _require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> None:
    """
    Verify that the request carries a valid admin Bearer token.

    Raises:
        HTTPException 401: If the Authorization header is missing or the
            token does not match ADMIN_SECRET.
    """
    if credentials is None or credentials.credentials != settings.ADMIN_SECRET:
        raise HTTPException(
            status_code=401,
            detail="Admin authentication required",
        )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/cleanup-tombstones")
def cleanup_tombstones(
    _: None = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """
    Remove obsolete tombstone records from the deleted_records table.

    Deletes all rows whose deleted_at timestamp is older than
    TOMBSTONE_RETENTION_DAYS days from now.

    Returns:
        HTTP 200  ``{"deleted_count": n}`` — cleanup succeeded
        HTTP 401  — missing or invalid admin token
        HTTP 422  — TOMBSTONE_RETENTION_DAYS out of valid range [1, 3650]
        HTTP 500  — database error; transaction rolled back

    Requirements: 10.1, 10.2, 10.3, 10.4
    """
    retention = _get_retention_days()

    # Compute the cutoff as a Unix millisecond timestamp (Req 10.1)
    cutoff_ms = int(
        (datetime.utcnow() - timedelta(days=retention)).timestamp() * 1000
    )

    try:
        n = (
            db.query(DeletedRecord)
            .filter(DeletedRecord.deleted_at < cutoff_ms)
            .delete(synchronize_session=False)
        )
        db.commit()

        # Emit structured INFO log with deleted_count and UTC timestamp (Req 10.2)
        log.info(
            "tombstone_cleanup",
            deleted_count=n,
            timestamp=datetime.utcnow().isoformat(),
        )

        return {"deleted_count": n}

    except Exception as exc:  # noqa: BLE001
        db.rollback()

        # Emit structured ERROR log with error message and correlation ID (Req 10.4)
        log.error(
            "tombstone_cleanup_failed",
            error=str(exc),
            correlation_id=_get_correlation_id(),
        )

        raise HTTPException(status_code=500, detail="Cleanup failed")
