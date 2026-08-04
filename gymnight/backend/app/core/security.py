from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError, DecodeError
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


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
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except (InvalidSignatureError, DecodeError):
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
