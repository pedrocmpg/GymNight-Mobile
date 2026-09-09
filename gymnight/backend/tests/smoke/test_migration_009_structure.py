"""
Structural test for migration 009 (muscle catalog + wave 8/9 dormant columns).
"""

import ast
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "009_muscle_catalog_and_wave689_columns.py"
)


def test_migration_009_exists():
    assert MIGRATION_PATH.exists()


def test_migration_009_revision_chain():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    module_vars = {
        node.targets[0].id: node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
    }
    assert ast.literal_eval(module_vars["revision"]) == "009"
    assert ast.literal_eval(module_vars["down_revision"]) == "008"


def test_migration_009_creates_all_four_new_tables():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    for table in ["muscle_groups", "exercise_muscle_map", "exercise_met_values", "cardio_logs"]:
        assert f'"{table}"' in source, f"missing create_table for {table}"


def test_migration_009_adds_all_four_dormant_columns():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    assert '"goal"' in source
    assert '"description"' in source
    assert '"order_index"' in source
    assert '"set_type"' in source


def test_migration_009_seed_inserts_are_idempotent():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    assert source.count("ON CONFLICT (id) DO NOTHING") == 3, (
        "expected one idempotent INSERT per seeded table "
        "(muscle_groups, exercise_muscle_map, exercise_met_values)"
    )


def test_migration_009_only_cardio_logs_gets_a_tombstone_trigger():
    """Catálogos pull-only (muscle_groups/exercise_muscle_map/exercise_met_values)
    não devem ganhar trigger de tombstone — o cliente nunca deleta neles."""
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    assert source.count("CREATE TRIGGER") == 1
    assert "trg_tombstone_cardio_logs" in source
