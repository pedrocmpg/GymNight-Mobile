/**
 * Feature: frontend-backend-integration, Property 15: Concurrent logout triggers collapse to a single call
 * **Validates: Requirements 7.8**
 */
import * as fc from 'fast-check';
import { createLogoutCoordinator } from '../logoutRouting';
import type { LogoutManager, LocalState } from '../../auth/LogoutManager';

const emptyState: LocalState = { session: null, domainRecords: [], pendingQueue: [] };

describe('Property 15: Concurrent logout triggers collapse to a single call', () => {
  it('requestLogout is invoked exactly once for N near-simultaneous triggers', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (n) => {
        let callCount = 0;
        let resolveLogout!: () => void;
        const logoutManager = {
          requestLogout: async () => {
            callCount++;
            await new Promise<void>((resolve) => {
              resolveLogout = resolve;
            });
            return { outcome: 'completed' as const };
          },
        } as unknown as LogoutManager;

        const coordinator = createLogoutCoordinator(logoutManager);

        const calls = Array.from({ length: n }, () => {
          if (coordinator.isPending()) {
            // Simulates the container's own guard: ignore additional triggers.
            return Promise.resolve({ navigateToAuth: false, errorMessage: null });
          }
          return coordinator.requestLogout(emptyState);
        });

        resolveLogout();
        await Promise.all(calls);

        expect(callCount).toBe(1);
      }),
      { numRuns: 50 }
    );
  });
});
