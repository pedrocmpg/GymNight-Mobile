import { Database } from '@nozbe/watermelondb';
import database from '../../db/database';
import { startSession } from './sessionLifecycle';
import type { StartSessionPersistResult } from '../../navigation/startSessionRouting';

/**
 * Starts a WorkoutSession and persists it atomically to WatermelonDB.
 *
 * Uses sessionLifecycle.startSession() to build the pure data shape, then
 * writes it inside a single database.write() transaction.
 *
 * @param userId - Authenticated user's ID
 * @param workoutId - Workout template ID to scope the session to (undefined for freestyle)
 * @param db - Optional database instance (for testing)
 */
export async function startSessionWithPersistence(
  userId: string,
  workoutId: string | undefined,
  db: Database = database,
): Promise<StartSessionPersistResult> {
  try {
    const sessionData = startSession(userId, workoutId);
    const record = await db.write(async () => {
      return db.get('workout_sessions').create((r: any) => {
        r._raw.user_id = sessionData.user_id;
        r._raw.workout_id = sessionData.workout_id;
        r._raw.started_at = sessionData.started_at;
        r._raw.ended_at = sessionData.ended_at;
        r._raw.created_at = Date.now();
        r._raw.updated_at = Date.now();
      });
    });

    return { success: true, sessionId: record.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
