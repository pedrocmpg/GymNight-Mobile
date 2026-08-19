/**
 * useObserveHistory — hook de Reactive_Query para a Progress_Screen.
 *
 * Observa reativamente todas as sessões, logged_sets e o catálogo de exercícios
 * do usuário, lidos exclusivamente do WatermelonDB (Requirement 1.1).
 *
 * Nenhum dado de domínio é copiado para Zustand/Context (Requirement 1.2, 1.3).
 * Derivações locais (série temporal de 1RM, resumos de sessão) são feitas com
 * useMemo sobre os dados retornados (Requirement 1.7).
 *
 * Seleção do exercício ativo (chip) e detecção de PR do exercício selecionado
 * ficam como estado local do ProgressScreenContainer, não deste hook — mesmo
 * padrão do exercise picker em useObserveActiveSession (hook só observa/deriva
 * dados brutos, não estado de UI).
 */

import { useMemo } from 'react';
import { useReactiveQuery, type ReactiveObservable, type ReactiveQueryResult } from './useReactiveQuery';
import type { DashboardWorkoutSession } from './useObserveDashboard';
import type { CatalogExercise } from './useObserveExerciseCatalog';
import type { ActiveSessionLoggedSet } from './useObserveActiveSession';
import {
  buildOneRmTimeSeries,
  buildRecentSessionSummaries,
  type OneRmDataPoint,
  type SessionForAggregation,
  type SessionSummary,
} from './historyDomainUtils';

export interface UseObserveHistoryResult {
  exercises: CatalogExercise[];
  sessions: SessionSummary[];
  oneRmSeriesByExercise: Map<string, OneRmDataPoint[]>;
  isLoading: boolean;
  error: Error | null;
}

export interface HistoryDatabaseProvider {
  observeAllSessions(userId: string): ReactiveObservable<DashboardWorkoutSession[]>;
  observeAllLoggedSets(userId: string): ReactiveObservable<ActiveSessionLoggedSet[]>;
  observeExercises(): ReactiveObservable<CatalogExercise[]>;
  observeWorkoutNames(userId: string): ReactiveObservable<Array<{ id: string; name: string }>>;
}

interface HistoryData {
  sessions: DashboardWorkoutSession[];
  loggedSets: ActiveSessionLoggedSet[];
  exercises: CatalogExercise[];
  workoutNames: Array<{ id: string; name: string }>;
}

/**
 * Combina 4 observables em um único que emite quando todos emitiram pelo menos
 * uma vez, e re-emite quando qualquer um muda. Mesmo invariante de
 * combineObservables (useObserveDashboard) e combineSessionObservables
 * (useObserveActiveSession), generalizado para 4 fontes.
 */
/**
 * Exported for testing (Property 55) — the emit-only-when-all-sources-emitted
 * and error-propagation invariants are direct properties of this function.
 */
export function combineHistoryObservables(
  obsSessions: ReactiveObservable<DashboardWorkoutSession[]>,
  obsLoggedSets: ReactiveObservable<ActiveSessionLoggedSet[]>,
  obsExercises: ReactiveObservable<CatalogExercise[]>,
  obsWorkoutNames: ReactiveObservable<Array<{ id: string; name: string }>>,
): ReactiveObservable<HistoryData> {
  return {
    subscribe(observer) {
      let latestSessions: DashboardWorkoutSession[] | undefined;
      let latestLoggedSets: ActiveSessionLoggedSet[] | undefined;
      let latestExercises: CatalogExercise[] | undefined;
      let latestWorkoutNames: Array<{ id: string; name: string }> | undefined;
      let hasSessions = false;
      let hasLoggedSets = false;
      let hasExercises = false;
      let hasWorkoutNames = false;
      let errored = false;

      const tryEmit = () => {
        if (hasSessions && hasLoggedSets && hasExercises && hasWorkoutNames && !errored) {
          observer.next?.({
            sessions: latestSessions as DashboardWorkoutSession[],
            loggedSets: latestLoggedSets as ActiveSessionLoggedSet[],
            exercises: latestExercises as CatalogExercise[],
            workoutNames: latestWorkoutNames as Array<{ id: string; name: string }>,
          });
        }
      };

      const onError = (err: unknown) => {
        errored = true;
        observer.error?.(err);
      };

      const subSessions = obsSessions.subscribe({
        next: (v) => {
          latestSessions = v;
          hasSessions = true;
          tryEmit();
        },
        error: onError,
      });
      const subLoggedSets = obsLoggedSets.subscribe({
        next: (v) => {
          latestLoggedSets = v;
          hasLoggedSets = true;
          tryEmit();
        },
        error: onError,
      });
      const subExercises = obsExercises.subscribe({
        next: (v) => {
          latestExercises = v;
          hasExercises = true;
          tryEmit();
        },
        error: onError,
      });
      const subWorkoutNames = obsWorkoutNames.subscribe({
        next: (v) => {
          latestWorkoutNames = v;
          hasWorkoutNames = true;
          tryEmit();
        },
        error: onError,
      });

      return {
        unsubscribe: () => {
          subSessions.unsubscribe();
          subLoggedSets.unsubscribe();
          subExercises.unsubscribe();
          subWorkoutNames.unsubscribe();
        },
      };
    },
  };
}

/**
 * Hook que observa reativamente os dados de histórico/progresso de um usuário.
 *
 * @param userId - ID do usuário autenticado
 * @param provider - Provider do banco (injeção de dependência para testes)
 */
export function useObserveHistory(
  userId: string,
  provider: HistoryDatabaseProvider,
): UseObserveHistoryResult {
  const result: ReactiveQueryResult<HistoryData> = useReactiveQuery(
    () =>
      combineHistoryObservables(
        provider.observeAllSessions(userId),
        provider.observeAllLoggedSets(userId),
        provider.observeExercises(),
        provider.observeWorkoutNames(userId),
      ),
    [userId, provider],
  );

  const sessions = useMemo(
    () => (result.data ? result.data.sessions : []),
    [result.data],
  );
  const loggedSets = useMemo(
    () => (result.data ? result.data.loggedSets : []),
    [result.data],
  );
  const exercises = useMemo(
    () => (result.data ? result.data.exercises : []),
    [result.data],
  );
  const workoutNames = useMemo(
    () => (result.data ? result.data.workoutNames : []),
    [result.data],
  );

  const oneRmSeriesByExercise = useMemo(() => {
    const map = new Map<string, OneRmDataPoint[]>();
    for (const exercise of exercises) {
      map.set(exercise.id, buildOneRmTimeSeries(loggedSets, exercise.id));
    }
    return map;
  }, [loggedSets, exercises]);

  const sessionSummaries = useMemo(() => {
    const sessionsForAgg: SessionForAggregation[] = sessions.map((s) => ({
      id: s.id,
      workoutId: s.workoutId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));
    const workoutNamesById = new Map(workoutNames.map((w) => [w.id, w.name]));
    const loggedSetsBySessionId = new Map<string, ActiveSessionLoggedSet[]>();
    for (const set of loggedSets) {
      const existing = loggedSetsBySessionId.get(set.sessionId) ?? [];
      existing.push(set);
      loggedSetsBySessionId.set(set.sessionId, existing);
    }
    return buildRecentSessionSummaries(sessionsForAgg, workoutNamesById, loggedSetsBySessionId);
  }, [sessions, loggedSets, workoutNames]);

  return {
    exercises,
    sessions: sessionSummaries,
    oneRmSeriesByExercise,
    isLoading: result.isLoading,
    error: result.error,
  };
}
