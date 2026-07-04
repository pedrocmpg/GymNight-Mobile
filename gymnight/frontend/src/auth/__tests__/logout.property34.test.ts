/**
 * Property 34: Logout completion always wipes all six local tables and last_pulled_at,
 * retrying once before blocking navigation on repeated failure
 *
 * **Validates: Requirements 12.4, 12.5, 12.6**
 *
 * 1. On confirmed logout with successful wipe: outcome is 'completed' and wipe was called exactly once
 * 2. On first wipe failure + retry success: outcome is still 'completed' and wipe was called exactly twice
 * 3. On both wipe attempts failing: outcome is 'wipe_failed' with an error (navigation blocked)
 * 4. The wipe is always attempted (never skipped on confirmed logout)
 * 5. At most 2 wipe attempts are made (original + 1 retry, never more)
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
  LogoutResult,
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
 * Generates a LocalState where the logout will proceed (either empty queue or confirmed).
 * Covers both empty-queue (no prompt) and non-empty-queue (user confirms) scenarios.
 */
const arbLocalState: fc.Arbitrary<LocalState> = fc.oneof(
  // Empty queue — no prompt needed
  fc.record({
    session: fc.oneof(arbSession, fc.constant(null)),
    domainRecords: fc.array(arbDomainRecord, { minLength: 0, maxLength: 5 }),
    pendingQueue: fc.constant([] as PendingSyncItem[]),
  }),
  // Non-empty queue — user will confirm
  fc.record({
    session: fc.oneof(arbSession, fc.constant(null)),
    domainRecords: fc.array(arbDomainRecord, { minLength: 0, maxLength: 5 }),
    pendingQueue: fc.array(arbPendingSyncItem, { minLength: 1, maxLength: 5 }),
  })
);

/**
 * Wipe behavior scenarios:
 * - 'success': first call succeeds
 * - 'fail_then_success': first call fails, retry succeeds
 * - 'fail_both': both calls fail
 */
type WipeBehavior = 'success' | 'fail_then_success' | 'fail_both';

const arbWipeBehavior: fc.Arbitrary<WipeBehavior> = fc.constantFrom(
  'success' as const,
  'fail_then_success' as const,
  'fail_both' as const
);

// --- Helpers ---

/**
 * Creates ports with a configurable wipe behavior, tracking call counts.
 */
function createTestPorts(wipeBehavior: WipeBehavior) {
  let wipeCallCount = 0;

  const supabase: SupabaseLogoutPort = {
    async invalidateSession() {
      // Best-effort — always succeeds for these tests
    },
  };

  const storage: LogoutStoragePort = {
    async clearSession() {
      // Always succeeds
    },
  };

  const wipe: LogoutWipePort = {
    async wipeAllTablesAndCursor() {
      wipeCallCount++;
      if (wipeBehavior === 'success') {
        return; // Always succeeds
      }
      if (wipeBehavior === 'fail_then_success') {
        if (wipeCallCount === 1) {
          throw new Error('Wipe failed on first attempt');
        }
        return; // Second attempt succeeds
      }
      if (wipeBehavior === 'fail_both') {
        throw new Error(`Wipe failed on attempt ${wipeCallCount}`);
      }
    },
  };

  return { supabase, storage, wipe, getWipeCallCount: () => wipeCallCount };
}

// --- Property Tests ---

describe('Property 34: Logout completion always wipes all six local tables and last_pulled_at, retrying once before blocking navigation on repeated failure', () => {
  it(
    'on confirmed logout with successful wipe: outcome is "completed" and wipe was called exactly once',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          async (state) => {
            const { supabase, storage, wipe, getWipeCallCount } = createTestPorts('success');

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            const result = await manager.requestLogout(state);

            expect(result.outcome).toBe('completed');
            expect(getWipeCallCount()).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'on first wipe failure + retry success: outcome is "completed" and wipe was called exactly twice',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          async (state) => {
            const { supabase, storage, wipe, getWipeCallCount } = createTestPorts('fail_then_success');

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            const result = await manager.requestLogout(state);

            expect(result.outcome).toBe('completed');
            expect(getWipeCallCount()).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'on both wipe attempts failing: outcome is "wipe_failed" with an error (navigation blocked)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          async (state) => {
            const { supabase, storage, wipe, getWipeCallCount } = createTestPorts('fail_both');

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            const result = await manager.requestLogout(state);

            expect(result.outcome).toBe('wipe_failed');
            expect(result).toHaveProperty('error');
            expect((result as { outcome: 'wipe_failed'; error: Error }).error).toBeInstanceOf(Error);
            expect(getWipeCallCount()).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'wipe is always attempted (never skipped on confirmed logout)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          arbWipeBehavior,
          async (state, wipeBehavior) => {
            const { supabase, storage, wipe, getWipeCallCount } = createTestPorts(wipeBehavior);

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // Wipe must always be attempted at least once
            expect(getWipeCallCount()).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'at most 2 wipe attempts are made (original + 1 retry, never more)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbLocalState,
          arbWipeBehavior,
          async (state, wipeBehavior) => {
            const { supabase, storage, wipe, getWipeCallCount } = createTestPorts(wipeBehavior);

            const manager = new LogoutManager({
              confirmationPrompt: async () => true,
              supabase,
              storage,
              wipe,
            });

            await manager.requestLogout(state);

            // Never more than 2 attempts
            expect(getWipeCallCount()).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );
});
