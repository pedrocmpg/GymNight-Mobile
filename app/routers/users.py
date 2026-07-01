from fastapi import APIRouter, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database import models
from app.schemas.user import UserProfileCreate, UserProfileUpdate, UserProfileResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileResponse, status_code=200)
def get_user_profile(
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retorna o perfil do usuário autenticado.

    O user_id é extraído exclusivamente do claim `sub` do JWT — nunca de
    parâmetros de rota ou query string.

    Args:
        current_user_id: UUID extraído do JWT pelo `get_current_user`
        db: Sessão do banco injetada pelo FastAPI

    Returns:
        UserProfileResponse com {id, name, weight, height, birth_date, gender}

    Raises:
        HTTP 401: Se o JWT estiver ausente, expirado ou inválido
        HTTP 404: Se nenhum perfil for encontrado para o user_id do JWT
    """
    user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user


@router.patch("/me", response_model=UserProfileResponse, status_code=200)
def update_user_profile(
    profile: UserProfileUpdate,
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Atualiza parcialmente o perfil do usuário autenticado.

    Apenas os campos explicitamente enviados no body são atualizados.
    Um body vazio `{}` retorna HTTP 200 com o perfil inalterado.

    Args:
        profile: Campos opcionais a atualizar (name, weight, height, birth_date, gender)
        current_user_id: UUID extraído do JWT pelo `get_current_user`
        db: Sessão do banco injetada pelo FastAPI

    Returns:
        UserProfileResponse com os dados completos do perfil atualizado

    Raises:
        HTTP 401: Se o JWT estiver ausente, expirado ou inválido
        HTTP 404: Se nenhum perfil for encontrado para o user_id do JWT
        HTTP 422: Se algum campo tiver valor inválido
    """
    user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    updates = profile.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.post("", response_model=UserProfileResponse, status_code=201)
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


@router.delete("/me", status_code=204, response_class=Response)
def delete_user_account(
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exclui a conta do usuário autenticado e todos os seus dados associados.

    Todas as deleções são executadas dentro de uma única transação. Se qualquer
    operação falhar, a transação é revertida (rollback) e HTTP 500 é retornado,
    deixando todos os dados intactos.

    Tabelas afetadas (na ordem de deleção):
      1. deleted_records  — registros de tombstone do usuário (sem FK, deleção explícita)
      2. logged_sets      — via CASCADE do SQLAlchemy em workout_sessions
      3. workout_sessions — via CASCADE do SQLAlchemy em User
      4. workouts         — via CASCADE do SQLAlchemy em User (e workout_exercises junto)
      5. users            — o próprio registro do usuário

    Args:
        current_user_id: UUID extraído do JWT pelo `get_current_user`
        db: Sessão do banco injetada pelo FastAPI

    Returns:
        HTTP 204 (sem corpo) em caso de sucesso

    Raises:
        HTTP 401: Se o JWT estiver ausente, expirado ou inválido
        HTTP 404: Se nenhum perfil for encontrado para o user_id do JWT
        HTTP 500: Se qualquer operação de deleção falhar (rollback automático)
    """
    user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    try:
        # 1. Delete deleted_records rows for this user explicitly.
        #    (deleted_records has no FK to users, so it won't cascade automatically.)
        db.query(models.DeletedRecord).filter(
            models.DeletedRecord.user_id == current_user_id
        ).delete(synchronize_session=False)

        # 2. Delete the user row.
        #    The SQLAlchemy cascade="all, delete-orphan" on User.workouts and
        #    User.workout_sessions will automatically remove:
        #      - workouts (and their workout_exercises via Workout cascade)
        #      - workout_sessions (and their logged_sets via WorkoutSession cascade)
        db.delete(user)

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return Response(status_code=204)
