/**
 * useObserveStatistics — hook de Reactive_Query para a Statistics_Screen
 * (Wave 7, PARIDADE-03-ESTATISTICAS.md). Nenhuma mudança de schema: consome
 * só o que a Wave 6 já criou (catálogo muscular) mais o que já existia
 * (sessões/séries/exercícios).
 *
 * Observa 5 fontes — usa `combineMany` (useReactiveQuery.ts) em vez de
 * aninhar mais um nível de `combineObservables` binário (§6: "vale
 * considerar um combineMany genérico aqui").
 *
 * Toda agregação (radar, grid 2×2, deltas) é função pura, fora do hook
 * (domainUtils.ts / historyDomainUtils.ts) — o hook só combina observables e
 * empacota o resultado.
 */

import { useMemo } from 'react';
import {
  useReactiveQuery,
  combineMany,
  type ReactiveObservable,
  type ReactiveQueryResult,
} from './useReactiveQuery';
import type { DashboardWorkoutSession } from './useObserveDashboard';
import type { CatalogExercise } from './useObserveExerciseCatalog';
import type { ActiveSessionLoggedSet } from './useObserveActiveSession';
import {
  RADAR_CATEGORIES,
  computeMuscleVolume,
  groupMuscleVolumeIntoCategories,
  type ExerciseMuscleContribution,
} from './domainUtils';
import {
  computePeriodDelta,
  computeWindowMetrics,
  partitionSessionsByWindow,
  type SessionForAggregation,
  type StatisticsWindowMetrics,
} from './historyDomainUtils';
import type { RadarSlice } from '../screens/StatisticsScreen/computeRadarGeometry';

/** Janela fixa de 30 dias — o desktop tem um seletor de período que nunca
 * chegou a ser implementado (`_get_period_days()` sempre devolve 30). */
const WINDOW_DAYS = 30;

export interface MuscleGroupRow {
  id: string;
  name: string;
}

export interface StatisticsDatabaseProvider {
  observeAllSessions(userId: string): ReactiveObservable<DashboardWorkoutSession[]>;
  observeAllLoggedSets(userId: string): ReactiveObservable<ActiveSessionLoggedSet[]>;
  observeExercises(): ReactiveObservable<CatalogExercise[]>;
  /** Catálogo compartilhado (Wave 6), pull-only. */
  observeExerciseMuscleMap(): ReactiveObservable<ExerciseMuscleContribution[]>;
  /** Catálogo compartilhado (Wave 6), pull-only — 7 linhas fixas. */
  observeMuscleGroups(): ReactiveObservable<MuscleGroupRow[]>;
}

/** Uma métrica do grid 2×2, já com o delta período-contra-período calculado. */
export interface StatisticsMetric {
  value: number;
  deltaPct: number;
}

export interface UseObserveStatisticsResult {
  /** 6 fatias (Peito/Costas/Ombros/Braços/Pernas/Core), volume dos últimos 30 dias. */
  radarSlices: RadarSlice[];
  sessionCount: StatisticsMetric;
  totalDurationMs: StatisticsMetric;
  totalVolume: StatisticsMetric;
  totalSets: StatisticsMetric;
  isLoading: boolean;
  error: Error | null;
}

function metricWithDelta(current: number, previous: number): StatisticsMetric {
  return { value: current, deltaPct: computePeriodDelta(current, previous) };
}

/**
 * Hook que observa reativamente os dados de Estatísticas de um usuário.
 *
 * @param userId - ID do usuário autenticado
 * @param provider - Provider do banco (injeção de dependência para testes)
 * @param now - função que retorna o instante atual (ms); injetável para testes
 */
export function useObserveStatistics(
  userId: string,
  provider: StatisticsDatabaseProvider,
  now: () => number = Date.now,
): UseObserveStatisticsResult {
  const result: ReactiveQueryResult<
    readonly [
      DashboardWorkoutSession[],
      ActiveSessionLoggedSet[],
      CatalogExercise[],
      ExerciseMuscleContribution[],
      MuscleGroupRow[],
    ]
  > = useReactiveQuery(
    () =>
      combineMany([
        provider.observeAllSessions(userId),
        provider.observeAllLoggedSets(userId),
        provider.observeExercises(),
        provider.observeExerciseMuscleMap(),
        provider.observeMuscleGroups(),
      ] as const),
    [userId, provider],
  );

  const sessions = useMemo(() => result.data?.[0] ?? [], [result.data]);
  const loggedSets = useMemo(() => result.data?.[1] ?? [], [result.data]);
  const exercises = useMemo(() => result.data?.[2] ?? [], [result.data]);
  const exerciseMuscleMap = useMemo(() => result.data?.[3] ?? [], [result.data]);
  const muscleGroups = useMemo(() => result.data?.[4] ?? [], [result.data]);

  const sessionsForAgg = useMemo<SessionForAggregation[]>(
    () =>
      sessions.map((s) => ({
        id: s.id,
        workoutId: s.workoutId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
      })),
    [sessions],
  );

  const { current: currentSessions, previous: previousSessions } = useMemo(
    () => partitionSessionsByWindow(sessionsForAgg, WINDOW_DAYS, now),
    [sessionsForAgg, now],
  );

  const loggedSetsBySessionId = useMemo(() => {
    const map = new Map<string, ActiveSessionLoggedSet[]>();
    for (const set of loggedSets) {
      const bucket = map.get(set.sessionId);
      if (bucket) {
        bucket.push(set);
      } else {
        map.set(set.sessionId, [set]);
      }
    }
    return map;
  }, [loggedSets]);

  const currentMetrics = useMemo<StatisticsWindowMetrics>(
    () => computeWindowMetrics(currentSessions, loggedSetsBySessionId),
    [currentSessions, loggedSetsBySessionId],
  );
  const previousMetrics = useMemo<StatisticsWindowMetrics>(
    () => computeWindowMetrics(previousSessions, loggedSetsBySessionId),
    [previousSessions, loggedSetsBySessionId],
  );

  const radarSlices = useMemo<RadarSlice[]>(() => {
    // Só exercícios ainda no catálogo (defensivo, mesmo espírito de
    // useObserveHistory) — evita ativação muscular de exercício removido.
    const catalogExerciseIds = new Set(exercises.map((e) => e.id));

    const currentSessionIds = new Set(currentSessions.map((s) => s.id));
    const currentLoggedSets = loggedSets.filter(
      (s) => currentSessionIds.has(s.sessionId) && catalogExerciseIds.has(s.exerciseId),
    );

    const volumeByMuscleGroupId = computeMuscleVolume(currentLoggedSets, exerciseMuscleMap);
    const muscleGroupNameById = new Map(muscleGroups.map((g) => [g.id, g.name]));
    const volumeByCategory = groupMuscleVolumeIntoCategories(
      volumeByMuscleGroupId,
      muscleGroupNameById,
    );

    return RADAR_CATEGORIES.map((category) => ({
      label: category,
      value: volumeByCategory.get(category) ?? 0,
    }));
  }, [loggedSets, currentSessions, exercises, exerciseMuscleMap, muscleGroups]);

  return {
    radarSlices,
    sessionCount: metricWithDelta(currentMetrics.sessionCount, previousMetrics.sessionCount),
    totalDurationMs: metricWithDelta(
      currentMetrics.totalDurationMs,
      previousMetrics.totalDurationMs,
    ),
    totalVolume: metricWithDelta(currentMetrics.totalVolume, previousMetrics.totalVolume),
    totalSets: metricWithDelta(currentMetrics.totalSets, previousMetrics.totalSets),
    isLoading: result.isLoading,
    error: result.error,
  };
}
