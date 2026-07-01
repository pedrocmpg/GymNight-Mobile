"""
Property-based tests for rate limiting.

Feature: backend-fixes-and-improvements
Property 12: Rate limit rejects the (N+1)th request per user (Requirements 9.1, 9.2)

Property 12: For any authenticated user identity and any rate limit N (where N is the
configured limit), after exactly N requests to a rate-limited endpoint within the window,
the (N+1)th request SHALL receive HTTP 429 with a Retry-After header whose value is a
positive integer >= 1, and different user identities SHALL have independent quota windows.
"""

from __future__ import annotations

import os
import time
from typing import Any

# ---------------------------------------------------------------------------
# Environment setup — required before importing any app module
# ---------------------------------------------------------------------------

os.environ["RATE_LIMIT_ENABLED"] = "true"
os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-hypothesis-runs-x")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

import jwt as pyjwt  # noqa: E402
from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from hypothesis import HealthCheck, given  # noqa: E402
from hypothesis import settings as h_settings  # noqa: E402
from hypothesis import strategies as st  # noqa: E402
from slowapi import Limiter  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402

# Import the real key function from the production module so the test uses
# exactly the same identity-extraction logic.
from app.core.limiter import _get_rate_limit_key  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Small fixed limit so tests run fast and are easy to reason about.
_TEST_LIMIT = 3
_TEST_LIMIT_RULE = f"{_TEST_LIMIT}/minute"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_jwt(sub: str) -> str:
    """Encode a minimal JWT bearing the given *sub* claim."""
    payload = {"sub": sub, "exp": int(time.time()) + 3600}
    return pyjwt.encode(payload, "test-secret", algorithm="HS256")


def _build_test_app() -> tuple[FastAPI, Limiter]:
    """
    Build a minimal FastAPI app with its own fresh Limiter instance.

    Each call creates a brand-new Limiter with an in-memory store, so quota
    state is never shared between Hypothesis examples.

    The app registers a GET /test-rate-limit endpoint decorated with the small
    test limit and a custom RateLimitExceeded handler that mirrors what
    app/main.py does (Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining).
    """
    # A fresh in-memory store with no shared state.
    test_limiter = Limiter(
        key_func=_get_rate_limit_key,
        enabled=True,
        storage_uri="memory://",
    )

    app = FastAPI()
    app.state.limiter = test_limiter

    async def _rate_limit_exceeded_handler(
        request: Request, exc: RateLimitExceeded
    ) -> JSONResponse:
        retry_after = max(int(getattr(exc, "retry_after", 1)), 1)
        limit_obj = getattr(exc, "limit", None)
        limit_value = str(getattr(limit_obj, "limit", _TEST_LIMIT))
        remaining_value = str(getattr(limit_obj, "remaining", "0"))
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded"},
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": limit_value,
                "X-RateLimit-Remaining": remaining_value,
            },
        )

    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.get("/test-rate-limit")
    @test_limiter.limit(_TEST_LIMIT_RULE)
    def rate_limited_route(request: Request) -> dict[str, Any]:
        return {"ok": True}

    return app, test_limiter


def _auth_headers(sub: str) -> dict[str, str]:
    """Return Authorization headers for the given user identity."""
    return {"Authorization": f"Bearer {_make_jwt(sub)}"}


# ===========================================================================
# Property 12: Rate limit rejects the (N+1)th request per user
# Requirements: 9.1, 9.2
# ===========================================================================

# Feature: backend-fixes-and-improvements, Property 12: rate limit per-user independence


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    user_a_sub=st.uuids(version=4).map(str),
    user_b_sub=st.uuids(version=4).map(str),
    n_requests=st.integers(min_value=1, max_value=5),
)
def test_property_12_rate_limit_per_user_independence(
    user_a_sub: str,
    user_b_sub: str,
    n_requests: int,
) -> None:
    """
    **Validates: Requirements 9.1, 9.2**

    For any authenticated user identity and any rate limit N (where N is the
    configured limit), after exactly N requests to a rate-limited endpoint within
    the window:

    1. The (N+1)th request SHALL receive HTTP 429 with a Retry-After header whose
       value is a positive integer >= 1.
    2. Different user identities SHALL have independent quota windows — user B's
       first request SHALL succeed regardless of how many requests user A made.
    """
    # Ensure users are distinct (if Hypothesis generates the same UUID for both,
    # skip this example — it's degenerate for the isolation test).
    if user_a_sub == user_b_sub:
        return

    app, _ = _build_test_app()
    # raise_server_exceptions=False so that 429 responses come back as normal
    # responses rather than exceptions raised inside the TestClient.
    client = TestClient(app, raise_server_exceptions=False)

    headers_a = _auth_headers(user_a_sub)
    headers_b = _auth_headers(user_b_sub)

    # -----------------------------------------------------------------------
    # Phase 1: user_a sends n_requests to the rate-limited endpoint.
    # Requests within the limit (index 0 .. limit-2) must succeed with 2xx.
    # Requests at or beyond the limit (index >= limit) must return 429.
    # -----------------------------------------------------------------------
    for i in range(n_requests):
        response = client.get("/test-rate-limit", headers=headers_a)
        if i < _TEST_LIMIT:
            # Still within quota — must be 2xx
            assert response.status_code == 200, (
                f"user_a request #{i + 1} (within limit {_TEST_LIMIT}) expected 200, "
                f"got {response.status_code}. "
                f"user_a_sub={user_a_sub!r}, n_requests={n_requests}"
            )
        else:
            # Exceeded quota — must be 429 with Retry-After header
            assert response.status_code == 429, (
                f"user_a request #{i + 1} (beyond limit {_TEST_LIMIT}) expected 429, "
                f"got {response.status_code}. "
                f"user_a_sub={user_a_sub!r}, n_requests={n_requests}"
            )
            retry_after_raw = response.headers.get("Retry-After")
            assert retry_after_raw is not None, (
                f"429 response missing Retry-After header on user_a request #{i + 1}. "
                f"Response headers: {dict(response.headers)}"
            )
            retry_after = int(retry_after_raw)
            assert retry_after >= 1, (
                f"Retry-After must be >= 1, got {retry_after} on user_a request #{i + 1}."
            )

    # -----------------------------------------------------------------------
    # Phase 2: verify that, if n_requests >= limit, the request at exactly
    # index=limit (the (limit+1)th request) gets 429 with Retry-After >= 1.
    # This handles the case where n_requests < limit (we push user_a over the
    # edge explicitly to confirm enforcement).
    # -----------------------------------------------------------------------
    if n_requests < _TEST_LIMIT:
        # Exhaust remaining quota for user_a up to the limit.
        for i in range(n_requests, _TEST_LIMIT):
            r = client.get("/test-rate-limit", headers=headers_a)
            assert r.status_code == 200, (
                f"user_a fill-up request #{i + 1} expected 200, got {r.status_code}."
            )

    # Now user_a has exactly _TEST_LIMIT requests consumed — next one must be 429.
    over_limit_response = client.get("/test-rate-limit", headers=headers_a)
    assert over_limit_response.status_code == 429, (
        f"user_a's ({_TEST_LIMIT + 1})th request expected 429, "
        f"got {over_limit_response.status_code}. "
        f"user_a_sub={user_a_sub!r}"
    )
    retry_after_raw = over_limit_response.headers.get("Retry-After")
    assert retry_after_raw is not None, (
        f"429 response missing Retry-After header. "
        f"Response headers: {dict(over_limit_response.headers)}"
    )
    retry_after_value = int(retry_after_raw)
    assert retry_after_value >= 1, (
        f"Retry-After must be a positive integer >= 1, got {retry_after_value}."
    )

    # -----------------------------------------------------------------------
    # Phase 3: user_b's FIRST request must succeed (independent quota window).
    # user_a exhausting their quota SHALL NOT affect user_b's quota.
    # -----------------------------------------------------------------------
    user_b_response = client.get("/test-rate-limit", headers=headers_b)
    assert user_b_response.status_code == 200, (
        f"user_b's first request expected 200 (independent quota) but got "
        f"{user_b_response.status_code}. "
        f"user_a_sub={user_a_sub!r}, user_b_sub={user_b_sub!r}, "
        f"n_requests={n_requests}. "
        f"This indicates user quotas are NOT independent — a bug in the rate limiter."
    )
