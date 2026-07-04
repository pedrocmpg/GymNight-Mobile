import fc from 'fast-check';
import { createRecord, updateRecord, deleteRecord, WriteResult } from '../writeHelpers';

/**
 * Feature: frontend-mobile-implementation
 * Property 5: Failed local write leaves state unchanged and signals no success
 *
 * **Validates: Requirements 2.4**
 *
 * For any arbitrary record data and any write operation that FAILS (throws an error):
 * 1. The function returns { success: false, error } with a meaningful Error object
 * 2. The record's prior state is NOT modified (state unchanged)
 * 3. No success indicator is ever produced (success is always false)
 */

// Arbitrary for write operations
type WriteOperation = 'create' | 'update' | 'delete';
const operationArb = fc.constantFrom<WriteOperation>('create', 'update', 'delete');

// Arbitrary for record field data (simulating arbitrary user input)
const recordDataArb = fc.record({
  name: fc.string({ minLength: 0, maxLength: 100 }),
  value: fc.float({ min: 0, max: 1000, noNaN: true }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
});

// Arbitrary for error messages
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

describe('Property 5: Failed local write leaves state unchanged and signals no success', () => {
  test('failed write returns { success: false, error } with a meaningful Error object', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, errorMessageArb, async (operation, data, errorMsg) => {
        // Build a mock database where write() always throws
        const mockRecord = {
          id: 'existing-record-id',
          _raw: { ...data },
          _changed: new Set<string>(),
          update: () => Promise.reject(new Error(errorMsg)),
          markAsDeleted: () => Promise.reject(new Error(errorMsg)),
        } as any;

        const mockCollection = {
          create: () => Promise.reject(new Error(errorMsg)),
        };

        const failingDb = {
          get: () => mockCollection,
          write: async <T>(fn: () => Promise<T>): Promise<T> => {
            return await fn(); // inner operations will throw
          },
        } as any;

        let result: WriteResult<any>;

        switch (operation) {
          case 'create':
            result = await createRecord(
              'exercises',
              (record: any) => {
                record._raw = { ...data };
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

        // Property assertion: success is always false
        expect(result!.success).toBe(false);

        // Property assertion: error is a meaningful Error object
        if (!result!.success) {
          expect(result!.error).toBeInstanceOf(Error);
          expect(result!.error.message).toBe(errorMsg);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('failed write preserves the record prior state unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, errorMessageArb, async (operation, data, errorMsg) => {
        // Capture the initial state before attempting the write
        const initialRaw = { id: 'existing-record-id', name: data.name, value: data.value, description: data.description };
        const recordState = { ...initialRaw };

        const mockRecord = {
          id: 'existing-record-id',
          _raw: recordState,
          _changed: new Set<string>(),
          update: () => Promise.reject(new Error(errorMsg)),
          markAsDeleted: () => Promise.reject(new Error(errorMsg)),
        } as any;

        const mockCollection = {
          create: () => Promise.reject(new Error(errorMsg)),
        };

        // Database whose write() propagates errors from inner operations
        const failingDb = {
          get: () => mockCollection,
          write: async <T>(fn: () => Promise<T>): Promise<T> => {
            return await fn();
          },
        } as any;

        // Snapshot the state before the write attempt
        const stateBefore = JSON.stringify(recordState);

        switch (operation) {
          case 'create':
            await createRecord(
              'exercises',
              (record: any) => {
                record._raw = { modified: true };
              },
              failingDb,
            );
            break;
          case 'update':
            await updateRecord(
              mockRecord,
              (record: any) => {
                // The updater WOULD modify state, but since update() rejects
                // before applying, the record's state must remain unchanged
                record._raw.name = 'MODIFIED_NAME';
              },
              failingDb,
            );
            break;
          case 'delete':
            await deleteRecord(mockRecord, failingDb);
            break;
        }

        // Property assertion: the record's state is unchanged after failed write
        // For update/delete operations, the original record state must be preserved
        if (operation === 'update' || operation === 'delete') {
          const stateAfter = JSON.stringify(recordState);
          expect(stateAfter).toBe(stateBefore);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('failed write never returns success: true regardless of error type', async () => {
    // Test with various error types: strings, Error objects, custom errors
    const errorSourceArb = fc.oneof(
      errorMessageArb.map((msg) => new Error(msg)),
      errorMessageArb.map((msg) => msg), // plain string error
      fc.constant(null),
      fc.constant(undefined),
    );

    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, errorSourceArb, async (operation, data, errorSource) => {
        const mockRecord = {
          id: 'existing-record-id',
          _raw: { ...data },
          _changed: new Set<string>(),
          update: () => Promise.reject(errorSource),
          markAsDeleted: () => Promise.reject(errorSource),
        } as any;

        const mockCollection = {
          create: () => Promise.reject(errorSource),
        };

        const failingDb = {
          get: () => mockCollection,
          write: async <T>(fn: () => Promise<T>): Promise<T> => {
            return await fn();
          },
        } as any;

        let result: WriteResult<any>;

        switch (operation) {
          case 'create':
            result = await createRecord(
              'exercises',
              (record: any) => {
                record._raw = { ...data };
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

        // Property assertion: success is NEVER true when write fails
        expect(result!.success).toBe(false);

        // Property assertion: error is always an Error instance (even for non-Error throws)
        if (!result!.success) {
          expect(result!.error).toBeInstanceOf(Error);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('database.write() rejection (outer failure) also leaves state unchanged and signals no success', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, recordDataArb, errorMessageArb, async (operation, data, errorMsg) => {
        const initialRaw = { id: 'existing-record-id', name: data.name, value: data.value };
        const recordState = { ...initialRaw };

        const mockRecord = {
          id: 'existing-record-id',
          _raw: recordState,
          _changed: new Set<string>(),
          update: (updater: (r: any) => void) => {
            updater(mockRecord);
            return Promise.resolve(mockRecord);
          },
          markAsDeleted: () => Promise.resolve(),
        } as any;

        // Database whose write() itself rejects (e.g., database locked)
        // without even executing the callback
        const failingDb = {
          get: () => ({}),
          write: async () => {
            throw new Error(errorMsg);
          },
        } as any;

        const stateBefore = JSON.stringify(recordState);

        let result: WriteResult<any>;

        switch (operation) {
          case 'create':
            result = await createRecord(
              'exercises',
              (record: any) => {
                record._raw = { modified: true };
              },
              failingDb,
            );
            break;
          case 'update':
            result = await updateRecord(
              mockRecord,
              (record: any) => {
                record._raw.name = 'SHOULD_NOT_APPLY';
              },
              failingDb,
            );
            break;
          case 'delete':
            result = await deleteRecord(mockRecord, failingDb);
            break;
        }

        // Property assertion: success is false
        expect(result!.success).toBe(false);

        // Property assertion: error is meaningful
        if (!result!.success) {
          expect(result!.error).toBeInstanceOf(Error);
          expect(result!.error.message).toBe(errorMsg);
        }

        // Property assertion: record state unchanged (for update/delete)
        if (operation === 'update' || operation === 'delete') {
          const stateAfter = JSON.stringify(recordState);
          expect(stateAfter).toBe(stateBefore);
        }
      }),
      { numRuns: 100 },
    );
  });
});
