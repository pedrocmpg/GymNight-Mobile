import { Database } from '@nozbe/watermelondb';
import database from '../../db/database';

export type EndSessionPersistResult =
  | { success: true }
  | { success: false; error: Error };

/**
 * Marks a WorkoutSession as ended by setting ended_at, persisted atomically
 * to WatermelonDB.
 *
 * @param sessionId - ID of the session to end
 * @param db - Optional database instance (for testing)
 */
export async function endSessionWithPersistence(
  sessionId: string,
  db: Database = database,
): Promise<EndSessionPersistResult> {
  try {
    await db.write(async () => {
      const record = await db.get('workout_sessions').find(sessionId);
      await (record as any).update((r: any) => {
        r._raw.ended_at = Date.now();
        r._raw.updated_at = Date.now();
      });
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
