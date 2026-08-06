import type { Database } from '@nozbe/watermelondb';
import type { AuthInterceptor } from '../auth/AuthInterceptor';
import type { SessionRefresher } from '../auth/AuthManager';
import type { SessionStore } from '../auth/sessionStore';
import type { TokenRefreshCoordinator } from '../auth/TokenRefreshCoordinator';
import type { SyncCycleRunner } from './SyncEngine';
import {
  buildPushPayload,
  markRecordsAsSynced,
  quarantineRejectedPayload,
  type PendingRecord,
  type SyncableTable,
} from './syncAdapters';
import { buildPullUrl } from './pullRequest';
import { applyPullChanges, type PullResponse, type StorageAdapter } from './pullApply';
import { loadLastPulledAt, saveLastPulledAt, clearLastPulledAt } from './lastPulledAt';

const SYNCABLE_TABLES: SyncableTable[] = [
  'users',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sessions',
  'logged_sets',
];

const TOKEN_EXPIRED_MESSAGE = 'Token expirado';

export interface SyncHttpClient {
  post(url: string, body: unknown, headers: Record<string, string>): Promise<HttpResult>;
  get(url: string, headers: Record<string, string>): Promise<HttpResult>;
}

export type HttpResult =
  | { kind: 'success'; status: number; body: unknown }
  | { kind: 'network_error'; error: Error };

export interface SyncCycleRunnerDeps {
  /** Read once from EnvConfig at construction time (Requirement 2.4) — single call site. */
  backendBaseUrl: string;
  http: SyncHttpClient;
  authInterceptor: AuthInterceptor;
  tokenRefreshCoordinator: TokenRefreshCoordinator;
  sessionRefresher: SessionRefresher;
  sessionStore: SessionStore;
  db: Database;
}

type RequestEnvelope = { url: string; method: string; headers: Record<string, string>; body?: unknown };

/** Reads every WatermelonDB record whose syncStatus is not 'synced', across all syncable tables. */
async function loadPendingRecords(db: Database): Promise<PendingRecord[]> {
  const pending: PendingRecord[] = [];

  for (const table of SYNCABLE_TABLES) {
    const records = await db.get(table).query().fetch();
    for (const record of records as any[]) {
      const status = record.syncStatus;
      if (status === 'created' || status === 'updated' || status === 'deleted') {
        pending.push({
          ...record._raw,
          id: record.id,
          _status: status,
          _table: table,
        });
      }
    }
  }

  return pending;
}

function buildAuthedRequest(
  authInterceptor: AuthInterceptor,
  url: string,
  method: 'GET' | 'POST',
  body?: unknown
): RequestEnvelope | null {
  try {
    return authInterceptor.attachAuthHeader({ url, method, headers: {}, body });
  } catch {
    return null;
  }
}

/**
 * Triggers exactly one refresh via the Token_Refresh_Coordinator, using the
 * refresh_token from the session currently held by the SessionStore.
 * Returns false (no refresh attempted or refresh failed) if there is no
 * session or no refresh_token available.
 */
async function performRefresh(deps: SyncCycleRunnerDeps): Promise<boolean> {
  const session = deps.sessionStore.getCurrentSession();
  if (!session?.refresh_token) return false;

  const result = await deps.tokenRefreshCoordinator.refresh(async () => {
    const refreshResult = await deps.sessionRefresher.refresh(session.refresh_token);
    if (refreshResult.error || !refreshResult.session) {
      return { success: false, error: refreshResult.error ?? new Error('refresh failed') };
    }
    deps.sessionStore.set(refreshResult.session);
    return { success: true, newAccessToken: refreshResult.session.access_token };
  });

  return result.success;
}

function isUnauthorizedTokenExpired(result: Extract<HttpResult, { kind: 'success' }>): boolean {
  const body = result.body as { message?: string; detail?: string } | undefined;
  const message = body?.message ?? body?.detail;
  return result.status === 401 && message === TOKEN_EXPIRED_MESSAGE;
}

type PushOutcome = 'continue' | 'abort_cycle';

function flattenPushedRecords(
  payload: ReturnType<typeof buildPushPayload>,
  pending: PendingRecord[]
): PendingRecord[] {
  const pushedIds = new Set<string>();
  for (const table of Object.values(payload.changes)) {
    for (const record of table.created) pushedIds.add(record.id as string);
    for (const record of table.updated) pushedIds.add(record.id as string);
    for (const id of table.deleted) pushedIds.add(id);
  }
  return pending.filter((r) => pushedIds.has(r.id));
}

/**
 * Implements the push branch per the design's outcome table (Property 18).
 */
async function runPushBranch(pending: PendingRecord[], deps: SyncCycleRunnerDeps): Promise<PushOutcome> {
  if (pending.length === 0) {
    return 'continue';
  }

  const payload = buildPushPayload(pending);
  const url = `${deps.backendBaseUrl}/api/v1/sync/push`;

  const request = buildAuthedRequest(deps.authInterceptor, url, 'POST', payload);
  if (!request) {
    // No session available for push (Requirement 10.4)
    return 'abort_cycle';
  }

  const result = await deps.http.post(request.url, request.body, request.headers);
  return handlePushResult(result, pending, payload, deps, /* isRetry */ false);
}

async function handlePushResult(
  result: HttpResult,
  pending: PendingRecord[],
  payload: ReturnType<typeof buildPushPayload>,
  deps: SyncCycleRunnerDeps,
  isRetry: boolean
): Promise<PushOutcome> {
  if (result.kind === 'network_error') {
    return 'abort_cycle';
  }

  if (result.status === 200) {
    const pushedRecords = flattenPushedRecords(payload, pending);
    markRecordsAsSynced(pending, pushedRecords);
    return 'continue';
  }

  if (result.status === 403) {
    quarantineRejectedPayload(pending, pending);
    return 'continue';
  }

  if (isUnauthorizedTokenExpired(result)) {
    if (isRetry) {
      return 'abort_cycle';
    }
    const refreshed = await performRefresh(deps);
    if (!refreshed) {
      return 'abort_cycle';
    }
    const url = `${deps.backendBaseUrl}/api/v1/sync/push`;
    const retryRequest = buildAuthedRequest(deps.authInterceptor, url, 'POST', payload);
    if (!retryRequest) {
      return 'abort_cycle';
    }
    const retryResult = await deps.http.post(retryRequest.url, retryRequest.body, retryRequest.headers);
    return handlePushResult(retryResult, pending, payload, deps, /* isRetry */ true);
  }

  // HTTP 500 or any other unhandled status: leave queue unmodified, don't proceed
  return 'abort_cycle';
}

/**
 * Bridges applyPullChanges' synchronous StorageAdapter contract to WatermelonDB's
 * async write API: each applyChange call is queued, then flushed as a single
 * db.write() batch by applyPullChangesToWatermelon below. If any upsert/delete
 * queued during the synchronous pass fails to resolve (find() throws for a
 * genuinely missing record on update), the caller treats it as a non-transient
 * failure and applyPullChanges rolls back the cursor accordingly.
 */
class WatermelonPullStorageAdapter implements StorageAdapter {
  private db: Database;
  private operations: Array<{ table: string; operation: 'create' | 'update' | 'delete'; data: unknown }> = [];
  private snapshotCursor: number | null = null;

  constructor(db: Database) {
    this.db = db;
  }

  applyChange(table: string, operation: 'create' | 'update' | 'delete', data: unknown): void {
    this.operations.push({ table, operation, data });
  }

  getLastPulledAt(): number | null {
    return loadLastPulledAt();
  }

  setLastPulledAt(timestamp: number): void {
    saveLastPulledAt(timestamp);
  }

  createSnapshot(): unknown {
    this.snapshotCursor = loadLastPulledAt();
    return this.snapshotCursor;
  }

  restoreSnapshot(snapshot: unknown): void {
    const cursor = snapshot as number | null;
    if (cursor === null) {
      clearLastPulledAt();
    } else {
      saveLastPulledAt(cursor);
    }
    this.operations = [];
  }

  /** Flushes all queued operations into a single WatermelonDB write batch. */
  async flush(): Promise<void> {
    if (this.operations.length === 0) return;

    await this.db.write(async () => {
      const prepared = [] as unknown[];

      for (const op of this.operations) {
        const collection = this.db.get(op.table);

        if (op.operation === 'delete') {
          const id = op.data as string;
          try {
            const record = await collection.find(id);
            prepared.push(record.prepareDestroyPermanently());
          } catch {
            // Record already absent locally — nothing to delete.
          }
          continue;
        }

        const raw = op.data as Record<string, unknown>;
        const id = raw.id as string;

        try {
          const existing = await collection.find(id);
          prepared.push(
            existing.prepareUpdate((record: any) => {
              Object.assign(record._raw, raw);
            })
          );
        } catch {
          prepared.push(collection.prepareCreateFromDirtyRaw(raw));
        }
      }

      await this.db.batch(...(prepared as any[]));
    });
  }
}

/**
 * Implements the pull branch per the design's outcome table (Property 19).
 */
async function runPullBranch(deps: SyncCycleRunnerDeps): Promise<void> {
  const cursor = loadLastPulledAt();
  const url = buildPullUrl(`${deps.backendBaseUrl}/api/v1/sync/pull`, cursor);
  await dispatchPull(url, deps, /* isRetry */ false);
}

async function dispatchPull(url: string, deps: SyncCycleRunnerDeps, isRetry: boolean): Promise<void> {
  const request = buildAuthedRequest(deps.authInterceptor, url, 'GET');
  if (!request) {
    // No session available for pull (Requirement 10.5)
    return;
  }

  const result = await deps.http.get(request.url, request.headers);

  if (result.kind === 'network_error') {
    return;
  }

  if (result.status === 200) {
    const storage = new WatermelonPullStorageAdapter(deps.db);
    const applyResult = applyPullChanges(result.body as PullResponse, storage);
    if (applyResult.success) {
      await storage.flush();
    }
    return;
  }

  if (isUnauthorizedTokenExpired(result)) {
    if (isRetry) return;
    const refreshed = await performRefresh(deps);
    if (!refreshed) return;
    await dispatchPull(url, deps, /* isRetry */ true);
    return;
  }

  // HTTP 500 or other: leave last_pulled_at unmodified
}

export function createSyncCycleRunner(deps: SyncCycleRunnerDeps): SyncCycleRunner {
  return async function runSyncCycle(): Promise<void> {
    const pending = await loadPendingRecords(deps.db);

    const pushOutcome = await runPushBranch(pending, deps);
    if (pushOutcome === 'abort_cycle') return;

    await runPullBranch(deps);
  };
}
