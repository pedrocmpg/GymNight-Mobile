"""
Integration tests for POST, GET, and PATCH /users endpoints.

Requirements: 13.1, 13.5, 13.6

These tests run against a real PostgreSQL instance (TEST_DATABASE_URL must be
set).  Each test operates inside the transaction that the `db_transaction`
fixture (defined in conftest.py) opens; the transaction is rolled back at the
end of each test so tests are fully isolated from one another.

Dependency override strategy:
  - `get_db` is overridden to return the `db_transaction` session so that the
    router writes to the same open (uncommitted) transaction that the test can
    inspect directly.
  - `get_current_user` is overridden to return a known user ID string, bypassing
    the real Supabase JWT validation.

Note on the `email` field:
  The `users` table has `email VARCHAR(255) NOT NULL UNIQUE`.  Integration tests
  must supply a valid, unique email when pre-inserting User rows.
"""

import os
import uuid

import pytest
from fastapi.testclient import TestClient

# Ensure required env vars are set before importing app modules.
os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database import models  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.core.security import get_current_user, get_current_user_email  # noqa: E402
from app.main import app  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _unique_id() -> str:
    """Generate a fresh UUID string for use as a user ID."""
    return str(uuid.uuid4())


def _unique_email() -> str:
    """Generate a unique email address to satisfy the UNIQUE constraint."""
    return f"test-{uuid.uuid4().hex[:8]}@integration-test.local"


def _make_client(db_session, user_id: str, email: str | None = None) -> TestClient:
    """
    Return a TestClient with all key dependencies overridden:
      - get_current_user       → returns `user_id` (skips JWT validation)
      - get_current_user_email → returns `email` (skips JWT validation)
      - get_db                 → yields `db_session` (the per-test transactional session)
    """
    app.dependency_overrides[get_current_user] = lambda: user_id
    app.dependency_overrides[get_current_user_email] = lambda: email or _unique_email()
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app, raise_server_exceptions=True)


def _cleanup_overrides():
    """Remove dependency overrides after a test to avoid cross-test pollution."""
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_email, None)
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Test 1: POST /users creates a profile row in the database
# (Requirements 13.1, 13.5, 13.6 — real DB write + read verification)
# ---------------------------------------------------------------------------


def test_post_users_creates_profile(db_transaction):
    """
    Insert a user profile via POST /users, then query the DB session directly
    to verify the row was persisted with the correct field values.

    This test uses the real PostgreSQL database (no mocks on the DB layer).
    """
    user_id = _unique_id()
    user_email = _unique_email()
    client = _make_client(db_transaction, user_id, email=user_email)

    payload = {
        "name": "Alice Integration",
        "weight": 65.5,
        "height": 170.0,
        "birth_date": "1990-06-15",
        "gender": "female",
    }

    try:
        response = client.post("/users", json=payload)
        assert response.status_code == 201, (
            f"Expected 201, got {response.status_code}: {response.text}"
        )

        # Verify the response body contains the persisted field values
        body = response.json()
        assert body["id"] == user_id
        assert body["name"] == payload["name"]
        assert body["email"] == user_email
        assert abs(body["weight"] - payload["weight"]) < 1e-6
        assert abs(body["height"] - payload["height"]) < 1e-6
        assert body["birth_date"] == payload["birth_date"]
        assert body["gender"] == payload["gender"]

        # Flush so the row is visible within this transaction
        db_transaction.flush()

        # Query the DB directly (same transactional session) to confirm the row
        db_user = (
            db_transaction.query(models.User)
            .filter(models.User.id == user_id)
            .first()
        )
        assert db_user is not None, "User row not found in DB after POST /users"
        assert db_user.name == payload["name"]
        assert db_user.email == user_email
        assert abs(db_user.weight - payload["weight"]) < 1e-6
        assert abs(db_user.height - payload["height"]) < 1e-6
        assert db_user.birth_date == payload["birth_date"]
        assert db_user.gender == payload["gender"]

    finally:
        _cleanup_overrides()


# ---------------------------------------------------------------------------
# Test 2: GET /users/me returns the pre-inserted profile
# (Requirements 13.1, 13.5, 13.6 — real DB read)
# ---------------------------------------------------------------------------


def test_get_users_me_returns_profile(db_transaction):
    """
    Pre-insert a User row via the ORM session, then call GET /users/me with a
    JWT sub that matches the inserted user's ID, and verify the response body
    contains all correct field values.

    This test uses the real PostgreSQL database (no mocks on the DB layer).
    """
    user_id = _unique_id()

    # Pre-insert a user row directly into the transactional session
    user = models.User(
        id=user_id,
        name="Bob Integration",
        email=_unique_email(),
        weight=80.0,
        height=180.0,
        birth_date="1985-03-22",
        gender="male",
    )
    db_transaction.add(user)
    db_transaction.flush()  # write within the open transaction

    client = _make_client(db_transaction, user_id)

    try:
        response = client.get("/users/me")
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        body = response.json()
        assert body["id"] == user_id
        assert body["name"] == "Bob Integration"
        assert abs(body["weight"] - 80.0) < 1e-6
        assert abs(body["height"] - 180.0) < 1e-6
        assert body["birth_date"] == "1985-03-22"
        assert body["gender"] == "male"

    finally:
        _cleanup_overrides()


# ---------------------------------------------------------------------------
# Test 3: PATCH /users/me updates only the fields present in the payload
# (Requirements 13.1, 13.5, 13.6 — real DB read-after-write verification)
# ---------------------------------------------------------------------------


def test_patch_users_me_partial_update(db_transaction):
    """
    Pre-insert a User row, send PATCH /users/me with only a subset of fields,
    and verify:
      - The response returns HTTP 200 with the complete updated profile.
      - Only the sent fields changed in the DB row.
      - Fields absent from the payload remain unchanged.

    This test uses the real PostgreSQL database (no mocks on the DB layer).
    """
    user_id = _unique_id()

    # Pre-insert user with known initial values
    user = models.User(
        id=user_id,
        name="Charlie Integration",
        email=_unique_email(),
        weight=75.0,
        height=175.0,
        birth_date="1992-11-10",
        gender="other",
    )
    db_transaction.add(user)
    db_transaction.flush()

    client = _make_client(db_transaction, user_id)

    # Only update `name` and `weight`; leave height, birth_date, gender untouched
    patch_payload = {
        "name": "Charlie Updated",
        "weight": 78.5,
    }

    try:
        response = client.patch("/users/me", json=patch_payload)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        body = response.json()
        assert body["id"] == user_id

        # Sent fields must reflect the new values
        assert body["name"] == "Charlie Updated"
        assert abs(body["weight"] - 78.5) < 1e-6

        # Fields not in the payload must remain as originally inserted
        assert abs(body["height"] - 175.0) < 1e-6
        assert body["birth_date"] == "1992-11-10"
        assert body["gender"] == "other"

        # Confirm the DB row matches (expunge + re-query to bypass session cache)
        db_transaction.expire(user)
        db_user = (
            db_transaction.query(models.User)
            .filter(models.User.id == user_id)
            .first()
        )
        assert db_user is not None
        assert db_user.name == "Charlie Updated"
        assert abs(db_user.weight - 78.5) < 1e-6
        assert abs(db_user.height - 175.0) < 1e-6
        assert db_user.birth_date == "1992-11-10"
        assert db_user.gender == "other"

    finally:
        _cleanup_overrides()


# ---------------------------------------------------------------------------
# Property 13: Integration test isolation — no state leaks between tests
# (Requirement 13.7)
# ---------------------------------------------------------------------------

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st


@given(st.integers(min_value=1, max_value=20))
@settings(max_examples=200, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_property_13_no_state_leaks(db_transaction, n):
    """
    **Validates: Requirements 13.7**

    Property 13: For any sequence of n sequential operations, each operation
    starts with a clean database state — no rows from prior operations leak
    into the next operation.

    Strategy: simulate n independent "test runs" within a single test by using
    SAVEPOINTs (begin_nested / rollback). Each iteration:
      1. Creates a SAVEPOINT.
      2. Verifies the generated user_id does NOT already exist (clean state).
      3. Inserts a User row and flushes it.
      4. Verifies the row EXISTS within the SAVEPOINT.
      5. Rolls back to the SAVEPOINT (removes the row).
      6. Verifies the row is GONE (no state leaked to the next iteration).
    """
    for _ in range(n):
        user_id = _unique_id()

        # Step 1: Create a SAVEPOINT so this iteration is fully isolated.
        nested = db_transaction.begin_nested()

        try:
            # Step 2: Verify clean state — the generated ID must not exist yet.
            pre_existing = (
                db_transaction.query(models.User)
                .filter(models.User.id == user_id)
                .first()
            )
            assert pre_existing is None, (
                f"State leak detected: user {user_id} already existed before insertion"
            )

            # Step 3: Insert a User row and flush within the SAVEPOINT.
            user = models.User(
                id=user_id,
                name="Isolation Test User",
                email=_unique_email(),
                weight=70.0,
                height=170.0,
                birth_date="1990-01-01",
                gender="other",
            )
            db_transaction.add(user)
            db_transaction.flush()

            # Step 4: Verify the row exists within the SAVEPOINT.
            inserted = (
                db_transaction.query(models.User)
                .filter(models.User.id == user_id)
                .first()
            )
            assert inserted is not None, (
                f"Insert failed: user {user_id} not found after flush"
            )
            assert inserted.id == user_id

        finally:
            # Step 5: Roll back to the SAVEPOINT — the row is removed.
            nested.rollback()

        # Step 6: Verify the row is gone — no state leak to the next iteration.
        post_rollback = (
            db_transaction.query(models.User)
            .filter(models.User.id == user_id)
            .first()
        )
        assert post_rollback is None, (
            f"State leak after rollback: user {user_id} still exists"
        )
