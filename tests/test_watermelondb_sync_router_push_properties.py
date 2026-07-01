"""
Property-based tests for WatermelonDB Sync Router — Push endpoint (ownership).

Feature: watermelondb-sync-router
Properties 5, 9: Ownership scan previne writes parciais; proteção de ownership
da tabela users.

All tests use:
- SQLite in-memory database (fast, isolated, no external dependencies)
- app.dependency_overrides to mock get_current_user and get_db
- FastAPI TestClient against the new sync router at /api/v1/sync/push
- settings(max_examples=100) as specified in design document
"""

import os
import time
import uuid

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

from app.api.v1.endpoints.sync import sync_router  # noqa: E402
from app.core.limiter import limiter  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.database.connection import Base, get_db  # noqa: E402

# ---------------------------------------------------------------------------
# SQLite in-memory DB helpers (same pattern as pull properties tests)
# ---------------------------------------------------------------------------


def _make_sqlite_session_factory():
    """
    Create a fresh SQLite in-memory engine and session factory with all tables.
    Uses StaticPool to keep the same in-memory connection across all operations.
    Skips PostgreSQL-only trigger DDL to stay compatible with SQLite.
    """
    from sqlalchemy import MetaData
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Copy table definitions into a fresh MetaData to avoid PostgreSQL-only
    # event listeners registered in app/database/models/sync.py.
    sqlite_meta = MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(sqlite_meta)

    sqlite_meta.create_all(bind=engine)

    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, SessionFactory


def _build_test_client(authenticated_sub: str):
    """
    Build a FastAPI TestClient for the v1 sync router with:
    - get_current_user overridden to return authenticated_sub
    - get_db overridden to use a fresh SQLite in-memory session
    Returns (client, db_session).
    """
    # Reset the rate limiter storage so PBT examples don't accumulate hits
    # and trigger 429 after 60 examples in the same minute window.
    limiter._storage.reset()

    _engine, SessionFactory = _make_sqlite_session_factory()
    db_session = SessionFactory()

    app = FastAPI()
    app.include_router(sync_router, prefix="/api/v1")

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


def _snapshot_db(db_session) -> dict:
    """
    Capture a snapshot of the current database state for all syncable tables.
    Returns a dict mapping table_name → frozenset of row primary keys.
    Used to verify that no records were inserted or deleted.
    """
    from app.database.models import (
        Exercise,
        LoggedSet,
        User,
        Workout,
        WorkoutExercise,
        WorkoutSession,
    )

    # We expire all objects to force a fresh read from the DB
    db_session.expire_all()

    snapshot = {
        "users": frozenset(r.id for r in db_session.query(User).all()),
        "exercises": frozenset(r.id for r in db_session.query(Exercise).all()),
        "workouts": frozenset(r.id for r in db_session.query(Workout).all()),
        "workout_exercises": frozenset(r.id for r in db_session.query(WorkoutExercise).all()),
        "workout_sessions": frozenset(r.id for r in db_session.query(WorkoutSession).all()),
        "logged_sets": frozenset(r.id for r in db_session.query(LoggedSet).all()),
    }
    return snapshot


# ---------------------------------------------------------------------------
# Property 5: Ownership Scan Previne Writes Parciais
# Feature: watermelondb-sync-router, Property 5: Ownership Scan Previne Writes Parciais
# Validates: Requirements 7.1, 7.2, 7.3, 7.4
# ---------------------------------------------------------------------------

# Strategy: generate 1–4 workout names for valid records
_valid_workout_names_strategy = st.lists(
    st.text(
        min_size=1,
        max_size=30,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"),
            whitelist_characters=" -_",
        ),
    ),
    min_size=1,
    max_size=4,
)


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    other_user_id=st.uuids().map(str),
    valid_workout_names=_valid_workout_names_strategy,
)
def test_property_5_ownership_scan_prevents_partial_writes(
    auth_sub: str,
    other_user_id: str,
    valid_workout_names: list,
) -> None:
    # Feature: watermelondb-sync-router, Property 5: Ownership Scan Previne Writes Parciais
    """
    **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

    For any Push payload that contains at least one record with invalid ownership
    (any table), the endpoint must:
    1. Return HTTP 403 Forbidden
    2. Leave the database state completely unchanged — no records inserted,
       updated, or deleted (snapshot before == snapshot after)

    Strategy:
    - auth_sub: the authenticated user ID (from get_current_user)
    - other_user_id: a different user ID that triggers the ownership violation
    - valid_workout_names: names for the valid records sent alongside the invalid one

    The payload contains:
    - N valid workout records (user_id == auth_sub) → would normally succeed
    - 1 invalid workout record (user_id == other_user_id) → triggers 403

    The test verifies that even though there are valid records in the payload,
    NONE of them are persisted when the ownership scan detects the violation.
    """
    # Skip when auth_sub and other_user_id happen to be identical (no violation)
    assume(auth_sub != other_user_id)

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Seed the authenticated user (required for FK constraints in any later writes)
        _seed_user(db_session, auth_sub)
        db_session.commit()

        # Capture DB state before the push attempt
        snapshot_before = _snapshot_db(db_session)

        now_ms = int(time.time() * 1000)

        # Build valid workout records (owned by auth_sub)
        valid_created = [
            {
                "id": str(uuid.uuid4()),
                "user_id": auth_sub,
                "name": name,
                "created_at": now_ms,
                "updated_at": now_ms,
            }
            for name in valid_workout_names
        ]

        # 1 invalid record (owned by other_user_id — triggers 403)
        invalid_record = {
            "id": str(uuid.uuid4()),
            "user_id": other_user_id,  # ownership violation
            "name": "Invalid Workout",
            "created_at": now_ms,
            "updated_at": now_ms,
        }

        push_payload = {
            "changes": {
                "workouts": {
                    "created": valid_created + [invalid_record],
                    "updated": [],
                    "deleted": [],
                }
            }
        }

        response = client.post("/api/v1/sync/push", json=push_payload)

        # Must return 403
        assert response.status_code == 403, (
            f"Expected HTTP 403 for payload with invalid user_id={other_user_id!r} "
            f"(auth_sub={auth_sub!r}), got {response.status_code}. "
            f"Response={response.text[:300]}"
        )

        # Capture DB state after the push attempt
        snapshot_after = _snapshot_db(db_session)

        # DB state must be identical — no partial writes
        assert snapshot_before == snapshot_after, (
            f"Database state changed despite HTTP 403 (partial write detected). "
            f"auth_sub={auth_sub!r}, other_user_id={other_user_id!r}. "
            f"Before: {snapshot_before}. After: {snapshot_after}."
        )

    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 9: Proteção de Ownership da Tabela users
# Feature: watermelondb-sync-router, Property 9: Proteção de Ownership da Tabela users
# Validates: Requirements 10.1, 10.2, 10.3
# ---------------------------------------------------------------------------

# Strategy: which operation type to test (created, updated, deleted)
_user_operation_strategy = st.sampled_from(["created", "updated", "deleted"])


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    target_user_id=st.uuids().map(str),
    operation=_user_operation_strategy,
)
def test_property_9_users_table_ownership_protection(
    auth_sub: str,
    target_user_id: str,
    operation: str,
) -> None:
    # Feature: watermelondb-sync-router, Property 9: Proteção de Ownership da Tabela users
    """
    **Validates: Requirements 10.1, 10.2, 10.3**

    For any Push operation on the `users` table where the target record id is
    not equal to current_user_id, the endpoint must:
    1. Return HTTP 403 Forbidden
    2. Leave the database state completely unchanged — no records persisted or deleted

    Tests all three operation types:
    - created: Req 10.1 — cannot create another user's profile
    - updated: Req 10.2 — cannot update another user's profile
    - deleted: Req 10.3 — cannot delete another user's profile

    Strategy:
    - auth_sub: the authenticated user ID (from get_current_user)
    - target_user_id: the user ID in the payload — must differ from auth_sub
    - operation: "created" | "updated" | "deleted"
    """
    # Skip when auth_sub and target_user_id happen to be identical (valid scenario)
    assume(auth_sub != target_user_id)

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Seed the authenticated user (FK constraint)
        _seed_user(db_session, auth_sub)
        # Also seed target user so the record exists for updated/deleted operations
        _seed_user(db_session, target_user_id)
        db_session.commit()

        # Capture DB state before the push attempt
        snapshot_before = _snapshot_db(db_session)

        now_ms = int(time.time() * 1000)

        # Build the payload based on the operation type
        if operation == "created":
            # Req 10.1: created record with id != current_user_id → 403
            users_changes = {
                "created": [
                    {
                        "id": target_user_id,
                        "name": "Other User",
                        "email": f"{target_user_id[:8]}@other.example",
                        "created_at": now_ms,
                        "updated_at": now_ms,
                    }
                ],
                "updated": [],
                "deleted": [],
            }
        elif operation == "updated":
            # Req 10.2: updated record with id != current_user_id → 403
            users_changes = {
                "created": [],
                "updated": [
                    {
                        "id": target_user_id,
                        "name": "Modified Name",
                        "updated_at": now_ms,
                    }
                ],
                "deleted": [],
            }
        else:  # deleted
            # Req 10.3: delete ID != current_user_id → 403
            users_changes = {
                "created": [],
                "updated": [],
                "deleted": [target_user_id],
            }

        push_payload = {
            "changes": {
                "users": users_changes,
            }
        }

        response = client.post("/api/v1/sync/push", json=push_payload)

        # Must return 403
        assert response.status_code == 403, (
            f"Expected HTTP 403 for users.{operation} with "
            f"target_user_id={target_user_id!r} != auth_sub={auth_sub!r}, "
            f"got {response.status_code}. Response={response.text[:300]}"
        )

        # Capture DB state after the push attempt
        snapshot_after = _snapshot_db(db_session)

        # DB state must be identical — no partial writes
        assert snapshot_before == snapshot_after, (
            f"Database state changed despite HTTP 403 (partial write detected). "
            f"operation={operation!r}, auth_sub={auth_sub!r}, "
            f"target_user_id={target_user_id!r}. "
            f"Before: {snapshot_before}. After: {snapshot_after}."
        )

    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 6: Atomicidade do Push
# Feature: watermelondb-sync-router, Property 6: Atomicidade do Push
# Validates: Requirements 8.1, 8.2
# ---------------------------------------------------------------------------


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    workout_name=st.text(
        min_size=1,
        max_size=30,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"),
            whitelist_characters=" -_",
        ),
    ),
)
def test_property_6_push_atomicity(auth_sub: str, workout_name: str) -> None:
    # Feature: watermelondb-sync-router, Property 6: Atomicidade do Push
    """
    **Validates: Requirements 8.1, 8.2**

    When db.commit() raises an exception during a Push, the endpoint must:
    1. Return HTTP 500
    2. Leave the database state completely unchanged — no partial writes
       (the rollback path restores the original state)

    Strategy:
    - Build a valid Push payload (1 workout owned by auth_sub)
    - Patch db_session.commit to raise Exception("simulated commit failure")
    - Assert HTTP 500 is returned
    - Assert snapshot_before == snapshot_after (rollback was effective)
    """
    import unittest.mock

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Seed auth user (FK constraint for workout.user_id)
        _seed_user(db_session, auth_sub)
        db_session.commit()

        # Capture DB state before the push attempt
        snapshot_before = _snapshot_db(db_session)

        now_ms = int(time.time() * 1000)

        push_payload = {
            "changes": {
                "workouts": {
                    "created": [
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": auth_sub,
                            "name": workout_name,
                            "created_at": now_ms,
                            "updated_at": now_ms,
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                }
            }
        }

        # Patch commit to simulate a DB failure after all writes are staged
        with unittest.mock.patch.object(
            db_session,
            "commit",
            side_effect=Exception("simulated commit failure"),
        ):
            response = client.post("/api/v1/sync/push", json=push_payload)

        # Must return 500
        assert response.status_code == 500, (
            f"Expected HTTP 500 when commit fails, got {response.status_code}. "
            f"auth_sub={auth_sub!r}, workout_name={workout_name!r}. "
            f"Response={response.text[:300]}"
        )

        # Capture DB state after the failed push
        snapshot_after = _snapshot_db(db_session)

        # DB state must be identical — rollback restored original state
        assert snapshot_before == snapshot_after, (
            f"Database state changed despite HTTP 500 (partial write not rolled back). "
            f"auth_sub={auth_sub!r}, workout_name={workout_name!r}. "
            f"Before: {snapshot_before}. After: {snapshot_after}."
        )

    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 7: Idempotência de Criações no Push
# Feature: watermelondb-sync-router, Property 7: Idempotência de Criações no Push
# Validates: Requirement 9.1
# ---------------------------------------------------------------------------


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    record_id=st.uuids().map(str),
)
def test_property_7_push_create_idempotent(auth_sub: str, record_id: str) -> None:
    # Feature: watermelondb-sync-router, Property 7: Idempotência de Criações no Push
    """
    **Validates: Requirement 9.1**

    Sending the same `created` record twice to /api/v1/sync/push must be
    idempotent: the second push returns HTTP 200 and no duplicate rows are
    inserted (count == 1 for both workouts and exercises).

    Tested tables:
    - workouts  : requires user_id (set to auth_sub)
    - exercises : shared catalogue, no user_id
    """
    from app.database.models import Exercise, Workout

    # Use separate record IDs for workout and exercise to avoid ID collision
    workout_id = record_id
    exercise_id = str(uuid.uuid4())

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Seed auth user (FK constraint for workout.user_id)
        _seed_user(db_session, auth_sub)
        db_session.commit()

        now_ms = int(time.time() * 1000)

        workout_record = {
            "id": workout_id,
            "user_id": auth_sub,
            "name": "Idempotent Workout",
            "created_at": now_ms,
            "updated_at": now_ms,
        }

        exercise_record = {
            "id": exercise_id,
            "name": "Idempotent Exercise",
            "created_at": now_ms,
            "updated_at": now_ms,
        }

        push_payload = {
            "changes": {
                "workouts": {
                    "created": [workout_record],
                    "updated": [],
                    "deleted": [],
                },
                "exercises": {
                    "created": [exercise_record],
                    "updated": [],
                    "deleted": [],
                },
            }
        }

        # First push — must succeed
        response1 = client.post("/api/v1/sync/push", json=push_payload)
        assert response1.status_code == 200, (
            f"Expected HTTP 200 on first push, got {response1.status_code}. "
            f"auth_sub={auth_sub!r}, workout_id={workout_id!r}. "
            f"Response={response1.text[:300]}"
        )

        # Second push with identical payload — must also succeed (idempotent)
        response2 = client.post("/api/v1/sync/push", json=push_payload)
        assert response2.status_code == 200, (
            f"Expected HTTP 200 on second (duplicate) push, got {response2.status_code}. "
            f"auth_sub={auth_sub!r}, workout_id={workout_id!r}. "
            f"Response={response2.text[:300]}"
        )

        # Verify no duplicates: each record must appear exactly once
        db_session.expire_all()

        workout_count = (
            db_session.query(Workout).filter(Workout.id == workout_id).count()
        )
        assert workout_count == 1, (
            f"Expected exactly 1 Workout with id={workout_id!r} after two identical pushes, "
            f"got {workout_count}. auth_sub={auth_sub!r}."
        )

        exercise_count = (
            db_session.query(Exercise).filter(Exercise.id == exercise_id).count()
        )
        assert exercise_count == 1, (
            f"Expected exactly 1 Exercise with id={exercise_id!r} after two identical pushes, "
            f"got {exercise_count}. auth_sub={auth_sub!r}."
        )

    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 8: user_id Padrão em Criações
# Feature: watermelondb-sync-router, Property 8: user_id Padrão em Criações
# Validates: Requirement 9.11
# ---------------------------------------------------------------------------


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    workout_id=st.uuids().map(str),
    session_id=st.uuids().map(str),
)
def test_property_8_default_user_id_on_create(
    auth_sub: str, workout_id: str, session_id: str
) -> None:
    # Feature: watermelondb-sync-router, Property 8: user_id Padrão em Criações
    """
    **Validates: Requirement 9.11**

    When a `created` record for `workouts` or `workout_sessions` is sent
    WITHOUT a `user_id` field, the endpoint must automatically assign
    user_id = current_user_id before persisting to the database.

    Tested tables:
    - workouts         : omit user_id → db row must have user_id == auth_sub
    - workout_sessions : omit user_id → db row must have user_id == auth_sub
                         (workout_id is nullable so it is omitted too;
                          started_at is required and is included)
    """
    from app.database.models import Workout, WorkoutSession

    # Skip when workout_id and session_id collide (extremely rare, but guard it)
    assume(workout_id != session_id)

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Seed auth user (FK constraint)
        _seed_user(db_session, auth_sub)
        db_session.commit()

        now_ms = int(time.time() * 1000)

        # Workout record WITHOUT user_id field
        workout_record = {
            "id": workout_id,
            "name": "No UserID Workout",
            "created_at": now_ms,
            "updated_at": now_ms,
            # user_id intentionally omitted
        }

        # WorkoutSession record WITHOUT user_id field
        # workout_id is nullable — omitted; started_at is required
        session_record = {
            "id": session_id,
            "started_at": now_ms,
            "created_at": now_ms,
            "updated_at": now_ms,
            # user_id intentionally omitted
            # workout_id intentionally omitted (nullable)
        }

        push_payload = {
            "changes": {
                "workouts": {
                    "created": [workout_record],
                    "updated": [],
                    "deleted": [],
                },
                "workout_sessions": {
                    "created": [session_record],
                    "updated": [],
                    "deleted": [],
                },
            }
        }

        response = client.post("/api/v1/sync/push", json=push_payload)
        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}. "
            f"auth_sub={auth_sub!r}, workout_id={workout_id!r}, "
            f"session_id={session_id!r}. Response={response.text[:300]}"
        )

        db_session.expire_all()

        # Assert workout.user_id was set to auth_sub automatically
        workout = db_session.query(Workout).filter(Workout.id == workout_id).first()
        assert workout is not None, (
            f"Workout with id={workout_id!r} not found after push. "
            f"auth_sub={auth_sub!r}."
        )
        assert workout.user_id == auth_sub, (
            f"Expected Workout.user_id={auth_sub!r} (default from token), "
            f"got {workout.user_id!r}. workout_id={workout_id!r}."
        )

        # Assert workout_session.user_id was set to auth_sub automatically
        session = (
            db_session.query(WorkoutSession)
            .filter(WorkoutSession.id == session_id)
            .first()
        )
        assert session is not None, (
            f"WorkoutSession with id={session_id!r} not found after push. "
            f"auth_sub={auth_sub!r}."
        )
        assert session.user_id == auth_sub, (
            f"Expected WorkoutSession.user_id={auth_sub!r} (default from token), "
            f"got {session.user_id!r}. session_id={session_id!r}."
        )

    finally:
        db_session.close()
