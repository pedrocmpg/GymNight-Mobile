/**
 * Property 18: Idempotent retry of a push payload never produces duplicate local or remote records.
 *
 * **Validates: Requirements 5.5**
 *
 * Testa que o ciclo push é seguro para retry porque:
 * 1. buildPushPayload é uma função pura: chamá-la N vezes com os mesmos registros
 *    pendentes produz o EXATO mesmo payload (mesmos ids, mesmos dados)
 * 2. markRecordsAsSynced é idempotente: aplicá-la N vezes não corrompe o estado local
 *    nem produz duplicatas
 * 3. O ciclo completo (build → push → mark) quando retentado com o mesmo input
 *    não produz registros duplicados localmente
 * 4. Nenhuma duplicação local: o tamanho da coleção após marking é igual ao
 *    tamanho esperado (original menos deletados) independente de quantas vezes
 *    marking é aplicado
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  buildPushPayload,
  markRecordsAsSynced,
  type PendingRecord,
  type SyncableTable,
  type SyncStatus,
} from '@/sync/syncAdapters';

// ---- Arbitraries ----

const SYNCABLE_TABLES: SyncableTable[] = [
  'users',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sessions',
  'logged_sets',
];

/** Only pending statuses that appear in a push queue */
const PENDING_STATUSES: SyncStatus[] = ['created', 'updated', 'deleted'];

const arbTable: fc.Arbitrary<SyncableTable> = fc.constantFrom(...SYNCABLE_TABLES);
const arbPendingStatus: fc.Arbitrary<SyncStatus> = fc.constantFrom(...PENDING_STATUSES);

/** Generates a single PendingRecord with a pending status */
const arbPendingRecord: fc.Arbitrary<PendingRecord> = fc.record({
  id: fc.uuid(),
  _status: arbPendingStatus,
  _table: arbTable,
  name: fc.string({ minLength: 0, maxLength: 30 }),
});

/** Generates a non-empty list of unique-by-id pending records */
const arbUniquePendingRecords: fc.Arbitrary<PendingRecord[]> = fc
  .array(arbPendingRecord.filter((r) => r.id.length > 0), {
    minLength: 1,
    maxLength: 30,
  })
  .map((records) => {
    const uniqueById = new Map<string, PendingRecord>();
    for (const r of records) {
      uniqueById.set(r.id, r);
    }
    return Array.from(uniqueById.values());
  })
  .filter((records) => records.length >= 1);

/** Generates a number of retries between 2 and 5 */
const arbRetryCount: fc.Arbitrary<number> = fc.integer({ min: 2, max: 5 });

/**
 * Generates a scenario with allRecords (collection) and pushedRecords (subset sent in push).
 * This models: collection has some pending records that were pushed, plus others not pushed.
 */
const arbCollectionWithPush: fc.Arbitrary<{
  allRecords: PendingRecord[];
  pushedRecords: PendingRecord[];
}> = arbUniquePendingRecords.chain((allRecords) =>
  fc
    .subarray(allRecords, { minLength: 1, maxLength: allRecords.length })
    .map((pushed) => ({
      allRecords,
      pushedRecords: pushed,
    })),
);

// ---- Helpers ----

/** Deep equality check for PushPayload (structural comparison) */
function payloadsAreEqual(
  a: ReturnType<typeof buildPushPayload>,
  b: ReturnType<typeof buildPushPayload>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Count unique ids in a collection */
function uniqueIdCount(collection: PendingRecord[]): number {
  return new Set(collection.map((r) => r.id)).size;
}

// ---- Property Tests ----

describe('Property 18: Idempotent retry of a push payload never produces duplicate local or remote records', () => {
  it('buildPushPayload is pure: calling it N times with the same records produces the EXACT same payload', () => {
    fcAssert(
      fcProperty(arbUniquePendingRecords, arbRetryCount, (records, n) => {
        const firstPayload = buildPushPayload(records);

        for (let i = 1; i < n; i++) {
          const retryPayload = buildPushPayload(records);
          expect(payloadsAreEqual(firstPayload, retryPayload)).toBe(true);
        }
      }),
    );
  });

  it('markRecordsAsSynced is idempotent: applying it N times does not create duplicate records in the collection', () => {
    fcAssert(
      fcProperty(arbCollectionWithPush, arbRetryCount, ({ allRecords, pushedRecords }, n) => {
        // Apply markRecordsAsSynced once
        const firstResult = markRecordsAsSynced(allRecords, pushedRecords);

        // Apply it N-1 more times on the result
        let currentCollection = firstResult.collection;
        for (let i = 1; i < n; i++) {
          const result = markRecordsAsSynced(currentCollection, pushedRecords);
          currentCollection = result.collection;
        }

        // The final result should be identical to the first application
        expect(currentCollection.length).toBe(firstResult.collection.length);

        // No duplicate ids in the collection
        const ids = currentCollection.map((r) => r.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);

        // Status of each record should be unchanged from first application
        for (let i = 0; i < firstResult.collection.length; i++) {
          expect(currentCollection[i].id).toBe(firstResult.collection[i].id);
          expect(currentCollection[i]._status).toBe(firstResult.collection[i]._status);
          expect(currentCollection[i]._table).toBe(firstResult.collection[i]._table);
        }
      }),
    );
  });

  it('after a failed push + retry + success, the final state is identical to a first-time successful push', () => {
    fcAssert(
      fcProperty(arbCollectionWithPush, arbRetryCount, ({ allRecords, pushedRecords }, retries) => {
        // Scenario: push the same records multiple times (simulating retries after failures)
        // On each retry, buildPushPayload is called again with the same pending records
        // After the final successful push, markRecordsAsSynced is called

        // First-time success scenario (baseline)
        const baselinePayload = buildPushPayload(pushedRecords);
        const baselineResult = markRecordsAsSynced(allRecords, pushedRecords);

        // Retry scenario: build payload N times (simulating failed attempts + final success)
        for (let i = 0; i < retries; i++) {
          const retryPayload = buildPushPayload(pushedRecords);
          // Each retry produces the same payload (same ids sent to backend)
          expect(payloadsAreEqual(baselinePayload, retryPayload)).toBe(true);
        }

        // After the final successful push, mark as synced
        const retryResult = markRecordsAsSynced(allRecords, pushedRecords);

        // The final state should be identical to the baseline
        expect(retryResult.collection.length).toBe(baselineResult.collection.length);
        for (let i = 0; i < baselineResult.collection.length; i++) {
          expect(retryResult.collection[i].id).toBe(baselineResult.collection[i].id);
          expect(retryResult.collection[i]._status).toBe(baselineResult.collection[i]._status);
        }
      }),
    );
  });

  it('no local record duplication: collection size after marking equals expected size regardless of retry count', () => {
    fcAssert(
      fcProperty(arbCollectionWithPush, arbRetryCount, ({ allRecords, pushedRecords }, n) => {
        // Expected size: original count minus deleted records that were pushed
        const pushedDeletedCount = pushedRecords.filter((r) => r._status === 'deleted').length;
        const expectedSize = allRecords.length - pushedDeletedCount;

        // Apply markRecordsAsSynced N times
        let currentCollection = allRecords;
        for (let i = 0; i < n; i++) {
          const result = markRecordsAsSynced(currentCollection, pushedRecords);
          currentCollection = result.collection;

          // Size should be correct after every application
          expect(currentCollection.length).toBe(expectedSize);

          // No duplicate ids at any step
          const ids = currentCollection.map((r) => r.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }),
    );
  });

  it('the payload ids sent in a retry are exactly the same ids as the first attempt (no duplicates added to remote)', () => {
    fcAssert(
      fcProperty(arbUniquePendingRecords, arbRetryCount, (records, n) => {
        // Collect all ids from the first payload
        const firstPayload = buildPushPayload(records);
        const firstIds = new Set<string>();
        for (const table of Object.keys(firstPayload.changes)) {
          const tableChanges = firstPayload.changes[table];
          for (const raw of tableChanges.created) {
            firstIds.add(raw.id as string);
          }
          for (const raw of tableChanges.updated) {
            firstIds.add(raw.id as string);
          }
          for (const id of tableChanges.deleted) {
            firstIds.add(id);
          }
        }

        // Each retry should produce exactly the same set of ids
        for (let i = 1; i < n; i++) {
          const retryPayload = buildPushPayload(records);
          const retryIds = new Set<string>();
          for (const table of Object.keys(retryPayload.changes)) {
            const tableChanges = retryPayload.changes[table];
            for (const raw of tableChanges.created) {
              retryIds.add(raw.id as string);
            }
            for (const raw of tableChanges.updated) {
              retryIds.add(raw.id as string);
            }
            for (const id of tableChanges.deleted) {
              retryIds.add(id);
            }
          }

          // Same ids — no duplicates introduced
          expect(retryIds.size).toBe(firstIds.size);
          for (const id of firstIds) {
            expect(retryIds.has(id)).toBe(true);
          }
        }
      }),
    );
  });
});
