# Auditoria do GymNight — 2026-10-24 (branch `overnight-gymnight`)

> **Atualização (mesma noite, commit `b299a92`):** os itens 2.1a e a seção 4 (linhas "Frontend: tela e navegação") descrevem o estado *antes* da tela do GymAI. Hoje existe a aba `GymAI` (`F/src/screens/GymAiScreen/`, `F/src/navigation/containers/GymAiScreenContainer.tsx`), o cliente é injetado em `F/App.tsx` e o `AppNavigator.render.test.tsx` cobre sucesso, carregando, offline e rate_limited. O restante da auditoria segue válido. Frontend após a tela: 175 suítes, 1062 testes, `tsc` limpo.

Auditoria somente leitura: nenhum código foi alterado. O único efeito colateral foi instalar `pytest-cov` no `.venv` do backend, porque o pacote não estava instalado nem está em `requirements.txt`.
**Como ler as citações.** Afirmações sobre código e docs citam `arquivo:linha`, conferidas por leitura ou `grep -n` nesta sessão. Números vindos de comandos não têm linha de arquivo e citam o comando: contagens de testes e percentuais por área (seção 3) vêm de `npm test -- --coverage` e `pytest --cov=app --cov-report=term-missing`; os intervalos de "linhas descobertas" vêm dessas saídas; depois disso li o código de cada intervalo (coluna "O que as linhas contêm" nas duas tabelas da seção 3) e a descrição foi conferida contra o arquivo. Os números por área estão transcritos no Apêndice A no fim deste arquivo, e as citações de percentual apontam para linhas do apêndice. Cada área da seção 3 corresponde à pasta `F/src/<área>/` ou `B/app/<área>/`.

Caminhos são relativos à raiz do repositório. `F` = `gymnight/frontend`, `B` = `gymnight/backend`.
Onde a afirmação vem de um comando e não de uma linha de arquivo, a fonte é indicada como "saída de `npm test`" ou "saída de `pytest`".

**Limite da evidência:** "funciona" abaixo significa "tem código conectado e testes passando". Nada foi executado em device ou emulador. A tarefa 19 da spec (validação ponta a ponta em device) continua aberta em `.kiro/specs/frontend-backend-integration/tasks.md:323`.

---

## 1. Telas e fluxos que existem e funcionam

### Navegação (conectada, ao contrário do que diz o README)
| Fluxo | Arquivo | Evidência |
|---|---|---|
| Bootstrap decide loading/auth/onboarding/autenticado | `F/src/navigation/AppNavigator.tsx:59-89`, `F/src/navigation/bootstrapRouting.ts:19,34,95,114` | `App.tsx` importa `AppNavigator` (`F/App.tsx:33`) e o renderiza (`F/App.tsx:133`) |
| Login e cadastro | `F/src/screens/AuthScreen/AuthScreen.tsx:61`, container `F/src/navigation/containers/AuthScreenContainer.tsx:21`, rota `AppNavigator.tsx:99-109` | testes de propriedade em `F/src/auth/__tests__/` |
| Onboarding (perfil) | `F/src/screens/OnboardingScreen/OnboardingScreen.tsx:87`, `saveOnboardingProfile.ts:37`, rota `AppNavigator.tsx:110-118` | cobertura 97% |
| Aba Treinos (Dashboard, editar e criar treino, iniciar sessão, logout) | `F/src/screens/DashboardScreen/DashboardScreen.tsx:160`, `MainTabNavigator.tsx:64-81`, container `DashboardScreenContainer.tsx:43` | rota de abas montada em `AppNavigator.tsx:121-137` |
| Aba Progresso (gráfico de 1RM) | `F/src/screens/ProgressScreen/ProgressScreen.tsx:70`, `OneRmChart.tsx:28`, `MainTabNavigator.tsx:82-89`, container `ProgressScreenContainer.tsx:18` | cobertura da tela 92,85% (seção 3) |
| Aba Estatísticas (radar muscular) | `F/src/screens/StatisticsScreen/StatisticsScreen.tsx:47`, `RadarChart.tsx:28`, `MainTabNavigator.tsx:90-99`, container `StatisticsScreenContainer.tsx:16` | cobertura da tela 98,14% (seção 3) |
| Criar e editar treino | `F/src/screens/WorkoutCreatorScreen/WorkoutCreatorScreen.tsx:86`, `saveWorkoutWithExercises.ts:101` (salvar), `:33` (carregar para editar), `:172` (apagar), container `WorkoutCreatorScreenContainer.tsx:29`, rota `AppNavigator.tsx:138-147` | cobertura da tela 97,27% (seção 3) |
| Sessão ativa (séries, ghost sets, encerrar, retomar) | `F/src/screens/ActiveSessionScreen/ActiveSessionScreen.tsx:135`, `persistLoggedSet.ts:6`, `endSessionWithPersistence.ts:15`, container `ActiveSessionScreenContainer.tsx:50`, rota `AppNavigator.tsx:148-157` | teste Loki real em `F/src/db/__integration__/mainFlows.realdb.test.ts:3,45` |
| Cardio dentro da sessão | `F/src/screens/ActiveSessionScreen/CardioSection.tsx:46`, `F/src/screens/CardioScreen/CardioForm.tsx:40`, `cardioDomain.ts:16` | usado em `ActiveSessionScreen.tsx:47-48` |
| Sync (push e pull) | `F/src/sync/SyncEngine.ts:16`, `syncCycleRunner.ts:363`, `pullApply.ts:82`, montado em `F/App.tsx:120,129` | `SyncEngine.ts` 100% de cobertura (seção 3) |
| Auth: refresh de token, logout com limpeza | `F/src/auth/AuthManager.ts:57`, `TokenRefreshCoordinator.ts:19`, `LogoutManager.ts:73`; montados em `F/App.tsx` (import em `:11-26`) | testes `F/src/auth/__tests__/AuthManager.property22.test.ts` etc.; `auth` 80,42% (seção 3) |
| Teste de render do navegador completo | `F/src/navigation/__tests__/AppNavigator.render.test.tsx` (suíte em `:58`; usa `F/src/test/mocks/fakeNavigators.tsx`) | citado em `NOTAS-DA-NOITE.md:5` |

### Backend (rotas registradas em `B/app/main.py:103-110`)
| Rota | Arquivo |
|---|---|
| `POST /users`, `GET/PATCH/DELETE /users/me` | `B/app/routers/users.py:77,11,39,127` |
| `GET /health` | `B/app/routers/health.py:53` |
| `POST /admin/cleanup-tombstones` | `B/app/routers/admin.py:99` |
| `GET /api/v1/sync/pull`, `POST /api/v1/sync/push` | `B/app/api/v1/endpoints/sync.py:113,818` (registrado em `main.py:109`) |
| `POST /api/v1/chat` (GymAI) | `B/app/routers/chat.py:33-48` (registrado em `main.py:110`) |

---

## 2. O que está incompleto

Não há nenhum `TODO`, `FIXME` ou `NotImplemented` no código-fonte. A busca por `TODO|FIXME|XXX|HACK|not implemented` em `F/src`, `F/App.tsx` e `B/app` só devolveu o comentário enganoso do item 2.1. O que existe de incompleto está listado abaixo.

### 2.1 Pendências no código
| # | Item | Arquivo:linha |
|---|---|---|
| a | **Não há tela do GymAI e nenhuma tela usa o cliente.** `createBackendGymAiClient` e `createMockGymAiClient` só são definidos, nunca importados por `App.tsx` ou `src/navigation/`. Também não há aba nem rota. | `F/src/gymai/backendGymAiClient.ts:11`, `F/src/gymai/mockGymAiClient.ts:4`, `F/src/navigation/MainTabNavigator.tsx:13-17` (só Treinos, Progresso e Estatísticas) |
| b | **Comentário desatualizado:** diz "stubs — retornam not implemented", mas os endpoints estão implementados e cobertos por testes. Pode levar um leitor a achar que o sync não existe. | `B/app/api/v1/endpoints/sync.py:108` |
| c | **`birth_date` incompatível entre as pontas:** o cliente guarda número (epoch ms) e o backend valida `YYYY-MM-DD`. Hoje o onboarding não grava o campo, então não quebra, mas o primeiro push com a data daria erro. | `F/src/db/schema.ts:13`, `B/app/schemas/user.py:26,44-56` |
| d | **Roteador de sync legado, morto:** `B/app/routers/sync.py` tem 178 instruções, 0% de cobertura, e não é importado em `app/main.py` (o único import de sync é `main.py:22`, o v1). O README ainda diz que ele está registrado. | `B/app/routers/sync.py:15-504` |
| e | **Segundo `main.py` na raiz do backend** com comentário que cita `auth.py` e `hash_password`, que já não existem. | `B/main.py:20,15` |
| f | **Arquivo morto versionado:** `B/app/database/models_old.py.bak`. | `git ls-files` |
| g | **`render.yaml`:** o caminho está atualizado (`render.yaml` linhas 12-13 usam `gymnight/backend` e `app.main:app`). O `IDEIAS.md` e o README ainda o descrevem como quebrado, então esses dois estão defasados. | `render.yaml:12-13` |
| h | **`ADMIN_SECRET` com default `"changeme"`:** nada impede subir em produção com o valor padrão. | `B/app/core/config.py:21` |
| i | **`.pytest_cache` versionado:** `gymnight/backend/.pytest_cache/v/cache/nodeids` aparece como modificado no `git status`. | `git ls-files` |
| j | **`src/config.ts` legado ao lado de `src/config/env.ts`:** o grep por importações de `config` não encontrou uso fora dos testes. | `F/src/config.ts` |
| k | **Bug no adaptador, intermitente:** `supabaseAuthClientAdapter.property4` falhou na execução com cobertura, com o contraexemplo `[{"toString":[]},"a@a.aa",false]`; o primeiro elemento é o valor lançado (seed `-1632862747`). O `catch` faz `String(err)` em `supabaseAuthClientAdapter.ts:36` (e `:64`), e `String()` lança `TypeError` quando `toString` não é função, então a promise rejeita em vez de resolver. Uma segunda execução da mesma suíte (`npx jest --selectProjects unit`) passou: 172 suítes e 1049 testes. A falha só aparece com certas seeds do fast-check, e `NOTAS-DA-NOITE.md:13` registrou verde. | `F/src/auth/supabaseAuthClientAdapter.ts:36,64`, `F/src/auth/__tests__/supabaseAuthClientAdapter.property4.test.ts:17-40` |

### 2.2 Telas sem navegação
- **Todas as telas existentes têm rota.** `CardioScreen/` não tem tela própria nem rota, só o `CardioForm`, embutido na sessão ativa (`CardioSection.tsx:23`). Isso é intencional.
- A única tela **esperada e ausente** é o GymAI (item 2.1a).

### 2.3 Mocks e funções vazias em código de produção
- `F/src/gymai/mockGymAiClient.ts:9` devolve `[mock] Recebi: …`. É um dublê de teste, e nada em produção o importa.
- `B/app/gymai/providers.py:38-43` é o `MockProvider`. Ele é o **padrão** quando `GYMAI_PROVIDER` não está definido (`providers.py:80`). Sem configurar o Gemini, o `/chat` responde eco.
- `F/src/hooks/useObserveActiveSession.ts:97,105,113,121,129` retornam `{ unsubscribe: () => {} }`. São ramos de "sem dado", não funções esquecidas.
- `F/src/designSystem/haptics.ts:19` e `motion.ts:22` engolem erros com `.catch(() => {})`, de propósito.

### 2.4 Trabalho aberto nas specs
- `.kiro/specs/frontend-backend-integration/tasks.md:323` (19), `:324` (19.1, roteiro ponta a ponta em device), `:333` (19.2, opcional) e `:337` (20, checkpoint final) estão desmarcados. As demais 73 tarefas estão marcadas.
- `README.md:31,122,231,271` ainda afirma que `App.tsx` é um placeholder, que não há navegação e cita a spec `frontend-mobile-implementation`. A pasta `.kiro/specs/` só contém `frontend-backend-integration`, embora `README.md:14` liste a spec `supabase-migration` e outras duas como existentes.
- `README.md:18` diz que o roteador legado `/sync/*` está registrado, mas `B/app/main.py:103-110` não o inclui.
- `README.md:41,161,178,273` diz que o `Dockerfile` não existe e que dois smoke tests falham, mas `B/Dockerfile` existe e `tests/smoke/test_dockerfile.py` passou na execução de `pytest` (127 passaram).
- `README.md:42,178,272` diz que o `render.yaml` está com caminhos antigos, mas `render.yaml:12-13` já usa `gymnight/backend` e `app.main:app`.

---

## 3. Cobertura de testes

### Frontend — saída de `npm test -- --coverage`
Resultado: **1055 passaram, 1 falhou**, 175 suítes (174 passaram, 1 falhou). Cobertura global: **84,45% de instruções, 81,57% de ramos, 78,79% de funções, 85,73% de linhas**.

| Área | % instruções | % ramos |
|---|---|---|
| `navigation` | **45,11** | 44,36 |
| `auth` | 80,42 | 68,04 |
| `hooks` | 78,27 | 72,80 |
| `sync` | 87,41 | 84,21 |
| `screens/AuthScreen` | 88,88 | 92,10 |
| `screens/ProgressScreen` | 92,85 | 83,82 |
| `screens/*` (demais telas) | 94,8 a 98,1 | 87,5 a 94,4 |
| `db`, `db/models`, `designSystem`, `gymai`, `config`, `test` | 95 a 100 | |

Fonte da tabela por área: `AUDITORIA.md:178-199` (Apêndice A, transcrição da tabela `text` do Jest, coluna `% Stmts`); totais de testes em `AUDITORIA.md:200`. Os arquivos de cada área ficam em `F/src/<área>/` (ex.: `navigation` = `F/src/navigation/`, `hooks` = `F/src/hooks/`, `screens/X` = `F/src/screens/X/`); as linhas descobertas por arquivo estão na tabela a seguir.

**Arquivos com menor cobertura** (colunas: instruções, linhas descobertas):
| Arquivo | % | Linhas descobertas | O que as linhas contêm (lido no arquivo) |
|---|---|---|---|
| `F/src/navigation/watermelonProviders.ts` | **26,28** | 199-300, 361-425, 450-634 | as consultas reais do WatermelonDB: `workout_sessions.query(...).observe()` em `:199`, `observeAllSessions` em `:361-363` e `observeSession` em `:450-455` |
| `F/src/auth/sessionProducers.ts` | 43,47 | 16-41 | `signIn` seguido de `loadSession` e `sessionStore.set` (`:16-20`) e o equivalente do cadastro |
| `F/src/auth/SecureStorage.ts` | 44,44 | 15, 25-36 | `setItemAsync` (`:15`), `loadSession` com `JSON.parse` (`:25-31`) e `clearSession` (`:35-36`) |
| `F/src/auth/supabaseAuthClientAdapter.ts` | 47,36 | 22, 42-65 | caminho `signUp` inteiro (`:41-67`), incluindo o `catch` com `String(err)` de `:64` |
| `F/src/hooks/useObserveHistory.ts` | 48,33 | 131-204 | `unsubscribe` das quatro assinaturas (`:131-134`) e o corpo do hook `useObserveHistory` (declaração em `:144`, montagem de `loggedSetsBySessionId` e `buildRecentSessionSummaries` em `:196-202`) |
| `F/src/screens/AuthScreen/submitAuthForm.ts` | 50 | 33-34 | caminho **online** do login: `authManager.signIn` e o retorno `{type:'result'}`; só o ramo offline (`:29-30`) é coberto |
| `F/src/navigation/MainTabNavigator.tsx` | 54,54 | 27, 61-67, 85, 95 | `TabIcon` (`:27`), haptic do `tabPress` (`:61`) e ícones das abas (`:85,95`) |
| `F/src/hooks/useReactiveQuery.ts` | 58,97 | 107-160 | estado inicial `{data:null,isLoading:true}` (`:107-111`), o reset de `hasEmittedRef` e do estado ao reassinar (`:113-121`) e o `unsubscribe` no cleanup do `useEffect` (`:150-157`) |
| `F/src/navigation/bootstrapRouting.ts` | 65,62 | 40-61, 121-134 | consulta ao banco para decidir onboarding (`:40-44`) e os ramos de resultado de cadastro (`:121-134`) |
| `F/src/db/database.ts` | 66,66 | 26 | `console.error` do `onSetUpError` do adaptador SQLite (`:24-26`) |
| `F/src/sync/syncCycleRunner.ts` | 77,39 | 154-157, 226, 254-316 | `destroyDeletedRecords` para registros `deleted` após o push (`:150-157`), o ramo `abort_cycle` quando o retry de 401 não consegue montar a requisição (`:226`), `getLastPulledAt` (`:257-258`) e a transação `db.write` que aplica as operações (`:284-316`) |

O padrão é claro: o maior risco está na **cola** (providers do WatermelonDB, `SecureStorage` e o adaptador do Supabase), não nas telas. Os testes de tela usam dublês (`NOTAS-DA-NOITE.md:5`; `IDEIAS.md:44`, seção "Testes").

### Backend — saída de `pytest --cov=app` (venv do projeto)
Resultado: **127 passaram, 1 pulado**, 129 s (saída de `pytest`; os caminhos da tabela abaixo são relativos a `B/`, e a coluna "Linhas descobertas" são números de linha desses arquivos). Cobertura total: **67%** (1334 instruções, 440 descobertas). Fonte: `AUDITORIA.md:202-203`.
Sem `TEST_DATABASE_URL`, os testes de integração com Postgres são pulados, e foi assim que os bugs de 403 e `training_time` passaram (`IDEIAS.md:15`; `NOTAS-DA-NOITE.md:13` registra 151 testes com a variável).

| Arquivo | % | Linhas descobertas | O que as linhas contêm (lido no arquivo) |
|---|---|---|---|
| `B/app/routers/sync.py` (legado, não registrado) | **0** | 15-504 | o roteador inteiro, que nenhum teste importa |
| `B/app/routers/health.py` | **39** | 38-43, 68-96 | `_get_correlation_id` (`:38-43`) e o corpo do `/health`: a sondagem `SELECT 1` (`:72`) e o ramo de falha do banco. **O `/health` com banco real ou com falha não é exercitado.** |
| `B/app/core/logging.py` | 45 | 53, 58-60, 71-125 | filtros de chaves sensíveis e de JWT (`:53-60`), `sanitize_body` recursivo (`:71-84`) e a sanitização e truncagem do corpo da requisição para o log (`:98-125`) |
| `B/app/database/models/event_listeners.py` | 54 | 44-74 | corpo do listener de `_status`/`_changed` (`:44-49` e adiante) |
| `B/app/api/v1/endpoints/sync.py` | **59** | 405-456, 522-554, 621-654, 727-808 | 403 de `workout_sessions` e a checagem de `workout_exercises` (`:404-415`), `_push_users` (`:522-554`), o `created` de `workout_exercises` (`:621-624`) e o `created` de `logged_sets` (`:727-730`) |
| `B/app/database/connection.py` | 67 | 114-123 | `get_db`: abrir a sessão, `yield` e `db.close()` (`:114-123`) |
| `B/app/core/config.py` | 72 | 35-53 | tratamento de `ValidationError` ao montar `Settings` (`:33-40`) |
| `B/app/routers/admin.py` | 75 | 42-46, 142-152 | `_get_correlation_id` (`:42-46`) e o ramo de erro do cleanup, com rollback e HTTP 500 (`:141-152`) |
| `B/app/core/security.py` | 78 | 22-25, 109-115 | criação do cliente JWKS (`:22-25`) e o HTTP 400 "Token não contém claim de email" (`:109-115`) |
| `B/app/main.py` | 78 | 46-62 | construção do corpo e dos headers do 429 do rate limit (`:46-62`) |

O risco está no **sync v1** (59%) e no `/health` (39%): são os caminhos de produção com menos cobertura. No sync, ficam sem cobertura a criação de `workout_exercises` e `logged_sets` (`sync.py:621-624,727-730`), o dado principal do app; `get_db` (`B/app/database/connection.py:114-123`) também não é exercitado. As linhas descobertas de `sync.py` caem dentro de `_push_users` (`:505`), `_push_workouts` (`:557`), `_push_workout_exercises` (`:603`), `_push_workout_sessions` (`:657`), `_push_logged_sets` (`:709`), `_push_cardio_logs` (`:763`) e `push` (`:818`), isto é, nos caminhos de escrita por tabela.

---

## 4. Estado real da integração do GymAI

| Camada | Estado | Evidência |
|---|---|---|
| Backend: endpoint | **Pronto.** `POST /api/v1/chat`, com JWT, limite de 10/min por rota, até 20 mensagens de até 2000 caracteres, e 502/503 quando o provedor falha. | `B/app/routers/chat.py:13-48`, `B/app/main.py:110` |
| Backend: provedores | **Mock (padrão) e Gemini.** O Gemini chama a API do Google com a chave só no servidor. Anthropic é recusado explicitamente. O Gemini **nunca foi exercitado contra a API real**: só há testes com cliente simulado. | `B/app/gymai/providers.py:38-87`, `B/tests/test_gymai.py` |
| Frontend: cliente | **Pronto e testado.** Mapeia 200, 401/403, 429 e erro de rede para `success`/`unauthorized`/`rate_limited`/`offline`/`unavailable`. | `F/src/gymai/backendGymAiClient.ts:11-39`, `F/src/gymai/__tests__/` (100% de instruções) |
| Frontend: tela e navegação | **Inexistente.** Nenhum arquivo fora de `src/gymai/` referencia `GymAi`; o `grep` devolveu vazio. `App.tsx` não instancia o cliente (`grep -n "GymAi" F/App.tsx` sem resultado; `F/App.tsx:120-133` monta só sync e navegação). | `F/App.tsx:120-133`, `F/src/navigation/MainTabNavigator.tsx:13-17` |
| Cota por usuário | **Não existe.** Só o limite de 10/min por rota. Cada usuário autenticado gera custo no provedor sem teto diário. | `B/app/routers/chat.py:34`, `IDEIAS.md:21` ("Cota por usuário") |
| Documentação | README não menciona GymAI e a tabela de endpoints não lista `/api/v1/chat`. | `README.md:50-60` (tabela de endpoints, sem `/chat`; `grep -i gymai README.md` sem resultado) |

**Conclusão:** o GymAI é um backend funcional com cliente pronto, mas **o usuário final não consegue usá-lo**: falta a tela, a rota e a injeção do cliente no `App.tsx`.

---

## 5. Próximos passos priorizados (máximo 10)

| # | Item | Esforço | Como verificar que ficou pronto |
|---|---|---|---|
| 1 | **Corrigir o adaptador do Supabase** para nunca rejeitar com entrada exótica (`F/src/auth/supabaseAuthClientAdapter.ts:36,64`), e elevar a cobertura dele. | S (≤ 0,5 dia) | `npm test` com 0 falhas, incluindo `supabaseAuthClientAdapter.property4`; cobertura do arquivo > 80%. |
| 2 | **Validar o fluxo ponta a ponta em device** (tarefa 19 da spec): cadastro, perfil, treino, sessão, um ciclo de sync. (spec em `.kiro/specs/frontend-backend-integration/tasks.md:323-324`; checklist em `docs/PHYSICAL_DEVICE_CHECKLIST.md:1`). | M (1-2 dias) | Tarefas 19 e 20 marcadas em `tasks.md:323,337`, com roteiro documentado em `docs/PHYSICAL_DEVICE_CHECKLIST.md`. |
| 3 | **Corrigir `birth_date`** (epoch ms vs. `YYYY-MM-DD`) nas duas pontas de push e pull (`F/src/db/schema.ts:13`, `B/app/schemas/user.py:26,44-56`). | S | Teste de integração que faz push com `birth_date` e recebe 200; pull devolve o mesmo valor. |
| 4 | **Fazer o `ADMIN_SECRET` falhar o boot** se estiver em `"changeme"` fora de dev (`B/app/core/config.py:21`). | S | Teste em `B/tests/smoke/test_settings_validation.py` que instancia `Settings` em produção com o default e espera erro. |
| 5 | **Rodar os testes de integração do backend no CI sempre** (via `docker-compose.test.yml`, `.github/workflows/integration.yml`) e subir a cobertura do sync v1 (59%, linhas descobertas `B/app/api/v1/endpoints/sync.py:405-456,522-554,621-654,727-808`) e do `/health` (39%, `B/app/routers/health.py:38-43,68-96`). | M | O workflow `.github/workflows/integration.yml` roda sem `skip`; `pytest --cov` mostra `sync.py` > 80% e `health.py` > 80%. |
| 6 | **Construir a tela do GymAI**: aba ou rota, histórico em memória, estados offline e de limite, injeção do cliente em `F/App.tsx:120-133` e rota em `F/src/navigation/AppNavigator.tsx:119-158`. | M | `F/src/navigation/__tests__/AppNavigator.render.test.tsx:58` renderiza a tela; mensagem enviada no app aparece com a resposta do backend. |
| 7 | **Testar o Gemini com a chave real** e criar cota diária por usuário no `/chat` (`B/app/routers/chat.py:34`, `B/app/gymai/providers.py:57-75`). | M | Chamada real devolve texto com `GYMAI_PROVIDER=gemini`; o 31º pedido do dia devolve 429; testes cobrem os dois casos. |
| 8 | **Cobrir a cola do frontend** (`F/src/navigation/watermelonProviders.ts:199-634` 26%, `F/src/auth/SecureStorage.ts:25-36` 44%, `F/src/auth/sessionProducers.ts:16-41` 43%, `F/src/hooks/useObserveHistory.ts:131-204` 48%). | M | `npm test -- --coverage` mostra `navigation` ≥ 75% e cada um desses arquivos ≥ 70%. |
| 9 | **Limpar o repositório:** remover `B/app/routers/sync.py:15-504` (legado), `B/main.py:1` da raiz, `B/app/database/models_old.py.bak`, `F/src/config.ts` e `B/.pytest_cache` do índice; corrigir o comentário `B/app/api/v1/endpoints/sync.py:108`. | S | `git ls-files` sem esses arquivos; `pytest` e `npm test` continuam verdes; cobertura total do backend sobe (o legado de 0% sai do cálculo). |
| 10 | **Atualizar o README**: navegação existe, bug de `email` resolvido, `render.yaml` correto, rota `/api/v1/chat`, GymAI e variáveis `GYMAI_PROVIDER`/`GEMINI_API_KEY`. | S | Nenhuma ocorrência de "placeholder" ou "ainda não conectadas" em `README.md:31,122,231`; ajustar também `README.md:41,42,178`; tabela de endpoints (`README.md:49-60`) inclui `/api/v1/chat`. |

### Divergências com o `IDEIAS.md` encontradas
- O `IDEIAS.md:9` diz que `gymnight/backend/.env` está versionado. **Não está**: `git ls-files` só lista `.env.example`. O risco real é o default `changeme` (item 4).
- `IDEIAS.md:14` diz que `render.yaml` aponta caminhos antigos. Ele já aponta para `gymnight/backend` (`render.yaml:12-13`).
- `NOTAS-DA-NOITE.md:13` registra 1049 testes do frontend passando. A execução com `--coverage` desta auditoria contou 1056 testes, com 1 falha intermitente (item 2.1k), enquanto a execução do projeto `unit` deu 1049 verdes. O `tsc` não foi rodado.

---

## Apêndice A — Saída de cobertura transcrita (fonte dos percentuais da seção 3)

Linhas abaixo copiadas das saídas de `npm test -- --coverage` (Jest) e `pytest --cov=app --cov-report=term-missing`. Os percentuais da seção 3 citam estas linhas do apêndice (`AUDITORIA.md`, números de linha mostrados por `grep -n` no próprio arquivo).

```text
# Jest — Stmts | Branch | Funcs | Lines
All files                      84.45 | 81.57 | 78.79 | 85.73
 auth                          80.42 | 68.04 | 81.39 | 82.12
 config                        100   | 91.66 | 100   | 100
 db                            95.23 | 66.66 | 85.71 | 95.23
 db/models                     100   | 100   | 100   | 100
 designSystem                  95.08 | 81.81 | 95    | 96.15
 designSystem/components       94.26 | 92.2  | 97.22 | 95.49
 gymai                         100   | 94.44 | 100   | 100
 hooks                         78.27 | 72.8  | 71.25 | 76.83
 navigation                    45.11 | 44.36 | 40.54 | 46.64
 screens/ActiveSessionScreen   97.78 | 91.01 | 94.87 | 98.57
 screens/AuthScreen            88.88 | 92.1  | 100   | 94.11
 screens/CardioScreen          98.14 | 93.33 | 100   | 100
 screens/DashboardScreen       94.82 | 92.85 | 93.33 | 98.03
 screens/OnboardingScreen      97.39 | 91.13 | 100   | 100
 screens/ProgressScreen        92.85 | 83.82 | 100   | 96.15
 screens/StatisticsScreen      98.14 | 94.44 | 100   | 100
 screens/WorkoutCreatorScreen  97.27 | 87.5  | 97.43 | 98.03
 sync                          87.41 | 84.21 | 91.52 | 88.3
 test                          100   | 100   | 100   | 100
 test/mocks                    90.21 | 75.55 | 79.33 | 92.57
Tests: 1 failed, 1055 passed, 1056 total | Suites: 1 failed, 174 passed, 175 total

# pytest — TOTAL 1334 stmts, 440 miss, 67%
127 passed, 1 skipped in 129.72s
```

## Apêndice B — Arquivos gerados pelas ferramentas de cobertura (fonte primária)

Estes arquivos foram gerados pelos comandos desta auditoria, não por transcrição minha:

- **Frontend:** `gymnight/frontend/coverage/lcov.info` (gerado por `npm test -- --coverage`; está no `.gitignore`). Entradas de arquivo: `SecureStorage.ts` em `:147`, `sessionProducers.ts` em `:321`, `supabaseAuthClientAdapter.ts` em `:398`, `database.ts` em `:517`, `useObserveHistory.ts` em `:1897`, `useReactiveQuery.ts` em `:2019`, `MainTabNavigator.tsx` em `:2197`, `bootstrapRouting.ts` em `:2235`, `watermelonProviders.ts` em `:2407` (com `LF:168`/`LH:45` em `:2790-2791`, isto é, 45 de 168 linhas, 26,8%), `submitAuthForm.ts` em `:3578`, `syncCycleRunner.ts` em `:4994`.
- **Backend:** `/tmp/claude-1000/-home-pedroc-Projetos-GymNight-Mobile/675fbbc2-d5e7-4035-a1a7-6605290a2338/scratchpad/backend-coverage.xml`, gerado por uma segunda execução de `pytest --cov=app --cov-report=xml` (127 passaram, 1 pulado). Linha `:2` traz `lines-valid="1334" lines-covered="894"` (67%). Entradas: `sync.py` v1 em `:90` (`line-rate="0.5896"`), `logging.py` em `:426` (0.4478), `health.py` em `:1184` (0.3929), `routers/sync.py` legado em `:1217` (0).

Limite: o arquivo do backend fica no diretório temporário da sessão e não no repositório.

Estrutura lida dos blocos descobertos (conferida por `awk`/`sed` nesta sessão):
- `F/src/navigation/watermelonProviders.ts:198-634` são as fábricas de provider do WatermelonDB: `observeSessions` (`:198`), `observeWorkoutExercises` (`:212`), `observeLoggedSets` (`:266`), `observeProfile` (`:279`), `observeExerciseMetValues` (`:294`), `createHistoryDatabaseProvider` (`:307`), `createStatisticsDatabaseProvider` (`:360`), `createExerciseCatalogDatabaseProvider` (`:432`) e `createActiveSessionDatabaseProvider` (`:449`, com `observeSession` `:451`, `observeLoggedSets` `:485`, `observeWorkoutExercises` `:502`, `observePreviousSessionSets` `:540`, `observeCardioLogs` `:611`, `observeUserWeight` `:628`). Li agora o corpo inteiro de `:198-634`: são só consultas `db.get(...).query(...).observe()` com mapeamento de `_raw` para os tipos de domínio, mais dois joins feitos no cliente (`observeWorkoutExercises` `:212-264` e `observePreviousSessionSets` `:540-609`, que evitam `Q.on` por convenção declarada em `:213-215`). Não encontrei lógica de negócio nem defeito nessa faixa; ela fica descoberta porque os testes de unidade usam o dublê do WatermelonDB (o teste com Loki real está em `F/src/db/__integration__/mainFlows.realdb.test.ts`).
- `B/app/api/v1/endpoints/sync.py:405-808` são trechos de validação de ownership e de upsert: busca do `Workout` dono (`:416-422`), checagem de `session_id` em `logged_sets` e `cardio_logs` (`:430-452`), atualização de `Exercise` (`:492-502`), criação de `User` (`:528-554`), `WorkoutExercise` (`:645-654`), `WorkoutSession` (`:682-706`), `LoggedSet` (`:745-760`) e `CardioLog` (`:777-808`). Li agora os blocos inteiros (`:405-460`, `:488-560`, `:600-810`): são a verificação de ownership (403 quando o pai pertence a outro usuário) e, por tabela, `created` idempotente, `updated` e `deleted` filtrados por dono via join. Um detalhe de comportamento: nos `updated`, se o registro não existe no servidor, nada é gravado e nenhum erro é devolvido (`if obj:` dentro do bloco `updated` de cada `_push_*`: `sync.py:505` users, `:557` workouts, `:603` workout_exercises, `:657` workout_sessions, `:709` logged_sets, `:763` cardio_logs), o que é seguro para o isolamento mas descarta a edição em silêncio.
