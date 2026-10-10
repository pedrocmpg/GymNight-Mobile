"""
Integration test: o catálogo muscular no `head` contra um Postgres real.

A migration 009 criou as tabelas e semeou 7 grupos + mapa/MET dos 210
exercícios antigos; a 011 trocou mapa e MET pelos dos 500 do CSV (regra
70/30, MET do desktop quando existe, senão fallback por equipamento).
"""

import os

import pytest
from sqlalchemy import text

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database.seed_helpers import (  # noqa: E402
    exercise_id_for,
    muscle_group_id_for,
    parse_exercise_catalog_csv,
    MUSCLE_GROUP_NAMES,
)

CATALOG = parse_exercise_catalog_csv()


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
    expected = sum(len(e.muscle_contributions()) for e in CATALOG)
    count = db_transaction.execute(text("SELECT COUNT(*) FROM exercise_muscle_map")).scalar()
    assert count == expected


def test_exercise_muscle_map_contributions_in_range(db_transaction):
    rows = db_transaction.execute(text("SELECT contribution FROM exercise_muscle_map")).all()
    assert len(rows) > 0
    assert all(0 < r.contribution <= 1 for r in rows)


def test_supino_reto_muscle_contributions_follow_70_30_rule(db_transaction):
    exercise_id = exercise_id_for("Supino reto com barra")
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
    assert by_group == {"Peito": pytest.approx(0.7), "Ombros": pytest.approx(0.15), "Tríceps": pytest.approx(0.15)}


def test_exercise_met_values_seeded_for_known_exercise(db_transaction):
    first = CATALOG[0]
    exercise_id = first.id
    row = db_transaction.execute(
        text("SELECT met_value FROM exercise_met_values WHERE exercise_id = :id"),
        {"id": exercise_id},
    ).first()
    assert row is not None
    assert row.met_value == first.met_value


def test_every_exercise_has_exactly_one_met_value(db_transaction):
    expected = len(CATALOG)
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
    exercise_id = CATALOG[0].id
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
