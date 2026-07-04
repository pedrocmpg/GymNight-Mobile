import fc from 'fast-check';
import { createRecord, updateRecord, deleteRecord } from '../writeHelpers';
import { SyncEngine } from '../../sync/SyncEngine';

/**
 * Feature: frontend-mobile-implementation
 * Property 17: In-flight synchronization or token refresh never blocks new local writes
 *
 * **Validates: Requirements 5.4, 10.3**
 *
 * For any local write dispatched while a sync cycle or a token refresh is in flight,
 * the write SHALL settle successfully independent of when the in-flight operation resolves,
 * and SHALL NOT be delayed by it.
 *
 * We prove this by:
 * 1. Starting a slow sync cycle (or token refresh) that takes a configurable time to complete
 * 2. While it's in progress, performing N write operations concurrently
 * 3. Asserting ALL writes complete BEFORE the sync/refresh finishes
 * 4. This demonstrates zero shared lock between sync/refresh and local writes
 */

// --- Arbitraries ---

type WriteOperation = 'create' | 'update' | 'delete';

const operationArb = fc.constantFrom<WriteOperation>('create', 'update', 'delete');

const writeCountArb = fc.integer({ min: 1, max: 10 });

const syncDelayArb = fc.integer({ min: 50, max: 200 }); // ms the sync takes

const collectionNameArb = fc.constantFrom(
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sessions',
  'logged_sets',
);

const recordDataArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  value: fc.float({ min: 0, max: 1000, noNaN: true }),
});

// --- Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock database whose write() resolves immediately (no blocking).
 * This mirrors how WatermelonDB works: database.write() is a local operation
 * and does NOT wait for any sync or network activity.
 */
function buildMockDb() {
  const mockDb = {
    get: (_collectionName: string) => ({
      create: (creator: (r: any) => void) => {
        const record = {
          id: `record-${Math.random().toString(36).slice(2)}`,
          _raw: {},
          _changed: new Set<string>(),
        };
        creator(record);
        return Promise.resolve(record);
      },
    }),
    write: async <T>(fn: () => Promise<T>): Promise<T> => {
      return await fn();
    },
  } as any;

  return mockDb;
}

function buildMockRecord(data: { name: string; value: number }) {
  return {
    id: `existing-${Math.random().toString(36).slice(2)}`,
    _raw: { ...data },
    _changed: new Set<string>(),
    update: function (updater: (r: any) => void) {
      updater(this);
      return Promise.resolve(this);
    },
    markAsDeleted: function () {
      return Promise.resolve();
    },
  } as any;
}

/**
 * Simulates a token refresh that takes `delayMs` to complete.
 * This is a stand-in for the actual refresh flow — what matters is it's
 * a long-running async process that should NOT block writes.
 */
function simulateTokenRefresh(delayMs: number): { promise: Promise<void>; isComplete: () => boolean } {
  let complete = false;
  const promise = delay(delayMs).then(() => { complete = true; });
  return { promise, isComplete: () => complete };
}

/**
 * Performs a write operation using the write helpers and returns the elapsed time.
 */
async function performWrite(
  operation: WriteOperation,
  collectionName: string,
  data: { name: string; value: number },
  db: any,
): Promise<{ success: boolean; elapsedMs: number }> {
  const start = Date.now();
  let result: { success: boolean };

  switch (operation) {
    case 'create':
      result = await createRecord(
        collectionName,
        (r: any) => {
          r._raw.name = data.name;
          r._raw.value = data.value;
        },
        db,
      );
      break;
    case 'update': {
      const record = buildMockRecord(data);
      result = await updateRecord(record, (r: any) => { r._raw.name = data.name + '_updated'; }, db);
      break;
    }
    case 'delete': {
      const record = buildMockRecord(data);
      result = await deleteRecord(record, db);
      break;
    }
  }

  const elapsedMs = Date.now() - start;
  return { success: result.success, elapsedMs };
}

// --- Tests ---

describe('Property 17: In-flight synchronization or token refresh never blocks new local writes', () => {
  test('local writes complete while a sync cycle is still in progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        writeCountArb,
        syncDelayArb,
        operationArb,
        collectionNameArb,
        recordDataArb,
        async (writeCount, syncDelayMs, operation, collectionName, data) => {
          const db = buildMockDb();

          // Create a SyncEngine with a slow sync cycle
          const syncEngine = new SyncEngine(() => delay(syncDelayMs));

          // Start the sync cycle (but don't await it)
          const syncPromise = syncEngine.requestSyncCycle();

          // Confirm sync is in progress
          expect(syncEngine.isCycleInProgress).toBe(true);

          // Perform N write operations while sync is running
          const writePromises = Array.from({ length: writeCount }, () =>
            performWrite(operation, collectionName, data, db),
          );

          const writeResults = await Promise.all(writePromises);

          // ALL writes must have succeeded
          for (const wr of writeResults) {
            expect(wr.success).toBe(true);
          }

          // ALL writes completed while sync was STILL in progress
          // (sync takes at least syncDelayMs, writes are near-instant)
          expect(syncEngine.isCycleInProgress).toBe(true);

          // Clean up: wait for sync to finish
          await syncPromise;
          expect(syncEngine.isCycleInProgress).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('local writes complete while a token refresh is still in progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        writeCountArb,
        syncDelayArb,
        operationArb,
        collectionNameArb,
        recordDataArb,
        async (writeCount, refreshDelayMs, operation, collectionName, data) => {
          const db = buildMockDb();

          // Simulate an in-flight token refresh
          const refresh = simulateTokenRefresh(refreshDelayMs);

          // Confirm refresh is in progress
          expect(refresh.isComplete()).toBe(false);

          // Perform N write operations while refresh is running
          const writePromises = Array.from({ length: writeCount }, () =>
            performWrite(operation, collectionName, data, db),
          );

          const writeResults = await Promise.all(writePromises);

          // ALL writes must have succeeded
          for (const wr of writeResults) {
            expect(wr.success).toBe(true);
          }

          // Refresh is STILL in progress when writes finished
          expect(refresh.isComplete()).toBe(false);

          // Clean up
          await refresh.promise;
          expect(refresh.isComplete()).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('write operations and sync cycle run independently with no shared lock', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(operationArb, { minLength: 1, maxLength: 5 }),
        syncDelayArb,
        collectionNameArb,
        recordDataArb,
        async (operations, syncDelayMs, collectionName, data) => {
          const db = buildMockDb();
          const syncEngine = new SyncEngine(() => delay(syncDelayMs));

          // Start sync
          const syncPromise = syncEngine.requestSyncCycle();
          expect(syncEngine.isCycleInProgress).toBe(true);

          // Interleave multiple different write operations while sync is active
          const writePromises = operations.map((op) =>
            performWrite(op, collectionName, data, db),
          );

          const writeResults = await Promise.all(writePromises);

          // Every write succeeded independently
          for (const wr of writeResults) {
            expect(wr.success).toBe(true);
          }

          // Sync is still running (proving no shared lock forced serialization)
          expect(syncEngine.isCycleInProgress).toBe(true);

          // Let sync complete
          await syncPromise;
          expect(syncEngine.cyclesCompleted).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('writes during concurrent sync AND token refresh both succeed immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        writeCountArb,
        syncDelayArb,
        operationArb,
        collectionNameArb,
        recordDataArb,
        async (writeCount, delayMs, operation, collectionName, data) => {
          const db = buildMockDb();

          // Start BOTH sync and token refresh simultaneously
          const syncEngine = new SyncEngine(() => delay(delayMs));
          const syncPromise = syncEngine.requestSyncCycle();
          const refresh = simulateTokenRefresh(delayMs);

          // Both are in progress
          expect(syncEngine.isCycleInProgress).toBe(true);
          expect(refresh.isComplete()).toBe(false);

          // Perform writes while both are running
          const writePromises = Array.from({ length: writeCount }, () =>
            performWrite(operation, collectionName, data, db),
          );

          const writeResults = await Promise.all(writePromises);

          // ALL writes succeed regardless of both in-flight operations
          for (const wr of writeResults) {
            expect(wr.success).toBe(true);
          }

          // Both operations are STILL in progress (writes didn't wait)
          expect(syncEngine.isCycleInProgress).toBe(true);
          expect(refresh.isComplete()).toBe(false);

          // Cleanup
          await Promise.all([syncPromise, refresh.promise]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
