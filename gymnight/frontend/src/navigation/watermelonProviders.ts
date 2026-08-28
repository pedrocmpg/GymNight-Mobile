import { Q, type Database } from '@nozbe/watermelondb';
import type { ReactiveObservable } from '../hooks/useReactiveQuery';
import type {
  DashboardDatabaseProvider,
  DashboardLoggedSet,
  DashboardUserProfile,
  DashboardWorkout,
  DashboardWorkoutSession,
} from '../hooks/useObserveDashboard';
import type { ExerciseCatalogDatabaseProvider, CatalogExercise } from '../hooks/useObserveExerciseCatalog';
import type {
  ActiveSessionDatabaseProvider,
  ActiveSession,
  ActiveSessionLoggedSet,
  WorkoutExerciseOption,
} from '../hooks/useObserveActiveSession';
import type { HistoryDatabaseProvider } from '../hooks/useObserveHistory';

function mapObservable<TRecord, TMapped>(
  source: { subscribe: (observer: { next?: (v: TRecord) => void; error?: (e: unknown) => void }) => { unsubscribe(): void } },
  mapper: (value: TRecord) => TMapped
): ReactiveObservable<TMapped> {
  return {
    subscribe(observer) {
      return source.subscribe({
        next: (value) => observer.next?.(mapper(value)),
        error: (err) => observer.error?.(err),
      });
    },
  };
}

/**
 * Registro cru de `logged_sets` como o WatermelonDB devolve — id no topo e as
 * colunas em `_raw`. Evita propagar `any` pelo helper compartilhado abaixo.
 */
interface LoggedSetRecord {
  id: string;
  _raw: {
    session_id: string;
    exercise_id: string;
    weight: number;
    repetitions: number;
    estimated_one_rm: number;
    completed_at: number;
    created_at: number;
    updated_at: number;
  };
}

/**
 * Observa todos os logged_sets de um usuário.
 *
 * `logged_sets` não tem `user_id` — o vínculo é via `session_id`. Como o repo
 * evita `Q.on()` (sem precedente no mock de teste), a consulta é um join
 * client-side: observa as sessões do usuário e, para cada uma, mantém uma
 * subscrição aos seus logged_sets, recombinando a cada emissão.
 *
 * Compartilhado entre o Dashboard e o Progress — antes vivia duplicado dentro
 * de createHistoryDatabaseProvider.
 */
function observeLoggedSetsForUser(
  db: Database,
  userId: string,
): ReactiveObservable<LoggedSetRecord[]> {
  const sessionsQuery = db.get('workout_sessions').query(Q.where('user_id', userId));

  return {
    subscribe(observer) {
      let sessionSubs: Array<{ unsubscribe: () => void }> = [];
      let latestBySessionId = new Map<string, LoggedSetRecord[]>();
      let errored = false;

      const emit = () => {
        if (errored) return;
        const all: LoggedSetRecord[] = [];
        for (const records of latestBySessionId.values()) {
          for (const r of records) all.push(r);
        }
        observer.next?.(all);
      };

      const subSessions = sessionsQuery.observe().subscribe({
        next: (sessions) => {
          sessionSubs.forEach((s) => s.unsubscribe());
          sessionSubs = [];
          latestBySessionId = new Map();

          if (sessions.length === 0) {
            emit();
            return;
          }

          for (const session of sessions) {
            const loggedSetsQuery = db.get('logged_sets').query(Q.where('session_id', session.id));
            const sub = loggedSetsQuery.observe().subscribe({
              next: (records) => {
                latestBySessionId.set(session.id, records as unknown as LoggedSetRecord[]);
                emit();
              },
              error: (err: unknown) => {
                errored = true;
                observer.error?.(err);
              },
            });
            sessionSubs.push(sub);
          }
        },
        error: (err: unknown) => {
          errored = true;
          observer.error?.(err);
        },
      });

      return {
        unsubscribe: () => {
          subSessions.unsubscribe();
          sessionSubs.forEach((s) => s.unsubscribe());
        },
      };
    },
  };
}

/** Concrete DashboardDatabaseProvider backed by WatermelonDB (Requirement 5.3). */
export function createDashboardDatabaseProvider(db: Database): DashboardDatabaseProvider {
  return {
    observeWorkouts(userId: string): ReactiveObservable<DashboardWorkout[]> {
      const query = db.get('workouts').query(Q.where('user_id', userId));
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({
          id: r.id,
          userId: r._raw.user_id,
          name: r._raw.name,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        }))
      );
    },
    observeSessions(userId: string): ReactiveObservable<DashboardWorkoutSession[]> {
      const query = db.get('workout_sessions').query(Q.where('user_id', userId));
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({
          id: r.id,
          userId: r._raw.user_id,
          workoutId: r._raw.workout_id ?? null,
          startedAt: r._raw.started_at,
          endedAt: r._raw.ended_at ?? null,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        }))
      );
    },
    observeWorkoutExercises(userId: string): ReactiveObservable<Array<{ workoutId: string; exerciseId: string }>> {
      // Escopado ao usuário via join client-side: observa os workouts do usuário e,
      // para cada emissão, busca todos os workout_exercises e filtra pelos workoutIds
      // do usuário — evita depender de Q.on() (sem precedente no código/mock de teste).
      const workoutsQuery = db.get('workouts').query(Q.where('user_id', userId));
      const workoutExercisesQuery = db.get('workout_exercises').query();

      return {
        subscribe(observer) {
          let latestWorkoutIds: Set<string> | undefined;
          let latestRows: any[] | undefined;
          let errored = false;

          const tryEmit = () => {
            if (!latestWorkoutIds || !latestRows || errored) return;
            const workoutIds = latestWorkoutIds;
            observer.next?.(
              latestRows
                .filter((r) => workoutIds.has(r._raw.workout_id))
                .map((r) => ({ workoutId: r._raw.workout_id, exerciseId: r._raw.exercise_id })),
            );
          };

          const subWorkouts = workoutsQuery.observe().subscribe({
            next: (records: any[]) => {
              latestWorkoutIds = new Set(records.map((r) => r.id));
              tryEmit();
            },
            error: (err: unknown) => {
              errored = true;
              observer.error?.(err);
            },
          });

          const subWorkoutExercises = workoutExercisesQuery.observe().subscribe({
            next: (records: any[]) => {
              latestRows = records;
              tryEmit();
            },
            error: (err: unknown) => {
              errored = true;
              observer.error?.(err);
            },
          });

          return {
            unsubscribe: () => {
              subWorkouts.unsubscribe();
              subWorkoutExercises.unsubscribe();
            },
          };
        },
      };
    },
    observeLoggedSets(userId: string): ReactiveObservable<DashboardLoggedSet[]> {
      return mapObservable(observeLoggedSetsForUser(db, userId), (records) =>
        records.map((r) => ({
          id: r.id,
          sessionId: r._raw.session_id,
          exerciseId: r._raw.exercise_id,
          weight: r._raw.weight,
          repetitions: r._raw.repetitions,
          estimatedOneRm: r._raw.estimated_one_rm,
        })),
      );
    },
    observeProfile(userId: string): ReactiveObservable<DashboardUserProfile | null> {
      // Consulta por id em vez de .find(): `find` rejeita quando o registro
      // ainda não chegou pelo sync, e o hero precisa apenas degradar para null.
      const query = db.get('users').query(Q.where('id', userId));
      return mapObservable(query.observe(), (records: any[]) => {
        const r = records[0];
        if (!r) return null;
        return {
          id: r.id,
          name: r._raw.name,
          weight: r._raw.weight ?? null,
          height: r._raw.height ?? null,
        };
      });
    },
  };
}

/** Concrete HistoryDatabaseProvider backed by WatermelonDB (Progress screen). */
export function createHistoryDatabaseProvider(db: Database): HistoryDatabaseProvider {
  return {
    observeAllSessions(userId: string): ReactiveObservable<DashboardWorkoutSession[]> {
      const query = db.get('workout_sessions').query(Q.where('user_id', userId));
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({
          id: r.id,
          userId: r._raw.user_id,
          workoutId: r._raw.workout_id ?? null,
          startedAt: r._raw.started_at,
          endedAt: r._raw.ended_at ?? null,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        }))
      );
    },
    observeAllLoggedSets(userId: string): ReactiveObservable<ActiveSessionLoggedSet[]> {
      return mapObservable(observeLoggedSetsForUser(db, userId), (records) =>
        records.map((r) => ({
          id: r.id,
          sessionId: r._raw.session_id,
          exerciseId: r._raw.exercise_id,
          weight: r._raw.weight,
          repetitions: r._raw.repetitions,
          estimatedOneRm: r._raw.estimated_one_rm,
          completedAt: r._raw.completed_at,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        })),
      );
    },
    observeExercises(): ReactiveObservable<CatalogExercise[]> {
      const query = db.get('exercises').query();
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({
          id: r.id,
          name: r._raw.name,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        }))
      );
    },
    observeWorkoutNames(userId: string): ReactiveObservable<Array<{ id: string; name: string }>> {
      const query = db.get('workouts').query(Q.where('user_id', userId));
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({ id: r.id, name: r._raw.name }))
      );
    },
  };
}

/** Concrete ExerciseCatalogDatabaseProvider backed by WatermelonDB (Requirement 5.3). */
export function createExerciseCatalogDatabaseProvider(db: Database): ExerciseCatalogDatabaseProvider {
  return {
    observeExercises(): ReactiveObservable<CatalogExercise[]> {
      const query = db.get('exercises').query();
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({
          id: r.id,
          name: r._raw.name,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        }))
      );
    },
  };
}

/** Concrete ActiveSessionDatabaseProvider backed by WatermelonDB (Requirement 5.3). */
export function createActiveSessionDatabaseProvider(db: Database): ActiveSessionDatabaseProvider {
  return {
    observeSession(sessionId: string): ReactiveObservable<ActiveSession> {
      return {
        subscribe(observer) {
          let unsubscribed = false;
          db.get('workout_sessions')
            .find(sessionId)
            .then((record: any) => {
              if (unsubscribed) return;
              const sub = record.observe().subscribe({
                next: (r: any) =>
                  observer.next?.({
                    id: r.id,
                    userId: r._raw.user_id,
                    workoutId: r._raw.workout_id ?? null,
                    startedAt: r._raw.started_at,
                    endedAt: r._raw.ended_at ?? null,
                    createdAt: r._raw.created_at,
                    updatedAt: r._raw.updated_at,
                  }),
                error: (err: unknown) => observer.error?.(err),
              });
              (observer as any)._sub = sub;
            })
            .catch((err: unknown) => observer.error?.(err));

          return {
            unsubscribe: () => {
              unsubscribed = true;
              (observer as any)._sub?.unsubscribe();
            },
          };
        },
      };
    },
    observeLoggedSets(sessionId: string): ReactiveObservable<ActiveSessionLoggedSet[]> {
      const query = db.get('logged_sets').query(Q.where('session_id', sessionId));
      return mapObservable(query.observe(), (records: any[]) =>
        records.map((r) => ({
          id: r.id,
          sessionId: r._raw.session_id,
          exerciseId: r._raw.exercise_id,
          weight: r._raw.weight,
          repetitions: r._raw.repetitions,
          estimatedOneRm: r._raw.estimated_one_rm,
          completedAt: r._raw.completed_at,
          createdAt: r._raw.created_at,
          updatedAt: r._raw.updated_at,
        }))
      );
    },
    observeWorkoutExercises(workoutId: string): ReactiveObservable<WorkoutExerciseOption[]> {
      const query = db.get('workout_exercises').query(Q.where('workout_id', workoutId));
      return {
        subscribe(observer) {
          const sub = query.observe().subscribe({
            next: async (records: any[]) => {
              try {
                const options = await Promise.all(
                  records.map(async (r: any) => {
                    const exercise = await r.exercise.fetch();
                    return { id: exercise.id, name: exercise._raw.name };
                  }),
                );
                observer.next?.(options);
              } catch (err) {
                observer.error?.(err);
              }
            },
            error: (err: unknown) => observer.error?.(err),
          });
          return { unsubscribe: () => sub.unsubscribe() };
        },
      };
    },
  };
}
