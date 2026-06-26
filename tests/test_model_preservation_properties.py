"""
Property-based tests for SQLAlchemy model preservation.

Feature: supabase-migration
Property 10: Colunas de sincronização preservadas em todos os modelos sincronizáveis

All tests are in-memory — inspection of SQLAlchemy metadata only (no database
connection required).

Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7
"""

import pytest
from hypothesis import HealthCheck, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st
from sqlalchemy import BigInteger, String
from sqlalchemy.types import NullType

# Importing the models package populates Base.metadata with all table definitions.
# No actual database connection is needed — we only inspect the ORM metadata.
from app.database.models import Base  # noqa: F401 — side-effect: registers all tables

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SYNCABLE_TABLES = [
    "users",
    "exercises",
    "workouts",
    "workout_exercises",
    "workout_sessions",
    "logged_sets",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_column(table_name: str, column_name: str):
    """Return the SQLAlchemy Column object for *column_name* in *table_name*.

    Raises AssertionError if the table or column is not found in metadata.
    """
    assert table_name in Base.metadata.tables, (
        f"Table '{table_name}' not found in Base.metadata. "
        f"Known tables: {sorted(Base.metadata.tables.keys())}"
    )
    table = Base.metadata.tables[table_name]
    assert column_name in table.c, (
        f"Column '{column_name}' not found in table '{table_name}'. "
        f"Columns: {[c.name for c in table.c]}"
    )
    return table.c[column_name]


def _resolve_type_length(col_type) -> int | None:
    """Return the length/precision of a String type, or None if not applicable."""
    if hasattr(col_type, "length"):
        return col_type.length
    return None


# ---------------------------------------------------------------------------
# Property 10: Sync columns preserved on every syncable model
# Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7
# ---------------------------------------------------------------------------


@h_settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
@given(table_name=st.sampled_from(SYNCABLE_TABLES))
def test_property_10_sync_columns_preserved(table_name: str) -> None:
    # Feature: supabase-migration, Property 10: sync columns preserved on all syncable models
    """
    **Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7**

    For every table in {users, exercises, workouts, workout_exercises,
    workout_sessions, logged_sets}:

    - ``_status``    → String(10), nullable
    - ``_changed``   → String(500), nullable
    - ``created_at`` → BigInteger, not nullable
    - ``updated_at`` → BigInteger, not nullable
    - ``id``         → String(36), primary key

    Additionally, for the ``users`` table specifically:
    - ``password_hash`` column MUST NOT be present
    """

    # ------------------------------------------------------------------ #
    # 1. Verify _status: String(10), nullable                             #
    # ------------------------------------------------------------------ #
    col_status = _get_column(table_name, "_status")

    assert isinstance(col_status.type, String), (
        f"[{table_name}._status] Expected type String, got {type(col_status.type).__name__}"
    )
    assert _resolve_type_length(col_status.type) == 10, (
        f"[{table_name}._status] Expected String(10), "
        f"got String({_resolve_type_length(col_status.type)})"
    )
    assert col_status.nullable is True, (
        f"[{table_name}._status] Expected nullable=True, got nullable={col_status.nullable}"
    )

    # ------------------------------------------------------------------ #
    # 2. Verify _changed: String(500), nullable                           #
    # ------------------------------------------------------------------ #
    col_changed = _get_column(table_name, "_changed")

    assert isinstance(col_changed.type, String), (
        f"[{table_name}._changed] Expected type String, got {type(col_changed.type).__name__}"
    )
    assert _resolve_type_length(col_changed.type) == 500, (
        f"[{table_name}._changed] Expected String(500), "
        f"got String({_resolve_type_length(col_changed.type)})"
    )
    assert col_changed.nullable is True, (
        f"[{table_name}._changed] Expected nullable=True, got nullable={col_changed.nullable}"
    )

    # ------------------------------------------------------------------ #
    # 3. Verify created_at: BigInteger, not nullable                      #
    # ------------------------------------------------------------------ #
    col_created = _get_column(table_name, "created_at")

    assert isinstance(col_created.type, BigInteger), (
        f"[{table_name}.created_at] Expected type BigInteger, "
        f"got {type(col_created.type).__name__}"
    )
    assert col_created.nullable is False, (
        f"[{table_name}.created_at] Expected nullable=False, "
        f"got nullable={col_created.nullable}"
    )

    # ------------------------------------------------------------------ #
    # 4. Verify updated_at: BigInteger, not nullable                      #
    # ------------------------------------------------------------------ #
    col_updated = _get_column(table_name, "updated_at")

    assert isinstance(col_updated.type, BigInteger), (
        f"[{table_name}.updated_at] Expected type BigInteger, "
        f"got {type(col_updated.type).__name__}"
    )
    assert col_updated.nullable is False, (
        f"[{table_name}.updated_at] Expected nullable=False, "
        f"got nullable={col_updated.nullable}"
    )

    # ------------------------------------------------------------------ #
    # 5. Verify id: String(36), primary key                               #
    # ------------------------------------------------------------------ #
    col_id = _get_column(table_name, "id")

    assert isinstance(col_id.type, String), (
        f"[{table_name}.id] Expected type String, got {type(col_id.type).__name__}"
    )
    assert _resolve_type_length(col_id.type) == 36, (
        f"[{table_name}.id] Expected String(36), "
        f"got String({_resolve_type_length(col_id.type)})"
    )
    assert col_id.primary_key is True, (
        f"[{table_name}.id] Expected primary_key=True, got primary_key={col_id.primary_key}"
    )

    # ------------------------------------------------------------------ #
    # 6. For users table: password_hash MUST NOT exist                    #
    # ------------------------------------------------------------------ #
    if table_name == "users":
        table = Base.metadata.tables["users"]
        column_names = [c.name for c in table.c]
        assert "password_hash" not in column_names, (
            f"[users] Column 'password_hash' must not be present after migration. "
            f"Found columns: {column_names}"
        )
