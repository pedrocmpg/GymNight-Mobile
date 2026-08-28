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
  buildRecentSessionSummaries,
  computeAverageSessionDuration,
  computeWeekStreak,
  computeWeeklyStreak,
  countExercisesPerWorkout,
  countTrainingDaysThisWeek,
  findLastTrainedAt,
  type SessionForAggregation,
  type SessionSummary,
} from './historyDomainUtils';
import { computeVolume, type LoggedSetForCalc } from './domainUtils';

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
 * Perfil do usuário exibido no hero do Dashboard. Todos os campos além do nome
 * são opcionais no schema (`users` tem weight/height como isOptional).
 */
export interface DashboardUserProfile {
  id: string;
  name: string;
  weight: number | null;
  height: number | null;
}

/** Série registrada, no mínimo necessário para as agregações do Dashboard. */
export interface DashboardLoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  weight: number;
  repetitions: number;
  estimatedOneRm: number;
}

/**
 * Métricas agregadas dos quatro StatCards do Dashboard.
 *
 * O desktop tem um quarto card de "Calorias queimadas" (dashboard.py:434), que
 * depende da tabela `exercise_met_values` — inexistente no backend do mobile.
 * Substituído por `totalSets`.
 */
export interface DashboardStats {
  /** Dias distintos treinados nos últimos 7. */
  trainingDaysThisWeek: number;
  /** Σ(peso × reps) de todas as séries do usuário. */
  totalVolume: number;
  /** Total de séries registradas. */
  totalSets: number;
  /** Semanas consecutivas com ao menos um treino encerrado. */
  weekStreak: number;
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
  loggedSets: DashboardLoggedSet[];
  profile: DashboardUserProfile | null;
}

/**
 * Resultado retornado pelo hook.
 */
export interface UseObserveDashboardResult {
  workouts: DashboardWorkout[];
  recentSessions: DashboardWorkoutSession[];
  /** 7 posições, índice 0 = domingo da semana atual; true = houve sessão encerrada nesse dia. */
  weeklyStreak: boolean[];
  /** Perfil do usuário para o hero, ou null enquanto não carregou / não existe. */
  profile: DashboardUserProfile | null;
  /** Métricas dos StatCards. */
  stats: DashboardStats;
  /** Últimas sessões ENCERRADAS, mais recente primeiro (limitado a `recentLimit`). */
  recentSummaries: SessionSummary[];
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
  /** Todas as séries do usuário (join client-side via as sessões dele). */
  observeLoggedSets(userId: string): ReactiveObservable<DashboardLoggedSet[]>;
  /** Perfil do usuário; emite null se o registro ainda não existe localmente. */
  observeProfile(userId: string): ReactiveObservable<DashboardUserProfile | null>;
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
 * @param recentLimit - Quantas sessões recentes trazer para o card "Treinos recentes"
 */
export function useObserveDashboard(
  userId: string,
  provider: DashboardDatabaseProvider,
  recentLimit = 5,
): UseObserveDashboardResult {
  // combineObservables é binário, então as cinco fontes entram como pares
  // aninhados. A desestruturação logo abaixo devolve a leitura ao plano.
  const result: ReactiveQueryResult<
    [
      [
        [RawDashboardWorkout[], DashboardWorkoutSession[]],
        Array<{ workoutId: string; exerciseId: string }>,
      ],
      [DashboardLoggedSet[], DashboardUserProfile | null],
    ]
  > = useReactiveQuery(
    () =>
      combineObservables(
        combineObservables(
          combineObservables(provider.observeWorkouts(userId), provider.observeSessions(userId)),
          provider.observeWorkoutExercises(userId),
        ),
        combineObservables(provider.observeLoggedSets(userId), provider.observeProfile(userId)),
      ),
    [userId, provider],
  );

  const rawWorkouts = useMemo(() => (result.data ? result.data[0][0][0] : []), [result.data]);

  const recentSessions = useMemo(() => (result.data ? result.data[0][0][1] : []), [result.data]);

  const workoutExercises = useMemo(() => (result.data ? result.data[0][1] : []), [result.data]);

  const loggedSets = useMemo(() => (result.data ? result.data[1][0] : []), [result.data]);

  const profile = useMemo(() => (result.data ? result.data[1][1] : null), [result.data]);

  // Forma canônica das sessões para as agregações puras — computada uma vez e
  // reaproveitada por todos os useMemo abaixo.
  const sessionsForAgg = useMemo<SessionForAggregation[]>(
    () =>
      recentSessions.map((s) => ({
        id: s.id,
        workoutId: s.workoutId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
      })),
    [recentSessions],
  );

  // Derivações puras (Requirement 1.7): campos ricos por workout + streak semanal.
  const workouts = useMemo<DashboardWorkout[]>(() => {
    const exerciseCountByWorkout = countExercisesPerWorkout(workoutExercises);

    return rawWorkouts.map((w) => ({
      ...w,
      exerciseCount: exerciseCountByWorkout.get(w.id) ?? 0,
      avgSessionDurationMs: computeAverageSessionDuration(sessionsForAgg, w.id),
      lastTrainedAt: findLastTrainedAt(sessionsForAgg, w.id),
    }));
  }, [rawWorkouts, sessionsForAgg, workoutExercises]);

  const weeklyStreak = useMemo(() => computeWeeklyStreak(sessionsForAgg), [sessionsForAgg]);

  const stats = useMemo<DashboardStats>(
    () => ({
      trainingDaysThisWeek: countTrainingDaysThisWeek(sessionsForAgg),
      totalVolume: computeVolume(loggedSets),
      totalSets: loggedSets.length,
      weekStreak: computeWeekStreak(sessionsForAgg),
    }),
    [sessionsForAgg, loggedSets],
  );

  const recentSummaries = useMemo<SessionSummary[]>(() => {
    const workoutNamesById = new Map(rawWorkouts.map((w) => [w.id, w.name]));

    const setsBySessionId = new Map<string, LoggedSetForCalc[]>();
    for (const set of loggedSets) {
      const bucket = setsBySessionId.get(set.sessionId);
      if (bucket) {
        bucket.push(set);
      } else {
        setsBySessionId.set(set.sessionId, [set]);
      }
    }

    // "Treinos recentes" lista apenas sessões concluídas — a sessão em
    // andamento aparece na Active_Session_Screen, não no histórico.
    return buildRecentSessionSummaries(
      sessionsForAgg.filter((s) => s.endedAt !== null),
      workoutNamesById,
      setsBySessionId,
      recentLimit,
    );
  }, [sessionsForAgg, loggedSets, rawWorkouts, recentLimit]);

  return {
    workouts,
    recentSessions,
    weeklyStreak,
    profile,
    stats,
    recentSummaries,
    isLoading: result.isLoading,
    error: result.error,
  };
}
