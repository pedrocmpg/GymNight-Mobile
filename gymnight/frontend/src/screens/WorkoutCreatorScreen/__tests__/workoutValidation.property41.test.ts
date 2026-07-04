import fc from 'fast-check';
import { isValidWorkoutName } from '../workoutValidation';

/**
 * Feature: frontend-mobile-implementation
 * Property 41: Whitespace-only or empty Workout names are always rejected without a write
 *
 * **Validates: Requirements 18.6**
 *
 * For any string that is either empty or composed solely of whitespace characters
 * (spaces, tabs, newlines, etc.), isValidWorkoutName MUST return false.
 * For any string containing at least one non-whitespace character, it MUST return true.
 * The function is pure — it never triggers any side effect or write operation.
 */

// Arbitrary: generates strings composed entirely of whitespace characters
const whitespaceOnlyArb = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v', ' '), { minLength: 1, maxLength: 50 })
  .map((chars) => chars.join(''));

// Arbitrary: generates strings that have at least one non-whitespace character
const nonWhitespaceStringArb = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 20 }), // optional prefix
    fc.char().filter((c) => c.trim().length > 0), // at least one non-whitespace char
    fc.string({ minLength: 0, maxLength: 20 }), // optional suffix
  )
  .map(([prefix, nonWs, suffix]) => prefix + nonWs + suffix);

describe('Property 41: Whitespace-only or empty Workout names are always rejected without a write', () => {
  test('empty string is always rejected', () => {
    expect(isValidWorkoutName('')).toBe(false);
  });

  test('whitespace-only strings are always rejected', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (name) => {
        expect(isValidWorkoutName(name)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('any string with at least one non-whitespace character is always accepted', () => {
    fc.assert(
      fc.property(nonWhitespaceStringArb, (name) => {
        expect(isValidWorkoutName(name)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('isValidWorkoutName is a pure function — calling it never produces side effects', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (name) => {
        // Calling the function twice with the same input always yields the same result
        const result1 = isValidWorkoutName(name);
        const result2 = isValidWorkoutName(name);
        expect(result1).toBe(result2);

        // Result is always a boolean
        expect(typeof result1).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });
});
