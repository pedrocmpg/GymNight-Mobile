/**
 * Property 19: Conflicting pull/local updates merge per-column and remain
 * pending for re-push.
 *
 * **Validates: Requirements 6.1**
 *
 * Testa que para qualquer registro arbitrário com qualquer subconjunto de
 * colunas localmente modificadas:
 * 1. Colunas em `_changed` mantêm o valor LOCAL no resultado merged
 * 2. Colunas não listadas em `_changed` adotam o valor REMOTO
 * 3. O `_status` do resultado permanece `'updated'`
 * 4. A lista `_changed` é preservada integralmente
 * 5. O merge é determinístico: mesmos inputs → mesmo output
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  mergePerColumn,
  type LocalRecord,
  type RemoteRecord,
} from '@/sync/conflictResolution';

// ---- Arbitraries ----

/** Arbitrary column name (simple alphanumeric, non-empty) */
const arbColumnName = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
  minLength: 1,
  maxLength: 10,
});

/** Arbitrary column value — strings and numbers cover realistic scenarios */
const arbColumnValue: fc.Arbitrary<string | number | boolean | null> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 20 }),
  fc.integer({ min: -10000, max: 10000 }),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generates a test scenario: a set of all column names, a subset that are
 * locally changed, local values for all columns, and remote values for all columns.
 */
interface ConflictScenario {
  id: string;
  allColumns: string[];
  changedColumns: string[];
  localValues: Record<string, unknown>;
  remoteValues: Record<string, unknown>;
}

const arbConflictScenario: fc.Arbitrary<ConflictScenario> = fc
  .record({
    id: fc.uuid(),
    // Generate a unique set of column names (at least 2 columns for meaningful tests)
    columnSet: fc.uniqueArray(arbColumnName, { minLength: 2, maxLength: 8 }),
  })
  .chain(({ id, columnSet }) => {
    // Choose a non-empty subset as locally changed
    return fc
      .subarray(columnSet, { minLength: 1, maxLength: columnSet.length })
      .chain((changedColumns) => {
        // Generate local and remote values for every column
        const localValuesArb = fc.tuple(
          ...columnSet.map(() => arbColumnValue),
        );
        const remoteValuesArb = fc.tuple(
          ...columnSet.map(() => arbColumnValue),
        );

        return fc.tuple(localValuesArb, remoteValuesArb).map(([localVals, remoteVals]) => {
          const localValues: Record<string, unknown> = {};
          const remoteValues: Record<string, unknown> = {};
          for (let i = 0; i < columnSet.length; i++) {
            localValues[columnSet[i]] = localVals[i];
            remoteValues[columnSet[i]] = remoteVals[i];
          }
          return {
            id,
            allColumns: columnSet,
            changedColumns,
            localValues,
            remoteValues,
          };
        });
      });
  });

// ---- Helpers ----

function buildLocalRecord(scenario: ConflictScenario): LocalRecord {
  const record: LocalRecord = {
    id: scenario.id,
    _status: 'updated',
    _changed: scenario.changedColumns.join(','),
  };
  for (const col of scenario.allColumns) {
    record[col] = scenario.localValues[col];
  }
  return record;
}

function buildRemoteRecord(scenario: ConflictScenario): RemoteRecord {
  const record: RemoteRecord = {
    id: scenario.id,
  };
  for (const col of scenario.allColumns) {
    record[col] = scenario.remoteValues[col];
  }
  return record;
}

// ---- Property Tests ----

describe('Property 19: Conflicting pull/local updates merge per-column and remain pending for re-push', () => {
  it('locally-changed columns keep their LOCAL values in the merged result', () => {
    fcAssert(
      fcProperty(arbConflictScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const remote = buildRemoteRecord(scenario);

        const merged = mergePerColumn(local, remote);

        // Every column listed in _changed must have the LOCAL value
        for (const col of scenario.changedColumns) {
          expect(merged[col]).toEqual(scenario.localValues[col]);
        }
      }),
    );
  });

  it('non-changed columns adopt the REMOTE (pull) values in the merged result', () => {
    fcAssert(
      fcProperty(arbConflictScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const remote = buildRemoteRecord(scenario);

        const merged = mergePerColumn(local, remote);

        // Columns NOT in _changed must have the REMOTE value
        const changedSet = new Set(scenario.changedColumns);
        const unchangedColumns = scenario.allColumns.filter(
          (col) => !changedSet.has(col),
        );

        for (const col of unchangedColumns) {
          expect(merged[col]).toEqual(scenario.remoteValues[col]);
        }
      }),
    );
  });

  it('the merged record _status remains "updated" (pending for re-push)', () => {
    fcAssert(
      fcProperty(arbConflictScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const remote = buildRemoteRecord(scenario);

        const merged = mergePerColumn(local, remote);

        expect(merged._status).toBe('updated');
      }),
    );
  });

  it('the _changed list is preserved (same columns remain marked as locally changed)', () => {
    fcAssert(
      fcProperty(arbConflictScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const remote = buildRemoteRecord(scenario);

        const merged = mergePerColumn(local, remote);

        expect(merged._changed).toBe(local._changed);
      }),
    );
  });

  it('merge is deterministic: same inputs always produce same output', () => {
    fcAssert(
      fcProperty(arbConflictScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const remote = buildRemoteRecord(scenario);

        const result1 = mergePerColumn(local, remote);
        const result2 = mergePerColumn(local, remote);

        expect(result1).toEqual(result2);
      }),
    );
  });
});
