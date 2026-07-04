import fc from 'fast-check';
import { submitAuthForm } from '../submitAuthForm';
import { AuthManager, SupabaseAuthClient, SecureStoragePort } from '../../../auth/AuthManager';

/**
 * Feature: frontend-mobile-implementation
 * Property 36: Offline submission never invokes the network call regardless of field validity
 *
 * **Validates: Requirements 16.3**
 *
 * For any arbitrary email and password (valid or invalid), when the device is OFFLINE:
 * 1. No network call (signIn) is ever invoked
 * 2. This holds even if the fields are completely valid
 * 3. The submission is blocked at the connectivity check level, before reaching the auth layer
 * 4. No side effects occur (no Supabase call, no storage write)
 */

/**
 * Creates a spy AuthManager that tracks all calls to its dependencies.
 * Any invocation of signInWithPassword or saveSession constitutes a violation
 * of the offline guard property.
 */
function createSpyAuthManager() {
  let signInCalled = false;
  let saveSessionCalled = false;

  const supabaseAuth: SupabaseAuthClient = {
    signInWithPassword: jest.fn(async () => {
      signInCalled = true;
      return {
        data: { session: null },
        error: { message: 'Should never be called offline' },
      };
    }),
  };

  const storage: SecureStoragePort = {
    saveSession: jest.fn(async () => {
      saveSessionCalled = true;
    }),
    loadSession: jest.fn(async () => null),
    clearSession: jest.fn(async () => {}),
  };

  const authManager = new AuthManager(supabaseAuth, storage);

  return {
    authManager,
    supabaseAuth,
    storage,
    wasSignInCalled: () => signInCalled,
    wasSaveSessionCalled: () => saveSessionCalled,
  };
}

describe('Property 36: Offline submission never invokes the network call regardless of field validity', () => {
  test(
    'no network call is ever made when device is offline, for any email and password',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (email, password) => {
          const spy = createSpyAuthManager();

          const result = await submitAuthForm(email, password, false, spy.authManager);

          // Must return offline result
          expect(result).toEqual({ type: 'offline' });

          // No Supabase signIn call
          expect(spy.wasSignInCalled()).toBe(false);
          expect(spy.supabaseAuth.signInWithPassword).not.toHaveBeenCalled();

          // No storage write
          expect(spy.wasSaveSessionCalled()).toBe(false);
          expect(spy.storage.saveSession).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    },
  );

  test(
    'offline guard holds even when fields are completely valid (non-empty email with "@" and non-empty password)',
    async () => {
      // Generate emails that would pass the isSubmitEnabled validation
      const validEmailArb = fc.tuple(
        fc.string({ minLength: 1 }).filter((s) => !s.includes('@')),
        fc.string({ minLength: 1 }).filter((s) => !s.includes('@')),
      ).map(([local, domain]) => `${local}@${domain}`);

      const validPasswordArb = fc.string({ minLength: 1 });

      await fc.assert(
        fc.asyncProperty(validEmailArb, validPasswordArb, async (email, password) => {
          const spy = createSpyAuthManager();

          const result = await submitAuthForm(email, password, false, spy.authManager);

          // Must still return offline, not attempt auth
          expect(result).toEqual({ type: 'offline' });
          expect(spy.supabaseAuth.signInWithPassword).not.toHaveBeenCalled();
          expect(spy.storage.saveSession).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    },
  );

  test(
    'submission is blocked at the connectivity check level before reaching the auth layer (no side effects)',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (email, password) => {
          const spy = createSpyAuthManager();

          await submitAuthForm(email, password, false, spy.authManager);

          // Verify zero interactions with auth dependencies
          expect(spy.supabaseAuth.signInWithPassword).toHaveBeenCalledTimes(0);
          expect(spy.storage.saveSession).toHaveBeenCalledTimes(0);
          expect(spy.storage.loadSession).toHaveBeenCalledTimes(0);
          expect(spy.storage.clearSession).toHaveBeenCalledTimes(0);
        }),
        { numRuns: 100 },
      );
    },
  );
});
