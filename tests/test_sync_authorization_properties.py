"""
Property-based tests for Sync Authorization (POST /sync/push and GET /sync/pull).

Feature: supabase-migration
Properties 8–9: Multi-tenant authorization in WatermelonDB sync routes

All tests use:
- SQLite in-memory database (fast, isolated, no external dependencies)
- app.dependency_overrides to mock get_current_user and get_db
- FastAPI TestClient against the actual sync router
"""

import os
import time
import uuid

import jwt as pyjwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, assume, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Environment setup — must be done before importing any app modules
# ---------------------------------------------------------------------------

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-hypothesis-runs-x")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.core.security import get_current_user  # noqa: E402
from app.database.connection import Base, get_db  # noqa: E402
from app.routers import sync as sync_module  # noqa: E402

# ---------------------------------------------------------------------------
# Test constants and helpers
# ---------------------------------------------------------------------------

TEST_SECRET = "test-secret-for-hypothesis-runs-x"  # 32+ bytes


def make_token(sub: str, exp_delta_seconds: int = 3600, secret: str = TEST_SECRET) -> str:
    """Encode a JWT with the given sub and expiry offset."""
    payload = {"sub": sub, "exp": int(time.time()) + exp_delta_seconds}
    return pyjwt.encode(payload, secret, algorithm="HS256")


def _make_sqlite_session_factory():
    """
    Create a fresh SQLite in-memory engine and session factory with all tables.

    Each call returns a new (engine, SessionFactory) pair so each test gets a
    completely isolated database — no state leaks between Hypothesis examples.

    Creates tables using each table's own DDL without firing the PostgreSQL-only
    trigger DDL events that are registered on Base.metadata. This is achieved by
    executing CREATE TABLE statements directly on the SQLite engine using the
    per-table metadata rather than going through Base.metadata.create_all().

    Uses a static single connection to ensure the in-memory SQLite DB is shared
    across all operations on the same engine (SQLite :memory: creates a new empty
    DB for each new connection).
    """
    from sqlalchemy import MetaData, event as sa_event
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # Reuse the same in-memory connection for all requests
    )

    # Create a clean MetaData instance and copy table definitions without
    # inheriting the PostgreSQL-only after_create event listeners registered
    # in app/database/models/sync.py (trigger function + AFTER DELETE triggers).
    sqlite_meta = MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(sqlite_meta)

    sqlite_meta.create_all(bind=engine)

    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, SessionFactory


def _build_test_client(authenticated_sub: str):
    """
    Build a TestClient for the sync router with:
    - get_current_user overridden to return `authenticated_sub`
    - get_db overridden to use a fresh SQLite in-memory session
    - Returns (client, db_session) so tests can inspect/seed the database
    """
    _engine, SessionFactory = _make_sqlite_session_factory()

    db_session = SessionFactory()

    app = FastAPI()
    app.include_router(sync_module.router)

    app.dependency_overrides[get_current_user] = lambda: authenticated_sub
    app.dependency_overrides[get_db] = lambda: db_session

    client = TestClient(app, raise_server_exceptions=False)
    return client, db_session


# ---------------------------------------------------------------------------
# Database seed helpers
# ---------------------------------------------------------------------------

def _seed_user(db_session, user_id: str) -> None:
    """Insert a minimal User row required by FK constraints."""
    from app.database.models import User

    now_ms = int(time.time() * 1000)
    user = User(
        id=user_id,
        name=f"User {user_id[:8]}",
        email=f"{user_id[:8]}@test.example",
        created_at=now_ms,
        updated_at=now_ms,
    )
    db_session.add(user)
    db_session.flush()


def _seed_workout(db_session, workout_id: str, user_id: str) -> None:
    """Insert a Workout row owned by user_id."""
    from app.database.models import Workout

    now_ms = int(time.time() * 1000)
    workout = Workout(
        id=workout_id,
        user_id=user_id,
        name=f"Workout {workout_id[:8]}",
        created_at=now_ms,
        updated_at=now_ms,
    )
    db_session.add(workout)
    db_session.flush()


# ---------------------------------------------------------------------------
# Property 8: Push rejects records with user_id diverging from JWT sub
# Validates: Requirements 7.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    payload_user_id=st.uuids().map(str),
)
def test_property_8_push_rejects_divergent_user_id(
    auth_sub: str,
    payload_user_id: str,
) -> None:
    # Feature: supabase-migration, Property 8: push rejects records with user_id diverging from JWT sub
    """
    **Validates: Requirements 7.4**

    For any WatermelonDB push payload that contains at least one record whose
    `user_id` is different from the authenticated JWT `sub` claim, the system
    must return HTTP 403 Forbidden and not persist any records from that request.

    Strategy:
    - auth_sub: the UUID returned by the mocked get_current_user dependency
    - payload_user_id: the user_id inside the push record (must differ from auth_sub)
    - Both are generated independently via st.uuids() — Hypothesis will sometimes
      generate equal values, which are skipped via assume().
    - The test verifies HTTP 403 is returned.
    - It also verifies that no workout record was persisted in the SQLite DB.
    """
    # Skip cases where the two UUIDs happen to be identical (valid push scenario)
    assume(auth_sub != payload_user_id)

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    record_id = str(uuid.uuid4())

    push_payload = {
        "changes": {
            "workouts": {
                "created": [
                    {
                        "id": record_id,
                        "user_id": payload_user_id,  # diverges from auth_sub
                        "name": "Test Workout",
                        "created_at": int(time.time() * 1000),
                        "updated_at": int(time.time() * 1000),
                    }
                ],
                "updated": [],
                "deleted": [],
            }
        }
    }

    response = client.post("/sync/push", json=push_payload)

    assert response.status_code == 403, (
        f"Expected HTTP 403 for push with user_id={payload_user_id!r} "
        f"diverging from auth_sub={auth_sub!r}, "
        f"got {response.status_code}. Response={response.text[:300]}"
    )

    # Verify no record was persisted (implicit rollback)
    from app.database.models import Workout

    persisted = db_session.query(Workout).filter(Workout.id == record_id).first()
    assert persisted is None, (
        f"Record {record_id!r} was persisted in the database despite HTTP 403. "
        f"auth_sub={auth_sub!r}, payload_user_id={payload_user_id!r}"
    )

    db_session.close()


# ---------------------------------------------------------------------------
# Property 9: Pull returns only records belonging to the authenticated user
# Validates: Requirements 7.5
# ---------------------------------------------------------------------------

# Strategy for generating a list of (user_id, workout_name) pairs
_workout_records_strategy = st.lists(
    st.tuples(
        st.uuids().map(str),   # owner user_id
        st.text(min_size=1, max_size=50, alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"),
            whitelist_characters=" -_",
        )),  # workout name (printable, safe for DB)
    ),
    min_size=2,
    max_size=10,
)


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    other_records=_workout_records_strategy,
)
def test_property_9_pull_returns_only_authenticated_user_records(
    auth_sub: str,
    other_records: list,
) -> None:
    # Feature: supabase-migration, Property 9: pull returns only records of the authenticated user
    """
    **Validates: Requirements 7.5**

    For any database state containing workout records from multiple users,
    an authenticated pull request as user `U` (auth_sub) must return only
    workout records whose `user_id` equals the `sub` of U's JWT — never
    records owned by other users.

    Strategy:
    - auth_sub: the UUID returned by the mocked get_current_user dependency
    - other_records: a list of (user_id, workout_name) pairs seeded into the DB.
      At least one record will have user_id != auth_sub (enforced via assume()).

    The test verifies that the pull response contains only workouts owned by
    auth_sub, and that workouts owned by other users are absent from the result.
    """
    # Ensure at least one record in the DB belongs to a different user
    other_user_ids = {uid for uid, _ in other_records}
    assume(any(uid != auth_sub for uid in other_user_ids))

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    now_ms = int(time.time() * 1000)

    # Seed the authenticated user first (FK constraint)
    _seed_user(db_session, auth_sub)

    # Track which workout IDs belong to auth_sub and which to others
    auth_workout_ids: set[str] = set()
    other_workout_ids: set[str] = set()

    seen_user_ids: set[str] = set()
    seen_user_ids.add(auth_sub)

    for idx, (owner_uid, workout_name) in enumerate(other_records):
        # Seed the owner user if not yet seeded
        if owner_uid not in seen_user_ids:
            _seed_user(db_session, owner_uid)
            seen_user_ids.add(owner_uid)

        workout_id = str(uuid.uuid4())

        _seed_workout(db_session, workout_id, owner_uid)

        if owner_uid == auth_sub:
            auth_workout_ids.add(workout_id)
        else:
            other_workout_ids.add(workout_id)

    db_session.commit()

    # Issue pull starting from timestamp 0 so all records are returned
    response = client.get("/sync/pull?last_pulled_at=0")

    assert response.status_code == 200, (
        f"Expected HTTP 200 from pull, got {response.status_code}. "
        f"Response={response.text[:300]}"
    )

    body = response.json()
    returned_workouts = body.get("changes", {}).get("workouts", {})
    # WatermelonDB pull returns records in the "updated" list
    returned_ids = {r["id"] for r in returned_workouts.get("updated", [])}

    # All returned workouts must belong to auth_sub
    for wid in returned_ids:
        assert wid not in other_workout_ids, (
            f"Pull returned workout {wid!r} which belongs to another user. "
            f"auth_sub={auth_sub!r}, other_workout_ids={other_workout_ids!r}"
        )

    # All workouts that belong to auth_sub must be returned
    for wid in auth_workout_ids:
        assert wid in returned_ids, (
            f"Pull did NOT return workout {wid!r} which belongs to auth_sub={auth_sub!r}. "
            f"returned_ids={returned_ids!r}"
        )

    db_session.close()
