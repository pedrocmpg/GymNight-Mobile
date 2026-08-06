/**
 * Feature: frontend-backend-integration, Property 18: Push branch outcome is a total function of the pending queue and the push response
 * **Validates: Requirements 9.2, 9.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.6**
 */
import * as fc from 'fast-check';
import { createSyncCycleRunner, type SyncHttpClient, type HttpResult } from '../syncCycleRunner';
import { AuthInterceptor } from '../../auth/AuthInterceptor';
import { TokenRefreshCoordinator } from '../../auth/TokenRefreshCoordinator';
import { createSessionStore } from '../../auth/sessionStore';
import type { SessionRefresher } from '../../auth/AuthManager';

const VALID_SESSION = { access_token: 'access-1', refresh_token: 'refresh-1', user_id: 'user-1' };

function makeEmptyDb() {
  return {
    get: () => ({ query: () => ({ fetch: async () => [] }) }),
    batch: async () => undefined,
    write: async (fn: () => Promise<void>) => fn(),
  } as any;
}

function makeDbWithPending(records: Array<{ id: string; syncStatus: string; table: string }>) {
  return {
    get: (table: string) => ({
      query: () => ({
        fetch: async () =>
          records
            .filter((r) => r.table === table)
            .map((r) => ({ id: r.id, syncStatus: r.syncStatus, _raw: { id: r.id } })),
      }),
    }),
    batch: async () => undefined,
    write: async (fn: () => Promise<void>) => fn(),
  } as any;
}

function makeDeps(overrides: {
  hasSession?: boolean;
  http: SyncHttpClient;
  sessionRefresher?: SessionRefresher;
  db?: any;
}) {
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
    db: overrides.db ?? makeEmptyDb(),
  };
}

describe('Property 18: Push branch outcome', () => {
  it('empty queue: no push request sent, proceeds to pull', async () => {
    let postCalled = false;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCalled = true;
        return { kind: 'success', status: 200, body: { status: 'ok' } };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const deps = makeDeps({ http });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCalled).toBe(false);
    expect(getCalled).toBe(true);
  });

  it('non-empty queue, no session: no push sent, aborts (no pull)', async () => {
    let postCalled = false;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCalled = true;
        return { kind: 'success', status: 200, body: { status: 'ok' } };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const deps = makeDeps({
      http,
      hasSession: false,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCalled).toBe(false);
    expect(getCalled).toBe(false);
  });

  it('HTTP 200 {status:ok}: exactly one POST sent, proceeds to pull', async () => {
    let postCount = 0;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCount++;
        return { kind: 'success', status: 200, body: { status: 'ok' } };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const deps = makeDeps({
      http,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCount).toBe(1);
    expect(getCalled).toBe(true);
  });

  it('HTTP 403: no retry in same cycle, proceeds to pull', async () => {
    let postCount = 0;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCount++;
        return { kind: 'success', status: 403, body: {} };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const deps = makeDeps({
      http,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCount).toBe(1);
    expect(getCalled).toBe(true);
  });

  it('HTTP 401 Token expirado, refresh succeeds, retry succeeds: proceeds to pull', async () => {
    let postCount = 0;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCount++;
        if (postCount === 1) {
          return { kind: 'success', status: 401, body: { message: 'Token expirado' } };
        }
        return { kind: 'success', status: 200, body: { status: 'ok' } };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const sessionRefresher: SessionRefresher = {
      async refresh() {
        return { session: { access_token: 'new-access', refresh_token: 'new-refresh', user_id: 'user-1' }, error: null };
      },
    };

    const deps = makeDeps({
      http,
      sessionRefresher,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCount).toBe(2);
    expect(getCalled).toBe(true);
  });

  it('HTTP 401 Token expirado, refresh fails: aborts cycle, no pull', async () => {
    let postCount = 0;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCount++;
        return { kind: 'success', status: 401, body: { message: 'Token expirado' } };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const sessionRefresher: SessionRefresher = {
      async refresh() {
        return { session: null, error: new Error('refresh failed') };
      },
    };

    const deps = makeDeps({
      http,
      sessionRefresher,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCount).toBe(1);
    expect(getCalled).toBe(false);
  });

  it('HTTP 401 Token expirado, refresh succeeds but retry also 401s: aborts cycle, no pull', async () => {
    let postCount = 0;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCount++;
        return { kind: 'success', status: 401, body: { message: 'Token expirado' } };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const sessionRefresher: SessionRefresher = {
      async refresh() {
        return { session: { access_token: 'new', refresh_token: 'new-r', user_id: 'user-1' }, error: null };
      },
    };

    const deps = makeDeps({
      http,
      sessionRefresher,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await runner();

    expect(postCount).toBe(2);
    expect(getCalled).toBe(false);
  });

  it('HTTP 500: no retry, no pull, does not throw', async () => {
    let postCount = 0;
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => {
        postCount++;
        return { kind: 'success', status: 500, body: {} };
      },
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const deps = makeDeps({
      http,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await expect(runner()).resolves.toBeUndefined();

    expect(postCount).toBe(1);
    expect(getCalled).toBe(false);
  });

  it('network error on push: no pull, does not throw', async () => {
    let getCalled = false;
    const http: SyncHttpClient = {
      post: async () => ({ kind: 'network_error', error: new Error('ECONNREFUSED') }),
      get: async () => {
        getCalled = true;
        return { kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } };
      },
    };

    const deps = makeDeps({
      http,
      db: makeDbWithPending([{ id: 'rec-1', syncStatus: 'created', table: 'exercises' }]),
    });
    const runner = createSyncCycleRunner(deps);
    await expect(runner()).resolves.toBeUndefined();
    expect(getCalled).toBe(false);
  });

  it('property: for any queue size and terminal outcome, runner never throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        fc.constantFrom(200, 403, 401, 500),
        async (queueSize, status) => {
          const records = Array.from({ length: queueSize }, (_, i) => ({
            id: `rec-${i}`,
            syncStatus: 'created',
            table: 'exercises',
          }));

          const http: SyncHttpClient = {
            post: async () => {
              const body: HttpResult['kind'] extends never ? never : any =
                status === 200
                  ? { status: 'ok' }
                  : status === 401
                  ? { message: 'Token expirado' }
                  : {};
              return { kind: 'success', status, body };
            },
            get: async () => ({ kind: 'success', status: 200, body: { changes: {}, timestamp: 1 } }),
          };

          const sessionRefresher: SessionRefresher = {
            async refresh() {
              return { session: null, error: new Error('no refresh') };
            },
          };

          const deps = makeDeps({ http, sessionRefresher, db: makeDbWithPending(records) });
          const runner = createSyncCycleRunner(deps);
          await expect(runner()).resolves.toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
