/**
 * Feature: frontend-backend-integration, Property 3: SupabaseAuthClient adapter preserves error messages
 * **Validates: Requirements 3.3**
 */
import * as fc from 'fast-check';
import { createSupabaseAuthClientAdapter } from '../supabaseAuthClientAdapter';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 128 }).filter((s) => s.trim().length > 0);

describe('Property 3: SupabaseAuthClient adapter preserves error messages', () => {
  it('returns the declared error shape carrying the message unchanged, no session', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyString, fc.emailAddress(), async (errorMessage, email) => {
        const fakeClient: any = {
          auth: {
            signInWithPassword: async () => ({
              data: { session: null },
              error: { message: errorMessage },
            }),
          },
        };

        const adapter = createSupabaseAuthClientAdapter(fakeClient);
        const result = await adapter.signInWithPassword({ email, password: 'irrelevant' });

        expect(result.data.session).toBeNull();
        expect(result.error).not.toBeNull();
        expect(result.error?.message).toBe(errorMessage);
      }),
      { numRuns: 100 }
    );
  });
});
