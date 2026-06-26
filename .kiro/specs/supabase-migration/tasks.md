# Implementation Plan: Migração do Backend GymNight para Supabase

## Overview

Migração do backend FastAPI de autenticação manual (bcrypt + JWT próprio) para validação stateless do JWT emitido pelo Supabase Auth. A ordem das tarefas respeita as dependências reais: fundação de dependências → configuração → segurança → modelos/migração → schemas → routers → ambiente → testes de propriedade → smoke tests.

## Tasks

- [x] 1. Atualizar dependências Python
  - [x] 1.1 Remover `bcrypt`, `passlib[bcrypt]`, `python-jose[cryptography]` e `python-dotenv` de `requirements.txt` (ou `pyproject.toml`)
    - Verificar se algum outro módulo em `app/` importa essas bibliotecas antes de remover
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Adicionar `pydantic-settings>=2.2.0` e `PyJWT>=2.8.0` ao arquivo de dependências
    - Usar versões fixas para evitar quebras de compatibilidade
    - _Requirements: 2.1, 3.5_

- [x] 2. Reescrever `app/core/config.py` com Pydantic Settings
  - [x] 2.1 Substituir todas as chamadas `os.getenv()` / `load_dotenv()` por uma classe `Settings(BaseSettings)` com os campos obrigatórios `SUPABASE_URL`, `SUPABASE_JWT_SECRET` e `DATABASE_URL`
    - Incluir `model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")`
    - Remover os campos `SECRET_KEY`, `ALGORITHM` e `ACCESS_TOKEN_EXPIRE_MINUTES`
    - O campo `DATABASE_URL` deve ter comentário inline indicando porta `6543` (PgBouncer) para produção IPv4
    - Instanciar `settings = Settings()` no nível de módulo para falhar fast na inicialização
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Reescrever `app/core/security.py` com validação decode-only
  - [x] 3.1 Remover as funções `hash_password`, `verify_password` e `create_access_token` do arquivo
    - _Requirements: 1.3, 1.4, 1.5_
  - [x] 3.2 Implementar `get_current_user` usando `HTTPBearer(auto_error=False)` e `PyJWT` com algoritmo `HS256` e `settings.SUPABASE_JWT_SECRET`
    - Seguir a ordem de verificação: `credentials is None` → 401 "Token não fornecido"; `credentials.credentials` vazio → 401 "Token não fornecido"; `ExpiredSignatureError` → 401 "Token expirado"; `InvalidSignatureError` / `DecodeError` → 401 "Token inválido"; `sub` vazio → 401 "Token inválido"; retornar `sub`
    - A função NÃO deve gerar, assinar ou emitir nenhum token
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9_

- [x] 4. Atualizar o modelo SQLAlchemy `User`
  - [x] 4.1 Remover o campo `password_hash` da classe `User` em `app/database/models/user.py`
    - Manter intactos: `id` (String(36), PK), `name`, `weight`, `height`, `birth_date`, `gender`, `_status` (String(10), nullable), `_changed` (String(500), nullable), `created_at` (BigInteger), `updated_at` (BigInteger), `deleted_at` (BigInteger), relacionamentos `workouts` e `workout_sessions`
    - O campo `id` deve mapear diretamente ao `sub` do JWT (Supabase Auth UUID)
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8_

- [x] 5. Criar migração Alembic 004 para remover `password_hash`
  - [x] 5.1 Criar o arquivo de migração `app/database/migrations/versions/004_remove_password_hash.py` (ou equivalente conforme convenção do projeto)
    - A função `upgrade()` deve chamar `op.drop_column('users', 'password_hash')`
    - A função `downgrade()` deve chamar `op.add_column('users', sa.Column('password_hash', sa.String(255), nullable=True))` para reversibilidade
    - Incluir `Revision ID: 004` e mensagem descritiva no docstring
    - _Requirements: 5.7_

- [x] 6. Atualizar `app/schemas/user.py`
  - [x] 6.1 Remover as classes `UserCreate` (com campo `password`), `UserLogin` e qualquer schema que declare campo `password`
    - _Requirements: 1.7, 6.2_
  - [x] 6.2 Criar as classes `UserProfileCreate`, `UserProfileUpdate` e `UserProfileResponse`
    - `UserProfileCreate`: campos opcionais `name` (str, 1–100 chars), `weight` (float, 1.0–500.0), `height` (float, 50.0–300.0), `birth_date` (str ISO 8601), `gender` (str, "male"|"female"|"other")
    - `UserProfileUpdate`: mesmos campos, todos opcionais para suporte a atualizações parciais
    - `UserProfileResponse`: campos `id` (str), mais os campos de perfil; `model_config = {"from_attributes": True}`
    - _Requirements: 6.4, 6.5_

- [x] 7. Atualizar os routers
  - [x] 7.1 Deletar o arquivo `app/routers/auth.py` inteiro (login local não existe mais)
    - Verificar se há referências a esse router em `app/main.py` ou `app/app.py` e removê-las
    - _Requirements: 1.6_
  - [x] 7.2 Reescrever `app/routers/users.py` usando `UserProfileCreate`, `UserProfileResponse` e `Depends(get_current_user)`
    - O endpoint `POST /users` deve usar `current_user_id` do JWT como `id` do novo registro (nunca gerar UUID no backend)
    - Remover qualquer import de `hash_password` ou schemas com campo `password`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 7.3 Adicionar `Depends(get_current_user)` em todos os handlers de pull e push do WatermelonDB em `app/routers/sync.py` (ou equivalente)
    - O parâmetro deve retornar o `sub` do JWT para uso nos filtros de `user_id`
    - Garantir que operações de pull filtrem por `user_id == sub`
    - Garantir que operações de push rejeitem com HTTP 403 qualquer payload com `user_id != sub`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Atualizar o arquivo `.env`
  - [x] 8.1 Adicionar as entradas `SUPABASE_URL`, `SUPABASE_JWT_SECRET` e `DATABASE_URL` com valores placeholder
    - `DATABASE_URL` deve ter comentário inline com referência à porta `6543` (PgBouncer) para ambientes IPv4
    - Remover as entradas `SECRET_KEY`, `ALGORITHM` e `ACCESS_TOKEN_EXPIRE_MINUTES`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Checkpoint — Verificar integridade da migração até aqui
  - Ensure all existing tests pass, ask the user if questions arise.
  - Confirmar que a aplicação inicia sem erros com as três variáveis do Supabase definidas
  - Confirmar que `app/routers/auth.py` não existe mais e que o import foi removido do main

- [x] 10. Testes de propriedade: JWT Validator (Properties 1–4)
  - [x] 10.1 Implementar Property 1 em `tests/test_jwt_validator_properties.py`
    - **Property 1: Validação bem-sucedida preserva o `sub` do JWT**
    - Usar estratégia `st.uuids().map(str)` para gerar UUIDs válidos como claim `sub`
    - O teste deve verificar que `get_current_user` retorna exatamente o UUID gerado
    - **Validates: Requirements 2.1, 2.3, 5.8**
  - [x] 10.2 Implementar Property 2 em `tests/test_jwt_validator_properties.py`
    - **Property 2: Tokens expirados sempre resultam em HTTP 401 "Token expirado"**
    - Usar `st.integers(max_value=int(time.time())-1)` para gerar timestamps de `exp` no passado
    - **Validates: Requirements 2.4**
  - [x] 10.3 Implementar Property 3 em `tests/test_jwt_validator_properties.py`
    - **Property 3: Tokens com assinatura incorreta sempre resultam em HTTP 401 "Token inválido"**
    - Usar `st.text(min_size=10)` para gerar chaves de assinatura diferentes de `SUPABASE_JWT_SECRET`
    - **Validates: Requirements 2.5**
  - [x] 10.4 Implementar Property 4 em `tests/test_jwt_validator_properties.py`
    - **Property 4: Headers ausentes ou malformados sempre resultam em HTTP 401 "Token não fornecido"**
    - Usar `st.one_of(st.none(), st.just(""), st.text().filter(lambda s: not s.startswith("Bearer ")))` para cobrir todos os casos inválidos
    - **Validates: Requirements 2.6, 6.3, 7.3**

- [x] 11. Testes de propriedade: Settings (Property 5)
  - [x]* 11.1 Implementar Property 5 em `tests/test_settings_properties.py`
    - **Property 5: Settings rejeita qualquer configuração com variável obrigatória ausente**
    - Usar `st.frozensets(st.sampled_from(["SUPABASE_URL", "SUPABASE_JWT_SECRET", "DATABASE_URL"]))` para gerar subconjuntos próprios das variáveis obrigatórias
    - O teste deve verificar que `Settings()` lança `pydantic.ValidationError` para cada subconjunto incompleto
    - **Validates: Requirements 2.7, 3.1, 3.2, 3.3**

- [x] 12. Testes de propriedade: User Router (Properties 6–7)
  - [x]* 12.1 Implementar Property 6 em `tests/test_user_router_properties.py`
    - **Property 6: Corpo de requisição com campo `password` sempre resulta em HTTP 422**
    - Usar `st.fixed_dictionaries({"password": st.text()})` combinado com outros campos válidos opcionais
    - **Validates: Requirements 6.5**
  - [x]* 12.2 Implementar Property 7 em `tests/test_user_router_properties.py`
    - **Property 7: Perfil de usuário aceita qualquer subconjunto válido dos campos permitidos**
    - Usar estratégias para gerar subconjuntos não-vazios de `{name, weight, height, birth_date, gender}` com valores dentro dos limites válidos
    - Mockar `get_current_user` e o banco de dados para isolar o teste do schema
    - **Validates: Requirements 6.4**

- [x] 13. Testes de propriedade: Sync Authorization (Properties 8–9)
  - [x]* 13.1 Implementar Property 8 em `tests/test_sync_authorization_properties.py`
    - **Property 8: Push rejeita registros com `user_id` divergente do `sub` do JWT**
    - Usar `st.uuids()` para gerar dois UUIDs distintos (usuário autenticado vs. `user_id` no payload)
    - Verificar HTTP 403 e ausência de registros persistidos (usar SQLite in-memory)
    - **Validates: Requirements 7.4**
  - [x]* 13.2 Implementar Property 9 em `tests/test_sync_authorization_properties.py`
    - **Property 9: Pull retorna apenas registros do usuário autenticado**
    - Usar `st.lists` para popular o banco com registros de múltiplos usuários e verificar que apenas os do `sub` correto são retornados
    - **Validates: Requirements 7.5**

- [x] 14. Testes de propriedade: Model Preservation (Property 10)
  - [x]* 14.1 Implementar Property 10 em `tests/test_model_preservation_properties.py`
    - **Property 10: Colunas de sincronização preservadas em todos os modelos sincronizáveis**
    - Usar `st.sampled_from(["users", "exercises", "workouts", "workout_exercises", "workout_sessions", "logged_sets"])` para iterar sobre todas as tabelas
    - Verificar via inspeção de metadata SQLAlchemy: `_status` (String(10), nullable), `_changed` (String(500), nullable), `created_at` e `updated_at` (BigInteger), `id` (String(36), PK)
    - Verificar ausência da coluna `password_hash` na tabela `users`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7**

- [x] 15. Smoke tests
  - [x] 15.1 Implementar `tests/smoke/test_no_legacy_auth_imports.py`
    - Fazer scan de todos os arquivos `.py` em `app/` e verificar ausência de imports de `bcrypt`, `passlib`, `python_jose` (incluindo variações como `jose`, `jose.jwt`)
    - Verificar ausência das funções `hash_password`, `verify_password`, `create_access_token` em qualquer arquivo de `app/`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 15.2 Implementar `tests/smoke/test_settings_validation.py`
    - Verificar que `config.py` importa de `pydantic_settings` e não de `dotenv` ou `os`
    - Verificar que `Settings` não declara `SECRET_KEY`, `ALGORITHM` ou `ACCESS_TOKEN_EXPIRE_MINUTES` como campos obrigatórios
    - Verificar que o campo `DATABASE_URL` contém a string `6543` no comentário/docstring do módulo
    - _Requirements: 3.4, 3.5, 3.6_
  - [x] 15.3 Implementar `tests/smoke/test_schema_structure.py`
    - Verificar que `UserProfileCreate`, `UserProfileUpdate` e `UserProfileResponse` existem em `app/schemas/user.py`
    - Verificar que nenhum dos novos schemas declara o campo `password`
    - Verificar que a classe `User` em `app/database/models/user.py` não possui o atributo `password_hash`
    - _Requirements: 5.7, 6.2, 6.5_

- [-] 16. Checkpoint final — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada tarefa referencia os requisitos específicos para rastreabilidade
- Os checkpoints garantem validação incremental
- Os testes de propriedade validam garantias universais de corretude
- Os smoke tests verificam ausência de código legado via inspeção estática
- A ordem das tarefas segue as dependências reais: fundação → configuração → segurança → modelos → schemas → routers → ambiente → testes
- Testes das Properties 1–4 são totalmente in-memory (sem banco de dados)
- Testes das Properties 8–9 usam SQLite in-memory para velocidade
- O arquivo `app/routers/auth.py` deve ser deletado — não apenas esvaziado
- A migração Alembic 004 pode ser gerada com `alembic revision --autogenerate` ou criada manualmente

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["5.1", "6.1", "6.2"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "8.1"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "10.4", "11.1"] },
    { "id": 7, "tasks": ["12.1", "12.2", "13.1", "13.2", "14.1"] },
    { "id": 8, "tasks": ["15.1", "15.2", "15.3"] }
  ]
}
```
