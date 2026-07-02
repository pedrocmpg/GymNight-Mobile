"""
Smoke test: assert that the Alembic migration 006_add_user_profile_fields.py
exists and contains both an `upgrade` and a `downgrade` function definition.

Requirements: 7.1
"""
import pathlib
import re

# Migration 006 can live in either the flat alembic/versions/ directory or
# inside the nested app/database/migrations/alembic/versions/ path used in
# earlier iterations of the design.  We check both.
_REPO_ROOT = pathlib.Path(__file__).parents[2]

_CANDIDATE_PATHS = [
    _REPO_ROOT / "alembic" / "versions" / "006_add_user_profile_fields.py",
    _REPO_ROOT / "app" / "database" / "migrations" / "alembic" / "versions" / "006_add_user_profile_fields.py",
]


def _find_migration_006() -> pathlib.Path | None:
    for path in _CANDIDATE_PATHS:
        if path.exists():
            return path
    return None


def test_migration_006_exists():
    """Migration file 006_add_user_profile_fields.py must exist."""
    migration = _find_migration_006()
    assert migration is not None, (
        "Could not find 006_add_user_profile_fields.py in any of the expected "
        f"locations: {[str(p) for p in _CANDIDATE_PATHS]}"
    )


def test_migration_006_has_upgrade_function():
    """Migration 006 must define an `upgrade` function."""
    migration = _find_migration_006()
    assert migration is not None, "Migration 006 file not found — see test_migration_006_exists."
    content = migration.read_text(encoding="utf-8")
    assert re.search(r'^\s*def\s+upgrade\s*\(', content, re.MULTILINE), (
        "006_add_user_profile_fields.py does not define an `upgrade()` function."
    )


def test_migration_006_has_downgrade_function():
    """Migration 006 must define a `downgrade` function."""
    migration = _find_migration_006()
    assert migration is not None, "Migration 006 file not found — see test_migration_006_exists."
    content = migration.read_text(encoding="utf-8")
    assert re.search(r'^\s*def\s+downgrade\s*\(', content, re.MULTILINE), (
        "006_add_user_profile_fields.py does not define a `downgrade()` function."
    )
