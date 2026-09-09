import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

/**
 * Entrada de cardio (avulsa ou dentro de um treino). Criada na Wave 6 sem
 * consumidor de UI — a Wave 9 é quem lê/escreve isto. Ownership indireta via
 * session_id → workout_sessions.user_id, mesmo padrão de logged_sets.
 */
export default class CardioLog extends Model {
  static table = 'cardio_logs';
  static associations = {
    workout_sessions: { type: 'belongs_to' as const, key: 'session_id' },
  };

  @field('session_id') sessionId!: string;
  @field('cardio_type') cardioType!: string;
  @field('duration_min') durationMin!: number;
  @field('distance_km') distanceKm!: number | null;
  @field('pse') pse!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('workout_sessions', 'session_id') workoutSession: any;
}
