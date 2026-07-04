/**
 * Property 12: Push payload groups pending records by table with exact
 * created/updated/deleted shape.
 *
 * **Validates: Requirements 4.4**
 *
 * Testa que buildPushPayload agrupa corretamente registros pendentes por tabela,
 * separando-os em created/updated/deleted conforme _status.
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  buildPushPayload,
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

const SYNC_STATUSES: SyncStatus[] = ['created', 'updated', 'deleted'];

/** Generates a valid SyncableTable */
const arbTable: fc.Arbitrary<SyncableTable> = fc.constantFrom(...SYNCABLE_TABLES);

/** Generates a valid SyncStatus */
const arbStatus: fc.Arbitrary<SyncStatus> = fc.constantFrom(...SYNC_STATUSES);

/** Generates a single PendingRecord with arbitrary fields */
const arbPendingRecord: fc.Arbitrary<PendingRecord> = fc.record({
  id: fc.uuid(),
  _status: arbStatus,
  _table: arbTable,
  name: fc.string({ minLength: 0, maxLength: 50 }),
  value: fc.oneof(fc.integer(), fc.double({ noNaN: true }), fc.string()),
});

/** Generates a list of pending records (0 to 50 records) */
const arbPendingRecords: fc.Arbitrary<PendingRecord[]> = fc.array(arbPendingRecord, {
  minLength: 0,
  maxLength: 50,
});

// ---- Property Tests ----

describe('Property 12: Push payload groups pending records by table', () => {
  it('groups records by table name correctly — only tables with pending records appear', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        // Collect which tables have at least one record
        const tablesWithRecords = new Set(records.map((r) => r._table));

        // Only those tables should be present in the payload
        const payloadTables = new Set(Object.keys(payload.changes));
        expect(payloadTables).toEqual(tablesWithRecords);

        // Tables with no pending records must be omitted
        for (const table of SYNCABLE_TABLES) {
          if (!tablesWithRecords.has(table)) {
            expect(payload.changes[table]).toBeUndefined();
          }
        }
      }),
    );
  });

  it('records with _status=created appear in the created array of their table', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        const createdRecords = records.filter((r) => r._status === 'created');
        for (const record of createdRecords) {
          const tableChanges = payload.changes[record._table];
          expect(tableChanges).toBeDefined();
          // The raw record in `created` should have the record's id and fields, without _status/_table
          const found = tableChanges.created.some((raw) => raw.id === record.id);
          expect(found).toBe(true);
        }
      }),
    );
  });

  it('records with _status=updated appear in the updated array of their table', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        const updatedRecords = records.filter((r) => r._status === 'updated');
        for (const record of updatedRecords) {
          const tableChanges = payload.changes[record._table];
          expect(tableChanges).toBeDefined();
          const found = tableChanges.updated.some((raw) => raw.id === record.id);
          expect(found).toBe(true);
        }
      }),
    );
  });

  it('records with _status=deleted appear in the deleted array as id strings only', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        const deletedRecords = records.filter((r) => r._status === 'deleted');
        for (const record of deletedRecords) {
          const tableChanges = payload.changes[record._table];
          expect(tableChanges).toBeDefined();
          // deleted array contains only string ids
          expect(tableChanges.deleted).toContain(record.id);
          // Every element in deleted must be a string
          for (const item of tableChanges.deleted) {
            expect(typeof item).toBe('string');
          }
        }
      }),
    );
  });

  it('no record appears in more than one category within its table', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        for (const table of Object.keys(payload.changes)) {
          const tableChanges = payload.changes[table];

          // Collect all ids from each category
          const createdIds = tableChanges.created.map((r) => r.id as string);
          const updatedIds = tableChanges.updated.map((r) => r.id as string);
          const deletedIds = tableChanges.deleted;

          // Check no overlap between categories
          for (const id of createdIds) {
            expect(updatedIds).not.toContain(id);
            expect(deletedIds).not.toContain(id);
          }
          for (const id of updatedIds) {
            expect(createdIds).not.toContain(id);
            expect(deletedIds).not.toContain(id);
          }
          for (const id of deletedIds) {
            expect(createdIds).not.toContain(id);
            expect(updatedIds).not.toContain(id);
          }
        }
      }),
    );
  });

  it('total record count in payload matches input count', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        let totalInPayload = 0;
        for (const table of Object.keys(payload.changes)) {
          const tableChanges = payload.changes[table];
          totalInPayload +=
            tableChanges.created.length +
            tableChanges.updated.length +
            tableChanges.deleted.length;
        }

        expect(totalInPayload).toBe(records.length);
      }),
    );
  });

  it('raw records in created/updated do not contain _status or _table fields', () => {
    fcAssert(
      fcProperty(arbPendingRecords, (records) => {
        const payload = buildPushPayload(records);

        for (const table of Object.keys(payload.changes)) {
          const tableChanges = payload.changes[table];

          for (const raw of [...tableChanges.created, ...tableChanges.updated]) {
            expect(raw).not.toHaveProperty('_status');
            expect(raw).not.toHaveProperty('_table');
          }
        }
      }),
    );
  });
});
