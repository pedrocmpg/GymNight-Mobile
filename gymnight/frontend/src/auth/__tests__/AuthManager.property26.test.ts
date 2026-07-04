/**
 * Property 26: Absent or unparseable stored session always clears storage and routes to Auth_Screen
 * **Validates: Requirements 8.5**
 *
 * IF no Session is found in Secure_Storage at launch, OR the stored Session data
 * cannot be parsed as valid Session data, THEN THE Auth_Manager SHALL clear any
 * unparseable data from Secure_Storage and SHALL navigate to the Auth_Screen.
 *
 * We verify for any state where loadSession returns null (absent or unparseable):
 * 1. The result is ALWAYS { navigateTo: 'auth' } — routes to Auth_Screen
 * 2. clearSession() is ALWAYS called (to clean up any corrupted data)
 * 3. No refresh is attempted (since there's no session to refresh from)
 * 4. This holds for: completely absent session, corrupted/unparseable data, missing fields
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

// --- Helpers ---

type EventLog = Array<{ event: string; timestamp: number }>;

/**
 * Represents the reason why loadSession returned null.
 * Used to model the different scenarios that lead to a null return.
 */
type NullSessionReason =
  | 'absent'           // No session stored at all
  | 'corrupted_json'   // Stored value was not valid JSON
  | 'missing_fields'   // JSON parsed but missing required Session fields
  | 'empty_string'     // Empty string stored
  | 'invalid_type';    // Stored value was a non-object type

/**
 * Arbitrary for the reason a session is null (models the different scenarios
 * that lead to loadSession() returning null).
 */
const arbNullSessionReason: fc.Arbitrary<NullSessionReason> = fc.oneof(
  fc.constant('absent' as NullSessionReason),
  fc.constant('corrupted_json' as NullSessionReason),
  fc.constant('missing_fields' as NullSessionReason),
  fc.constant('empty_string' as NullSessionReason),
  fc.constant('invalid_type' as NullSessionReason)
);

/**
 * Creates instrumented mocks that record the ordering of operations.
 * The storage.loadSession always returns null (simulating absent/unparseable session).
 */
function createInstrumentedMocks(nullReason: NullSessionReason) {
  const log: EventLog = [];
  let counter = 0;

  const supabaseAuth: SupabaseAuthClient = {
    async signInWithPassword(_credentials) {
      return { data: { session: null }, error: { message: 'Not used in restore' } };
    },
  };

  const storage: SecureStoragePort = {
    async saveSession(_session) {
      log.push({ event: 'saveSession', timestamp: counter++ });
    },
    async loadSession() {
      log.push({ event: 'loadSession', timestamp: counter++ });
      // Regardless of the reason, the port returns null for all these scenarios
      return null;
    },
    async clearSession() {
      log.push({ event: 'clearSession', timestamp: counter++ });
    },
  };

  const tokenValidator: TokenValidator = {
    isExpired(_accessToken: string) {
      log.push({ event: 'isExpired_check', timestamp: counter++ });
      return false;
    },
  };

  const sessionRefresher: SessionRefresher = {
    async refresh(_refreshToken: string) {
      log.push({ event: 'refresh_start', timestamp: counter++ });
      return { session: null, error: new Error('Should not be called') };
    },
  };

  return { supabaseAuth, storage, tokenValidator, sessionRefresher, log };
}

// --- Property Tests ---

describe('Property 26: Absent or unparseable stored session always clears storage and routes to Auth_Screen', () => {
  it(
    'always navigates to auth when loadSession returns null',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbNullSessionReason, async (reason) => {
          const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
            createInstrumentedMocks(reason);

          const authManager = new AuthManager(
            supabaseAuth,
            storage,
            tokenValidator,
            sessionRefresher
          );
          const result: RestoreSessionResult = await authManager.restoreSession();

          // Must ALWAYS navigate to auth
          expect(result.navigateTo).toBe('auth');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'clearSession is ALWAYS called to clean up any corrupted data',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbNullSessionReason, async (reason) => {
          const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
            createInstrumentedMocks(reason);

          const authManager = new AuthManager(
            supabaseAuth,
            storage,
            tokenValidator,
            sessionRefresher
          );
          await authManager.restoreSession();

          // clearSession must ALWAYS be called
          const clearSessionEntry = log.find((e) => e.event === 'clearSession');
          expect(clearSessionEntry).toBeDefined();
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'no refresh is attempted when session is absent/unparseable',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbNullSessionReason, async (reason) => {
          const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
            createInstrumentedMocks(reason);

          const authManager = new AuthManager(
            supabaseAuth,
            storage,
            tokenValidator,
            sessionRefresher
          );
          await authManager.restoreSession();

          // Refresh must NEVER be triggered
          const refreshStart = log.find((e) => e.event === 'refresh_start');
          expect(refreshStart).toBeUndefined();

          // Token expiration check must NEVER be triggered (no token to check)
          const isExpiredEntry = log.find((e) => e.event === 'isExpired_check');
          expect(isExpiredEntry).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'ordering is: loadSession → clearSession → navigate to auth (no other operations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbNullSessionReason, async (reason) => {
          const { supabaseAuth, storage, tokenValidator, sessionRefresher, log } =
            createInstrumentedMocks(reason);

          const authManager = new AuthManager(
            supabaseAuth,
            storage,
            tokenValidator,
            sessionRefresher
          );
          const result = await authManager.restoreSession();

          // Exactly two events: loadSession → clearSession
          expect(log).toHaveLength(2);
          expect(log[0].event).toBe('loadSession');
          expect(log[1].event).toBe('clearSession');

          // loadSession happens before clearSession
          expect(log[0].timestamp).toBeLessThan(log[1].timestamp);

          // Navigation result is always auth
          expect(result.navigateTo).toBe('auth');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
