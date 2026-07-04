import fc from 'fast-check';
import { computeElapsedTime } from '../sessionLifecycle';

/**
 * Feature: frontend-mobile-implementation
 * Property 43: Displayed elapsed time always equals the difference between now and started_at
 *
 * **Validates: Requirements 19.3**
 *
 * For any arbitrary `startedAt` and any `now >= startedAt`:
 * - The elapsed time equals exactly `now - startedAt`
 * - The function is pure (same inputs always produce the same output)
 * - The result is always >= 0 when now >= startedAt
 * - No rounding or transformation is applied
 */

// --- Arbitraries ---

/** Reasonable timestamp for startedAt (between year 2020 and 2040) */
const startedAtArb = fc.integer({
  min: 1577836800000, // 2020-01-01
  max: 2208988800000, // 2040-01-01
});

/** Offset representing elapsed time (0 to 24 hours in ms) */
const elapsedOffsetArb = fc.integer({ min: 0, max: 86_400_000 });

// --- Tests ---

describe('Property 43: Displayed elapsed time always equals the difference between now and started_at', () => {
  test('elapsed time equals exactly now - startedAt for any valid inputs', () => {
    fc.assert(
      fc.property(startedAtArb, elapsedOffsetArb, (startedAt, offset) => {
        const now = startedAt + offset;
        const result = computeElapsedTime(startedAt, now);

        expect(result).toBe(now - startedAt);
      }),
      { numRuns: 100 },
    );
  });

  test('the function is pure: same inputs always produce the same output', () => {
    fc.assert(
      fc.property(startedAtArb, elapsedOffsetArb, (startedAt, offset) => {
        const now = startedAt + offset;

        const result1 = computeElapsedTime(startedAt, now);
        const result2 = computeElapsedTime(startedAt, now);

        expect(result1).toBe(result2);
      }),
      { numRuns: 100 },
    );
  });

  test('result is always >= 0 when now >= startedAt', () => {
    fc.assert(
      fc.property(startedAtArb, elapsedOffsetArb, (startedAt, offset) => {
        const now = startedAt + offset;
        const result = computeElapsedTime(startedAt, now);

        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  test('no rounding or transformation is applied (result is exactly the integer difference)', () => {
    fc.assert(
      fc.property(startedAtArb, elapsedOffsetArb, (startedAt, offset) => {
        const now = startedAt + offset;
        const result = computeElapsedTime(startedAt, now);
        const expected = now - startedAt;

        // Verify exact equality (no Math.floor, Math.round, etc.)
        expect(result).toStrictEqual(expected);
        // Verify the result is an integer (no floating point transformation)
        expect(Number.isInteger(result)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
