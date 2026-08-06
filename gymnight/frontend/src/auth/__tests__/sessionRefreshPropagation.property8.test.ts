/**
 * Feature: frontend-backend-integration, Property 8: Successful refresh propagates identically to storage and the session provider
 * **Validates: Requirements 4.7**
 */
import * as fc from 'fast-check';
import { createSessionStore } from '../sessionStore';
import { withSessionPropagation } from '../sessionProducers';
import type { SessionRefresher } from '../AuthManager';
import type { Session } from '../SecureStorage';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: arbNonEmptyString,
  refresh_token: arbNonEmptyString,
  user_id: arbNonEmptyString,
});

describe('Property 8: Successful refresh propagates identically to storage and the session provider', () => {
  it('after a successful refresh, SessionProvider reflects exactly the new session', async () => {
    await fc.assert(
      fc.asyncProperty(arbSession, arbNonEmptyString, async (newSession, oldRefreshToken) => {
        const sessionStore = createSessionStore();
        const baseRefresher: SessionRefresher = {
          async refresh() {
            return { session: newSession, error: null };
          },
        };
        const refresher = withSessionPropagation(baseRefresher, sessionStore);

        const result = await refresher.refresh(oldRefreshToken);

        expect(result.session).toEqual(newSession);
        expect(sessionStore.getCurrentSession()).toEqual(newSession);
      }),
      { numRuns: 100 }
    );
  });
});
