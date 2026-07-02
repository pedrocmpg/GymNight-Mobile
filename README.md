# GymNight — Backend API

Backend FastAPI do app mobile GymNight. Serve como servidor de sincronização offline-first para o cliente React Native via protocolo [WatermelonDB Sync](https://watermelondb.dev/docs/Sync/Backend).

**Stack:** Python 3.12 · FastAPI · SQLAlchemy · PostgreSQL (Supabase) · Alembic

---

## Visão geral

O app mobile funciona 100% offline usando WatermelonDB. Este backend implementa os endpoints de sincronização bidirecional (`pull` e `push`) e a API de perfil de usuário. A autenticação é delegada ao Supabase Auth — o backend apenas valida o JWT emitido pelo Supabase.

### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/` | — | Health check simples |
| `GET` | `/health` | — | Health check com verificação do banco |
| `POST` | `/users` | JWT | Cria perfil do usuário autenticado |
| `GET` | `/users/me` | JWT | Retorna perfil do usuário autenticado |
| `PATCH` | `/users/me` | JWT | Atualiza parcialmente o perfil |
| `DELETE` | `/users/me` | JWT | Remove conta e todos os dados associados |
| `GET` | `/api/v1/sync/pull` | JWT | Pull incremental das 6 tabelas desde `last_pulled_at` |
| `POST` | `/api/v1/sync/push` | JWT | Push das mudanças do cliente com validação multi-tenant |
| `POST` | `/admin/cleanup-tombstones` | Admin secret | Remove tombstones expirados |

Documentação interativa disponível em `/docs` (Swagger) e `/redoc` quando o servidor está rodando.

---

## Pré-requisitos

- Python 3.12+
- PostgreSQL (ou projeto Supabase configurado)

---

## Configuração

**1. Clone e instale as dependências**

```bash
git clone https://github.com/pedrocmpg/GymNight-Mobile.git
cd GymNight-Mobile/backend
pip install -r requirements.txt
```

**Para produção (otimizado, sem dependências de teste):**
```bash
pip install -r requirements-prod.txt
```

**2. Configure as variáveis de ambiente**

Copie o arquivo de exemplo e preencha com seus valores reais:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais — veja a seção [Variáveis de ambiente](#variáveis-de-ambiente) abaixo. **Nunca commite o arquivo `.env`.**

**3. Execute as migrations**

As migrations criam todas as tabelas e triggers necessários. Devem ser rodadas antes de subir o servidor — o backend **não cria tabelas automaticamente** na inicialização.

```bash
alembic upgrade head
```

**4. Suba o servidor**

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

O servidor estará disponível em `http://localhost:8000`.

---

## Dependências

O projeto tem dois arquivos de requirements:

| Arquivo | Quando usar | Tamanho |
|---|---|---|
| `requirements.txt` | Desenvolvimento local, testes, CI | Maior (inclui Hypothesis, pytest) |
| `requirements-prod.txt` | Docker, deploy em produção | Menor (apenas runtime) |

Todas as versões estão fixas (pinned) para reprodutibilidade.

---

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | URL do projeto Supabase (ex: `https://xyz.supabase.co`) |
| `SUPABASE_JWT_SECRET` | ✅ | — | JWT Secret do Supabase (Dashboard → Settings → API) |
| `DATABASE_URL` | ✅ | — | String de conexão PostgreSQL (use PgBouncer porta 6543 em produção) |
| `ADMIN_SECRET` | ✅ | `changeme` | Token para autenticar requisições ao endpoint `/admin/*` |
| `RATE_LIMIT_ENABLED` | — | `true` | Define `"false"` para desabilitar rate limiting nos endpoints de sync |
| `TOMBSTONE_RETENTION_DAYS` | — | `90` | Dias para retenção de tombstones antes da limpeza (1–3650) |
| `LOG_LEVEL` | — | `INFO` | Nível de log (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `TEST_DATABASE_URL` | — | — | PostgreSQL para testes de integração (obrigatório apenas para `tests/integration/`) |

> **Importante:** Troque `ADMIN_SECRET` por um valor seguro antes de subir em produção. O padrão `changeme` não é seguro.

---

### Testes

### Smoke tests e property-based tests (sem banco real)

```bash
cd backend
pytest tests/ --ignore=tests/integration -v
```

Os testes usam SQLite in-memory e mocks — nenhuma conexão com PostgreSQL é necessária.

### Testes de integração (requerem PostgreSQL)

Configure `TEST_DATABASE_URL` no `.env` apontando para um banco de teste, então:

```bash
cd backend
pytest tests/integration/ -v
```

Os testes de integração rodam `alembic upgrade head` automaticamente antes de executar e fazem rollback após cada teste, garantindo isolamento.

---

## Deploy

### Docker

```bash
docker build -t gymnight-backend .
docker run -p 8000:8000 --env-file .env gymnight-backend
```

O `Dockerfile` inclui um `HEALTHCHECK` que chama `GET /health` a cada 30 segundos.

### Render / Railway

O arquivo `render.yaml` já está configurado com o build command, start command e variáveis de ambiente necessárias. Basta conectar o repositório e preencher os valores das env vars no painel.

> **Lembre-se:** rode `alembic upgrade head` uma vez após o primeiro deploy para criar as tabelas no banco de produção. No Render, isso pode ser feito via "Shell" no painel, ou configurando um pre-deploy command.

---

## Segurança

- **Autenticação:** JWT HS256 emitido pelo Supabase Auth, validado stateless no backend
- **Multi-tenant:** Pull e push filtram e validam ownership por `user_id == sub` do JWT
- **Rate limiting:** 60 requisições/minuto por usuário nos endpoints de sync (controlado por `RATE_LIMIT_ENABLED`)
- **Correlation ID:** Cada requisição recebe um UUID v4 em `X-Correlation-ID` para rastreamento em logs

### ⚠️ Ação necessária se você clonou este repositório

Se o arquivo `.env` com credenciais reais foi commitado em algum momento, você precisa:

1. Rotar o `SUPABASE_JWT_SECRET` e o `DATABASE_URL` password no painel do Supabase
2. Remover o `.env` do histórico git:
   ```bash
   git rm --cached .env
   git commit -m "chore: remove .env from git tracking"
   ```

---

## Estrutura do projeto

```
backend/
├── main.py                     # Entry point — registro de routers e middlewares
├── app/
│   ├── core/
│   │   ├── config.py           # Settings via pydantic-settings (.env)
│   │   ├── security.py         # Validação JWT Supabase (get_current_user)
│   │   ├── limiter.py          # SlowAPI rate limiter
│   │   └── logging.py          # Structured logging com structlog (JSON)
│   ├── database/
│   │   ├── connection.py       # SQLAlchemy engine e SessionLocal
│   │   ├── models/             # ORM models (User, Exercise, Workout, etc.)
│   │   └── migrations/         # Scripts legados (referência histórica)
│   ├── routers/
│   │   ├── users.py            # POST/GET/PATCH/DELETE /users/me
│   │   ├── health.py           # GET /health
│   │   └── admin.py            # POST /admin/cleanup-tombstones
│   ├── api/v1/endpoints/
│   │   └── sync.py             # GET /api/v1/sync/pull, POST /api/v1/sync/push
│   ├── middleware/
│   │   ├── correlation_id.py   # X-Correlation-ID header
│   │   └── access_log.py       # Log estruturado por requisição
│   └── schemas/
│       └── user.py             # Schemas Pydantic para perfil de usuário
├── alembic/                    # Migrations Alembic (001→006)
├── tests/
│   ├── smoke/                  # Testes de estrutura (sem I/O externo)
│   ├── integration/            # Testes contra PostgreSQL real
│   └── test_*.py               # Property-based tests com Hypothesis
├── .env                        # Variáveis de ambiente (não commitar!)
├── .env.example                # Template das variáveis de ambiente
├── requirements.txt            # Dependências com dev tools
├── requirements-prod.txt       # Dependências apenas de produção
└── alembic.ini                 # Configuração do Alembic
```

---

## Banco de dados

7 tabelas com arquitetura offline-first (UUIDs gerados pelo cliente):

| Tabela | Descrição |
|---|---|
| `users` | Perfil do usuário (id = UUID do Supabase Auth) |
| `exercises` | Catálogo compartilhado de exercícios |
| `workouts` | Templates de treino (planos) |
| `workout_exercises` | Exercícios dentro de um template |
| `workout_sessions` | Sessões de treino executadas |
| `logged_sets` | Sets registrados com cálculo automático de 1RM (fórmula Epley) |
| `deleted_records` | Tombstones para sincronização de deleções |

Todas as tabelas têm `created_at` e `updated_at` em Unix milliseconds (BigInteger), compatível com o protocolo WatermelonDB.
