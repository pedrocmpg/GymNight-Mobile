from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import get_current_user
from app.gymai.providers import ChatProvider, ProviderError, create_provider

router = APIRouter(prefix="/chat", tags=["gymai"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)


class ChatResponse(BaseModel):
    reply: str


def get_chat_provider() -> ChatProvider:
    try:
        return create_provider(
            {
                "GYMAI_PROVIDER": settings.GYMAI_PROVIDER,
                "GEMINI_API_KEY": settings.GEMINI_API_KEY,
                "GEMINI_MODEL": settings.GEMINI_MODEL,
            }
        )
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    body: ChatRequest,
    _user_id: str = Depends(get_current_user),
    provider: ChatProvider = Depends(get_chat_provider),
) -> ChatResponse:
    """Proxy do GymAI: a chave do provedor fica só no servidor."""
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="a última mensagem deve ser do usuário")
    try:
        text = await provider.reply([m.model_dump() for m in body.messages])
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return ChatResponse(reply=text)
