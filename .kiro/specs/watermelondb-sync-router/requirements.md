# Requirements Document

## Introduction

Este documento define os requisitos para a criação e migração do roteador de sincronização WatermelonDB no GymNight Mobile Backend. O objetivo é implementar `app/api/v1/endpoints/sync.py` migrando e corrigindo o código existente em `app/routers/sync.py`, integrando corretamente ao protocolo WatermelonDB (Pull/Push) com autenticação via Supabase JWT e segurança multi-tenant completa.

Os principais problemas corrigidos nesta migration são: (1) a separação correta entre registros `created` e `updated` no Pull, exigida pelo protocolo WatermelonDB; (2) a cobertura de segurança de propriedade para tabelas sem `user_id` direto (`workout_exercises` e `logged_sets`); e (3) a criação da nova estrutura de diretórios `app/api/v1/` com atualização do `app/main.py`.

## Glossary

- **Sync_Router**: Módulo FastAPI em `app/api/v1/endpoints/sync.py` responsável pelos endpoints de sincronização WatermelonDB.
- **Pull_Endpoint**: `GET /api/v1/sync/pull` — retorna ao cliente todos os registros modificados ou criados desde `last_pulled_at`, separando-os em `created` e `updated`, além dos tombstones de deleção.
- **Push_Endpoint**: `POST /api/v1/sync/push` — recebe do cliente criações, atualizações e deleções de registros, valida propriedade e persiste atomicamente.
- **WatermelonDB_Protocol**: Protocolo de sincronização offline-first. O Pull deve retornar `{ changes: { <table>: { created: [], updated: [], deleted: [] } }, timestamp: <unix_ms> }`. O Push recebe o mesmo formato e retorna `{ status: "ok" }` em caso de sucesso.
- **last_pulled_at**: Parâmetro de query inteiro (Unix milissegundos) enviado pelo cliente no Pull, indicando o timestamp do último Pull bem-sucedido. Valor `0` significa primeira sincronização.
- **current_server_timestamp**: Timestamp Unix em milissegundos capturado no início do processamento do Pull, usado como referência temporal para classificar `created` vs `updated` e retornado no campo `timestamp` da resposta.
- **Tombstone**: Registro na tabela `deleted_records` gerado automaticamente por trigger PostgreSQL quando um registro sincronizável é deletado fisicamente.
- **Ownership_Check**: Verificação de propriedade multi-tenant. Para tabelas com `user_id` direto, valida `user_id == current_user_id`. Para tabelas sem `user_id` direto (`workout_exercises`, `logged_sets`), valida via JOIN com a tabela pai que possui `user_id`.
- **Atomic_Transaction**: Todas as escritas do Push são persistidas em uma única transação SQLAlchemy; se qualquer operação falhar, toda a transação é revertida com rollback.
- **Physical_Delete**: Deleções no Push são implementadas como `DELETE` físico no banco de dados. Os triggers PostgreSQL existentes criam tombstones automaticamente ao detectar o `DELETE`.
- **Shared_Table**: Tabela sem conceito de `user_id` direto. No contexto deste sistema, `exercises` é a única tabela compartilhada (catálogo global de exercícios).
- **User_Owned_Table**: Tabela com coluna `user_id` direta. Inclui `users`, `workouts`, `workout_sessions`.
- **Indirectly_Owned_Table**: Tabela sem `user_id` direto, cuja propriedade é determinada via JOIN. Inclui `workout_exercises` (JOIN com `workouts`) e `logged_sets` (JOIN com `workout_sessions`).
- **FastAPI_Backend**: Serviço FastAPI que implementa a lógica de sincronização WatermelonDB usando SQLAlchemy síncrono.
- **JWT_Validator**: Dependência `get_current_user` de `app/core/security.py` que valida o Supabase JWT e retorna o `sub` como UUID string.

## Requirements

### Requirement 1: Estrutura de Diretórios e Registro do Router

**User Story:** Como desenvolvedor do GymNight, quero que o novo router de sincronização esteja na estrutura `app/api/v1/endpoints/`, para que o projeto siga a organização de versioning de API planejada.

#### Acceptance Criteria

1. THE FastAPI_Backend SHALL contain the file `app/api/v1/endpoints/sync.py` with the Sync_Router implementation.
2. THE FastAPI_Backend SHALL contain `app/api/__init__.py`, `app/api/v1/__init__.py`, and `app/api/v1/endpoints/__init__.py` as empty init files to make the packages importable.
3. WHEN the FastAPI_Backend starts, THE `app/main.py` SHALL include the Sync_Router from `app/api/v1/endpoints/sync.py` under the prefix `/api/v1`.
4. THE Pull_Endpoint SHALL be accessible at the path `GET /api/v1/sync/pull` and THE Push_Endpoint SHALL be accessible at the path `POST /api/v1/sync/push`; both endpoints SHALL be registered together whenever the Sync_Router is included.

---

### Requirement 2: Autenticação Obrigatória em Todos os Endpoints

**User Story:** Como operador do sistema, quero que todos os endpoints de sincronização exijam autenticação via Supabase JWT, para que apenas usuários autenticados possam acessar ou modificar dados.

#### Acceptance Criteria

1. THE Pull_Endpoint SHALL declare `current_user_id: str = Depends(get_current_user)` as a parameter, enforcing authentication at the framework level.
2. THE Push_Endpoint SHALL declare `current_user_id: str = Depends(get_current_user)` as a parameter, enforcing authentication at the framework level.
3. IF a request to the Pull_Endpoint does not include a valid Supabase JWT in the `Authorization: Bearer` header, THEN THE Sync_Router SHALL return HTTP 401 Unauthorized without executing any database operation.
4. IF a request to the Push_Endpoint does not include a valid Supabase JWT in the `Authorization: Bearer` header, THEN THE Sync_Router SHALL return HTTP 401 Unauthorized without executing any database operation.

---

### Requirement 3: Pull — Captura do Timestamp do Servidor

**User Story:** Como cliente WatermelonDB, quero que o servidor capture o timestamp atual antes de qualquer query do Pull, para que eu possa usar o `timestamp` retornado como meu próximo `last_pulled_at` sem perder registros criados durante o processamento.

#### Acceptance Criteria

1. WHEN the Pull_Endpoint begins processing a request, THE Sync_Router SHALL capture `current_server_timestamp` as `int(time.time() * 1000)` before executing any database query.
2. THE Pull_Endpoint response SHALL include the field `timestamp` containing the `current_server_timestamp` value captured at the start of request processing.
3. THE Pull_Endpoint response SHALL follow the format `{ "changes": { ... }, "timestamp": <current_server_timestamp> }`.

---

### Requirement 4: Pull — Separação Correta de `created` vs `updated`

**User Story:** Como cliente WatermelonDB, quero que o servidor separe corretamente registros criados dos atualizados, para que eu possa processar cada tipo de mudança adequadamente conforme o protocolo WatermelonDB.

#### Acceptance Criteria

1. WHEN the Pull_Endpoint queries records for any syncable table, THE Sync_Router SHALL classify a record as `created` if its `created_at > last_pulled_at`.
2. WHEN the Pull_Endpoint queries records for any syncable table, THE Sync_Router SHALL classify a record as `updated` if its `updated_at > last_pulled_at` AND its `created_at <= last_pulled_at`.
3. THE Pull_Endpoint response for each table SHALL contain three separate arrays: `created` (records where `created_at > last_pulled_at`), `updated` (records where `updated_at > last_pulled_at AND created_at <= last_pulled_at`), and `deleted` (tombstone IDs).
4. WHEN `last_pulled_at` equals exactly `0` (first sync), THE Sync_Router SHALL classify all existing records as `created`; negative values of `last_pulled_at` SHALL be rejected with HTTP 422 Unprocessable Entity.
5. THE Sync_Router SHALL apply the `created` vs `updated` classification consistently across all six syncable tables: `users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, and `logged_sets`.

---

### Requirement 5: Pull — Filtragem Multi-Tenant por Tabela

**User Story:** Como usuário do GymNight, quero que o Pull retorne apenas meus dados, para que eu não receba dados de outros usuários.

#### Acceptance Criteria

1. WHEN the Pull_Endpoint queries the `users` table, THE Sync_Router SHALL filter results to records where `users.id == current_user_id`.
2. WHEN the Pull_Endpoint queries the `workouts` table, THE Sync_Router SHALL filter results to records where `workouts.user_id == current_user_id`.
3. WHEN the Pull_Endpoint queries the `workout_sessions` table, THE Sync_Router SHALL filter results to records where `workout_sessions.user_id == current_user_id`.
4. WHEN the Pull_Endpoint queries the `workout_exercises` table, THE Sync_Router SHALL filter results via JOIN with the `workouts` table where `workouts.user_id == current_user_id`.
5. WHEN the Pull_Endpoint queries the `logged_sets` table, THE Sync_Router SHALL filter results via JOIN with the `workout_sessions` table where `workout_sessions.user_id == current_user_id`.
6. WHEN the Pull_Endpoint queries the `exercises` table, THE Sync_Router SHALL return all exercises matching the timestamp filter without any `user_id` filter (shared catalog).
7. WHEN the Pull_Endpoint queries tombstones, THE Sync_Router SHALL return only tombstones where `deleted_records.deleted_at > last_pulled_at` AND (`deleted_records.user_id == current_user_id` OR `deleted_records.user_id IS NULL`).

---

### Requirement 6: Pull — Formato de Resposta WatermelonDB

**User Story:** Como cliente WatermelonDB, quero que a resposta do Pull siga exatamente o protocolo esperado, para que a biblioteca possa processar as mudanças automaticamente sem transformações adicionais.

#### Acceptance Criteria

1. THE Pull_Endpoint response SHALL include entries for all six tables — `users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, and `logged_sets` — even when a table has no changes (using empty arrays); IF any required table is missing from the response due to a processing error, THE Sync_Router SHALL return HTTP 500.
2. THE Pull_Endpoint SHALL serialize each database record as a dictionary mapping column names to their values, including all columns present in the SQLAlchemy model.
3. THE Pull_Endpoint SHALL return HTTP 200 with a JSON body conforming to `{ "changes": { "<table_name>": { "created": [...], "updated": [...], "deleted": [...] } }, "timestamp": <int> }`.

---

### Requirement 7: Push — Validação de Propriedade Antes de Qualquer Persistência

**User Story:** Como operador do sistema, quero que a validação de propriedade multi-tenant do Push ocorra antes de qualquer escrita no banco de dados, para que um payload parcialmente inválido não cause escrita parcial de dados.

#### Acceptance Criteria

1. WHEN the Push_Endpoint receives a request, THE Sync_Router SHALL execute the complete Ownership_Check scan across all tables in the payload before performing any database write; THE Sync_Router SHALL NOT persist any records when returning HTTP 403.
2. IF the Ownership_Check detects any record in `users`, `workouts`, or `workout_sessions` where the record's `user_id` field is not null and does not equal `current_user_id`, THEN THE Sync_Router SHALL return HTTP 403 Forbidden without persisting any records from that request.
3. IF the Ownership_Check detects any record in `workout_exercises` where the `workout_id` does not reference a workout owned by `current_user_id` in the database, THEN THE Sync_Router SHALL return HTTP 403 Forbidden without persisting any records from that request.
4. IF the Ownership_Check detects any record in `logged_sets` where the `session_id` does not reference a workout_session owned by `current_user_id` in the database, THEN THE Sync_Router SHALL return HTTP 403 Forbidden without persisting any records from that request.
5. THE Sync_Router SHALL NOT perform Ownership_Check for records in the `exercises` table (shared catalog — no user ownership concept).

---

### Requirement 8: Push — Persistência Atômica em Transação Única

**User Story:** Como cliente WatermelonDB, quero que o Push persista todas as mudanças atomicamente, para que o banco de dados nunca fique em estado parcialmente atualizado caso ocorra uma falha.

#### Acceptance Criteria

1. WHEN the Push_Endpoint processes a valid payload, THE Sync_Router SHALL execute all create, update, and delete operations within a single SQLAlchemy database transaction.
2. IF any database operation within the Push transaction raises an exception, THEN THE Sync_Router SHALL attempt to rollback the entire transaction and return HTTP 500 with the original operation error message; IF the rollback itself fails, THE Sync_Router SHALL still return HTTP 500 with the original operation error.
3. WHEN all push operations complete successfully, THE Sync_Router SHALL commit the transaction and return HTTP 200 with `{ "status": "ok" }`.
4. THE Sync_Router SHALL process tables in dependency order to respect foreign key constraints: `exercises` → `users` → `workouts` → `workout_exercises` → `workout_sessions` → `logged_sets`.

---

### Requirement 9: Push — Operações por Tabela

**User Story:** Como cliente WatermelonDB, quero que o Push processe corretamente criações, atualizações e deleções para cada uma das seis tabelas sincronizáveis, para que meu estado local seja refletido no servidor.

#### Acceptance Criteria

1. WHEN processing `created` records for any table, THE Sync_Router SHALL insert the record only if no record with the same `id` already exists (idempotent insert — no-op on duplicate).
2. WHEN processing `updated` records for `users`, `workouts`, or `workout_sessions`, THE Sync_Router SHALL update only records where `id` matches AND `user_id == current_user_id` (or `id == current_user_id` for `users`).
3. WHEN processing `updated` records for `workout_exercises`, THE Sync_Router SHALL update only records where the record's `workout_id` references a workout owned by `current_user_id`.
4. WHEN processing `updated` records for `logged_sets`, THE Sync_Router SHALL update only records where the record's `session_id` references a workout_session owned by `current_user_id`.
5. WHEN processing `updated` records for `exercises`, THE Sync_Router SHALL update the record without any `user_id` ownership filter (shared catalog).
6. WHEN processing `deleted` record IDs for any User_Owned_Table, THE Sync_Router SHALL perform a physical DELETE only on records matching both the ID and `user_id == current_user_id`.
7. WHEN processing `deleted` record IDs for `workout_exercises`, THE Sync_Router SHALL perform a physical DELETE only when the record's `workout_id` references a workout owned by `current_user_id`.
8. WHEN processing `deleted` record IDs for `logged_sets`, THE Sync_Router SHALL perform a physical DELETE only when the record's `session_id` references a workout_session owned by `current_user_id`.
9. WHEN processing `deleted` record IDs for `exercises`, THE Sync_Router SHALL perform a physical DELETE without any ownership filter.
10. WHEN a physical DELETE is performed, THE Sync_Router SHALL rely on the existing PostgreSQL triggers to automatically create tombstone records in `deleted_records` — the application code SHALL NOT manually insert tombstones.
11. WHEN creating a record in `workouts` or `workout_sessions` via Push, THE Sync_Router SHALL set `user_id` to `current_user_id` if the field is absent from the payload.

---

### Requirement 10: Push — Validação Específica de `users`

**User Story:** Como operador do sistema, quero que usuários só possam criar, atualizar ou deletar o próprio perfil, para que um usuário não possa manipular dados de outro usuário via Push.

#### Acceptance Criteria

1. WHEN processing `created` records for `users`, THE Sync_Router SHALL reject with HTTP 403 any record whose `id` field does not equal `current_user_id`.
2. WHEN processing `updated` records for `users`, THE Sync_Router SHALL reject with HTTP 403 any record whose `id` field does not equal `current_user_id`.
3. WHEN processing `deleted` record IDs for `users`, THE Sync_Router SHALL reject with HTTP 403 any ID that does not equal `current_user_id`.

---

### Requirement 11: Padrão SQLAlchemy Síncrono

**User Story:** Como desenvolvedor do GymNight, quero que o Sync_Router use SQLAlchemy síncrono e `get_db` como dependency injection, para que o código seja consistente com o restante do projeto e não introduza complexidade assíncrona.

#### Acceptance Criteria

1. THE Sync_Router SHALL use synchronous SQLAlchemy sessions via `db: Session = Depends(get_db)` in both Pull_Endpoint and Push_Endpoint.
2. THE Sync_Router SHALL NOT use `async def`, `await`, `AsyncSession`, or any asynchronous SQLAlchemy constructs.
3. THE Sync_Router SHALL import `get_db` from `app.database.connection` and `Session` from `sqlalchemy.orm`.
