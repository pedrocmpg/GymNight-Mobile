/**
 * Property 25: Expired access token with a present refresh_token always triggers
 * the refresh flow before the navigation decision
 * **Validates: Requirements 8.4**
 *
 * For any restored Session whose access_token is expired and whose refresh_token
 * is present, the refresh flow SHALL be invoked and reach a terminal outcome
 * before the launch navigation decision (Dashboard vs. Auth) is finalized.
 *
 * We verify for any arbitrary session with expired access_token + present refresh_token:
 * 1. The refresh flow is ALWAYS triggered before the navigation decision
 * 2. Navigation to dashboard only happens AFTER refresh succeeds
 * 3. Navigation to auth only happens AFTER refresh fails
 * 4. The refresh is never skipped when access_token is expired and refresh_token is present
 * 5. The ordering is: load session → detect expired → call refresh → then decide
 */
import * as fc from 'fast-check';
import {
  AuthManager,
  SupabaseAuthClient,
  SecureStoragePort,
  TokenValidator,
  SessionRefresher,
  RestoreSessionResult,
} from '../AuthManager';
import { Session } from '../SecureStorage';

// --- Arbitraries ---

const arbNonEmptyString = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary valid Session with a present refresh_token.
 * The access_token is always treated as expired via the TokenValidator mock.
 */
const arbSessionWithRefreshToken: fc.Arbitrary<Session> = fc.record({
  access_token: fc.string({ minLength: 10, maxLength: 256 }),
  refresh_token: fc.string({ minLength: 1, maxLength: 256 }).filter((s) => s.length > 0),
  user_id: fc.uuid(),
});

/**
 * Arbitrary new session returned by a successful refresh.
 */
const arbRefreshedSession: fc.Arbitrary<Session> = fc.record({
  access_token: fc.string({ minLength: 10, maxLength: 256 }),
  refresh_token: fc.string({ minLength: 1, maxLength: 256 }),
  user_id: fc.uuid(),
});

/**
 * Arbitrary refresh error — simulates any kind of refresh failure.
 */
const arbRefreshError = fc.oneof(
  fc.constant(new Error('Refresh token expired')),
  fc.constant(new Error('Refresh token revoked')),
  fc.constant(new Error('Network error during refresh')),
  fc.constant(new Error('Invalid refresh token')),
  fc.constant(new Error('Server error')),
  arbNonEmptyString.map((msg) => new Error(msg))
);

// --- Helpers ---

type EventLog = Array<{ event: string; timestamp: number }>;

/**
 * Creates instrumented mocks that record the ordering of operations.
 */
function createInstrumentedMocks(
  storedSession: Session,
  refreshOutcome: { success: true; newSession: Session } | { success: false; error: Error }
) {
  const log: EventLog = [];
  let counter = 0;

  const supabaseAuth: SupabaseAuthClient = {
    async signInWithPassword(_credentials) {
      return { data: { session: null }, error: { message: 'Not used in restore' } };
    },
  };

  const storage: SecureStoragePort = {
    async saveSession(session) {
      log.push({ event: 'saveSession', timestamp: counter++ });
    },
    async loadSession() {
      log.push({ event: 'loadSession', timestamp: counter++ });
      return storedSession;
    },
    async clearSession() {
      log.push({ event: 'clearSession', timestamp: counter++ });
    },
  };

  const tokenValidator: TokenValidator = {
    isExpired(_accessToken: string) {
      log.push({ event: 'isExpired_check', timestamp: counter++ });
      // Always return expired for this property test
      return true;
    },
  };

  const sessionRefresher: SessionRefresher = {
    async refresh(refreshToken: string) {
      log.push({ event: 'refresh_start', timestamp: counter++ });
      await Promise.resolve();
      if (refreshOutcome.success) {
        log.push({ event: 'refresh_success', timestamp: counter++ });
        return { session: refreshOutcome.newSession, error: null };
      } else {
        log.push({ event: 'refresh_failed', timestamp: counter++ });
        return { session: null, error: refreshOutcome.error };
      }
    },
  };

  return { supabaseAuth, storage, tokenValidator, sessionRefresher, log };
}

// --- Property Tests ---

describe('Property 25: Expired access token with present refresh_token always triggers refresh before navigation decision', () => {
  it(
    'refresh flow is ALWAYS triggered before navigation when access_token is expired and refresh_token is present',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSessionWithRefreshToken,
          arbRefreshedSession,
          async (storedSession, newSession) => {
            const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
              createInstrumentedMocks(storedSession, { success: true, newSession });

            const authManager = new AuthManager(
              supabaseAuth,
              storage,
              tokenValidator,
              sessionRefresher
            );
            const result: RestoreSessionResult = await authManager.restoreSession();

            // Refresh must have been triggered
            const refreshStart = log.find((e) => e.event === 'refresh_start');
            expect(refreshStart).toBeDefined();

            // Ordering: loadSession → isExpired_check → refresh_start
            const loadSessionEntry = log.find((e) => e.event === 'loadSession');
            const isExpiredEntry = log.find((e) => e.event === 'isExpired_check');

            expect(loadSessionEntry).toBeDefined();
            expect(isExpiredEntry).toBeDefined();
            expect(loadSessionEntry!.timestamp).toBeLessThan(isExpiredEntry!.timestamp);
            expect(isExpiredEntry!.timestamp).toBeLessThan(refreshStart!.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'navigation to dashboard only happens AFTER refresh succeeds',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSessionWithRefreshToken,
          arbRefreshedSession,
          async (storedSession, newSession) => {
            const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
              createInstrumentedMocks(storedSession, { success: true, newSession });

            const authManager = new AuthManager(
              supabaseAuth,
              storage,
              tokenValidator,
              sessionRefresher
            );
            const result: RestoreSessionResult = await authManager.restoreSession();

            // Must navigate to dashboard
            expect(result.navigateTo).toBe('dashboard');

            // Refresh must have completed successfully before navigation decision
            const refreshSuccess = log.find((e) => e.event === 'refresh_success');
            expect(refreshSuccess).toBeDefined();

            // New session must have been persisted
            const saveSessionEntry = log.find((e) => e.event === 'saveSession');
            expect(saveSessionEntry).toBeDefined();

            // Ordering: refresh_success → saveSession (persist before nav)
            expect(refreshSuccess!.timestamp).toBeLessThan(saveSessionEntry!.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'navigation to auth only happens AFTER refresh fails',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSessionWithRefreshToken,
          arbRefreshError,
          async (storedSession, refreshError) => {
            const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
              createInstrumentedMocks(storedSession, { success: false, error: refreshError });

            const authManager = new AuthManager(
              supabaseAuth,
              storage,
              tokenValidator,
              sessionRefresher
            );
            const result: RestoreSessionResult = await authManager.restoreSession();

            // Must navigate to auth
            expect(result.navigateTo).toBe('auth');

            // Refresh must have been attempted and failed
            const refreshFailed = log.find((e) => e.event === 'refresh_failed');
            expect(refreshFailed).toBeDefined();

            // Storage must have been cleared after failure
            const clearSessionEntry = log.find((e) => e.event === 'clearSession');
            expect(clearSessionEntry).toBeDefined();

            // Ordering: refresh_failed → clearSession
            expect(refreshFailed!.timestamp).toBeLessThan(clearSessionEntry!.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'refresh is never skipped when access_token is expired and refresh_token is present',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSessionWithRefreshToken,
          fc.boolean(),
          arbRefreshedSession,
          arbRefreshError,
          async (storedSession, shouldSucceed, newSession, refreshError) => {
            const outcome = shouldSucceed
              ? { success: true as const, newSession }
              : { success: false as const, error: refreshError };

            const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
              createInstrumentedMocks(storedSession, outcome);

            const authManager = new AuthManager(
              supabaseAuth,
              storage,
              tokenValidator,
              sessionRefresher
            );
            await authManager.restoreSession();

            // The refresh_start event MUST always appear — refresh is never skipped
            const refreshStart = log.find((e) => e.event === 'refresh_start');
            expect(refreshStart).toBeDefined();

            // Either refresh_success or refresh_failed must appear (terminal outcome reached)
            const refreshSuccess = log.find((e) => e.event === 'refresh_success');
            const refreshFailed = log.find((e) => e.event === 'refresh_failed');
            const refreshTerminated = refreshSuccess !== undefined || refreshFailed !== undefined;
            expect(refreshTerminated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'ordering is: load session → detect expired → call refresh → then decide navigation',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSessionWithRefreshToken,
          fc.boolean(),
          arbRefreshedSession,
          arbRefreshError,
          async (storedSession, shouldSucceed, newSession, refreshError) => {
            const outcome = shouldSucceed
              ? { success: true as const, newSession }
              : { success: false as const, error: refreshError };

            const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
              createInstrumentedMocks(storedSession, outcome);

            const authManager = new AuthManager(
              supabaseAuth,
              storage,
              tokenValidator,
              sessionRefresher
            );
            const result = await authManager.restoreSession();

            // Verify strict ordering of events
            const loadSessionEntry = log.find((e) => e.event === 'loadSession');
            const isExpiredEntry = log.find((e) => e.event === 'isExpired_check');
            const refreshStart = log.find((e) => e.event === 'refresh_start');

            expect(loadSessionEntry).toBeDefined();
            expect(isExpiredEntry).toBeDefined();
            expect(refreshStart).toBeDefined();

            // Order: load → expired check → refresh
            expect(loadSessionEntry!.timestamp).toBeLessThan(isExpiredEntry!.timestamp);
            expect(isExpiredEntry!.timestamp).toBeLessThan(refreshStart!.timestamp);

            // The refresh reaches a terminal state (success or failed) before result is returned
            const refreshSuccess = log.find((e) => e.event === 'refresh_success');
            const refreshFailed = log.find((e) => e.event === 'refresh_failed');
            const terminalEvent = refreshSuccess ?? refreshFailed;
            expect(terminalEvent).toBeDefined();

            // Navigation decision is consistent with refresh outcome
            if (shouldSucceed) {
              expect(result.navigateTo).toBe('dashboard');
            } else {
              expect(result.navigateTo).toBe('auth');
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );
});
