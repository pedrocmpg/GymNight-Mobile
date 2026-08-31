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
  workoutExercises: WorkoutExerciseOption[];
  /** Séries da última sessão encerrada deste treino (base do fantasma da grade). */
  previousSessionSets: ActiveSessionLoggedSet[];
  /** Nome do treino da sessão; null em treino livre ou enquanto não carregou. */
  workoutName: string | null;
  isLoading: boolean;
  error: Error | null;
}

/** Observable that emits an empty list once — used when there's no workoutId to scope by. */
const EMPTY_WORKOUT_EXERCISES: ReactiveObservable<WorkoutExerciseOption[]> = {
  subscribe(observer) {
    observer.next?.([]);
    return { unsubscribe: () => {} };
  },
};

/** Fallback para o nome do treino quando a sessão é livre. */
const EMPTY_WORKOUT_NAME: ReactiveObservable<string | null> = {
  subscribe(observer) {
    observer.next?.(null);
    return { unsubscribe: () => {} };
  },
};

/** Mesmo fallback vazio, para as séries da sessão anterior. */
const EMPTY_PREVIOUS_SETS: ReactiveObservable<ActiveSessionLoggedSet[]> = {
  subscribe(observer) {
    observer.next?.([]);
    return { unsubscribe: () => {} };
  },
};

/**
 * Exercício associado a um Workout (via WorkoutExercise), usado para restringir
 * o picker da Active_Session_Screen aos exercícios do treino em andamento.
 *
 * Os três alvos (`seriesTarget`/`repsTarget`/`weightTarget`) são gravados pelo
 * WorkoutCreatorScreen desde sempre, mas até a Wave 4 nenhum leitor os expunha —
 * a grade de séries do treino ativo é o primeiro consumidor.
 */
export interface WorkoutExerciseOption {
  id: string;
  name: string;
  seriesTarget: number;
  repsTarget: number;
  weightTarget: number;
}

/**
 * Interface de database provider para injeção de dependência em testes.
 */
export interface ActiveSessionDatabaseProvider {
  observeSession(sessionId: string): ReactiveObservable<ActiveSession>;
  observeLoggedSets(sessionId: string): ReactiveObservable<ActiveSessionLoggedSet[]>;
  observeWorkoutExercises(workoutId: string): ReactiveObservable<WorkoutExerciseOption[]>;
  /**
   * Séries da última sessão ENCERRADA do mesmo treino, excluindo a sessão atual.
   * Alimentam o valor "fantasma" da grade. Opcional: um provider que não a
   * implemente simplesmente não mostra fantasma (a grade cai nos alvos).
   */
  /** Nome do treino da sessão, para o título. Opcional. */
  observeWorkoutName?(workoutId: string): ReactiveObservable<string | null>;
  observePreviousSessionSets?(
    workoutId: string,
    currentSessionId: string,
  ): ReactiveObservable<ActiveSessionLoggedSet[]>;
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

  // Exercícios do treino associado à sessão, para restringir o picker (fallback: lista vazia
  // quando a sessão é freestyle/não tem workoutId — quem chama o hook decide o fallback de catálogo).
  const workoutId = session?.workoutId ?? null;
  const workoutExercisesResult = useReactiveQuery(
    () => (workoutId ? provider.observeWorkoutExercises(workoutId) : EMPTY_WORKOUT_EXERCISES),
    [workoutId, provider],
  );
  const workoutExercises = useMemo(
    () => workoutExercisesResult.data ?? [],
    [workoutExercisesResult.data],
  );

  // Séries da última sessão encerrada do mesmo treino — origem do fantasma.
  const previousSetsResult = useReactiveQuery(
    () =>
      workoutId && provider.observePreviousSessionSets
        ? provider.observePreviousSessionSets(workoutId, sessionId)
        : EMPTY_PREVIOUS_SETS,
    [workoutId, sessionId, provider],
  );
  const previousSessionSets = useMemo(
    () => previousSetsResult.data ?? [],
    [previousSetsResult.data],
  );

  const workoutNameResult = useReactiveQuery(
    () =>
      workoutId && provider.observeWorkoutName
        ? provider.observeWorkoutName(workoutId)
        : EMPTY_WORKOUT_NAME,
    [workoutId, provider],
  );
  const workoutName = workoutNameResult.data ?? null;

  return {
    session,
    loggedSets,
    totalVolume,
    maxOneRmByExercise,
    workoutExercises,
    previousSessionSets,
    workoutName,
    isLoading: result.isLoading,
    error: result.error,
  };
}
