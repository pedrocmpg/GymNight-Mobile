from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database import models
from app.schemas.user import UserProfileCreate, UserProfileResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserProfileResponse)
def create_user_profile(
    profile: UserProfileCreate,
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cria o perfil do usuário autenticado no banco de dados.

    O users.id é extraído do claim `sub` do JWT do Supabase — nunca gerado
    pelo backend. O cadastro em si ocorre no frontend via SDK do Supabase Auth.

    Args:
        profile: Dados opcionais de perfil (name, weight, height, birth_date, gender)
        current_user_id: UUID extraído do JWT pelo `get_current_user`
        db: Sessão do banco injetada pelo FastAPI

    Returns:
        UserProfileResponse com os dados do perfil criado

    Raises:
        HTTP 400: Se o perfil já existe para esse usuário
        HTTP 401: Se o JWT estiver ausente, expirado ou inválido
    """
    existing = db.query(models.User).filter(models.User.id == current_user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Perfil já existe")

    new_user = models.User(
        id=current_user_id,       # sub do JWT = Supabase Auth UUID
        name=profile.name,
        weight=profile.weight,
        height=profile.height,
        birth_date=profile.birth_date,
        gender=profile.gender,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
