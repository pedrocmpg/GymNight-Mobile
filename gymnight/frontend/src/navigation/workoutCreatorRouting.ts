import type { SaveWorkoutResult } from '../screens/WorkoutCreatorScreen/saveWorkoutWithExercises';

export type WorkoutSaveRoutingResult =
  | { navigateBack: true; errorMessage: null }
  | { navigateBack: false; errorMessage: string };

/**
 * Pure decision function for Property 16: maps saveWorkoutWithExercises'
 * outcome to whether the navigator should return to Dashboard_Screen, or
 * stay on Workout_Creator_Screen with an error message.
 */
export function resolveWorkoutSaveOutcome(result: SaveWorkoutResult): WorkoutSaveRoutingResult {
  if (result.success) {
    return { navigateBack: true, errorMessage: null };
  }
  return { navigateBack: false, errorMessage: 'Falha ao salvar o treino. Tente novamente.' };
}
