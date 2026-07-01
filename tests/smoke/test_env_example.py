"""
Smoke test: assert that .env.example exists and contains no real credential patterns.

Real credential patterns checked:
  - eyJ…            : base64-encoded JWT token (always starts with eyJ)
  - postgresql://   : DB URL containing what looks like real (non-placeholder) credentials
  - https://<real>.supabase.co : Supabase URL with a real project ref (not a generic placeholder)

Requirements: 2.2, 14.1
"""
import pathlib
import re


ENV_EXAMPLE = pathlib.Path(__file__).parents[2] / ".env.example"


def test_env_example_exists():
    """The .env.example file must exist in the repository root."""
    assert ENV_EXAMPLE.exists(), ".env.example not found in the project root."


def test_no_jwt_token_in_env_example():
    """
    No real JWT token (eyJ…) should appear in .env.example.
    Real JWTs are base64-encoded and always start with 'eyJ'.
    A placeholder like 'your-supabase-jwt-secret-here' would never start with 'eyJ'.
    """
    content = ENV_EXAMPLE.read_text(encoding="utf-8")
    # Look for a value that starts with eyJ — the signature of a real encoded JWT
    jwt_pattern = re.compile(r'=\s*eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+')
    match = jwt_pattern.search(content)
    assert match is None, (
        f".env.example contains what looks like a real JWT token: {match.group()!r}. "
        "Replace it with a placeholder value."
    )


def test_no_real_db_url_credentials_in_env_example():
    """
    Any postgresql:// URL in .env.example must use obvious placeholder values.
    We flag a DB URL only when it contains a hostname that does NOT look like a
    generic placeholder (i.e. not containing 'localhost', 'host', 'your', 'db_',
    'test_', or 'example').
    """
    content = ENV_EXAMPLE.read_text(encoding="utf-8")
    # Find all postgresql:// lines
    db_url_pattern = re.compile(r'postgresql://[^\s]+@([^:/\s]+)', re.IGNORECASE)
    for match in db_url_pattern.finditer(content):
        hostname = match.group(1).lower()
        placeholder_indicators = ("localhost", "host", "your", "db_", "test_", "example", "127.0.0.1")
        is_placeholder = any(ind in hostname for ind in placeholder_indicators)
        assert is_placeholder, (
            f".env.example contains a postgresql:// URL with what appears to be a real "
            f"hostname ({hostname!r}). Replace with a placeholder like "
            f"'postgresql://db_user:db_password@db_host:5432/db_name'."
        )


def test_no_real_supabase_url_in_env_example():
    """
    Any Supabase URL in .env.example must use a generic placeholder project ref
    (not a real project reference like 'abcdefghijklmnop.supabase.co').
    Placeholder refs typically contain 'your', 'project', 'ref', or 'example'.
    """
    content = ENV_EXAMPLE.read_text(encoding="utf-8")
    supabase_pattern = re.compile(r'https://([a-z0-9\-]+)\.supabase\.co', re.IGNORECASE)
    for match in supabase_pattern.finditer(content):
        project_ref = match.group(1).lower()
        placeholder_indicators = ("your", "project", "ref", "example", "placeholder")
        is_placeholder = any(ind in project_ref for ind in placeholder_indicators)
        assert is_placeholder, (
            f".env.example contains what looks like a real Supabase project ref: "
            f"{project_ref!r}. Replace with a placeholder like "
            f"'https://your-project-ref.supabase.co'."
        )
