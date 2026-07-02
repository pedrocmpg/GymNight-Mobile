"""
Smoke test: static analysis of app/ to ensure no legacy auth code remains.

Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
"""

import re
from pathlib import Path

# Root of the app source tree (relative to this file's location)
APP_DIR = Path(__file__).parent.parent.parent / "app"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _collect_py_files() -> list[Path]:
    """Return all .py files under app/ recursively."""
    return sorted(APP_DIR.rglob("*.py"))


def _check_pattern_absent(
    pattern: str,
    py_files: list[Path],
    description: str,
) -> list[str]:
    """
    Scan every file for lines matching *pattern* (regex).
    Returns a list of violation strings (file:line:content) if any are found.
    """
    compiled = re.compile(pattern)
    violations: list[str] = []
    for filepath in py_files:
        source = filepath.read_text(encoding="utf-8")
        for lineno, line in enumerate(source.splitlines(), start=1):
            if compiled.search(line):
                rel = filepath.relative_to(APP_DIR.parent)
                violations.append(
                    f"  [{description}] {rel}:{lineno}: {line.strip()}"
                )
    return violations


# ---------------------------------------------------------------------------
# Test 1 — No legacy auth library imports
# ---------------------------------------------------------------------------

# Patterns that should NOT appear anywhere in app/
FORBIDDEN_IMPORT_PATTERNS: list[tuple[str, str]] = [
    # bcrypt
    (r"^\s*(import\s+bcrypt|from\s+bcrypt\b)", "bcrypt import"),
    # passlib
    (r"^\s*(import\s+passlib|from\s+passlib\b)", "passlib import"),
    # jose / jose.jwt
    (r"^\s*(import\s+jose\b|from\s+jose\b)", "jose import"),
    # python_jose
    (r"^\s*(import\s+python_jose\b|from\s+python_jose\b)", "python_jose import"),
]


def test_no_legacy_auth_library_imports() -> None:
    """
    Assert that no file under app/ imports bcrypt, passlib, jose, or
    python_jose in any form.

    Validates: Requirements 1.1, 1.2
    """
    py_files = _collect_py_files()
    assert py_files, f"No Python files found under {APP_DIR}"

    all_violations: list[str] = []
    for pattern, description in FORBIDDEN_IMPORT_PATTERNS:
        all_violations.extend(_check_pattern_absent(pattern, py_files, description))

    assert not all_violations, (
        "Legacy auth library imports found in app/:\n"
        + "\n".join(all_violations)
    )


# ---------------------------------------------------------------------------
# Test 2 — No legacy auth function definitions
# ---------------------------------------------------------------------------

FORBIDDEN_FUNCTION_PATTERNS: list[tuple[str, str]] = [
    (r"\bdef\s+hash_password\b", "def hash_password"),
    (r"\bdef\s+verify_password\b", "def verify_password"),
    (r"\bdef\s+create_access_token\b", "def create_access_token"),
]


def test_no_legacy_auth_function_definitions() -> None:
    """
    Assert that no file under app/ defines hash_password, verify_password,
    or create_access_token.

    Validates: Requirements 1.3, 1.4, 1.5
    """
    py_files = _collect_py_files()
    assert py_files, f"No Python files found under {APP_DIR}"

    all_violations: list[str] = []
    for pattern, description in FORBIDDEN_FUNCTION_PATTERNS:
        all_violations.extend(_check_pattern_absent(pattern, py_files, description))

    assert not all_violations, (
        "Legacy auth function definitions found in app/:\n"
        + "\n".join(all_violations)
    )
