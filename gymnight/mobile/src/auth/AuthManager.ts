import { saveSession, loadSession, clearSession, Session } from './SecureStorage';

export type SignInResult =
  | { success: true; navigateTo: 'dashboard' }
  | { success: false; error: Error };

export type RestoreSessionResult =
  | { navigateTo: 'dashboard' }
  | { navigateTo: 'auth' };

/**
 * Dependency injection interfaces for testability.
 */
export interface SupabaseAuthClient {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { session: Session | null }; error: { message: string } | null }>;
}

export interface SecureStoragePort {
  saveSession(session: Session): Promise<void>;
  loadSession(): Promise<Session | null>;
  clearSession(): Promise<void>;
}

/**
 * Validates whether an access_token is expired.
 * Injected for testability — allows tests to control expiration logic.
 */
export interface TokenValidator {
  isExpired(accessToken: string): boolean;
}

/**
 * Handles the refresh flow for an expired access_token.
 * Injected for testability — allows tests to control refresh outcomes.
 */
export interface SessionRefresher {
  refresh(refreshToken: string): Promise<{ session: Session | null; error: Error | null }>;
}

/**
 * AuthManager encapsulates the sign-in flow and session restoration.
 * Key invariant: session MUST be persisted to SecureStorage BEFORE
 * the function returns success (which triggers navigation).
 */
export class AuthManager {
  private supabaseAuth: SupabaseAuthClient;
  private storage: SecureStoragePort;
  private tokenValidator: TokenValidator;
  private sessionRefresher: SessionRefresher;

  constructor(
    supabaseAuth: SupabaseAuthClient,
    storage?: SecureStoragePort,
    tokenValidator?: TokenValidator,
    sessionRefresher?: SessionRefresher
  ) {
    this.supabaseAuth = supabaseAuth;
    this.storage = storage ?? { saveSession, loadSession, clearSession };
    this.tokenValidator = tokenValidator ?? { isExpired: () => false };
    this.sessionRefresher = sessionRefresher ?? {
      async refresh() {
        return { session: null, error: new Error('No refresher configured') };
      },
    };
  }

  /**
   * Signs in the user via Supabase, persists the session, then returns the
   * navigation signal. The ordering guarantee is:
   *   1. Supabase call completes
   *   2. saveSession completes (session persisted)
   *   3. Return { success: true, navigateTo: 'dashboard' }
   *
   * If saveSession fails, no navigation signal is returned.
   */
  async signIn(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await this.supabaseAuth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

    if (!data.session) {
      return { success: false, error: new Error('No session returned from Supabase') };
    }

    // Persist session BEFORE returning success (navigation trigger).
    // If persistence fails, we must NOT return a navigation signal.
    try {
      await this.storage.saveSession(data.session);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error('Failed to persist session'),
      };
    }

    return { success: true, navigateTo: 'dashboard' };
  }

  /**
   * Restores the session at app launch time. The ordering guarantee is:
   *   1. Load session from SecureStorage
   *   2. If no session → navigate to auth
   *   3. If session present, access_token NOT expired → navigate to dashboard
   *   4. If session present, access_token IS expired, refresh_token present →
   *      trigger refresh flow BEFORE deciding navigation:
   *        a. Refresh succeeds → save new session, navigate to dashboard
   *        b. Refresh fails → clear storage, navigate to auth
   *   5. If session present, access_token IS expired, NO refresh_token →
   *      clear storage, navigate to auth
   */
  async restoreSession(): Promise<RestoreSessionResult> {
    const session = await this.storage.loadSession();

    // No session stored → go to auth
    if (!session) {
      await this.storage.clearSession();
      return { navigateTo: 'auth' };
    }

    // Access token is still valid → go to dashboard
    if (!this.tokenValidator.isExpired(session.access_token)) {
      return { navigateTo: 'dashboard' };
    }

    // Access token expired — check for refresh token
    if (!session.refresh_token) {
      await this.storage.clearSession();
      return { navigateTo: 'auth' };
    }

    // Access token expired, refresh token present → MUST refresh BEFORE navigation decision
    const { session: newSession, error } = await this.sessionRefresher.refresh(
      session.refresh_token
    );

    if (error || !newSession) {
      // Refresh failed → clear storage, navigate to auth
      await this.storage.clearSession();
      return { navigateTo: 'auth' };
    }

    // Refresh succeeded → persist new session, navigate to dashboard
    await this.storage.saveSession(newSession);
    return { navigateTo: 'dashboard' };
  }
}
