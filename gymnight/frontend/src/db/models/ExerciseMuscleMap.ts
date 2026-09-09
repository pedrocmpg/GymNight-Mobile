import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

/** N:N exercise↔muscle_group com ativação proporcional. Catálogo compartilhado, pull-only. */
export default class ExerciseMuscleMap extends Model {
  static table = 'exercise_muscle_map';
  static associations = {
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
    muscle_groups: { type: 'belongs_to' as const, key: 'muscle_group_id' },
  };

  @field('exercise_id') exerciseId!: string;
  @field('muscle_group_id') muscleGroupId!: string;
  /** 0–1, decimal. Sempre > 0 (contribuição 0 nunca vira linha, pelo seed). */
  @field('contribution') contribution!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('exercises', 'exercise_id') exercise: any;
  @relation('muscle_groups', 'muscle_group_id') muscleGroup: any;
}
