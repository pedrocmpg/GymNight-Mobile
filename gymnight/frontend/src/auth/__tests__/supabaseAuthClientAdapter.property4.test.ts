/**
 * Feature: frontend-backend-integration, Property 4: SupabaseAuthClient adapter never propagates an uncaught exception
 * **Validates: Requirements 3.4**
 */
import * as fc from 'fast-check';
import { createSupabaseAuthClientAdapter } from '../supabaseAuthClientAdapter';

const arbThrowable = fc.oneof(
  fc.string().map((s) => new Error(s)),
  fc.object(),
  fc.string(),
  fc.constant(undefined),
  fc.integer()
);

describe('Property 4: SupabaseAuthClient adapter never propagates an uncaught exception', () => {
  it('resolves (never rejects) with the declared error shape for any thrown/rejected value', async () => {
    await fc.assert(
      fc.asyncProperty(arbThrowable, fc.emailAddress(), fc.boolean(), async (thrown, email, rejects) => {
        const fakeClient: any = {
          auth: {
            signInWithPassword: rejects
              ? async () => Promise.reject(thrown)
              : () => {
                  throw thrown;
                },
          },
        };

        const adapter = createSupabaseAuthClientAdapter(fakeClient);

        await expect(
          adapter.signInWithPassword({ email, password: 'irrelevant' })
        ).resolves.toEqual(
          expect.objectContaining({
            data: { session: null },
            error: expect.objectContaining({ message: expect.any(String) }),
          })
        );
      }),
      { numRuns: 100 }
    );
  });
});
