/**
 * Property 22: Session persistence completes before navigation away from Auth_Screen
 * **Validates: Requirements 7.3**
 *
 * WHEN a sign-in call to Supabase succeeds AND returns a Session,
 * the Auth_Manager SHALL persist the resulting Session to Secure_Storage
 * before navigating away from the Auth_Screen.
 *
 * We verify:
 * 1. For any arbitrary valid session data, when signIn succeeds, saveSession
 *    is ALWAYS called and completes BEFORE the navigation signal is returned.
 * 2. The ordering is: Supabase call → saveSession completes → return success.
 * 3. Navigation never happens without prior persistence.
 * 4. If saveSession fails (throws), no navigation signal is returned.
 */
import * as fc from 'fast-check';
import { AuthManager, SupabaseAuthClient, SecureStoragePort } from '../AuthManager';
import { Session } from '../SecureStorage';

// --- Arbitraries ---

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: arbNonEmptyString,
  refresh_token: arbNonEmptyString,
  user_id: arbNonEmptyString,
});

const arbEmail = fc.emailAddress();
const arbPassword = arbNonEmptyString;

// --- Helpers to build instrumented mocks ---

type EventLog = Array<{ event: string; timestamp: number }>;

function createInstrumentedMocks(
  session: Session,
  options: { saveSessionShouldFail?: boolean } = {}
) {
  const log: EventLog = [];
  let counter = 0;

  const supabaseAuth: SupabaseAuthClient = {
    async signInWithPassword(_credentials) {
      log.push({ event: 'supabase_signIn_start', timestamp: counter++ });
      // Simulate async work
      await Promise.resolve();
      log.push({ event: 'supabase_signIn_end', timestamp: counter++ });
      return { data: { session }, error: null };
    },
  };

  const storage: SecureStoragePort = {
    async saveSession(_session) {
      log.push({ event: 'saveSession_start', timestamp: counter++ });
      // Simulate async persistence
      await Promise.resolve();
      if (options.saveSessionShouldFail) {
        log.push({ event: 'saveSession_failed', timestamp: counter++ });
        throw new Error('SecureStore write failed');
      }
      log.push({ event: 'saveSession_end', timestamp: counter++ });
    },
  };

  return { supabaseAuth, storage, log };
}

// --- Property Tests ---

describe('Property 22: Session persistence completes before navigation', () => {
  it(
    'signIn success always persists session BEFORE returning navigation signal',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbEmail, arbPassword, async (session, email, password) => {
          const { supabaseAuth, storage, log } = createInstrumentedMocks(session);
          const authManager = new AuthManager(supabaseAuth, storage);

          const result = await authManager.signIn(email, password);

          // Result must be success with navigation signal
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.navigateTo).toBe('dashboard');
          }

          // Verify ordering: saveSession_end must occur BEFORE the function returned
          // (since we are past the await, the log reflects all operations that occurred
          //  before the promise resolved)
          const saveSessionEndEntry = log.find((e) => e.event === 'saveSession_end');
          const supabaseEndEntry = log.find((e) => e.event === 'supabase_signIn_end');
          const saveSessionStartEntry = log.find((e) => e.event === 'saveSession_start');

          // saveSession must have been called
          expect(saveSessionStartEntry).toBeDefined();
          expect(saveSessionEndEntry).toBeDefined();

          // Ordering: supabase completes → saveSession starts → saveSession ends
          expect(supabaseEndEntry!.timestamp).toBeLessThan(saveSessionStartEntry!.timestamp);
          expect(saveSessionStartEntry!.timestamp).toBeLessThan(saveSessionEndEntry!.timestamp);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'navigation never happens without prior persistence (saveSession failure → no navigation)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbEmail, arbPassword, async (session, email, password) => {
          const { supabaseAuth, storage, log } = createInstrumentedMocks(session, {
            saveSessionShouldFail: true,
          });
          const authManager = new AuthManager(supabaseAuth, storage);

          const result = await authManager.signIn(email, password);

          // Must NOT return navigation signal
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBeInstanceOf(Error);
          }

          // saveSession was attempted but failed
          const saveSessionFailedEntry = log.find((e) => e.event === 'saveSession_failed');
          expect(saveSessionFailedEntry).toBeDefined();

          // No saveSession_end event (it threw before completing)
          const saveSessionEndEntry = log.find((e) => e.event === 'saveSession_end');
          expect(saveSessionEndEntry).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'the persisted session always matches the session returned by Supabase',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbEmail, arbPassword, async (session, email, password) => {
          let persistedSession: Session | null = null;

          const supabaseAuth: SupabaseAuthClient = {
            async signInWithPassword(_credentials) {
              return { data: { session }, error: null };
            },
          };

          const storage: SecureStoragePort = {
            async saveSession(s) {
              persistedSession = s;
            },
          };

          const authManager = new AuthManager(supabaseAuth, storage);
          const result = await authManager.signIn(email, password);

          expect(result.success).toBe(true);
          // The exact session object from Supabase was persisted
          expect(persistedSession).toEqual(session);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
