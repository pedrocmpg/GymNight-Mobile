import { Database } from '@nozbe/watermelondb';
import database from '../../db/database';
import { createLoggedSet } from './sessionLifecycle';

/** Persiste uma série (com 1RM de Epley) numa transação local; devolve o id. */
export async function persistLoggedSet(
  data: {
    exerciseId: string;
    weight: number;
    reps: number;
    sessionId: string;
    setType?: string;
  },
  db: Database = database,
): Promise<string> {
  const loggedSet = createLoggedSet(
    data.sessionId,
    data.exerciseId,
    data.weight,
    data.reps,
    undefined,
    undefined,
    data.setType ?? 'N',
  );
  const record = await db.write(async () => {
    return db.get('logged_sets').create((r: any) => {
      r._raw.session_id = loggedSet.session_id;
      r._raw.exercise_id = loggedSet.exercise_id;
      r._raw.weight = loggedSet.weight;
      r._raw.repetitions = loggedSet.repetitions;
      r._raw.estimated_one_rm = loggedSet.estimated_one_rm;
      r._raw.set_type = loggedSet.set_type;
      r._raw.completed_at = loggedSet.completed_at;
      r._raw.created_at = Date.now();
      r._raw.updated_at = Date.now();
    });
  });
  return record.id;
}
