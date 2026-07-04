import { Model } from '@nozbe/watermelondb';
import { field, date, children, relation } from '@nozbe/watermelondb/decorators';

export default class WorkoutSession extends Model {
  static table = 'workout_sessions';
  static associations = {
    workouts: { type: 'belongs_to' as const, key: 'workout_id' },
    logged_sets: { type: 'has_many' as const, foreignKey: 'session_id' },
  };

  @field('user_id') userId!: string;
  @field('workout_id') workoutId!: string | null;
  @date('started_at') startedAt!: Date;
  @date('ended_at') endedAt!: Date | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('workouts', 'workout_id') workout: any;
  @children('logged_sets') loggedSets: any;
}
