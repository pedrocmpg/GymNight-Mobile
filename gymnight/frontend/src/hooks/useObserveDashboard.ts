/**
 * useObserveDashboard — hook de Reactive_Query para a Dashboard_Screen.
 *
 * Observa reativamente os Workouts e WorkoutSessions recentes do usuário atual,
 * lidos exclusivamente do WatermelonDB (Requirement 1.1).
 *
 * Nenhum dado de domínio é copiado para Zustand/Context (Requirement 1.2, 1.3).
 * Derivações locais (filtro/sort/group) devem ser feitas com useMemo
 * sobre os dados retornados (Requirement 1.7).
 *
 * Validates: Requirements 1.4, 1.7, 17.1
 */

import { useMemo } from 'react';
import {
  useReactiveQuery,
  type ReactiveObservable,
  type ReactiveQueryResult,
} from './useReactiveQuery';
import {
  computeAverageSessionDuration,
  computeWeeklyStreak,
  countExercisesPerWorkout,
  findLastTrainedAt,
  type SessionForAggregation,
} from './historyDomainUtils';

/**
 * Interface mínima para dados de Workout retornados pelo hook.
 */
export interface DashboardWorkout {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Nº de exercícios distintos no treino. */
  exerciseCount: number;
  /** Duração média (ms) das sessões ENCERRADAS deste treino, ou null se não há nenhuma. */
  avgSessionDurationMs: number | null;
  /** Timestamp (started_at) da sessão ENCERRADA mais recente deste treino, ou null. */
  lastTrainedAt: number | null;
}

/**
 * Interface mínima para dados de WorkoutSession retornados pelo hook.
 */
export interface DashboardWorkoutSession {
  id: string;
  userId: string;
  workoutId: string | null;
  startedAt: number;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Interface mínima de Workout crua, antes de enriquecer com campos derivados.
 */
export interface RawDashboardWorkout {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Resultado combinado do useObserveDashboard.
 */
export interface DashboardData {
  workouts: RawDashboardWorkout[];
  recentSessions: DashboardWorkoutSession[];
  workoutExercises: Array<{ workoutId: string; exerciseId: string }>;
}

/**
 * Resultado retornado pelo hook.
 */
export interface UseObserveDashboardResult {
  workouts: DashboardWorkout[];
  recentSessions: DashboardWorkoutSession[];
  /** 7 posições, índice 0 = domingo da semana atual; true = houve sessão encerrada nesse dia. */
  weeklyStreak: boolean[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Interface de database provider para injeção de dependência em testes.
 */
export interface DashboardDatabaseProvider {
  observeWorkouts(userId: string): ReactiveObservable<RawDashboardWorkout[]>;
  observeSessions(userId: string): ReactiveObservable<DashboardWorkoutSession[]>;
  observeWorkoutExercises(userId: string): ReactiveObservable<Array<{ workoutId: string; exerciseId: string }>>;
}

/**
 * Combina dois observables em um único que emite quando ambos emitiram pelo menos uma vez,
 * e re-emite quando qualquer um muda.
 */
function combineObservables<A, B>(
  obsA: ReactiveObservable<A>,
  obsB: ReactiveObservable<B>,
): ReactiveObservable<[A, B]> {
  return {
    subscribe(observer) {
      let latestA: A | undefined;
      let latestB: B | undefined;
      let hasA = false;
      let hasB = false;
      let errored = false;

      const tryEmit = () => {
        if (hasA && hasB && !errored) {
          observer.next?.([latestA as A, latestB as B]);
        }
      };

      const subA = obsA.subscribe({
        next: (value) => {
          latestA = value;
          hasA = true;
          tryEmit();
        },
        error: (err) => {
          errored = true;
          observer.error?.(err);
        },
      });

      const subB = obsB.subscribe({
        next: (value) => {
          latestB = value;
          hasB = true;
          tryEmit();
        },
        error: (err) => {
          errored = true;
          observer.error?.(err);
        },
      });

      return {
        unsubscribe: () => {
          subA.unsubscribe();
          subB.unsubscribe();
        },
      };
    },
  };
}

/**
 * Hook que observa reativamente os dados do Dashboard para um usuário.
 *
 * @param userId - ID do usuário autenticado
 * @param provider - Provider do banco (injeção de dependência para testes)
 */
export function useObserveDashboard(
  userId: string,
  provider: DashboardDatabaseProvider,
): UseObserveDashboardResult {
  const result: ReactiveQueryResult<
    [[RawDashboardWorkout[], DashboardWorkoutSession[]], Array<{ workoutId: string; exerciseId: string }>]
  > = useReactiveQuery(
    () =>
      combineObservables(
        combineObservables(provider.observeWorkouts(userId), provider.observeSessions(userId)),
        provider.observeWorkoutExercises(userId),
      ),
    [userId, provider],
  );

  const rawWorkouts = useMemo(
    () => (result.data ? result.data[0][0] : []),
    [result.data],
  );

  const recentSessions = useMemo(
    () => (result.data ? result.data[0][1] : []),
    [result.data],
  );

  const workoutExercises = useMemo(
    () => (result.data ? result.data[1] : []),
    [result.data],
  );

  // Derivações puras (Requirement 1.7): campos ricos por workout + streak semanal.
  const workouts = useMemo<DashboardWorkout[]>(() => {
    const sessionsForAgg: SessionForAggregation[] = recentSessions.map((s) => ({
      id: s.id,
      workoutId: s.workoutId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));
    const exerciseCountByWorkout = countExercisesPerWorkout(workoutExercises);

    return rawWorkouts.map((w) => ({
      ...w,
      exerciseCount: exerciseCountByWorkout.get(w.id) ?? 0,
      avgSessionDurationMs: computeAverageSessionDuration(sessionsForAgg, w.id),
      lastTrainedAt: findLastTrainedAt(sessionsForAgg, w.id),
    }));
  }, [rawWorkouts, recentSessions, workoutExercises]);

  const weeklyStreak = useMemo(() => {
    const sessionsForAgg: SessionForAggregation[] = recentSessions.map((s) => ({
      id: s.id,
      workoutId: s.workoutId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));
    return computeWeeklyStreak(sessionsForAgg);
  }, [recentSessions]);

  return {
    workouts,
    recentSessions,
    weeklyStreak,
    isLoading: result.isLoading,
    error: result.error,
  };
}
