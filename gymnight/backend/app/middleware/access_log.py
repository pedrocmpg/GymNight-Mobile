"""
Access log middleware for GymNight API.

Emits a single structured INFO log entry for every request that completes,
containing:
  - method       HTTP verb (GET, POST, …)
  - path         Request URL path
  - status_code  HTTP response status code
  - latency_ms   Time from request receipt to response, rounded to 2 dp
  - correlation_id  Automatically included via structlog contextvars, which
                    is populated by CorrelationIDMiddleware (the outer layer).

Requirements: 11.3
"""

from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger

log = get_logger(__name__)


class AccessLogMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware that emits a structured access log entry per request.

    Registration order note
    -----------------------
    Starlette/FastAPI ``add_middleware`` calls wrap in *reverse* order: the
    **last** ``add_middleware`` call becomes the **outermost** layer.

    ``AccessLogMiddleware`` must be registered **before**
    ``CorrelationIDMiddleware`` so that it sits *inside* it — meaning the
    correlation ID is already bound to the structlog context when this
    middleware fires its log entry.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.monotonic()

        response = await call_next(request)

        latency_ms = round((time.monotonic() - t0) * 1000, 2)

        # correlation_id is automatically merged from structlog contextvars
        # (bound by CorrelationIDMiddleware, which wraps this middleware).
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=latency_ms,
        )

        return response
