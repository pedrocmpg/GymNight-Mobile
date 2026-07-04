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

/**
 * Interface mínima para dados de Workout retornados pelo hook.
 */
export interface DashboardWorkout {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
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
 * Resultado combinado do useObserveDashboard.
 */
export interface DashboardData {
  workouts: DashboardWorkout[];
  recentSessions: DashboardWorkoutSession[];
}

/**
 * Resultado retornado pelo hook.
 */
export interface UseObserveDashboardResult {
  workouts: DashboardWorkout[];
  recentSessions: DashboardWorkoutSession[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Interface de database provider para injeção de dependência em testes.
 */
export interface DashboardDatabaseProvider {
  observeWorkouts(userId: string): ReactiveObservable<DashboardWorkout[]>;
  observeSessions(userId: string): ReactiveObservable<DashboardWorkoutSession[]>;
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
  const result: ReactiveQueryResult<[DashboardWorkout[], DashboardWorkoutSession[]]> =
    useReactiveQuery(
      () =>
        combineObservables(
          provider.observeWorkouts(userId),
          provider.observeSessions(userId),
        ),
      [userId, provider],
    );

  // Derivações usando useMemo sobre a emissão (Requirement 1.7)
  const workouts = useMemo(
    () => (result.data ? result.data[0] : []),
    [result.data],
  );

  const recentSessions = useMemo(
    () => (result.data ? result.data[1] : []),
    [result.data],
  );

  return {
    workouts,
    recentSessions,
    isLoading: result.isLoading,
    error: result.error,
  };
}
