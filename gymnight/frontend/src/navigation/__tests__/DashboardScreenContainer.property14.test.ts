/**
 * Feature: frontend-backend-integration, Property 14: Logout navigation and state preservation is a total function of requestLogout's outcome
 * **Validates: Requirements 7.5, 7.6, 7.7**
 */
import * as fc from 'fast-check';
import { resolveLogoutOutcome } from '../logoutRouting';

const arbErrorMessage = fc.string({ minLength: 1, maxLength: 100 });

describe('Property 14: Logout navigation and state preservation is a total function of requestLogout outcome', () => {
  it('navigates to Auth iff completed; aborted/rejected stay on Dashboard, error only on rejection', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ outcome: 'completed' as const }),
          fc.constant({ outcome: 'aborted' as const }),
          arbErrorMessage.map((message) => ({ outcome: 'wipe_failed' as const, error: new Error(message) })),
          fc.constant({ __rejected: true as const })
        ),
        (outcome) => {
          const result = resolveLogoutOutcome(outcome);

          if ('outcome' in outcome && outcome.outcome === 'completed') {
            expect(result.navigateToAuth).toBe(true);
            expect(result.errorMessage).toBeNull();
          } else if ('outcome' in outcome && outcome.outcome === 'aborted') {
            expect(result.navigateToAuth).toBe(false);
            expect(result.errorMessage).toBeNull();
          } else {
            // wipe_failed or rejected/threw
            expect(result.navigateToAuth).toBe(false);
            expect(result.errorMessage).not.toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
