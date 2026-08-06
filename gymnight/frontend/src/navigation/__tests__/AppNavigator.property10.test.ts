/**
 * Feature: frontend-backend-integration, Property 10: Sign-in navigation routing is a total function of signIn's outcome
 * **Validates: Requirements 6.5, 6.6, 6.8**
 */
import * as fc from 'fast-check';
import { resolveSignInOutcome } from '../bootstrapRouting';

const arbErrorMessage = fc.string({ minLength: 1, maxLength: 100 });

describe('Property 10: Sign-in navigation routing is a total function of signIn outcome', () => {
  it('navigates to Dashboard iff success, otherwise stays on Auth with a non-empty error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ success: true as const, navigateTo: 'dashboard' as const }),
          arbErrorMessage.map((message) => ({ success: false as const, error: new Error(message) })),
          fc.constant({ __rejected: true as const })
        ),
        (outcome) => {
          const result = resolveSignInOutcome(outcome);

          if ('success' in outcome && outcome.success) {
            expect(result.navigateToDashboard).toBe(true);
            expect(result.errorMessage).toBeNull();
          } else {
            expect(result.navigateToDashboard).toBe(false);
            expect(result.errorMessage).not.toBeNull();
            expect((result.errorMessage as string).length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
