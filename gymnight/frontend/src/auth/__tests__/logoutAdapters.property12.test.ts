/**
 * Feature: frontend-backend-integration, Property 12: Logout storage port adapter always propagates clearSession failures
 * **Validates: Requirements 7.2**
 */
import * as fc from 'fast-check';
import { createLogoutStoragePort } from '../logoutAdapters';
import { createSessionStore } from '../sessionStore';

jest.mock('../SecureStorage', () => ({
  clearSession: jest.fn(),
}));

import { clearSession } from '../SecureStorage';

describe('Property 12: Logout storage port adapter always propagates clearSession failures', () => {
  it('rejects when the underlying clearSession throws/rejects', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), fc.boolean(), async (message, rejects) => {
        (clearSession as jest.Mock).mockImplementation(
          rejects
            ? () => Promise.reject(new Error(message))
            : () => {
                throw new Error(message);
              }
        );

        const sessionStore = createSessionStore();
        const port = createLogoutStoragePort(sessionStore);

        await expect(port.clearSession()).rejects.toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  it('resolves and clears the session store when clearSession succeeds', async () => {
    (clearSession as jest.Mock).mockResolvedValue(undefined);
    const sessionStore = createSessionStore();
    sessionStore.set({ access_token: 'a', refresh_token: 'b', user_id: 'c' });

    const port = createLogoutStoragePort(sessionStore);
    await expect(port.clearSession()).resolves.toBeUndefined();
    expect(sessionStore.getCurrentSession()).toBeNull();
  });
});
