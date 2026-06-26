"""
Smoke test: static analysis of schema and model structure.

Verifies:
1. UserProfileCreate, UserProfileUpdate, UserProfileResponse exist in app/schemas/user.py
2. None of those classes declare a `password` field
3. app/database/models/user.py does NOT contain `password_hash`

Requirements: 5.7, 6.2, 6.5
"""

import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_FILE = PROJECT_ROOT / "app" / "schemas" / "user.py"
MODEL_FILE = PROJECT_ROOT / "app" / "database" / "models" / "user.py"

REQUIRED_SCHEMA_CLASSES = ["UserProfileCreate", "UserProfileUpdate", "UserProfileResponse"]


def _parse_ast(path: Path) -> ast.Module:
    """Parse a Python source file into an AST module."""
    source = path.read_text(encoding="utf-8")
    return ast.parse(source, filename=str(path))


def _get_class_nodes(tree: ast.Module) -> dict[str, ast.ClassDef]:
    """Return a dict of top-level class name → ClassDef node."""
    return {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef)
    }


def _class_declares_field(class_node: ast.ClassDef, field_name: str) -> bool:
    """
    Return True if the class declares `field_name` as an annotated assignment
    (i.e., `field_name: ...` or `field_name: ... = ...`).
    """
    for node in ast.walk(class_node):
        if isinstance(node, ast.AnnAssign):
            target = node.target
            if isinstance(target, ast.Name) and target.id == field_name:
                return True
    return False


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_user_profile_create_exists():
    """Requirement 6.2 — UserProfileCreate must be defined in app/schemas/user.py."""
    tree = _parse_ast(SCHEMA_FILE)
    classes = _get_class_nodes(tree)
    assert "UserProfileCreate" in classes, (
        f"'UserProfileCreate' not found in {SCHEMA_FILE}. "
        f"Found classes: {list(classes.keys())}"
    )


def test_user_profile_update_exists():
    """Requirement 6.2 — UserProfileUpdate must be defined in app/schemas/user.py."""
    tree = _parse_ast(SCHEMA_FILE)
    classes = _get_class_nodes(tree)
    assert "UserProfileUpdate" in classes, (
        f"'UserProfileUpdate' not found in {SCHEMA_FILE}. "
        f"Found classes: {list(classes.keys())}"
    )


def test_user_profile_response_exists():
    """Requirement 6.2 — UserProfileResponse must be defined in app/schemas/user.py."""
    tree = _parse_ast(SCHEMA_FILE)
    classes = _get_class_nodes(tree)
    assert "UserProfileResponse" in classes, (
        f"'UserProfileResponse' not found in {SCHEMA_FILE}. "
        f"Found classes: {list(classes.keys())}"
    )


def test_no_password_field_in_new_schemas():
    """
    Requirement 6.5 — None of UserProfileCreate, UserProfileUpdate, UserProfileResponse
    may declare a `password` field.
    """
    tree = _parse_ast(SCHEMA_FILE)
    classes = _get_class_nodes(tree)

    for class_name in REQUIRED_SCHEMA_CLASSES:
        if class_name not in classes:
            # Already caught by the existence tests above; skip here to keep
            # failure messages focused.
            continue
        class_node = classes[class_name]
        assert not _class_declares_field(class_node, "password"), (
            f"Class '{class_name}' in {SCHEMA_FILE} declares a 'password' field, "
            "which is forbidden after the Supabase Auth migration."
        )


def test_user_model_has_no_password_hash():
    """
    Requirement 5.7 — The User model in app/database/models/user.py must NOT
    contain a `password_hash` column or attribute.
    """
    source = MODEL_FILE.read_text(encoding="utf-8")
    assert "password_hash" not in source, (
        f"'password_hash' was found in {MODEL_FILE}. "
        "This column must be removed via Alembic migration 004 as part of the "
        "Supabase Auth migration (password management is delegated to Supabase)."
    )
