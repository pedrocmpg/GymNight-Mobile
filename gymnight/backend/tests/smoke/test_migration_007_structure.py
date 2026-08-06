"""
Structural test for migration 007 (make users.email nullable).

Requirements: 12.1, 12.2

Static inspection of the Alembic script's source, asserting only
`nullable=True` is changed on `users.email` — no type, default, or
index change is introduced.
"""

import ast
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "007_make_users_email_nullable.py"
)


def _get_function(tree: ast.Module, name: str) -> ast.FunctionDef:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    raise AssertionError(f"Function {name!r} not found in migration script")


def _alter_column_calls(func_node: ast.FunctionDef):
    calls = []
    for node in ast.walk(func_node):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "alter_column"
        ):
            calls.append(node)
    return calls


def test_migration_007_exists():
    assert MIGRATION_PATH.exists(), f"Migration file not found: {MIGRATION_PATH}"


def test_migration_007_revision_chain():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    module_vars = {
        node.targets[0].id: node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
    }
    revision = ast.literal_eval(module_vars["revision"])
    down_revision = ast.literal_eval(module_vars["down_revision"])
    assert revision == "007"
    assert down_revision == "006"


def test_migration_007_upgrade_only_touches_nullable():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    upgrade_fn = _get_function(tree, "upgrade")

    alter_calls = _alter_column_calls(upgrade_fn)
    assert len(alter_calls) == 1, "upgrade() must contain exactly one alter_column call"

    call = alter_calls[0]
    args = [ast.literal_eval(a) for a in call.args]
    assert args == ["users", "email"], "alter_column must target users.email"

    kwarg_names = {kw.arg for kw in call.keywords}
    assert kwarg_names == {"nullable"}, (
        f"alter_column must change only 'nullable', got kwargs: {kwarg_names}"
    )

    nullable_kwarg = next(kw for kw in call.keywords if kw.arg == "nullable")
    assert ast.literal_eval(nullable_kwarg.value) is True


def test_migration_007_downgrade_reverts_nullable():
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    downgrade_fn = _get_function(tree, "downgrade")

    alter_calls = _alter_column_calls(downgrade_fn)
    assert len(alter_calls) == 1, "downgrade() must contain exactly one alter_column call"

    call = alter_calls[0]
    args = [ast.literal_eval(a) for a in call.args]
    assert args == ["users", "email"]

    kwarg_names = {kw.arg for kw in call.keywords}
    assert kwarg_names == {"nullable"}

    nullable_kwarg = next(kw for kw in call.keywords if kw.arg == "nullable")
    assert ast.literal_eval(nullable_kwarg.value) is False


def test_migration_007_does_not_modify_model_or_schema_or_router():
    """
    Requirement 12.5: the migration must not require changes to the User
    model, UserProfileCreate schema, or POST /users route handler.
    This is a documentation-level guard: the migration file itself must not
    import or reference those modules (it should be a pure Alembic script).
    """
    source = MIGRATION_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)

    imported_modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported_modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)

    forbidden = {"app.database.models", "app.schemas.user", "app.routers.users"}
    assert not (imported_modules & forbidden), (
        "Migration must not import model/schema/router modules"
    )
