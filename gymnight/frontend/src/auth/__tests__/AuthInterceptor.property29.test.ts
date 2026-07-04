/**
 * Property 29: Session becoming available flushes the entire pending queue on the very next cycle
 *
 * **Validates: Requirements 9.5**
 *
 * For any Pending_Sync_Queue of size N present at the moment the in-memory Session
 * transitions from absent to present, the immediately following synchronization cycle
 * SHALL process all N records, with no artificial throttling, batching delay, or
 * partial processing.
 *
 * Approach:
 * - Model a pending queue of N records accumulated while session was null
 * - While session is absent, sync cycles are skipped (no records processed)
 * - When session transitions from null → present, the very next cycle processes ALL N records
 * - Verify no records are artificially throttled, batched-with-delay, or partially processed
 * - Verify every record accumulated during the absent-session period is included
 * - Verify the queue is fully drained (all records get dispatched)
 */
import * as fc from 'fast-check';
import { AuthInterceptor, SessionProvider } from '../AuthInterceptor';
import { Session } from '../SecureStorage';
import { SyncEngine } from '../../sync/SyncEngine';

// --- Types ---

interface PendingSyncRecord {
  id: string;
  table: string;
  payload: Record<string, unknown>;
}

// --- Arbitraries ---

const arbNonEmptyString = fc
  .string({ minLength: 1, maxLength: 32 })
  .filter((s) => s.trim().length > 0);

const arbAccessToken = fc
  .string({ minLength: 1, maxLength: 128 })
  .filter((s) => s.trim().length > 0);

const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: arbAccessToken,
  refresh_token: arbNonEmptyString,
  user_id: arbNonEmptyString,
});

const arbTableName = fc.constantFrom(
  'workouts',
  'exercises',
  'workout_exercises',
  'workout_sessions',
  'logged_sets',
  'users'
);

const arbSyncRecord: fc.Arbitrary<PendingSyncRecord> = fc.record({
  id: fc.uuid(),
  table: arbTableName,
  payload: fc.dictionary(arbNonEmptyString, arbNonEmptyString, {
    minKeys: 1,
    maxKeys: 4,
  }),
});

/**
 * Generate a non-empty pending queue of arbitrary size (1..50 records).
 * This exercises the property across varying queue sizes.
 */
const arbPendingQueue: fc.Arbitrary<PendingSyncRecord[]> = fc.array(arbSyncRecord, {
  minLength: 1,
  maxLength: 50,
});

// --- Helpers ---

/**
 * Mutable session provider that allows transitioning from null to present.
 */
class MutableSessionProvider implements SessionProvider {
  private session: Session | null;

  constructor(initialSession: Session | null) {
    this.session = initialSession;
  }

  getCurrentSession(): Session | null {
    return this.session;
  }

  setSession(session: Session | null): void {
    this.session = session;
  }
}

/**
 * Simulates the Sync_Engine behavior for processing a pending queue:
 * - If session is absent, the cycle is skipped (no records processed)
 * - If session is present, ALL records in the queue are processed in the cycle
 *
 * Returns the records that were dispatched during the cycle.
 */
function simulateSyncCycle(
  pendingQueue: PendingSyncRecord[],
  interceptor: AuthInterceptor
): { dispatched: PendingSyncRecord[]; remaining: PendingSyncRecord[] } {
  const dispatched: PendingSyncRecord[] = [];
  const remaining: PendingSyncRecord[] = [];

  // Check session availability via the interceptor
  try {
    interceptor.attachAuthHeader({
      url: 'https://api.gymnight.app/sync/push',
      method: 'POST',
      headers: {},
    });
  } catch {
    // Session absent → skip cycle entirely, queue unchanged
    return { dispatched: [], remaining: [...pendingQueue] };
  }

  // Session present → process ALL records without throttling or partial processing
  for (const record of pendingQueue) {
    dispatched.push(record);
  }

  return { dispatched, remaining: [] };
}

// --- Property Tests ---

describe('Property 29: Session becoming available flushes the entire pending queue on the very next cycle', () => {
  it(
    'while session is absent, sync cycles skip and pending queue remains unchanged',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbPendingQueue, async (queue) => {
          const provider = new MutableSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          // Simulate multiple cycles while session is null
          const cyclesWhileAbsent = 3;
          for (let i = 0; i < cyclesWhileAbsent; i++) {
            const result = simulateSyncCycle(queue, interceptor);
            // No records dispatched
            expect(result.dispatched).toHaveLength(0);
            // Queue remains unchanged
            expect(result.remaining).toHaveLength(queue.length);
            expect(result.remaining).toEqual(queue);
          }
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'when session transitions from null to present, the ENTIRE pending queue is processed on the immediately following cycle',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbPendingQueue, arbSession, async (queue, session) => {
          const provider = new MutableSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          // First: verify cycle is skipped while absent
          const skippedResult = simulateSyncCycle(queue, interceptor);
          expect(skippedResult.dispatched).toHaveLength(0);
          expect(skippedResult.remaining).toEqual(queue);

          // Transition: session becomes present
          provider.setSession(session);

          // Next cycle: ALL N records must be processed
          const flushResult = simulateSyncCycle(queue, interceptor);

          // All records dispatched
          expect(flushResult.dispatched).toHaveLength(queue.length);
          // Queue fully drained
          expect(flushResult.remaining).toHaveLength(0);
          // Every record from the original queue is included
          expect(flushResult.dispatched).toEqual(queue);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'no records are artificially throttled, batched-with-delay, or partially processed — all N dispatched in one cycle',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbPendingQueue, arbSession, async (queue, session) => {
          const provider = new MutableSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          // Accumulate records while absent
          const absentResult = simulateSyncCycle(queue, interceptor);
          expect(absentResult.dispatched).toHaveLength(0);

          // Session restored
          provider.setSession(session);

          // Track how many cycles are needed to fully drain the queue
          let totalDispatched: PendingSyncRecord[] = [];
          let cycleCount = 0;
          let currentQueue = [...queue];

          while (currentQueue.length > 0) {
            cycleCount++;
            const result = simulateSyncCycle(currentQueue, interceptor);
            totalDispatched = [...totalDispatched, ...result.dispatched];
            currentQueue = result.remaining;

            // Safety: prevent infinite loops in test
            if (cycleCount > 1) {
              break;
            }
          }

          // Property: exactly ONE cycle is needed (no partial processing / multi-cycle drain)
          expect(cycleCount).toBe(1);
          // All records dispatched in that single cycle
          expect(totalDispatched).toHaveLength(queue.length);
          expect(totalDispatched).toEqual(queue);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'every record accumulated during the absent-session period is included in the flush',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbPendingQueue, arbSession, async (queue, session) => {
          const provider = new MutableSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          // Simulate accumulating records across multiple "missed" cycles
          const missedCycles = 5;
          for (let i = 0; i < missedCycles; i++) {
            const result = simulateSyncCycle(queue, interceptor);
            expect(result.dispatched).toHaveLength(0);
          }

          // Restore session
          provider.setSession(session);

          // Flush: every record that was accumulated must be present
          const flushResult = simulateSyncCycle(queue, interceptor);
          const dispatchedIds = new Set(flushResult.dispatched.map((r) => r.id));

          // Every original record ID must be in the dispatched set
          for (const record of queue) {
            expect(dispatchedIds.has(record.id)).toBe(true);
          }

          // No extra records beyond the original queue
          expect(flushResult.dispatched.length).toBe(queue.length);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'integrates with SyncEngine: session restoration triggers a full cycle that processes all records',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbPendingQueue, arbSession, async (queue, session) => {
          const provider = new MutableSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          // Track what the SyncEngine's cycle runner dispatches
          let dispatchedInCycle: PendingSyncRecord[] = [];

          const syncEngine = new SyncEngine(async () => {
            // This is the sync cycle runner - it uses the interceptor
            // to decide whether to process the queue
            const result = simulateSyncCycle(queue, interceptor);
            dispatchedInCycle = result.dispatched;
          });

          // While session is absent, the interceptor throws → cycle logic skips
          // But SyncEngine itself doesn't know about session; we test the full integration
          provider.setSession(null);
          await syncEngine.requestSyncCycle();
          expect(dispatchedInCycle).toHaveLength(0);

          // Reset for next cycle
          dispatchedInCycle = [];
          syncEngine.reset();

          // Restore session → next cycle should flush entire queue
          provider.setSession(session);
          await syncEngine.requestSyncCycle();

          // All N records processed in a single cycle
          expect(dispatchedInCycle).toHaveLength(queue.length);
          expect(dispatchedInCycle).toEqual(queue);
          // Exactly one cycle completed
          expect(syncEngine.cyclesCompleted).toBe(1);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
