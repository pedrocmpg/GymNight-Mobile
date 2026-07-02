"""
Property-based tests for Correlation ID middleware.

Feature: backend-fixes-and-improvements
Properties 9–10: CorrelationIDMiddleware and AccessLogMiddleware

Property 9: Correlation ID round-trip (Requirements 11.1, 11.2, 11.5)
Property 10: Structured log fields present on every request (Requirements 11.3, 11.4)
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import pytest
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Environment setup — required before importing any app module
# ---------------------------------------------------------------------------

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-hypothesis-runs-x")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.middleware.correlation_id import CorrelationIDMiddleware  # noqa: E402
from app.middleware.access_log import AccessLogMiddleware  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_valid_uuid4(value: str) -> bool:
    """Return True if *value* is a canonical UUID v4 string."""
    try:
        parsed = uuid.UUID(value, version=4)
        return str(parsed) == value.lower()
    except (ValueError, AttributeError):
        return False


def _make_capturing_processor(captured: list[dict]) -> Any:
    """Return a structlog processor that appends event dicts to *captured*."""

    def processor(logger: Any, method: str, event_dict: dict) -> dict:
        captured.append(dict(event_dict))
        return event_dict

    return processor


def _configure_structlog_for_testing(captured: list[dict]) -> None:
    """
    Reconfigure structlog with a capturing processor inserted before JSONRenderer.

    cache_logger_on_first_use=False ensures each test picks up the current
    processor chain rather than a cached version from a previous call.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            # Rename event → message to match production config (Req 11.4)
            lambda _, __, ed: (
                {**ed, "message": ed.pop("event")} if "event" in ed else ed
            ),
            _make_capturing_processor(captured),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,  # IMPORTANT: must be False for per-test config
    )


def _build_test_app() -> FastAPI:
    """
    Build a minimal FastAPI app with both middleware layers installed.

    FastAPI/Starlette add_middleware wraps in reverse order:
    - add_middleware(AccessLogMiddleware)  → inner layer
    - add_middleware(CorrelationIDMiddleware) → outer layer (added last = outermost)
    """
    app = FastAPI()
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(CorrelationIDMiddleware)

    @app.get("/test")
    def test_route() -> dict:
        return {"ok": True}

    return app


# ===========================================================================
# Property 9: Correlation ID round-trip
# Requirements: 11.1, 11.2, 11.5
# ===========================================================================


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(uid=st.uuids(version=4))
def test_property_9a_valid_uuid4_echoed_back(uid: uuid.UUID) -> None:
    """
    **Validates: Requirements 11.1, 11.5**

    For any valid UUID v4 provided in the X-Correlation-ID request header,
    the API SHALL echo back that exact value in the X-Correlation-ID response
    header.
    """
    captured: list[dict] = []
    _configure_structlog_for_testing(captured)

    app = _build_test_app()
    client = TestClient(app, raise_server_exceptions=True)

    sent_id = str(uid)
    response = client.get("/test", headers={"X-Correlation-ID": sent_id})

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    echoed = response.headers.get("X-Correlation-ID")
    assert echoed is not None, "X-Correlation-ID header missing from response"
    assert echoed == sent_id, (
        f"Expected echoed correlation ID {sent_id!r}, got {echoed!r}"
    )


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    bad_header=st.one_of(
        # Completely absent header represented as empty string (tested separately)
        st.just(""),
        # Random ASCII printable text that isn't a valid UUID v4
        # (HTTP headers must be ASCII-encodable)
        st.text(
            alphabet=st.characters(
                whitelist_categories=("L", "N", "P", "S", "Zs"),
                whitelist_characters="-_",
                max_codepoint=127,
            ),
            min_size=1,
            max_size=100,
        ).filter(lambda s: not _is_valid_uuid4(s) and s.isascii()),
        # Plausible-but-wrong UUID-like strings (wrong version)
        st.uuids(version=1).map(str),
        st.uuids(version=3).map(str),
        st.uuids(version=5).map(str),
    )
)
def test_property_9b_invalid_header_generates_fresh_uuid4(bad_header: str) -> None:
    """
    **Validates: Requirements 11.2, 11.5**

    For any request without a valid UUID v4 in the X-Correlation-ID header,
    the response X-Correlation-ID SHALL contain a newly generated valid UUID v4.
    """
    captured: list[dict] = []
    _configure_structlog_for_testing(captured)

    app = _build_test_app()
    client = TestClient(app, raise_server_exceptions=True)

    headers: dict[str, str] = {}
    if bad_header:  # empty string → omit header entirely
        headers["X-Correlation-ID"] = bad_header

    response = client.get("/test", headers=headers)

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    generated = response.headers.get("X-Correlation-ID")
    assert generated is not None, "X-Correlation-ID header missing from response"
    assert _is_valid_uuid4(generated), (
        f"Response X-Correlation-ID {generated!r} is not a valid UUID v4"
    )


# ===========================================================================
# Property 10: Structured log fields present on every request
# Requirements: 11.3, 11.4
# ===========================================================================

_REQUIRED_LOG_FIELDS = {
    "level",
    "timestamp",
    "message",
    "method",
    "path",
    "status_code",
    "latency_ms",
    "correlation_id",
}


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    method=st.sampled_from(["GET"]),
    # path is always /test since that's the only route on the test app
)
def test_property_10_structured_log_fields_present(method: str) -> None:
    """
    **Validates: Requirements 11.3, 11.4**

    For any request to any endpoint, the structured log entry emitted on
    request completion SHALL contain exactly these fields:
      level, timestamp, message, method, path, status_code, latency_ms,
      correlation_id.
    """
    captured: list[dict] = []
    _configure_structlog_for_testing(captured)

    app = _build_test_app()
    client = TestClient(app, raise_server_exceptions=True)

    response = client.get("/test")

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    # Find the 'request' log entry emitted by AccessLogMiddleware
    request_entries = [
        entry for entry in captured if entry.get("message") == "request"
    ]

    assert len(request_entries) >= 1, (
        f"Expected at least one 'request' log entry, captured entries: {captured}"
    )

    entry = request_entries[-1]  # Use the most recent one

    missing = _REQUIRED_LOG_FIELDS - set(entry.keys())
    assert not missing, (
        f"Log entry missing required fields: {missing}\n"
        f"Entry keys present: {set(entry.keys())}\n"
        f"Full entry: {entry}"
    )

    # Additionally verify the field values are sensible
    assert entry["level"] in ("info", "INFO"), (
        f"Expected level 'info'/'INFO', got {entry['level']!r}"
    )
    assert entry["message"] == "request", (
        f"Expected message 'request', got {entry['message']!r}"
    )
    assert entry["method"] == "GET", (
        f"Expected method 'GET', got {entry['method']!r}"
    )
    assert entry["path"] == "/test", (
        f"Expected path '/test', got {entry['path']!r}"
    )
    assert entry["status_code"] == 200, (
        f"Expected status_code 200, got {entry['status_code']!r}"
    )
    assert isinstance(entry["latency_ms"], (int, float)), (
        f"Expected latency_ms to be numeric, got {type(entry['latency_ms'])}"
    )
    assert entry["latency_ms"] >= 0, (
        f"Expected latency_ms >= 0, got {entry['latency_ms']}"
    )
    assert _is_valid_uuid4(entry["correlation_id"]), (
        f"Expected correlation_id to be a valid UUID v4, got {entry['correlation_id']!r}"
    )
    # timestamp should be a non-empty string (ISO 8601)
    assert isinstance(entry["timestamp"], str) and entry["timestamp"], (
        f"Expected timestamp to be a non-empty string, got {entry['timestamp']!r}"
    )
