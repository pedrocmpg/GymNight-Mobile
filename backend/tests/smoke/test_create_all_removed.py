"""
Smoke test: assert that Base.metadata.create_all() is not called in app/main.py.

Requirements: 7.1
"""
import pathlib


def test_create_all_absent_from_main():
    """create_all must not appear in app/main.py (Alembic is the sole migration authority)."""
    main_py = pathlib.Path(__file__).parents[2] / "app" / "main.py"
    assert main_py.exists(), "app/main.py not found"
    content = main_py.read_text(encoding="utf-8")
    assert "create_all" not in content, (
        "app/main.py still contains 'create_all' — remove Base.metadata.create_all() "
        "so that Alembic is the sole schema migration authority (Requirement 7.1)."
    )
