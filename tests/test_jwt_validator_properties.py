"""
Property-based tests for the JWT Validator (get_current_user).

Feature: supabase-migration
Properties 1–4: JWT validation behavior

All tests are fully in-memory — no database or real Supabase calls.
"""

import time
from unittest.mock import patch

import jwt as pyjwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from hypothesis import HealthCheck, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

from app.core.security import get_current_user

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

TEST_SECRET = "test-secret-for-hypothesis-runs-x"  # 32+ bytes to avoid InsecureKeyLengthWarning


def make_token(sub: str, exp_delta_seconds: int = 3600, secret: str = TEST_SECRET) -> str:
    """Encode a JWT with the given sub and expiry offset."""
    payload = {"sub": sub, "exp": int(time.time()) + exp_delta_seconds}
    return pyjwt.encode(payload, secret, algorithm="HS256")


def call_get_current_user(token: str) -> str:
    """
    Call get_current_user directly by wrapping *token* in
    a mock HTTPAuthorizationCredentials object.

    settings.SUPABASE_JWT_SECRET is patched to TEST_SECRET so that no
    real Supabase project is required.
    """
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = TEST_SECRET
        return get_current_user(credentials=credentials)


# ---------------------------------------------------------------------------
# Property 1: Successful validation preserves the JWT sub
# Validates: Requirements 2.1, 2.3, 5.8
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(sub=st.uuids().map(str))
def test_property_1_valid_jwt_returns_sub(sub: str) -> None:
    # Feature: supabase-migration, Property 1: valid JWT preserves sub
    """
    **Validates: Requirements 2.1, 2.3, 5.8**

    For any valid UUID v4 used as the `sub` claim in a JWT signed with
    SUPABASE_JWT_SECRET (HS256) and with `exp` in the future,
    get_current_user must return exactly that UUID without modification.
    """
    token = make_token(sub=sub)
    result = call_get_current_user(token)
    assert result == sub, (
        f"get_current_user returned {result!r} but expected sub={sub!r}"
    )


# ---------------------------------------------------------------------------
# Property 2: Expired tokens always result in HTTP 401 "Token expirado"
# Validates: Requirements 2.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    sub=st.uuids().map(str),
    exp=st.integers(max_value=int(time.time()) - 1),
)
def test_property_2_expired_token_returns_401(sub: str, exp: int) -> None:
    # Feature: supabase-migration, Property 2: expired token always returns 401
    """
    **Validates: Requirements 2.4**

    For any JWT correctly signed with SUPABASE_JWT_SECRET whose `exp` claim
    is a timestamp in the past, get_current_user must raise HTTPException
    with status_code=401 and detail="Token expirado" — regardless of the
    payload content.
    """
    payload = {"sub": sub, "exp": exp}
    token = pyjwt.encode(payload, TEST_SECRET, algorithm="HS256")

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = TEST_SECRET
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=credentials)

    assert exc_info.value.status_code == 401, (
        f"Expected status_code=401, got {exc_info.value.status_code}"
    )
    assert exc_info.value.detail == "Token expirado", (
        f"Expected detail='Token expirado', got {exc_info.value.detail!r}"
    )


# ---------------------------------------------------------------------------
# Property 3: Tokens with incorrect signature always result in HTTP 401 "Token inválido"
# Validates: Requirements 2.5
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    sub=st.uuids().map(str),
    wrong_key=st.text(min_size=10).filter(lambda k: k != TEST_SECRET),
)
def test_property_3_invalid_signature_returns_401(sub: str, wrong_key: str) -> None:
    # Feature: supabase-migration, Property 3: invalid signature always returns 401
    """
    **Validates: Requirements 2.5**

    For any token created with a signing key different from SUPABASE_JWT_SECRET
    (regardless of payload content), get_current_user must raise HTTPException
    with status_code=401 and detail="Token inválido".
    """
    token = make_token(sub=sub, secret=wrong_key)

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = TEST_SECRET
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=credentials)

    assert exc_info.value.status_code == 401, (
        f"Expected status_code=401, got {exc_info.value.status_code}"
    )
    assert exc_info.value.detail == "Token inválido", (
        f"Expected detail='Token inválido', got {exc_info.value.detail!r}"
    )


# ---------------------------------------------------------------------------
# Property 4: Absent or malformed headers always result in HTTP 401 "Token não fornecido"
# Validates: Requirements 2.6, 6.3, 7.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    header_value=st.one_of(
        st.none(),
        st.just(""),
        st.text().filter(lambda s: not s.startswith("Bearer ")),
    )
)
def test_property_4_missing_or_malformed_header_returns_401(
    header_value: str | None,
) -> None:
    # Feature: supabase-migration, Property 4: absent or malformed Authorization header always returns 401
    """
    **Validates: Requirements 2.6, 6.3, 7.3**

    For any combination of invalid Authorization header — including total
    absence (None), empty value (""), format without "Bearer " prefix, or
    "Bearer" followed by empty string — get_current_user must raise
    HTTPException with status_code=401 and detail="Token não fornecido".

    Simulation of HTTPBearer(auto_error=False) behavior:
    - None or values not matching "Bearer <token>": HTTPBearer returns None credentials.
    - "Bearer " with empty token part: credentials.credentials is empty string.
    """
    with patch("app.core.security.settings") as mock_settings:
        mock_settings.SUPABASE_JWT_SECRET = TEST_SECRET

        if header_value is None or not header_value.startswith("Bearer "):
            # HTTPBearer(auto_error=False) returns None when header is absent
            # or does not match the Bearer scheme
            credentials = None
        else:
            # header_value starts with "Bearer " — extract the token part
            token_part = header_value[len("Bearer "):]
            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token_part
            )

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=credentials)

    assert exc_info.value.status_code == 401, (
        f"Expected status_code=401, got {exc_info.value.status_code} "
        f"(header_value={header_value!r})"
    )
    assert exc_info.value.detail == "Token não fornecido", (
        f"Expected detail='Token não fornecido', got {exc_info.value.detail!r} "
        f"(header_value={header_value!r})"
    )
