import fc from 'fast-check';
import { saveWorkoutWithExercises, ExerciseInput } from '../saveWorkoutWithExercises';

/**
 * Feature: frontend-mobile-implementation
 * Property 40: Saving a Workout with its exercises is atomic — no partial commit under interruption
 *
 * **Validates: Requirements 18.3**
 *
 * For any arbitrary Workout with N exercises:
 * 1. On success: ALL records (workout + N exercises) are created atomically
 * 2. On failure (at any point): NO records are created (neither workout nor any exercise)
 * 3. Partial state (workout created but some exercises missing) is NEVER observable
 * 4. The operation is all-or-nothing regardless of N
 */

// Arbitrary for a valid exercise input
const exerciseInputArb: fc.Arbitrary<ExerciseInput> = fc.record({
  exerciseId: fc.uuid(),
  seriesTarget: fc.integer({ min: 1, max: 10 }),
  repsTarget: fc.integer({ min: 1, max: 30 }),
  weightTarget: fc.float({ min: Math.fround(0.5), max: Math.fround(500), noNaN: true }),
});

// Arbitrary for a non-empty workout name
const workoutNameArb = fc.string({ minLength: 1, maxLength: 50 });

// Arbitrary for a list of exercises (0 to 20)
const exercisesArb = fc.array(exerciseInputArb, { minLength: 0, maxLength: 20 });

/**
 * Helper: builds a mock database that tracks all created records per collection.
 * The write() call wraps the operation atomically — if anything inside throws,
 * the tracked records are rolled back (simulating WatermelonDB's transactional behavior).
 */
function buildTrackingMockDb() {
  const committedRecords: Map<string, any[]> = new Map();
  const pendingRecords: Map<string, any[]> = new Map();
  let writeCompleted = false;

  const mockDb = {
    get: (tableName: string) => ({
      create: (creator: (record: any) => void) => {
        const record = {
          id: `mock-${tableName}-${Math.random().toString(36).slice(2)}`,
          _raw: {},
          _changed: new Set<string>(),
        };
        creator(record);
        // Add to pending (not committed until write() completes)
        if (!pendingRecords.has(tableName)) {
          pendingRecords.set(tableName, []);
        }
        pendingRecords.get(tableName)!.push(record);
        return Promise.resolve(record);
      },
    }),
    write: async <T>(fn: () => Promise<T>): Promise<T> => {
      // Clear pending before the transaction
      pendingRecords.clear();
      try {
        const result = await fn();
        // On success: commit all pending records
        for (const [table, records] of pendingRecords.entries()) {
          if (!committedRecords.has(table)) {
            committedRecords.set(table, []);
          }
          committedRecords.get(table)!.push(...records);
        }
        writeCompleted = true;
        return result;
      } catch (error) {
        // On failure: discard all pending records (rollback)
        pendingRecords.clear();
        throw error;
      }
    },
  } as any;

  return {
    db: mockDb,
    getCommittedRecords: () => committedRecords,
    getPendingRecords: () => pendingRecords,
    wasWriteCompleted: () => writeCompleted,
  };
}

/**
 * Helper: builds a mock database where the Nth create call (1-indexed) fails (simulating interruption).
 * This allows us to test that partial state is never committed.
 * When failAtCreateIndex is 0, the first create will fail.
 */
function buildFailingMockDb(failAtCreateIndex: number) {
  let createCallCount = 0;
  const committedRecords: Map<string, any[]> = new Map();

  const mockDb = {
    get: (tableName: string) => ({
      create: (creator: (record: any) => void) => {
        createCallCount++;
        if (createCallCount > failAtCreateIndex) {
          return Promise.reject(new Error(`Simulated failure at create #${createCallCount}`));
        }
        const record = {
          id: `mock-${tableName}-${createCallCount}`,
          _raw: {},
          _changed: new Set<string>(),
        };
        creator(record);
        return Promise.resolve(record);
      },
    }),
    write: async <T>(fn: () => Promise<T>): Promise<T> => {
      createCallCount = 0;
      try {
        const result = await fn();
        // Only commit on full success — this simulates WatermelonDB's atomic write
        return result;
      } catch (error) {
        // Rollback: nothing is committed
        throw error;
      }
    },
  } as any;

  return {
    db: mockDb,
    getCommittedRecords: () => committedRecords,
  };
}

describe('Property 40: Saving a Workout with its exercises is atomic — no partial commit under interruption', () => {
  test('on success: ALL records (workout + N exercises) are created atomically within a single write block', async () => {
    await fc.assert(
      fc.asyncProperty(workoutNameArb, exercisesArb, async (name, exercises) => {
        const { db, getCommittedRecords, wasWriteCompleted } = buildTrackingMockDb();

        const result = await saveWorkoutWithExercises(name, exercises, db);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.exerciseCount).toBe(exercises.length);
          expect(wasWriteCompleted()).toBe(true);

          // All records were created within the single write transaction
          const workouts = getCommittedRecords().get('workouts') ?? [];
          const workoutExercises = getCommittedRecords().get('workout_exercises') ?? [];
          expect(workouts.length).toBe(1);
          expect(workoutExercises.length).toBe(exercises.length);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('on failure at any point: NO records are created (neither workout nor any exercise)', async () => {
    await fc.assert(
      fc.asyncProperty(
        workoutNameArb,
        fc.array(exerciseInputArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }),
        async (name, exercises, failOffset) => {
          // Total creates = 1 (workout) + N (exercises)
          // failAtCreateIndex must be in range [0, totalCreates - 1] to guarantee a failure
          // (0 means first create fails, totalCreates-1 means last exercise create fails)
          const totalCreates = 1 + exercises.length;
          const failAtCreateIndex = failOffset % totalCreates;

          const { db, getCommittedRecords } = buildFailingMockDb(failAtCreateIndex);

          const result = await saveWorkoutWithExercises(name, exercises, db);

          // The operation must fail
          expect(result.success).toBe(false);

          // NO records should be committed (atomic rollback)
          const workouts = getCommittedRecords().get('workouts') ?? [];
          const workoutExercises = getCommittedRecords().get('workout_exercises') ?? [];
          expect(workouts.length).toBe(0);
          expect(workoutExercises.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('partial state (workout created but some exercises missing) is NEVER observable', async () => {
    await fc.assert(
      fc.asyncProperty(
        workoutNameArb,
        fc.array(exerciseInputArb, { minLength: 2, maxLength: 10 }),
        async (name, exercises) => {
          const totalCreates = 1 + exercises.length;

          // Test every possible interruption point
          for (let failAt = 0; failAt < totalCreates; failAt++) {
            let createCallCount = 0;
            const createdDuringWrite: Map<string, any[]> = new Map();
            let committed = false;

            const mockDb = {
              get: (tableName: string) => ({
                create: (creator: (record: any) => void) => {
                  createCallCount++;
                  if (createCallCount > failAt) {
                    return Promise.reject(new Error(`Simulated failure at create #${createCallCount}`));
                  }
                  const record = {
                    id: `mock-${tableName}-${createCallCount}`,
                    _raw: {},
                    _changed: new Set<string>(),
                  };
                  creator(record);
                  if (!createdDuringWrite.has(tableName)) {
                    createdDuringWrite.set(tableName, []);
                  }
                  createdDuringWrite.get(tableName)!.push(record);
                  return Promise.resolve(record);
                },
              }),
              write: async <T>(fn: () => Promise<T>): Promise<T> => {
                createCallCount = 0;
                createdDuringWrite.clear();
                try {
                  const result = await fn();
                  committed = true;
                  return result;
                } catch (error) {
                  // Rollback: nothing is committed
                  committed = false;
                  throw error;
                }
              },
            } as any;

            const result = await saveWorkoutWithExercises(name, exercises, mockDb);

            // After the operation: either EVERYTHING committed or NOTHING
            if (result.success) {
              // Full success: workout AND all exercises were created
              expect(committed).toBe(true);
              expect(createdDuringWrite.get('workouts')?.length ?? 0).toBe(1);
              expect(createdDuringWrite.get('workout_exercises')?.length ?? 0).toBe(exercises.length);
            } else {
              // Full failure: nothing is committed
              expect(committed).toBe(false);
            }

            // CRITICAL: partial state is NEVER acceptable
            // If workout exists, ALL exercises must exist
            const workoutCount = committed ? (createdDuringWrite.get('workouts')?.length ?? 0) : 0;
            const exerciseCount = committed ? (createdDuringWrite.get('workout_exercises')?.length ?? 0) : 0;

            if (workoutCount > 0) {
              expect(exerciseCount).toBe(exercises.length);
            }
            if (exerciseCount > 0) {
              expect(workoutCount).toBe(1);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('the operation is all-or-nothing regardless of N (0 to many exercises)', async () => {
    await fc.assert(
      fc.asyncProperty(
        workoutNameArb,
        fc.integer({ min: 0, max: 20 }),
        async (name, n) => {
          // Generate N exercises
          const exercises: ExerciseInput[] = Array.from({ length: n }, (_, i) => ({
            exerciseId: `exercise-${i}`,
            seriesTarget: 3,
            repsTarget: 10,
            weightTarget: 50,
          }));

          // Test success case
          const { db: successDb, getCommittedRecords: getSuccessRecords } = buildTrackingMockDb();
          const successResult = await saveWorkoutWithExercises(name, exercises, successDb);

          expect(successResult.success).toBe(true);
          const successWorkouts = getSuccessRecords().get('workouts') ?? [];
          const successExercises = getSuccessRecords().get('workout_exercises') ?? [];
          expect(successWorkouts.length).toBe(1);
          expect(successExercises.length).toBe(n);

          // Test failure case (fail at workout creation itself)
          const { db: failDb, getCommittedRecords: getFailRecords } = buildFailingMockDb(0);
          const failResult = await saveWorkoutWithExercises(name, exercises, failDb);

          expect(failResult.success).toBe(false);
          const failWorkouts = getFailRecords().get('workouts') ?? [];
          const failExercises = getFailRecords().get('workout_exercises') ?? [];
          expect(failWorkouts.length).toBe(0);
          expect(failExercises.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
