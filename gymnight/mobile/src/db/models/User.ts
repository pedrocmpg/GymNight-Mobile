import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @field('name') name!: string;
  @field('email') email!: string;
  @field('weight') weight!: number | null;
  @field('height') height!: number | null;
  @date('birth_date') birthDate!: Date | null;
  @field('gender') gender!: string | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
