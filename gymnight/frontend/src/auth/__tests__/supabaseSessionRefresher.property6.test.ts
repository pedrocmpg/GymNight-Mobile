/**
 * Feature: frontend-backend-integration, Property 6: SessionRefresher adapter preserves successful refresh fields
 * **Validates: Requirements 4.3**
 */
import * as fc from 'fast-check';
import { createSupabaseSessionRefresher } from '../supabaseSessionRefresher';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

describe('Property 6: SessionRefresher adapter preserves successful refresh fields', () => {
  it('carries access_token, refresh_token, user_id unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbNonEmptyString,
        arbNonEmptyString,
        arbNonEmptyString,
        arbNonEmptyString,
        async (oldRefreshToken, userId, newAccessToken, newRefreshToken) => {
          const fakeClient: any = {
            auth: {
              refreshSession: async () => ({
                data: {
                  session: {
                    access_token: newAccessToken,
                    refresh_token: newRefreshToken,
                    user: { id: userId },
                  },
                },
                error: null,
              }),
            },
          };

          const refresher = createSupabaseSessionRefresher(fakeClient);
          const result = await refresher.refresh(oldRefreshToken);

          expect(result.error).toBeNull();
          expect(result.session).not.toBeNull();
          if (result.session) {
            expect(result.session.access_token).toBe(newAccessToken);
            expect(result.session.refresh_token).toBe(newRefreshToken);
            expect(result.session.user_id).toBe(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
