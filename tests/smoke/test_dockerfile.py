"""
Smoke test: assert that a Dockerfile exists in the project root and contains
a HEALTHCHECK instruction.

Requirements: 12.6, 14.1
"""
import pathlib
import re


DOCKERFILE = pathlib.Path(__file__).parents[2] / "Dockerfile"


def test_dockerfile_exists():
    """A Dockerfile must exist in the project root."""
    assert DOCKERFILE.exists(), "Dockerfile not found in the project root."


def test_dockerfile_has_healthcheck_instruction():
    """
    The Dockerfile must contain at least one HEALTHCHECK instruction
    (a line starting with 'HEALTHCHECK').

    Requirement 12.6: The Dockerfile SHALL include a HEALTHCHECK instruction
    that calls GET /health with a timeout of 5 seconds, an interval of 30
    seconds, and a start period of 10 seconds.
    """
    content = DOCKERFILE.read_text(encoding="utf-8")
    # Look for a line that starts with HEALTHCHECK (case-sensitive per Dockerfile spec)
    has_healthcheck = any(
        re.match(r'^HEALTHCHECK\b', line)
        for line in content.splitlines()
    )
    assert has_healthcheck, (
        "Dockerfile does not contain a HEALTHCHECK instruction. "
        "Add a line starting with 'HEALTHCHECK' to enable container health monitoring "
        "(Requirement 12.6)."
    )
