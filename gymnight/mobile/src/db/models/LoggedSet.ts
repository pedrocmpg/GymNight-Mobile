import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

export default class LoggedSet extends Model {
  static table = 'logged_sets';
  static associations = {
    workout_sessions: { type: 'belongs_to' as const, key: 'session_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('session_id') sessionId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('weight') weight!: number;
  @field('repetitions') repetitions!: number;
  @field('estimated_one_rm') estimatedOneRm!: number;
  @date('completed_at') completedAt!: Date;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('workout_sessions', 'session_id') workoutSession: any;
  @relation('exercises', 'exercise_id') exercise: any;
}
