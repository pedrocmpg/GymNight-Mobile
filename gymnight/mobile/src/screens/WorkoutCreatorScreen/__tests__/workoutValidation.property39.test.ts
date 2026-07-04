import fc from 'fast-check';
import { canAddExercise, ExerciseTargets } from '../workoutValidation';

/**
 * Feature: frontend-mobile-implementation
 * Property 39: Adding a WorkoutExercise is blocked unless series_target, reps_target,
 *              and weight_target are all present
 *
 * **Validates: Requirements 18.2**
 *
 * For any arbitrary target values:
 * 1. Adding is blocked when ANY of the three targets is missing (undefined/null/0)
 * 2. Adding is allowed ONLY when ALL three are present and > 0
 * 3. The validation is a pure function (same inputs always produce same output)
 */

// Arbitrary that generates a positive number (valid target value)
const positiveTargetArb = fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true });

// Arbitrary that generates an invalid target (undefined, null-like via 0, or 0 itself)
const invalidTargetArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(0),
  fc.float({ min: Math.fround(-1000), max: 0, noNaN: true }),
);

describe('Property 39: Adding a WorkoutExercise is blocked unless series_target, reps_target, and weight_target are all present', () => {
  test('adding is allowed ONLY when ALL three targets are present and > 0', () => {
    fc.assert(
      fc.property(positiveTargetArb, positiveTargetArb, positiveTargetArb, (series, reps, weight) => {
        const targets: ExerciseTargets = {
          series_target: series,
          reps_target: reps,
          weight_target: weight,
        };
        expect(canAddExercise(targets)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('adding is blocked when series_target is missing or invalid', () => {
    fc.assert(
      fc.property(invalidTargetArb, positiveTargetArb, positiveTargetArb, (series, reps, weight) => {
        const targets: ExerciseTargets = {
          series_target: series,
          reps_target: reps,
          weight_target: weight,
        };
        expect(canAddExercise(targets)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('adding is blocked when reps_target is missing or invalid', () => {
    fc.assert(
      fc.property(positiveTargetArb, invalidTargetArb, positiveTargetArb, (series, reps, weight) => {
        const targets: ExerciseTargets = {
          series_target: series,
          reps_target: reps,
          weight_target: weight,
        };
        expect(canAddExercise(targets)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('adding is blocked when weight_target is missing or invalid', () => {
    fc.assert(
      fc.property(positiveTargetArb, positiveTargetArb, invalidTargetArb, (series, reps, weight) => {
        const targets: ExerciseTargets = {
          series_target: series,
          reps_target: reps,
          weight_target: weight,
        };
        expect(canAddExercise(targets)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('adding is blocked when all targets are missing', () => {
    fc.assert(
      fc.property(invalidTargetArb, invalidTargetArb, invalidTargetArb, (series, reps, weight) => {
        const targets: ExerciseTargets = {
          series_target: series,
          reps_target: reps,
          weight_target: weight,
        };
        expect(canAddExercise(targets)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('the validation is a pure function (same inputs produce same output)', () => {
    fc.assert(
      fc.property(
        fc.option(fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }), { nil: undefined }),
        fc.option(fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }), { nil: undefined }),
        fc.option(fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }), { nil: undefined }),
        (series, reps, weight) => {
          const targets: ExerciseTargets = {
            series_target: series,
            reps_target: reps,
            weight_target: weight,
          };
          // Call twice with same input, result must be identical
          const result1 = canAddExercise(targets);
          const result2 = canAddExercise(targets);
          expect(result1).toBe(result2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
