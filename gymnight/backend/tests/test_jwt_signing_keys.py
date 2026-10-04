"""
Validação de JWT com as "JWT signing keys" do Supabase (2026-10-04).

O projeto Supabase passou a assinar access tokens com ES256 e a publicar a
chave pública no JWKS (`/auth/v1/.well-known/jwks.json`). O backend só
aceitava HS256 com o JWT secret, e todo request autenticado de um token real
quebrava com HTTP 500 (`InvalidAlgorithmError` não era capturado). Estes
testes travam: ES256 via JWKS, a audiência `authenticated` e que nenhum erro
de JWT vira 500.
"""

import time
from types import SimpleNamespace
from unittest.mock import patch

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security
from app.core.security import get_current_user

TEST_SECRET = "test-hs256-secret-with-enough-length-for-hmac"
SUB = "6f1c2a9e-0d3b-4c55-9a1e-2b7f4d8c9e01"


def _claims(**overrides) -> dict:
    claims = {"sub": SUB, "aud": "authenticated", "exp": int(time.time()) + 3600}
    claims.update(overrides)
    return claims


def _call(token: str, public_key=None) -> str:
    """Chama get_current_user com settings e cliente JWKS controlados."""
    jwks_client = SimpleNamespace(
        get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=public_key)
    )
    with patch("app.core.security.settings") as mock_settings, patch.object(
        security, "_get_jwks_client", return_value=jwks_client
    ):
        mock_settings.SUPABASE_JWT_SECRET = TEST_SECRET
        mock_settings.SUPABASE_URL = "https://example.supabase.co"
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        return get_current_user(creds)


@pytest.fixture(scope="module")
def ec_keys():
    private_key = ec.generate_private_key(ec.SECP256R1())
    return private_key, private_key.public_key()


def test_es256_token_is_verified_with_the_jwks_public_key(ec_keys):
    private_key, public_key = ec_keys
    token = pyjwt.encode(_claims(), private_key, algorithm="ES256")
    assert _call(token, public_key) == SUB


def test_es256_token_signed_by_another_key_is_401(ec_keys):
    _, public_key = ec_keys
    other_private = ec.generate_private_key(ec.SECP256R1())
    token = pyjwt.encode(_claims(), other_private, algorithm="ES256")
    with pytest.raises(HTTPException) as exc:
        _call(token, public_key)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Token inválido"


def test_expired_es256_token_is_401_expired(ec_keys):
    private_key, public_key = ec_keys
    token = pyjwt.encode(_claims(exp=int(time.time()) - 10), private_key, algorithm="ES256")
    with pytest.raises(HTTPException) as exc:
        _call(token, public_key)
    assert exc.value.detail == "Token expirado"


def test_hs256_supabase_token_with_audience_is_accepted():
    # Antes da correção, todo token real (que traz `aud`) caía em
    # InvalidAudienceError → 500, mesmo em HS256.
    token = pyjwt.encode(_claims(), TEST_SECRET, algorithm="HS256")
    assert _call(token) == SUB


def test_wrong_audience_is_401():
    token = pyjwt.encode(_claims(aud="anon"), TEST_SECRET, algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        _call(token)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Token inválido"


@pytest.mark.parametrize("alg", ["HS384", "HS512"])
def test_unsupported_algorithm_is_401_not_500(alg):
    token = pyjwt.encode(_claims(), TEST_SECRET, algorithm=alg)
    with pytest.raises(HTTPException) as exc:
        _call(token)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Token inválido"


def test_unreachable_jwks_is_401_not_500(ec_keys):
    private_key, _ = ec_keys
    token = pyjwt.encode(_claims(), private_key, algorithm="ES256")

    def boom(_token):
        raise pyjwt.PyJWKClientError("Fail to fetch data from the url")

    with patch("app.core.security.settings") as mock_settings, patch.object(
        security,
        "_get_jwks_client",
        return_value=SimpleNamespace(get_signing_key_from_jwt=boom),
    ):
        mock_settings.SUPABASE_JWT_SECRET = TEST_SECRET
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc:
            get_current_user(creds)
    assert exc.value.status_code == 401
