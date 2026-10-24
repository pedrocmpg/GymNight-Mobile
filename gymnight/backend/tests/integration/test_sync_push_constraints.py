"""
Integration tests: sync push contra constraints reais do PostgreSQL.

Os testes de propriedade do router usam DB mockado e por isso não enxergam
violações de NOT NULL / UNIQUE / FK. Aqui o payload tem o formato que o
WatermelonDB envia (snake_case, timestamps em ms) e o commit acontece de verdade.
"""

import os
import uuid

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database import models  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.main import app  # noqa: E402

NOW = 1_760_000_000_000


def _id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def client_for(db_transaction):
    def make(user_id: str) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: user_id
        app.dependency_overrides[get_db] = lambda: db_transaction
        return TestClient(app, raise_server_exceptions=False)

    yield make
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def _push(client, changes):
    return client.post("/api/v1/sync/push", json={"changes": changes, "last_pulled_at": 0})


def _ts(**extra):
    return {"created_at": NOW, "updated_at": NOW, **extra}


def test_push_deleting_workout_keeps_history_sessions(db_transaction, client_for):
    """Apagar um treino-modelo não pode quebrar nem apagar as sessões já feitas."""
    user_id, exercise_id = _id(), _id()
    workout_id, we_id, session_id, set_id = _id(), _id(), _id(), _id()
    client = client_for(user_id)

    r = _push(client, {
        "exercises": {"created": [{"id": exercise_id, "name": "Supino de teste", **_ts()}], "updated": [], "deleted": []},
        "users": {"created": [{"id": user_id, "name": "Usuario Teste", "email": f"{user_id}@teste.local", **_ts()}], "updated": [], "deleted": []},
        "workouts": {"created": [{"id": workout_id, "user_id": user_id, "name": "Treino A", "description": "", **_ts()}], "updated": [], "deleted": []},
        "workout_exercises": {"created": [{"id": we_id, "workout_id": workout_id, "exercise_id": exercise_id,
                                           "series_target": 3, "reps_target": 10, "weight_target": 20.0, "order_index": 0, **_ts()}], "updated": [], "deleted": []},
        "workout_sessions": {"created": [{"id": session_id, "user_id": user_id, "workout_id": workout_id,
                                          "started_at": NOW, "ended_at": NOW + 1000, **_ts()}], "updated": [], "deleted": []},
        "logged_sets": {"created": [{"id": set_id, "session_id": session_id, "exercise_id": exercise_id, "weight": 20.0,
                                     "repetitions": 10, "estimated_one_rm": 26.6, "set_type": "N", "completed_at": NOW, **_ts()}], "updated": [], "deleted": []},
    })
    assert r.status_code == 200, r.text

    r = _push(client, {
        "workout_exercises": {"created": [], "updated": [], "deleted": [we_id]},
        "workouts": {"created": [], "updated": [], "deleted": [workout_id]},
    })
    assert r.status_code == 200, r.text

    db_transaction.expire_all()
    session = db_transaction.get(models.WorkoutSession, session_id)
    assert session is not None
    assert session.workout_id is None
    assert db_transaction.get(models.LoggedSet, set_id) is not None


def test_push_child_of_other_users_workout_in_same_payload_is_forbidden(db_transaction, client_for):
    """Pai no mesmo payload só vale se o id não pertence a outro usuário."""
    owner_id, intruder_id, exercise_id, workout_id = _id(), _id(), _id(), _id()

    owner = client_for(owner_id)
    r = _push(owner, {
        "exercises": {"created": [{"id": exercise_id, "name": "Remada de teste", **_ts()}], "updated": [], "deleted": []},
        "users": {"created": [{"id": owner_id, "name": "Dono Teste", "email": f"{owner_id}@teste.local", **_ts()}], "updated": [], "deleted": []},
        "workouts": {"created": [{"id": workout_id, "user_id": owner_id, "name": "Treino do dono", "description": "", **_ts()}], "updated": [], "deleted": []},
    })
    assert r.status_code == 200, r.text

    intruder = client_for(intruder_id)
    r = _push(intruder, {
        "workouts": {"created": [{"id": workout_id, "user_id": intruder_id, "name": "Tentativa", "description": "", **_ts()}], "updated": [], "deleted": []},
        "workout_exercises": {"created": [{"id": _id(), "workout_id": workout_id, "exercise_id": exercise_id,
                                           "series_target": 3, "reps_target": 10, "weight_target": 20.0, "order_index": 0, **_ts()}], "updated": [], "deleted": []},
    })
    assert r.status_code == 403
