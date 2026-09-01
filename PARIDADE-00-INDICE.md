# Paridade com o GymNight-Desktop — índice mestre

> **Documento índice. Leia este primeiro, depois execute as waves na ordem.**
> Escrito em 2026-09-01, continuando o trabalho de [`REDESIGN-VISUAL.md`](REDESIGN-VISUAL.md).
> Todos os caminhos são relativos a `gymnight/frontend/` salvo indicação contrária.

## Por que esta segunda série de specs

A série `REDESIGN-*` tratou de **aparência**: portar a identidade visual do desktop (paleta, tipografia, componentes, estrutura de tela). As waves 0–4 estão concluídas; falta só a Wave 5.

Ao terminar a Wave 4 ficou claro que o problema deixou de ser só visual. O mobile tem **5 telas**; o desktop tem **4 destinos de navegação** (Início, Treinos, Estatísticas, GymAI) mais ActiveWorkout, um wizard de Setup e um editor de rotinas. E há **features inteiras sem nenhum equivalente** no mobile.

Pior: três coisas impedem o app de funcionar num celular. Não são hipóteses — foram verificadas por leitura direta do código.

## 🔴 Os três bloqueios

### 1. Nada nunca sincroniza

`SyncEngine.requestSyncCycle()` (`src/sync/SyncEngine.ts:47`) **não tem nenhum call site fora dos testes**. Os três gatilhos que o próprio docstring do módulo (linhas 5–7) diz que deveriam existir — transição offline→online, timer de foreground, ação manual — **nenhum está ligado**.

O `SyncEngine` é instanciado no `App.tsx`, passado por `AppNavigator` → `MainTabNavigator` → `DashboardScreenContainer`, e o único consumidor (`useSyncStatus`) só lê `isCycleInProgress` para colorir um ponto de status. Nunca chama o ciclo.

**Efeito prático:** escritas locais entram na fila de `syncStatus` e ficam lá para sempre.

### 2. O catálogo de exercícios nasce vazio e nunca é populado

Não existe seed em lugar nenhum — nem script, nem data migration. `grep -rn "bulk_insert\|INSERT INTO" alembic/versions/` nas 7 migrations retorna **uma única linha**, e é sobre `deleted_records`, não sobre `exercises`.

**Efeito prático:** em instalação nova o `WorkoutCreatorScreen` mostra "Catálogo de exercícios vazio" para sempre, e **não é possível criar um treino**. O app é inutilizável.

### 3. O WatermelonDB não tem infraestrutura de migration

`src/db/database.ts:12-22` cria o `SQLiteAdapter` **sem a chave `migrations`**, e `src/db/schema.ts:4` está em `version: 1`. Não existe arquivo de migrations no projeto.

**Efeito prático:** bumpar a versão do schema sem um array `schemaMigrations([...])` faz o WatermelonDB **apagar o banco local do usuário**. Como quase toda feature planejada precisa de schema novo, isso é pré-requisito da primeira linha de código de schema.

---

## Ordem de execução

⚠️ **Os bloqueios vêm antes da Wave 5 visual, e isso é deliberado.**

A Wave 5 é, em boa parte, a restilização do `WorkoutCreatorScreen` — e essa tela **é** a lista de exercícios do catálogo. Com o catálogo vazio ela renderiza só o `EmptyState`. Estilizar uma tela que é impossível ver é como se acaba entregando UI quebrada. **O seed não compete com "parecer o desktop": ele é o que torna a Wave 5 verificável.**

```
Wave 4.5  Destravar          → PARIDADE-01-DESTRAVAR.md
          sync trigger, lastPulledAt persistente, catálogo semeado
          sem mudança de schema
          ↓
Wave 5    Visual (restante)  → REDESIGN-03-TELAS.md §5
          WorkoutCreator + Auth + Progress
          sem mudança de schema
          ↓
Wave 6    Catálogo muscular  → PARIDADE-02-CATALOGO-MUSCULAR.md
          ⚠️ A ÚNICA migration (v1→v2), carregando o schema de TODAS as waves
          músculos + MET + set_type + calorias
          ↓
Wave 7    Estatísticas       → PARIDADE-03-ESTATISTICAS.md
          radar + métricas + delta de sobrecarga, 4ª aba
          ↓
Wave 8    Rotinas e perfil   → PARIDADE-04-ROTINAS-PERFIL.md
          editar treino, onboarding, autocomplete
          ↓
Wave 9    Cardio             → PARIDADE-05-CARDIO.md
          ↓
Wave 10   Adiados            → PARIDADE-06-ADIADOS.md  ⚠️ NÃO EXECUTAR
          heatmap muscular + GymAI
```

### Por que uma migration só

A v1→v2 da Wave 6 carrega **todo** o schema das waves 6–9 de uma vez: tabelas musculares, MET, `set_type`, `order_index`, `description`, `goal` e `cardio_logs`. As waves 8 e 9 passam a apenas *usar* colunas que já existem.

Um caminho de upgrade para testar em vez de três, ao custo de escrever schema que fica algumas waves sem consumidor. Decisão do usuário, e é a troca certa: cada bump de versão é uma chance de apagar o banco de quem já instalou.

---

## Decisões tomadas com o usuário

Confirmadas antes de escrever estas specs:

| Tema | Decisão |
|---|---|
| Bloqueios (sync + catálogo) | **Antes de tudo**, inclusive antes da Wave 5 visual |
| `exercise_muscle_map` + MET | **Portar junto com o catálogo** — destrava radar, heatmap e calorias de uma vez |
| Cardio | **Entra** (completo) |
| Tipos de série (aquecimento/dropset/falha) | **Entra** |
| Editar treino existente | **Entra** |
| Onboarding (wizard de setup) | **Entra** |
| GymAI (Gemini) | **Adiado** — spec escrita, execução decidida depois |
| Migrations | **Uma só (v1→v2)** carregando o schema de todas as waves |
| Teste em device | **Só no fim de tudo** |

### ⚠️ Consequência de testar só no fim

Ninguém vai validar nada em hardware até a última wave. Isso torna a suíte automatizada a **única** rede de proteção durante todo o percurso, e eleva o custo de um erro de fundação na Wave 4.5 — ele só apareceria no final, com cinco waves empilhadas em cima.

Contramedidas embutidas em todas as specs:

- Nenhuma wave termina sem `tsc` + `jest` + `eslint` nas baselines.
- Toda função pura nova é validada contra a árvore anterior via `git stash` (a suíte nova **tem** que falhar sem a mudança).
- **Sync e migration são justamente o que Jest menos consegue provar.** Ao fim da Wave 6, fazer o teste manual do caminho de upgrade contra um SQLite local, mesmo sem celular — está detalhado em `PARIDADE-02`.

---

## O que o desktop tem e o mobile não tem

Levantamento completo, para não se perder nada.

| Feature do desktop | Onde vive lá | Wave |
|---|---|---|
| Catálogo de 200 exercícios | `muscle_usage_map.md` | 4.5 |
| Ativação muscular proporcional (N:N) | `exercise_muscle_map` | 6 |
| Valores MET / calorias | `exercise_met_values` + `routine.py` | 6 |
| Tipos de série (N/W/D/F) | `workout_logs.set_type` | 6 |
| Gráfico radar de volume muscular | `statistics.py` (matplotlib) | 7 |
| Métricas com delta período-a-período | `statistics.py` | 7 |
| Delta de sobrecarga progressiva (SMA) | `performance.py` | 7 |
| Editar rotina existente | `edit_routine_dialog.py` | 8 |
| Wizard de onboarding (4 passos) | `setup.py` | 8 |
| Autocomplete/busca de exercício | `dialogs.py:ExerciseLineEdit` | 8 |
| Cardio (avulso e em sessão) | `cardio_widget.py` | 9 |
| Heatmap muscular corporal | `widgets/muscle_heatmap.py` | 10 (adiado) |
| Chat com IA (Gemini) | `gym_ai.py` | 10 (adiado) |

### Fora de escopo, explicitamente

- **`NormalizationEngine` completo** (fuzzy trigram Jaccard + `get_or_create` de exercício por texto livre, `src/core/normalization.py`). O mobile escolhe de um catálogo fechado; não há entrada de texto livre para resolver. A parte útil — similaridade para busca — entra na Wave 8.
- **`routines.description` e dias da semana da rotina.** No desktop os dias são só visuais: `workouts.py` monta os toggles mas **não persiste no banco**, só usa num rótulo de resumo.
- **Distância real de cardio por GPS.** Ver `PARIDADE-05` §5.4.

---

## Baselines para verificação

Estado no início desta série (fim da Wave 4, commit `42a5a57`):

| Métrica | Valor |
|---|---|
| `npx jest` | **126 suites / 754 testes**, 100% verde |
| `npx eslint src --ext .ts,.tsx` | **283 problemas** (282 erros + 1 warning) |
| `npx tsc --noEmit` | **16 erros**, todos pré-existentes em 6 arquivos de teste |

Rodar os três ao fim de **cada** wave. Nenhum pode piorar.

Os 16 erros de `tsc` estão documentados em `Armadilhas e Débito Técnico.md` no vault: `AuthManager.property22/23/24` (mocks incompletos de `SecureStoragePort`), `schema.test.ts` (chama `tableSchema(...)` como função), `useReactiveQuery.property1` (`.record` numa union) e `pullApply.property13` (`number | null` em `number | undefined`). Não afetam execução — o Babel não faz type-check.

### Device físico

O projeto **não usa emulador** (ver `Setup Device USB.md` no vault):

```
scripts/setup-device.cmd <IP> <SUPABASE_URL> <ANON_KEY>
uvicorn app.main:app --host 0.0.0.0     # no backend
npx expo run:android --clean            # rebuild nativo obrigatório
```

---

## Convenções do repositório que estas specs respeitam

Não negociáveis — valem para toda wave:

1. **Estado de domínio vem exclusivamente de observables do WatermelonDB.** Nada copiado para Zustand/Context. O `zustand` está no `package.json` mas não é usado em nenhum arquivo de `src/`.
2. **Toda agregação é função pura, em arquivo separado, com teste próprio.** Ver `src/hooks/domainUtils.ts`, `historyDomainUtils.ts`, `src/screens/ActiveSessionScreen/setGrid.ts`.
3. **Joins são client-side, nunca `Q.on()`.**
4. **Telas são burras**; os containers em `src/navigation/containers/` fazem a ligação com os dados.
5. **Só tokens de design** — há regra de eslint proibindo literal de cor, espaçamento e tipografia em `src/screens/` e `src/designSystem/`.
6. **`fontWeight` é ignorado no Android quando há `fontFamily`** — os tokens de tipografia carregam só `fontFamily`.
7. Testes: Jest + `jest-expo` + `@testing-library/react-native` + `fast-check` para property tests (`<assunto>.propertyNN.test.ts`).
8. Para invariantes que não dá para renderizar, **teste de inspeção estática** — precedente em `src/test/__tests__/bootstrapWiring.test.ts`, que lê o `App.tsx` como string e casa regex.

## Pendência de segurança, fora do escopo destas specs

🔴 **`gymnight/backend/.env` está commitado no repositório** (não só o `.env.example`), e `ADMIN_SECRET` tem default `"changeme"`. Não é escopo destas waves, mas continua pendente e deveria ser resolvido antes de qualquer deploy.
