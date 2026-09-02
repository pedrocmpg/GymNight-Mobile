# Wave 6 — Catálogo muscular, MET, tipos de série e calorias

> Parte de [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md). Depende das waves [4.5](PARIDADE-01-DESTRAVAR.md) e 5.
> Caminhos relativos a `gymnight/frontend/` salvo indicação contrária.

**A wave cara, e a única que mexe em schema.** A migration v1→v2 escrita aqui carrega **todo** o schema das waves 6–9 de uma vez. As waves 8 e 9 depois só *usam* colunas que já existem.

⚠️ **Esta é a wave de maior risco da série inteira.** Um `schemaMigrations` errado apaga o banco local de quem já instalou o app. Ler a §1 antes de escrever qualquer outra linha.

---

## 1. Infraestrutura de migration — pré-requisito absoluto

### 1.1 O problema

`src/db/database.ts:12-22` cria o adapter **sem a chave `migrations`**:

```ts
const adapter = new SQLiteAdapter({
  schema,
  jsi: false,
  onSetUpError: (error) => { ... },
});
```

E `src/db/schema.ts:4` está em `version: 1`. Não existe arquivo de migrations no projeto.

**Bumpar `version` para 2 sem um array `schemaMigrations([...])` faz o WatermelonDB apagar o banco local.** Todo treino, toda sessão, todo registro do usuário — perdidos silenciosamente no primeiro boot da nova versão.

### 1.2 O que fazer, nesta ordem

1. Criar `src/db/migrations.ts` exportando `schemaMigrations({ migrations: [] })`.
2. Registrar no `SQLiteAdapter` (`database.ts`), **ainda com `version: 1`**.
3. Rodar a suíte. Nada deve mudar — é só infraestrutura.
4. **Só então** escrever a migration para a v2 e bumpar `schema.ts`.

O passo 3 não é cerimônia: separa "liguei a infraestrutura" de "mudei o schema", e se algo quebrar você sabe qual dos dois foi.

### 1.3 Teste

Inspeção estática garantindo que o adapter recebe `migrations` — convenção do repo para invariantes que não dá para renderizar (precedente: `src/test/__tests__/bootstrapWiring.test.ts`, que lê o arquivo como string e casa regex).

Sem esse teste, alguém remove a chave num refactor e ninguém percebe até um usuário perder os dados.

---

## 2. O schema completo da v2

Escrever **tudo** de uma vez, mesmo o que só será consumido nas waves 8 e 9.

### 2.1 Usado nesta wave

**`muscle_groups`** — 7 linhas fixas
| coluna | tipo | nota |
|---|---|---|
| `name` | string | Peito, Costas, Ombros, Bíceps, Tríceps, Pernas, Abdômen |
| `created_at` / `updated_at` | number | |

**`exercise_muscle_map`** — N:N com ativação proporcional
| coluna | tipo | nota |
|---|---|---|
| `exercise_id` | string, indexed | FK |
| `muscle_group_id` | string, indexed | FK |
| `contribution` | number | **0–1**, decimal. O desktop valida `>0 AND <=1` |
| `created_at` / `updated_at` | number | |

**`exercise_met_values`**
| coluna | tipo | nota |
|---|---|---|
| `exercise_id` | string, indexed | FK |
| `met_value` | number | > 0 |
| `created_at` / `updated_at` | number | |

**`logged_sets.set_type`** — string, default `'N'`. Valores: `'N'` (normal), `'W'` (warmup), `'D'` (dropset), `'F'` (falha).

### 2.2 Criado agora, consumido depois

Escrever na mesma migration para não precisar de novo bump:

| Coluna/tabela | Wave que consome |
|---|---|
| `users.goal` (string, opcional) | 8 — onboarding |
| `workouts.description` (string, default `''`) | 8 — editar treino |
| `workout_exercises.order_index` (number, default 0) | 8 — editar treino |
| `cardio_logs` (tabela) | 9 — cardio |

`cardio_logs`:
| coluna | tipo |
|---|---|
| `session_id` | string, indexed |
| `cardio_type` | string |
| `duration_min` | number |
| `distance_km` | number, opcional |
| `pse` | number (1–10) |
| `created_at` / `updated_at` | number |

### 2.3 As três camadas que precisam andar juntas

Cada tabela nova toca **três lugares acoplados por lista hardcoded**. Esquecer um faz o push pular a tabela em silêncio — sem erro, sem log.

| Camada | Arquivo | O que mudar |
|---|---|---|
| Schema cliente | `src/db/schema.ts` + `src/db/models/` | tabela + model + registrar em `database.ts:modelClasses` |
| Union de sync | `src/sync/syncAdapters.ts:13-19` | `SyncableTable` |
| Lista de sync | `src/sync/syncCycleRunner.ts:18-25` | `SYNCABLE_TABLES` — **lista separada da de cima, é fácil atualizar só uma** |
| Backend | `app/database/models/` | models SQLAlchemy |
| Backend | `alembic/versions/` | migration + trigger de tombstone (padrão em `005_add_offline_sync_triggers.py`) |
| Backend | `app/api/v1/endpoints/sync.py` | handlers de pull e push, **em ordem de FK** |

⚠️ A ordem de FK no push importa: exercises → users → workouts → workout_exercises → workout_sessions → logged_sets. As tabelas novas de catálogo entram logo depois de `exercises`.

### 2.4 ⚠️ Catálogos são pull-only

`muscle_groups`, `exercise_muscle_map` e `exercise_met_values` são catálogos globais **sem `user_id`**. O servidor é a autoridade; o cliente nunca deve fazer push delas.

Tratá-las como pull-only é mais simples e mais seguro que estender `_validate_push_ownership` — e evita que um cliente adulterado escreva no catálogo compartilhado de todo mundo.

`cardio_logs`, ao contrário, é do usuário: ownership indireta via `session_id` → `workout_sessions.user_id`, mesmo padrão de `logged_sets` (`sync.py:316` mostra o equivalente para `workout_exercises`).

---

## 3. Semear o catálogo muscular

### 3.1 Fonte

`GymNight-Desktop/muscle_usage_map.md` — 200 exercícios × 7 grupos musculares, percentuais somando 100 por linha.

Regras de parsing e normalização de nome: **idênticas às da Wave 4.5** ([`PARIDADE-01-DESTRAVAR.md`](PARIDADE-01-DESTRAVAR.md) §3.4 e §3.5). Não reimplementar diferente.

Conversão: percentual inteiro → decimal (70 → 0.7). **Ignorar músculo com contribuição 0** — o desktop não grava essas linhas.

### 3.2 ⚠️ Semear exercícios e mapa na MESMA migration

Os FKs de `exercise_muscle_map` apontam para linhas de `exercises`. Se os dois seeds ficarem em migrations separadas, não há garantia de que os IDs casem.

A Wave 4.5 já resolveu isso ao mandar gerar **IDs determinísticos a partir do nome normalizado** (UUIDv5 com namespace fixo). Usar o mesmo namespace aqui — assim a migration da Wave 6 calcula o ID do exercício sem consultar o banco.

### 3.3 Valores MET

`GymNight-Desktop/src/database/parser.py`, dicionário `_EXERCISE_MET_MAP` (~227 linhas, ~150 exercícios). **Copiar os dados, não re-derivar.** As faixas do desktop:

| MET | Tipo de exercício |
|---|---|
| 3.5 | isolamento / máquina |
| 5.0–6.0 | compostos |
| 7.5 | peso corporal / calistenia |
| 11.0 | explosivo / HIIT |

Exercício sem MET no dicionário simplesmente não ganha linha em `exercise_met_values` — o fallback é tratado no cálculo (§5).

---

## 4. `set_type` e o refactor retroativo

### 4.1 Por que importa

No desktop, séries de aquecimento são excluídas de **todo** cálculo de volume, caloria e estatística. As views `session_muscle_volume` e `session_volume` (`GymNight-Desktop/src/database/connection.py:75-89`) têm `WHERE set_type != 'W'` embutido, e `calculate_session_calories` repete o filtro.

Sem isso, os números do mobile **nunca vão bater com os do desktop** para o mesmo treino.

### 4.2 ⚠️ A armadilha retroativa

No instante em que `set_type` existe, `computeVolume` (`src/hooks/domainUtils.ts:33`) fica errado em **todos os consumidores ao mesmo tempo**. São exatamente 4 call sites:

| Arquivo | Linha | Alimenta |
|---|---|---|
| `src/hooks/historyDomainUtils.ts` | 209 | `buildRecentSessionSummaries` → Dashboard e Progress |
| `src/hooks/useObserveActiveSession.ts` | 229 | volume do treino ativo |
| `src/hooks/useObserveDashboard.ts` | 285 | volume total do Dashboard |

**A coluna e o refactor dos consumidores têm que sair na mesma wave, no mesmo commit lógico.** Nunca pode existir uma versão onde a coluna existe e a matemática a ignora — seriam números silenciosamente errados, do tipo que ninguém percebe até comparar com o desktop.

### 4.3 Como refatorar

Duas opções:

1. `computeVolume` passa a filtrar `set_type !== 'W'` internamente. Simples, mas muda o significado de uma função existente com testes que assumem o contrário.
2. Uma função nova `computeEffectiveVolume` e `computeVolume` fica para os casos que querem tudo.

**Recomendado: opção 1.** No desktop, "volume" *significa* volume sem aquecimento — não há um segundo conceito. Duas funções convidam a chamar a errada. Atualizar os testes de `computeVolume` junto, deixando explícito no docstring que aquecimento é excluído.

Séries antigas, sem `set_type`, entram como `'N'` pelo default — o histórico existente continua contando como antes.

### 4.4 UI

Seletor de tipo na linha da grade do `ActiveSessionScreen`. O desktop usa as constantes `SET_TYPES` de `src/ui_models/models.py`.

Manter discreto: `'N'` é o caso esmagadoramente comum e não pode custar um toque a mais. Sugestão: toque longo na linha, ou um seletor compacto que só aparece quando a linha está em foco.

---

## 5. Calorias

### 5.1 A fórmula, verbatim

De `GymNight-Desktop/src/core/routine.py`, `calculate_session_calories`:

```
tempo_min = reps × 4 / 60          # 4 segundos por repetição
calorias  = (MET × peso_kg × tempo_min) / 60
```

Com duas regras que a implementação **não pode esquecer**:

- **`MET = 5.0` quando o exercício não tem valor** (*"Se não tiver MET, usa valor padrão conservador"*).
- **Excluir aquecimento** (`WHERE ... set_type != 'W'`).
- `peso_kg` default 70.0 quando o usuário não tem peso cadastrado — o que é o caso hoje, já que ninguém nunca preenche (o onboarding só chega na Wave 8).

### 5.2 Onde vive

Função pura em `src/hooks/historyDomainUtils.ts`, ao lado das irmãs (`computeWeeklyStreak`, `formatVolume`, `computeWeekStreak`...). Com `now` injetável se precisar de tempo, seguindo o padrão das outras.

### 5.3 O que isso devolve

O card **"Calorias queimadas"** do Dashboard, que na Wave 3 virou "Séries" justamente por falta desse dado (registrado em `REDESIGN-03-TELAS.md` §3). Trocar de volta e atualizar os testes de `DashboardScreen`.

---

## 6. Testes

Property tests a partir do **61** (a Wave 4.5 usa até o 60):

| Nº | Assunto | O que prova |
|---|---|---|
| 61 | parsing do muscle map | 200 exercícios; seções em negrito ignoradas; contribuições somam ~1.0 por exercício |
| 62 | `contribution` | Sempre em (0, 1]; contribuição 0 nunca vira linha |
| 63 | volume muscular | `Σ(weight × reps × contribution)` por grupo; aquecimento excluído |
| 64 | `computeVolume` | Séries `'W'` não entram no total, em qualquer combinação |
| 65 | calorias | Fórmula exata; fallback 5.0; aquecimento excluído; array vazio → 0 |
| 66 | calorias | Monotonicidade: mais reps ⇒ nunca menos calorias |
| 67 | migration | Schema v2 tem todas as colunas da §2, com os defaults certos |
| 68 | IDs determinísticos | Mesmo nome ⇒ mesmo ID, entre execuções e entre as duas migrations |

---

## 7. Verificação

**Tudo roda em Docker** (ver [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md) §Verificação):

```bash
docker compose -f docker-compose.test.yml run --rm frontend-tsc    # 16 erros pré-existentes, nem um a mais
docker compose -f docker-compose.test.yml run --rm frontend-test   # nenhuma regressão sobre a wave anterior
docker compose -f docker-compose.test.yml run --rm frontend-lint   # nenhum problema novo
docker compose -f docker-compose.test.yml run --rm backend-test    # a migration alembic nova roda aqui
```

⚠️ Esta é a wave que mais depende do `backend-test`: a migration alembic é aplicada contra o Postgres real do compose, não contra mock. Se ela estiver quebrada, é aqui que aparece.
Depois disso: suítes novas validadas contra a árvore anterior via `git stash`

### ⚠️ 7.1 O teste de migration — insubstituível

**Nenhum teste de Jest prova que a migration funciona.** O único jeito:

```
1. instalar a versão ANTERIOR (schema v1)
2. criar dados: um treino, uma sessão com séries
3. atualizar para a versão nova (schema v2)
4. confirmar que os dados SOBREVIVERAM
```

Se o `schemaMigrations` estiver errado, o passo 4 mostra um banco vazio — e é exatamente o que aconteceria com o usuário real.

O usuário optou por testar em device só no fim de tudo — mas **o Docker cobre boa parte disto sem celular nenhum**:

- A migration **alembic** (backend) roda contra o Postgres real do compose a cada `backend-test`. Se ela estiver quebrada, falha ali.
- A migration do **WatermelonDB** (cliente) é a que Jest não prova sozinha. Escrever um teste que aplique a migration sobre um banco populado na v1 e verifique as linhas depois — roda dentro do `frontend-test` como qualquer outro.

O que continua sem cobertura é o SQLite real do Android. Esse fica para o teste em device do fim.

Não seguir para a Wave 7 sem essa confirmação: as waves seguintes empilham em cima deste schema, e descobrir o erro depois significa desfazer tudo.
