"""
Integration test: migration 008 actually seeds the shared `exercises`
catalog against a real Postgres (PARIDADE-01-DESTRAVAR.md §3).

The session-scoped `engine` fixture (conftest.py) already runs
`alembic upgrade head` once — by the time these tests run, the 210 rows
from migration 008 are already committed (migrations run outside any
test's transaction), so every test's rolled-back transaction still sees
them (Postgres transactions see already-committed prior data).
"""

import os

import pytest
from sqlalchemy import text

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database.seed_helpers import exercise_id_for, parse_exercise_names  # noqa: E402


def test_exercises_table_has_210_seeded_rows(db_transaction):
    count = db_transaction.execute(text("SELECT COUNT(*) FROM exercises")).scalar()
    assert count == 210


def test_seeded_exercise_has_deterministic_id_and_display_name(db_transaction):
    expected_id = exercise_id_for("Supino Reto (Barra)")
    row = db_transaction.execute(
        text("SELECT id, name FROM exercises WHERE id = :id"),
        {"id": expected_id},
    ).first()

    assert row is not None
    assert row.name == "Supino Reto (Barra)"


def test_every_parsed_name_has_a_matching_row(db_transaction):
    names = parse_exercise_names()
    ids = [exercise_id_for(n) for n in names]

    result = db_transaction.execute(
        text("SELECT COUNT(*) FROM exercises WHERE id = ANY(:ids)"),
        {"ids": ids},
    ).scalar()

    assert result == len(names)


def test_seed_insert_is_idempotent_via_on_conflict(db_transaction):
    """Re-running the same INSERT ... ON CONFLICT DO NOTHING (what the
    migration's upgrade() does per row) must not raise nor duplicate rows —
    proves the migration is safe to re-apply (e.g. redeploy)."""
    before = db_transaction.execute(text("SELECT COUNT(*) FROM exercises")).scalar()

    name = "Supino Reto (Barra)"
    db_transaction.execute(
        text(
            """
            INSERT INTO exercises (id, name, created_at, updated_at)
            VALUES (:id, :name, 0, 0)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": exercise_id_for(name), "name": name},
    )

    after = db_transaction.execute(text("SELECT COUNT(*) FROM exercises")).scalar()
    assert after == before


@pytest.mark.parametrize(
    "display_name",
    ["Supino Reto (Barra)", "Agachamento Livre (Back Squat)", "Rosca Direta (Barra)"],
)
def test_spot_check_known_exercises_present(db_transaction, display_name):
    row = db_transaction.execute(
        text("SELECT 1 FROM exercises WHERE id = :id"),
        {"id": exercise_id_for(display_name)},
    ).first()
    assert row is not None, f"expected seeded exercise not found: {display_name!r}"
