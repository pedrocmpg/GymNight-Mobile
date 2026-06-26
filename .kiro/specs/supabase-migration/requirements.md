# Requirements Document

## Introduction

Este documento define os requisitos para a migração da infraestrutura de backend do GymNight Mobile de um sistema de autenticação manual (bcrypt + JWT próprio) para o Supabase como BaaS (Backend as a Service), utilizando o Supabase Auth para gerenciamento de identidade e o Supabase Postgres como banco de dados gerenciado.

O FastAPI permanece como camada de serviço responsável pela lógica pesada de Pull/Push do protocolo de sincronização WatermelonDB. O objetivo é remover o código de autenticação manual (passlib, bcrypt, geração de JWT) e substituí-lo pela validação do token JWT emitido pelo Supabase, enquanto os modelos SQLAlchemy offline-first, as lógicas de `_status`/`_changed` e as triggers de `deleted_records` são mantidos intactos.

## Glossary

- **Supabase**: Plataforma BaaS (Backend as a Service) que fornece Postgres gerenciado, Auth, Storage e APIs em tempo real.
- **Supabase_Auth**: Serviço de autenticação do Supabase. Gerencia registro, login e emissão de tokens JWT. O frontend interage diretamente com ele via SDK.
- **Supabase_JWT**: Token JWT emitido e assinado pelo Supabase_Auth usando a chave secreta do projeto (`SUPABASE_JWT_SECRET`). Um token válido é um string não-vazio que decodifica sem erros usando `SUPABASE_JWT_SECRET` com algoritmo `HS256`, possui o campo `sub` com um UUID v4 não-vazio, e cujo campo `exp` é um timestamp Unix no futuro.
- **FastAPI_Backend**: Serviço FastAPI que atua como camada de serviço, responsável pela lógica de sincronização WatermelonDB (pull/push) e rotas protegidas.
- **JWT_Validator**: Componente do FastAPI_Backend (módulo `security.py`) responsável exclusivamente por decodificar e validar o Supabase_JWT recebido nas requisições.
- **Pydantic_Settings**: Módulo `config.py` que centraliza as variáveis de configuração da aplicação usando Pydantic BaseSettings.
- **WatermelonDB_Sync**: Protocolo de sincronização offline-first entre o app mobile e o FastAPI_Backend, envolvendo operações de pull e push de dados.
- **SQLAlchemy_Models**: Modelos ORM Python que mapeiam as tabelas do banco de dados Postgres, incluindo as colunas `_status`, `_changed`, timestamps em BigInteger e a tabela `deleted_records`.
- **Connection_Pooling_URL**: URL de conexão do Supabase que utiliza PgBouncer para pooling de conexões, compatível com ambientes IPv4 e serverless (porta 6543).
- **UserCreate_Schema**: Schema Pydantic anteriormente usado para cadastro de usuário com senha em texto plano. Deve ser removido pois o cadastro agora ocorre no frontend via SDK do Supabase.

## Requirements

### Requirement 1: Remoção da Autenticação Manual

**User Story:** Como desenvolvedor do GymNight, quero remover todo o código de autenticação manual do FastAPI_Backend, para que o sistema não dependa mais de hashing de senhas ou geração de tokens JWT próprios.

#### Acceptance Criteria

1. THE FastAPI_Backend SHALL NOT contain any import or usage of `bcrypt`, `passlib`, or `python-jose` libraries in any Python source file under the `app/` directory.
2. THE FastAPI_Backend SHALL NOT declare `bcrypt`, `passlib`, or `python-jose` as dependencies in `requirements.txt` or `pyproject.toml`.
3. THE FastAPI_Backend SHALL NOT contain the `hash_password` function in `security.py`.
4. THE FastAPI_Backend SHALL NOT contain the `verify_password` function in `security.py`.
5. THE FastAPI_Backend SHALL NOT contain the `create_access_token` function in `security.py`.
6. THE FastAPI_Backend SHALL NOT contain any route that performs login via email and password with local password verification.
7. THE FastAPI_Backend SHALL NOT contain the `UserCreate_Schema` class with a `password` field in `app/schemas/user.py`.

---

### Requirement 2: Validação do Token JWT do Supabase

**User Story:** Como desenvolvedor do GymNight, quero que o FastAPI_Backend valide os tokens JWT emitidos pelo Supabase_Auth, para que apenas usuários autenticados pelo Supabase possam acessar as rotas protegidas.

#### Acceptance Criteria

1. THE JWT_Validator SHALL decode a Supabase_JWT using the `SUPABASE_JWT_SECRET` environment variable as the signing key.
2. THE JWT_Validator SHALL use the `HS256` algorithm to verify the token signature.
3. WHEN a valid Supabase_JWT is provided in the `Authorization: Bearer <token>` header, THE JWT_Validator SHALL extract the `sub` claim as a non-empty string (UUID v4 format) and return it to the calling route as the authenticated user identifier.
4. IF the Supabase_JWT is expired (i.e., `exp` claim is in the past), THEN THE JWT_Validator SHALL raise an HTTP 401 Unauthorized exception with the detail `"Token expirado"`.
5. IF the Supabase_JWT has an invalid signature, THEN THE JWT_Validator SHALL raise an HTTP 401 Unauthorized exception with the detail `"Token inválido"`.
6. IF the `Authorization` header is absent, or present but does not match the pattern `Bearer <non-empty-string>`, THEN THE JWT_Validator SHALL raise an HTTP 401 Unauthorized exception with the detail `"Token não fornecido"`.
7. IF the `SUPABASE_JWT_SECRET` environment variable is not set or is empty at application startup, THEN the application SHALL raise a `ValidationError` and refuse to start.
8. THE JWT_Validator SHALL be implemented as a FastAPI dependency injectable via `Depends(get_current_user)` in protected routes.
9. THE JWT_Validator SHALL NOT generate, sign, or issue any JWT token.

---

### Requirement 3: Atualização da Configuração (Pydantic Settings)

**User Story:** Como desenvolvedor do GymNight, quero que o `config.py` utilize Pydantic Settings para centralizar as variáveis de ambiente necessárias para integração com o Supabase, para que a configuração seja validada na inicialização da aplicação.

#### Acceptance Criteria

1. IF `SUPABASE_URL` is absent from the environment, THEN instantiating the Settings class SHALL raise a `pydantic.ValidationError`.
2. IF `SUPABASE_JWT_SECRET` is absent from the environment, THEN instantiating the Settings class SHALL raise a `pydantic.ValidationError`.
3. IF `DATABASE_URL` is absent from the environment, THEN instantiating the Settings class SHALL raise a `pydantic.ValidationError`.
4. THE Pydantic_Settings SHALL NOT define `SECRET_KEY`, `ALGORITHM`, or `ACCESS_TOKEN_EXPIRE_MINUTES` as fields without a default value (they must either be absent or carry a default so that omitting them from the environment does not raise a `ValidationError`).
5. WHEN `config.py` is imported and the three required environment variables are present and non-empty, THE Settings class SHALL load its values exclusively via `pydantic-settings` `BaseSettings` without any call to `python-dotenv`'s `load_dotenv()` or `os.getenv()`.
6. THE `DATABASE_URL` field declaration in `config.py` SHALL include an inline comment containing the text `6543` and a note stating that the Connection Pooling URL (PgBouncer) must be used for IPv4-compatible production environments.

---

### Requirement 4: Atualização do Arquivo de Variáveis de Ambiente

**User Story:** Como desenvolvedor do GymNight, quero que o arquivo `.env` reflita as novas variáveis exigidas pela integração com o Supabase, para que o ambiente de desenvolvimento esteja alinhado com a nova configuração.

#### Acceptance Criteria

1. THE `.env` file SHALL contain a `SUPABASE_URL` entry whose value is a non-empty placeholder string (e.g., `your-supabase-project-url`) that does not contain `https://` followed by a real domain, signalling that the actual URL must be substituted.
2. THE `.env` file SHALL contain a `SUPABASE_JWT_SECRET` entry whose value is a non-empty placeholder string (e.g., `your-supabase-jwt-secret`) that is not a valid base64-encoded JWT secret of 32+ bytes, signalling that the actual secret must be substituted.
3. THE `.env` file SHALL contain a `DATABASE_URL` entry accompanied by an inline comment that explicitly includes the port `6543` and states that the Connection Pooling URL (PgBouncer) must be used for IPv4-compatible production environments.
4. THE `.env` file SHALL NOT contain entries for `SECRET_KEY`, `ALGORITHM`, or `ACCESS_TOKEN_EXPIRE_MINUTES`.

---

### Requirement 5: Proteção dos Modelos SQLAlchemy

**User Story:** Como desenvolvedor do GymNight, quero garantir que todos os modelos SQLAlchemy permaneçam intactos após a migração, para que a lógica de sincronização WatermelonDB não seja comprometida.

#### Acceptance Criteria

1. THE SQLAlchemy_Models SHALL retain all `_status` columns with type `String(10)`, nullable, on all syncable tables (`users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, `logged_sets`).
2. THE SQLAlchemy_Models SHALL retain all `_changed` columns with type `String(500)`, nullable, on all syncable tables (`users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, `logged_sets`).
3. THE SQLAlchemy_Models SHALL retain all timestamp columns (`created_at`, `updated_at`) with type `BigInteger` (Unix milliseconds) on all syncable tables, and the `deleted_at` column with type `BigInteger` on the tables that declare it (`users`, `workouts`, `workout_sessions`, `logged_sets`).
4. THE SQLAlchemy_Models SHALL retain the `deleted_records` table with columns `id` (String(36) primary key), `table_name` (String(50)), `record_id` (String(36)), `user_id` (String(36)), and `deleted_at` (BigInteger), including the indexes `ix_deleted_records_table_name`, `ix_deleted_records_record_id`, and `ix_deleted_records_user_id`.
5. THE SQLAlchemy_Models SHALL retain all PostgreSQL trigger definitions for the `create_tombstone_on_delete` PL/pgSQL function and the `AFTER DELETE` triggers named `trg_tombstone_<table>` for each of the syncable tables (`users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, `logged_sets`) in `app/database/models/sync.py`.
6. THE SQLAlchemy_Models SHALL retain `String(36)` UUID primary keys on all tables.
7. THE SQLAlchemy_Models SHALL NOT contain a `password_hash` column on the `users` table; the column must be dropped via an Alembic migration as part of this spec, since password management is delegated entirely to Supabase Auth.
8. THE `users` table `id` column SHALL serve as a direct mapping to the Supabase Auth UUID, meaning the value stored in `users.id` must equal the `sub` claim of the user's Supabase_JWT.

---

### Requirement 6: Atualização do Roteador de Usuários

**User Story:** Como desenvolvedor do GymNight, quero que o roteador de usuários (`users.py`) não dependa mais de `hash_password` ou do `UserCreate_Schema` com senha, para que o código reflita a nova responsabilidade do frontend de criar usuários via SDK do Supabase.

#### Acceptance Criteria

1. THE FastAPI_Backend SHALL NOT import `hash_password` from `app.core.security` in `app/routers/users.py`.
2. THE FastAPI_Backend SHALL NOT import any schema class that declares a `password` field in `app/routers/users.py`.
3. IF a request reaches the `POST /users` route without a valid Supabase_JWT in the `Authorization: Bearer` header, THEN THE FastAPI_Backend SHALL return HTTP 401 Unauthorized.
4. WHERE the user profile creation endpoint is retained, THE FastAPI_Backend SHALL accept a request body containing only the following fields: `name` (string, 1–100 characters), `weight` (float, 1.0–500.0 kg), `height` (float, 50.0–300.0 cm), `birth_date` (string in ISO 8601 `YYYY-MM-DD` format), and `gender` (string, one of `"male"`, `"female"`, `"other"`); all fields are optional to support partial profile updates.
5. IF a request body submitted to any user profile endpoint contains a `password` field, THEN THE FastAPI_Backend SHALL return HTTP 422 Unprocessable Entity.

---

### Requirement 7: Integridade do Roteador de Sincronização

**User Story:** Como desenvolvedor do GymNight, quero que qualquer rota de sincronização WatermelonDB existente ou futura utilize a validação do Supabase_JWT, para que apenas usuários autenticados realizem operações de pull e push.

#### Acceptance Criteria

1. THE FastAPI_Backend SHALL declare `Depends(get_current_user)` as a parameter on every WatermelonDB_Sync pull and push route handler function, such that the dependency is enforced at the framework level.
2. THE `get_current_user` dependency SHALL return the `sub` claim value — a non-empty UUID v4 string — to the route handler as the authenticated user identifier for multi-tenant data filtering.
3. IF a request to a WatermelonDB_Sync pull or push route does not include a valid Supabase_JWT, THEN THE FastAPI_Backend SHALL return HTTP 401 Unauthorized before executing any database operation.
4. IF a WatermelonDB_Sync push operation payload contains at least one record whose `user_id` field does not equal the `sub` claim of the validated Supabase_JWT, THEN THE FastAPI_Backend SHALL reject the entire push operation with HTTP 403 Forbidden without persisting any records from that request.
5. WHEN a WatermelonDB_Sync pull route returns records, THE FastAPI_Backend SHALL filter the result set to include only records whose `user_id` equals the `sub` claim of the validated Supabase_JWT.
