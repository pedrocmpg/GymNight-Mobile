/**
 * Property 16: HTTP 403 quarantines only the rejected payload, preserving unrelated pending records.
 *
 * **Validates: Requirements 5.3**
 *
 * Testa que, ao receber HTTP 403, quarantineRejectedPayload:
 * 1. Marca registros rejeitados como 'quarantined' (não serão retentados)
 * 2. Preserva os DADOS dos registros rejeitados (não são excluídos da coleção)
 * 3. Registros pendentes não relacionados permanecem inalterados (mesmo _status)
 * 4. Os IDs dos registros rejeitados são retornados para diagnóstico
 * 5. Nenhum registro não-relacionado é colocado em quarentena
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  quarantineRejectedPayload,
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

/** Statuses that a record might have before quarantine (pending for push) */
const PRE_QUARANTINE_STATUSES: SyncStatus[] = ['created', 'updated', 'deleted', 'synced'];

const arbTable: fc.Arbitrary<SyncableTable> = fc.constantFrom(...SYNCABLE_TABLES);
const arbPreQuarantineStatus: fc.Arbitrary<SyncStatus> = fc.constantFrom(
  ...PRE_QUARANTINE_STATUSES,
);

/** Generates a single PendingRecord with a pre-quarantine status */
const arbRecord: fc.Arbitrary<PendingRecord> = fc.record({
  id: fc.uuid(),
  _status: arbPreQuarantineStatus,
  _table: arbTable,
  name: fc.string({ minLength: 0, maxLength: 30 }),
});

/**
 * Generates a pair: (allRecords, rejectedRecords) where rejectedRecords is a subset of allRecords.
 * This models the scenario: you have a collection of records, a subset was included in a push
 * that got HTTP 403, and you apply quarantineRejectedPayload.
 */
const arbRecordsWithRejection: fc.Arbitrary<{
  allRecords: PendingRecord[];
  rejectedRecords: PendingRecord[];
}> = arbRecord
  .filter((r) => r.id.length > 0)
  .chain((firstRecord) =>
    fc
      .array(arbRecord.filter((r) => r.id.length > 0), {
        minLength: 1,
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
      .subarray(deduped, { minLength: 1, maxLength: deduped.length })
      .map((rejected) => ({
        allRecords: deduped,
        rejectedRecords: rejected,
      }));
  });

/**
 * Generates a scenario where we always have both rejected AND unrelated records,
 * guaranteeing non-trivial tests.
 */
const arbRecordsWithMixedSubset: fc.Arbitrary<{
  allRecords: PendingRecord[];
  rejectedRecords: PendingRecord[];
}> = fc
  .array(arbRecord.filter((r) => r.id.length > 0), {
    minLength: 2,
    maxLength: 30,
  })
  .map((records) => {
    const uniqueById = new Map<string, PendingRecord>();
    for (const r of records) {
      uniqueById.set(r.id, r);
    }
    return Array.from(uniqueById.values());
  })
  .filter((deduped) => deduped.length >= 2)
  .chain((deduped) => {
    // Take at least 1 but not all records as rejected, so both sides are populated
    const maxRejected = Math.max(1, deduped.length - 1);
    return fc
      .subarray(deduped, { minLength: 1, maxLength: maxRejected })
      .filter((rejected) => rejected.length < deduped.length)
      .map((rejected) => ({
        allRecords: deduped,
        rejectedRecords: rejected,
      }));
  });

// ---- Property Tests ----

describe('Property 16: HTTP 403 quarantines only the rejected payload, preserving unrelated pending records', () => {
  it('rejected records are marked as quarantined (not retried)', () => {
    fcAssert(
      fcProperty(arbRecordsWithRejection, ({ allRecords, rejectedRecords }) => {
        const { collection } = quarantineRejectedPayload(allRecords, rejectedRecords);

        const rejectedIds = new Set(rejectedRecords.map((r) => r.id));

        for (const rejectedId of rejectedIds) {
          const found = collection.find((r) => r.id === rejectedId);
          expect(found).toBeDefined();
          expect(found!._status).toBe('quarantined');
        }
      }),
    );
  });

  it('rejected records DATA is preserved (not deleted/discarded from the collection)', () => {
    fcAssert(
      fcProperty(arbRecordsWithRejection, ({ allRecords, rejectedRecords }) => {
        const { collection } = quarantineRejectedPayload(allRecords, rejectedRecords);

        const rejectedIds = new Set(rejectedRecords.map((r) => r.id));

        // Every rejected record still exists in the collection
        for (const rejectedId of rejectedIds) {
          const found = collection.find((r) => r.id === rejectedId);
          expect(found).toBeDefined();

          // All non-_status fields remain identical
          const original = allRecords.find((r) => r.id === rejectedId)!;
          expect(found!.id).toBe(original.id);
          expect(found!._table).toBe(original._table);
          expect(found!.name).toBe(original.name);
        }

        // Collection size remains unchanged (no records discarded)
        expect(collection.length).toBe(allRecords.length);
      }),
    );
  });

  it('unrelated pending records remain unchanged (same _status)', () => {
    fcAssert(
      fcProperty(arbRecordsWithMixedSubset, ({ allRecords, rejectedRecords }) => {
        const { collection } = quarantineRejectedPayload(allRecords, rejectedRecords);

        const rejectedIds = new Set(rejectedRecords.map((r) => r.id));
        const unrelatedOriginals = allRecords.filter((r) => !rejectedIds.has(r.id));

        for (const original of unrelatedOriginals) {
          const found = collection.find((r) => r.id === original.id);
          expect(found).toBeDefined();
          expect(found!._status).toBe(original._status);
          expect(found!._table).toBe(original._table);
          expect(found!.id).toBe(original.id);
          expect(found!.name).toBe(original.name);
        }
      }),
    );
  });

  it('rejected record identifiers are logged/returned for diagnostics', () => {
    fcAssert(
      fcProperty(arbRecordsWithRejection, ({ allRecords, rejectedRecords }) => {
        const { quarantinedIds } = quarantineRejectedPayload(
          allRecords,
          rejectedRecords,
        );

        const rejectedIds = new Set(rejectedRecords.map((r) => r.id));

        // Every rejected id is present in the returned quarantinedIds
        for (const rejectedId of rejectedIds) {
          expect(quarantinedIds).toContain(rejectedId);
        }

        // quarantinedIds contains exactly the rejected ids (no extras)
        const quarantinedSet = new Set(quarantinedIds);
        expect(quarantinedSet.size).toBe(rejectedIds.size);
        for (const id of quarantinedSet) {
          expect(rejectedIds.has(id)).toBe(true);
        }
      }),
    );
  });

  it('no unrelated record is quarantined', () => {
    fcAssert(
      fcProperty(arbRecordsWithMixedSubset, ({ allRecords, rejectedRecords }) => {
        const { collection, quarantinedIds } = quarantineRejectedPayload(
          allRecords,
          rejectedRecords,
        );

        const rejectedIds = new Set(rejectedRecords.map((r) => r.id));

        // Check that no unrelated record has status quarantined
        const unrelated = collection.filter((r) => !rejectedIds.has(r.id));
        for (const record of unrelated) {
          expect(record._status).not.toBe('quarantined');
        }

        // Check that quarantinedIds contains no unrelated id
        for (const id of quarantinedIds) {
          expect(rejectedIds.has(id)).toBe(true);
        }
      }),
    );
  });
});
