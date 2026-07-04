import fc from 'fast-check';
import { isResumableSession, filterResumableSessions } from '../sessionLifecycle';

/**
 * Feature: frontend-mobile-implementation
 * Property 47: Resumable sessions surfaced to the Dashboard are exactly those with ended_at == null
 *
 * **Validates: Requirements 19.8**
 *
 * For any arbitrary session (with ended_at as null or a positive number):
 * - Sessions with ended_at === null are ALWAYS considered resumable
 * - Sessions with ended_at !== null are NEVER considered resumable
 * - filterResumableSessions returns EXACTLY the set with ended_at === null
 * - The filter result is always a subset of the input
 */

// --- Arbitraries ---

/** UUID-like string for session IDs */
const sessionIdArb = fc.uuid();

/** Reasonable timestamp (between year 2020 and 2040) */
const timestampArb = fc.integer({
  min: 1577836800000, // 2020-01-01
  max: 2208988800000, // 2040-01-01
});

/** ended_at: either null (resumable) or a positive timestamp (ended) */
const endedAtArb = fc.oneof(
  fc.constant(null),
  timestampArb,
);

/** A single session object */
const sessionArb = fc.record({
  id: sessionIdArb,
  ended_at: endedAtArb,
});

/** A list of sessions (0 to 50 items) */
const sessionsListArb = fc.array(sessionArb, { minLength: 0, maxLength: 50 });

// --- Tests ---

describe('Property 47: Resumable sessions surfaced to the Dashboard are exactly those with ended_at == null', () => {
  test('sessions with ended_at === null are ALWAYS considered resumable', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        (id) => {
          const session = { id, ended_at: null };
          expect(isResumableSession(session)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('sessions with ended_at !== null are NEVER considered resumable', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        timestampArb,
        (id, ts) => {
          const session = { id, ended_at: ts };
          expect(isResumableSession(session)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('filterResumableSessions returns EXACTLY the set with ended_at === null', () => {
    fc.assert(
      fc.property(
        sessionsListArb,
        (sessions) => {
          const result = filterResumableSessions(sessions);

          // Every returned session must have ended_at === null
          for (const s of result) {
            expect(s.ended_at).toBeNull();
          }

          // Every session with ended_at === null must be in the result
          const expectedIds = sessions
            .filter((s) => s.ended_at === null)
            .map((s) => s.id);
          const resultIds = result.map((s) => s.id);

          expect(resultIds).toEqual(expectedIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('filterResumableSessions result is always a subset of the input', () => {
    fc.assert(
      fc.property(
        sessionsListArb,
        (sessions) => {
          const result = filterResumableSessions(sessions);

          // Every item in result must exist in the original input
          for (const s of result) {
            expect(sessions).toContainEqual(s);
          }

          // Result length is always <= input length
          expect(result.length).toBeLessThanOrEqual(sessions.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
