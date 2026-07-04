/**
 * Property 13: Successful pull applies changes atomically and advances
 * last_pulled_at only after full success; non-transient apply errors abort atomically.
 *
 * **Validates: Requirements 4.5, 6.4**
 *
 * Testa que:
 * 1. On success: all changes are applied AND `last_pulled_at` equals the response `timestamp`
 * 2. On success: `last_pulled_at` is ONLY advanced AFTER full application (never before)
 * 3. On error: NONE of the changes are applied (atomic abort — collection remains unchanged)
 * 4. On error: `last_pulled_at` does NOT advance (stays at its previous value)
 * 5. Partial application never occurs — either ALL changes apply or NONE do
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  applyPullChanges,
  type PullResponse,
  type StorageAdapter,
  type TablePullChanges,
} from '@/sync/pullApply';
import type { RawRecord } from '@/sync/syncAdapters';

// ---- In-memory StorageAdapter for testing ----

interface StoredRecord {
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: RawRecord | string;
}

/**
 * A simple in-memory StorageAdapter that tracks all applied changes
 * and supports snapshot/restore for atomicity verification.
 */
class TestStorageAdapter implements StorageAdapter {
  appliedChanges: StoredRecord[] = [];
  lastPulledAt: number | null = null;
  private failAtIndex: number | null = null;
  /** Track whether last_pulled_at was set before all changes were applied */
  lastPulledAtSetBeforeAllChanges = false;
  private expectedTotalChanges = 0;

  constructor(options?: {
    initialLastPulledAt?: number | null;
    failAtIndex?: number;
    expectedTotalChanges?: number;
  }) {
    this.lastPulledAt = options?.initialLastPulledAt ?? null;
    this.failAtIndex = options?.failAtIndex ?? null;
    this.expectedTotalChanges = options?.expectedTotalChanges ?? 0;
  }

  applyChange(
    table: string,
    operation: 'create' | 'update' | 'delete',
    data: RawRecord | string,
  ): void {
    if (
      this.failAtIndex !== null &&
      this.appliedChanges.length === this.failAtIndex
    ) {
      throw new Error(`Non-transient apply error at index ${this.failAtIndex}`);
    }
    this.appliedChanges.push({ table, operation, data });
  }

  getLastPulledAt(): number | null {
    return this.lastPulledAt;
  }

  setLastPulledAt(timestamp: number): void {
    // Track if this is called before all changes
    if (this.appliedChanges.length < this.expectedTotalChanges) {
      this.lastPulledAtSetBeforeAllChanges = true;
    }
    this.lastPulledAt = timestamp;
  }

  createSnapshot(): { appliedChanges: StoredRecord[]; lastPulledAt: number | null } {
    return {
      appliedChanges: [...this.appliedChanges],
      lastPulledAt: this.lastPulledAt,
    };
  }

  restoreSnapshot(snapshot: unknown): void {
    const s = snapshot as { appliedChanges: StoredRecord[]; lastPulledAt: number | null };
    this.appliedChanges = [...s.appliedChanges];
    this.lastPulledAt = s.lastPulledAt;
  }
}

// ---- Arbitraries ----

const SYNCABLE_TABLES = [
  'users',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sessions',
  'logged_sets',
] as const;

const arbTable = fc.constantFrom(...SYNCABLE_TABLES);

const arbRawRecord: fc.Arbitrary<RawRecord> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }),
});

const arbTablePullChanges: fc.Arbitrary<TablePullChanges> = fc.record({
  created: fc.array(arbRawRecord, { minLength: 0, maxLength: 5 }),
  updated: fc.array(arbRawRecord, { minLength: 0, maxLength: 5 }),
  deleted: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
});

/** Generates a valid PullResponse with 1-3 tables having changes */
const arbPullResponse: fc.Arbitrary<PullResponse> = fc
  .array(
    fc.tuple(arbTable, arbTablePullChanges),
    { minLength: 1, maxLength: 3 },
  )
  .chain((entries) => {
    // Deduplicate by table name
    const changesMap = new Map<string, TablePullChanges>();
    for (const [table, changes] of entries) {
      changesMap.set(table, changes);
    }
    const changes: { [table: string]: TablePullChanges } = {};
    for (const [table, c] of changesMap) {
      changes[table] = c;
    }
    return fc.nat({ max: 2000000000 }).map((ts) => ({
      changes,
      timestamp: ts + 1, // always positive
    }));
  });

/** Generates a PullResponse that has at least one change */
const arbNonEmptyPullResponse: fc.Arbitrary<PullResponse> = arbPullResponse.filter(
  (response) => {
    const totalChanges = countTotalChanges(response);
    return totalChanges > 0;
  },
);

const arbInitialLastPulledAt: fc.Arbitrary<number | null> = fc.oneof(
  fc.constant(null),
  fc.nat({ max: 1000000000 }),
);

// ---- Helpers ----

function countTotalChanges(response: PullResponse): number {
  let count = 0;
  for (const changes of Object.values(response.changes)) {
    count += changes.created.length + changes.updated.length + changes.deleted.length;
  }
  return count;
}

// ---- Property Tests ----

describe('Property 13: Successful pull applies changes atomically and advances last_pulled_at only after full success', () => {
  it('on success: all changes are applied AND last_pulled_at equals response timestamp', () => {
    fcAssert(
      fcProperty(
        arbPullResponse,
        arbInitialLastPulledAt,
        (response, initialLastPulledAt) => {
          const totalChanges = countTotalChanges(response);
          const storage = new TestStorageAdapter({
            initialLastPulledAt,
            expectedTotalChanges: totalChanges,
          });

          const result = applyPullChanges(response, storage);

          expect(result.success).toBe(true);
          // All changes applied
          expect(storage.appliedChanges.length).toBe(totalChanges);
          // last_pulled_at advanced to response timestamp
          expect(storage.lastPulledAt).toBe(response.timestamp);
        },
      ),
    );
  });

  it('on success: last_pulled_at is ONLY advanced AFTER full application (never before)', () => {
    fcAssert(
      fcProperty(
        arbNonEmptyPullResponse,
        arbInitialLastPulledAt,
        (response, initialLastPulledAt) => {
          const totalChanges = countTotalChanges(response);
          const storage = new TestStorageAdapter({
            initialLastPulledAt,
            expectedTotalChanges: totalChanges,
          });

          const result = applyPullChanges(response, storage);

          expect(result.success).toBe(true);
          // Verify that last_pulled_at was NOT set before all changes
          expect(storage.lastPulledAtSetBeforeAllChanges).toBe(false);
        },
      ),
    );
  });

  it('on error: NONE of the changes are applied (atomic abort — collection remains unchanged)', () => {
    fcAssert(
      fcProperty(
        arbNonEmptyPullResponse,
        arbInitialLastPulledAt,
        (response, initialLastPulledAt) => {
          const totalChanges = countTotalChanges(response);
          // Fail at a random valid index (0 to totalChanges-1)
          const failAt = totalChanges > 1
            ? Math.floor(Math.random() * totalChanges)
            : 0;

          const storage = new TestStorageAdapter({
            initialLastPulledAt,
            failAtIndex: failAt,
            expectedTotalChanges: totalChanges,
          });

          const result = applyPullChanges(response, storage);

          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          // After rollback: no changes remain applied
          expect(storage.appliedChanges.length).toBe(0);
        },
      ),
    );
  });

  it('on error: last_pulled_at does NOT advance (stays at its previous value)', () => {
    fcAssert(
      fcProperty(
        arbNonEmptyPullResponse,
        arbInitialLastPulledAt,
        (response, initialLastPulledAt) => {
          const totalChanges = countTotalChanges(response);
          const failAt = totalChanges > 1
            ? Math.floor(Math.random() * totalChanges)
            : 0;

          const storage = new TestStorageAdapter({
            initialLastPulledAt,
            failAtIndex: failAt,
            expectedTotalChanges: totalChanges,
          });

          const result = applyPullChanges(response, storage);

          expect(result.success).toBe(false);
          // last_pulled_at remains unchanged
          expect(storage.lastPulledAt).toBe(initialLastPulledAt);
        },
      ),
    );
  });

  it('partial application never occurs — either ALL changes apply or NONE do', () => {
    fcAssert(
      fcProperty(
        arbNonEmptyPullResponse,
        arbInitialLastPulledAt,
        fc.boolean(),
        (response, initialLastPulledAt, shouldFail) => {
          const totalChanges = countTotalChanges(response);

          const storage = new TestStorageAdapter({
            initialLastPulledAt,
            failAtIndex: shouldFail ? Math.floor(totalChanges / 2) : null,
            expectedTotalChanges: totalChanges,
          });

          const result = applyPullChanges(response, storage);

          if (result.success) {
            // ALL changes applied
            expect(storage.appliedChanges.length).toBe(totalChanges);
            expect(storage.lastPulledAt).toBe(response.timestamp);
          } else {
            // NONE of the changes applied (atomic rollback)
            expect(storage.appliedChanges.length).toBe(0);
            expect(storage.lastPulledAt).toBe(initialLastPulledAt);
          }
          // Never a partial state
          const isAllOrNone =
            storage.appliedChanges.length === totalChanges ||
            storage.appliedChanges.length === 0;
          expect(isAllOrNone).toBe(true);
        },
      ),
    );
  });
});
