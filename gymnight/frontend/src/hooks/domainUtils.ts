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
}

/**
 * Calcula o volume total de um conjunto de séries registradas.
 *
 * Volume = soma(weight * repetitions) para todos os LoggedSets.
 * Para um array vazio, retorna 0.
 *
 * @param loggedSets - Array de séries (pode ser vazio)
 * @returns Volume total (número >= 0)
 *
 * Validates: Requirements 17.6, 19.6, 21.4
 */
export function computeVolume(loggedSets: LoggedSetForCalc[]): number {
  return loggedSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);
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
