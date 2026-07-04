import fc from 'fast-check';
import { createRecord, updateRecord, deleteRecord } from '../writeHelpers';

/**
 * Feature: frontend-mobile-implementation
 * Property 4: Success confirmation never precedes local persistence
 *
 * **Validates: Requirements 2.1**
 *
 * For any arbitrary record data and any of the 3 write operations (create/update/delete),
 * if the function returns { success: true }, then the database's write() function MUST have
 * been called and completed (i.e., the operation was persisted) BEFORE the success result
 * is returned. Conversely, if write() did not complete, success must be false.
 */

// Enum-like type for the 3 operations
type WriteOperation = 'create' | 'update' | 'delete';

// Arbitrary for write operations
const operationArb = fc.constantFrom<WriteOperation>('create', 'update', 'delete');

// Arbitrary for record field data (simulating arbitrary user input)
const recordDataArb = fc.record({
  name: fc.string({ minLength: 0, maxLength: 100 }),
  value: fc.float({ min: 0, max: 1000, noNaN: true }),
});

describe('Property 4: Success confirmation never precedes local persistence', () => {
  test('success: true is returned ONLY after db.write() has completed', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, async (operation, data) => {
        let writeCompleted = false;

        // Build a mock database that tracks whether write() completed
        const mockRecord = {
          id: 'test-record-id',
          _raw: { ...data },
          _changed: new Set<string>(),
          update: (updater: (r: any) => void) => {
            updater(mockRecord);
            return Promise.resolve(mockRecord);
          },
          markAsDeleted: () => Promise.resolve(),
        } as any;

        const mockCollection = {
          create: (creator: (r: any) => void) => {
            const newRecord = {
              id: 'new-record-id',
              _raw: {},
              _changed: new Set<string>(),
            };
            creator(newRecord);
            return Promise.resolve(newRecord);
          },
        };

        const mockDb = {
          get: () => mockCollection,
          write: async <T>(fn: () => Promise<T>): Promise<T> => {
            const result = await fn();
            writeCompleted = true;
            return result;
          },
        } as any;

        let result: { success: boolean };

        switch (operation) {
          case 'create':
            result = await createRecord(
              'exercises',
              (record: any) => {
                record._raw.name = data.name;
              },
              mockDb,
            );
            break;
          case 'update':
            result = await updateRecord(
              mockRecord,
              (record: any) => {
                record._raw.name = data.name;
              },
              mockDb,
            );
            break;
          case 'delete':
            result = await deleteRecord(mockRecord, mockDb);
            break;
        }

        // If success is true, write MUST have completed
        if (result!.success) {
          expect(writeCompleted).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('success: false is returned when db.write() does not complete (throws)', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, async (operation, data) => {
        let writeCompleted = false;

        const mockRecord = {
          id: 'test-record-id',
          _raw: { ...data },
          _changed: new Set<string>(),
          update: () => Promise.reject(new Error('write failure')),
          markAsDeleted: () => Promise.reject(new Error('write failure')),
        } as any;

        const mockCollection = {
          create: () => Promise.reject(new Error('write failure')),
        };

        // A database whose write() callback always throws (simulating persistence failure)
        const failingDb = {
          get: () => mockCollection,
          write: async <T>(fn: () => Promise<T>): Promise<T> => {
            const result = await fn(); // this will throw from the inner operation
            writeCompleted = true;
            return result;
          },
        } as any;

        let result: { success: boolean };

        switch (operation) {
          case 'create':
            result = await createRecord(
              'exercises',
              (record: any) => {
                record._raw.name = data.name;
              },
              failingDb,
            );
            break;
          case 'update':
            result = await updateRecord(
              mockRecord,
              (record: any) => {
                record._raw.name = data.name;
              },
              failingDb,
            );
            break;
          case 'delete':
            result = await deleteRecord(mockRecord, failingDb);
            break;
        }

        // write did NOT complete, so success MUST be false
        expect(writeCompleted).toBe(false);
        expect(result!.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('success: false when db.write() itself rejects (outer failure)', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, async (operation, data) => {
        let writeCompleted = false;

        const mockRecord = {
          id: 'test-record-id',
          _raw: { ...data },
          _changed: new Set<string>(),
          update: (updater: (r: any) => void) => {
            updater(mockRecord);
            return Promise.resolve(mockRecord);
          },
          markAsDeleted: () => Promise.resolve(),
        } as any;

        // A database whose write() rejects without executing the callback
        const failingDb = {
          get: () => ({}),
          write: async () => {
            throw new Error('Database locked');
          },
        } as any;

        let result: { success: boolean };

        switch (operation) {
          case 'create':
            result = await createRecord(
              'exercises',
              (record: any) => {
                record._raw.name = data.name;
              },
              failingDb,
            );
            break;
          case 'update':
            result = await updateRecord(
              mockRecord,
              (record: any) => {
                record._raw.name = data.name;
              },
              failingDb,
            );
            break;
          case 'delete':
            result = await deleteRecord(mockRecord, failingDb);
            break;
        }

        // write rejected, so success MUST be false
        expect(writeCompleted).toBe(false);
        expect(result!.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
