"""
Smoke test: static analysis of app/core/config.py.

Validates requirements 3.4, 3.5, 3.6 by inspecting the source file as plain
text — no live import of the Settings class is performed.
"""

from pathlib import Path

CONFIG_PATH = Path(__file__).parents[2] / "app" / "core" / "config.py"


def _source() -> str:
    assert CONFIG_PATH.exists(), f"config.py not found at {CONFIG_PATH}"
    return CONFIG_PATH.read_text(encoding="utf-8")


def test_imports_pydantic_settings():
    """config.py must import from pydantic_settings (Requirement 3.5)."""
    source = _source()
    assert "from pydantic_settings import" in source or "import pydantic_settings" in source, (
        "config.py does not import from 'pydantic_settings'. "
        "Expected 'from pydantic_settings import ...' or 'import pydantic_settings'."
    )


def test_does_not_use_dotenv():
    """config.py must not use python-dotenv (Requirement 3.5)."""
    source = _source()
    assert "from dotenv" not in source, (
        "config.py contains 'from dotenv', which means it is using python-dotenv. "
        "Configuration must be loaded exclusively via pydantic-settings BaseSettings."
    )
    assert "load_dotenv" not in source, (
        "config.py contains 'load_dotenv', which means it is using python-dotenv. "
        "Configuration must be loaded exclusively via pydantic-settings BaseSettings."
    )
    assert "import dotenv" not in source, (
        "config.py contains 'import dotenv'. "
        "Configuration must be loaded exclusively via pydantic-settings BaseSettings."
    )


def test_does_not_use_os_getenv():
    """config.py must not use os.getenv() as the config loading mechanism (Requirement 3.5)."""
    source = _source()
    assert "os.getenv(" not in source, (
        "config.py contains 'os.getenv(', which is forbidden. "
        "All configuration must be loaded via pydantic-settings BaseSettings fields, "
        "not via manual os.getenv() calls."
    )


def test_no_legacy_auth_fields():
    """
    config.py must not declare SECRET_KEY, ALGORITHM or ACCESS_TOKEN_EXPIRE_MINUTES
    as fields (Requirement 3.4).

    A field declaration looks like a bare class attribute name followed by ': ' or '='.
    We check that these names do not appear at all as top-level attribute names inside
    the Settings class body.
    """
    source = _source()
    legacy_fields = ("SECRET_KEY", "ALGORITHM", "ACCESS_TOKEN_EXPIRE_MINUTES")
    for field in legacy_fields:
        # Match lines like "    SECRET_KEY: str" or "    SECRET_KEY = ..."
        # Using a simple membership check is sufficient for static analysis.
        assert f"    {field}:" not in source and f"    {field} =" not in source, (
            f"config.py declares '{field}' as a class attribute inside Settings. "
            f"This field must be removed; it belongs to the old manual-JWT configuration."
        )


def test_database_url_references_port_6543():
    """
    The DATABASE_URL field declaration must include the string '6543' somewhere
    in the file, documenting that the PgBouncer Connection Pooling URL (port 6543)
    must be used for IPv4-compatible production environments (Requirement 3.6).
    """
    source = _source()
    assert "6543" in source, (
        "config.py does not contain the string '6543'. "
        "The DATABASE_URL field declaration must include an inline comment or note "
        "stating that the Connection Pooling URL (PgBouncer, port 6543) must be used "
        "for IPv4-compatible production environments."
    )
