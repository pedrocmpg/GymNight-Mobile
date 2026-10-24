"""GymAI: provedor configurável por env, mock nos testes, Anthropic recusada."""

import asyncio
import os

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-placeholder")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.core.security import get_current_user  # noqa: E402
from app.gymai import providers  # noqa: E402
from app.gymai.providers import GeminiProvider, MockProvider, ProviderError, create_provider  # noqa: E402
from app.main import app  # noqa: E402
from app.routers.chat import get_chat_provider  # noqa: E402


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: "user-fixture"
    app.dependency_overrides[get_chat_provider] = lambda: MockProvider()
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_chat_provider, None)


def test_default_provider_is_mock():
    assert isinstance(create_provider({}), MockProvider)
    assert isinstance(create_provider({"GYMAI_PROVIDER": "MOCK"}), MockProvider)


def test_gemini_selected_by_env_and_requires_key():
    assert create_provider({"GYMAI_PROVIDER": "gemini", "GEMINI_API_KEY": "fixture-key"}).name == "gemini"
    with pytest.raises(ProviderError):
        create_provider({"GYMAI_PROVIDER": "gemini"})


@pytest.mark.parametrize("name", ["anthropic", "claude", "Claude-Sonnet", "my-anthropic-proxy"])
def test_anthropic_is_never_allowed(name):
    with pytest.raises(ProviderError, match="Anthropic"):
        create_provider({"GYMAI_PROVIDER": name, "GEMINI_API_KEY": "x"})


def test_unknown_provider_rejected():
    with pytest.raises(ProviderError):
        create_provider({"GYMAI_PROVIDER": "outro"})


def test_chat_endpoint_with_mock(client):
    r = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "Como melhorar meu supino?"}]})
    assert r.status_code == 200
    assert r.json() == {"reply": "[mock] Recebi: Como melhorar meu supino?"}


def test_chat_requires_auth():
    app.dependency_overrides.pop(get_current_user, None)
    assert TestClient(app).post("/api/v1/chat", json={"messages": [{"role": "user", "content": "oi"}]}).status_code in (401, 403)


@pytest.mark.parametrize("payload", [
    {"messages": []},
    {"messages": [{"role": "user", "content": ""}]},
    {"messages": [{"role": "system", "content": "x"}]},
    {"messages": [{"role": "user", "content": "x" * 2001}]},
    {"messages": [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}]},
])
def test_chat_validates_input(client, payload):
    assert client.post("/api/v1/chat", json=payload).status_code == 422


def test_provider_failure_becomes_502(client):
    class Broken:
        name = "broken"

        async def reply(self, messages):
            raise ProviderError("cota esgotada")

    app.dependency_overrides[get_chat_provider] = lambda: Broken()
    r = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "oi"}]})
    assert r.status_code == 502


def test_gemini_provider_maps_request_and_response(monkeypatch):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = request.read().decode()
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "Aumente 2,5 kg."}]}}]})

    real = httpx.AsyncClient
    monkeypatch.setattr(providers.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    out = asyncio.run(GeminiProvider("fixture-key").reply([
        {"role": "user", "content": "oi"}, {"role": "assistant", "content": "olá"}, {"role": "user", "content": "e agora?"},
    ]))
    assert out == "Aumente 2,5 kg."
    assert seen["key"] == "fixture-key"
    assert '"role": "model"' in seen["body"] or '"role":"model"' in seen["body"]


def test_gemini_http_error_becomes_provider_error(monkeypatch):
    real = httpx.AsyncClient
    monkeypatch.setattr(
        providers.httpx, "AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(lambda r: httpx.Response(429)), **kw),
    )
    with pytest.raises(ProviderError):
        asyncio.run(GeminiProvider("fixture-key").reply([{"role": "user", "content": "oi"}]))
