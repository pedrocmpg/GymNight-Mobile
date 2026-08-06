/**
 * Feature: frontend-backend-integration, Property 11: Supabase logout port adapter always propagates signOut failures
 * **Validates: Requirements 7.1**
 */
import * as fc from 'fast-check';
import { createSupabaseLogoutPort } from '../logoutAdapters';

const arbThrowOrReject = fc.oneof(
  fc.record({ mode: fc.constant('declaredError' as const), message: fc.string({ minLength: 1 }) }),
  fc.record({ mode: fc.constant('throws' as const), message: fc.string({ minLength: 1 }) }),
  fc.record({ mode: fc.constant('rejects' as const), message: fc.string({ minLength: 1 }) })
);

describe('Property 11: Supabase logout port adapter always propagates signOut failures', () => {
  it('rejects rather than resolving successfully for any failure mode', async () => {
    await fc.assert(
      fc.asyncProperty(arbThrowOrReject, async ({ mode, message }) => {
        const fakeClient: any = {
          auth: {
            signOut:
              mode === 'declaredError'
                ? async () => ({ error: { message } })
                : mode === 'throws'
                ? () => {
                    throw new Error(message);
                  }
                : async () => Promise.reject(new Error(message)),
          },
        };

        const port = createSupabaseLogoutPort(fakeClient);
        await expect(port.invalidateSession()).rejects.toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  it('resolves successfully when signOut succeeds', async () => {
    const fakeClient: any = { auth: { signOut: async () => ({ error: null }) } };
    const port = createSupabaseLogoutPort(fakeClient);
    await expect(port.invalidateSession()).resolves.toBeUndefined();
  });
});
