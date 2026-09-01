# Wave 8 — Editar treino, onboarding e busca de exercício

> Parte de [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md). Depende das waves [4.5](PARIDADE-01-DESTRAVAR.md) e [6](PARIDADE-02-CATALOGO-MUSCULAR.md).
> Origem: `GymNight-Desktop/src/ui/screens/edit_routine_dialog.py` (647 linhas), `setup.py` (707) e `dialogs.py:ExerciseLineEdit`.
> Caminhos relativos a `gymnight/frontend/`.

**Nenhuma migration.** As colunas `users.goal`, `workouts.description` e `workout_exercises.order_index` já foram criadas na v2 pela Wave 6. Esta wave só as consome.

---

## 1. Editar treino existente

### 1.1 O buraco atual

O mobile **só cria** treino. Não existe nenhuma forma de:
- renomear um treino
- adicionar ou remover exercício de um treino já salvo
- mudar o número de séries/reps/peso alvo
- apagar um treino

O `WorkoutCreatorScreen` é create-only, e o Dashboard só oferece "iniciar" ou "+ Novo". Um erro de digitação no nome é permanente.

### 1.2 Generalizar, não duplicar

O `WorkoutCreatorScreen` já tem tudo: lista de exercícios do catálogo com `Switch`, campos de alvo, validação. A tela de edição é **a mesma tela com estado inicial preenchido**.

Reaproveitar direto:

| Arquivo | Estado |
|---|---|
| `src/screens/WorkoutCreatorScreen/workoutCreatorSelection.ts` | `buildExerciseInputs`, `canSaveWorkout` — portam sem mudança |
| `src/screens/WorkoutCreatorScreen/workoutValidation.ts` | idem |
| `src/screens/WorkoutCreatorScreen/saveWorkoutWithExercises.ts` | precisa virar **upsert** em vez de só insert |

O que muda: a tela ganha um modo (`create` | `edit`), e no modo `edit` recebe o treino existente para pré-selecionar os exercícios e preencher os alvos.

⚠️ **Não criar um `WorkoutEditorScreen` separado.** Seriam duas telas com a mesma validação, os mesmos campos e os mesmos bugs — que divergem no primeiro ajuste feito só de um lado.

### 1.3 `saveWorkoutWithExercises` → upsert

Hoje só cria. No modo edição precisa: atualizar o nome, e substituir as linhas de `workout_exercises`.

O desktop faz **DELETE + INSERT atômico** (`RoutineManager.update_routine_template`, descrito como "atomic replace"). Simples e correto — replicar dentro de um `database.write()`.

⚠️ **Não apagar `logged_sets` históricos.** Eles apontam para `exercise_id`, não para `workout_exercise_id`, então remover um exercício do treino **não** apaga o histórico daquele exercício. Confirmar isso ao implementar — se estiver errado, o usuário perde histórico ao editar um treino.

### 1.4 Onde entra na navegação

Um toque longo no item do treino no Dashboard, ou um ícone de lápis na linha. A rota `WorkoutCreator` passa a aceitar um `workoutId` opcional nos params.

Apagar treino: confirmar com overlay, no padrão do "Abandonar o treino atual?" da Wave 4. `workout_sessions.workout_id` é **`SET NULL`** no backend (não cascade), então o histórico sobrevive à exclusão do treino — comportamento correto, e vale exibir isso na confirmação.

### 1.5 `order_index`

O desktop guarda a ordem dos exercícios na rotina. Hoje o mobile depende da ordem de retorno da query, que não tem garantia. Com a coluna já criada na v2, passar a gravar e ordenar por ela.

Reordenar por arrastar é **opcional** nesta wave — a ordem de seleção já é melhor do que nada.

---

## 2. Onboarding

### 2.1 Os 4 passos, do desktop

`setup.py`, wizard com barra de progresso:

| Passo | Campo | Validação |
|---|---|---|
| 1 | Nome | obrigatório, erro inline |
| 2 | Peso (kg) e altura (cm) | peso 30–300, altura 100–250 |
| 3 | Gênero | Masculino / Feminino / Outro |
| 4 | Objetivo | **até 2**, com evicção FIFO |

As quatro opções de objetivo, verbatim (`setup.py:566-571`):

```
Hipertrofia    — Ganho de massa muscular
Emagrecimento  — Perda de gordura
Resistência    — Condicionamento físico
Saúde          — Qualidade de vida geral
```

### 2.2 A regra FIFO

`setup.py:663`: *"Lógica FIFO - permite até 2 metas. Remove a primeira selecionada se tentar adicionar uma terceira."*

Ou seja: selecionar um terceiro objetivo **não** é bloqueado — ele entra e o **mais antigo sai**. Detalhe fácil de errar implementando como "desabilita depois de 2".

Tocar num objetivo já selecionado o desmarca.

### 2.3 ⚠️ Diferença deliberada do desktop: onde os dados moram

O desktop persiste num arquivo solto `user_data.json`, fora do banco. **No mobile vai para a tabela `users`** — que já tem `weight`, `height`, `gender` e `birth_date` nos dois lados (client `schema.ts:11-14`, backend alembic `006_add_user_profile_fields`). Só `goal` foi acrescentado, na v2.

Ganho: sincroniza de graça, sobrevive a reinstalação, e alimenta o cálculo de calorias da Wave 6 (que hoje usa o default de 70kg porque ninguém nunca preenche peso).

`goal` guarda até 2 valores. Como não há tabela de junção, serializar como string separada por vírgula (`"Hipertrofia,Saúde"`) e tratar a leitura com uma função pura. Registrar a decisão — é a única coluna multi-valor do schema.

### 2.4 Quando aparece

O desktop mostra o wizard se o `user_data.json` não existir. No mobile o gatilho equivalente: usuário autenticado cujo registro em `users` não tem `name` preenchido.

⚠️ Ligar isso no `bootstrapRouting.ts`, que já resolve as fases `loading | auth | authenticated`. Vira uma quarta fase, `onboarding`. E `src/test/__tests__/bootstrapWiring.test.ts` valida o `App.tsx` por regex — vai precisar de atualização.

### 2.5 O que isso fecha

O hero do Dashboard tem subtítulo `{peso}kg · {altura}cm` desde a Wave 3, mas **ele nunca aparece** porque nada preenche esses campos. A Wave 3 já tratou o caso nulo (omite o campo junto com o separador, nunca renderiza `"nullkg"`); agora passa a ter conteúdo de verdade.

O desktop ainda mostra "Meta: X" no hero — com `goal` preenchido, dá para acrescentar.

---

## 3. Busca de exercício

### 3.1 Por que só agora

Com 200 exercícios no catálogo (Wave 4.5), rolar a lista inteira no `WorkoutCreatorScreen` fica inviável. Antes do seed a busca seria intestável e inútil.

### 3.2 O que o desktop faz

`dialogs.py:ExerciseLineEdit` — a cada tecla, um `LIKE %texto%` contra `exercises.canonical_name`, mostrando popup com `"Nome [GrupoMuscular] 🔥"` (🔥 = tem valor MET).

O `edit_routine_dialog.py` acrescenta um filtro: *"mostrar só exercícios com cálculo de caloria (MET)"*, ligado por padrão.

### 3.3 O que portar

Função pura de filtro em `src/screens/WorkoutCreatorScreen/`:

```ts
export function filterExercises(
  exercises: CatalogExercise[],
  query: string,
): CatalogExercise[]
```

**Normalizar dos dois lados** com o mesmo algoritmo da Wave 4.5 (NFD + remover acentos + lowercase) — assim "supino" encontra "Supino Reto (Barra)" e "biceps" encontra "Bíceps". Sem isso, todo exercício acentuado fica inacessível por busca.

Busca por substring basta. **Não portar o trigram Jaccard do `NormalizationEngine`** — ele existe no desktop para resolver *texto livre digitado pelo usuário* em nome canônico, e o mobile escolhe de catálogo fechado. Está listado como fora de escopo no índice.

Mostrar o grupo muscular ao lado do nome (agora possível, via `exercise_muscle_map` da Wave 6 — o grupo de maior `contribution` é o primário).

---

## 4. Testes

Property tests a partir do **77**:

| Nº | Assunto | O que prova |
|---|---|---|
| 77 | upsert de treino | Editar não duplica `workout_exercises`; a contagem final bate com a seleção |
| 78 | upsert de treino | Remover exercício do treino **não** apaga `logged_sets` históricos |
| 79 | FIFO de objetivos | Nunca passa de 2; o terceiro evicta o **mais antigo**, não o mais novo |
| 80 | FIFO de objetivos | Tocar num já selecionado desmarca |
| 81 | validação do onboarding | Peso 30–300, altura 100–250; fora disso não avança |
| 82 | `filterExercises` | Insensível a acento e caixa nos dois sentidos |
| 83 | `filterExercises` | Query vazia devolve tudo; sem match devolve vazio |
| 84 | `order_index` | A ordem sobrevive ao round-trip de salvar e reabrir |

⚠️ **Armadilha de teste já documentada no vault:** o `Switch` mockado exige `fireEvent(el, 'valueChange', true)` — `fireEvent.press` não funciona. E o `disabled` do `TouchableOpacity` mockado é **inerte**, então o guard `if (!canSave) return` precisa continuar existindo dentro do handler, não só na prop.

---

## 5. Verificação

1. `npx tsc --noEmit` — 16 erros pré-existentes, nem um a mais
2. `npx jest` — nenhuma regressão
3. `npx eslint src --ext .ts,.tsx` — nenhum problema novo
4. Suítes novas validadas via `git stash`
5. Fluxo manual: criar treino → editar nome → adicionar exercício → remover outro → salvar → reabrir e conferir que bateu, **e que o histórico do exercício removido continua no Progresso**
