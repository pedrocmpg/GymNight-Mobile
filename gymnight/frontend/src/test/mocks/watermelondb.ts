/**
 * Mock do WatermelonDB para testes.
 * Garante que a suíte de testes execute sem um arquivo SQLite real.
 * Implementa a interface mínima usada pelos hooks e telas do app.
 *
 * This single file is mapped to all @nozbe/watermelondb/* imports via jest moduleNameMapper.
 */

export class MockModel {
  static table: string;
  static associations: Record<string, any> = {};

  id: string;
  _raw: Record<string, unknown>;
  _changed: Set<string>;

  constructor(data: Record<string, unknown> = {}) {
    this.id = (data.id as string) ?? `mock-${Math.random().toString(36).slice(2)}`;
    this._raw = data;
    this._changed = new Set();
  }

  update(updater: (record: this) => void): Promise<this> {
    updater(this);
    return Promise.resolve(this);
  }

  markAsDeleted(): Promise<void> {
    return Promise.resolve();
  }

  observe() {
    return {
      subscribe: (observer: { next?: (val: unknown) => void; error?: (err: unknown) => void }) => {
        observer.next?.(this);
        return { unsubscribe: () => {} };
      },
    };
  }
}

export class MockCollection {
  private records: MockModel[] = [];
  modelClass: typeof MockModel;

  constructor(modelClass: typeof MockModel = MockModel) {
    this.modelClass = modelClass;
  }

  seed(records: Record<string, unknown>[]) {
    this.records = records.map((r) => new MockModel(r));
  }

  find(id: string): Promise<MockModel | undefined> {
    return Promise.resolve(this.records.find((r) => r.id === id));
  }

  query(..._conditions: unknown[]) {
    const self = this;
    return {
      fetch: () => Promise.resolve(self.records),
      observe: () => ({
        subscribe: (observer: { next?: (val: unknown) => void; error?: (err: unknown) => void }) => {
          observer.next?.(self.records);
          return { unsubscribe: () => {} };
        },
      }),
      count: () => Promise.resolve(self.records.length),
    };
  }

  create(creator: (record: MockModel) => void): Promise<MockModel> {
    const record = new MockModel();
    creator(record);
    this.records.push(record);
    return Promise.resolve(record);
  }
}

export class MockDatabase {
  private collections: Map<string, MockCollection> = new Map();

  constructor(_options?: any) {}

  get(tableName: string): MockCollection {
    if (!this.collections.has(tableName)) {
      this.collections.set(tableName, new MockCollection());
    }
    return this.collections.get(tableName)!;
  }

  write<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  batch(..._records: unknown[]): Promise<void> {
    return Promise.resolve();
  }
}

// --- Decorator mocks (no-op property decorators for Model classes) ---
function noopDecorator(_columnName: string) {
  return (_target: any, _propertyKey: string) => {};
}

function noopRelationDecorator(_relationTable: string, _foreignKey: string) {
  return (_target: any, _propertyKey: string) => {};
}

function noopChildrenDecorator(_childTable: string) {
  return (_target: any, _propertyKey: string) => {};
}

export const field = noopDecorator;
export const date = noopDecorator;
export const relation = noopRelationDecorator;
export const children = noopChildrenDecorator;

// --- Schema mocks ---
export function appSchema(schema: any) {
  return schema;
}

export function tableSchema(table: any) {
  return table;
}

// --- Adapter mock (used as default import from @nozbe/watermelondb/adapters/sqlite) ---
export class MockSQLiteAdapter {
  schema: any;
  constructor(_options?: any) {}
}

// Named exports matching WatermelonDB's module API
export const Database = MockDatabase;
export const Model = MockModel;
export const Collection = MockCollection;

/**
 * Minimal Q query-builder mock — real WatermelonDB filtering isn't exercised
 * in unit tests (fake queries/collections stand in), so these just need to
 * exist as callable no-ops that Query construction sites can invoke.
 */
export const Q = {
  where: (column: string, value: unknown) => ({ type: 'where', column, value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  or: (...conditions: unknown[]) => ({ type: 'or', conditions }),
  sortBy: (column: string, direction?: string) => ({ type: 'sortBy', column, direction }),
};

/**
 * Default export: MockSQLiteAdapter.
 * This is used when `database.ts` does:
 *   import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
 * The moduleNameMapper maps all @nozbe/watermelondb/* to this file,
 * so the default export must be a constructable class (SQLiteAdapter).
 */
export default MockSQLiteAdapter;
