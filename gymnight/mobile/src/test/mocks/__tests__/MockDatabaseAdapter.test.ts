/**
 * Testes unitários do MockDatabaseAdapter.
 *
 * Verifica: seed, find, query (com predicado), observe (notificação reativa),
 * create, update, markAsDeleted, e o adapter multi-tabela.
 *
 * Requirements: 21.1, 21.2
 */
import {
  MockDatabaseAdapter,
  MockCollection,
  type MockRecord,
} from '@/test/mocks/MockDatabaseAdapter';

interface TestRecord extends MockRecord {
  id: string;
  name: string;
  value?: number;
}

describe('MockCollection', () => {
  let collection: MockCollection<TestRecord>;

  beforeEach(() => {
    collection = new MockCollection<TestRecord>();
  });

  describe('seed', () => {
    it('should populate collection with pre-seeded records', () => {
      collection.seed([
        { id: '1', name: 'Alpha', value: 10 },
        { id: '2', name: 'Beta', value: 20 },
      ]);

      expect(collection.count).toBe(2);
      expect(collection.find('1')).toEqual({ id: '1', name: 'Alpha', value: 10 });
    });

    it('should overwrite records with duplicate IDs on re-seed', () => {
      collection.seed([{ id: '1', name: 'Original' }]);
      collection.seed([{ id: '1', name: 'Updated' }]);

      expect(collection.find('1')?.name).toBe('Updated');
      expect(collection.count).toBe(1);
    });

    it('should accumulate records across multiple seed calls with different IDs', () => {
      collection.seed([{ id: '1', name: 'A' }]);
      collection.seed([{ id: '2', name: 'B' }]);

      expect(collection.count).toBe(2);
    });
  });

  describe('find', () => {
    it('should return the record with the matching ID', () => {
      collection.seed([{ id: 'abc', name: 'Found' }]);

      expect(collection.find('abc')).toEqual({ id: 'abc', name: 'Found' });
    });

    it('should return undefined for a non-existent ID', () => {
      collection.seed([{ id: '1', name: 'A' }]);

      expect(collection.find('nonexistent')).toBeUndefined();
    });
  });

  describe('query', () => {
    beforeEach(() => {
      collection.seed([
        { id: '1', name: 'Alpha', value: 10 },
        { id: '2', name: 'Beta', value: 20 },
        { id: '3', name: 'Alpha', value: 30 },
      ]);
    });

    it('should return all records when no predicate is provided', () => {
      const results = collection.query();
      expect(results).toHaveLength(3);
    });

    it('should filter records using a predicate', () => {
      const results = collection.query((r) => r.name === 'Alpha');
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.name === 'Alpha')).toBe(true);
    });

    it('should return empty array when no records match predicate', () => {
      const results = collection.query((r) => r.name === 'Nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('observe', () => {
    it('should emit initial state immediately on subscribe', () => {
      collection.seed([{ id: '1', name: 'A' }]);

      const received: TestRecord[][] = [];
      collection.observe().subscribe({ next: (v) => received.push(v) });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual([{ id: '1', name: 'A' }]);
    });

    it('should apply predicate to initial and subsequent emissions', () => {
      collection.seed([
        { id: '1', name: 'A', value: 10 },
        { id: '2', name: 'B', value: 20 },
      ]);

      const received: TestRecord[][] = [];
      collection.observe((r) => r.value! > 15).subscribe({
        next: (v) => received.push(v),
      });

      expect(received[0]).toEqual([{ id: '2', name: 'B', value: 20 }]);

      // Add a record that matches the predicate
      collection.create({ id: '3', name: 'C', value: 30 });

      expect(received).toHaveLength(2);
      expect(received[1]).toHaveLength(2);
      expect(received[1].map((r) => r.id).sort()).toEqual(['2', '3']);
    });

    it('should notify observers after create', () => {
      const received: TestRecord[][] = [];
      collection.observe().subscribe({ next: (v) => received.push(v) });

      expect(received).toHaveLength(1);
      expect(received[0]).toHaveLength(0);

      collection.create({ id: '1', name: 'New' });

      expect(received).toHaveLength(2);
      expect(received[1]).toEqual([{ id: '1', name: 'New' }]);
    });

    it('should notify observers after update', () => {
      collection.seed([{ id: '1', name: 'Original' }]);

      const received: TestRecord[][] = [];
      collection.observe().subscribe({ next: (v) => received.push(v) });

      collection.update('1', { name: 'Modified' });

      expect(received).toHaveLength(2);
      expect(received[1][0].name).toBe('Modified');
    });

    it('should notify observers after markAsDeleted', () => {
      collection.seed([
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ]);

      const received: TestRecord[][] = [];
      collection.observe().subscribe({ next: (v) => received.push(v) });

      collection.markAsDeleted('1');

      expect(received).toHaveLength(2);
      expect(received[1]).toHaveLength(1);
      expect(received[1][0].id).toBe('2');
    });

    it('should stop emitting after unsubscribe', () => {
      const received: TestRecord[][] = [];
      const sub = collection.observe().subscribe({ next: (v) => received.push(v) });

      sub.unsubscribe();
      collection.create({ id: '1', name: 'After' });

      // Only the initial emission should be present
      expect(received).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should add a record and return it', () => {
      const record = collection.create({ id: 'new', name: 'Created' });

      expect(record).toEqual({ id: 'new', name: 'Created' });
      expect(collection.find('new')).toEqual({ id: 'new', name: 'Created' });
    });
  });

  describe('update', () => {
    it('should merge partial changes into an existing record', () => {
      collection.seed([{ id: '1', name: 'Old', value: 5 }]);

      const updated = collection.update('1', { name: 'New' });

      expect(updated).toEqual({ id: '1', name: 'New', value: 5 });
      expect(collection.find('1')).toEqual({ id: '1', name: 'New', value: 5 });
    });

    it('should throw when updating a non-existent record', () => {
      expect(() => collection.update('missing', { name: 'X' })).toThrow(
        'record with id "missing" not found',
      );
    });
  });

  describe('markAsDeleted', () => {
    it('should remove the record from the collection', () => {
      collection.seed([{ id: '1', name: 'ToDelete' }]);

      collection.markAsDeleted('1');

      expect(collection.find('1')).toBeUndefined();
      expect(collection.count).toBe(0);
    });

    it('should throw when deleting a non-existent record', () => {
      expect(() => collection.markAsDeleted('missing')).toThrow(
        'record with id "missing" not found',
      );
    });
  });

  describe('clear', () => {
    it('should remove all records and notify observers', () => {
      collection.seed([
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ]);

      const received: TestRecord[][] = [];
      collection.observe().subscribe({ next: (v) => received.push(v) });

      collection.clear();

      expect(collection.count).toBe(0);
      expect(received[received.length - 1]).toHaveLength(0);
    });
  });
});

describe('MockDatabaseAdapter', () => {
  let db: MockDatabaseAdapter;

  beforeEach(() => {
    db = new MockDatabaseAdapter();
  });

  it('should provide access to all 6 syncable tables', () => {
    const tables = [
      'users',
      'exercises',
      'workouts',
      'workout_exercises',
      'workout_sessions',
      'logged_sets',
    ];

    for (const table of tables) {
      expect(() => db.collection(table)).not.toThrow();
    }
  });

  it('should throw for an unknown table name', () => {
    expect(() => db.collection('unknown_table')).toThrow('table "unknown_table" not found');
  });

  it('should allow seeding via the convenience method', () => {
    db.seed('exercises', [
      { id: 'e1', name: 'Squat' },
      { id: 'e2', name: 'Bench Press' },
    ]);

    const results = db.collection('exercises').query();
    expect(results).toHaveLength(2);
  });

  it('should allow write() as an async wrapper', async () => {
    const result = await db.write(() => {
      db.collection('users').create({ id: 'u1', name: 'John' });
      return Promise.resolve('done');
    });

    expect(result).toBe('done');
    expect(db.collection('users').find('u1')).toBeDefined();
  });

  it('should reset all collections', () => {
    db.seed('users', [{ id: 'u1', name: 'Test' }]);
    db.seed('exercises', [{ id: 'e1', name: 'Deadlift' }]);

    db.reset();

    expect(db.collection('users').count).toBe(0);
    expect(db.collection('exercises').count).toBe(0);
  });

  it('should support reactive observe across create/update/markAsDeleted cycle', () => {
    interface SetRecord extends MockRecord {
      sessionId: string;
      weight: number;
      repetitions: number;
    }

    const sets = db.collection<SetRecord>('logged_sets');
    const emissions: SetRecord[][] = [];

    sets.observe((r) => r.sessionId === 's1').subscribe({
      next: (v) => emissions.push(v),
    });

    // Initial: empty
    expect(emissions[0]).toHaveLength(0);

    // Create
    sets.create({ id: 'ls1', sessionId: 's1', weight: 80, repetitions: 10 });
    expect(emissions[1]).toHaveLength(1);

    // Create for different session (should not appear in filtered observe)
    sets.create({ id: 'ls2', sessionId: 's2', weight: 60, repetitions: 8 });
    expect(emissions[2]).toHaveLength(1); // still only ls1

    // Update
    sets.update('ls1', { weight: 85 });
    expect(emissions[3][0].weight).toBe(85);

    // Delete
    sets.markAsDeleted('ls1');
    expect(emissions[4]).toHaveLength(0);
  });
});
