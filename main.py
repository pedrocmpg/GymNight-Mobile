# ============================================================================
# ARQUIVO PRINCIPAL DA APLICAÇÃO FASTAPI - RAIZ DO PROJETO
# ============================================================================
# Este é o ponto de entrada da aplicação que roda na RAIZ do projeto.
# Ele importa e orquestra todos os submódulos da pasta app/.
#
# ESTRUTURA DO PROJETO:
# ---------------------
# /
# ├── main.py                    ← VOCÊ ESTÁ AQUI (arquivo de entrada)
# ├── app/                       ← Pasta com toda a lógica da aplicação
# │   ├── __init__.py
# │   ├── core/                  ← Configurações e segurança
# │   │   ├── config.py          (DATABASE_URL, SECRET_KEY, etc)
# │   │   └── security.py        (hash_password, verify_password, JWT)
# │   ├── database/              ← Conexão e modelos do banco
# │   │   ├── connection.py      (engine, SessionLocal, get_db)
# │   │   └── models.py          (User, Workout, Exercise - tabelas)
# │   ├── routers/               ← Endpoints da API (rotas modulares)
# │   │   ├── auth.py            (POST /auth/login)
# │   │   └── users.py           (POST /users - cadastro)
# │   └── schemas/               ← Validação de dados (Pydantic)
# │       └── user.py            (UserCreate, UserLogin)
# └── venv/                      ← Ambiente virtual Python
#
# RESPONSABILIDADES DESTE ARQUIVO:
# ---------------------------------
# 1. Instanciar o FastAPI
# 2. Criar tabelas no banco de dados (via SQLAlchemy)
# 3. Incluir roteadores modulares (auth.py e users.py)
# 4. Configurar handlers de exceção customizados
# 5. Fornecer rota de health check (/)
#
# PRINCÍPIO: Este arquivo deve ser MÍNIMO e LIMPO.
# Toda lógica de negócio fica nos módulos especializados dentro de app/.
# ============================================================================

# ============================================================================
# IMPORTAÇÕES DO FASTAPI
# ============================================================================
# FastAPI: Classe principal do framework
# Request: Representa requisições HTTP (usado em exception handlers)
# JSONResponse: Resposta HTTP em formato JSON
# RequestValidationError: Exceção lançada quando validação Pydantic falha
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# ============================================================================
# IMPORTAÇÕES DO BANCO DE DADOS (app/database/)
# ============================================================================
# engine: Motor de conexão com PostgreSQL (pool de conexões)
#         Importado de: app/database/connection.py
#         Usado para: Criar tabelas no banco via SQLAlchemy
#
# models: Módulo com todos os modelos ORM (User, Workout, Exercise)
#         Importado de: app/database/models.py
#         Usado para: Acessar Base.metadata.create_all() para criar tabelas
from app.database.connection import engine
from app.database import models

# ============================================================================
# IMPORTAÇÕES DOS ROTEADORES (app/routers/)
# ============================================================================
# users: Roteador com rotas de gerenciamento de usuários
#        Importado de: app/routers/users.py
#        Rotas fornecidas: POST /users (cadastro de novo usuário)
#        Futuras rotas: GET /users/me, PUT /users/me, DELETE /users/me
#
# auth: Roteador com rotas de autenticação
#       Importado de: app/routers/auth.py
#       Rotas fornecidas: POST /auth/login (login tradicional)
#       Futuras rotas: POST /auth/google, POST /auth/refresh
#
# IMPORTANTE: Cada roteador é um APIRouter() com prefix e tags próprios.
# Ao incluir aqui com app.include_router(), todas as rotas são registradas.
from app.routers import users, auth

# ============================================================================
# INSTANCIAÇÃO DO FASTAPI
# ============================================================================
# Cria a aplicação FastAPI que será servida pelo Uvicorn.
#
# PARÂMETROS:
# - title: Nome da API (aparece na documentação Swagger)
# - description: Descrição da API (aparece na documentação Swagger)
# - version: Versão da API (útil para versionamento de endpoints)
#
# DOCUMENTAÇÃO AUTOMÁTICA:
# FastAPI gera automaticamente:
# - Swagger UI: http://localhost:8000/docs
# - ReDoc: http://localhost:8000/redoc
# - OpenAPI JSON: http://localhost:8000/openapi.json
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
# COMO FUNCIONA:
# 1. Base.metadata contém informações de todas as classes que herdam de Base
# 2. create_all(bind=engine) gera comandos CREATE TABLE para cada modelo
# 3. Se tabela já existe, não faz nada (não sobrescreve dados)
# 4. Executa via engine (conexão com PostgreSQL)
#
# MODELOS CRIADOS:
# - users: Tabela de usuários (id, nome, email, senha_hash, weight, height, etc)
# - Futuros: workouts, exercises, workout_exercises (relacionamentos)
#
# IMPORTANTE:
# - Isso roda APENAS na inicialização da aplicação (quando Uvicorn inicia)
# - Se tabelas já existem, não faz nada (não sobrescreve)
# - Em produção, usar migrations (Alembic) em vez disso para controle de versão
#
# ALTERNATIVA PARA PRODUÇÃO:
# Em vez de create_all(), usar Alembic para migrations versionadas:
# $ alembic init alembic
# $ alembic revision --autogenerate -m "Create users table"
# $ alembic upgrade head
models.Base.metadata.create_all(bind=engine)

# ============================================================================
# INCLUSÃO DOS ROTEADORES MODULARES
# ============================================================================
# app.include_router() registra todos os endpoints de cada roteador.
#
# ROTEADORES INCLUÍDOS:
# ---------------------
# 1. users.router (de app/routers/users.py)
#    - Prefix: /users
#    - Tags: ["users"]
#    - Rotas: POST /users (cadastro)
#
# 2. auth.router (de app/routers/auth.py)
#    - Prefix: /auth
#    - Tags: ["auth"]
#    - Rotas: POST /auth/login (login tradicional)
#
# VANTAGENS DA MODULARIZAÇÃO:
# ---------------------------
# - Código organizado por responsabilidade (auth separado de users)
# - Fácil manutenção (cada roteador em seu arquivo)
# - Documentação Swagger agrupada por tags
# - Testabilidade (pode testar roteadores isoladamente)
# - Escalabilidade (fácil adicionar novos roteadores: workouts, exercises)
#
# COMO ADICIONAR NOVO ROTEADOR:
# 1. Criar arquivo: app/routers/workouts.py
# 2. Definir: router = APIRouter(prefix="/workouts", tags=["workouts"])
# 3. Adicionar rotas: @router.get("/"), @router.post("/"), etc
# 4. Importar aqui: from app.routers import workouts
# 5. Incluir aqui: app.include_router(workouts.router)
app.include_router(users.router)  # Registra rotas de /users
app.include_router(auth.router)   # Registra rotas de /auth

# ============================================================================
# HANDLER DE EXCEÇÕES DE VALIDAÇÃO
# ============================================================================
# Customiza a resposta de erros de validação do Pydantic (422).
# Retorna mensagens de erro mais amigáveis em português.
#
# QUANDO É ACIONADO:
# - Quando dados enviados pelo cliente não passam na validação Pydantic
# - Exemplos: email inválido, senha muito curta, campo obrigatório faltando
#
# RESPOSTA PADRÃO DO FASTAPI (sem este handler):
# {
#   "detail": [
#     {
#       "loc": ["body", "email"],
#       "msg": "value is not a valid email address",
#       "type": "value_error.email"
#     }
#   ]
# }
#
# RESPOSTA CUSTOMIZADA (com este handler):
# {
#   "detail": "Erro de validação",
#   "errors": [
#     {
#       "field": "email",
#       "message": "value is not a valid email address"
#     }
#   ]
# }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handler customizado para erros de validação do Pydantic.
    
    Transforma erros técnicos em mensagens amigáveis para o usuário.
    
    FUNCIONAMENTO:
    --------------
    1. FastAPI detecta erro de validação (RequestValidationError)
    2. Chama este handler em vez de retornar resposta padrão
    3. Extrai informações de cada erro (campo e mensagem)
    4. Formata em estrutura mais amigável
    5. Retorna JSONResponse com status 422
    
    ESTRUTURA DO ERRO:
    ------------------
    exc.errors() retorna lista de dicionários:
    [
      {
        "loc": ["body", "email"],  # Localização do erro (body > campo email)
        "msg": "value is not a valid email address",  # Mensagem de erro
        "type": "value_error.email"  # Tipo do erro
      }
    ]
    
    Args:
        request: Requisição HTTP que causou o erro
        exc: Exceção de validação lançada pelo Pydantic
    
    Returns:
        JSONResponse com status 422 e lista de erros formatados
    """
    errors = []
    # Itera sobre cada erro de validação
    for error in exc.errors():
        # Extrai o nome do campo que falhou na validação
        # error['loc'] é uma tupla como ("body", "email")
        # Pegamos o último elemento (nome do campo)
        field = error['loc'][-1] if error['loc'] else 'unknown'
        
        # Extrai a mensagem de erro
        message = error['msg']
        
        # Adiciona à lista de erros formatados
        errors.append({
            "field": field,
            "message": message
        })
    
    # Retorna resposta JSON customizada
    return JSONResponse(
        status_code=422,  # Unprocessable Entity (padrão para erros de validação)
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
#
# CASOS DE USO:
# - Monitoramento: Scripts que verificam se API está online
# - Load Balancers: AWS ELB, Nginx verificam esta rota para health check
# - CI/CD: Pipelines verificam se deploy foi bem-sucedido
# - Desenvolvimento: Teste rápido se servidor está rodando
#
# TESTE:
# $ curl http://localhost:8000/
# {"status":"ok","message":"GymNight API está rodando","version":"2.0.0"}
@app.get("/")
def read_root():
    """
    Health check da API.
    
    Retorna status da API e versão atual.
    
    Returns:
        dict: {
            "status": "ok",
            "message": "GymNight API está rodando",
            "version": "2.0.0"
        }
    """
    return {
        "status": "ok",
        "message": "GymNight API está rodando",
        "version": "2.0.0"
    }

# ============================================================================
# COMO EXECUTAR ESTE ARQUIVO
# ============================================================================
# No terminal, na raiz do projeto, execute:
#
# $ uvicorn main:app --reload
#
# EXPLICAÇÃO DO COMANDO:
# - uvicorn: Servidor ASGI para rodar FastAPI
# - main: Nome deste arquivo (main.py)
# - app: Nome da variável FastAPI instanciada acima
# - --reload: Reinicia servidor automaticamente ao salvar arquivos (dev only)
#
# SERVIDOR RODANDO EM:
# - API: http://localhost:8000
# - Swagger UI: http://localhost:8000/docs
# - ReDoc: http://localhost:8000/redoc
#
# PARA PRODUÇÃO:
# $ uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
# ============================================================================
