from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError, DecodeError
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

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
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token não fornecido")

    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
        )
        sub: str = payload.get("sub", "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token inválido")
        return sub

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except (InvalidSignatureError, DecodeError):
        raise HTTPException(status_code=401, detail="Token inválido")
