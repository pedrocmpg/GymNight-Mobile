/**
 * Feature: frontend-backend-integration, Property 13: Logout wipe port adapter always propagates a failure in any sub-operation
 * **Validates: Requirements 7.3**
 */
import * as fc from 'fast-check';
import { createLogoutWipePort } from '../logoutAdapters';

jest.mock('../../sync/lastPulledAt', () => ({
  clearLastPulledAt: jest.fn(),
}));

import { clearLastPulledAt } from '../../sync/lastPulledAt';

const TABLES = ['users', 'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'logged_sets'];

function makeDb(options: { failingTable?: string; clearLastPulledAtThrows?: boolean }) {
  const db: any = {
    get: (table: string) => ({
      query: () => ({
        fetch: async () => {
          if (options.failingTable === table) {
            throw new Error(`fetch failed for ${table}`);
          }
          return [{ id: `${table}-1`, prepareDestroyPermanently: () => ({}) }];
        },
      }),
    }),
    batch: async (..._prepared: unknown[]) => undefined,
    write: async (fn: () => Promise<void>) => fn(),
  };
  return db;
}

describe('Property 13: Logout wipe port adapter always propagates a failure in any sub-operation', () => {
  it('rejects when any table fetch fails', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...TABLES), async (failingTable) => {
        (clearLastPulledAt as jest.Mock).mockImplementation(() => undefined);
        const db = makeDb({ failingTable });
        const port = createLogoutWipePort(db);

        await expect(port.wipeAllTablesAndCursor()).rejects.toBeTruthy();
      }),
      { numRuns: 20 }
    );
  });

  it('rejects when clearLastPulledAt throws after all tables wiped successfully', async () => {
    (clearLastPulledAt as jest.Mock).mockImplementation(() => {
      throw new Error('cursor clear failed');
    });
    const db = makeDb({});
    const port = createLogoutWipePort(db);

    await expect(port.wipeAllTablesAndCursor()).rejects.toBeTruthy();
  });

  it('resolves when all sub-operations succeed', async () => {
    (clearLastPulledAt as jest.Mock).mockImplementation(() => undefined);
    const db = makeDb({});
    const port = createLogoutWipePort(db);

    await expect(port.wipeAllTablesAndCursor()).resolves.toBeUndefined();
    expect(clearLastPulledAt).toHaveBeenCalled();
  });
});
