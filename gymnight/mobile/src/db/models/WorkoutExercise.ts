import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

export default class WorkoutExercise extends Model {
  static table = 'workout_exercises';
  static associations = {
    workouts: { type: 'belongs_to' as const, key: 'workout_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('workout_id') workoutId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('series_target') seriesTarget!: number;
  @field('reps_target') repsTarget!: number;
  @field('weight_target') weightTarget!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('workouts', 'workout_id') workout: any;
  @relation('exercises', 'exercise_id') exercise: any;
}
