/**
 * Feature: frontend-backend-integration, Property 9: Bootstrap navigation routing is a total function of restoreSession's outcome
 * **Validates: Requirements 6.3, 6.4, 6.7**
 */
import * as fc from 'fast-check';
import { resolvePhaseFromRestoreOutcome, runBootstrapRouting } from '../bootstrapRouting';
import { createSessionStore } from '../../auth/sessionStore';
import type { AuthManager } from '../../auth/AuthManager';

describe('Property 9: Bootstrap navigation routing is a total function of restoreSession outcome', () => {
  it('resolves to authenticated iff the outcome is exactly { navigateTo: "dashboard" }', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ navigateTo: 'dashboard' as const }),
          fc.constant({ navigateTo: 'auth' as const }),
          fc.constant({ __rejected: true as const })
        ),
        (outcome) => {
          const phase = resolvePhaseFromRestoreOutcome(outcome);
          const expected = 'navigateTo' in outcome && outcome.navigateTo === 'dashboard' ? 'authenticated' : 'auth';
          expect(phase).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('runBootstrapRouting: resolves authenticated iff restoreSession resolves navigateTo=dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant({ kind: 'dashboard' as const }),
          fc.constant({ kind: 'auth' as const }),
          fc.constant({ kind: 'throws' as const }),
          fc.constant({ kind: 'rejects' as const })
        ),
        async (scenario) => {
          const sessionStore = createSessionStore();
          const authManager = {
            restoreSession: async () => {
              if (scenario.kind === 'dashboard') return { navigateTo: 'dashboard' as const };
              if (scenario.kind === 'auth') return { navigateTo: 'auth' as const };
              if (scenario.kind === 'throws') throw new Error('boom');
              return Promise.reject(new Error('rejected'));
            },
          } as unknown as AuthManager;

          const phase = await runBootstrapRouting(authManager, sessionStore);
          expect(phase).toBe(scenario.kind === 'dashboard' ? 'authenticated' : 'auth');
        }
      ),
      { numRuns: 100 }
    );
  });
});
