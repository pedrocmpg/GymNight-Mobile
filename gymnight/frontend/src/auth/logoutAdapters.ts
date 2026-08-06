import type { Database } from '@nozbe/watermelondb';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseLogoutPort, LogoutStoragePort, LogoutWipePort } from './LogoutManager';
import type { SessionStore } from './sessionStore';
import { clearSession } from './SecureStorage';
import { clearLastPulledAt } from '../sync/lastPulledAt';

const SYNCABLE_TABLES = [
  'users',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sessions',
  'logged_sets',
] as const;

/** Implements SupabaseLogoutPort (LogoutManager.ts) — Requirement 7.1. */
export function createSupabaseLogoutPort(client: SupabaseClient): SupabaseLogoutPort {
  return {
    async invalidateSession() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },
  };
}

/** Implements LogoutStoragePort (LogoutManager.ts) — Requirement 7.2. */
export function createLogoutStoragePort(sessionStore: SessionStore): LogoutStoragePort {
  return {
    async clearSession() {
      await clearSession();
      sessionStore.clear();
    },
  };
}

/** Implements LogoutWipePort (LogoutManager.ts) — Requirement 7.3. */
export function createLogoutWipePort(db: Database): LogoutWipePort {
  return {
    async wipeAllTablesAndCursor() {
      await db.write(async () => {
        for (const table of SYNCABLE_TABLES) {
          const records = await db.get(table).query().fetch();
          if (records.length > 0) {
            await db.batch(...records.map((r) => r.prepareDestroyPermanently()));
          }
        }
      });
      clearLastPulledAt();
    },
  };
}
