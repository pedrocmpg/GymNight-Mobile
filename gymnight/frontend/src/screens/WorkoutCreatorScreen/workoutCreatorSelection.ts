import { canAddExercise, isValidWorkoutName } from './workoutValidation';
import type { ExerciseInput } from './saveWorkoutWithExercises';

export interface SelectedExerciseEntry {
  exerciseId: string;
  seriesTarget?: number;
  repsTarget?: number;
  weightTarget?: number;
}

/**
 * Builds the ExerciseInput[] payload for saveWorkoutWithExercises from the
 * user's selection, keeping only entries whose targets are complete and
 * valid per canAddExercise. Unselected/incomplete entries are dropped.
 */
export function buildExerciseInputs(selected: SelectedExerciseEntry[]): ExerciseInput[] {
  return selected
    .filter((entry) =>
      canAddExercise({
        series_target: entry.seriesTarget,
        reps_target: entry.repsTarget,
        weight_target: entry.weightTarget,
      }),
    )
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      seriesTarget: entry.seriesTarget as number,
      repsTarget: entry.repsTarget as number,
      weightTarget: entry.weightTarget as number,
    }));
}

/**
 * A workout can be saved iff its name is valid AND at least one selected
 * exercise has complete, valid targets.
 */
export function canSaveWorkout(name: string, selected: SelectedExerciseEntry[]): boolean {
  return isValidWorkoutName(name) && buildExerciseInputs(selected).length > 0;
}
