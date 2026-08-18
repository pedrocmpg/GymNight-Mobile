import { Q, type Database } from '@nozbe/watermelondb';
import type { ReactiveObservable } from '../hooks/useReactiveQuery';
import type { DashboardDatabaseProvider, DashboardWorkout, DashboardWorkoutSession } from '../hooks/useObserveDashboard';
import type { ExerciseCatalogDatabaseProvider, CatalogExercise } from '../hooks/useObserveExerciseCatalog';
import type {
  ActiveSessionDatabaseProvider,
  ActiveSession,
  ActiveSessionLoggedSet,
  WorkoutExerciseOption,
} from '../hooks/useObserveActiveSession';

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
