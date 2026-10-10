"""
Integration test: caminho 010 → 011 com dados de treino que usam o catálogo
antigo, contra um Postgres real.

Volta o banco até a 007 (antes do seed antigo), sobe até a 010 (210
exercícios), grava um treino e uma sessão que usam um exercício antigo e um
que coincide com o CSV, e então sobe até o head. Termina no head, como o
resto da suíte espera.

Não usa o `db_transaction`: as migrations precisam ver os dados commitados.
Tudo o que é gravado aqui é apagado pela própria 011 ou no `finally`.
"""

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database.seed_helpers import exercise_id_for  # noqa: E402

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"

USER_ID = "test-user-catalog-500"
OLD_EXERCISE_ID = exercise_id_for("Supino Reto (Barra)")  # some na 011
KEPT_EXERCISE_ID = exercise_id_for("Remada Pendlay")  # existe no CSV

OLD_WORKOUT_ID = "test-wk-old-catalog"
KEPT_WORKOUT_ID = "test-wk-kept-catalog"
OLD_SESSION_ID = "test-session-old-catalog"
KEPT_SESSION_ID = "test-session-kept-catalog"


def _alembic_config() -> Config:
    cfg = Config(str(_ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", os.environ["TEST_DATABASE_URL"])
    return cfg


def _seed_training_data(conn) -> None:
    conn.execute(
        text(
            "INSERT INTO users (id, name, email, created_at, updated_at) "
            "VALUES (:id, 'T', 'catalog500@test.local', 0, 0)"
        ),
        {"id": USER_ID},
    )
    for workout_id, exercise_id in (
        (OLD_WORKOUT_ID, OLD_EXERCISE_ID),
        (KEPT_WORKOUT_ID, KEPT_EXERCISE_ID),
    ):
        conn.execute(
            text(
                "INSERT INTO workouts (id, user_id, name, created_at, updated_at) "
                "VALUES (:id, :user_id, 'W', 0, 0)"
            ),
            {"id": workout_id, "user_id": USER_ID},
        )
        conn.execute(
            text(
                "INSERT INTO workout_exercises "
                "(id, workout_id, exercise_id, series_target, reps_target, weight_target, "
                "created_at, updated_at) "
                "VALUES (:id, :workout_id, :exercise_id, 3, 10, 50, 0, 0)"
            ),
            {"id": f"{workout_id}-we", "workout_id": workout_id, "exercise_id": exercise_id},
        )
    for session_id, exercise_id in (
        (OLD_SESSION_ID, OLD_EXERCISE_ID),
        (KEPT_SESSION_ID, KEPT_EXERCISE_ID),
    ):
        conn.execute(
            text(
                "INSERT INTO workout_sessions (id, user_id, started_at, created_at, updated_at) "
                "VALUES (:id, :user_id, 0, 0, 0)"
            ),
            {"id": session_id, "user_id": USER_ID},
        )
        conn.execute(
            text(
                "INSERT INTO logged_sets "
                "(id, session_id, exercise_id, weight, repetitions, estimated_one_rm, "
                "completed_at, created_at, updated_at) "
                "VALUES (:id, :session_id, :exercise_id, 50, 10, 66.67, 0, 0, 0)"
            ),
            {"id": f"{session_id}-set", "session_id": session_id, "exercise_id": exercise_id},
        )


def _exists(conn, table: str, record_id: str) -> bool:
    return conn.execute(
        text(f"SELECT 1 FROM {table} WHERE id = :id"), {"id": record_id}
    ).first() is not None


def _tombstoned(conn, table: str, record_id: str) -> bool:
    return conn.execute(
        text("SELECT 1 FROM deleted_records WHERE table_name = :t AND record_id = :id"),
        {"t": table, "id": record_id},
    ).first() is not None


@pytest.fixture(scope="module")
def migrated_from_old_catalog(engine):
    cfg = _alembic_config()
    command.downgrade(cfg, "007")
    command.upgrade(cfg, "010")
    try:
        with engine.begin() as conn:
            _seed_training_data(conn)
        command.upgrade(cfg, "head")
        yield engine
    finally:
        command.upgrade(cfg, "head")
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": USER_ID})
            conn.execute(
                text("DELETE FROM deleted_records WHERE user_id = :id"), {"id": USER_ID}
            )


def test_old_catalog_data_is_deleted_with_tombstones(migrated_from_old_catalog):
    with migrated_from_old_catalog.connect() as conn:
        assert not _exists(conn, "exercises", OLD_EXERCISE_ID)
        assert not _exists(conn, "workouts", OLD_WORKOUT_ID)
        assert not _exists(conn, "workout_sessions", OLD_SESSION_ID)
        assert not _exists(conn, "logged_sets", f"{OLD_SESSION_ID}-set")

        assert _tombstoned(conn, "exercises", OLD_EXERCISE_ID)
        assert _tombstoned(conn, "workouts", OLD_WORKOUT_ID)
        assert _tombstoned(conn, "workout_sessions", OLD_SESSION_ID)
        assert _tombstoned(conn, "logged_sets", f"{OLD_SESSION_ID}-set")


def test_data_using_a_kept_exercise_survives(migrated_from_old_catalog):
    with migrated_from_old_catalog.connect() as conn:
        assert _exists(conn, "exercises", KEPT_EXERCISE_ID)
        assert _exists(conn, "workouts", KEPT_WORKOUT_ID)
        assert _exists(conn, "workout_sessions", KEPT_SESSION_ID)
        assert _exists(conn, "logged_sets", f"{KEPT_SESSION_ID}-set")


def test_removed_muscle_map_rows_are_tombstoned(migrated_from_old_catalog):
    with migrated_from_old_catalog.connect() as conn:
        orphan_map_rows = conn.execute(
            text(
                "SELECT COUNT(*) FROM exercise_muscle_map emm "
                "LEFT JOIN exercises e ON e.id = emm.exercise_id WHERE e.id IS NULL"
            )
        ).scalar()
        assert orphan_map_rows == 0
        map_tombstones = conn.execute(
            text("SELECT COUNT(*) FROM deleted_records WHERE table_name = 'exercise_muscle_map'")
        ).scalar()
        met_tombstones = conn.execute(
            text("SELECT COUNT(*) FROM deleted_records WHERE table_name = 'exercise_met_values'")
        ).scalar()
        assert map_tombstones > 0
        assert met_tombstones > 0
