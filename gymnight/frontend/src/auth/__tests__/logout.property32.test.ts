/**
 * Property 32: Declining the logout confirmation leaves session, domain records,
 * and pending queue byte-for-byte unchanged
 *
 * **Validates: Requirements 12.2**
 *
 * For any arbitrary state (session, domain records, pending queue) with a non-empty
 * Pending_Sync_Queue:
 * 1. When the user DECLINES the logout confirmation, the session remains unchanged
 * 2. All domain records remain byte-for-byte identical
 * 3. The pending queue remains unchanged
 * 4. No side effects occur at all (no network calls, no storage writes, no data modifications)
 * 5. This is an absolute invariant — declining ALWAYS means zero changes
 */
import * as fc from 'fast-check';
import {
  LogoutManager,
  LocalState,
  DomainRecord,
  PendingSyncItem,
  SupabaseLogoutPort,
  LogoutStoragePort,
  LogoutWipePort,
} from '../LogoutManager';
import { Session } from '../SecureStorage';

// --- Arbitraries ---

/** Generates an arbitrary Session */
const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: fc.string({ minLength: 1, maxLength: 64 }),
  refresh_token: fc.string({ minLength: 1, maxLength: 64 }),
  user_id: fc.uuid(),
});

/** Generates an arbitrary domain record */
const arbDomainRecord: fc.Arbitrary<DomainRecord> = fc.record({
  id: fc.uuid(),
  table: fc.constantFrom('users', 'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'logged_sets'),
  data: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 16 }),
    fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
  ),
});

/** Generates an arbitrary pending sync item */
const arbPendingSyncItem: fc.Arbitrary<PendingSyncItem> = fc.record({
  id: fc.uuid(),
  table: fc.constantFrom('users', 'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'logged_sets'),
  operation: fc.constantFrom('create' as const, 'update' as const, 'delete' as const),
  payload: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 16 }),
    fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
  ),
});

/**
 * Generates a LocalState with a NON-EMPTY pending queue.
 * This ensures the confirmation prompt is always shown (required for the "decline" path).
 */
const arbLocalStateWithNonEmptyQueue: fc.Arbitrary<LocalState> = fc.record({
  session: fc.oneof(arbSession, fc.constant(null)),
  domainRecords: fc.array(arbDomainRecord, { minLength: 0, maxLength: 10 }),
  pendingQueue: fc.array(arbPendingSyncItem, { minLength: 1, maxLength: 10 }),
});

// --- Helpers ---

/**
 * Creates side-effect-tracking ports that record all calls.
 * Any call to these ports is a test failure (the declined logout should produce zero calls).
 */
function createTrackingPorts() {
  const calls: string[] = [];

  const supabase: SupabaseLogoutPort = {
    async invalidateSession() {
      calls.push('supabase.invalidateSession');
    },
  };

  const storage: LogoutStoragePort = {
    async clearSession() {
      calls.push('storage.clearSession');
    },
  };

  const wipe: LogoutWipePort = {
    async wipeAllTablesAndCursor() {
      calls.push('wipe.wipeAllTablesAndCursor');
    },
  };

  return { supabase, storage, wipe, calls };
}

/**
 * Deep-clones a value using JSON roundtrip (sufficient for our plain data types).
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// --- Property Tests ---

describe('Property 32: Declining the logout confirmation leaves session, domain records, and pending queue byte-for-byte unchanged', () => {
  it(
    'session remains unchanged when user declines logout confirmation',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbLocalStateWithNonEmptyQueue, async (state) => {
          const snapshotBefore = deepClone(state);
          const { supabase, storage, wipe } = createTrackingPorts();

          const manager = new LogoutManager({
            confirmationPrompt: async () => false, // User DECLINES
            supabase,
            storage,
            wipe,
          });

          const result = await manager.requestLogout(state);

          // Must abort
          expect(result.outcome).toBe('aborted');
          // Session unchanged
          expect(state.session).toEqual(snapshotBefore.session);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'all domain records remain byte-for-byte identical when user declines',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbLocalStateWithNonEmptyQueue, async (state) => {
          const snapshotBefore = deepClone(state);
          const { supabase, storage, wipe } = createTrackingPorts();

          const manager = new LogoutManager({
            confirmationPrompt: async () => false, // User DECLINES
            supabase,
            storage,
            wipe,
          });

          await manager.requestLogout(state);

          // Domain records unchanged
          expect(state.domainRecords).toEqual(snapshotBefore.domainRecords);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'pending queue remains unchanged when user declines',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbLocalStateWithNonEmptyQueue, async (state) => {
          const snapshotBefore = deepClone(state);
          const { supabase, storage, wipe } = createTrackingPorts();

          const manager = new LogoutManager({
            confirmationPrompt: async () => false, // User DECLINES
            supabase,
            storage,
            wipe,
          });

          await manager.requestLogout(state);

          // Pending queue unchanged
          expect(state.pendingQueue).toEqual(snapshotBefore.pendingQueue);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'no side effects occur at all when user declines (no network calls, no storage writes, no data modifications)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbLocalStateWithNonEmptyQueue, async (state) => {
          const { supabase, storage, wipe, calls } = createTrackingPorts();

          const manager = new LogoutManager({
            confirmationPrompt: async () => false, // User DECLINES
            supabase,
            storage,
            wipe,
          });

          await manager.requestLogout(state);

          // Zero side effect calls should have been made
          expect(calls).toEqual([]);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'declining ALWAYS means zero changes — absolute invariant across any valid state',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbLocalStateWithNonEmptyQueue, async (state) => {
          const snapshotBefore = deepClone(state);
          const { supabase, storage, wipe, calls } = createTrackingPorts();

          const manager = new LogoutManager({
            confirmationPrompt: async () => false, // User DECLINES
            supabase,
            storage,
            wipe,
          });

          const result = await manager.requestLogout(state);

          // Result must be aborted
          expect(result.outcome).toBe('aborted');
          // Complete state unchanged (session + domain + queue)
          expect(state).toEqual(snapshotBefore);
          // No side effects
          expect(calls).toEqual([]);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
