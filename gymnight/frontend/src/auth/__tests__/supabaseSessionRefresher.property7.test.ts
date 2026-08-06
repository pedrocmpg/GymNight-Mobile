/**
 * Feature: frontend-backend-integration, Property 7: Failed refresh never updates the stored session
 * **Validates: Requirements 4.4**
 */
import * as fc from 'fast-check';
import { createSupabaseSessionRefresher } from '../supabaseSessionRefresher';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

describe('Property 7: Failed refresh never updates the stored session', () => {
  it('declared error → error shape, no session, no persist call', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyString, arbNonEmptyString, async (refreshToken, errorMessage) => {
        let saveSessionCalled = false;
        const fakeClient: any = {
          auth: {
            refreshSession: async () => ({
              data: { session: null },
              error: { message: errorMessage },
            }),
          },
        };

        const refresher = createSupabaseSessionRefresher(fakeClient);
        const result = await refresher.refresh(refreshToken);

        expect(result.session).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(saveSessionCalled).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('null session with no error → error shape, no session', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyString, async (refreshToken) => {
        const fakeClient: any = {
          auth: {
            refreshSession: async () => ({ data: { session: null }, error: null }),
          },
        };

        const refresher = createSupabaseSessionRefresher(fakeClient);
        const result = await refresher.refresh(refreshToken);

        expect(result.session).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
      }),
      { numRuns: 100 }
    );
  });

  it('thrown/rejected failure never propagates, always error shape', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyString, arbNonEmptyString, async (refreshToken, message) => {
        const fakeClient: any = {
          auth: {
            refreshSession: async () => {
              throw new Error(message);
            },
          },
        };

        const refresher = createSupabaseSessionRefresher(fakeClient);
        await expect(refresher.refresh(refreshToken)).resolves.toEqual(
          expect.objectContaining({ session: null, error: expect.any(Error) })
        );
      }),
      { numRuns: 100 }
    );
  });
});
