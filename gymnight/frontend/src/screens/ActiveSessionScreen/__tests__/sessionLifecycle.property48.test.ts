import fc from 'fast-check';
import {
  persistLoggedSetWithIsolation,
  persistMultipleLoggedSetsWithIsolation,
} from '../sessionLifecycle';

/**
 * Feature: frontend-mobile-implementation
 * Property 48: A failed LoggedSet persistence isolates the error to that entry and retains its entered values
 *
 * **Validates: Requirements 19.10**
 *
 * For any arbitrary LoggedSet entry (exerciseId, weight, reps, sessionId):
 * - On failure: the error is isolated to the specific entry (other entries remain successful)
 * - On failure: the entered values (weight, reps, exerciseId) are ALWAYS retained in the result
 * - On failure: no partial write occurs for that entry
 * - Multiple entries: a failure in one does NOT affect the others
 */

// --- Arbitraries ---

/** UUID-like string for session/exercise IDs */
const sessionIdArb = fc.uuid();
const exerciseIdArb = fc.uuid();

/** Positive weight (0.5 to 500 kg, reasonable gym range) */
const weightArb = fc.double({ min: 0.5, max: 500, noNaN: true, noDefaultInfinity: true });

/** Repetitions (1 to 100, positive integers) */
const repsArb = fc.integer({ min: 1, max: 100 });

/** A single LoggedSet entry for persistence */
const entryArb = fc.record({
  exerciseId: exerciseIdArb,
  weight: weightArb,
  reps: repsArb,
  sessionId: sessionIdArb,
});

/** Error message arbitrary */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });

/** A list of entries (2 to 10 items) for multi-entry tests */
const entriesListArb = fc.array(entryArb, { minLength: 2, maxLength: 10 });

// --- Tests ---

describe('Property 48: A failed LoggedSet persistence isolates the error to that entry and retains its entered values', () => {
  test('on failure: entered values (weight, reps, exerciseId) are ALWAYS retained in the result', async () => {
    await fc.assert(
      fc.asyncProperty(
        entryArb,
        errorMessageArb,
        async (entry, errorMsg) => {
          const failingPersist = async () => {
            throw new Error(errorMsg);
          };

          const result = await persistLoggedSetWithIsolation(entry, failingPersist);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.retainedValues.weight).toBe(entry.weight);
            expect(result.retainedValues.reps).toBe(entry.reps);
            expect(result.retainedValues.exerciseId).toBe(entry.exerciseId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('on failure: no partial write occurs (persist function is called exactly once)', async () => {
    await fc.assert(
      fc.asyncProperty(
        entryArb,
        errorMessageArb,
        async (entry, errorMsg) => {
          let callCount = 0;
          const failingPersist = async () => {
            callCount++;
            throw new Error(errorMsg);
          };

          const result = await persistLoggedSetWithIsolation(entry, failingPersist);

          // persist is called exactly once — no partial retry or double-write
          expect(callCount).toBe(1);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('on success: returns success true with the generated id', async () => {
    await fc.assert(
      fc.asyncProperty(
        entryArb,
        fc.uuid(),
        async (entry, generatedId) => {
          const successPersist = async () => generatedId;

          const result = await persistLoggedSetWithIsolation(entry, successPersist);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.id).toBe(generatedId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('multiple entries: a failure in one does NOT affect the others', async () => {
    await fc.assert(
      fc.asyncProperty(
        entriesListArb,
        errorMessageArb,
        async (entries, errorMsg) => {
          // Fail only the first entry
          const failIndex = 0;

          let callIndex = 0;
          const persist = async () => {
            const currentIndex = callIndex++;
            if (currentIndex === failIndex) {
              throw new Error(errorMsg);
            }
            return `generated-id-${currentIndex}`;
          };

          const results = await persistMultipleLoggedSetsWithIsolation(entries, persist);

          // The failed entry should have success: false with retained values
          const failedResult = results[failIndex];
          expect(failedResult.success).toBe(false);
          if (!failedResult.success) {
            expect(failedResult.retainedValues.weight).toBe(entries[failIndex].weight);
            expect(failedResult.retainedValues.reps).toBe(entries[failIndex].reps);
            expect(failedResult.retainedValues.exerciseId).toBe(entries[failIndex].exerciseId);
          }

          // All other entries should have success: true
          for (let i = 0; i < results.length; i++) {
            if (i !== failIndex) {
              expect(results[i].success).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('multiple entries with random failure position: isolation holds for any entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        errorMessageArb,
        async (entries, rawFailIndex, errorMsg) => {
          const failIndex = rawFailIndex % entries.length;

          // Use positional call counter — map iterates in order
          let callCounter = 0;
          const persist = async () => {
            const currentCall = callCounter++;
            if (currentCall === failIndex) {
              throw new Error(errorMsg);
            }
            return `id-${currentCall}`;
          };

          const results = await persistMultipleLoggedSetsWithIsolation(entries, persist);

          // Failed entry is isolated
          const failedResult = results[failIndex];
          expect(failedResult.success).toBe(false);
          if (!failedResult.success) {
            expect(failedResult.retainedValues.weight).toBe(entries[failIndex].weight);
            expect(failedResult.retainedValues.reps).toBe(entries[failIndex].reps);
            expect(failedResult.retainedValues.exerciseId).toBe(entries[failIndex].exerciseId);
            expect(failedResult.error).toBe(errorMsg);
          }

          // All other entries succeeded
          for (let i = 0; i < results.length; i++) {
            if (i !== failIndex) {
              expect(results[i].success).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
