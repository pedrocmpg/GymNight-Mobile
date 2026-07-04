/**
 * Property 14: Successful push marks exactly the sent records as synced.
 *
 * **Validates: Requirements 4.6**
 *
 * Testa que, após um push bem-sucedido (HTTP 200 { status: "ok" }),
 * markRecordsAsSynced:
 * 1. Marca registros created/updated do push como synced
 * 2. Remove registros deleted do push da coleção
 * 3. Não altera registros que não estavam no push
 * 4. Nunca marca como synced um registro fora do push
 * 5. É idempotente — chamá-la duas vezes produz o mesmo resultado
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
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

/** Only pending statuses (pre-push) — synced is the post-push state */
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

/**
 * Generates a pair: (allRecords, pushedRecords) where pushedRecords is a subset of allRecords.
 * This models the real scenario: you have a collection of records, push some of them,
 * and then apply markRecordsAsSynced.
 */
const arbRecordsWithPush: fc.Arbitrary<{
  allRecords: PendingRecord[];
  pushedRecords: PendingRecord[];
}> = arbPendingRecord
  .filter((r) => r.id.length > 0)
  .chain((firstRecord) =>
    fc
      .array(arbPendingRecord.filter((r) => r.id.length > 0), {
        minLength: 0,
        maxLength: 30,
      })
      .map((rest) => [firstRecord, ...rest]),
  )
  .chain((allRecords) => {
    // Deduplicate by id to avoid ambiguity
    const uniqueById = new Map<string, PendingRecord>();
    for (const r of allRecords) {
      uniqueById.set(r.id, r);
    }
    const deduped = Array.from(uniqueById.values());

    return fc
      .subarray(deduped, { minLength: 0, maxLength: deduped.length })
      .map((pushed) => ({
        allRecords: deduped,
        pushedRecords: pushed,
      }));
  });

/** Simpler arbitrary for when we just need any collection with unique ids */
const arbUniqueRecords: fc.Arbitrary<PendingRecord[]> = fc
  .array(arbPendingRecord.filter((r) => r.id.length > 0), {
    minLength: 0,
    maxLength: 40,
  })
  .map((records) => {
    const uniqueById = new Map<string, PendingRecord>();
    for (const r of records) {
      uniqueById.set(r.id, r);
    }
    return Array.from(uniqueById.values());
  });

// ---- Property Tests ----

describe('Property 14: Successful push marks exactly the sent records as synced', () => {
  it('records with _status=created or _status=updated in push become synced', () => {
    fcAssert(
      fcProperty(arbRecordsWithPush, ({ allRecords, pushedRecords }) => {
        const { collection } = markRecordsAsSynced(allRecords, pushedRecords);

        const pushedIds = new Set(pushedRecords.map((r) => r.id));
        const pushedCreatedOrUpdated = pushedRecords.filter(
          (r) => r._status === 'created' || r._status === 'updated',
        );

        for (const record of pushedCreatedOrUpdated) {
          const found = collection.find((r) => r.id === record.id);
          expect(found).toBeDefined();
          expect(found!._status).toBe('synced');
        }
      }),
    );
  });

  it('records with _status=deleted in push are removed from the collection', () => {
    fcAssert(
      fcProperty(arbRecordsWithPush, ({ allRecords, pushedRecords }) => {
        const { collection } = markRecordsAsSynced(allRecords, pushedRecords);

        const pushedDeleted = pushedRecords.filter((r) => r._status === 'deleted');

        for (const record of pushedDeleted) {
          const found = collection.find((r) => r.id === record.id);
          expect(found).toBeUndefined();
        }
      }),
    );
  });

  it('records NOT in the push payload remain unchanged', () => {
    fcAssert(
      fcProperty(arbRecordsWithPush, ({ allRecords, pushedRecords }) => {
        const { collection } = markRecordsAsSynced(allRecords, pushedRecords);

        const pushedIds = new Set(pushedRecords.map((r) => r.id));
        const untouchedRecords = allRecords.filter((r) => !pushedIds.has(r.id));

        for (const original of untouchedRecords) {
          const found = collection.find((r) => r.id === original.id);
          expect(found).toBeDefined();
          expect(found!._status).toBe(original._status);
          expect(found!._table).toBe(original._table);
          expect(found!.id).toBe(original.id);
        }
      }),
    );
  });

  it('no record is marked as synced if it was not in the push payload', () => {
    fcAssert(
      fcProperty(arbRecordsWithPush, ({ allRecords, pushedRecords }) => {
        const { collection } = markRecordsAsSynced(allRecords, pushedRecords);

        const pushedIds = new Set(pushedRecords.map((r) => r.id));

        // Records that are synced in the output must have been in the push
        const syncedInOutput = collection.filter((r) => r._status === 'synced');
        for (const syncedRecord of syncedInOutput) {
          // Either it was in the push, or it was already synced in the input
          const originalRecord = allRecords.find((r) => r.id === syncedRecord.id);
          if (originalRecord && originalRecord._status !== 'synced') {
            // If it wasn't already synced, it must have been in the push
            expect(pushedIds.has(syncedRecord.id)).toBe(true);
          }
        }
      }),
    );
  });

  it('is idempotent — calling it twice produces the same result', () => {
    fcAssert(
      fcProperty(arbRecordsWithPush, ({ allRecords, pushedRecords }) => {
        const firstResult = markRecordsAsSynced(allRecords, pushedRecords);
        const secondResult = markRecordsAsSynced(
          firstResult.collection,
          pushedRecords,
        );

        // Collections should be identical
        expect(secondResult.collection.length).toBe(firstResult.collection.length);

        for (let i = 0; i < firstResult.collection.length; i++) {
          expect(secondResult.collection[i].id).toBe(firstResult.collection[i].id);
          expect(secondResult.collection[i]._status).toBe(
            firstResult.collection[i]._status,
          );
          expect(secondResult.collection[i]._table).toBe(
            firstResult.collection[i]._table,
          );
        }
      }),
    );
  });
});
