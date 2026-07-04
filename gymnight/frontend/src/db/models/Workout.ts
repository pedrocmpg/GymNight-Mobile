import { Model } from '@nozbe/watermelondb';
import { field, date, relation, children } from '@nozbe/watermelondb/decorators';

export default class Workout extends Model {
  static table = 'workouts';
  static associations = {
    users: { type: 'belongs_to' as const, key: 'user_id' },
    workout_exercises: { type: 'has_many' as const, foreignKey: 'workout_id' },
    workout_sessions: { type: 'has_many' as const, foreignKey: 'workout_id' },
  };

  @field('user_id') userId!: string;
  @field('name') name!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('users', 'user_id') user: any;
  @children('workout_exercises') workoutExercises: any;
  @children('workout_sessions') workoutSessions: any;
}
