/**
 * Property 24: Secure_Storage write failure after successful auth discards the in-memory
 * session and blocks navigation
 * **Validates: Requirements 7.6**
 *
 * IF a sign-in or sign-up call to Supabase succeeds and returns a Session, but the
 * subsequent write to Secure_Storage fails, THEN THE Auth_Manager SHALL NOT navigate away
 * from the Auth_Screen, SHALL discard the in-memory Session, and THE Auth_Screen SHALL
 * display an error message indicating that the session could not be saved on the device.
 *
 * We verify for any arbitrary valid Supabase session AND any arbitrary storage failure:
 * 1. Result is ALWAYS `{ success: false, error }` — no navigation signal is returned
 * 2. No `navigateTo` field exists in the result (user stays on Auth_Screen)
 * 3. The in-memory session is NOT retained (AuthManager discards it)
 * 4. The error message indicates the storage/persistence failure
 */
import * as fc from 'fast-check';
import { AuthManager, SupabaseAuthClient, SecureStoragePort, SignInResult } from '../AuthManager';
import { Session } from '../SecureStorage';

// --- Arbitraries ---

const arbEmail = fc.emailAddress();

const arbNonEmptyString = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

const arbPassword = arbNonEmptyString;

/**
 * Arbitrary valid Session — simulates any session that Supabase would return
 * after a successful authentication.
 */
const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: fc.string({ minLength: 10, maxLength: 256 }),
  refresh_token: fc.string({ minLength: 10, maxLength: 256 }),
  user_id: fc.uuid(),
});

/**
 * Arbitrary storage failure — simulates any kind of error that SecureStorage
 * could throw (disk full, encryption failure, permission denied, etc.)
 */
const arbStorageError = fc.oneof(
  fc.constant(new Error('Disk full')),
  fc.constant(new Error('Encryption key unavailable')),
  fc.constant(new Error('Permission denied')),
  fc.constant(new Error('SecureStore write failed')),
  fc.constant(new Error('Device storage quota exceeded')),
  fc.constant(new Error('Keychain access denied')),
  arbNonEmptyString.map((msg) => new Error(msg))
);

// --- Property Tests ---

describe('Property 24: Secure_Storage write failure after successful auth discards session and blocks navigation', () => {
  it(
    'When Supabase returns a valid session but saveSession throws, result is always failure with no navigation',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbEmail,
          arbPassword,
          arbSession,
          arbStorageError,
          async (email, password, session, storageError) => {
            // Mock: Supabase succeeds — returns a valid session
            const supabaseAuth: SupabaseAuthClient = {
              async signInWithPassword(_credentials) {
                return { data: { session }, error: null };
              },
            };

            // Mock: SecureStorage fails with the arbitrary error
            const storage: SecureStoragePort = {
              async saveSession(_session) {
                throw storageError;
              },
            };

            const authManager = new AuthManager(supabaseAuth, storage);
            const result: SignInResult = await authManager.signIn(email, password);

            // 1. Result MUST be failure — never a success/navigation signal
            expect(result.success).toBe(false);

            // 2. No navigateTo field present (user stays on Auth_Screen)
            expect('navigateTo' in result).toBe(false);

            // 3. Error is an Error instance with a non-empty message
            if (!result.success) {
              expect(result.error).toBeInstanceOf(Error);
              expect(result.error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'The in-memory session is NOT retained after storage failure (AuthManager discards it)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbEmail,
          arbPassword,
          arbSession,
          arbStorageError,
          async (email, password, session, storageError) => {
            let sessionPassedToStorage: Session | null = null;

            // Mock: Supabase succeeds
            const supabaseAuth: SupabaseAuthClient = {
              async signInWithPassword(_credentials) {
                return { data: { session }, error: null };
              },
            };

            // Mock: SecureStorage captures what was passed then fails
            const storage: SecureStoragePort = {
              async saveSession(s) {
                sessionPassedToStorage = s;
                throw storageError;
              },
            };

            const authManager = new AuthManager(supabaseAuth, storage);
            const result: SignInResult = await authManager.signIn(email, password);

            // The session was attempted to be saved (proves auth succeeded)
            expect(sessionPassedToStorage).toEqual(session);

            // But the result discards it — returns failure, no session exposed
            expect(result.success).toBe(false);
            if (!result.success) {
              // The result only exposes error, not the session data
              expect((result as any).session).toBeUndefined();
              expect((result as any).data).toBeUndefined();
              expect((result as any).access_token).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'The error message indicates the storage/persistence failure',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbEmail,
          arbPassword,
          arbSession,
          arbStorageError,
          async (email, password, session, storageError) => {
            // Mock: Supabase succeeds
            const supabaseAuth: SupabaseAuthClient = {
              async signInWithPassword(_credentials) {
                return { data: { session }, error: null };
              },
            };

            // Mock: SecureStorage fails
            const storage: SecureStoragePort = {
              async saveSession(_session) {
                throw storageError;
              },
            };

            const authManager = new AuthManager(supabaseAuth, storage);
            const result: SignInResult = await authManager.signIn(email, password);

            expect(result.success).toBe(false);
            if (!result.success) {
              // The error should carry the storage error message
              // (AuthManager preserves the Error instance from storage)
              expect(result.error.message).toBe(storageError.message);
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );
});
