import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

/** Catálogo compartilhado, pull-only — 7 linhas fixas (Peito, Costas, Ombros, Bíceps, Tríceps, Pernas, Abdômen). */
export default class MuscleGroup extends Model {
  static table = 'muscle_groups';

  @field('name') name!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
