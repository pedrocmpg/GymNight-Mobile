/**
 * Feature: frontend-backend-integration, Property 2: SupabaseAuthClient adapter preserves successful sign-in fields
 * **Validates: Requirements 3.2**
 */
import * as fc from 'fast-check';
import { createSupabaseAuthClientAdapter } from '../supabaseAuthClientAdapter';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

describe('Property 2: SupabaseAuthClient adapter preserves successful sign-in fields', () => {
  it('carries user id, access_token, refresh_token unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbNonEmptyString,
        arbNonEmptyString,
        arbNonEmptyString,
        fc.emailAddress(),
        async (userId, accessToken, refreshToken, email) => {
          const fakeClient: any = {
            auth: {
              signInWithPassword: async () => ({
                data: {
                  session: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    user: { id: userId, email },
                  },
                },
                error: null,
              }),
            },
          };

          const adapter = createSupabaseAuthClientAdapter(fakeClient);
          const result = await adapter.signInWithPassword({ email, password: 'irrelevant' });

          expect(result.error).toBeNull();
          expect(result.data.session).not.toBeNull();
          if (result.data.session) {
            expect(result.data.session.user_id).toBe(userId);
            expect(result.data.session.access_token).toBe(accessToken);
            expect(result.data.session.refresh_token).toBe(refreshToken);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
