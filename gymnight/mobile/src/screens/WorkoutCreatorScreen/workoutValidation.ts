/**
 * Workout Creator validation utilities.
 *
 * These pure functions enforce domain invariants for the Workout_Creator_Screen
 * without side effects or network dependencies.
 */

export interface ExerciseTargets {
  series_target?: number;
  reps_target?: number;
  weight_target?: number;
}

/**
 * Determines whether a WorkoutExercise can be added/saved.
 *
 * Returns true ONLY when ALL three targets (series_target, reps_target, weight_target)
 * are defined AND greater than 0.
 *
 * @see Requirement 18.2 — series_target, reps_target, and weight_target are required
 *      before the exercise entry can be saved.
 */
export function canAddExercise(targets: ExerciseTargets): boolean {
  return (
    targets.series_target !== undefined &&
    targets.series_target !== null &&
    targets.series_target > 0 &&
    targets.reps_target !== undefined &&
    targets.reps_target !== null &&
    targets.reps_target > 0 &&
    targets.weight_target !== undefined &&
    targets.weight_target !== null &&
    targets.weight_target > 0
  );
}

/**
 * Determines whether a Workout name is valid.
 *
 * Returns `false` for empty strings or strings composed entirely of whitespace characters.
 * Returns `true` for any string containing at least one non-whitespace character.
 *
 * This is a pure validation function with no side effects — it never triggers a write.
 *
 * @see Requirement 18.6 — Empty/whitespace-only names are rejected with an error
 *      on the name field; no Workout record is persisted.
 */
export function isValidWorkoutName(name: string): boolean {
  return name.trim().length > 0;
}
