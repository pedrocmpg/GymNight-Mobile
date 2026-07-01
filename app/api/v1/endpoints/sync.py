"""
WatermelonDB Sync Router v1 — Pull e Push com autenticação Supabase JWT.

Implementa o protocolo de sincronização bidirecional do WatermelonDB:
- GET  /api/v1/sync/pull  → retorna mudanças desde `last_pulled_at` filtradas por usuário,
                            com separação correta de `created` vs `updated`
- POST /api/v1/sync/push  → persiste mudanças enviadas pelo cliente, com ownership scan
                            antecipado cobrindo tabelas indiretas (workout_exercises, logged_sets)

Correções em relação ao router legado (app/routers/sync.py):
1. Separação correta de `created` vs `updated` no Pull (protocolo WatermelonDB)
2. Ownership scan antecipado com cobertura de tabelas indiretas no Push

Requirements: 1.1, 1.2, 2.1, 2.2
"""

import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import (
    DeletedRecord,
    Exercise,
    LoggedSet,
    User,
    Workout,
    WorkoutExercise,
    WorkoutSession,
)

# ============================================================================
# ROUTER
# ============================================================================

sync_router = APIRouter(prefix="/sync", tags=["sync v1"])


# ============================================================================
# SCHEMAS PYDANTIC
# ============================================================================

class TableChanges(BaseModel):
    """Mudanças de uma tabela específica: criações, atualizações e deleções."""
    created: list[dict[str, Any]] = []
    updated: list[dict[str, Any]] = []
    deleted: list[str] = []


class PushPayload(BaseModel):
    """Payload completo enviado pelo cliente WatermelonDB na operação de push."""
    changes: dict[str, TableChanges] = {}
    last_pulled_at: int = 0


# ============================================================================
# HELPERS UTILITÁRIOS
# ============================================================================


def _row_to_dict(row) -> dict[str, Any]:
    """
    Serializa um registro SQLAlchemy como dict {nome_coluna: valor}.

    Usa `__table__.columns` em vez de `__dict__` para evitar incluir atributos
    internos do SQLAlchemy como `_sa_instance_state`.

    Requirements: 6.2
    """
    return {col.name: getattr(row, col.name) for col in row.__table__.columns}


def _split_created_updated(rows, last_pulled_at: int) -> tuple[list, list]:
    """
    Separa uma lista de registros em (created, updated) com base em `created_at`.

    - `created`: registros com `created_at > last_pulled_at`
    - `updated`: registros com `created_at <= last_pulled_at`

    Ambas as listas contêm dicts serializados via `_row_to_dict`.

    Requirements: 4.1, 4.2, 4.5
    """
    created: list[dict[str, Any]] = []
    updated: list[dict[str, Any]] = []
    for row in rows:
        d = _row_to_dict(row)
        if row.created_at > last_pulled_at:
            created.append(d)
        else:
            updated.append(d)
    return created, updated


# ============================================================================
# ENDPOINTS (stubs — retornam "not implemented" por ora)
# ============================================================================

@sync_router.get("/pull")
@limiter.limit("60/minute")
def pull(
    request: Request,
    last_pulled_at: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Retorna todas as mudanças do servidor desde `last_pulled_at`, separando
    registros em `created` e `updated` conforme o protocolo WatermelonDB.

    O timestamp é capturado ANTES de qualquer query SQL para evitar race
    conditions onde registros criados durante o processamento sejam perdidos.

    Requirements: 2.1, 3.1, 3.2, 3.3, 4.1–4.5, 5.1–5.7, 6.1–6.3, 11.1–11.3
    """
    # --- Subtask 3.1: captura do timestamp antes de qualquer query SQL ---
    # Req 3.1: DEVE ser a primeira instrução, antes de qualquer query
    current_server_timestamp = int(time.time() * 1000)

    # --- Subtask 3.2: queries por tabela com filtro multi-tenant ---

    # Req 5.1: users — filtra pelo próprio id do usuário autenticado
    users_rows = db.query(User).filter(
        User.id == current_user_id,
        User.updated_at > last_pulled_at,
    ).all()

    # Req 5.6: exercises — sem filtro de usuário (catálogo compartilhado)
    exercises_rows = db.query(Exercise).filter(
        Exercise.updated_at > last_pulled_at,
    ).all()

    # Req 5.2: workouts — filtra por user_id direto
    workouts_rows = db.query(Workout).filter(
        Workout.user_id == current_user_id,
        Workout.updated_at > last_pulled_at,
    ).all()

    # Req 5.4: workout_exercises — JOIN com workouts (sem user_id direto)
    workout_exercises_rows = (
        db.query(WorkoutExercise)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .filter(
            Workout.user_id == current_user_id,
            WorkoutExercise.updated_at > last_pulled_at,
        )
        .all()
    )

    # Req 5.3: workout_sessions — filtra por user_id direto
    sessions_rows = db.query(WorkoutSession).filter(
        WorkoutSession.user_id == current_user_id,
        WorkoutSession.updated_at > last_pulled_at,
    ).all()

    # Req 5.5: logged_sets — JOIN com workout_sessions (sem user_id direto)
    logged_sets_rows = (
        db.query(LoggedSet)
        .join(WorkoutSession, LoggedSet.session_id == WorkoutSession.id)
        .filter(
            WorkoutSession.user_id == current_user_id,
            LoggedSet.updated_at > last_pulled_at,
        )
        .all()
    )

    # Req 5.7: tombstones — user_id == uid OU NULL (exercícios deletados do catálogo)
    tombstones = db.query(DeletedRecord).filter(
        DeletedRecord.deleted_at > last_pulled_at,
        (DeletedRecord.user_id == current_user_id) | (DeletedRecord.user_id.is_(None)),
    ).all()

    # Agrupar tombstones por table_name → dict[str, list[str]]
    deleted_by_table: dict[str, list[str]] = {}
    for tombstone in tombstones:
        deleted_by_table.setdefault(tombstone.table_name, []).append(tombstone.record_id)

    # --- Subtask 3.3: montar resposta com separação created/updated/deleted ---

    # Req 4.1, 4.2, 4.5: classificar cada tabela via _split_created_updated
    users_created, users_updated = _split_created_updated(users_rows, last_pulled_at)
    exercises_created, exercises_updated = _split_created_updated(exercises_rows, last_pulled_at)
    workouts_created, workouts_updated = _split_created_updated(workouts_rows, last_pulled_at)
    workout_exercises_created, workout_exercises_updated = _split_created_updated(
        workout_exercises_rows, last_pulled_at
    )
    sessions_created, sessions_updated = _split_created_updated(sessions_rows, last_pulled_at)
    logged_sets_created, logged_sets_updated = _split_created_updated(logged_sets_rows, last_pulled_at)

    # Req 6.1: todas as 6 tabelas obrigatórias presentes mesmo quando vazias
    changes = {
        "users": {
            "created": users_created,
            "updated": users_updated,
            "deleted": deleted_by_table.get("users", []),
        },
        "exercises": {
            "created": exercises_created,
            "updated": exercises_updated,
            "deleted": deleted_by_table.get("exercises", []),
        },
        "workouts": {
            "created": workouts_created,
            "updated": workouts_updated,
            "deleted": deleted_by_table.get("workouts", []),
        },
        "workout_exercises": {
            "created": workout_exercises_created,
            "updated": workout_exercises_updated,
            "deleted": deleted_by_table.get("workout_exercises", []),
        },
        "workout_sessions": {
            "created": sessions_created,
            "updated": sessions_updated,
            "deleted": deleted_by_table.get("workout_sessions", []),
        },
        "logged_sets": {
            "created": logged_sets_created,
            "updated": logged_sets_updated,
            "deleted": deleted_by_table.get("logged_sets", []),
        },
    }

    # Req 3.2, 3.3, 6.3: retornar changes + timestamp no formato WatermelonDB
    return {"changes": changes, "timestamp": current_server_timestamp}


# ============================================================================
# PUSH — OWNERSHIP SCAN
# ============================================================================


def _validate_push_ownership(
    payload: PushPayload,
    current_user_id: str,
    db: Session,
) -> None:
    """
    Verifica a propriedade multi-tenant de todos os registros no payload ANTES
    de qualquer escrita no banco de dados.

    Levanta HTTPException(403) imediatamente ao detectar a primeira violação,
    garantindo semântica all-or-nothing: nenhum dado é persistido quando ao
    menos um registro é inválido.

    Tabelas verificadas:
    - users            : id == current_user_id  (Req 10)
    - workouts         : user_id == current_user_id se user_id presente (Req 7.2)
    - workout_sessions : user_id == current_user_id se user_id presente (Req 7.2)
    - workout_exercises: JOIN com Workout no banco  (Req 7.3)
    - logged_sets      : JOIN com WorkoutSession no banco (Req 7.4)
    - exercises        : SKIP — catálogo compartilhado  (Req 7.5)

    Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
    """
    changes = payload.changes

    # --- Tabela `users`: user_id direto + id == current_user_id (Req 10) ---
    users_changes = changes.get("users")
    if users_changes:
        for record in users_changes.created + users_changes.updated:
            # Req 7.2: user_id explícito não pode divergir
            if (
                record.get("user_id") is not None
                and record["user_id"] != current_user_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: user_id mismatch in users table",
                )
            # Req 10: id do perfil deve ser o próprio usuário
            if record.get("id") is not None and record["id"] != current_user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: cannot modify another user's profile",
                )
        # Req 10.3: delete IDs que não sejam o próprio usuário → HTTP 403
        for record_id in users_changes.deleted:
            if record_id != current_user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: cannot delete another user's profile",
                )

    # --- Tabela `workouts`: user_id direto (Req 7.2) ---
    workouts_changes = changes.get("workouts")
    if workouts_changes:
        for record in workouts_changes.created + workouts_changes.updated:
            if (
                record.get("user_id") is not None
                and record["user_id"] != current_user_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: user_id mismatch in workouts table",
                )

    # --- Tabela `workout_sessions`: user_id direto (Req 7.2) ---
    sessions_changes = changes.get("workout_sessions")
    if sessions_changes:
        for record in sessions_changes.created + sessions_changes.updated:
            if (
                record.get("user_id") is not None
                and record["user_id"] != current_user_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: user_id mismatch in workout_sessions table",
                )

    # --- Tabela `workout_exercises`: ownership indireta via Workout (Req 7.3) ---
    we_changes = changes.get("workout_exercises")
    if we_changes:
        for record in we_changes.created + we_changes.updated:
            workout = (
                db.query(Workout)
                .filter(Workout.id == record["workout_id"])
                .first()
            )
            if workout is None or workout.user_id != current_user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: workout_exercise references workout not owned by user",
                )

    # --- Tabela `logged_sets`: ownership indireta via WorkoutSession (Req 7.4) ---
    ls_changes = changes.get("logged_sets")
    if ls_changes:
        for record in ls_changes.created + ls_changes.updated:
            session = (
                db.query(WorkoutSession)
                .filter(WorkoutSession.id == record["session_id"])
                .first()
            )
            if session is None or session.user_id != current_user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: logged_set references session not owned by user",
                )

    # exercises: SKIP — catálogo compartilhado, sem verificação de ownership (Req 7.5)


# ============================================================================
# PUSH HANDLERS — por tabela, em ordem de dependência FK
# ============================================================================


def _push_exercises(changes: Optional[TableChanges], db: Session) -> None:
    """
    Persiste criações, atualizações e deleções de exercícios (catálogo compartilhado).

    Sem verificação de user_id — exercises são compartilhados entre todos os usuários.
    Criações são idempotentes: insere somente se o id ainda não existe.

    Requirements: 9.1, 9.5, 9.9, 9.10, 8.4
    """
    if not changes:
        return

    # created: idempotente — inserir somente se id não existe
    for rec in changes.created:
        if db.query(Exercise).filter(Exercise.id == rec["id"]).first() is None:
            filtered = {k: v for k, v in rec.items() if hasattr(Exercise, k)}
            db.add(Exercise(**filtered))

    # updated: sem filtro de user (catálogo compartilhado)
    for rec in changes.updated:
        obj = db.query(Exercise).filter(Exercise.id == rec["id"]).first()
        if obj:
            for k, v in rec.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    # deleted: sem filtro de user (catálogo compartilhado)
    for record_id in changes.deleted:
        obj = db.query(Exercise).filter(Exercise.id == record_id).first()
        if obj:
            db.delete(obj)


def _push_users(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    """
    Persiste criações, atualizações e deleções do perfil do usuário autenticado.

    Levanta HTTP 403 se qualquer operação tentar afetar um perfil diferente do
    usuário autenticado — um usuário só pode gerenciar seu próprio perfil.

    Requirements: 9.1, 9.2, 9.6, 10.1, 10.2, 10.3
    """
    if not changes:
        return

    # created: somente o próprio usuário pode criar seu perfil
    for rec in changes.created:
        if rec.get("id") != current_user_id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: cannot create profile for another user",
            )
        if db.query(User).filter(User.id == rec["id"]).first() is None:
            filtered = {k: v for k, v in rec.items() if hasattr(User, k)}
            db.add(User(**filtered))

    # updated: somente o próprio usuário pode atualizar seu perfil
    for rec in changes.updated:
        if rec.get("id") != current_user_id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: cannot update another user's profile",
            )
        obj = db.query(User).filter(User.id == rec["id"]).first()
        if obj:
            for k, v in rec.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    # deleted: somente o próprio usuário pode deletar seu perfil
    for record_id in changes.deleted:
        if record_id != current_user_id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: cannot delete another user's profile",
            )
        obj = db.query(User).filter(User.id == record_id).first()
        if obj:
            db.delete(obj)


def _push_workouts(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    """
    Persiste criações, atualizações e deleções de workouts do usuário autenticado.

    Criações garantem user_id via setdefault. Updates e deletes filtram por
    user_id para evitar que um usuário modifique workouts de outro.

    Requirements: 9.1, 9.2, 9.6, 9.11, 8.4
    """
    if not changes:
        return

    # created: idempotente; garante user_id preenchido
    for rec in changes.created:
        rec.setdefault("user_id", current_user_id)
        if db.query(Workout).filter(Workout.id == rec["id"]).first() is None:
            filtered = {k: v for k, v in rec.items() if hasattr(Workout, k)}
            db.add(Workout(**filtered))

    # updated: filter por user_id para isolamento multi-tenant
    for rec in changes.updated:
        obj = (
            db.query(Workout)
            .filter(Workout.id == rec["id"], Workout.user_id == current_user_id)
            .first()
        )
        if obj:
            for k, v in rec.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    # deleted: filter por user_id para isolamento multi-tenant
    for record_id in changes.deleted:
        obj = (
            db.query(Workout)
            .filter(Workout.id == record_id, Workout.user_id == current_user_id)
            .first()
        )
        if obj:
            db.delete(obj)


def _push_workout_exercises(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    """
    Persiste criações, atualizações e deleções de workout_exercises.

    Ownership é verificado indiretamente via JOIN com Workout. O ownership scan
    antecipado já validou created/updated; updates e deletes revalidam no handler
    via JOIN para garantir que somente o dono do workout pode alterar seus exercícios.

    Requirements: 9.1, 9.3, 9.7, 8.4
    """
    if not changes:
        return

    # created: idempotente — ownership já validado no scan antecipado
    for rec in changes.created:
        if db.query(WorkoutExercise).filter(WorkoutExercise.id == rec["id"]).first() is None:
            filtered = {k: v for k, v in rec.items() if hasattr(WorkoutExercise, k)}
            db.add(WorkoutExercise(**filtered))

    # updated: JOIN com Workout para verificar ownership indiretamente
    for rec in changes.updated:
        obj = (
            db.query(WorkoutExercise)
            .join(Workout, WorkoutExercise.workout_id == Workout.id)
            .filter(
                WorkoutExercise.id == rec["id"],
                Workout.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            for k, v in rec.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    # deleted: JOIN com Workout para verificar ownership antes do delete
    for record_id in changes.deleted:
        obj = (
            db.query(WorkoutExercise)
            .join(Workout, WorkoutExercise.workout_id == Workout.id)
            .filter(
                WorkoutExercise.id == record_id,
                Workout.user_id == current_user_id,
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
    """
    Persiste criações, atualizações e deleções de workout_sessions do usuário.

    Criações garantem user_id via setdefault. Updates e deletes filtram por
    user_id para isolamento multi-tenant.

    Requirements: 9.1, 9.2, 9.6, 9.11, 8.4
    """
    if not changes:
        return

    # created: idempotente; garante user_id preenchido
    for rec in changes.created:
        rec.setdefault("user_id", current_user_id)
        if db.query(WorkoutSession).filter(WorkoutSession.id == rec["id"]).first() is None:
            filtered = {k: v for k, v in rec.items() if hasattr(WorkoutSession, k)}
            db.add(WorkoutSession(**filtered))

    # updated: filter por user_id para isolamento multi-tenant
    for rec in changes.updated:
        obj = (
            db.query(WorkoutSession)
            .filter(
                WorkoutSession.id == rec["id"],
                WorkoutSession.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            for k, v in rec.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    # deleted: filter por user_id para isolamento multi-tenant
    for record_id in changes.deleted:
        obj = (
            db.query(WorkoutSession)
            .filter(
                WorkoutSession.id == record_id,
                WorkoutSession.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            db.delete(obj)


def _push_logged_sets(
    changes: Optional[TableChanges],
    current_user_id: str,
    db: Session,
) -> None:
    """
    Persiste criações, atualizações e deleções de logged_sets.

    Ownership é verificado indiretamente via JOIN com WorkoutSession. O ownership
    scan antecipado já validou created/updated; updates e deletes revalidam no handler
    via JOIN para garantir que somente o dono da sessão pode alterar seus sets.

    Requirements: 9.1, 9.4, 9.8, 8.4
    """
    if not changes:
        return

    # created: idempotente — ownership já validado no scan antecipado
    for rec in changes.created:
        if db.query(LoggedSet).filter(LoggedSet.id == rec["id"]).first() is None:
            filtered = {k: v for k, v in rec.items() if hasattr(LoggedSet, k)}
            db.add(LoggedSet(**filtered))

    # updated: JOIN com WorkoutSession para verificar ownership indiretamente
    for rec in changes.updated:
        obj = (
            db.query(LoggedSet)
            .join(WorkoutSession, LoggedSet.session_id == WorkoutSession.id)
            .filter(
                LoggedSet.id == rec["id"],
                WorkoutSession.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            for k, v in rec.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)

    # deleted: JOIN com WorkoutSession para verificar ownership antes do delete
    for record_id in changes.deleted:
        obj = (
            db.query(LoggedSet)
            .join(WorkoutSession, LoggedSet.session_id == WorkoutSession.id)
            .filter(
                LoggedSet.id == record_id,
                WorkoutSession.user_id == current_user_id,
            )
            .first()
        )
        if obj:
            db.delete(obj)


# ============================================================================
# PUSH ENDPOINT
# ============================================================================


@sync_router.post("/push")
@limiter.limit("60/minute")
def push(
    request: Request,
    payload: PushPayload,
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Persiste as mudanças enviadas pelo cliente após validar a propriedade
    multi-tenant de cada registro, incluindo tabelas de posse indireta.

    Fluxo:
    1. Ownership scan completo (antes de qualquer write) — HTTP 403 se inválido
    2. Handlers por tabela em ordem FK (stubs — implementados nas tasks 5.x)
    3. db.commit() em sucesso; db.rollback() em qualquer erro

    Requirements: 2.2, 2.4, 7.1, 8.1, 8.2, 8.3, 11.1, 11.2, 11.3
    """
    # FASE 1: ownership scan antecipado — DEVE ser a primeira operação
    _validate_push_ownership(payload, current_user_id, db)

    # FASE 2: handlers por tabela em ordem de dependência FK
    # (implementados nas tasks 5.1–5.6; chamadas reais adicionadas na task 5.7)
    try:
        # FK order: exercises → users → workouts → workout_exercises
        #           → workout_sessions → logged_sets
        _push_exercises(payload.changes.get("exercises"), db)
        _push_users(payload.changes.get("users"), current_user_id, db)
        _push_workouts(payload.changes.get("workouts"), current_user_id, db)
        _push_workout_exercises(payload.changes.get("workout_exercises"), current_user_id, db)
        _push_workout_sessions(payload.changes.get("workout_sessions"), current_user_id, db)
        _push_logged_sets(payload.changes.get("logged_sets"), current_user_id, db)

        db.commit()
        return {"status": "ok"}

    except HTTPException:
        # Propaga erros HTTP (403, etc.) intactos após rollback
        db.rollback()
        raise

    except Exception as exc:
        # Erros inesperados de banco → HTTP 500 após rollback
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
