/**
 * Example tests (task 14.9): assert that container prop sourcing is live
 * (changes with the underlying WatermelonDB source) rather than a static stub.
 * Exercises the concrete providers each container passes to its hook.
 */
import { createDashboardDatabaseProvider, createExerciseCatalogDatabaseProvider } from '../watermelonProviders';

function makeFakeQuery(initialRecords: any[]) {
  let records = initialRecords;
  const listeners: Array<(records: any[]) => void> = [];
  return {
    observe: () => ({
      subscribe: (observer: { next?: (v: any[]) => void }) => {
        listeners.push((r) => observer.next?.(r));
        observer.next?.(records);
        return { unsubscribe: () => {} };
      },
    }),
    __emit: (next: any[]) => {
      records = next;
      listeners.forEach((l) => l(records));
    },
  };
}

describe('Example: container prop sourcing is live, not a static stub', () => {
  it('DashboardDatabaseProvider.observeWorkouts re-emits when the underlying query changes', () => {
    const workoutsQuery = makeFakeQuery([{ id: 'w1', _raw: { user_id: 'u1', name: 'Push Day', created_at: 1, updated_at: 1 } }]);
    const sessionsQuery = makeFakeQuery([]);

    const db: any = {
      get: (table: string) => ({
        query: () => (table === 'workouts' ? workoutsQuery : sessionsQuery),
      }),
    };

    const provider = createDashboardDatabaseProvider(db);
    const emissions: any[] = [];
    provider.observeWorkouts('u1').subscribe({ next: (v) => emissions.push(v) });

    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toEqual([{ id: 'w1', userId: 'u1', name: 'Push Day', createdAt: 1, updatedAt: 1 }]);

    workoutsQuery.__emit([
      { id: 'w1', _raw: { user_id: 'u1', name: 'Push Day', created_at: 1, updated_at: 1 } },
      { id: 'w2', _raw: { user_id: 'u1', name: 'Leg Day', created_at: 2, updated_at: 2 } },
    ]);

    expect(emissions).toHaveLength(2);
    expect(emissions[1]).toHaveLength(2);
  });

  it('ExerciseCatalogDatabaseProvider.observeExercises re-emits when the catalog changes', () => {
    const exercisesQuery = makeFakeQuery([{ id: 'e1', _raw: { name: 'Squat', created_at: 1, updated_at: 1 } }]);
    const db: any = { get: () => ({ query: () => exercisesQuery }) };

    const provider = createExerciseCatalogDatabaseProvider(db);
    const emissions: any[] = [];
    provider.observeExercises().subscribe({ next: (v) => emissions.push(v) });

    expect(emissions[0]).toEqual([{ id: 'e1', name: 'Squat', createdAt: 1, updatedAt: 1 }]);

    exercisesQuery.__emit([{ id: 'e1', _raw: { name: 'Squat', created_at: 1, updated_at: 1 } }, { id: 'e2', _raw: { name: 'Bench', created_at: 2, updated_at: 2 } }]);

    expect(emissions[1]).toHaveLength(2);
  });
});
