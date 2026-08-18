/**
 * Property: Session start navigation/error is a total function of persistence outcome.
 */
import * as fc from 'fast-check';
import { resolveStartSessionOutcome } from '../startSessionRouting';
import type { StartSessionPersistResult } from '../startSessionRouting';

describe('Property: Session start navigation/error is total', () => {
  it('navigates to ActiveSession iff success with a sessionId; otherwise stays with a non-empty error message', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            success: fc.constant(true as const),
            sessionId: fc.uuid(),
          }),
          fc.string({ minLength: 1 }).map((message) => ({
            success: false as const,
            error: new Error(message),
          })),
        ),
        (result: StartSessionPersistResult) => {
          const outcome = resolveStartSessionOutcome(result);

          if (result.success && result.sessionId) {
            expect(outcome.navigateToActiveSession).toBe(true);
            expect(outcome.sessionId).toBe(result.sessionId);
            expect(outcome.errorMessage).toBeNull();
          } else {
            expect(outcome.navigateToActiveSession).toBe(false);
            expect(outcome.sessionId).toBeNull();
            expect(outcome.errorMessage).not.toBeNull();
            expect((outcome.errorMessage as string).length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
