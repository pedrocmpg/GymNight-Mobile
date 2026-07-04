/**
 * Property 21: A local deleted status always wins over incoming pull data
 * for the same id.
 *
 * **Validates: Requirements 6.3**
 *
 * Testa que para qualquer registro incoming do pull (created ou updated):
 * 1. Se o registro local tem `_status = 'deleted'`, os dados entrantes são SEMPRE descartados
 * 2. O registro local mantém `_status = 'deleted'` no resultado
 * 3. A deleção do registro local será incluída no próximo push
 * 4. A resolução é a mesma independentemente dos dados do registro entrante
 * 5. Nenhum dado do registro entrante é preservado localmente
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  resolveLocalDeletedConflict,
  type LocalRecord,
  type RemoteRecord,
  type LocalDeletedResolution,
} from '@/sync/conflictResolution';

// ---- Arbitraries ----

/** Arbitrary column name (simple alphanumeric, non-empty) */
const arbColumnName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 1, maxLength: 10 },
);

/** Arbitrary column value — covers realistic scenarios */
const arbColumnValue: fc.Arbitrary<string | number | boolean | null> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 20 }),
  fc.integer({ min: -10000, max: 10000 }),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generates a test scenario with a locally deleted record and an incoming
 * pull record (updated or created) for the same id.
 */
interface LocalDeletedScenario {
  id: string;
  localChangedColumns: string[];
  localDataColumns: string[];
  localData: Record<string, unknown>;
  pullDataColumns: string[];
  pullData: Record<string, unknown>;
}

const arbLocalDeletedScenario: fc.Arbitrary<LocalDeletedScenario> = fc
  .record({
    id: fc.uuid(),
    localColumnSet: fc.uniqueArray(arbColumnName, {
      minLength: 0,
      maxLength: 6,
    }),
    pullColumnSet: fc.uniqueArray(arbColumnName, {
      minLength: 1,
      maxLength: 8,
    }),
  })
  .chain(({ id, localColumnSet, pullColumnSet }) => {
    return fc
      .tuple(
        fc.subarray(localColumnSet, {
          minLength: 0,
          maxLength: localColumnSet.length,
        }),
        fc.tuple(...(localColumnSet.length > 0 ? localColumnSet.map(() => arbColumnValue) : [fc.constant(null)])),
        fc.tuple(...pullColumnSet.map(() => arbColumnValue)),
      )
      .map(([changedColumns, localValues, pullValues]) => {
        const localData: Record<string, unknown> = {};
        for (let i = 0; i < localColumnSet.length; i++) {
          localData[localColumnSet[i]] = localValues[i];
        }
        const pullData: Record<string, unknown> = {};
        for (let i = 0; i < pullColumnSet.length; i++) {
          pullData[pullColumnSet[i]] = pullValues[i];
        }
        return {
          id,
          localChangedColumns: changedColumns,
          localDataColumns: localColumnSet,
          localData,
          pullDataColumns: pullColumnSet,
          pullData,
        };
      });
  });

// ---- Helpers ----

function buildDeletedLocalRecord(scenario: LocalDeletedScenario): LocalRecord {
  const record: LocalRecord = {
    id: scenario.id,
    _status: 'deleted',
    _changed: scenario.localChangedColumns.join(','),
  };
  for (const col of scenario.localDataColumns) {
    record[col] = scenario.localData[col];
  }
  return record;
}

function buildPullRecord(scenario: LocalDeletedScenario): RemoteRecord {
  const record: RemoteRecord = {
    id: scenario.id,
  };
  for (const col of scenario.pullDataColumns) {
    record[col] = scenario.pullData[col];
  }
  return record;
}

// ---- Property Tests ----

describe('Property 21: A local deleted status always wins over incoming pull data for the same id', () => {
  it('incoming pull data is ALWAYS discarded when local record has _status = deleted', () => {
    fcAssert(
      fcProperty(arbLocalDeletedScenario, (scenario) => {
        const local = buildDeletedLocalRecord(scenario);
        const pullRecord = buildPullRecord(scenario);

        const result = resolveLocalDeletedConflict(local, pullRecord);

        expect(result.action).toBe('discard_pull');
      }),
    );
  });

  it('the local record retains _status = deleted in the result (keepDeleted is true)', () => {
    fcAssert(
      fcProperty(arbLocalDeletedScenario, (scenario) => {
        const local = buildDeletedLocalRecord(scenario);
        const pullRecord = buildPullRecord(scenario);

        const result = resolveLocalDeletedConflict(local, pullRecord);

        expect(result.keepDeleted).toBe(true);
      }),
    );
  });

  it('the local record deletion will be included in the next push (action is discard_pull with keepDeleted)', () => {
    fcAssert(
      fcProperty(arbLocalDeletedScenario, (scenario) => {
        const local = buildDeletedLocalRecord(scenario);
        const pullRecord = buildPullRecord(scenario);

        const result = resolveLocalDeletedConflict(local, pullRecord);

        // The combination of action='discard_pull' and keepDeleted=true means:
        // - pull data is rejected
        // - local record stays as deleted for the next push to propagate deletion
        expect(result).toEqual<LocalDeletedResolution>({
          action: 'discard_pull',
          id: scenario.id,
          keepDeleted: true,
        });
      }),
    );
  });

  it('the resolution is the same regardless of what data the incoming record contains', () => {
    fcAssert(
      fcProperty(
        arbLocalDeletedScenario,
        arbLocalDeletedScenario,
        (scenario1, scenario2) => {
          // Use the same id and local record, but different incoming pull data
          const id = scenario1.id;
          const local = buildDeletedLocalRecord(scenario1);

          const pullRecord1 = buildPullRecord(scenario1);
          const pullRecord2 = buildPullRecord({ ...scenario2, id });

          const result1 = resolveLocalDeletedConflict(local, pullRecord1);
          const result2 = resolveLocalDeletedConflict(local, pullRecord2);

          // Same deleted local record produces the same resolution regardless of pull data
          expect(result1).toEqual(result2);
        },
      ),
    );
  });

  it('no data from the incoming record is preserved in the resolution', () => {
    fcAssert(
      fcProperty(arbLocalDeletedScenario, (scenario) => {
        const local = buildDeletedLocalRecord(scenario);
        const pullRecord = buildPullRecord(scenario);

        const result = resolveLocalDeletedConflict(local, pullRecord);

        // The result should ONLY contain action, id, and keepDeleted
        const resultKeys = Object.keys(result);
        expect(resultKeys).toHaveLength(3);
        expect(resultKeys).toContain('action');
        expect(resultKeys).toContain('id');
        expect(resultKeys).toContain('keepDeleted');

        // None of the pull data columns appear in the result
        for (const col of scenario.pullDataColumns) {
          if (col !== 'id') {
            expect(result).not.toHaveProperty(col);
          }
        }
      }),
    );
  });
});
