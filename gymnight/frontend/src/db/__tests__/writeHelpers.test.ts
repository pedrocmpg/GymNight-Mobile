import { createRecord, updateRecord, deleteRecord } from '../writeHelpers';
import { MockDatabase, MockModel } from '../../test/mocks/watermelondb';

describe('Write Helpers', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  describe('createRecord', () => {
    it('should return success with the created record after commit', async () => {
      const result = await createRecord(
        'exercises',
        (record: any) => {
          record._raw.name = 'Bench Press';
        },
        mockDb,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.record).toBeDefined();
        expect(result.record._raw.name).toBe('Bench Press');
      }
    });

    it('should return failure with error if write throws', async () => {
      const failingDb = {
        write: () => Promise.reject(new Error('Disk full')),
        get: () => ({}),
      } as any;

      const result = await createRecord(
        'exercises',
        (record: any) => {
          record._raw.name = 'Test';
        },
        failingDb,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Disk full');
      }
    });
  });

  describe('updateRecord', () => {
    it('should return success with the updated record after commit', async () => {
      // First create a record
      const collection = mockDb.get('exercises');
      const record = await collection.create((r: any) => {
        r._raw.name = 'Old Name';
      });

      const result = await updateRecord(
        record,
        (r: any) => {
          r._raw.name = 'New Name';
        },
        mockDb,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.record._raw.name).toBe('New Name');
      }
    });

    it('should return failure with error if update throws', async () => {
      const failingRecord = {
        update: () => Promise.reject(new Error('Constraint violation')),
      } as any;

      const failingDb = {
        write: async (fn: () => Promise<any>) => fn(),
      } as any;

      const result = await updateRecord(
        failingRecord,
        (r: any) => {
          r._raw.name = 'New';
        },
        failingDb,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Constraint violation');
      }
    });
  });

  describe('deleteRecord', () => {
    it('should return success after the record is marked as deleted', async () => {
      const collection = mockDb.get('exercises');
      const record = await collection.create((r: any) => {
        r._raw.name = 'To Delete';
      });

      const result = await deleteRecord(record, mockDb);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.record.id).toBe(record.id);
      }
    });

    it('should return failure with error if markAsDeleted throws', async () => {
      const failingRecord = {
        markAsDeleted: () => Promise.reject(new Error('Cannot delete')),
      } as any;

      const failingDb = {
        write: async (fn: () => Promise<any>) => fn(),
      } as any;

      const result = await deleteRecord(failingRecord, failingDb);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Cannot delete');
      }
    });
  });
});
