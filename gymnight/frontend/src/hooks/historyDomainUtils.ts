/**
 * Utilitários de agregação de histórico/progresso para o GymNight Mobile.
 *
 * Todas as funções são PURAS — sem dependência de Sync_Engine, rede ou banco de dados.
 * Reaproveitam computeVolume/computeEstimatedOneRm/maxOneRmPerExercise de domainUtils.ts
 * onde aplicável, para não duplicar a fórmula de volume/1RM.
 *
 * Usadas pela Dashboard_Screen (cards ricos, streak semanal) e pela Progress_Screen
 * (evolução de 1RM, detecção de PR, resumo de sessões).
 */

import { computeVolume, LoggedSetForCalc } from './domainUtils';

export interface SessionForAggregation {
  id: string;
  workoutId: string | null;
  startedAt: number;
  endedAt: number | null;
}

/**
 * Calcula a duração média (ms) das sessões ENCERRADAS (endedAt != null) de um workout.
 * Sessões em andamento (endedAt === null) são ignoradas.
 *
 * @param sessions - Array de sessões (pode ser vazio)
 * @param workoutId - Id do workout a filtrar, ou null para sessões freestyle
 * @returns Duração média em ms, ou null se não há sessões encerradas para o workout
 */
export function computeAverageSessionDuration(
  sessions: SessionForAggregation[],
  workoutId: string | null,
): number | null {
  const durations = sessions
    .filter((s) => s.workoutId === workoutId && s.endedAt !== null)
    .map((s) => (s.endedAt as number) - s.startedAt);

  if (durations.length === 0) return null;
  return durations.reduce((sum, d) => sum + d, 0) / durations.length;
}

/**
 * Encontra o timestamp (started_at, em ms) da sessão ENCERRADA mais recente de um workout.
 *
 * @param sessions - Array de sessões (pode ser vazio)
 * @param workoutId - Id do workout a filtrar, ou null para sessões freestyle
 * @returns Timestamp da sessão mais recente, ou null se não há sessões encerradas
 */
export function findLastTrainedAt(
  sessions: SessionForAggregation[],
  workoutId: string | null,
): number | null {
  const finished = sessions.filter((s) => s.workoutId === workoutId && s.endedAt !== null);
  if (finished.length === 0) return null;
  return finished.reduce((max, s) => Math.max(max, s.startedAt), -Infinity);
}

/**
 * Calcula quantos dias inteiros se passaram desde um timestamp, em relação a `now`.
 *
 * @param timestampMs - Timestamp de referência (ms), ou null
 * @param now - Função que retorna o instante atual (ms); injetável para testes
 * @returns Número de dias (>= 0), ou null se timestampMs for null
 */
export function daysSince(timestampMs: number | null, now: () => number = Date.now): number | null {
  if (timestampMs === null) return null;
  const diffMs = Math.max(0, now() - timestampMs);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export interface WorkoutExerciseCount {
  workoutId: string;
  exerciseCount: number;
}

/**
 * Conta quantos exercícios distintos cada workout possui, a partir dos registros de
 * workout_exercises (cada registro é uma linha exercicio-no-treino).
 *
 * @param workoutExercises - Array de {workoutId, exerciseId}
 * @returns Map de workoutId -> nº de exercícios
 */
export function countExercisesPerWorkout(
  workoutExercises: Array<{ workoutId: string; exerciseId: string }>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const we of workoutExercises) {
    result.set(we.workoutId, (result.get(we.workoutId) ?? 0) + 1);
  }
  return result;
}

/**
 * Início da semana (domingo, 00:00, horário local do dispositivo) que contém `timestampMs`.
 */
function startOfWeek(timestampMs: number): Date {
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * Calcula a faixa de streak semanal: para cada um dos 7 dias da semana ATUAL
 * (domingo=índice 0 a sábado=índice 6, no fuso horário local do dispositivo),
 * indica se há pelo menos 1 sessão ENCERRADA (endedAt != null) iniciada naquele dia.
 *
 * Sessões sem endedAt (em andamento) e sessões de semanas passadas/futuras nunca
 * marcam um dia como treinado.
 *
 * @param sessions - Array de sessões (pode ser vazio)
 * @param now - Função que retorna o instante atual (ms); injetável para testes
 * @returns Array de 7 booleans, índice 0 = domingo da semana atual
 */
export function computeWeeklyStreak(
  sessions: SessionForAggregation[],
  now: () => number = Date.now,
): boolean[] {
  const weekStart = startOfWeek(now());
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

  const streak = new Array(7).fill(false) as boolean[];

  for (const s of sessions) {
    if (s.endedAt === null) continue;
    if (s.startedAt < weekStartMs || s.startedAt >= weekEndMs) continue;

    const dayIndex = new Date(s.startedAt).getDay();
    streak[dayIndex] = true;
  }

  return streak;
}

export interface OneRmDataPoint {
  timestampMs: number;
  estimatedOneRm: number;
}

/**
 * Monta a série temporal (ordenada por tempo crescente) do 1RM estimado para um
 * exercício específico, a partir de logged_sets.
 *
 * @param loggedSets - Array de logged_sets com exerciseId/estimatedOneRm/completedAt
 * @param exerciseId - Id do exercício a filtrar
 * @returns Array de pontos {timestampMs, estimatedOneRm}, ordenado crescente por timestampMs
 */
export function buildOneRmTimeSeries(
  loggedSets: Array<{ exerciseId: string; estimatedOneRm: number; completedAt: number }>,
  exerciseId: string,
): OneRmDataPoint[] {
  return loggedSets
    .filter((s) => s.exerciseId === exerciseId)
    .map((s) => ({ timestampMs: s.completedAt, estimatedOneRm: s.estimatedOneRm }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

/**
 * Determina se o último ponto de uma série temporal de 1RM representa um novo
 * recorde pessoal — ou seja, se é estritamente maior que todos os pontos anteriores.
 *
 * Séries vazias ou com um único ponto nunca são consideradas um "novo" PR (não há
 * histórico anterior para superar).
 *
 * @param series - Série temporal ordenada por tempo crescente (ver buildOneRmTimeSeries)
 * @returns true se o último ponto é um novo recorde pessoal
 */
export function isNewPersonalRecord(series: OneRmDataPoint[]): boolean {
  if (series.length < 2) return false;
  const last = series[series.length - 1];
  const previousMax = series
    .slice(0, -1)
    .reduce((max, p) => Math.max(max, p.estimatedOneRm), -Infinity);
  return last.estimatedOneRm > previousMax;
}

export interface SessionSummary {
  id: string;
  workoutName: string | null;
  startedAt: number;
  durationMs: number | null;
  totalVolume: number;
}

/**
 * Monta resumos de sessão para exibição em lista ("sessões recentes"), ordenados
 * decrescente por startedAt (mais recente primeiro) e limitados a `limit` itens.
 *
 * @param sessions - Array de sessões
 * @param workoutNamesById - Map de workoutId -> nome do workout
 * @param loggedSetsBySessionId - Map de sessionId -> logged_sets daquela sessão
 * @param limit - Número máximo de resumos a retornar (default 20)
 * @returns Array de resumos de sessão, mais recente primeiro
 */
export function buildRecentSessionSummaries(
  sessions: SessionForAggregation[],
  workoutNamesById: Map<string, string>,
  loggedSetsBySessionId: Map<string, LoggedSetForCalc[]>,
  limit = 20,
): SessionSummary[] {
  return [...sessions]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      workoutName: s.workoutId !== null ? workoutNamesById.get(s.workoutId) ?? null : null,
      startedAt: s.startedAt,
      durationMs: s.endedAt !== null ? s.endedAt - s.startedAt : null,
      totalVolume: computeVolume(loggedSetsBySessionId.get(s.id) ?? []),
    }));
}

// ---------------------------------------------------------------------------
// Wave 3 — agregações do Dashboard (port de dashboard.py)
// ---------------------------------------------------------------------------

/**
 * Reordena um array de 7 posições indexado por domingo=0 para segunda→domingo.
 *
 * O `computeWeeklyStreak` acima produz o array com domingo no índice 0 (é o que
 * `Date.getDay()` devolve), mas o desktop exibe a semana começando na segunda
 * (`dashboard.py:383`: `loop_to_dow = [1, 2, 3, 4, 5, 6, 0]`). Esta função é a
 * ponte entre os dois — aplicá-la só na camada de exibição mantém o contrato do
 * `weeklyStreak` intacto para todo o resto do código.
 *
 * @param week - Array de exatamente 7 posições, índice 0 = domingo
 * @returns Novo array de 7 posições, índice 0 = segunda e índice 6 = domingo
 */
export function reorderWeekMondayFirst<T>(week: T[]): T[] {
  return [...week.slice(1), week[0]];
}

/**
 * Conta em quantos DIAS DISTINTOS dos últimos 7 (inclusive hoje) houve pelo
 * menos uma sessão encerrada. É o card "Treinos esta semana" do desktop
 * (`dashboard.py:305`), que conta dias e não sessões — treinar duas vezes no
 * mesmo dia conta como um.
 *
 * @param sessions - Array de sessões (pode ser vazio)
 * @param now - Função que retorna o instante atual (ms); injetável para testes
 * @returns Número de dias distintos treinados, entre 0 e 7
 */
export function countTrainingDaysThisWeek(
  sessions: SessionForAggregation[],
  now: () => number = Date.now,
): number {
  const nowMs = now();
  const windowStartMs = nowMs - 7 * 24 * 60 * 60 * 1000;

  const days = new Set<string>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    if (s.startedAt < windowStartMs || s.startedAt > nowMs) continue;
    const d = new Date(s.startedAt);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

/**
 * Formata um volume em kg no padrão do desktop (`dashboard.py:405`): acima de
 * 1000 vira `"12.4k"`, abaixo disso é o inteiro arredondado.
 *
 * @param volume - Volume total em kg (>= 0)
 * @returns String formatada, sem a unidade
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return String(Math.round(volume));
}

/** Início da semana (SEGUNDA, 00:00 local) que contém `timestampMs`. */
function startOfWeekMonday(timestampMs: number): number {
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);
  // getDay(): domingo=0 … sábado=6. Recuar até a segunda-feira; domingo recua 6.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

/**
 * Conta o streak em SEMANAS consecutivas com pelo menos um treino encerrado —
 * port de `_calculate_streak` (`dashboard.py:460-510`).
 *
 * A semana começa na segunda-feira. A contagem parte da semana atual e anda
 * para trás enquanto encontrar semanas consecutivas com treino. Se a semana
 * mais recente com treino for anterior à semana passada, o streak foi quebrado
 * e o resultado é 0 — treinar "semana atual" ou "semana passada" mantém vivo.
 *
 * @param sessions - Array de sessões (pode ser vazio)
 * @param now - Função que retorna o instante atual (ms); injetável para testes
 * @returns Número de semanas consecutivas (>= 0)
 */
export function computeWeekStreak(
  sessions: SessionForAggregation[],
  now: () => number = Date.now,
): number {
  const weeksWithTraining = new Set<number>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    weeksWithTraining.add(startOfWeekMonday(s.startedAt));
  }
  if (weeksWithTraining.size === 0) return 0;

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const currentWeek = startOfWeekMonday(now());
  const lastWeek = currentWeek - WEEK_MS;

  // Ponto de partida: a semana atual, se treinou nela; senão a passada, se
  // treinou nela. Qualquer coisa mais antiga significa streak quebrado.
  let cursor: number;
  if (weeksWithTraining.has(currentWeek)) {
    cursor = currentWeek;
  } else if (weeksWithTraining.has(lastWeek)) {
    cursor = lastWeek;
  } else {
    return 0;
  }

  let streak = 0;
  while (weeksWithTraining.has(cursor)) {
    streak += 1;
    cursor -= WEEK_MS;
  }
  return streak;
}

/**
 * Descrição relativa de quando uma sessão aconteceu, no padrão do desktop
 * (`dashboard.py:529`): `Hoje` / `Ontem` / `há N dias`.
 *
 * Compara DIAS DE CALENDÁRIO locais, não diferença de 24h — uma sessão às 23h
 * de ontem é "Ontem" mesmo tendo menos de 24h de idade.
 *
 * @param timestampMs - Instante da sessão (ms)
 * @param now - Função que retorna o instante atual (ms); injetável para testes
 * @returns String relativa em português
 */
export function formatRelativeDay(timestampMs: number, now: () => number = Date.now): string {
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diffDays = Math.round(
    (startOfDay(now()) - startOfDay(timestampMs)) / (24 * 60 * 60 * 1000),
  );
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return `há ${diffDays} dias`;
}
