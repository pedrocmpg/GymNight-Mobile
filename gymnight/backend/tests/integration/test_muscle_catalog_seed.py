"""
Integration test: migration 009 seeds the muscle catalog (7 groups, 452
activation rows, MET values) against a real Postgres (Wave 6).
"""

import os

import pytest
from sqlalchemy import text

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database.seed_helpers import (  # noqa: E402
    exercise_id_for,
    met_value_for,
    muscle_group_id_for,
    parse_exercise_names,
    parse_muscle_contributions,
    MUSCLE_GROUP_NAMES,
)


def test_seven_muscle_groups_seeded(db_transaction):
    count = db_transaction.execute(text("SELECT COUNT(*) FROM muscle_groups")).scalar()
    assert count == 7

    for name in MUSCLE_GROUP_NAMES:
        row = db_transaction.execute(
            text("SELECT name FROM muscle_groups WHERE id = :id"),
            {"id": muscle_group_id_for(name)},
        ).first()
        assert row is not None and row.name == name


def test_exercise_muscle_map_row_count_matches_parsed_source(db_transaction):
    expected = len(parse_muscle_contributions())
    count = db_transaction.execute(text("SELECT COUNT(*) FROM exercise_muscle_map")).scalar()
    assert count == expected


def test_exercise_muscle_map_contributions_in_range(db_transaction):
    rows = db_transaction.execute(text("SELECT contribution FROM exercise_muscle_map")).all()
    assert len(rows) > 0
    assert all(0 < r.contribution <= 1 for r in rows)


def test_supino_reto_muscle_contributions_match_source(db_transaction):
    exercise_id = exercise_id_for("Supino Reto (Barra)")
    rows = db_transaction.execute(
        text(
            """
            SELECT mg.name AS group_name, emm.contribution
            FROM exercise_muscle_map emm
            JOIN muscle_groups mg ON mg.id = emm.muscle_group_id
            WHERE emm.exercise_id = :exercise_id
            """
        ),
        {"exercise_id": exercise_id},
    ).all()
    by_group = {r.group_name: r.contribution for r in rows}
    assert by_group == {"Peito": pytest.approx(0.65), "Ombros": pytest.approx(0.15), "Tríceps": pytest.approx(0.2)}


def test_exercise_met_values_seeded_for_known_exercise(db_transaction):
    exercise_id = exercise_id_for("Supino Reto (Barra)")
    row = db_transaction.execute(
        text("SELECT met_value FROM exercise_met_values WHERE exercise_id = :id"),
        {"id": exercise_id},
    ).first()
    assert row is not None
    assert row.met_value == met_value_for("Supino Reto (Barra)")


def test_exercise_met_values_row_count_matches_exercises_with_met(db_transaction):
    expected = sum(1 for name in parse_exercise_names() if met_value_for(name) is not None)
    count = db_transaction.execute(text("SELECT COUNT(*) FROM exercise_met_values")).scalar()
    assert count == expected


def test_cardio_logs_table_exists_and_is_empty(db_transaction):
    # Schema criado na Wave 6, sem consumidor até a Wave 9 — não deve ter linhas.
    count = db_transaction.execute(text("SELECT COUNT(*) FROM cardio_logs")).scalar()
    assert count == 0


def test_new_columns_on_existing_tables_have_correct_defaults(db_transaction):
    workout_id = "test-wk-defaults"
    user_id = "test-user-defaults"
    now = 0
    db_transaction.execute(
        text(
            "INSERT INTO users (id, name, email, created_at, updated_at) "
            "VALUES (:id, 'T', 'defaults@test.local', :now, :now)"
        ),
        {"id": user_id, "now": now},
    )
    db_transaction.execute(
        text(
            "INSERT INTO workouts (id, user_id, name, created_at, updated_at) "
            "VALUES (:id, :user_id, 'W', :now, :now)"
        ),
        {"id": workout_id, "user_id": user_id, "now": now},
    )
    row = db_transaction.execute(
        text("SELECT description FROM workouts WHERE id = :id"), {"id": workout_id}
    ).first()
    assert row.description == ""

    we_id = "test-we-defaults"
    exercise_id = exercise_id_for("Supino Reto (Barra)")
    db_transaction.execute(
        text(
            "INSERT INTO workout_exercises "
            "(id, workout_id, exercise_id, series_target, reps_target, weight_target, created_at, updated_at) "
            "VALUES (:id, :workout_id, :exercise_id, 3, 10, 50, :now, :now)"
        ),
        {"id": we_id, "workout_id": workout_id, "exercise_id": exercise_id, "now": now},
    )
    row = db_transaction.execute(
        text("SELECT order_index FROM workout_exercises WHERE id = :id"), {"id": we_id}
    ).first()
    assert row.order_index == 0

    session_id = "test-session-defaults"
    db_transaction.execute(
        text(
            "INSERT INTO workout_sessions (id, user_id, started_at, created_at, updated_at) "
            "VALUES (:id, :user_id, :now, :now, :now)"
        ),
        {"id": session_id, "user_id": user_id, "now": now},
    )
    set_id = "test-set-defaults"
    db_transaction.execute(
        text(
            "INSERT INTO logged_sets "
            "(id, session_id, exercise_id, weight, repetitions, estimated_one_rm, completed_at, created_at, updated_at) "
            "VALUES (:id, :session_id, :exercise_id, 50, 10, 66.67, :now, :now, :now)"
        ),
        {"id": set_id, "session_id": session_id, "exercise_id": exercise_id, "now": now},
    )
    row = db_transaction.execute(
        text("SELECT set_type FROM logged_sets WHERE id = :id"), {"id": set_id}
    ).first()
    assert row.set_type == "N"
