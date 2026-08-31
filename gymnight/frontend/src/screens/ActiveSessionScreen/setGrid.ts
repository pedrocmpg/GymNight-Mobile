/**
 * setGrid — funções puras que montam a grade de séries do treino ativo.
 *
 * Estas funções NÃO tocam WatermelonDB, rede ou React. Elas transformam
 * (exercícios do treino + séries da última sessão + séries já gravadas hoje)
 * na estrutura que a tela renderiza.
 *
 * DIFERENÇA EM RELAÇÃO AO DESKTOP: o `active_workout.py` monta a grade a partir
 * de `series_target` com placeholder fixo "0"/"10-12" (linhas 622 e 629) — ele
 * nunca olha o histórico. Aqui cada linha nasce com o peso/reps da MESMA série
 * da última sessão daquele exercício, exibidos apagados ("fantasma"). Repetir a
 * carga da semana passada vira um toque; digitar só é necessário ao progredir.
 */

/** Uma série já gravada no banco (hoje ou em sessões passadas). */
export interface GridLoggedSet {
  id: string;
  exerciseId: string;
  weight: number;
  repetitions: number;
  completedAt: number;
}

/** Um exercício do treino, com os alvos definidos no WorkoutCreator. */
export interface GridWorkoutExercise {
  id: string;
  name: string;
  seriesTarget: number;
  repsTarget: number;
  weightTarget: number;
}

/**
 * Origem do valor exibido num campo da grade.
 * - `logged`: a série já foi gravada nesta sessão (campo travado, check marcado).
 * - `ghost`: veio da última sessão ou do alvo do treino — exibido apagado.
 * - `empty`: não há referência nenhuma; o campo fica vazio.
 */
export type GridValueSource = 'logged' | 'ghost' | 'empty';

export interface GridSetRow {
  /** Índice 1-based da série dentro do exercício, como exibido. */
  setNumber: number;
  /** Peso a exibir; null quando não há referência. */
  weight: number | null;
  /** Repetições a exibir; null quando não há referência. */
  reps: number | null;
  source: GridValueSource;
  /** true quando esta série já está gravada no banco nesta sessão. */
  isLogged: boolean;
  /** ID do logged_set correspondente, quando já gravado. */
  loggedSetId: string | null;
}

export interface GridExercise {
  exerciseId: string;
  name: string;
  rows: GridSetRow[];
  /** Quantas séries deste exercício já foram gravadas nesta sessão. */
  completedCount: number;
  /** Total de linhas exibidas para este exercício. */
  totalCount: number;
}

/**
 * Agrupa séries por exercício, cada grupo ordenado cronologicamente
 * (mais antiga primeiro), que é a ordem em que as séries foram executadas.
 *
 * `completedAt` empatado é desempatado por `id` para manter a ordem estável —
 * duas séries gravadas no mesmo milissegundo não podem trocar de lugar entre
 * renders, senão o fantasma "pula" de linha.
 */
export function groupSetsByExercise(
  sets: GridLoggedSet[],
): Map<string, GridLoggedSet[]> {
  const byExercise = new Map<string, GridLoggedSet[]>();
  for (const set of sets) {
    const existing = byExercise.get(set.exerciseId);
    if (existing) {
      existing.push(set);
    } else {
      byExercise.set(set.exerciseId, [set]);
    }
  }
  for (const group of byExercise.values()) {
    group.sort((a, b) => {
      if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }
  return byExercise;
}

/**
 * Resolve o valor "fantasma" de uma série: o que o usuário levantou na MESMA
 * posição de série, na última vez que fez este exercício.
 *
 * A cascata, decidida com o usuário:
 *   1. mesma série da última sessão  → o que ele realmente fez
 *   2. alvo do WorkoutCreator        → o que ele planejou (primeira vez)
 *   3. nada                          → campo vazio
 *
 * O passo 2 é por exercício, não por série: se na última vez ele fez só 2 de 4
 * séries, as séries 3 e 4 caem no alvo em vez de ficarem vazias.
 */
export function resolveGhostValue(
  setIndex: number,
  previousSets: GridLoggedSet[],
  exercise: GridWorkoutExercise,
): { weight: number | null; reps: number | null; source: GridValueSource } {
  const previous = previousSets[setIndex];
  if (previous) {
    return { weight: previous.weight, reps: previous.repetitions, source: 'ghost' };
  }

  // Alvo zerado significa "não preenchi isso no criador" — não vira fantasma.
  const weight = exercise.weightTarget > 0 ? exercise.weightTarget : null;
  const reps = exercise.repsTarget > 0 ? exercise.repsTarget : null;
  if (weight === null && reps === null) {
    return { weight: null, reps: null, source: 'empty' };
  }
  return { weight, reps, source: 'ghost' };
}

/**
 * Monta a grade completa da sessão.
 *
 * Cada exercício rende `max(seriesTarget, séries já gravadas hoje)` linhas — o
 * `max` garante que uma série extra registrada além do planejado continue
 * visível em vez de sumir da tela.
 *
 * @param exercises - Exercícios do treino, na ordem definida no criador
 * @param currentSets - Séries já gravadas NESTA sessão
 * @param previousSets - Séries da última sessão concluída deste treino
 */
export function buildSetGrid(
  exercises: GridWorkoutExercise[],
  currentSets: GridLoggedSet[],
  previousSets: GridLoggedSet[],
): GridExercise[] {
  const currentByExercise = groupSetsByExercise(currentSets);
  const previousByExercise = groupSetsByExercise(previousSets);

  return exercises.map((exercise) => {
    const logged = currentByExercise.get(exercise.id) ?? [];
    const previous = previousByExercise.get(exercise.id) ?? [];

    // Nunca esconder uma série já gravada, mesmo além do alvo.
    const plannedRows = Math.max(0, Math.floor(exercise.seriesTarget));
    const totalCount = Math.max(plannedRows, logged.length);

    const rows: GridSetRow[] = [];
    for (let i = 0; i < totalCount; i++) {
      const loggedSet = logged[i];
      if (loggedSet) {
        rows.push({
          setNumber: i + 1,
          weight: loggedSet.weight,
          reps: loggedSet.repetitions,
          source: 'logged',
          isLogged: true,
          loggedSetId: loggedSet.id,
        });
        continue;
      }
      const ghost = resolveGhostValue(i, previous, exercise);
      rows.push({
        setNumber: i + 1,
        weight: ghost.weight,
        reps: ghost.reps,
        source: ghost.source,
        isLogged: false,
        loggedSetId: null,
      });
    }

    return {
      exerciseId: exercise.id,
      name: exercise.name,
      rows,
      completedCount: logged.length,
      totalCount,
    };
  });
}

/**
 * Conta séries feitas e planejadas somando a grade inteira. Alimenta o contador
 * do header (`12/20 séries`) e a ProgressBar.
 */
export function countGridProgress(grid: GridExercise[]): {
  completed: number;
  total: number;
  ratio: number;
} {
  let completed = 0;
  let total = 0;
  for (const exercise of grid) {
    completed += exercise.completedCount;
    total += exercise.totalCount;
  }
  return { completed, total, ratio: total > 0 ? completed / total : 0 };
}

/**
 * Decide se uma linha pode ser gravada ao marcar o check, portando a validação
 * do desktop (`active_workout.py:665`): peso e reps precisam estar presentes e
 * válidos. O valor fantasma CONTA como preenchido — é justamente o ponto de
 * repetir a carga anterior sem digitar nada.
 *
 * @param weight - Texto do campo de peso (ou null quando vazio)
 * @param reps - Texto do campo de reps (ou null quando vazio)
 */
export function validateSetEntry(
  weight: string | null,
  reps: string | null,
): { valid: boolean; weightError: boolean; repsError: boolean; weight: number; reps: number } {
  const parsedWeight = weight !== null && weight.trim() !== '' ? Number(weight.replace(',', '.')) : NaN;
  const parsedReps = reps !== null && reps.trim() !== '' ? Number(reps.replace(',', '.')) : NaN;

  // Peso zero é válido (exercício de peso corporal); reps precisa ser >= 1.
  const weightOk = Number.isFinite(parsedWeight) && parsedWeight >= 0;
  const repsOk = Number.isFinite(parsedReps) && parsedReps >= 1;

  return {
    valid: weightOk && repsOk,
    weightError: !weightOk,
    repsError: !repsOk,
    weight: weightOk ? parsedWeight : 0,
    reps: repsOk ? Math.floor(parsedReps) : 0,
  };
}
