/**
 * Fake de banco compartilhado pelos testes de saveWorkoutWithExercises/
 * loadWorkoutForEditing/deleteWorkout (properties 77, 78, 84).
 *
 * Diferente dos fakes ad-hoc de workoutValidation.property40.test.ts (que só
 * precisam de `get(table).create()` + `write()`), o upsert/edição desta wave
 * também usa `find`, `query(Q.where(...)).fetch()` e os métodos de instância
 * `update`/`markAsDeleted` — então este fake precisa da forma real do
 * `Database` do WatermelonDB, não só do subconjunto usado antes.
 *
 * Vive em `src/test/mocks/` (fora de qualquer `__tests__/`) porque o
 * testMatch do projeto casa `**\/__tests__/**\/*.{ts,tsx}` — qualquer arquivo
 * ali dentro é tratado como suíte de teste, mesmo sem "test" no nome.
 */

import type { Database } from '@nozbe/watermelondb';

export interface FakeRecord {
  id: string;
  _raw: Record<string, unknown>;
}

interface WrappedRecord extends FakeRecord {
  update: (fn: (r: FakeRecord) => void) => Promise<WrappedRecord>;
  markAsDeleted: () => Promise<void>;
}

export interface FakeWorkoutDb {
  /** Tipado como `Database` real para passar direto às funções sob teste —
   * na verdade é o fake acima; só implementa o subconjunto usado por
   * saveWorkoutWithExercises/loadWorkoutForEditing/deleteWorkout. */
  db: Database;
  tables: Record<string, Map<string, FakeRecord>>;
}

/**
 * @param seed - registros iniciais por tabela (ex: `{ logged_sets: [...] }`)
 */
export function makeFakeWorkoutDb(
  seed: Record<string, FakeRecord[]> = {},
): FakeWorkoutDb {
  const tables: Record<string, Map<string, FakeRecord>> = {
    workouts: new Map(),
    workout_exercises: new Map(),
    logged_sets: new Map(),
    users: new Map(),
  };
  for (const [table, records] of Object.entries(seed)) {
    const map = tables[table] ?? new Map();
    for (const r of records) map.set(r.id, r);
    tables[table] = map;
  }

  let idCounter = 0;

  function tableMap(name: string): Map<string, FakeRecord> {
    const map = tables[name];
    if (!map) throw new Error(`fakeWorkoutDb: unexpected table "${name}"`);
    return map;
  }

  function wrap(map: Map<string, FakeRecord>, record: FakeRecord): WrappedRecord {
    return {
      id: record.id,
      _raw: record._raw,
      update: async (fn) => {
        fn(record);
        map.set(record.id, record);
        return wrap(map, record);
      },
      markAsDeleted: async () => {
        map.delete(record.id);
      },
    };
  }

  const fakeDb = {
    get(name: string) {
      const map = tableMap(name);
      return {
        find: async (id: string) => {
          const record = map.get(id);
          if (!record) throw new Error(`fakeWorkoutDb: record "${id}" not found in "${name}"`);
          return wrap(map, record);
        },
        create: async (fn: (r: FakeRecord) => void) => {
          idCounter += 1;
          const record: FakeRecord = { id: `fake-${name}-${idCounter}`, _raw: {} };
          fn(record);
          map.set(record.id, record);
          return wrap(map, record);
        },
        query: (condition: { column: string; value: unknown }) => ({
          fetch: async () =>
            [...map.values()]
              .filter((r) => r._raw[condition.column] === condition.value)
              .map((r) => wrap(map, r)),
        }),
      };
    },
    write: async <T>(fn: () => Promise<T>) => fn(),
  };

  return { db: fakeDb as unknown as Database, tables };
}
