import fc from 'fast-check';
import { createLoggedSet } from '../sessionLifecycle';

/**
 * Feature: frontend-mobile-implementation
 * Property 44: Logging a set always creates a correctly-linked LoggedSet with completed_at set to now
 *
 * **Validates: Requirements 19.4**
 *
 * For any arbitrary session ID, exercise ID, weight (> 0), repetitions (>= 1),
 * and optional explicit 1RM value:
 * - `session_id` always equals the provided sessionId
 * - `exercise_id` always equals the provided exerciseId
 * - `completed_at` is always set to `now()` (never null)
 * - `estimated_one_rm` uses the Epley formula when no explicit value is provided
 * - `estimated_one_rm` uses the explicit value when one is provided
 */

// --- Arbitraries ---

/** UUID-like string for session/exercise IDs */
const sessionIdArb = fc.uuid();
const exerciseIdArb = fc.uuid();

/** Positive weight (0.5 to 500 kg, reasonable gym range) */
const weightArb = fc.double({ min: 0.5, max: 500, noNaN: true, noDefaultInfinity: true });

/** Repetitions (1 to 100, positive integers) */
const repetitionsArb = fc.integer({ min: 1, max: 100 });

/** Optional explicit 1RM value (positive number or undefined) */
const explicitOneRmArb = fc.option(
  fc.double({ min: 0.5, max: 1000, noNaN: true, noDefaultInfinity: true }),
  { nil: undefined },
);

/** Reasonable timestamp (between year 2020 and 2040) */
const timestampArb = fc.integer({
  min: 1577836800000, // 2020-01-01
  max: 2208988800000, // 2040-01-01
});

// --- Tests ---

describe('Property 44: Logging a set always creates a correctly-linked LoggedSet with completed_at set to now', () => {
  test('session_id always equals the provided sessionId', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        exerciseIdArb,
        weightArb,
        repetitionsArb,
        timestampArb,
        (sessionId, exerciseId, weight, repetitions, ts) => {
          const result = createLoggedSet(sessionId, exerciseId, weight, repetitions, undefined, () => ts);

          expect(result.session_id).toBe(sessionId);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('exercise_id always equals the provided exerciseId', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        exerciseIdArb,
        weightArb,
        repetitionsArb,
        timestampArb,
        (sessionId, exerciseId, weight, repetitions, ts) => {
          const result = createLoggedSet(sessionId, exerciseId, weight, repetitions, undefined, () => ts);

          expect(result.exercise_id).toBe(exerciseId);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('completed_at is always set to now() and never null', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        exerciseIdArb,
        weightArb,
        repetitionsArb,
        explicitOneRmArb,
        timestampArb,
        (sessionId, exerciseId, weight, repetitions, explicitOneRm, ts) => {
          const result = createLoggedSet(sessionId, exerciseId, weight, repetitions, explicitOneRm, () => ts);

          expect(result.completed_at).toBe(ts);
          expect(result.completed_at).not.toBeNull();
          expect(result.completed_at).not.toBeUndefined();
          expect(result.completed_at).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('estimated_one_rm uses the Epley formula when no explicit value is provided', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        exerciseIdArb,
        weightArb,
        repetitionsArb,
        timestampArb,
        (sessionId, exerciseId, weight, repetitions, ts) => {
          const result = createLoggedSet(sessionId, exerciseId, weight, repetitions, undefined, () => ts);

          // Epley formula: weight * (1 + repetitions / 30)
          const expected = weight * (1 + repetitions / 30);

          expect(result.estimated_one_rm).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('estimated_one_rm uses explicit value when one is provided', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        exerciseIdArb,
        weightArb,
        repetitionsArb,
        fc.double({ min: 0.5, max: 1000, noNaN: true, noDefaultInfinity: true }),
        timestampArb,
        (sessionId, exerciseId, weight, repetitions, explicitOneRm, ts) => {
          const result = createLoggedSet(sessionId, exerciseId, weight, repetitions, explicitOneRm, () => ts);

          expect(result.estimated_one_rm).toBe(explicitOneRm);
        },
      ),
      { numRuns: 100 },
    );
  });
});
