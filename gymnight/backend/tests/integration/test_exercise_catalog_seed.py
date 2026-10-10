"""
Integration test: no `head`, o catálogo compartilhado `exercises` é o de 500
exercícios do CSV (migration 011), contra um Postgres real.

A migration 008 semeava 210 exercícios a partir do muscle_usage_map.md; a
011 apagou os que não existem no CSV e fez upsert dos 500. O caminho
010 → 011 com dados antigos está em test_exercise_catalog_500_migration.py.

O fixture `engine` (conftest.py) roda `alembic upgrade head` uma vez — as
linhas já estão commitadas quando cada teste (com rollback) roda.
"""

import os

import pytest
from sqlalchemy import text

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database.seed_helpers import exercise_id_for, parse_exercise_catalog_csv  # noqa: E402

CATALOG = parse_exercise_catalog_csv()


def test_exercises_table_has_500_rows(db_transaction):
    count = db_transaction.execute(text("SELECT COUNT(*) FROM exercises")).scalar()
    assert count == 500


def test_every_csv_row_is_seeded_with_all_columns(db_transaction):
    rows = db_transaction.execute(
        text("SELECT id, name, name_en, equipment, media_key FROM exercises")
    ).all()
    by_id = {r.id: r for r in rows}
    for exercise in CATALOG:
        row = by_id[exercise.id]
        assert row.name == exercise.name
        assert row.name_en == exercise.name_en
        assert row.equipment == exercise.equipment
        assert row.media_key == exercise.media_key


def test_old_catalog_names_are_gone(db_transaction):
    row = db_transaction.execute(
        text("SELECT 1 FROM exercises WHERE id = :id"),
        {"id": exercise_id_for("Supino Reto (Barra)")},
    ).first()
    assert row is None


def test_old_name_matching_the_csv_keeps_its_id_with_the_new_display_name(db_transaction):
    # "Hiperextensão Lombar" (catálogo antigo) normaliza igual a
    # "Hiperextensão lombar" (CSV) — mesmo UUIDv5, linha mantida e atualizada.
    row = db_transaction.execute(
        text("SELECT name, media_key FROM exercises WHERE id = :id"),
        {"id": exercise_id_for("Hiperextensão Lombar")},
    ).first()
    assert row is not None
    assert row.name == "Hiperextensão lombar"
    assert row.media_key is not None


def test_seed_upsert_is_idempotent(db_transaction):
    before = db_transaction.execute(text("SELECT COUNT(*) FROM exercises")).scalar()
    first = CATALOG[0]
    db_transaction.execute(
        text(
            """
            INSERT INTO exercises (id, name, name_en, equipment, media_key, created_at, updated_at)
            VALUES (:id, :name, :name_en, :equipment, :media_key, 0, 0)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """
        ),
        {
            "id": first.id,
            "name": first.name,
            "name_en": first.name_en,
            "equipment": first.equipment,
            "media_key": first.media_key,
        },
    )
    after = db_transaction.execute(text("SELECT COUNT(*) FROM exercises")).scalar()
    assert after == before


@pytest.mark.parametrize(
    "display_name",
    ["Supino reto com barra", "Agachamento livre com barra", "Rosca direta com barra"],
)
def test_spot_check_known_exercises_present(db_transaction, display_name):
    row = db_transaction.execute(
        text("SELECT 1 FROM exercises WHERE id = :id"),
        {"id": exercise_id_for(display_name)},
    ).first()
    assert row is not None, f"expected seeded exercise not found: {display_name!r}"
