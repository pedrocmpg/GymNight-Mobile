/**
 * Feature: frontend-backend-integration, Property 19: Pull branch outcome is a total function of the cursor and the pull response
 * **Validates: Requirements 9.4, 9.5, 10.5, 11.2, 11.3, 11.5, 11.7**
 */
import * as fc from 'fast-check';
import { createSyncCycleRunner, type SyncHttpClient } from '../syncCycleRunner';
import { AuthInterceptor } from '../../auth/AuthInterceptor';
import { TokenRefreshCoordinator } from '../../auth/TokenRefreshCoordinator';
import { createSessionStore } from '../../auth/sessionStore';
import type { SessionRefresher } from '../../auth/AuthManager';
import { saveLastPulledAt, clearLastPulledAt, loadLastPulledAt } from '../lastPulledAt';

const VALID_SESSION = { access_token: 'access-1', refresh_token: 'refresh-1', user_id: 'user-1' };

function makeEmptyDb() {
  return {
    get: () => ({
      query: () => ({ fetch: async () => [] }),
      find: async () => {
        throw new Error('not found');
      },
      prepareCreateFromDirtyRaw: (raw: unknown) => ({ __prepared: 'create', raw }),
    }),
    batch: async () => undefined,
    write: async (fn: () => Promise<void>) => fn(),
  } as any;
}

function makeDeps(overrides: { hasSession?: boolean; http: SyncHttpClient; sessionRefresher?: SessionRefresher }) {
  const sessionStore = createSessionStore();
  if (overrides.hasSession !== false) {
    sessionStore.set(VALID_SESSION);
  }
  const authInterceptor = new AuthInterceptor(sessionStore);
  const tokenRefreshCoordinator = new TokenRefreshCoordinator();
  const sessionRefresher: SessionRefresher = overrides.sessionRefresher ?? {
    async refresh() {
      return { session: null, error: new Error('no refresher configured') };
    },
  };

  return {
    backendBaseUrl: 'http://localhost:8000',
    http: overrides.http,
    authInterceptor,
    tokenRefreshCoordinator,
    sessionRefresher,
    sessionStore,
    db: makeEmptyDb(),
  };
}

const noopPost: SyncHttpClient['post'] = async () => ({ kind: 'success', status: 200, body: { status: 'ok' } });

describe('Property 19: Pull branch outcome', () => {
  beforeEach(() => {
    clearLastPulledAt();
  });

  it('always builds URL via buildPullUrl(backendBaseUrl + pull, cursor)', async () => {
    saveLastPulledAt(12345);
    let capturedUrl = '';
    const http: SyncHttpClient = {
      post: noopPost,
      get: async (url) => {
        capturedUrl = url;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 99999 } };
      },
    };

    const deps = makeDeps({ http });
    await createSyncCycleRunner(deps)();

    expect(capturedUrl).toBe('http://localhost:8000/api/v1/sync/pull?last_pulled_at=12345');
  });

  it('no session for pull: skips pull, last_pulled_at unmodified', async () => {
    saveLastPulledAt(500);
    let getCalled = false;
    const http: SyncHttpClient = {
      post: noopPost,
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 999 } };
      },
    };

    const deps = makeDeps({ http, hasSession: false });
    await createSyncCycleRunner(deps)();

    expect(getCalled).toBe(false);
    expect(loadLastPulledAt()).toBe(500);
  });

  it('HTTP 200: applies response and advances last_pulled_at to response.timestamp', async () => {
    saveLastPulledAt(1);
    const http: SyncHttpClient = {
      post: noopPost,
      get: async () => ({ kind: 'success', status: 200, body: { changes: {}, timestamp: 42 } }),
    };

    const deps = makeDeps({ http });
    await createSyncCycleRunner(deps)();

    expect(loadLastPulledAt()).toBe(42);
  });

  it('HTTP 401 Token expirado, refresh + retry succeed: applies retried response', async () => {
    clearLastPulledAt();
    let getCount = 0;
    const http: SyncHttpClient = {
      post: noopPost,
      get: async () => {
        getCount++;
        if (getCount === 1) {
          return { kind: 'success', status: 401, body: { message: 'Token expirado' } };
        }
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 77 } };
      },
    };

    const sessionRefresher: SessionRefresher = {
      async refresh() {
        return { session: { access_token: 'new', refresh_token: 'new-r', user_id: 'user-1' }, error: null };
      },
    };

    const deps = makeDeps({ http, sessionRefresher });
    await createSyncCycleRunner(deps)();

    expect(getCount).toBe(2);
    expect(loadLastPulledAt()).toBe(77);
  });

  it('HTTP 401 Token expirado, refresh fails: aborts, last_pulled_at unmodified', async () => {
    saveLastPulledAt(10);
    let getCount = 0;
    const http: SyncHttpClient = {
      post: noopPost,
      get: async () => {
        getCount++;
        return { kind: 'success', status: 401, body: { message: 'Token expirado' } };
      },
    };

    const sessionRefresher: SessionRefresher = {
      async refresh() {
        return { session: null, error: new Error('refresh failed') };
      },
    };

    const deps = makeDeps({ http, sessionRefresher });
    await createSyncCycleRunner(deps)();

    expect(getCount).toBe(1);
    expect(loadLastPulledAt()).toBe(10);
  });

  it('HTTP 500: last_pulled_at unmodified, does not throw', async () => {
    saveLastPulledAt(7);
    const http: SyncHttpClient = {
      post: noopPost,
      get: async () => ({ kind: 'success', status: 500, body: {} }),
    };

    const deps = makeDeps({ http });
    await expect(createSyncCycleRunner(deps)()).resolves.toBeUndefined();
    expect(loadLastPulledAt()).toBe(7);
  });

  it('network error on pull: last_pulled_at unmodified, does not throw', async () => {
    saveLastPulledAt(3);
    const http: SyncHttpClient = {
      post: noopPost,
      get: async () => ({ kind: 'network_error', error: new Error('timeout') }),
    };

    const deps = makeDeps({ http });
    await expect(createSyncCycleRunner(deps)()).resolves.toBeUndefined();
    expect(loadLastPulledAt()).toBe(3);
  });

  it('property: for any cursor and outcome, runner never throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.integer({ min: 0, max: 4102444800 }), { nil: null }),
        fc.constantFrom(200, 401, 500),
        async (cursor, status) => {
          if (cursor === null) clearLastPulledAt();
          else saveLastPulledAt(cursor);

          const http: SyncHttpClient = {
            post: noopPost,
            get: async () => {
              const body =
                status === 200
                  ? { changes: {}, timestamp: 123456 }
                  : status === 401
                  ? { message: 'Token expirado' }
                  : {};
              return { kind: 'success', status, body };
            },
          };

          const sessionRefresher: SessionRefresher = {
            async refresh() {
              return { session: null, error: new Error('no refresh') };
            },
          };

          const deps = makeDeps({ http, sessionRefresher });
          await expect(createSyncCycleRunner(deps)()).resolves.toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
