"""
Property-based tests for WatermelonDB Sync Router — Pull endpoint.

Feature: watermelondb-sync-router
Properties 1–4: Response completeness, created/updated classification,
multi-tenant isolation, and tombstone isolation.

All tests use:
- SQLite in-memory database (fast, isolated, no external dependencies)
- app.dependency_overrides to mock get_current_user and get_db
- FastAPI TestClient against the new sync router at /api/v1/sync/pull
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
from app.core.security import get_current_user  # noqa: E402
from app.database.connection import Base, get_db  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REQUIRED_TABLES = {
    "users",
    "exercises",
    "workouts",
    "workout_exercises",
    "workout_sessions",
    "logged_sets",
}

REQUIRED_TABLE_KEYS = {"created", "updated", "deleted"}

# ---------------------------------------------------------------------------
# SQLite in-memory DB helpers (same pattern as test_sync_authorization_properties.py)
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


def _seed_user(db_session, user_id: str, created_at: int = None, updated_at: int = None) -> None:
    """Insert a minimal User row."""
    from app.database.models import User

    now_ms = int(time.time() * 1000)
    user = User(
        id=user_id,
        name=f"User {user_id[:8]}",
        email=f"{user_id[:8]}@test.example",
        created_at=created_at if created_at is not None else now_ms,
        updated_at=updated_at if updated_at is not None else now_ms,
    )
    db_session.add(user)
    db_session.flush()


def _seed_workout(
    db_session,
    workout_id: str,
    user_id: str,
    created_at: int = None,
    updated_at: int = None,
) -> None:
    """Insert a Workout row owned by user_id with explicit timestamps."""
    from app.database.models import Workout

    now_ms = int(time.time() * 1000)
    workout = Workout(
        id=workout_id,
        user_id=user_id,
        name=f"Workout {workout_id[:8]}",
        created_at=created_at if created_at is not None else now_ms,
        updated_at=updated_at if updated_at is not None else now_ms,
    )
    db_session.add(workout)
    db_session.flush()


def _seed_workout_session(
    db_session,
    session_id: str,
    user_id: str,
    created_at: int = None,
    updated_at: int = None,
) -> None:
    """Insert a WorkoutSession row owned by user_id."""
    from app.database.models import WorkoutSession

    now_ms = int(time.time() * 1000)
    ws = WorkoutSession(
        id=session_id,
        user_id=user_id,
        started_at=now_ms,
        created_at=created_at if created_at is not None else now_ms,
        updated_at=updated_at if updated_at is not None else now_ms,
    )
    db_session.add(ws)
    db_session.flush()


def _seed_tombstone(
    db_session,
    tombstone_id: str,
    table_name: str,
    record_id: str,
    user_id,  # str or None
    deleted_at: int,
) -> None:
    """Insert a DeletedRecord (tombstone) row."""
    from app.database.models import DeletedRecord

    dr = DeletedRecord(
        id=tombstone_id,
        table_name=table_name,
        record_id=record_id,
        user_id=user_id,
        deleted_at=deleted_at,
    )
    db_session.add(dr)
    db_session.flush()


# ---------------------------------------------------------------------------
# Property 1: Completude da Resposta Pull
# Feature: watermelondb-sync-router, Property 1: Completude da Resposta Pull
# Validates: Requirements 6.1, 6.3, 4.3
# ---------------------------------------------------------------------------


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(last_pulled_at=st.integers(min_value=0, max_value=9_999_999_999_999))
def test_property_1_pull_response_completeness(last_pulled_at: int) -> None:
    # Feature: watermelondb-sync-router, Property 1: Completude da Resposta Pull
    """
    **Validates: Requirements 6.1, 6.3, 4.3**

    For any valid Pull call (any last_pulled_at >= 0, any authenticated user),
    the response must:
    - Return HTTP 200
    - Contain a `changes` dict with exactly the 6 required table keys
    - Each table entry must have exactly the keys: created, updated, deleted
    - Contain a `timestamp` field that is an integer
    """
    auth_sub = str(uuid.uuid4())
    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        response = client.get(f"/api/v1/sync/pull?last_pulled_at={last_pulled_at}")

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}. "
            f"last_pulled_at={last_pulled_at}, Response={response.text[:300]}"
        )

        body = response.json()

        # changes key must exist
        assert "changes" in body, (
            f"Response missing 'changes' key. body keys: {list(body.keys())}"
        )

        # Exactly 6 required tables, no more no less
        actual_tables = set(body["changes"].keys())
        assert actual_tables == REQUIRED_TABLES, (
            f"Expected tables {REQUIRED_TABLES}, got {actual_tables}"
        )

        # Each table entry must have exactly created, updated, deleted
        for table in REQUIRED_TABLES:
            table_entry = body["changes"][table]
            actual_keys = set(table_entry.keys())
            assert actual_keys == REQUIRED_TABLE_KEYS, (
                f"Table '{table}' has keys {actual_keys}, expected {REQUIRED_TABLE_KEYS}"
            )
            assert isinstance(table_entry["created"], list), (
                f"Table '{table}'.created is not a list: {type(table_entry['created'])}"
            )
            assert isinstance(table_entry["updated"], list), (
                f"Table '{table}'.updated is not a list: {type(table_entry['updated'])}"
            )
            assert isinstance(table_entry["deleted"], list), (
                f"Table '{table}'.deleted is not a list: {type(table_entry['deleted'])}"
            )

        # timestamp must exist and be an integer
        assert "timestamp" in body, (
            f"Response missing 'timestamp' key. body keys: {list(body.keys())}"
        )
        assert isinstance(body["timestamp"], int), (
            f"timestamp is not an integer: {type(body['timestamp'])} = {body['timestamp']}"
        )
    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 2: Classificação Correta created vs updated
# Feature: watermelondb-sync-router, Property 2: Classificação Correta created vs updated
# Validates: Requirements 4.1, 4.2, 4.5
# ---------------------------------------------------------------------------

# Strategy: generate a list of (created_at_offset, updated_at_offset) pairs
# where offset is relative to the base timestamp.
# Records with created_at > last_pulled_at → must appear in created[]
# Records with updated_at > last_pulled_at AND created_at <= last_pulled_at → must appear in updated[]
_record_classification_strategy = st.lists(
    st.tuples(
        # created_at_offset: can be negative (older) or positive (newer) relative to last_pulled_at
        st.integers(min_value=-100_000, max_value=100_000),
        # additional_updated_offset: how much to add on top of created_at for updated_at
        st.integers(min_value=0, max_value=200_000),
    ),
    min_size=1,
    max_size=8,
)


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    base_ts=st.integers(min_value=1_000_000, max_value=9_000_000_000_000),
    last_pulled_at_offset=st.integers(min_value=0, max_value=50_000),
    records_spec=_record_classification_strategy,
)
def test_property_2_classification_created_vs_updated(
    base_ts: int,
    last_pulled_at_offset: int,
    records_spec: list,
) -> None:
    # Feature: watermelondb-sync-router, Property 2: Classificação Correta created vs updated
    """
    **Validates: Requirements 4.1, 4.2, 4.5**

    For any records seeded with varied timestamps and any last_pulled_at:
    - Records with created_at > last_pulled_at → appear in created[], not in updated[]
    - Records with updated_at > last_pulled_at AND created_at <= last_pulled_at → appear in updated[]
    - No record appears in both arrays simultaneously
    - Records not modified since last_pulled_at do not appear in either array

    Uses workouts table as the test table (direct user_id ownership, easy to control timestamps).
    """
    last_pulled_at = base_ts + last_pulled_at_offset
    auth_sub = str(uuid.uuid4())
    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Seed the user (required for FK)
        _seed_user(db_session, auth_sub)

        # Track which workout IDs should appear in created vs updated vs neither
        expected_created: set[str] = set()
        expected_updated: set[str] = set()

        for created_offset, updated_offset in records_spec:
            created_at = base_ts + created_offset
            # updated_at must be >= created_at
            updated_at = max(created_at, created_at + updated_offset)
            workout_id = str(uuid.uuid4())

            # Only seed records that are visible (updated_at > last_pulled_at)
            if updated_at > last_pulled_at:
                _seed_workout(
                    db_session,
                    workout_id,
                    auth_sub,
                    created_at=created_at,
                    updated_at=updated_at,
                )
                if created_at > last_pulled_at:
                    expected_created.add(workout_id)
                else:
                    expected_updated.add(workout_id)
            # else: record is old (updated_at <= last_pulled_at), should not appear

        db_session.commit()

        response = client.get(f"/api/v1/sync/pull?last_pulled_at={last_pulled_at}")
        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}. Response={response.text[:300]}"
        )

        body = response.json()
        workouts_changes = body["changes"]["workouts"]

        returned_created_ids = {r["id"] for r in workouts_changes["created"]}
        returned_updated_ids = {r["id"] for r in workouts_changes["updated"]}

        # No record should appear in both arrays simultaneously
        overlap = returned_created_ids & returned_updated_ids
        assert not overlap, (
            f"Records appear in BOTH created and updated arrays: {overlap}. "
            f"last_pulled_at={last_pulled_at}"
        )

        # All expected_created records must be in returned_created, not updated
        for wid in expected_created:
            assert wid in returned_created_ids, (
                f"Workout {wid} (created_at > last_pulled_at) expected in created[], "
                f"but not found. returned_created={returned_created_ids}"
            )
            assert wid not in returned_updated_ids, (
                f"Workout {wid} (created_at > last_pulled_at) found in updated[], "
                f"but should be in created[] only."
            )

        # All expected_updated records must be in returned_updated, not created
        for wid in expected_updated:
            assert wid in returned_updated_ids, (
                f"Workout {wid} (updated_at > last_pulled_at, created_at <= last_pulled_at) "
                f"expected in updated[], but not found. returned_updated={returned_updated_ids}"
            )
            assert wid not in returned_created_ids, (
                f"Workout {wid} (updated_at > last_pulled_at, created_at <= last_pulled_at) "
                f"found in created[], but should be in updated[] only."
            )

        # Records not in expected (old records) should not appear at all
        all_returned = returned_created_ids | returned_updated_ids
        unexpected = all_returned - expected_created - expected_updated
        assert not unexpected, (
            f"Unexpected records returned (old records that should not appear): {unexpected}. "
            f"last_pulled_at={last_pulled_at}"
        )

    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 3: Isolamento Multi-Tenant no Pull
# Feature: watermelondb-sync-router, Property 3: Isolamento Multi-Tenant no Pull
# Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
# ---------------------------------------------------------------------------

# Strategy: list of (owner_user_id, workout_name) pairs — same pattern as existing tests
_multi_tenant_workout_strategy = st.lists(
    st.tuples(
        st.uuids().map(str),
        st.text(
            min_size=1,
            max_size=50,
            alphabet=st.characters(
                whitelist_categories=("Lu", "Ll", "Nd"),
                whitelist_characters=" -_",
            ),
        ),
    ),
    min_size=2,
    max_size=8,
)


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    other_records=_multi_tenant_workout_strategy,
)
def test_property_3_multi_tenant_isolation_pull(
    auth_sub: str,
    other_records: list,
) -> None:
    # Feature: watermelondb-sync-router, Property 3: Isolamento Multi-Tenant no Pull
    """
    **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

    For any database state containing workouts from multiple users, a Pull request
    as user U must return only workouts/sessions owned by U — never records from
    other users.

    Also verifies that workout_sessions from other users are not returned.
    """
    # Ensure at least one record belongs to a different user
    other_user_ids = {uid for uid, _ in other_records}
    assume(any(uid != auth_sub for uid in other_user_ids))

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        now_ms = int(time.time() * 1000)

        # Seed the authenticated user first (FK constraint)
        _seed_user(db_session, auth_sub)

        auth_workout_ids: set[str] = set()
        other_workout_ids: set[str] = set()
        auth_session_ids: set[str] = set()
        other_session_ids: set[str] = set()

        seen_user_ids: set[str] = {auth_sub}

        for owner_uid, workout_name in other_records:
            if owner_uid not in seen_user_ids:
                _seed_user(db_session, owner_uid)
                seen_user_ids.add(owner_uid)

            workout_id = str(uuid.uuid4())
            _seed_workout(db_session, workout_id, owner_uid)

            session_id = str(uuid.uuid4())
            _seed_workout_session(db_session, session_id, owner_uid)

            if owner_uid == auth_sub:
                auth_workout_ids.add(workout_id)
                auth_session_ids.add(session_id)
            else:
                other_workout_ids.add(workout_id)
                other_session_ids.add(session_id)

        db_session.commit()

        # Pull from timestamp 0 so all records are candidates
        response = client.get("/api/v1/sync/pull?last_pulled_at=0")
        assert response.status_code == 200, (
            f"Expected HTTP 200 from pull, got {response.status_code}. "
            f"Response={response.text[:300]}"
        )

        body = response.json()
        changes = body["changes"]

        # Collect all returned workout IDs (created + updated)
        returned_workout_changes = changes.get("workouts", {})
        returned_workout_ids = (
            {r["id"] for r in returned_workout_changes.get("created", [])}
            | {r["id"] for r in returned_workout_changes.get("updated", [])}
        )

        # Collect all returned workout_session IDs (created + updated)
        returned_session_changes = changes.get("workout_sessions", {})
        returned_session_ids = (
            {r["id"] for r in returned_session_changes.get("created", [])}
            | {r["id"] for r in returned_session_changes.get("updated", [])}
        )

        # No workout from another user should appear in the response
        for wid in returned_workout_ids:
            assert wid not in other_workout_ids, (
                f"Pull returned workout {wid!r} which belongs to another user. "
                f"auth_sub={auth_sub!r}, other_workout_ids={other_workout_ids!r}"
            )

        # No session from another user should appear in the response
        for sid in returned_session_ids:
            assert sid not in other_session_ids, (
                f"Pull returned workout_session {sid!r} which belongs to another user. "
                f"auth_sub={auth_sub!r}, other_session_ids={other_session_ids!r}"
            )

        # All auth_sub's workouts must be returned
        for wid in auth_workout_ids:
            assert wid in returned_workout_ids, (
                f"Pull did NOT return workout {wid!r} belonging to auth_sub={auth_sub!r}. "
                f"returned_workout_ids={returned_workout_ids!r}"
            )

        # All auth_sub's sessions must be returned
        for sid in auth_session_ids:
            assert sid in returned_session_ids, (
                f"Pull did NOT return workout_session {sid!r} belonging to auth_sub={auth_sub!r}. "
                f"returned_session_ids={returned_session_ids!r}"
            )

    finally:
        db_session.close()


# ---------------------------------------------------------------------------
# Property 4: Isolamento de Tombstones
# Feature: watermelondb-sync-router, Property 4: Isolamento de Tombstones
# Validates: Requirements 5.7
# ---------------------------------------------------------------------------

# Strategy: list of (user_id_or_none, deleted_at_offset) for tombstones
# user_id can be auth_sub, a different random UUID, or None (shared catalog)
_tombstone_strategy = st.lists(
    st.tuples(
        # owner type: "auth" | "other" | "null"
        st.sampled_from(["auth", "other", "null"]),
        # deleted_at_offset: relative to base_ts; positive means after last_pulled_at
        st.integers(min_value=1, max_value=100_000),
    ),
    min_size=1,
    max_size=10,
)


@h_settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    auth_sub=st.uuids().map(str),
    base_ts=st.integers(min_value=1_000_000, max_value=9_000_000_000_000),
    tombstones_spec=_tombstone_strategy,
)
def test_property_4_tombstone_isolation(
    auth_sub: str,
    base_ts: int,
    tombstones_spec: list,
) -> None:
    # Feature: watermelondb-sync-router, Property 4: Isolamento de Tombstones
    """
    **Validates: Requirements 5.7**

    For any database state with tombstones from varied user_ids, a Pull request
    as user U must return only tombstones where:
    - deleted_records.user_id == current_user_id (user's own deletions), OR
    - deleted_records.user_id IS NULL (shared catalog deletions, e.g., exercises)

    Tombstones belonging to other users must never be returned.
    All qualifying tombstones (auth_sub or NULL) must be returned.
    """
    last_pulled_at = base_ts  # all tombstones will have deleted_at > last_pulled_at

    client, db_session = _build_test_client(authenticated_sub=auth_sub)

    try:
        # Track tombstone record_ids by ownership
        auth_tombstone_ids: set[str] = set()   # user_id == auth_sub → must be returned
        null_tombstone_ids: set[str] = set()   # user_id IS NULL → must be returned
        other_tombstone_ids: set[str] = set()  # user_id != auth_sub → must NOT be returned

        # other_user_ids pool to avoid regenerating UUIDs for "other" tombstones
        other_user_id = str(uuid.uuid4())
        # Make sure it doesn't accidentally equal auth_sub
        while other_user_id == auth_sub:
            other_user_id = str(uuid.uuid4())

        for idx, (owner_type, deleted_offset) in enumerate(tombstones_spec):
            tombstone_id = str(uuid.uuid4())
            record_id = str(uuid.uuid4())
            deleted_at = last_pulled_at + deleted_offset

            if owner_type == "auth":
                user_id = auth_sub
                auth_tombstone_ids.add(record_id)
            elif owner_type == "other":
                user_id = other_user_id
                other_tombstone_ids.add(record_id)
            else:  # "null"
                user_id = None
                null_tombstone_ids.add(record_id)

            _seed_tombstone(
                db_session,
                tombstone_id=tombstone_id,
                table_name="workouts",
                record_id=record_id,
                user_id=user_id,
                deleted_at=deleted_at,
            )

        db_session.commit()

        response = client.get(f"/api/v1/sync/pull?last_pulled_at={last_pulled_at}")
        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}. Response={response.text[:300]}"
        )

        body = response.json()

        # Collect all returned tombstone record_ids from all tables' deleted arrays
        returned_deleted_ids: set[str] = set()
        for table_name, table_changes in body["changes"].items():
            for record_id in table_changes.get("deleted", []):
                returned_deleted_ids.add(record_id)

        # No tombstone from another user must be returned
        for rid in other_tombstone_ids:
            assert rid not in returned_deleted_ids, (
                f"Tombstone record_id={rid!r} (user_id=other) was returned in Pull. "
                f"auth_sub={auth_sub!r}, other_user_id={other_user_id!r}"
            )

        # All auth_sub tombstones must be returned
        for rid in auth_tombstone_ids:
            assert rid in returned_deleted_ids, (
                f"Tombstone record_id={rid!r} (user_id=auth_sub) was NOT returned in Pull. "
                f"auth_sub={auth_sub!r}, returned_deleted_ids={returned_deleted_ids!r}"
            )

        # All NULL tombstones must be returned
        for rid in null_tombstone_ids:
            assert rid in returned_deleted_ids, (
                f"Tombstone record_id={rid!r} (user_id=NULL) was NOT returned in Pull. "
                f"auth_sub={auth_sub!r}, returned_deleted_ids={returned_deleted_ids!r}"
            )

    finally:
        db_session.close()
