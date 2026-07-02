"""
WatermelonDB Sync Router — Pull e Push com autenticação Supabase JWT.

Implementa o protocolo de sincronização bidirecional do WatermelonDB:
- GET  /sync/pull  → retorna mudanças desde `last_pulled_at` filtradas por usuário
- POST /sync/push  → persiste mudanças enviadas pelo cliente, validando propriedade

MULTI-TENANT SECURITY:
  Pull : filtra todos os resultados por `user_id == sub` (Requirement 7.5)
  Push : rejeita HTTP 403 se qualquer registro contiver `user_id != sub` (Requirement 7.4)

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
"""

import uuid
import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.core.security import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])


# ============================================================================
# SCHEMAS DE PUSH
# ============================================================================

class PushRecord(BaseModel):
    """Um registro individual enviado pelo cliente no payload de push."""
    id: str
    user_id: Optional[str] = None
    # Campos adicionais são passados via model_config com extra="allow"

    model_config = {"extra": "allow"}


class TableChanges(BaseModel):
    """Mudanças de uma tabela específica: criações/atualizações e deleções."""
    created: list[dict[str, Any]] = []
    updated: list[dict[str, Any]] = []
    deleted: list[str] = []


class PushPayload(BaseModel):
    """Payload completo do cliente para a operação de push."""
    changes: dict[str, TableChanges] = {}


# ============================================================================
# HELPERS
# ============================================================================

def _row_to_dict(row) -> dict[str, Any]:
    """Converte uma instância SQLAlchemy em dict serializável."""
    result = {}
    for col in row.__table__.columns:
        result[col.name] = getattr(row, col.name)
    return result


def _validate_push_ownership(payload: PushPayload, sub: str) -> None:
    """
    Garante que nenhum registro no payload pertence a outro usuário.

    Requisito 7.4: rejeita HTTP 403 se qualquer record.user_id != sub.
    Exercícios são tabela compartilhada (sem user_id) — pula essa verificação.
    """
    SHARED_TABLES = {"exercises"}

    for table_name, changes in payload.changes.items():
        if table_name in SHARED_TABLES:
            continue

        all_records = list(changes.created) + list(changes.updated)
        for record in all_records:
            user_id = record.get("user_id")
            if user_id is not None and user_id != sub:
                raise HTTPException(
                    status_code=403,
                    detail="Operação não autorizada",
                )


# ============================================================================
# PULL — GET /sync/pull
# ============================================================================

@router.get("/pull")
def pull(
    last_pulled_at: int = Query(0, description="Unix ms do último pull bem-sucedido"),
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Retorna todas as mudanças do servidor desde `last_pulled_at`, filtradas
    pelo `user_id` do usuário autenticado.

    - Registros criados/atualizados: `updated_at > last_pulled_at`
    - Registros deletados: tombstones de `deleted_records` com `deleted_at > last_pulled_at`

    Requirement 7.1, 7.2, 7.3, 7.5
    """
    now_ms = int(time.time() * 1000)

    # ------------------------------------------------------------------
    # 1. Registros do próprio usuário (tabelas com user_id)
    # ------------------------------------------------------------------

    # users — o próprio perfil do usuário autenticado
    users_updated = (
        db.query(models.User)
        .filter(
            models.User.id == current_user_id,
            models.User.updated_at > last_pulled_at,
        )
        .all()
    )

    # workouts
    workouts_updated = (
        db.query(models.Workout)
        .filter(
            models.Workout.user_id == current_user_id,
            models.Workout.updated_at > last_pulled_at,
        )
        .all()
    )

    # workout_exercises (via join com workouts do usuário)
    workout_exercises_updated = (
        db.query(models.WorkoutExercise)
        .join(models.Workout, models.WorkoutExercise.workout_id == models.Workout.id)
        .filter(
            models.Workout.user_id == current_user_id,
            models.WorkoutExercise.updated_at > last_pulled_at,
        )
        .all()
    )

    # workout_sessions
    workout_sessions_updated = (
        db.query(models.WorkoutSession)
        .filter(
            models.WorkoutSession.user_id == current_user_id,
            models.WorkoutSession.updated_at > last_pulled_at,
        )
        .all()
    )

    # logged_sets (via join com workout_sessions do usuário)
    logged_sets_updated = (
        db.query(models.LoggedSet)
        .join(
            models.WorkoutSession,
            models.LoggedSet.session_id == models.WorkoutSession.id,
        )
        .filter(
            models.WorkoutSession.user_id == current_user_id,
            models.LoggedSet.updated_at > last_pulled_at,
        )
        .all()
    )

    # ------------------------------------------------------------------
    # 2. Exercícios — catálogo compartilhado (sem filtro de user_id)
    # ------------------------------------------------------------------
    exercises_updated = (
        db.query(models.Exercise)
        .filter(models.Exercise.updated_at > last_pulled_at)
        .all()
    )

    # ------------------------------------------------------------------
    # 3. Tombstones (registros deletados) filtrados pelo usuário
    #    user_id IS NULL cobre exercícios deletados (catálogo compartilhado)
    # ------------------------------------------------------------------
    tombstones = (
        db.query(models.DeletedRecord)
        .filter(
            models.DeletedRecord.deleted_at > last_pulled_at,
            (
                (models.DeletedRecord.user_id == current_user_id)
                | (models.DeletedRecord.user_id.is_(None))
            ),
        )
        .all()
    )

    # Agrupa tombstones por tabela
    deleted_by_table: dict[str, list[str]] = {}
    for tombstone in tombstones:
        deleted_by_table.setdefault(tombstone.table_name, []).append(tombstone.record_id)

    # ------------------------------------------------------------------
    # 4. Montar resposta no formato WatermelonDB
    # ------------------------------------------------------------------
    changes: dict[str, Any] = {
        "users": {
            "created": [],
            "updated": [_row_to_dict(r) for r in users_updated],
            "deleted": deleted_by_table.get("users", []),
        },
        "exercises": {
            "created": [],
            "updated": [_row_to_dict(r) for r in exercises_updated],
            "deleted": deleted_by_table.get("exercises", []),
        },
        "workouts": {
            "created": [],
            "updated": [_row_to_dict(r) for r in workouts_updated],
            "deleted": deleted_by_table.get("workouts", []),
        },
        "workout_exercises": {
            "created": [],
            "updated": [_row_to_dict(r) for r in workout_exercises_updated],
            "deleted": deleted_by_table.get("workout_exercises", []),
        },
        "workout_sessions": {
            "created": [],
            "updated": [_row_to_dict(r) for r in workout_sessions_updated],
            "deleted": deleted_by_table.get("workout_sessions", []),
        },
        "logged_sets": {
            "created": [],
            "updated": [_row_to_dict(r) for r in logged_sets_updated],
            "deleted": deleted_by_table.get("logged_sets", []),
        },
    }

    return {"changes": changes, "timestamp": now_ms}


# ============================================================================
# PUSH — POST /sync/push
# ============================================================================

@router.post("/push")
def push(
    payload: PushPayload,
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Persiste as mudanças enviadas pelo cliente após validar a propriedade
    multi-tenant de cada registro.

    - Rejeita HTTP 403 imediatamente se qualquer registro tiver `user_id != sub`
    - Processa criações, atualizações e deleções em ordem de dependência

    Requirement 7.1, 7.2, 7.3, 7.4
    """
    # ------------------------------------------------------------------
    # 1. Validação de propriedade — rejeita toda a requisição se necessário
    # ------------------------------------------------------------------
    _validate_push_ownership(payload, current_user_id)

    # ------------------------------------------------------------------
    # 2. Processar cada tabela
    # ------------------------------------------------------------------
    try:
        _push_exercises(payload.changes.get("exercises"), db)
        _push_users(payload.changes.get("users"), current_user_id, db)
        _push_workouts(payload.changes.get("workouts"), current_user_id, db)
        _push_workout_exercises(payload.changes.get("workout_exercises"), current_user_id, db)
        _push_workout_sessions(payload.changes.get("workout_sessions"), current_user_id, db)
        _push_logged_sets(payload.changes.get("logged_sets"), current_user_id, db)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao persistir mudanças: {exc}") from exc

    return {"status": "ok"}


# ============================================================================
# HANDLERS INTERNOS DE PUSH POR TABELA
# ============================================================================

def _push_exercises(changes: Optional[TableChanges], db: Session) -> None:
    """Exercícios são catálogo compartilhado — sem filtro de user_id."""
    if not changes:
        return

    for record in changes.created:
        existing = db.query(models.Exercise).filter(models.Exercise.id == record["id"]).first()
        if not existing:
            db.add(models.Exercise(**record))

    for record in changes.updated:
        obj = db.query(models.Exercise).filter(models.Exercise.id == record["id"]).first()
        if obj:
            for k, v in record.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    for record_id in changes.deleted:
        obj = db.query(models.Exercise).filter(models.Exercise.id == record_id).first()
        if obj:
            db.delete(obj)


def _push_users(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    """Usuário só pode criar/atualizar/deletar o próprio perfil."""
    if not changes:
        return

    for record in changes.created:
        if record.get("id") != current_user_id:
            raise HTTPException(status_code=403, detail="Operação não autorizada")
        existing = db.query(models.User).filter(models.User.id == record["id"]).first()
        if not existing:
            db.add(models.User(**record))

    for record in changes.updated:
        if record.get("id") != current_user_id:
            raise HTTPException(status_code=403, detail="Operação não autorizada")
        obj = db.query(models.User).filter(models.User.id == record["id"]).first()
        if obj:
            for k, v in record.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    for record_id in changes.deleted:
        if record_id != current_user_id:
            raise HTTPException(status_code=403, detail="Operação não autorizada")
        obj = db.query(models.User).filter(models.User.id == record_id).first()
        if obj:
            db.delete(obj)


def _push_workouts(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    if not changes:
        return

    for record in changes.created:
        existing = db.query(models.Workout).filter(models.Workout.id == record["id"]).first()
        if not existing:
            record.setdefault("user_id", current_user_id)
            db.add(models.Workout(**record))

    for record in changes.updated:
        obj = db.query(models.Workout).filter(
            models.Workout.id == record["id"],
            models.Workout.user_id == current_user_id,
        ).first()
        if obj:
            for k, v in record.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    for record_id in changes.deleted:
        obj = db.query(models.Workout).filter(
            models.Workout.id == record_id,
            models.Workout.user_id == current_user_id,
        ).first()
        if obj:
            db.delete(obj)


def _push_workout_exercises(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    if not changes:
        return

    for record in changes.created:
        existing = db.query(models.WorkoutExercise).filter(
            models.WorkoutExercise.id == record["id"]
        ).first()
        if not existing:
            db.add(models.WorkoutExercise(**record))

    for record in changes.updated:
        # Valida posse indiretamente via workout
        obj = (
            db.query(models.WorkoutExercise)
            .join(models.Workout, models.WorkoutExercise.workout_id == models.Workout.id)
            .filter(
                models.WorkoutExercise.id == record["id"],
                models.Workout.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            for k, v in record.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    for record_id in changes.deleted:
        obj = (
            db.query(models.WorkoutExercise)
            .join(models.Workout, models.WorkoutExercise.workout_id == models.Workout.id)
            .filter(
                models.WorkoutExercise.id == record_id,
                models.Workout.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            db.delete(obj)


def _push_workout_sessions(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    if not changes:
        return

    for record in changes.created:
        existing = db.query(models.WorkoutSession).filter(
            models.WorkoutSession.id == record["id"]
        ).first()
        if not existing:
            record.setdefault("user_id", current_user_id)
            db.add(models.WorkoutSession(**record))

    for record in changes.updated:
        obj = db.query(models.WorkoutSession).filter(
            models.WorkoutSession.id == record["id"],
            models.WorkoutSession.user_id == current_user_id,
        ).first()
        if obj:
            for k, v in record.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    for record_id in changes.deleted:
        obj = db.query(models.WorkoutSession).filter(
            models.WorkoutSession.id == record_id,
            models.WorkoutSession.user_id == current_user_id,
        ).first()
        if obj:
            db.delete(obj)


def _push_logged_sets(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    if not changes:
        return

    for record in changes.created:
        existing = db.query(models.LoggedSet).filter(
            models.LoggedSet.id == record["id"]
        ).first()
        if not existing:
            db.add(models.LoggedSet(**record))

    for record in changes.updated:
        obj = (
            db.query(models.LoggedSet)
            .join(
                models.WorkoutSession,
                models.LoggedSet.session_id == models.WorkoutSession.id,
            )
            .filter(
                models.LoggedSet.id == record["id"],
                models.WorkoutSession.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            for k, v in record.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    for record_id in changes.deleted:
        obj = (
            db.query(models.LoggedSet)
            .join(
                models.WorkoutSession,
                models.LoggedSet.session_id == models.WorkoutSession.id,
            )
            .filter(
                models.LoggedSet.id == record_id,
                models.WorkoutSession.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            db.delete(obj)
