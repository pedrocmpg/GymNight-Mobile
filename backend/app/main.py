# ============================================================================
# ARQUIVO PRINCIPAL DA APLICAÇÃO FASTAPI
# ============================================================================
# Este é o ponto de entrada da aplicação. Responsabilidades:
# - Instanciar o FastAPI
# - Criar tabelas no banco de dados
# - Incluir roteadores modulares
# - Configurar handlers de exceção
#
# PRINCÍPIO: Este arquivo deve ser MÍNIMO e LIMPO.
# Toda lógica de negócio fica nos módulos especializados.
# ============================================================================

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from app.routers import users
from app.routers.admin import router as admin_router
from app.routers.health import router as health_router
from app.api.v1.endpoints.sync import sync_router
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.correlation_id import CorrelationIDMiddleware

# Configure structured logging at startup (Req 11.4, 11.6)
configure_logging()


# ============================================================================
# RATE LIMITING — SlowAPI (Req 9.3, 9.4, 9.5)
# ============================================================================
# The limiter singleton (with _get_rate_limit_key and RATE_LIMIT_ENABLED gating)
# is defined in app/core/limiter.py to avoid circular imports with sync.py.


# Custom RateLimitExceeded handler — returns HTTP 429 with the required body
# and the Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining headers
# (Requirements 9.2, 9.5).
async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return HTTP 429 with standard rate-limit headers."""
    # SlowAPI stores the retry-after value as exc.retry_after (seconds).
    retry_after = getattr(exc, "retry_after", 1)
    # Ensure a positive minimum of 1 second (Requirement 9.2).
    retry_after = max(int(retry_after), 1)

    # SlowAPI exposes limit detail via exc.detail, which contains the limit string
    # (e.g., "60 per 1 minute"). Parse configured limit and remaining from the
    # underlying limit headers that SlowAPI would normally set.
    limit_value = str(getattr(exc, "limit", "60"))
    remaining_value = "0"

    # Attempt to read richer header info surfaced by the limit object.
    limit_obj = getattr(exc, "limit", None)
    if limit_obj is not None:
        limit_value = str(getattr(limit_obj, "limit", limit_value))
        remaining_value = str(getattr(limit_obj, "remaining", "0"))

    return JSONResponse(
        status_code=429,
        content={"error": "Rate limit exceeded"},
        headers={
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit": limit_value,
            "X-RateLimit-Remaining": remaining_value,
        },
    )


# ============================================================================
# INSTANCIAÇÃO DO FASTAPI
# ============================================================================
# Cria a aplicação FastAPI que será servida pelo Uvicorn.
app = FastAPI(
    title="GymNight API",
    description="API para gerenciamento de treinos e usuários do app GymNight",
    version="2.0.0"
)

# ============================================================================
# INCLUSÃO DOS ROTEADORES MODULARES
# ============================================================================
# app.include_router() registra todos os endpoints de cada roteador.
#
# ROTEADORES:
# - users: Rotas de gerenciamento de usuários (/users)
# - sync: Rotas de sincronização WatermelonDB (/sync/pull, /sync/push)
#
# VANTAGENS DA MODULARIZAÇÃO:
# - Código organizado por responsabilidade
# - Fácil manutenção (cada roteador em seu arquivo)
# - Documentação Swagger agrupada por tags
# - Testabilidade (pode testar roteadores isoladamente)

# Attach the limiter to app.state so SlowAPI middleware can access it (Req 9)
app.state.limiter = limiter
# Register the custom 429 handler (Req 9.2, 9.5)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(users.router)
# Public health check: GET /health (no authentication)
app.include_router(health_router)
# Admin endpoints: POST /admin/cleanup-tombstones (Req 10)
app.include_router(admin_router)
# Canonical sync router: GET /api/v1/sync/pull and POST /api/v1/sync/push
app.include_router(sync_router, prefix="/api/v1")

# ============================================================================
# MIDDLEWARE REGISTRATION
# ============================================================================
# NOTE: Starlette/FastAPI wraps middleware in reverse registration order —
# the LAST add_middleware call becomes the OUTERMOST layer (runs first).
#
# Desired execution order (outermost → innermost):
#   1. CorrelationIDMiddleware  — generates/validates UUID, binds to structlog
#   2. AccessLogMiddleware      — logs method/path/status/latency; the
#                                 correlation_id is already set by layer 1
#
# Registration order (first = innermost, last = outermost):
#   add_middleware(AccessLogMiddleware)     ← inner layer (registered first)
#   add_middleware(CorrelationIDMiddleware) ← outermost layer (registered last)
app.add_middleware(AccessLogMiddleware)      # Req 11.3 — inner layer
app.add_middleware(CorrelationIDMiddleware)  # Req 11.1, 11.2, 11.5 — outermost

# ============================================================================
# HANDLER DE EXCEÇÕES DE VALIDAÇÃO
# ============================================================================
# Customiza a resposta de erros de validação do Pydantic (422).
# Retorna mensagens de erro mais amigáveis em português.


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handler customizado para erros de validação do Pydantic.
    
    Transforma erros técnicos em mensagens amigáveis para o usuário.
    
    Args:
        request: Requisição HTTP que causou o erro
        exc: Exceção de validação lançada pelo Pydantic
    
    Returns:
        JSONResponse com status 422 e lista de erros formatados
    """
    errors = []
    for error in exc.errors():
        # Extrai o nome do campo que falhou na validação
        field = error['loc'][-1] if error['loc'] else 'unknown'
        # Extrai a mensagem de erro
        message = error['msg']
        errors.append({
            "field": field,
            "message": message
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Erro de validação",
            "errors": errors
        }
    )


# ============================================================================
# ROTA DE HEALTH CHECK
# ============================================================================
# Rota simples para verificar se a API está rodando.
# Útil para monitoramento e load balancers.
@app.get("/")
def read_root():
    """
    Health check da API.
    
    Returns:
        dict: Status da API
    """
    return {
        "status": "ok",
        "message": "GymNight API está rodando",
        "version": "2.0.0"
    }
