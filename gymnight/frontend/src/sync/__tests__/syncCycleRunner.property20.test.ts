/**
 * Feature: frontend-backend-integration, Property 20: Every push and pull request carries exactly one Authorization header attached at dispatch time
 * **Validates: Requirements 10.1**
 */
import * as fc from 'fast-check';
import { createSyncCycleRunner, type SyncHttpClient } from '../syncCycleRunner';
import { AuthInterceptor } from '../../auth/AuthInterceptor';
import { TokenRefreshCoordinator } from '../../auth/TokenRefreshCoordinator';
import { createSessionStore } from '../../auth/sessionStore';
import type { SessionRefresher } from '../../auth/AuthManager';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim().length > 0);

function makeDbWithPending(hasPending: boolean) {
  return {
    get: (table: string) => ({
      query: () => ({
        fetch: async () => (hasPending ? [{ id: `${table}-1`, syncStatus: 'created', _raw: { id: `${table}-1` } }] : []),
      }),
    }),
    batch: async () => undefined,
    write: async (fn: () => Promise<void>) => fn(),
  } as any;
}

describe('Property 20: Every push and pull request carries exactly one Authorization header', () => {
  it('for any valid access_token, both push and pull requests carry exactly one Bearer header', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyString, async (accessToken) => {
        const sessionStore = createSessionStore();
        sessionStore.set({ access_token: accessToken, refresh_token: 'r', user_id: 'u' });
        const authInterceptor = new AuthInterceptor(sessionStore);
        const tokenRefreshCoordinator = new TokenRefreshCoordinator();
        const sessionRefresher: SessionRefresher = {
          async refresh() {
            return { session: null, error: new Error('unused') };
          },
        };

        const capturedHeaders: Record<string, string>[] = [];
        const http: SyncHttpClient = {
          post: async (_url, _body, headers) => {
            capturedHeaders.push(headers);
            return { kind: 'success', status: 200, body: { status: 'ok' } };
          },
          get: async (_url, headers) => {
            capturedHeaders.push(headers);
            return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
          },
        };

        const deps = {
          backendBaseUrl: 'http://localhost:8000',
          http,
          authInterceptor,
          tokenRefreshCoordinator,
          sessionRefresher,
          sessionStore,
          db: makeDbWithPending(true),
        };

        await createSyncCycleRunner(deps)();

        expect(capturedHeaders.length).toBe(2);
        for (const headers of capturedHeaders) {
          const authKeys = Object.keys(headers).filter((k) => k === 'Authorization');
          expect(authKeys.length).toBe(1);
          expect(headers.Authorization).toBe(`Bearer ${accessToken}`);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('pull-only cycle (empty queue) still attaches exactly one Authorization header', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyString, async (accessToken) => {
        const sessionStore = createSessionStore();
        sessionStore.set({ access_token: accessToken, refresh_token: 'r', user_id: 'u' });
        const authInterceptor = new AuthInterceptor(sessionStore);

        let capturedHeaders: Record<string, string> | null = null;
        const http: SyncHttpClient = {
          post: async () => ({ kind: 'success', status: 200, body: { status: 'ok' } }),
          get: async (_url, headers) => {
            capturedHeaders = headers;
            return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
          },
        };

        const deps = {
          backendBaseUrl: 'http://localhost:8000',
          http,
          authInterceptor,
          tokenRefreshCoordinator: new TokenRefreshCoordinator(),
          sessionRefresher: { async refresh() { return { session: null, error: new Error('unused') }; } },
          sessionStore,
          db: makeDbWithPending(false),
        };

        await createSyncCycleRunner(deps)();

        expect(capturedHeaders).not.toBeNull();
        expect(Object.keys(capturedHeaders as any).filter((k) => k === 'Authorization').length).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});
