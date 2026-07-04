/**
 * useObserveActiveSession — hook de Reactive_Query para a Active_Session_Screen.
 *
 * Observa reativamente uma WorkoutSession e seus LoggedSets por sessionId,
 * lidos exclusivamente do WatermelonDB (Requirement 1.1).
 *
 * Nenhum dado de domínio é copiado para Zustand/Context (Requirement 1.2, 1.3).
 * Derivações locais (Volume, max1RM) são feitas com useMemo
 * sobre os dados retornados (Requirement 1.7).
 *
 * Validates: Requirements 1.4, 1.7, 17.1, 18.4, 19.6
 */

import { useMemo } from 'react';
import {
  useReactiveQuery,
  type ReactiveObservable,
  type ReactiveQueryResult,
} from './useReactiveQuery';
import { computeVolume, maxOneRmPerExercise, type LoggedSetForCalc } from './domainUtils';

/**
 * Interface mínima para dados de WorkoutSession retornados pelo hook.
 */
export interface ActiveSession {
  id: string;
  userId: string;
  workoutId: string | null;
  startedAt: number;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Interface mínima para dados de LoggedSet retornados pelo hook.
 */
export interface ActiveSessionLoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  weight: number;
  repetitions: number;
  estimatedOneRm: number;
  completedAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Dados combinados da sessão ativa (session + loggedSets).
 */
export interface ActiveSessionData {
  session: ActiveSession;
  loggedSets: ActiveSessionLoggedSet[];
}

/**
 * Resultado retornado pelo hook useObserveActiveSession.
 */
export interface UseObserveActiveSessionResult {
  session: ActiveSession | null;
  loggedSets: ActiveSessionLoggedSet[];
  totalVolume: number;
  maxOneRmByExercise: Map<string, number>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Interface de database provider para injeção de dependência em testes.
 */
export interface ActiveSessionDatabaseProvider {
  observeSession(sessionId: string): ReactiveObservable<ActiveSession>;
  observeLoggedSets(sessionId: string): ReactiveObservable<ActiveSessionLoggedSet[]>;
}

/**
 * Combina dois observables (session e loggedSets) em um único que emite
 * quando ambos emitiram pelo menos uma vez, e re-emite quando qualquer um muda.
 */
function combineSessionObservables(
  obsSession: ReactiveObservable<ActiveSession>,
  obsLoggedSets: ReactiveObservable<ActiveSessionLoggedSet[]>,
): ReactiveObservable<ActiveSessionData> {
  return {
    subscribe(observer) {
      let latestSession: ActiveSession | undefined;
      let latestLoggedSets: ActiveSessionLoggedSet[] | undefined;
      let hasSession = false;
      let hasLoggedSets = false;
      let errored = false;

      const tryEmit = () => {
        if (hasSession && hasLoggedSets && !errored) {
          observer.next?.({
            session: latestSession as ActiveSession,
            loggedSets: latestLoggedSets as ActiveSessionLoggedSet[],
          });
        }
      };

      const subSession = obsSession.subscribe({
        next: (value) => {
          latestSession = value;
          hasSession = true;
          tryEmit();
        },
        error: (err) => {
          errored = true;
          observer.error?.(err);
        },
      });

      const subLoggedSets = obsLoggedSets.subscribe({
        next: (value) => {
          latestLoggedSets = value;
          hasLoggedSets = true;
          tryEmit();
        },
        error: (err) => {
          errored = true;
          observer.error?.(err);
        },
      });

      return {
        unsubscribe: () => {
          subSession.unsubscribe();
          subLoggedSets.unsubscribe();
        },
      };
    },
  };
}

/**
 * Hook que observa reativamente uma sessão ativa e seus LoggedSets.
 *
 * Retorna a sessão, os loggedSets, o volume total computado e o max 1RM por exercício.
 * Todas as derivações usam useMemo (Requirement 1.7).
 *
 * @param sessionId - ID da sessão ativa a observar
 * @param provider - Provider do banco (injeção de dependência para testes)
 */
export function useObserveActiveSession(
  sessionId: string,
  provider: ActiveSessionDatabaseProvider,
): UseObserveActiveSessionResult {
  const result: ReactiveQueryResult<ActiveSessionData> = useReactiveQuery(
    () =>
      combineSessionObservables(
        provider.observeSession(sessionId),
        provider.observeLoggedSets(sessionId),
      ),
    [sessionId, provider],
  );

  // Derivações usando useMemo sobre a emissão (Requirement 1.7)
  const session = useMemo(
    () => (result.data ? result.data.session : null),
    [result.data],
  );

  const loggedSets = useMemo(
    () => (result.data ? result.data.loggedSets : []),
    [result.data],
  );

  // Volume total = soma(weight * repetitions) de todos os LoggedSets (Requirement 19.6)
  const totalVolume = useMemo(
    () => computeVolume(loggedSets as LoggedSetForCalc[]),
    [loggedSets],
  );

  // Maior estimated_one_rm por exercício (Requirement 19.6)
  const maxOneRmByExercise = useMemo(
    () => maxOneRmPerExercise(loggedSets as LoggedSetForCalc[]),
    [loggedSets],
  );

  return {
    session,
    loggedSets,
    totalVolume,
    maxOneRmByExercise,
    isLoading: result.isLoading,
    error: result.error,
  };
}
