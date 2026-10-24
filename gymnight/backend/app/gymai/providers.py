"""
Provedores do GymAI.

O provedor é escolhido pela variável de ambiente `GYMAI_PROVIDER`:
  - "mock"   (padrão): resposta determinística, sem rede — usado nos testes.
  - "gemini": API gratuita do Google Gemini (chave em `GEMINI_API_KEY`).

A API da Anthropic NUNCA é usada aqui: nomes de provedor que a mencionam são
recusados explicitamente em `create_provider`.
"""

import os
from typing import Protocol

import httpx

SYSTEM_PROMPT = (
    "Você é o GymAI, um personal trainer virtual do app GymNight. Responda em "
    "português, de forma curta e prática, sobre treino, execução de exercícios, "
    "progressão de carga e recuperação. Não dê diagnóstico médico."
)

_BLOCKED_NAME_PARTS = ("anthropic", "claude")


class ProviderError(Exception):
    """Falha ao obter resposta do provedor (rede, cota, resposta inválida)."""


class ChatProvider(Protocol):
    name: str

    async def reply(self, messages: list[dict[str, str]]) -> str:
        """`messages`: [{"role": "user"|"assistant", "content": str}], última é do usuário."""
        ...


class MockProvider:
    name = "mock"

    async def reply(self, messages: list[dict[str, str]]) -> str:
        last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        return f"[mock] Recebi: {last}"


class GeminiProvider:
    name = "gemini"
    _URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash", timeout: float = 30.0):
        if not api_key:
            raise ProviderError("GEMINI_API_KEY não configurada")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    async def reply(self, messages: list[dict[str, str]]) -> str:
        body = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [
                {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    self._URL.format(model=self._model),
                    headers={"x-goog-api-key": self._api_key},
                    json=body,
                )
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise ProviderError(f"falha no provedor gemini: {type(exc).__name__}") from exc


def create_provider(env: dict[str, str] | None = None) -> ChatProvider:
    env = os.environ if env is None else env
    name = (env.get("GYMAI_PROVIDER") or "mock").strip().lower()
    if any(part in name for part in _BLOCKED_NAME_PARTS):
        raise ProviderError("provedor não permitido: a API da Anthropic não é usada pelo GymAI")
    if name == "mock":
        return MockProvider()
    if name == "gemini":
        return GeminiProvider(env.get("GEMINI_API_KEY", ""), env.get("GEMINI_MODEL") or "gemini-2.0-flash")
    raise ProviderError(f"provedor desconhecido: {name!r}")
