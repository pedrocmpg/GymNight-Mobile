# Implementation Plan: watermelondb-sync-router

## Overview

Migra e corrige o router de sincronização WatermelonDB do GymNight Mobile Backend,
movendo-o de `app/routers/sync.py` para `app/api/v1/endpoints/sync.py` com as
seguintes correções críticas de protocolo:

1. Separação correta de `created` vs `updated` no Pull (bug de protocolo WatermelonDB)
2. Ownership scan antecipado no Push com cobertura de tabelas indiretas (`workout_exercises`, `logged_sets`)
3. Nova estrutura de diretórios `app/api/v1/` e registro em `app/main.py`

**Ordem de implementação (waves de dependência):**
Wave 1 → Infraestrutura (diretórios) → Wave 2 → Schemas e helpers → Wave 3 → Pull endpoint
→ Wave 4 → Push ownership scan → Wave 5 → Push handlers → Wave 6 → main.py + testes

---

## Tasks

- [ ] 1. Criar estrutura de diretórios `app/api/v1/endpoints/`
  - Criar o arquivo `app/api/__init__.py` (vazio)
  - Criar o arquivo `app/api/v1/__init__.py` (vazio)
  - Criar o arquivo `app/api/v1/endpoints/__init__.py` (vazio)
  - Criar o arquivo `app/api/v1/endpoints/sync.py` com o esqueleto mínimo:
    importações, `sync_router = APIRouter(prefix="/sync", tags=["sync v1"])` e
    funções stub `pull` e `push` que retornam `{"status": "not implemented"}` por ora
  - _Requirements: 1.1, 1.2_


- [ ] 2. Implementar schemas Pydantic e helpers utilitários
  - [ ] 2.1 Implementar schemas Pydantic em `app/api/v1/endpoints/sync.py`
    - Definir `TableChanges(BaseModel)` com campos `created: list[dict[str, Any]] = []`,
      `updated: list[dict[str, Any]] = []`, `deleted: list[str] = []`
    - Definir `PushPayload(BaseModel)` com campo `changes: dict[str, TableChanges] = {}`
      e campo opcional `last_pulled_at: int = 0`
    - Remover `PushRecord` com `extra="allow"` (desnecessário — registros chegam como
      `dict[str, Any]` direto no `TableChanges`)
    - _Requirements: 8.1, 9.1_

  - [ ] 2.2 Implementar helper `_row_to_dict`
    - Escrever `def _row_to_dict(row) -> dict[str, Any]` que itera
      `row.__table__.columns` e usa `getattr(row, col.name)` para cada coluna
    - Usar `__table__.columns` em vez de `__dict__` para evitar incluir
      atributos internos do SQLAlchemy (`_sa_instance_state`, etc.)
    - _Requirements: 6.2_

  - [ ] 2.3 Implementar helper `_split_created_updated`
    - Escrever `def _split_created_updated(rows, last_pulled_at) -> tuple[list, list]`
    - Retornar `(created, updated)` onde `created` contém dicts de rows com
      `row.created_at > last_pulled_at` e `updated` contém rows com
      `row.created_at <= last_pulled_at`
    - Usar `_row_to_dict` internamente para serializar cada row
    - _Requirements: 4.1, 4.2, 4.5_


- [ ] 3. Implementar Pull endpoint com separação correta `created` vs `updated`
  - [ ] 3.1 Implementar assinatura e captura de timestamp do Pull
    - Definir `@sync_router.get("/pull")` com parâmetros:
      `last_pulled_at: int = Query(0, ge=0)` (rejeita negativos com HTTP 422),
      `current_user_id: str = Depends(get_current_user)`,
      `db: Session = Depends(get_db)`
    - Capturar `current_server_timestamp = int(time.time() * 1000)` como
      **primeira** instrução do corpo da função, antes de qualquer query SQL
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3, 11.1, 11.2, 11.3_

  - [ ] 3.2 Implementar queries Pull por tabela com filtro multi-tenant
    - `users`: `db.query(User).filter(User.id == current_user_id, User.updated_at > last_pulled_at).all()`
    - `exercises`: sem filtro `user_id` — catálogo compartilhado
    - `workouts`: filtrar por `Workout.user_id == current_user_id`
    - `workout_exercises`: JOIN com `Workout` onde `Workout.user_id == current_user_id`
    - `workout_sessions`: filtrar por `WorkoutSession.user_id == current_user_id`
    - `logged_sets`: JOIN com `WorkoutSession` onde `WorkoutSession.user_id == current_user_id`
    - Tombstones: `deleted_at > last_pulled_at AND (user_id == current_user_id OR user_id IS NULL)`
    - Agrupar tombstones por `table_name` em `dict[str, list[str]]`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 3.3 Montar resposta Pull com separação `created`/`updated`/`deleted`
    - Para cada tabela, chamar `_split_created_updated(rows, last_pulled_at)`
      para obter `(created_list, updated_list)`
    - Montar dict `changes` com todas as 6 tabelas obrigatórias mesmo quando vazias
    - Retornar `{"changes": changes, "timestamp": current_server_timestamp}`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.3_

  - [ ]* 3.4 Escrever testes de propriedade para o Pull (Properties 1, 2, 3, 4)
    - Criar `tests/test_watermelondb_sync_router_pull_properties.py`
    - **Property 1: Completude da Resposta Pull**
      `@given(last_pulled_at=st.integers(min_value=0, max_value=9_999_999_999_999))`
      Verifica que `changes` tem exatamente as 6 chaves obrigatórias com `created`,
      `updated`, `deleted` e que `timestamp` é inteiro — `settings(max_examples=100)`
      `# Feature: watermelondb-sync-router, Property 1: Completude da Resposta Pull`
    - **Property 2: Classificação correta created vs updated**
      Gera registros com timestamps variados (alguns `created_at > last_pulled_at`,
      outros não), faz Pull, verifica que cada registro aparece no array correto e
      que nenhum registro aparece em ambos os arrays simultaneamente
      `# Feature: watermelondb-sync-router, Property 2: Classificação Correta created vs updated`
    - **Property 3: Isolamento Multi-Tenant no Pull**
      Reutilizar padrão do `test_sync_authorization_properties.py` adaptado para
      `/api/v1/sync/pull`; verifica que workouts/sessions/logged_sets de outros
      usuários nunca aparecem no resultado
      `# Feature: watermelondb-sync-router, Property 3: Isolamento Multi-Tenant no Pull`
    - **Property 4: Isolamento de Tombstones**
      Gera tombstones com `user_id` variados; verifica que somente tombstones com
      `user_id == current_user_id` ou `user_id IS NULL` são retornados
      `# Feature: watermelondb-sync-router, Property 4: Isolamento de Tombstones`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.1–5.7, 6.1, 6.3_


- [ ] 4. Implementar ownership scan antecipado do Push
  - [ ] 4.1 Implementar função `_validate_push_ownership`
    - Assinatura: `def _validate_push_ownership(payload: PushPayload, current_user_id: str, db: Session) -> None`
    - **Tabelas diretas** (`users`, `workouts`, `workout_sessions`):
      Para cada record em `created + updated`, se `record.get("user_id") is not None`
      e `record["user_id"] != current_user_id` → raise `HTTPException(403)`
    - **Tabelas com users**: checar adicionalmente se `record.get("id") != current_user_id`
      (Requisito 10 — usuário só pode manipular seu próprio perfil)
    - **Tabela indireta `workout_exercises`**:
      Para cada record em `created + updated`, fazer
      `db.query(Workout).filter(Workout.id == record["workout_id"]).first()`;
      se `None` ou `workout.user_id != current_user_id` → raise `HTTPException(403)`
    - **Tabela indireta `logged_sets`**:
      Para cada record em `created + updated`, fazer
      `db.query(WorkoutSession).filter(WorkoutSession.id == record["session_id"]).first()`;
      se `None` ou `session.user_id != current_user_id` → raise `HTTPException(403)`
    - **`exercises`**: SKIP — catálogo compartilhado, sem verificação de ownership
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 4.2 Implementar assinatura do Push endpoint
    - Definir `@sync_router.post("/push")` com parâmetros:
      `payload: PushPayload`,
      `current_user_id: str = Depends(get_current_user)`,
      `db: Session = Depends(get_db)`
    - Chamar `_validate_push_ownership(payload, current_user_id, db)` como
      **primeira** operação — antes de qualquer `db.add()`, `db.delete()` ou update
    - Envolver handlers em bloco `try/except HTTPException/except Exception` com
      `db.rollback()` em ambos os casos de erro; `db.commit()` somente em sucesso
    - Retornar `{"status": "ok"}` em caso de sucesso
    - _Requirements: 2.2, 2.4, 7.1, 8.1, 8.2, 8.3, 11.1, 11.2, 11.3_

  - [ ]* 4.3 Escrever testes de propriedade para o Push ownership (Properties 5, 9)
    - Adicionar ao arquivo `tests/test_watermelondb_sync_router_push_properties.py`
    - **Property 5: Ownership Scan Previne Writes Parciais**
      Gera payload com registros válidos + 1 registro com `user_id` inválido;
      faz POST `/api/v1/sync/push`; verifica HTTP 403 e que nenhum registro
      foi persistido (snapshot do banco antes e depois idênticos)
      `# Feature: watermelondb-sync-router, Property 5: Ownership Scan Previne Writes Parciais`
    - **Property 9: Proteção de Ownership da Tabela users**
      Gera operações sobre `users` com `id != current_user_id`; verifica HTTP 403
      sem persistência para `created`, `updated` e `deleted`
      `# Feature: watermelondb-sync-router, Property 9: Proteção de Ownership da Tabela users`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.1, 10.2, 10.3_


- [ ] 5. Implementar handlers internos do Push por tabela
  - [ ] 5.1 Implementar `_push_exercises`
    - Assinatura: `def _push_exercises(changes: Optional[TableChanges], db: Session) -> None`
    - Guard `if not changes: return`
    - **created**: idempotente — inserir somente se `db.query(Exercise).filter(Exercise.id == rec["id"]).first()` retorna `None`;
      filtrar campos com `{k: v for k, v in rec.items() if hasattr(Exercise, k)}`
    - **updated**: buscar por `Exercise.id`, atualizar campos presentes via `setattr`
      com guard `hasattr(obj, k)` — sem filtro de `user_id` (catálogo compartilhado)
    - **deleted**: buscar por `Exercise.id`, `db.delete(obj)` se encontrado — sem filtro de `user_id`
    - _Requirements: 9.1, 9.5, 9.9, 9.10, 8.4_

  - [ ] 5.2 Implementar `_push_users`
    - Assinatura: `def _push_users(changes: Optional[TableChanges], current_user_id: str, db: Session) -> None`
    - **created**: `if rec.get("id") != current_user_id: raise HTTPException(403)`;
      inserir idempotente se `User.id` não existe
    - **updated**: `if rec.get("id") != current_user_id: raise HTTPException(403)`;
      buscar por `User.id == rec["id"]`, atualizar campos com `setattr`
    - **deleted**: `if record_id != current_user_id: raise HTTPException(403)`;
      buscar por `User.id == record_id`, `db.delete(obj)` se encontrado
    - _Requirements: 9.1, 9.2, 9.6, 10.1, 10.2, 10.3_

  - [ ] 5.3 Implementar `_push_workouts`
    - Assinatura: `def _push_workouts(changes: Optional[TableChanges], current_user_id: str, db: Session) -> None`
    - **created**: inserir idempotente; chamar `rec.setdefault("user_id", current_user_id)`
      antes do insert para garantir `user_id` preenchido
    - **updated**: `filter(Workout.id == rec["id"], Workout.user_id == current_user_id)`
    - **deleted**: `filter(Workout.id == record_id, Workout.user_id == current_user_id)`
    - Filtrar campos com `hasattr(Workout, k)` no insert e update
    - _Requirements: 9.1, 9.2, 9.6, 9.11, 8.4_

  - [ ] 5.4 Implementar `_push_workout_exercises`
    - Assinatura: `def _push_workout_exercises(changes: Optional[TableChanges], current_user_id: str, db: Session) -> None`
    - **created**: inserir idempotente sem filtro de `user_id` (ownership já validado no scan)
    - **updated**: JOIN com `Workout` via `WorkoutExercise.workout_id == Workout.id`;
      filter `WorkoutExercise.id == rec["id"]` AND `Workout.user_id == current_user_id`
    - **deleted**: mesmo JOIN para verificar ownership indiretamente antes de `db.delete(obj)`
    - _Requirements: 9.1, 9.3, 9.7, 8.4_

  - [ ] 5.5 Implementar `_push_workout_sessions`
    - Assinatura: `def _push_workout_sessions(changes: Optional[TableChanges], current_user_id: str, db: Session) -> None`
    - **created**: inserir idempotente; `rec.setdefault("user_id", current_user_id)`
      antes do insert
    - **updated**: `filter(WorkoutSession.id == rec["id"], WorkoutSession.user_id == current_user_id)`
    - **deleted**: `filter(WorkoutSession.id == record_id, WorkoutSession.user_id == current_user_id)`
    - _Requirements: 9.1, 9.2, 9.6, 9.11, 8.4_

  - [ ] 5.6 Implementar `_push_logged_sets`
    - Assinatura: `def _push_logged_sets(changes: Optional[TableChanges], current_user_id: str, db: Session) -> None`
    - **created**: inserir idempotente sem filtro de `user_id` (ownership já validado no scan)
    - **updated**: JOIN `LoggedSet → WorkoutSession` via `LoggedSet.session_id == WorkoutSession.id`;
      filter `LoggedSet.id == rec["id"]` AND `WorkoutSession.user_id == current_user_id`
    - **deleted**: mesmo JOIN para verificar ownership antes de `db.delete(obj)`
    - _Requirements: 9.1, 9.4, 9.8, 8.4_

  - [ ] 5.7 Encadear todos os handlers no corpo do Push endpoint
    - Chamar handlers na ordem FK: `_push_exercises → _push_users → _push_workouts
      → _push_workout_exercises → _push_workout_sessions → _push_logged_sets`
    - Confirmar que o bloco `try/except` do task 4.2 envolve todos os handlers
    - _Requirements: 8.4_


- [ ] 6. Checkpoint — Pull e Push funcionais
  - Garantir que todos os testes não-opcionais implementados até aqui passam
  - Verificar importações: `from app.api.v1.endpoints.sync import sync_router` funciona
    sem `ImportError`
  - Confirmar que `_split_created_updated` retorna `(created_list, updated_list)` vazios
    quando `last_pulled_at=0` não existe nenhum registro no banco
  - Perguntar ao usuário se há dúvidas antes de prosseguir para o registro em `main.py`

- [ ] 7. Atualizar `app/main.py` para incluir o novo router em `/api/v1`
  - Adicionar import: `from app.api.v1.endpoints.sync import sync_router`
  - Adicionar registro: `app.include_router(sync_router, prefix="/api/v1")`
  - Manter o router legado `app.include_router(sync.router)` registrado em `/sync`
    (não remover — clientes existentes ainda dependem de `/sync/*` durante a transição)
  - Confirmar que os endpoints ficam acessíveis em:
    `GET /api/v1/sync/pull` e `POST /api/v1/sync/push`
  - _Requirements: 1.3, 1.4_


- [ ] 8. Escrever testes de propriedade restantes do Push (Properties 6, 7, 8)
  - Adicionar ao arquivo `tests/test_watermelondb_sync_router_push_properties.py`

  - [ ]* 8.1 Property 6 — Atomicidade do Push
    - Configurar mock de `db.commit()` para lançar `Exception` após N operações
    - `@given(payload=valid_push_payload_strategy())`
    - Verificar que o estado do banco após HTTP 500 é idêntico ao estado anterior
      (nenhum registro novo, nenhum registro modificado, nenhum registro deletado)
    - `# Feature: watermelondb-sync-router, Property 6: Atomicidade do Push`
    - _Requirements: 8.1, 8.2_

  - [ ]* 8.2 Property 7 — Idempotência de Criações no Push
    - `@given(record=valid_workout_record_strategy())`
    - Enviar o mesmo `created` record duas vezes para `/api/v1/sync/push`
    - Verificar que `db.query(Workout).filter(Workout.id == record["id"]).count() == 1`
      (sem duplicatas, sem erros na segunda chamada)
    - Testar também para `exercises`, `workout_sessions` e `logged_sets`
    - `# Feature: watermelondb-sync-router, Property 7: Idempotência de Criações no Push`
    - _Requirements: 9.1_

  - [ ]* 8.3 Property 8 — user_id Padrão em Criações
    - `@given(workout_id=st.uuids().map(str), user_id=st.uuids().map(str))`
    - Enviar `created` record de `workouts` **sem** campo `user_id` no payload
    - Verificar que `Workout.user_id == current_user_id` no banco após o Push
    - Repetir para `workout_sessions`
    - `# Feature: watermelondb-sync-router, Property 8: user_id Padrão em Criações`
    - _Requirements: 9.11_


- [ ] 9. Escrever smoke tests para estrutura e ausência de padrões legados
  - Criar `tests/smoke/test_sync_v1_structure.py`

  - [ ]* 9.1 Smoke: `__init__.py` existem em todos os níveis
    - Verificar via `pathlib.Path` que os três arquivos existem:
      `app/api/__init__.py`, `app/api/v1/__init__.py`, `app/api/v1/endpoints/__init__.py`
    - _Requirements: 1.2_

  - [ ]* 9.2 Smoke: `sync_router` importável e com prefixo correto
    - `from app.api.v1.endpoints.sync import sync_router`
    - `assert sync_router.prefix == "/sync"`
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 9.3 Smoke: ausência de padrões incorretos de protocolo
    - Ler o conteúdo de `app/api/v1/endpoints/sync.py` via `pathlib.Path.read_text()`
    - Verificar que o arquivo NÃO contém `"created": []` com o array `updated` populado
      (padrão do código legado que colocava tudo em `updated`)
    - Verificar que o arquivo NÃO usa `async def` (deve ser síncrono)
    - Verificar que o arquivo NÃO usa `AsyncSession`
    - _Requirements: 4.3, 11.2_

  - [ ]* 9.4 Smoke: endpoint registrado em `main.py` com prefixo `/api/v1`
    - Ler o conteúdo de `app/main.py` via `pathlib.Path.read_text()`
    - Verificar que o arquivo contém `include_router(sync_router` e `prefix="/api/v1"`
    - _Requirements: 1.3_

- [ ] 10. Checkpoint final — Garantir que todos os testes passam
  - Executar `pytest tests/ -x` e confirmar que todos os testes não-opcionais passam
  - Verificar que `pytest tests/ -x --ignore=tests/smoke` também passa sem erros
  - Confirmar ausência de `ImportError` ao iniciar a aplicação
  - Perguntar ao usuário se há ajustes antes de encerrar o workflow


---

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- A ordem das tasks respeita o grafo de dependências FK:
  `exercises → users → workouts → workout_exercises → workout_sessions → logged_sets`
- O router legado em `app/routers/sync.py` **não deve ser removido** — clientes
  existentes usam `/sync/*` durante a transição; deprecar no Swagger após confirmar
  que todos os clientes migraram para `/api/v1/sync/*`
- O bug crítico de protocolo (colocar tudo em `updated` com `created: []`) está
  isolado nas tasks 2.3 e 3.3 — essas são as mudanças funcionais mais importantes
- O ownership scan antecipado (task 4.1) é separado dos handlers (task 5.x) para
  garantir semântica all-or-nothing mesmo antes de abrir a transação SQL
- Todos os property tests usam SQLite em memória com `StaticPool` (padrão dos
  testes existentes em `tests/test_sync_authorization_properties.py`)
- Configuração dos property tests: `settings(max_examples=100)` (mínimo do design)
- Tag format obrigatória: `# Feature: watermelondb-sync-router, Property N: <título>`

---

## Task Dependency Graph

```json
{
  "tasks": {
    "1": {
      "title": "Criar estrutura de diretórios app/api/v1/endpoints/",
      "depends_on": [],
      "wave": 1
    },
    "2.1": {
      "title": "Implementar schemas Pydantic",
      "depends_on": ["1"],
      "wave": 2
    },
    "2.2": {
      "title": "Implementar helper _row_to_dict",
      "depends_on": ["1"],
      "wave": 2
    },
    "2.3": {
      "title": "Implementar helper _split_created_updated",
      "depends_on": ["2.2"],
      "wave": 2
    },
    "3.1": {
      "title": "Implementar assinatura e captura de timestamp do Pull",
      "depends_on": ["2.1"],
      "wave": 3
    },
    "3.2": {
      "title": "Implementar queries Pull por tabela com filtro multi-tenant",
      "depends_on": ["3.1"],
      "wave": 3
    },
    "3.3": {
      "title": "Montar resposta Pull com separação created/updated/deleted",
      "depends_on": ["2.3", "3.2"],
      "wave": 3
    },
    "3.4": {
      "title": "[OPTIONAL] Testes de propriedade Pull (Properties 1, 2, 3, 4)",
      "depends_on": ["3.3"],
      "wave": 3,
      "optional": true
    },
    "4.1": {
      "title": "Implementar _validate_push_ownership",
      "depends_on": ["2.1"],
      "wave": 4
    },
    "4.2": {
      "title": "Implementar assinatura do Push endpoint",
      "depends_on": ["4.1"],
      "wave": 4
    },
    "4.3": {
      "title": "[OPTIONAL] Testes de propriedade Push ownership (Properties 5, 9)",
      "depends_on": ["4.2"],
      "wave": 4,
      "optional": true
    },
    "5.1": {
      "title": "Implementar _push_exercises",
      "depends_on": ["4.2"],
      "wave": 5
    },
    "5.2": {
      "title": "Implementar _push_users",
      "depends_on": ["4.2"],
      "wave": 5
    },
    "5.3": {
      "title": "Implementar _push_workouts",
      "depends_on": ["5.2"],
      "wave": 5
    },
    "5.4": {
      "title": "Implementar _push_workout_exercises",
      "depends_on": ["5.3"],
      "wave": 5
    },
    "5.5": {
      "title": "Implementar _push_workout_sessions",
      "depends_on": ["5.3"],
      "wave": 5
    },
    "5.6": {
      "title": "Implementar _push_logged_sets",
      "depends_on": ["5.5"],
      "wave": 5
    },
    "5.7": {
      "title": "Encadear handlers no Push endpoint em ordem FK",
      "depends_on": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"],
      "wave": 5
    },
    "6": {
      "title": "Checkpoint — Pull e Push funcionais",
      "depends_on": ["3.3", "5.7"],
      "wave": 5
    },
    "7": {
      "title": "Atualizar app/main.py para incluir router em /api/v1",
      "depends_on": ["6"],
      "wave": 6
    },
    "8.1": {
      "title": "[OPTIONAL] Property 6 — Atomicidade do Push",
      "depends_on": ["7"],
      "wave": 6,
      "optional": true
    },
    "8.2": {
      "title": "[OPTIONAL] Property 7 — Idempotência de Criações",
      "depends_on": ["7"],
      "wave": 6,
      "optional": true
    },
    "8.3": {
      "title": "[OPTIONAL] Property 8 — user_id Padrão em Criações",
      "depends_on": ["7"],
      "wave": 6,
      "optional": true
    },
    "9.1": {
      "title": "[OPTIONAL] Smoke: __init__.py existem em todos os níveis",
      "depends_on": ["1"],
      "wave": 6,
      "optional": true
    },
    "9.2": {
      "title": "[OPTIONAL] Smoke: sync_router importável com prefixo correto",
      "depends_on": ["1"],
      "wave": 6,
      "optional": true
    },
    "9.3": {
      "title": "[OPTIONAL] Smoke: ausência de padrões incorretos de protocolo",
      "depends_on": ["3.3"],
      "wave": 6,
      "optional": true
    },
    "9.4": {
      "title": "[OPTIONAL] Smoke: router registrado em main.py com /api/v1",
      "depends_on": ["7"],
      "wave": 6,
      "optional": true
    },
    "10": {
      "title": "Checkpoint final — Garantir que todos os testes passam",
      "depends_on": ["7", "8.1", "8.2", "8.3", "9.1", "9.2", "9.3", "9.4"],
      "wave": 6
    }
  },
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "wave": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "wave": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "wave": 5, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6"] },
    { "wave": 6, "tasks": ["7", "8.1", "8.2", "8.3", "9.1", "9.2", "9.3", "9.4", "10"] }
  ],
  "critical_path": ["1", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3", "4.1", "4.2", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6", "7", "10"]
}
```
