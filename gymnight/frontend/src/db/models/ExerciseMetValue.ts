import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

/** Valor MET por exercício, usado no cálculo de calorias. Catálogo compartilhado, pull-only. */
export default class ExerciseMetValue extends Model {
  static table = 'exercise_met_values';
  static associations = {
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('exercise_id') exerciseId!: string;
  @field('met_value') metValue!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('exercises', 'exercise_id') exercise: any;
}
