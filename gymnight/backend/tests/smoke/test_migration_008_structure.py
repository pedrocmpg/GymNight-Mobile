"""
Structural test for migration 008 (seed the shared exercise catalog).

Requirements: PARIDADE-01-DESTRAVAR.md §3

Static inspection: revision chain, idempotent INSERT (ON CONFLICT), and
that upgrade()/downgrade() are driven by app.database.seed_helpers rather
than a hardcoded/duplicated list.
"""

import ast
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "008_seed_exercise_catalog.py"
)

SEED_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "database"
    / "seed_data"
    / "muscle_usage_map.md"
)

SEED_HELPERS_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "database" / "seed_helpers.py"
)


def test_migration_008_exists():
    assert MIGRATION_PATH.exists(), f"Migration file not found: {MIGRATION_PATH}"


def test_seed_data_file_bundled_in_backend_repo():
    """The migration must not depend on the sibling GymNight-Desktop repo at
    runtime — the source data is copied into this repo."""
    assert SEED_DATA_PATH.exists(), f"Seed data file not found: {SEED_DATA_PATH}"


def test_seed_helpers_module_exists():
    assert SEED_HELPERS_PATH.exists(), f"seed_helpers.py not found: {SEED_HELPERS_PATH}"


def test_migration_008_revision_chain():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    module_vars = {
        node.targets[0].id: node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
    }
    revision = ast.literal_eval(module_vars["revision"])
    down_revision = ast.literal_eval(module_vars["down_revision"])
    assert revision == "008"
    assert down_revision == "007"


def test_migration_008_imports_seed_helpers_not_a_hardcoded_list():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)

    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)

    assert "app.database.seed_helpers" in imported


def test_migration_008_upgrade_uses_on_conflict_do_nothing():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    assert "ON CONFLICT" in source and "DO NOTHING" in source, (
        "Seed INSERT must be idempotent (ON CONFLICT ... DO NOTHING) — "
        "re-running the migration must not fail or duplicate rows"
    )
