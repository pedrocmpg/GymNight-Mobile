import fc from 'fast-check';
import { startSession, endSession } from '../sessionLifecycle';

/**
 * Feature: frontend-mobile-implementation
 * Property 42: Starting and ending a WorkoutSession always sets the correct lifecycle fields
 *
 * **Validates: Requirements 19.1, 19.2, 19.7**
 *
 * For any arbitrary user ID, optional workout ID, and any valid timestamp:
 * - `started_at` is always set (non-null, positive timestamp) on start
 * - `ended_at` is always null on start
 * - `ended_at` is always set (non-null, >= started_at) on end
 * - `user_id` is always correct
 * - `workout_id` is null for freestyle, correct value otherwise
 */

// --- Arbitraries ---

/** UUID-like string for user/workout IDs */
const userIdArb = fc.uuid();

/** Workout ID: either a UUID or undefined (freestyle) */
const workoutIdArb = fc.option(fc.uuid(), { nil: undefined });

/** Reasonable timestamp (between year 2020 and 2040) */
const timestampArb = fc.integer({
  min: 1577836800000, // 2020-01-01
  max: 2208988800000, // 2040-01-01
});

/** Offset for end time (0 to 24 hours in ms) */
const endOffsetArb = fc.integer({ min: 0, max: 86_400_000 });

// --- Tests ---

describe('Property 42: Starting and ending a WorkoutSession always sets the correct lifecycle fields', () => {
  test('started_at is always set to a non-null, positive timestamp on startSession', () => {
    fc.assert(
      fc.property(userIdArb, workoutIdArb, timestampArb, (userId, workoutId, ts) => {
        const result = startSession(userId, workoutId, () => ts);

        // started_at must be the injected timestamp (non-null, positive)
        expect(result.started_at).toBe(ts);
        expect(result.started_at).toBeGreaterThan(0);
        expect(result.started_at).not.toBeNull();
        expect(result.started_at).not.toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  test('ended_at is always null on startSession', () => {
    fc.assert(
      fc.property(userIdArb, workoutIdArb, timestampArb, (userId, workoutId, ts) => {
        const result = startSession(userId, workoutId, () => ts);

        expect(result.ended_at).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  test('user_id is always preserved correctly on startSession', () => {
    fc.assert(
      fc.property(userIdArb, workoutIdArb, timestampArb, (userId, workoutId, ts) => {
        const result = startSession(userId, workoutId, () => ts);

        expect(result.user_id).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });

  test('workout_id is null for freestyle sessions and correct value otherwise', () => {
    fc.assert(
      fc.property(userIdArb, workoutIdArb, timestampArb, (userId, workoutId, ts) => {
        const result = startSession(userId, workoutId, () => ts);

        if (workoutId === undefined) {
          // Freestyle_Session: workout_id must be null
          expect(result.workout_id).toBeNull();
        } else {
          // Linked session: workout_id must match the provided value
          expect(result.workout_id).toBe(workoutId);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('ended_at is always set to a non-null timestamp >= started_at on endSession', () => {
    fc.assert(
      fc.property(
        userIdArb,
        workoutIdArb,
        timestampArb,
        endOffsetArb,
        (userId, workoutId, startTs, offset) => {
          const endTs = startTs + offset;
          const session = startSession(userId, workoutId, () => startTs, () => 'session-id');
          const result = endSession(session, () => endTs);

          // ended_at must be set (non-null)
          expect(result.ended_at).not.toBeNull();
          expect(result.ended_at).not.toBeUndefined();

          // ended_at must be >= started_at
          expect(result.ended_at).toBeGreaterThanOrEqual(result.started_at);

          // ended_at must equal the injected end timestamp
          expect(result.ended_at).toBe(endTs);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('endSession preserves user_id, workout_id, and started_at from the original session', () => {
    fc.assert(
      fc.property(
        userIdArb,
        workoutIdArb,
        timestampArb,
        endOffsetArb,
        (userId, workoutId, startTs, offset) => {
          const endTs = startTs + offset;
          const session = startSession(userId, workoutId, () => startTs, () => 'session-id');
          const result = endSession(session, () => endTs);

          expect(result.user_id).toBe(userId);
          expect(result.workout_id).toBe(session.workout_id);
          expect(result.started_at).toBe(startTs);
          expect(result.id).toBe(session.id);
        },
      ),
      { numRuns: 100 },
    );
  });
});
