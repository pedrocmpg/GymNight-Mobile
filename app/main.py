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
from app.database.connection import engine
from app.database import models
from app.routers import users, auth

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
# CRIAÇÃO DAS TABELAS NO BANCO DE DADOS
# ============================================================================
# models.Base.metadata.create_all() cria todas as tabelas definidas nos modelos
# se elas ainda não existirem no banco de dados.
#
# IMPORTANTE:
# - Isso roda APENAS na inicialização da aplicação
# - Se tabelas já existem, não faz nada (não sobrescreve)
# - Em produção, usar migrations (Alembic) em vez disso
models.Base.metadata.create_all(bind=engine)

# ============================================================================
# INCLUSÃO DOS ROTEADORES MODULARES
# ============================================================================
# app.include_router() registra todos os endpoints de cada roteador.
#
# ROTEADORES:
# - users: Rotas de gerenciamento de usuários (/users)
# - auth: Rotas de autenticação (/auth/login, /auth/google)
#
# VANTAGENS DA MODULARIZAÇÃO:
# - Código organizado por responsabilidade
# - Fácil manutenção (cada roteador em seu arquivo)
# - Documentação Swagger agrupada por tags
# - Testabilidade (pode testar roteadores isoladamente)
app.include_router(users.router)
app.include_router(auth.router)

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
