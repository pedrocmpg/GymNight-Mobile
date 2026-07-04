/**
 * Property 33: Secure_Storage is always cleared on confirmed/empty-queue logout
 * regardless of the Supabase invalidation outcome
 *
 * **Validates: Requirements 12.3**
 *
 * For any arbitrary Supabase invalidation outcome (success, network error, timeout):
 * 1. `clearSession()` is ALWAYS called on confirmed logout, regardless of whether
 *    Supabase invalidation succeeded or failed
 * 2. The Supabase outcome (success or failure) does NOT influence whether storage is cleared
 * 3. This holds for empty queue (no prompt) AND confirmed non-empty queue
 * 4. `clearSession()` is called AFTER the Supabase attempt (regardless of its result)
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
 * Generates a LocalState with an EMPTY pending queue.
 * Empty queue means no prompt is shown — logout proceeds directly.
 */
const arbLocalStateWithEmptyQueue: fc.Arbitrary<LocalState> = fc.record({
  session: fc.oneof(arbSession, fc.constant(null)),
  domainRecords: fc.array(arbDomainRecord, { minLength: 0, maxLength: 10 }),
  pendingQueue: fc.constant([]),
});

/**
 * Generates a LocalState with a NON-EMPTY pending queue.
 * User will be prompted and we simulate confirmation.
 */
const arbLocalStateWithNonEmptyQueue: fc.Arbitrary<LocalState> = fc.record({
  session: fc.oneof(arbSession, fc.constant(null)),
  domainRecords: fc.array(arbDomainRecord, { minLength: 0, maxLength: 10 }),
  pendingQueue: fc.array(arbPendingSyncItem, { minLength: 1, maxLength: 10 }),
});

/**
 * Generates any valid LocalState (both empty and non-empty queues).
 */
const arbLocalState: fc.Arbitrary<LocalState> = fc.oneof(
  arbLocalStateWithEmptyQueue,
  arbLocalStateWithNonEmptyQueue
);

/**
 * Represents different Supabase invalidation outcomes.
 * - 'success': invalidateSession resolves normally
 * - 'network_error': invalidateSession rejects with a network Error
 * - 'timeout': invalidateSession rejects with a timeout Error
 */
type SupabaseOutcome = 'success' | 'network_error' | 'timeout';

const arbSupabaseOutcome: fc.Arbitrary<SupabaseOutcome> = fc.constantFrom(
  'success' as const,
  'network_error' as const,
  'timeout' as const
);

// --- Helpers ---

/**
 * Creates ports with order-tracking and configurable Supabase behavior.
 */
function createOrderTrackingPorts(supabaseOutcome: SupabaseOutcome) {
  const callOrder: string[] = [];

  const supabase: SupabaseLogoutPort = {
    async invalidateSession() {
      callOrder.push('supabase.invalidateSession');
      if (supabaseOutcome === 'network_error') {
        throw new Error('Network error: Unable to reach Supabase');
      }
      if (supabaseOutcome === 'timeout') {
        throw new Error('Timeout: Supabase request timed out');
      }
      // 'success' — resolves normally
    },
  };

  const storage: LogoutStoragePort = {
    async clearSession() {
      callOrder.push('storage.clearSession');
    },
  };

  const wipe: LogoutWipePort = {
    async wipeAllTablesAndCursor() {
      callOrder.push('wipe.wipeAllTablesAndCursor');
    },
  };

  return { supabase, storage, wipe, callOrder };
}

// --- Property Tests ---

describe('Property 33: Secure_Storage is always cleared on confirmed/empty-queue logout regardless of the Supabase invalidation outcome', () => {
  it(
    'clearSession() is ALWAYS called on confirmed logout regardless of Supabase outcome',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          arbSupabaseOutcome,
          async (state, supabaseOutcome) => {
            const { supabase, storage, wipe, callOrder } = createOrderTrackingPorts(supabaseOutcome);

            const manager = new LogoutManager({
              confirmationPrompt: async () => true, // User CONFIRMS
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // clearSession must ALWAYS be called
            expect(callOrder).toContain('storage.clearSession');
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'Supabase outcome (success or failure) does NOT influence whether storage is cleared',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          arbSupabaseOutcome,
          async (state, supabaseOutcome) => {
            const { supabase, storage, wipe, callOrder } = createOrderTrackingPorts(supabaseOutcome);

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // Count clearSession calls — must be exactly 1 regardless of Supabase outcome
            const clearSessionCalls = callOrder.filter(c => c === 'storage.clearSession');
            expect(clearSessionCalls).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'holds for empty queue (no prompt) — clearSession is called regardless of Supabase outcome',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalStateWithEmptyQueue,
          arbSupabaseOutcome,
          async (state, supabaseOutcome) => {
            const { supabase, storage, wipe, callOrder } = createOrderTrackingPorts(supabaseOutcome);

            const manager = new LogoutManager({
              confirmationPrompt: async () => {
                throw new Error('Should not be called for empty queue');
              },
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // clearSession must still be called
            expect(callOrder).toContain('storage.clearSession');
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'holds for confirmed non-empty queue — clearSession is called regardless of Supabase outcome',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalStateWithNonEmptyQueue,
          arbSupabaseOutcome,
          async (state, supabaseOutcome) => {
            const { supabase, storage, wipe, callOrder } = createOrderTrackingPorts(supabaseOutcome);

            const manager = new LogoutManager({
              confirmationPrompt: async () => true, // User CONFIRMS
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // clearSession must still be called
            expect(callOrder).toContain('storage.clearSession');
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'clearSession() is called AFTER the Supabase attempt (regardless of its result)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          arbSupabaseOutcome,
          async (state, supabaseOutcome) => {
            const { supabase, storage, wipe, callOrder } = createOrderTrackingPorts(supabaseOutcome);

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // Supabase invalidation must have been attempted
            expect(callOrder).toContain('supabase.invalidateSession');

            // clearSession must come AFTER supabase.invalidateSession in the call order
            const supabaseIdx = callOrder.indexOf('supabase.invalidateSession');
            const clearSessionIdx = callOrder.indexOf('storage.clearSession');
            expect(clearSessionIdx).toBeGreaterThan(supabaseIdx);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );
});
