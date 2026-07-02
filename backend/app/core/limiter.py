"""
SlowAPI rate limiter singleton.

Defined here (instead of app/main.py) to avoid circular imports:
  app/main.py → app/api/v1/endpoints/sync.py → app/core/limiter.py
                                              ↑ (no back-reference to main)

Requirements: 9.3, 9.4, 9.5
"""

from fastapi import Request
from slowapi import Limiter

from app.core.config import settings


def _get_rate_limit_key(request: Request) -> str:
    """
    Extract 'sub' from the Bearer JWT if present and decodable;
    fall back to the client IP address (Requirement 9.3).
    """
    auth: str = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[len("Bearer "):]
        try:
            import jwt as pyjwt  # PyJWT — decode without verification for key extraction
            payload = pyjwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=["HS256"],
            )
            sub = payload.get("sub")
            if sub:
                return str(sub)
        except Exception:
            pass  # Fall through to IP-based key
    # Fall back to client IP address
    if request.client:
        return request.client.host
    return "unknown"


# Gate limiter with RATE_LIMIT_ENABLED env var (Requirement 9.4).
_rate_limit_enabled: bool = settings.RATE_LIMIT_ENABLED.lower() != "false"

limiter = Limiter(
    key_func=_get_rate_limit_key,
    enabled=_rate_limit_enabled,
)
