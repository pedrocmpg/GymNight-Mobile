"""
Correlation ID middleware for GymNight API.

For every incoming request:
  - If the X-Correlation-ID request header contains a valid UUID v4, that value
    is used as the Correlation_ID for the request.
  - Otherwise a new UUID v4 is generated.

The Correlation_ID is:
  - Bound to the structlog context via bind_contextvars so it appears in all
    log entries produced during the request lifecycle.
  - Echoed back to the caller in the X-Correlation-ID response header.

Requirements: 11.1, 11.2, 11.5
"""

from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


def _is_uuid4(value: str) -> bool:
    """Return True if *value* is a valid UUID v4 string, False otherwise."""
    try:
        parsed = uuid.UUID(value, version=4)
        # uuid.UUID normalises the value; verify it round-trips correctly and
        # the version bits are genuinely v4 (the constructor sets version=4 even
        # on v1/v3/v5 inputs, so we must compare the canonical hex forms).
        return str(parsed) == value.lower()
    except (ValueError, AttributeError):
        return False


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware that injects a Correlation_ID into every request.

    Registration order note
    -----------------------
    Starlette/FastAPI ``add_middleware`` calls wrap in *reverse* order: the
    **last** ``add_middleware`` call becomes the **outermost** layer.  This
    middleware must therefore be registered **last** (after all other
    ``add_middleware`` calls) so that it runs first and the correlation ID is
    available to every subsequent middleware and route handler.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Clear any contextvars left over from a previous request on this
        # worker so correlation IDs never leak between requests.
        structlog.contextvars.clear_contextvars()

        # Req 11.1 — use the header value when it is a valid UUID v4
        # Req 11.2 — generate a fresh UUID v4 otherwise
        raw = request.headers.get("X-Correlation-ID", "")
        cid: str = raw if _is_uuid4(raw) else str(uuid.uuid4())

        # Bind to structlog context so all log entries in this request include
        # the correlation_id field automatically (via merge_contextvars processor).
        structlog.contextvars.bind_contextvars(correlation_id=cid)

        response = await call_next(request)

        # Req 11.5 — echo the Correlation_ID back in the response header
        response.headers["X-Correlation-ID"] = cid

        return response
