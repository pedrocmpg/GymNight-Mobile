"""
Structural test for migration 011 (catálogo de 500 exercícios).
"""

import ast
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2] / "alembic" / "versions" / "011_exercise_catalog_500.py"
)


def _module_vars():
    tree = ast.parse(MIGRATION_PATH.read_text(encoding="utf-8"))
    return {
        node.targets[0].id: node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
    }


def test_migration_011_revision_chain():
    module_vars = _module_vars()
    assert ast.literal_eval(module_vars["revision"]) == "011"
    assert ast.literal_eval(module_vars["down_revision"]) == "010"


def test_migration_011_adds_the_three_exercise_columns():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    for column in ["name_en", "equipment", "media_key"]:
        assert f'"{column}"' in source


def test_migration_011_upserts_instead_of_ignoring_conflicts():
    """Os 12 exercícios antigos que coincidem com o CSV precisam ser
    atualizados (nome, mídia, updated_at), não ignorados."""
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    assert "DO NOTHING" not in source
    assert source.count("ON CONFLICT (id) DO UPDATE") == 3


def test_migration_011_tombstones_pull_only_catalog_rows():
    """exercise_muscle_map/exercise_met_values não têm trigger: as linhas
    removidas precisam de tombstone explícito para sumirem dos clientes."""
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    assert "INSERT INTO deleted_records" in source
    assert '"exercise_muscle_map"' in source
    assert '"exercise_met_values"' in source
