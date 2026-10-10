"""
Regressão: o sync push de um usuário com gênero em PT ('Masculino', o valor
que o onboarding do app grava) devolvia 500 — o validador do model só
aceitava 'male'/'female'/'other'. Agora o valor é aceito e volta idêntico
no pull.
"""

import os
import uuid

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.core.security import get_current_user  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client_for(db_transaction):
    def make(user_id: str) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: user_id
        app.dependency_overrides[get_db] = lambda: db_transaction
        return TestClient(app, raise_server_exceptions=False)

    yield make
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.parametrize("gender", ["Masculino", "Feminino", "Outro"])
def test_push_user_with_pt_gender_round_trips(client_for, gender):
    user_id = str(uuid.uuid4())
    client = client_for(user_id)
    record = {
        "id": user_id,
        "name": "Pedro",
        "email": f"{user_id[:8]}@gender-pt.test",
        "gender": gender,
        "created_at": 1,
        "updated_at": 1,
    }

    push = client.post(
        "/api/v1/sync/push",
        json={"changes": {"users": {"created": [record], "updated": [], "deleted": []}}},
    )
    assert push.status_code == 200, push.text

    pull = client.get("/api/v1/sync/pull", params={"last_pulled_at": 0})
    assert pull.status_code == 200, pull.text
    users = pull.json()["changes"]["users"]
    pulled = users["created"] + users["updated"]
    assert [u["gender"] for u in pulled if u["id"] == user_id] == [gender]


def test_push_user_with_unknown_gender_is_still_rejected(client_for):
    user_id = str(uuid.uuid4())
    client = client_for(user_id)
    record = {
        "id": user_id,
        "name": "Pedro",
        "email": f"{user_id[:8]}@gender-pt.test",
        "gender": "masculino",
        "created_at": 1,
        "updated_at": 1,
    }
    push = client.post(
        "/api/v1/sync/push",
        json={"changes": {"users": {"created": [record], "updated": [], "deleted": []}}},
    )
    assert push.status_code >= 400
