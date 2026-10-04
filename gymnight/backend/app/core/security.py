from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from jwt.exceptions import ExpiredSignatureError, InvalidAlgorithmError, PyJWTError
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

# Access tokens do Supabase Auth sempre trazem `aud: "authenticated"`.
SUPABASE_AUDIENCE = "authenticated"

# Projetos com "JWT signing keys" assinam com chave assimétrica e publicam a
# chave pública no JWKS; projetos legados assinam HS256 com o JWT secret.
_ASYMMETRIC_ALGORITHMS = ("ES256", "RS256")
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Cliente JWKS único por processo — as chaves ficam em cache por 1h."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client


def _verify_token(token: str) -> dict:
    """
    Escolhe a chave pelo `alg` do header: HS256 → JWT secret; ES256/RS256 →
    chave pública do JWKS do projeto. A audiência é exigida sempre que o token
    a declara (todo token real do Supabase declara).
    """
    alg = jwt.get_unverified_header(token).get("alg")
    unverified_claims = jwt.decode(token, options={"verify_signature": False})
    audience = SUPABASE_AUDIENCE if "aud" in unverified_claims else None

    if alg == "HS256":
        key = settings.SUPABASE_JWT_SECRET
    elif alg in _ASYMMETRIC_ALGORITHMS:
        key = _get_jwks_client().get_signing_key_from_jwt(token).key
    else:
        raise InvalidAlgorithmError(f"Algoritmo não suportado: {alg!r}")

    return jwt.decode(token, key, algorithms=[alg], audience=audience)


def _decode_supabase_jwt(credentials: HTTPAuthorizationCredentials | None) -> dict:
    """
    Valida e decodifica o JWT do Supabase, levantando as mesmas HTTPExceptions
    401 usadas por `get_current_user`. Compartilhado entre `get_current_user`
    e `get_current_user_email` para manter a validação idêntica nos dois.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token não fornecido")

    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")

    try:
        return _verify_token(token)
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except PyJWTError:
        # Assinatura, algoritmo, audiência, formato ou JWKS indisponível: nada
        # disso pode virar 500 — o cliente trata 401 como "refaça o login".
        raise HTTPException(status_code=401, detail="Token inválido")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)
) -> str:
    """
    FastAPI dependency que valida o JWT do Supabase e retorna o sub (UUID do usuário).

    Retorna: str — UUID v4 do usuário autenticado (claim `sub` do JWT)

    Exceções:
    - HTTP 401 "Token não fornecido"  — header ausente ou malformado
    - HTTP 401 "Token expirado"       — claim exp no passado
    - HTTP 401 "Token inválido"       — assinatura inválida ou token malformado
    """
    payload = _decode_supabase_jwt(credentials)
    sub: str = payload.get("sub", "")
    if not sub:
        raise HTTPException(status_code=401, detail="Token inválido")
    return sub


def get_current_user_email(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)
) -> str:
    """
    FastAPI dependency que valida o JWT do Supabase e retorna o claim `email`.

    O Supabase Auth inclui `email` no access token para contas email+senha
    (o único método de login deste app), então o claim está sempre presente
    em uso normal. Ainda assim, a ausência é tratada como HTTP 400 explícito
    em vez de deixar o INSERT falhar com IntegrityError no banco.

    Retorna: str — email do usuário autenticado (claim `email` do JWT)

    Exceções:
    - HTTP 401 "Token não fornecido"/"Token expirado"/"Token inválido" — mesma
      validação de `get_current_user`
    - HTTP 400 "Token não contém claim de email" — JWT válido mas sem `email`
    """
    payload = _decode_supabase_jwt(credentials)
    email: str = payload.get("email", "")
    if not email:
        raise HTTPException(
            status_code=400, detail="Token não contém claim de email"
        )
    return email
