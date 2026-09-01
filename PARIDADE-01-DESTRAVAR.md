# Wave 4.5 — Destravar o app: sync, cursor persistente e catálogo semeado

> Parte de [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md). Executar **antes** da Wave 5.
> Caminhos relativos a `gymnight/frontend/` salvo indicação contrária.

**Esta é a wave que faz o app funcionar num celular pela primeira vez.**

**Nenhuma mudança de schema.** Nada aqui bumpa a versão do WatermelonDB nem cria tabela. É de propósito: a infraestrutura de migration só entra na Wave 6, e nada nesta wave precisa dela.

---

## Por que esta wave vem antes da Wave 5 visual

A Wave 5 é, em boa parte, restilizar o `WorkoutCreatorScreen`. Essa tela **é** a lista de exercícios do catálogo — com o catálogo vazio ela renderiza só o `EmptyState`. Estilizar uma tela impossível de ver não se verifica.

O seed é o que torna a Wave 5 verificável. Não compete com "parecer o desktop"; viabiliza.

---

## 1. Gatilho de sync

### 1.1 O diagnóstico

`SyncEngine.requestSyncCycle()` (`src/sync/SyncEngine.ts:47`) **não tem nenhum call site fora dos testes**:

```
$ grep -rn "requestSyncCycle" src --include=*.ts --include=*.tsx | grep -v __tests__
src/sync/SyncEngine.ts:4:  * Expõe `requestSyncCycle()` como ponto de entrada único para todos os gatilhos:
src/sync/SyncEngine.ts:45:   * Cada chamada a requestSyncCycle dispara NO MÁXIMO um ciclo...
src/sync/SyncEngine.ts:47:  async requestSyncCycle(): Promise<void> {
```

Só a definição e o próprio comentário. O motor está pronto, testado (5 suítes de property test: `SyncEngine.property6/8/10/15`, `writeHelpers.property17`), com lock anti-concorrência funcionando — e **nunca é acionado**.

O `SyncEngine` já é instanciado no `App.tsx:113` e desce por `AppNavigator` → `MainTabNavigator` → `DashboardScreenContainer`. O único consumidor (`useSyncStatus`, `DashboardScreenContainer.tsx:26-39`) lê `isCycleInProgress` a cada segundo só para colorir um ponto. Nunca chama o ciclo.

### 1.2 Os três gatilhos

O próprio docstring do módulo (`SyncEngine.ts:4-7`) já especifica quais são, com número de requisito:

```
- Transição de conectividade estável offline→online (2s debounce)  [Requisito 3.2]
- Timer fixo de 30s em foreground+online                           [Requisito 4.7]
- Ação manual do usuário
```

Implementar exatamente esses três. **Não inventar outros.**

### 1.3 Onde o código vai

Criar `src/sync/useSyncTrigger.ts` — um hook, não lógica dentro de container:

```ts
export function useSyncTrigger(syncEngine: SyncEngine): void
```

Responsabilidades:

1. **Offline→online com debounce de 2s.** Só dispara na *transição* (era offline, ficou online), não a cada emissão do NetInfo. O `NetInfo.addEventListener` já está escrito duas vezes no repo — copiar o padrão de `DashboardScreenContainer.tsx:51`. Guardar o estado anterior num `useRef` para detectar a borda.
2. **Timer de 30s**, ativo só em foreground **e** online. Usar `AppState` do React Native para pausar em background — um timer rodando com o app minimizado gasta bateria à toa.
3. **Ação manual.** Expor um `requestSync()` para o Dashboard chamar num pull-to-refresh.

O `SyncEngine` já é single-flight (`cycleInProgress`), então gatilhos concorrentes são inofensivos — o hook **não** precisa de lock próprio.

### 1.4 Onde ligar

No `DashboardScreenContainer`, que já recebe o `syncEngine` por prop. É a tela principal do app autenticado.

⚠️ **`src/test/__tests__/bootstrapWiring.test.ts` valida o `App.tsx` lendo o arquivo como string e casando regex.** Qualquer mudança no bootstrap exige atualizar essas regexes. É também o lugar certo para acrescentar a asserção de que o gatilho está ligado — segue a convenção do repo para invariantes que não dá para renderizar.

### 1.5 Brinde barato: o indicador que existe e nunca aparece

`syncStatus` já é passado ao `DashboardScreen` como prop e **nunca é renderizado**. `getSyncStatusColor` (`src/sync/SyncStatusIndicator.ts`) não tem nenhum consumidor de UI. Com o sync finalmente rodando, mostrar o ponto de status no header do Dashboard fecha a lacuna.

⚠️ **Risco conhecido:** `SyncStatusIndicator.ts` importa `@/designSystem/tokens`, mas o alias `@/` só existe no `moduleNameMapper` do `jest.config.js` — o Babel não tem `module-resolver`. Funciona em teste, **pode quebrar no Metro**. Ao tocar nesse arquivo, trocar por caminho relativo.

---

## 2. `lastPulledAt` persistente

### 2.1 O problema

`src/sync/lastPulledAt.ts` guarda o cursor numa variável de módulo. O próprio arquivo admite:

```ts
* Implementação atual: armazena em memória (substituir por AsyncStorage/WatermelonDB
* localStorage em produção).

let lastPulledAtValue: number | null = null;
```

Efeito: **pull completo a cada abertura do app.** Funciona, mas desperdiça banda e bateria, e piora conforme o histórico cresce.

### 2.2 Como persistir

**Usar `expo-secure-store`, que já é dependência** (`package.json:27`, `~14.0.1`) e já tem padrão estabelecido em `src/auth/SecureStorage.ts`. Não introduzir `@react-native-async-storage/async-storage` só para isso.

Chave sugerida: `gymnight.sync.lastPulledAt`. O valor é um número; serializar com `String(n)` e ler com `Number(raw)`, tratando `null` e `NaN` como "nunca sincronizou".

### 2.3 ⚠️ A armadilha: isso torna assíncrona uma API síncrona

`loadLastPulledAt()` hoje é **síncrona** e devolve `number | null`. `SecureStore.getItemAsync` é assíncrona. Os três consumidores:

| Arquivo | Uso |
|---|---|
| `src/sync/syncCycleRunner.ts:16` | importa as três funções — é o consumidor real |
| `src/auth/logoutAdapters.ts:6` | só `clearLastPulledAt` |
| `src/sync/pullRequest.ts` | só recebe o valor por parâmetro, não chama o módulo |

O raio de alcance é pequeno, mas **`syncCycleRunner` precisa passar a dar `await`**. Verificar se as suítes de `SyncEngine.property*` e `syncCycleRunner` assumem retorno síncrono — provavelmente sim.

Alternativa que evita a mudança de assinatura: manter o cache em memória como está e só **hidratá-lo** uma vez no bootstrap (ler do SecureStore e chamar `saveLastPulledAt`), mantendo `loadLastPulledAt()` síncrona. **Esta é a opção recomendada** — menor raio de alcance, nenhuma suíte quebrada, mesmo benefício.

`clearLastPulledAt` (usado no logout) tem que limpar **os dois**: memória e SecureStore. Senão o cursor do usuário anterior vaza para o próximo login.

---

## 3. Catálogo de exercícios semeado

### 3.1 O problema

Não existe seed em lugar nenhum. As 7 migrations alembic não têm um único `INSERT` em `exercises`:

```
$ grep -rn "bulk_insert\|INSERT INTO" alembic/versions/*.py
005_add_offline_sync_triggers.py:81:    INSERT INTO deleted_records (...)
```

`exercises` nasce vazia e fica vazia. **Não dá para criar um treino em instalação nova.**

### 3.2 Semear no backend, não no cliente

O desktop re-semeia o markdown a cada boot (`window.py:207-212`). No mobile o certo é diferente:

`exercises` **já é tratada como catálogo compartilhado em todo o protocolo de sync**. O endpoint v1 busca sem filtro de usuário (`app/api/v1/endpoints/sync.py:133`, comentário: *"exercises — sem filtro de usuário (catálogo compartilhado)"*) e **pula a validação de ownership no push** (linha 257: *"exercises: SKIP — catálogo compartilhado"*).

Então: **semear via data migration alembic e deixar o pull distribuir.** Sem mudança de protocolo, sem mudança de schema, sem código de seed no cliente.

⚠️ **Cuidado com uma pista falsa:** `SHARED_TABLES = {"exercises"}` existe em `app/routers/sync.py:74`, mas **esse router é código morto** — nunca é importado no `main.py`. O router vivo é o de `app/api/v1/endpoints/sync.py`. Não editar o arquivo errado.

### 3.3 A fonte dos dados

`GymNight-Desktop/muscle_usage_map.md` — 229 linhas, **200 exercícios**, tabela markdown com 7 colunas de percentual de ativação muscular (Peito, Costas, Ombros, Bíceps, Tríceps, Pernas, Abdômen), cada linha somando 100%.

Nesta wave só interessa a **primeira coluna** (o nome canônico). O mapa de ativação em si entra na Wave 6, junto com as tabelas musculares.

### 3.4 Regras de parsing (portar exatamente)

De `GymNight-Desktop/src/database/parser.py:239-286`:

- Ignorar linhas vazias, cabeçalho e separador (`:---:`).
- **Ignorar linhas de seção em negrito** — o regex do desktop é `^\|\s*\*\*.*\*\*`, que casa `| **PEITO (Chest)** | | | ...`. São cabeçalhos de grupo, não exercícios.
- Converter percentual inteiro para decimal (70 → 0.7) — relevante só na Wave 6.
- Ignorar músculo com contribuição 0.

### 3.5 ⚠️ Normalização de nome — portar literalmente

`parser.py:233-236`:

```python
def _normalize(text: str) -> str:
    """Lowercase + remove acentos + strip — mesmo algoritmo do NormalizationEngine."""
    nfd = unicodedata.normalize("NFD", text.lower().strip())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")
```

Equivalente em TypeScript, se algum dia for preciso no cliente:

```ts
function normalize(text: string): string {
  return text.toLowerCase().trim().normalize('NFD').replace(/\p{Mn}/gu, '');
}
```

**Portar esse algoritmo exatamente** é o que garante que "Supino Reto (Barra)" resolva para a mesma chave nos dois apps. Divergir aqui significa catálogos que não batem e, mais tarde, busca que não encontra.

Decisão a tomar na execução: **guardar o nome de exibição com acentuação e maiúsculas** (`"Supino Reto (Barra)"`) na coluna `name`, e usar a forma normalizada só como chave de deduplicação durante o seed. O mobile não tem coluna `canonical_name` separada como o desktop.

### 3.6 IDs

O cliente usa `id` string (WatermelonDB), o backend usa UUID. Gerar os IDs **deterministicamente a partir do nome normalizado** (ex.: UUIDv5 com namespace fixo) em vez de aleatórios.

Motivo: a Wave 6 vai semear `exercise_muscle_map` e `exercise_met_values`, cujas FKs apontam para essas linhas. Com ID determinístico as duas migrations casam sem precisar consultar o banco, e re-rodar o seed é idempotente.

### 3.7 Idempotência

A migration precisa ser segura para rodar mais de uma vez: `INSERT ... ON CONFLICT DO NOTHING` ou verificação prévia por ID. O desktop resolve isso re-semeando a cada boot; aqui, uma migration que explode na segunda execução trava o deploy.

---

## 4. Testes

Seguindo a convenção do repo (property tests numerados; o último em uso é o **56**, em `computeChartGeometry.property56.test.ts`):

| Nº | Assunto | O que prova |
|---|---|---|
| 57 | `useSyncTrigger` | Dispara **uma vez** na transição offline→online, não a cada emissão do NetInfo |
| 58 | `useSyncTrigger` | Debounce de 2s: N transições em menos de 2s resultam num ciclo só |
| 59 | `useSyncTrigger` | Timer de 30s não dispara em background nem offline |
| 60 | `lastPulledAt` | Round-trip: salvar → hidratar → ler devolve o mesmo valor; `clear` limpa memória **e** storage |

Mais testes de componente/inspeção:

- `bootstrapWiring.test.ts` — estender para afirmar que o gatilho está ligado.
- Teste do parser do markdown: 200 linhas viram 200 exercícios, seções em negrito são ignoradas, nomes normalizados batem com os do desktop numa amostra conhecida.

⚠️ Usar **timers falsos** para os gatilhos. Nada de `setTimeout` real na suíte.

---

## 5. Verificação

1. `npx tsc --noEmit` — 16 erros pré-existentes, nem um a mais
2. `npx jest` — baseline **126 suites / 754 testes**; esta wave só acrescenta
3. `npx eslint src --ext .ts,.tsx` — baseline **283 problemas**, nenhum novo
4. Suítes novas validadas contra a árvore anterior via `git stash` — têm que falhar sem a mudança

### Aceitação em device

**O teste que importa, e que nunca funcionou até hoje:**

```
instalação limpa
  → abrir o app
  → o catálogo aparece populado (200 exercícios)
  → criar um treino
  → treinar
  → matar o app
  → reabrir
  → tudo continua lá
```

Se qualquer passo falhar, **não seguir para a Wave 5** — todas as waves seguintes assumem esta fundação.

⚠️ Lembrete: o usuário optou por testar em device **só no fim de tudo**. Isso significa que este teste de aceitação vai ficar pendente por várias waves. Vale ao menos exercitar o ciclo de sync contra o backend local rodando (`uvicorn app.main:app --host 0.0.0.0`) antes de seguir.
