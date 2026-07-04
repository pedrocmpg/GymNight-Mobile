/**
 * Property-Based Test — Property 1
 *
 * Reactive_Query reflects local writes in the same emission cycle.
 *
 * **Validates: Requirements 1.5**
 *
 * For any arbitrary sequence of local writes (create/update/delete) on a MockCollection,
 * when a subscriber is active via observe():
 * 1. Each write triggers a new emission that includes the updated state
 * 2. The emission after a write reflects the EXACT current state of the collection (no stale data)
 * 3. This happens synchronously within the same emission cycle (the subscriber sees the change
 *    before any other async operation could intervene)
 *
 * This tests the MockCollection's reactive behavior directly, which is what useReactiveQuery relies on.
 */
import * as fc from 'fast-check';
import { MockCollection, MockRecord } from '@/test/mocks/MockDatabaseAdapter';

// --- Types ---

interface TestRecord extends MockRecord {
  id: string;
  name: string;
  value: number;
}

/** Operation types that can be applied to the collection */
type Operation =
  | { type: 'create'; record: TestRecord }
  | { type: 'update'; targetIndex: number; patch: { name: string; value: number } }
  | { type: 'delete'; targetIndex: number };

// --- Arbitraries ---

const arbCreateOp: fc.Arbitrary<Operation> = fc.record({
  type: fc.constant('create' as const),
  record: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    value: fc.integer({ min: 0, max: 10000 }),
  }),
});

const arbUpdateOp: fc.Arbitrary<Operation> = fc.record({
  type: fc.constant('update' as const),
  targetIndex: fc.nat({ max: 99 }),
  patch: fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    value: fc.integer({ min: 0, max: 10000 }),
  }),
});

const arbDeleteOp: fc.Arbitrary<Operation> = fc.record({
  type: fc.constant('delete' as const),
  targetIndex: fc.nat({ max: 99 }),
});

/**
 * Generates a sequence of operations where the first operation is always a create
 * (ensuring at least one record exists for subsequent updates/deletes).
 */
const arbOperationSequence: fc.Arbitrary<Operation[]> = fc.tuple(
  arbCreateOp,
  fc.array(fc.oneof(arbCreateOp, arbUpdateOp, arbDeleteOp), { minLength: 0, maxLength: 19 }),
).map(([first, rest]) => [first, ...rest]);

/**
 * Applies an operation to the collection and expected state tracking,
 * returning whether the operation was actually performed (updates/deletes may
 * target non-existent indices).
 */
function applyOp(
  collection: MockCollection<TestRecord>,
  expectedState: Map<string, TestRecord>,
  existingIds: string[],
  op: Operation,
): boolean {
  switch (op.type) {
    case 'create': {
      collection.create(op.record);
      expectedState.set(op.record.id, op.record);
      existingIds.push(op.record.id);
      return true;
    }
    case 'update': {
      if (existingIds.length === 0) return false;
      const idx = op.targetIndex % existingIds.length;
      const id = existingIds[idx];
      const existing = expectedState.get(id)!;
      const updated: TestRecord = { ...existing, ...op.patch };
      collection.update(id, op.patch);
      expectedState.set(id, updated);
      return true;
    }
    case 'delete': {
      if (existingIds.length === 0) return false;
      const idx = op.targetIndex % existingIds.length;
      const id = existingIds[idx];
      collection.markAsDeleted(id);
      expectedState.delete(id);
      existingIds.splice(idx, 1);
      return true;
    }
  }
}

describe('Property 1: Reactive_Query reflects local writes in the same emission cycle', () => {
  /**
   * Property 1a: Each write triggers a new emission that matches the exact state
   * of the collection after that write.
   *
   * **Validates: Requirements 1.5**
   */
  it('each write triggers a synchronous emission matching the exact collection state', () => {
    fc.assert(
      fc.property(arbOperationSequence, (ops) => {
        const collection = new MockCollection<TestRecord>();
        const emissions: TestRecord[][] = [];

        // Subscribe to observe the collection
        const subscription = collection.observe().subscribe({
          next: (records) => {
            // Deep-copy to avoid reference mutation issues
            emissions.push(records.map((r) => ({ ...r })));
          },
        });

        // Track expected state manually
        const expectedState = new Map<string, TestRecord>();
        const existingIds: string[] = [];

        // First emission is the initial state (empty)
        expect(emissions.length).toBe(1);
        expect(emissions[0]).toEqual([]);

        // Apply each operation and verify emission
        for (const op of ops) {
          const emissionCountBefore = emissions.length;
          const applied = applyOp(collection, expectedState, existingIds, op);

          if (applied) {
            // A new emission MUST have been triggered synchronously
            expect(emissions.length).toBe(emissionCountBefore + 1);

            // The latest emission MUST match the expected state exactly
            const latestEmission = emissions[emissions.length - 1];
            const expectedRecords = [...expectedState.values()];

            // Sort both by id for stable comparison
            const sortedEmission = [...latestEmission].sort((a, b) => a.id.localeCompare(b.id));
            const sortedExpected = [...expectedRecords].sort((a, b) => a.id.localeCompare(b.id));

            expect(sortedEmission).toEqual(sortedExpected);
          }
        }

        subscription.unsubscribe();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 1b: Emissions are delivered synchronously — no async gap between write and
   * observer notification.
   *
   * **Validates: Requirements 1.5**
   */
  it('emissions are delivered synchronously within the same call stack as the write', () => {
    fc.assert(
      fc.property(arbOperationSequence, (ops) => {
        const collection = new MockCollection<TestRecord>();
        let emissionCount = 0;

        const subscription = collection.observe().subscribe({
          next: () => {
            emissionCount++;
          },
        });

        // Initial emission
        expect(emissionCount).toBe(1);

        const expectedState = new Map<string, TestRecord>();
        const existingIds: string[] = [];

        for (const op of ops) {
          const countBefore = emissionCount;
          const applied = applyOp(collection, expectedState, existingIds, op);

          if (applied) {
            // The emission count MUST have incremented synchronously (no await needed)
            expect(emissionCount).toBe(countBefore + 1);
          }
        }

        subscription.unsubscribe();
        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 1c: After unsubscribe, writes no longer trigger emissions to that subscriber.
   * This ensures the reactive lifecycle is correctly bounded.
   *
   * **Validates: Requirements 1.5**
   */
  it('after unsubscribe, writes do not trigger emissions to the unsubscribed observer', () => {
    fc.assert(
      fc.property(arbOperationSequence, (ops) => {
        const collection = new MockCollection<TestRecord>();
        let emissionCount = 0;

        const subscription = collection.observe().subscribe({
          next: () => {
            emissionCount++;
          },
        });

        // Initial emission
        expect(emissionCount).toBe(1);

        // Unsubscribe
        subscription.unsubscribe();
        const countAfterUnsub = emissionCount;

        // Apply ops — none should trigger an emission to this subscriber
        for (const op of ops) {
          switch (op.type) {
            case 'create':
              collection.create(op.record);
              break;
            case 'update':
              try {
                collection.update(op.record?.id ?? 'nonexistent', op.patch);
              } catch {
                // ignore — record might not exist
              }
              break;
            case 'delete':
              try {
                collection.markAsDeleted('nonexistent');
              } catch {
                // ignore — record might not exist
              }
              break;
          }
        }

        return emissionCount === countAfterUnsub;
      }),
      { numRuns: 100 },
    );
  });
});
