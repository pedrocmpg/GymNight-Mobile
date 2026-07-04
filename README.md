# GymNight — App Mobile Offline-First (Backend + Frontend)

Monorepo do GymNight: app mobile de treinos offline-first. Contém o backend FastAPI (sincronização + perfil de usuário) e o app React Native/Expo que roda 100% offline via WatermelonDB, sincronizando com o backend pelo protocolo [WatermelonDB Sync](https://watermelondb.dev/docs/Sync/Backend).

**Stack Backend:** Python 3.12 · FastAPI · SQLAlchemy · PostgreSQL (Supabase) · Alembic
**Stack Frontend:** TypeScript · React Native (Expo SDK 52) · WatermelonDB · Supabase Auth · Zustand

---

## Status atual do projeto

### Backend — completo
Três specs fechadas e implementadas (`.kiro/specs/`):
- **`supabase-migration`** — autenticação migrada de JWT próprio para validação stateless do Supabase Auth (`get_current_user` decodifica o JWT do Supabase; não há mais login/senha no backend).
- **`watermelondb-sync-router`** — router de sync v1 em `app/api/v1/endpoints/sync.py` (`GET /api/v1/sync/pull`, `POST /api/v1/sync/push`), com separação correta `created`/`updated`, ownership scan multi-tenant e idempotência.
- **`backend-fixes-and-improvements`** — perfil de usuário completo (`POST/GET/PATCH/DELETE /users/me`), `GET /health`, rate limiting (SlowAPI), logging estruturado com correlation ID, cleanup de tombstones, CI com Postgres real (`.github/workflows/integration.yml`).

O router legado em `app/routers/sync.py` (`/sync/*`) ainda está registrado por compatibilidade, mas o cliente deve usar `/api/v1/sync/*`.

### Frontend (app mobile) — arquitetura e telas implementadas, ainda não conectadas
A spec **`frontend-mobile-implementation`** está com as 20 tasks (e testes de propriedade opcionais) marcadas como concluídas em `.kiro/specs/frontend-mobile-implementation/tasks.md`. O que já existe em `gymnight/frontend/src/`:

- `designSystem/` — tokens de cor/tipografia/espaçamento (dark mode only)
- `db/` — schema WatermelonDB (6 tabelas), models e camada de escrita local
- `hooks/` — `useReactiveQuery` e hooks derivados (`useObserveDashboard`, `useObserveExerciseCatalog`, `useObserveActiveSession`) + utilitários de domínio (Epley formula, volume)
- `sync/` — `SyncEngine`, push/pull adapters, resolução de conflitos, `SyncStatusIndicator`
- `auth/` — `AuthManager`, `SecureStorage`, `AuthInterceptor`, refresh de token e `LogoutManager`
- `screens/` — `AuthScreen`, `DashboardScreen`, `WorkoutCreatorScreen`, `ActiveSessionScreen`, cada uma com lógica de validação/persistência própria e testes

**Pendente antes de considerar o app usável de fato:**
- `App.tsx` ainda é um placeholder (`"GymNight Mobile"` estático) — as telas não estão conectadas a nenhuma navegação
- Nenhuma lib de navegação (`react-navigation` ou similar) foi adicionada ao `package.json`
- Não há integração real testada em device/emulador, apenas testes unitários e de propriedade (Jest + fast-check)

### Spec parada
- **`offline-first-database-rebuild`** (bugfix) — tem apenas o arquivo de config, sem `requirements.md`/`design.md`/`tasks.md`. Não foi iniciada.

### Débito técnico conhecido
- **Bug de schema em `POST /users` (crítico):** a coluna `users.email` continua `NOT NULL UNIQUE` no banco (criada na migration `001_initial_schema.py` e nunca removida por nenhuma migration posterior). Porém o model `User` (`app/database/models/user.py`) não declara mais o campo `email` desde a migração para Supabase Auth, e `POST /users` (`app/routers/users.py`) nunca o preenche. Contra um Postgres real isso quebra com `IntegrityError: null value in column "email" violates not-null constraint`. Os testes de propriedade não pegam isso porque usam DB mockado (`MagicMock`); o teste de integração `test_post_users_creates_profile` também não passaria hoje contra Postgres real pelo mesmo motivo (os outros testes de integração contornam o problema inserindo `email` manualmente via ORM). É necessário criar uma migration `007` removendo a coluna `email` (ou `user_id/gender` etc. cascateando) para alinhar schema e ORM.
- `app/database/models_old.py.bak` é um backup morto (arquivo antigo pré-refatoração) que ainda vive dentro de `app/database/`; pode ser removido com segurança.
- O `Dockerfile` foi removido do repositório (commit `380fe2d`) mas as tasks do backend ainda o referenciam como concluído — não existe imagem Docker pronta hoje, e o smoke test `tests/smoke/test_dockerfile.py` deve estar falhando por causa disso.
- `render.yaml` referencia `backend/requirements.txt` e `backend.main:app`, caminhos anteriores à reorganização em `gymnight/backend/`. Precisa ser atualizado antes de um deploy real no Render.
- Há dois `main.py` no backend: `gymnight/backend/main.py` (entry point local, comentários desatualizados que ainda mencionam `auth.py`/`create_all`) e `gymnight/backend/app/main.py` (app FastAPI real, com todos os routers/middlewares). O primeiro só importa `users.router` — os demais routers (`health`, `admin`, `sync` v1) só existem em `app/main.py`. Rodar `uvicorn main:app` (raiz) portanto **não** expõe `/health`, `/admin/*` nem `/api/v1/sync/*` — é preciso rodar `uvicorn app.main:app`.

---

## Endpoints (backend)

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

Documentação interativa em `/docs` (Swagger) e `/redoc` quando o servidor está rodando.

---

## Pré-requisitos

- Python 3.12+
- Node.js 18+ e npm (para o app mobile)
- PostgreSQL (ou projeto Supabase configurado)
- Expo CLI (`npx expo`, já incluso via `npx`) e um device/emulador para rodar o app

---

## Configuração — Backend

**1. Clone e instale as dependências**

```bash
git clone https://github.com/pedrocmpg/GymNight-Mobile.git
cd GymNight-Mobile/gymnight/backend
pip install -r requirements.txt
```

**2. Configure as variáveis de ambiente**

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais — veja [Variáveis de ambiente](#variáveis-de-ambiente). **Nunca commite o arquivo `.env`.**

**3. Execute as migrations**

```bash
alembic upgrade head
```

O backend **não cria tabelas automaticamente** na inicialização — as migrations devem rodar antes de subir o servidor.

**4. Suba o servidor**

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

O servidor estará disponível em `http://localhost:8000`.

> ⚠️ Existe também um `main.py` na raiz de `gymnight/backend/` (fora de `app/`). Ele é um entry point antigo que só registra o router de `users` (sem `health`, `admin` ou `/api/v1/sync/*`) e ainda chama `Base.metadata.create_all()`. Use sempre `app.main:app`, não `main:app`.

---

## Configuração — Frontend (app mobile)

```bash
cd gymnight/frontend
npm install
npm start
```

Isso abre o Expo Dev Tools; escaneie o QR code com o app Expo Go ou rode em um emulador (`npm run android` / `npm run ios`).

> O `App.tsx` atual ainda não renderiza nenhuma tela do app (Auth/Dashboard/etc) — isso é o próximo passo pendente de integração.

Rodar os testes do frontend:

```bash
cd gymnight/frontend
npm test
```

---

## Variáveis de ambiente (backend)

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

## Testes — Backend

### Smoke tests e property-based tests (sem banco real)

```bash
cd gymnight/backend
pytest tests/ --ignore=tests/integration -v
```

Os testes usam SQLite in-memory e mocks — nenhuma conexão com PostgreSQL é necessária.

> **Verificado nesta sessão:** rodando a suíte completa (67 testes, ignorando `integration/`), o resultado é **2 falhas / 67 passam** — as duas falhas são `tests/smoke/test_dockerfile.py` (`test_dockerfile_exists` e `test_dockerfile_has_healthcheck_instruction`), consistente com o `Dockerfile` ausente descrito no débito técnico abaixo. Todo o resto passa, incluindo os testes de propriedade que usam DB mockado — o que também explica por que o bug de `email` NOT NULL (ver débito técnico) nunca é pego por essa suíte.

### Testes de integração (requerem PostgreSQL)

Configure `TEST_DATABASE_URL` no `.env` apontando para um banco de teste, então:

```bash
cd gymnight/backend
pytest tests/integration/ -v
```

Os testes de integração rodam `alembic upgrade head` automaticamente antes de executar e fazem rollback após cada teste.

---

## Deploy (backend)

Não há `Dockerfile` no repositório atualmente (removido no histórico git). O `render.yaml` na raiz descreve um deploy via build/start command direto (sem Docker), mas os caminhos (`backend/...`) precisam ser atualizados para `gymnight/backend/...` antes de usar, já que o projeto foi reorganizado.

> **Lembre-se:** rode `alembic upgrade head` uma vez após o primeiro deploy para criar as tabelas no banco de produção.

---

## Segurança

- **Autenticação:** JWT HS256 emitido pelo Supabase Auth, validado stateless no backend
- **Multi-tenant:** Pull e push filtram e validam ownership por `user_id == sub` do JWT
- **Rate limiting:** 60 requisições/minuto por usuário nos endpoints de sync (controlado por `RATE_LIMIT_ENABLED`)
- **Correlation ID:** Cada requisição recebe um UUID v4 em `X-Correlation-ID` para rastreamento em logs
- **App mobile:** sessão persistida via `expo-secure-store`; logout limpa Secure Storage e as 6 tabelas locais do WatermelonDB

### ⚠️ Ação necessária se você clonou este repositório

Se o arquivo `.env` com credenciais reais foi commitado em algum momento, você precisa:

1. Rotar o `SUPABASE_JWT_SECRET` e o `DATABASE_URL` password no painel do Supabase
2. Remover o `.env` do histórico git:
   ```bash
   git rm --cached gymnight/backend/.env
   git commit -m "chore: remove .env from git tracking"
   ```

---

## Estrutura do projeto

```
GymNight-Mobile/
├── gymnight/
│   ├── backend/
│   │   ├── main.py                    # entry point antigo/incompleto (evitar — ver débito técnico)
│   │   ├── app/
│   │   │   ├── main.py                # app FastAPI real: routers, middlewares, limiter (uvicorn app.main:app)
│   │   │   ├── core/                  # config (pydantic-settings), security (JWT Supabase), limiter, logging
│   │   │   ├── database/
│   │   │   │   ├── connection.py      # engine, SessionLocal, get_db, Base
│   │   │   │   ├── models/            # User, Exercise, Workout, WorkoutExercise,
│   │   │   │   │                      # WorkoutSession, LoggedSet, DeletedRecord + triggers + event_listeners
│   │   │   │   ├── models_old.py.bak  # backup morto — pode ser removido
│   │   │   │   └── migrations/        # scripts legados (referência histórica, não usados pelo Alembic)
│   │   │   ├── routers/               # users, health, admin, sync (legado /sync/*)
│   │   │   ├── api/v1/endpoints/      # sync.py — router canônico /api/v1/sync/*
│   │   │   ├── middleware/            # correlation_id, access_log
│   │   │   └── schemas/               # user.py (UserProfileCreate/Update/Response)
│   │   ├── alembic/versions/          # migrations 001→006 (linear, sem branches)
│   │   └── tests/
│   │       ├── smoke/                 # estrutura, ausência de padrões legados, Dockerfile, etc.
│   │       ├── integration/           # contra PostgreSQL real (requer TEST_DATABASE_URL)
│   │       └── test_*_properties.py   # property-based (Hypothesis) por feature
│   └── frontend/                      # App mobile Expo/React Native (TypeScript)
│       ├── App.tsx                    # placeholder — telas ainda não conectadas
│       ├── app.json                   # Expo config (dark mode, bundle ids com.gymnight.mobile)
│       └── src/
│           ├── designSystem/          # tokens (dark mode only)
│           ├── db/                    # schema.ts + models/ WatermelonDB + writeHelpers
│           ├── hooks/                 # useReactiveQuery e derivados + domainUtils (Epley, volume)
│           ├── sync/                  # SyncEngine, syncAdapters, pullRequest/pullApply, conflictResolution
│           ├── auth/                  # AuthManager, SecureStorage, AuthInterceptor, TokenRefreshCoordinator, LogoutManager
│           ├── screens/               # AuthScreen, DashboardScreen, WorkoutCreatorScreen, ActiveSessionScreen
│           └── test/                  # setup Jest + fast-check, mocks
├── .kiro/specs/                       # specs (requirements/design/tasks) por feature
├── docs/                              # documentação geral (STRUCTURE.md desatualizado)
└── render.yaml                        # deploy config (caminhos desatualizados)
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
| `deleted_records` | Tombstones para sincronização de deleções (com `user_id` nullable para filtragem multi-tenant) |

Todas as tabelas têm `created_at` e `updated_at` em Unix milliseconds (BigInteger), compatível com o protocolo WatermelonDB. Deleções são propagadas via triggers PostgreSQL (`create_tombstone_on_delete`, aplicados pela migration `005`), que inserem tombstones automaticamente em `deleted_records` a cada `DELETE` nas tabelas sincronizáveis.

> ⚠️ `users.email` ainda existe no banco como `NOT NULL UNIQUE` (migration `001`) mas não é mais gravada por nenhum código da aplicação — ver débito técnico acima.

---

## Próximos passos sugeridos

1. **Corrigir o bug de `users.email` NOT NULL** — criar migration `007` removendo a coluna (ou populá-la de outra forma) para que `POST /users` funcione contra PostgreSQL real
2. Conectar as telas (`Auth`, `Dashboard`, `WorkoutCreator`, `ActiveSession`) no `App.tsx` via uma navegação real (ex: `@react-navigation/native`)
3. Atualizar `render.yaml` para os caminhos `gymnight/backend/...` e para `uvicorn app.main:app` (não `backend.main:app`)
4. Recriar o `Dockerfile` do backend (os 2 testes de smoke que falham hoje dependem dele)
5. Remover `app/database/models_old.py.bak` (arquivo morto)
6. Iniciar a spec `offline-first-database-rebuild` (ainda sem requirements/design/tasks) ou removê-la se não for mais relevante
