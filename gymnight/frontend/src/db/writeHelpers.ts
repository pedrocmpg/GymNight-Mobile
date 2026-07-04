import { Model, Collection, Database } from '@nozbe/watermelondb';
import database from './database';

export type WriteResult<T> =
  | { success: true; record: T }
  | { success: false; error: Error };

/**
 * Creates a new record in the specified collection within a `database.write()` block.
 * Returns success only AFTER the local commit completes.
 * If the write fails, no partial change is visible (Requirement 2.4).
 *
 * @param collectionName - The WatermelonDB table name
 * @param recordBuilder - Callback that sets the initial field values on the new record
 * @param db - Optional database instance (for testing)
 */
export async function createRecord<T extends Model>(
  collectionName: string,
  recordBuilder: (record: T) => void,
  db: Database = database,
): Promise<WriteResult<T>> {
  try {
    const record = await db.write(async () => {
      const collection = db.get<T>(collectionName);
      return await collection.create(recordBuilder);
    });
    return { success: true, record };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Updates an existing record within a `database.write()` block.
 * Returns success only AFTER the local commit completes.
 * If the write fails, the record's prior state is preserved (Requirement 2.4).
 *
 * @param record - The existing Model instance to update
 * @param updater - Callback that applies field changes to the record
 * @param db - Optional database instance (for testing)
 */
export async function updateRecord<T extends Model>(
  record: T,
  updater: (record: T) => void,
  db: Database = database,
): Promise<WriteResult<T>> {
  try {
    const updated = await db.write(async () => {
      return await record.update(updater);
    });
    return { success: true, record: updated };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Deletes (marks as deleted) an existing record within a `database.write()` block.
 * Returns success only AFTER the local commit completes.
 * If the write fails, the record's prior state is preserved (Requirement 2.4).
 *
 * @param record - The existing Model instance to delete
 * @param db - Optional database instance (for testing)
 */
export async function deleteRecord<T extends Model>(
  record: T,
  db: Database = database,
): Promise<WriteResult<T>> {
  try {
    await db.write(async () => {
      await record.markAsDeleted();
    });
    return { success: true, record };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
