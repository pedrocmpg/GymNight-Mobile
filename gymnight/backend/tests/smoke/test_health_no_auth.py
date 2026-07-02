"""
Smoke test: assert that app/routers/health.py does NOT call Depends(get_current_user).

The /health endpoint must be publicly accessible without JWT authentication
(Requirement 8.4).
"""
import pathlib
import re


HEALTH_PY = pathlib.Path(__file__).parents[2] / "app" / "routers" / "health.py"


def test_health_router_exists():
    """app/routers/health.py must exist."""
    assert HEALTH_PY.exists(), "app/routers/health.py not found."


def test_health_has_no_get_current_user_dependency():
    """
    The health router must not contain Depends(get_current_user).
    Presence of this call would make the /health endpoint require authentication,
    breaking load-balancer health checks (Requirement 8.4).
    """
    content = HEALTH_PY.read_text(encoding="utf-8")
    # Match any variant: Depends(get_current_user), Depends( get_current_user ), etc.
    pattern = re.compile(r'Depends\s*\(\s*get_current_user\s*\)')
    match = pattern.search(content)
    assert match is None, (
        "app/routers/health.py contains 'Depends(get_current_user)' — "
        "remove it so that GET /health is publicly accessible without a JWT "
        "(Requirement 8.4)."
    )
