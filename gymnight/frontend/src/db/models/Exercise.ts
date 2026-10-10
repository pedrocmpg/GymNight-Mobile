import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';

export default class Exercise extends Model {
  static table = 'exercises';
  static associations = {
    workout_exercises: { type: 'has_many' as const, foreignKey: 'exercise_id' },
    logged_sets: { type: 'has_many' as const, foreignKey: 'exercise_id' },
  };

  @field('name') name!: string;
  @field('name_en') nameEn!: string | null;
  @field('equipment') equipment!: string | null;
  @field('media_key') mediaKey!: string | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('workout_exercises') workoutExercises: any;
  @children('logged_sets') loggedSets: any;
}
