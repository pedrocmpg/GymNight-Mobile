/**
 * Utilitários de cálculo de domínio para o GymNight Mobile.
 *
 * Todas as funções são PURAS — sem dependência de Sync_Engine, rede ou banco de dados.
 * Recebem valores tipados e retornam resultados computados.
 *
 * Usados pela Active_Session_Screen e Dashboard_Screen para computar
 * Volume e estimativa de 1RM em tempo real, 100% localmente.
 */

/**
 * Interface mínima de um LoggedSet para fins de cálculo.
 * Independente do Model do WatermelonDB — aceita qualquer objeto com os campos necessários.
 */
export interface LoggedSetForCalc {
  exerciseId: string;
  weight: number;
  repetitions: number;
  estimatedOneRm: number;
  /**
   * 'N' (normal) | 'W' (aquecimento) | 'D' (dropset) | 'F' (falha). Ausente/''
   * (séries de antes da Wave 6, ou objetos de teste que não passam o campo)
   * conta como 'N' — mesmo comportamento de quando a coluna não existia.
   */
  setType?: string;
}

/**
 * Calcula o volume total de um conjunto de séries registradas.
 *
 * Volume = soma(weight * repetitions), EXCLUINDO séries de aquecimento
 * (setType === 'W') — no desktop "volume" já significa isso, não há um
 * segundo conceito (PARIDADE-02-CATALOGO-MUSCULAR.md §4). Para um array
 * vazio, retorna 0.
 *
 * @param loggedSets - Array de séries (pode ser vazio)
 * @returns Volume total (número >= 0)
 *
 * Validates: Requirements 17.6, 19.6, 21.4
 */
export function computeVolume(loggedSets: LoggedSetForCalc[]): number {
  return loggedSets
    .filter((s) => s.setType !== 'W')
    .reduce((sum, s) => sum + s.weight * s.repetitions, 0);
}

/** Uma linha de `exercise_muscle_map`: quanto um exercício ativa um grupo muscular. */
export interface ExerciseMuscleContribution {
  exerciseId: string;
  muscleGroupId: string;
  /** 0–1 (percentual de ativação convertido: 70% → 0.7). */
  contribution: number;
}

/**
 * Calcula o volume por grupo muscular: Σ(weight × repetitions × contribution)
 * para cada `muscleGroupId`, EXCLUINDO séries de aquecimento (mesmo critério
 * de `computeVolume`). Exercícios sem entrada em `muscleMap` simplesmente não
 * contribuem para nenhum grupo.
 *
 * Validates: PARIDADE-02-CATALOGO-MUSCULAR.md — property 63
 */
export function computeMuscleVolume(
  loggedSets: LoggedSetForCalc[],
  muscleMap: ExerciseMuscleContribution[],
): Map<string, number> {
  const contributionsByExercise = new Map<string, ExerciseMuscleContribution[]>();
  for (const entry of muscleMap) {
    const bucket = contributionsByExercise.get(entry.exerciseId);
    if (bucket) {
      bucket.push(entry);
    } else {
      contributionsByExercise.set(entry.exerciseId, [entry]);
    }
  }

  const result = new Map<string, number>();
  for (const set of loggedSets) {
    if (set.setType === 'W') continue;
    const setVolume = set.weight * set.repetitions;
    const contributions = contributionsByExercise.get(set.exerciseId) ?? [];
    for (const { muscleGroupId, contribution } of contributions) {
      result.set(muscleGroupId, (result.get(muscleGroupId) ?? 0) + setVolume * contribution);
    }
  }
  return result;
}

/**
 * As 6 categorias do radar de Estatísticas (Wave 7), agrupamento exato de
 * `statistics.py:120-131` sobre os 7 `muscle_groups` do banco — NÃO são os
 * mesmos 7: Bíceps + Tríceps somam em "Braços", Abdômen vira "Core".
 * Implementar direto sobre os 7 grupos do banco gera um radar diferente do
 * desktop.
 *
 * Validates: PARIDADE-03-ESTATISTICAS.md — property 72
 */
export const RADAR_CATEGORIES = ['Peito', 'Costas', 'Ombros', 'Braços', 'Pernas', 'Core'] as const;

const RADAR_CATEGORY_BY_MUSCLE_GROUP_NAME: Record<string, (typeof RADAR_CATEGORIES)[number]> = {
  Peito: 'Peito',
  Costas: 'Costas',
  Ombros: 'Ombros',
  Bíceps: 'Braços',
  Tríceps: 'Braços',
  Pernas: 'Pernas',
  Abdômen: 'Core',
};

/**
 * Agrupa volume por `muscleGroupId` (saída de `computeMuscleVolume`) nas 6
 * categorias do radar, via o nome de cada grupo (`muscleGroupNameById`, de
 * `muscle_groups`). Sempre devolve as 6 chaves de `RADAR_CATEGORIES`, mesmo
 * com volume 0 — o radar precisa dos 6 eixos mesmo sem sessão nenhuma.
 * Nomes desconhecidos (fora do catálogo esperado) são ignorados, não somam
 * em categoria nenhuma.
 */
export function groupMuscleVolumeIntoCategories(
  volumeByMuscleGroupId: Map<string, number>,
  muscleGroupNameById: Map<string, string>,
): Map<string, number> {
  const result = new Map<string, number>(RADAR_CATEGORIES.map((c) => [c, 0]));
  for (const [muscleGroupId, volume] of volumeByMuscleGroupId) {
    const name = muscleGroupNameById.get(muscleGroupId);
    const category = name ? RADAR_CATEGORY_BY_MUSCLE_GROUP_NAME[name] : undefined;
    if (category) {
      result.set(category, (result.get(category) ?? 0) + volume);
    }
  }
  return result;
}

/**
 * Calcula a estimativa de 1RM usando a Epley Formula.
 *
 * Fórmula: estimated_one_rm = weight * (1 + repetitions / 30)
 *
 * Se um valor explícito for fornecido, ele é retornado diretamente
 * (bypass da fórmula — útil quando o usuário informa manualmente).
 *
 * @param weight - Peso utilizado na série (> 0)
 * @param repetitions - Número de repetições (>= 1)
 * @param explicit - Valor explícito de 1RM fornecido pelo usuário (opcional)
 * @returns Estimativa de 1RM calculada ou valor explícito
 *
 * Validates: Requirements 19.5, 21.3
 */
export function computeEstimatedOneRm(
  weight: number,
  repetitions: number,
  explicit?: number,
): number {
  if (explicit !== undefined) {
    return explicit;
  }
  return weight * (1 + repetitions / 30);
}

/**
 * Calcula o maior estimated_one_rm por exercício.
 *
 * Para cada exerciseId presente no array, retorna o valor máximo
 * de estimatedOneRm encontrado entre todos os seus LoggedSets.
 *
 * @param loggedSets - Array de séries (pode ser vazio)
 * @returns Map de exerciseId → maior estimatedOneRm
 *
 * Validates: Requirements 19.6, 21.4
 */
export function maxOneRmPerExercise(
  loggedSets: LoggedSetForCalc[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const s of loggedSets) {
    const current = result.get(s.exerciseId) ?? -Infinity;
    result.set(s.exerciseId, Math.max(current, s.estimatedOneRm));
  }
  return result;
}
