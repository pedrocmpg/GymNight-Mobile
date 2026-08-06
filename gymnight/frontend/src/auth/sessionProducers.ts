import type { AuthManager, SignInResult, RestoreSessionResult } from './AuthManager';
import type { SessionRefresher } from './AuthManager';
import type { SessionStore } from './sessionStore';
import { loadSession } from './SecureStorage';

/**
 * Wraps AuthManager.signIn() to propagate a successful session to the
 * SessionStore, without modifying AuthManager itself (Requirement 14.3).
 */
export async function signInAndPropagate(
  authManager: AuthManager,
  sessionStore: SessionStore,
  email: string,
  password: string
): Promise<SignInResult> {
  const result = await authManager.signIn(email, password);
  if (result.success) {
    const session = await loadSession();
    if (session) sessionStore.set(session);
  }
  return result;
}

/**
 * Wraps AuthManager.restoreSession() to propagate a restored/refreshed
 * session to the SessionStore, without modifying AuthManager itself.
 */
export async function restoreSessionAndPropagate(
  authManager: AuthManager,
  sessionStore: SessionStore
): Promise<RestoreSessionResult> {
  const result = await authManager.restoreSession();
  if (result.navigateTo === 'dashboard') {
    const session = await loadSession();
    if (session) sessionStore.set(session);
  }
  return result;
}

/**
 * Wraps a SessionRefresher so every successful refresh() also propagates
 * the new session to the SessionStore (Requirement 4.7), without modifying
 * the SessionRefresher interface or its concrete implementations.
 */
export function withSessionPropagation(
  refresher: SessionRefresher,
  sessionStore: SessionStore
): SessionRefresher {
  return {
    async refresh(refreshToken: string) {
      const result = await refresher.refresh(refreshToken);
      if (result.session) {
        sessionStore.set(result.session);
      }
      return result;
    },
  };
}
