/**
 * Feature: frontend-backend-integration, Property 16: Workout save navigation, error display, and data preservation is a total function of persistence outcome
 * **Validates: Requirements 8.2, 8.3, 8.4**
 */
import * as fc from 'fast-check';
import { resolveWorkoutSaveOutcome } from '../workoutCreatorRouting';
import type { SaveWorkoutResult } from '../../screens/WorkoutCreatorScreen/saveWorkoutWithExercises';

describe('Property 16: Workout save navigation/error/data-preservation is total', () => {
  it('navigates back iff success; on failure, stays and shows a non-empty error message', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            success: fc.constant(true as const),
            workoutId: fc.uuid(),
            exerciseCount: fc.nat({ max: 20 }),
          }),
          fc.string({ minLength: 1 }).map((message) => ({ success: false as const, error: new Error(message) }))
        ),
        (result: SaveWorkoutResult) => {
          const outcome = resolveWorkoutSaveOutcome(result);

          if (result.success) {
            expect(outcome.navigateBack).toBe(true);
            expect(outcome.errorMessage).toBeNull();
          } else {
            expect(outcome.navigateBack).toBe(false);
            expect(outcome.errorMessage).not.toBeNull();
            expect((outcome.errorMessage as string).length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
