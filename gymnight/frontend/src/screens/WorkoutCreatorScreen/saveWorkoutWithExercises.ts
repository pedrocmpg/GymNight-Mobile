import { Database } from '@nozbe/watermelondb';
import database from '../../db/database';

export interface ExerciseInput {
  exerciseId: string;
  seriesTarget: number;
  repsTarget: number;
  weightTarget: number;
}

export type SaveWorkoutResult =
  | { success: true; workoutId: string; exerciseCount: number }
  | { success: false; error: Error };

/**
 * Saves a Workout and all its associated WorkoutExercise entries atomically
 * within a single `database.write(...)` transaction.
 *
 * If any part of the operation fails, the entire transaction is rolled back
 * by WatermelonDB — no partial state (workout without exercises, or orphan exercises)
 * is ever observable.
 *
 * @param workoutName - Name of the workout to create
 * @param exercises - Array of exercise entries to associate with the workout
 * @param db - Optional database instance (for testing)
 *
 * @see Requirement 18.3 — Persist Workout and WorkoutExercises in a single local transaction
 */
export async function saveWorkoutWithExercises(
  workoutName: string,
  exercises: ExerciseInput[],
  db: Database = database,
): Promise<SaveWorkoutResult> {
  try {
    const result = await db.write(async () => {
      // Create the Workout record
      const workoutsCollection = db.get('workouts');
      const workout = await workoutsCollection.create((record: any) => {
        record._raw.name = workoutName;
        record._raw.created_at = Date.now();
        record._raw.updated_at = Date.now();
      });

      // Create ALL WorkoutExercise records within the same write block
      const workoutExercisesCollection = db.get('workout_exercises');
      for (const exercise of exercises) {
        await workoutExercisesCollection.create((record: any) => {
          record._raw.workout_id = workout.id;
          record._raw.exercise_id = exercise.exerciseId;
          record._raw.series_target = exercise.seriesTarget;
          record._raw.reps_target = exercise.repsTarget;
          record._raw.weight_target = exercise.weightTarget;
          record._raw.created_at = Date.now();
          record._raw.updated_at = Date.now();
        });
      }

      return { workoutId: workout.id, exerciseCount: exercises.length };
    });

    return { success: true, workoutId: result.workoutId, exerciseCount: result.exerciseCount };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
