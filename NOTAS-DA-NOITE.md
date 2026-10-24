# Notas da noite — branch `overnight-gymnight`

## Feito (commits na branch)
1. **Constraint/banco** — o bug do README (`users.email` NOT NULL) já estava resolvido. Rodei `tests/integration` contra Postgres 16 real (via `pgserver`; sem Docker na máquina) e achei/corrigi: sync push dava 403 para pai+filhos no mesmo payload; `POST /users` descartava `training_time`; `User.email` nullable no ORM. Testes: `tests/integration/test_sync_push_constraints.py`.
2. **Navegação** — já existia; adicionei `AppNavigator.render.test.tsx` (+ `src/test/mocks/fakeNavigators.tsx`) que renderiza auth, setup/onboarding, abas, criador e sessão.
3. **Fluxos + offline** — `src/db/__integration__/mainFlows.realdb.test.ts` (Loki real). Achou e corrigiu bug de sync: registros nunca eram marcados `synced` após push 200 (`markPushedRecordsInDatabase`). `persistLoggedSet` extraído para arquivo injetável.
4. **GymAI (backend)** — `app/gymai/providers.py` (`GYMAI_PROVIDER=mock|gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`), `POST /api/v1/chat` com auth e 10/min. Anthropic/Claude é recusado em código. Testes em `tests/test_gymai.py`.
5. **utcnow** — backend sem avisos (app + testes trocados juntos por `datetime.now(timezone.utc)`).

## Pendente
- **(4) Cliente GymAI no frontend**: falta a interface `GymAiClient` + implementação que chama `/api/v1/chat` (e a tela). Só o backend foi feito.
- **(5) "worker process failed to exit"**: NÃO resolvido. Com `--detectOpenHandles` (execução serial) não aparece nenhum handle nem o aviso; só ocorre com workers paralelos. Suspeitos: suítes lentas (`SyncEngine.property*`, `writeHelpers.property17`, 20–48 s). Próximo passo: rodar `npx jest --selectProjects unit -w 4` bissectando por diretório.
- **`npx tsc --noEmit` NÃO passa**: 4 erros antigos em testes (`AuthManager.property22/23/24` — `SecureStoragePort` sem `loadSession/clearSession`; `useReactiveQuery.property1` linha 238; `pullApply.property13` linha 278). Existiam antes da noite.
- **(6) IDEIAS.md não foi escrito** porque 1–5 não estão todos concluídos (regra do enunciado).
- Falha ao rodar `pytest` completo COM `TEST_DATABASE_URL`: `test_correlation_id_properties::test_property_10` falha (logging reconfigurado pela suíte de integração; `disable_existing_loggers=False` no alembic/env.py não resolveu). Sem a variável, tudo passa.
- `birth_date`: cliente envia epoch ms (número), backend valida string `YYYY-MM-DD` → 500 no push se o onboarding passar a gravar `birthDate` (hoje não grava).
- README ainda diz que a navegação não existe e descreve o bug do `email` como aberto.
- Atenção: `gymnight/backend/.pytest_cache` está versionado (não commitei).

## Estado dos testes
- Backend padrão: 127 passed, 1 skipped (era 110). Frontend: 1047 passed (era 1034).
