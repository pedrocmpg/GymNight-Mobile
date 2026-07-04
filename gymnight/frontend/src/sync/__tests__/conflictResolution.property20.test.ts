/**
 * Property 20: An incoming tombstone always deletes the local record and
 * discards any pending update.
 *
 * **Validates: Requirements 6.2**
 *
 * Testa que para qualquer registro local arbitrário com qualquer status pendente
 * e quaisquer dados:
 * 1. Quando um tombstone chega para o id desse registro, a resolução é SEMPRE 'delete'
 * 2. Os dados do update pendente são completamente descartados (não preservados)
 * 3. A resolução do tombstone não depende dos dados do registro local
 * 4. A resolução do tombstone não depende de quais colunas estão em `_changed`
 * 5. A ação retornada sempre referencia o id correto do registro
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  resolveTombstoneConflict,
  type LocalRecord,
  type Tombstone,
} from '@/sync/conflictResolution';

// ---- Arbitraries ----

/** Arbitrary pending status for a local record */
const arbPendingStatus = fc.constantFrom<'updated' | 'created' | 'deleted'>(
  'updated',
  'created',
  'deleted',
);

/** Arbitrary column name (simple alphanumeric, non-empty) */
const arbColumnName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 1, maxLength: 10 },
);

/** Arbitrary column value — strings and numbers cover realistic scenarios */
const arbColumnValue: fc.Arbitrary<string | number | boolean | null> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 20 }),
  fc.integer({ min: -10000, max: 10000 }),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generates a test scenario with a local record that has arbitrary pending data
 * and a tombstone for the same id.
 */
interface TombstoneScenario {
  id: string;
  status: 'updated' | 'created' | 'deleted';
  changedColumns: string[];
  dataColumns: string[];
  localData: Record<string, unknown>;
}

const arbTombstoneScenario: fc.Arbitrary<TombstoneScenario> = fc
  .record({
    id: fc.uuid(),
    status: arbPendingStatus,
    columnSet: fc.uniqueArray(arbColumnName, { minLength: 1, maxLength: 8 }),
  })
  .chain(({ id, status, columnSet }) => {
    return fc
      .subarray(columnSet, { minLength: 0, maxLength: columnSet.length })
      .chain((changedColumns) => {
        const valuesArb = fc.tuple(...columnSet.map(() => arbColumnValue));
        return valuesArb.map((values) => {
          const localData: Record<string, unknown> = {};
          for (let i = 0; i < columnSet.length; i++) {
            localData[columnSet[i]] = values[i];
          }
          return {
            id,
            status,
            changedColumns,
            dataColumns: columnSet,
            localData,
          };
        });
      });
  });

// ---- Helpers ----

function buildLocalRecord(scenario: TombstoneScenario): LocalRecord {
  const record: LocalRecord = {
    id: scenario.id,
    _status: scenario.status,
    _changed: scenario.changedColumns.join(','),
  };
  for (const col of scenario.dataColumns) {
    record[col] = scenario.localData[col];
  }
  return record;
}

function buildTombstone(id: string): Tombstone {
  return { id };
}

// ---- Property Tests ----

describe('Property 20: An incoming tombstone always deletes the local record and discards any pending update', () => {
  it('tombstone resolution is always "delete" regardless of local record status', () => {
    fcAssert(
      fcProperty(arbTombstoneScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const tombstone = buildTombstone(scenario.id);

        const result = resolveTombstoneConflict(local, tombstone);

        expect(result.action).toBe('delete');
      }),
    );
  });

  it('pending update data is completely discarded (not preserved in the resolution)', () => {
    fcAssert(
      fcProperty(arbTombstoneScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const tombstone = buildTombstone(scenario.id);

        const result = resolveTombstoneConflict(local, tombstone);

        // The result should ONLY have action and id — no local data leaks through
        const resultKeys = Object.keys(result);
        expect(resultKeys).toHaveLength(2);
        expect(resultKeys).toContain('action');
        expect(resultKeys).toContain('id');

        // None of the local data columns appear in the result
        for (const col of scenario.dataColumns) {
          expect(result).not.toHaveProperty(col);
        }
      }),
    );
  });

  it('tombstone resolution does not depend on what data the local record has', () => {
    fcAssert(
      fcProperty(
        arbTombstoneScenario,
        arbTombstoneScenario,
        (scenario1, scenario2) => {
          // Use the same id but different data for both scenarios
          const id = scenario1.id;

          const local1 = buildLocalRecord(scenario1);
          const local2 = buildLocalRecord({ ...scenario2, id });

          const tombstone = buildTombstone(id);

          const result1 = resolveTombstoneConflict(local1, tombstone);
          const result2 = resolveTombstoneConflict(local2, tombstone);

          // Same tombstone id produces same resolution regardless of local data
          expect(result1).toEqual(result2);
        },
      ),
    );
  });

  it('tombstone resolution does not depend on what columns are in _changed', () => {
    fcAssert(
      fcProperty(arbTombstoneScenario, (scenario) => {
        const id = scenario.id;
        const tombstone = buildTombstone(id);

        // Build two records with different _changed columns but same id
        const local1 = buildLocalRecord(scenario);
        const local2 = buildLocalRecord({
          ...scenario,
          changedColumns: [], // no changed columns
        });

        const result1 = resolveTombstoneConflict(local1, tombstone);
        const result2 = resolveTombstoneConflict(local2, tombstone);

        expect(result1).toEqual(result2);
      }),
    );
  });

  it('the returned action always references the correct record id', () => {
    fcAssert(
      fcProperty(arbTombstoneScenario, (scenario) => {
        const local = buildLocalRecord(scenario);
        const tombstone = buildTombstone(scenario.id);

        const result = resolveTombstoneConflict(local, tombstone);

        expect(result.id).toBe(scenario.id);
      }),
    );
  });
});
