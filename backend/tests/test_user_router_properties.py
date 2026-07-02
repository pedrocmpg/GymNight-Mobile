"""
Property-based tests for the User Router (POST /users).

Feature: supabase-migration
Properties 6–7: Request body validation and profile creation behavior

All tests use a minimal FastAPI test app (no DB connection required) with
fully mocked dependencies for get_current_user and get_db.
"""

import os
import time
from datetime import date
from unittest.mock import MagicMock

import jwt as pyjwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Environment setup — must be done before importing any app modules
# ---------------------------------------------------------------------------

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-hypothesis-runs-x")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.core.security import get_current_user  # noqa: E402
from app.database.connection import get_db       # noqa: E402
from app.routers import users                    # noqa: E402
import app.routers.users as users_module         # noqa: E402

# Save original User class to restore after each monkey-patch
_ORIGINAL_USER_CLASS = users_module.models.User

# ---------------------------------------------------------------------------
# Test constants and helpers
# ---------------------------------------------------------------------------

TEST_SECRET = "test-secret-for-hypothesis-runs-x"  # 32+ bytes
TEST_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


def make_token(sub: str, exp_delta_seconds: int = 3600, secret: str = TEST_SECRET) -> str:
    """Encode a JWT with the given sub and expiry offset."""
    payload = {"sub": sub, "exp": int(time.time()) + exp_delta_seconds}
    return pyjwt.encode(payload, secret, algorithm="HS256")


# ---------------------------------------------------------------------------
# Minimal test app factory
# ---------------------------------------------------------------------------

class _FakeUser:
    """Lightweight stand-in for the SQLAlchemy User model in tests."""

    def __init__(self, user_id: str, **kwargs):
        self.id = user_id
        self.name = kwargs.get("name")
        self.weight = kwargs.get("weight")
        self.height = kwargs.get("height")
        self.birth_date = kwargs.get("birth_date")
        self.gender = kwargs.get("gender")


def _build_test_client() -> tuple[TestClient, MagicMock, MagicMock]:
    """
    Create a test FastAPI app with:
    - Only the users router (no DB create_all at startup)
    - get_current_user overridden to always return TEST_UUID
    - get_db overridden to return a MagicMock session
    - models.User monkey-patched to return _FakeUser instances

    Returns: (client, mock_session, mock_user_class)
    """
    app = FastAPI()
    app.include_router(users.router)

    # Override auth dependency — always returns a fixed UUID
    app.dependency_overrides[get_current_user] = lambda: TEST_UUID

    # Build a mock User class: acts like a callable constructor but returns
    # _FakeUser objects instead of real SQLAlchemy instances
    mock_user_class = MagicMock()
    mock_user_class.side_effect = lambda **kw: _FakeUser(TEST_UUID, **kw)
    # .id attribute must be accessible for filter(models.User.id == ...)
    mock_user_class.id = MagicMock()

    # Build a mock DB session
    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = None
    mock_session.add = MagicMock()
    mock_session.commit = MagicMock()
    mock_session.refresh = MagicMock()  # no-op; _FakeUser attributes already set

    app.dependency_overrides[get_db] = lambda: mock_session

    # Patch models.User in the users router so the real User constructor is bypassed
    users_module.models.User = mock_user_class

    client = TestClient(app, raise_server_exceptions=False)

    # NOTE: The patch is active during HTTP requests made via client.
    # Callers are responsible for restoring _ORIGINAL_USER_CLASS after use.
    return client, mock_session, mock_user_class


# ---------------------------------------------------------------------------
# Property 6: Request body with `password` field always returns HTTP 422
# Validates: Requirements 6.5
# ---------------------------------------------------------------------------

# Strategies for the other optional profile fields
_optional_profile_fields = st.fixed_dictionaries(
    {},
    optional={
        "name": st.text(min_size=1, max_size=100),
        "weight": st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False),
        "height": st.floats(min_value=50.0, max_value=300.0, allow_nan=False, allow_infinity=False),
        "birth_date": st.dates(max_value=date.today()).map(lambda d: d.isoformat()),
        "gender": st.sampled_from(["male", "female", "other"]),
    },
)


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    password_value=st.text(),
    extra_fields=_optional_profile_fields,
)
def test_property_6_password_field_returns_422(
    password_value: str,
    extra_fields: dict,
) -> None:
    # Feature: supabase-migration, Property 6: password field always returns HTTP 422
    """
    **Validates: Requirements 6.5**

    For any JSON request body sent to the POST /users endpoint that contains
    a `password` field (regardless of other fields present), the system must
    return HTTP 422 Unprocessable Entity.

    The schema UserProfileCreate uses `extra="forbid"` (ConfigDict) to reject
    any field not declared in the model, so `password` is always rejected at
    the Pydantic validation layer — before any auth or DB logic runs.
    """
    client, _, _ = _build_test_client()

    body = {**extra_fields, "password": password_value}
    response = client.post("/users", json=body)

    # Restore the original User class to prevent leaking the mock to other tests
    users_module.models.User = _ORIGINAL_USER_CLASS

    assert response.status_code == 422, (
        f"Expected HTTP 422 for body with 'password' field, "
        f"got {response.status_code}. Body={body!r}, Response={response.text[:200]}"
    )


# ---------------------------------------------------------------------------
# Property 7: Valid profile subset always accepted (HTTP 200 or 201)
# Validates: Requirements 6.4
# ---------------------------------------------------------------------------

# Strategy: generate a non-empty subset of the five allowed profile fields
# with values within the documented valid limits.
# NOTE: `name` is required by UserProfileCreate (POST /users), so it is
# placed in the mandatory dict. The remaining four fields are optional.
_valid_profile_subset = st.fixed_dictionaries(
    {
        "name": st.text(min_size=1, max_size=100),
    },
    optional={
        "weight": st.floats(
            min_value=1.0, max_value=500.0,
            allow_nan=False, allow_infinity=False,
        ),
        "height": st.floats(
            min_value=50.0, max_value=300.0,
            allow_nan=False, allow_infinity=False,
        ),
        "birth_date": st.dates(max_value=date.today()).map(lambda d: d.isoformat()),
        "gender": st.sampled_from(["male", "female", "other"]),
    },
)


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(profile_fields=_valid_profile_subset)
def test_property_7_valid_profile_subset_accepted(profile_fields: dict) -> None:
    # Feature: supabase-migration, Property 7: valid profile subset always accepted
    """
    **Validates: Requirements 6.4**

    For any combination of {name (required), weight, height, birth_date, gender}
    with values within valid limits, and accompanied by a valid JWT (mocked via
    dependency override), the request to POST /users must succeed with HTTP 200
    or 201.

    `name` is always present because UserProfileCreate declares it as a required
    field — omitting it triggers HTTP 422, which is correct per the schema design
    but outside the scope of this property test.

    - get_current_user is overridden to return a fixed UUID (no real JWT needed)
    - get_db is overridden with a MagicMock session (no real DB needed)
    - models.User is patched to avoid SQLAlchemy column constraints
    """
    client, mock_session, _ = _build_test_client()

    # Ensure each call sees a fresh "no existing user" state
    mock_session.query.return_value.filter.return_value.first.return_value = None

    response = client.post("/users", json=profile_fields)

    # Restore the original User class to prevent leaking the mock to other tests
    users_module.models.User = _ORIGINAL_USER_CLASS

    assert response.status_code in (200, 201), (
        f"Expected HTTP 200 or 201 for valid profile subset {profile_fields!r}, "
        f"got {response.status_code}. Response={response.text[:300]}"
    )
