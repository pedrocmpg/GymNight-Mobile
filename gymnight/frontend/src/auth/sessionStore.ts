import type { Session } from './SecureStorage';

/**
 * AuthInterceptor requires a SessionProvider (getCurrentSession(): Session | null)
 * that always reflects the latest sign-in/restore/refresh, or null after logout
 * (Requirement 10.2). A small in-memory store is the single source of truth,
 * updated by every producer at the Bootstrap_Sequence wiring points.
 */
export interface SessionStore {
  set(session: Session): void;
  clear(): void;
  getCurrentSession(): Session | null;
}

export function createSessionStore(): SessionStore {
  let current: Session | null = null;
  return {
    set(session) {
      current = session;
    },
    clear() {
      current = null;
    },
    getCurrentSession() {
      return current;
    },
  };
}
