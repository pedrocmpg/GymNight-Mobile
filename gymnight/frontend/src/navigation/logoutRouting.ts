import type { LogoutManager, LogoutResult, LocalState } from '../auth/LogoutManager';

export type LogoutRoutingResult =
  | { navigateToAuth: true; errorMessage: null }
  | { navigateToAuth: false; errorMessage: string | null };

/**
 * Pure decision function for Property 14: maps requestLogout's settled
 * outcome to whether the navigator should move to Auth_Screen, and whether
 * an error indication should be surfaced.
 */
export function resolveLogoutOutcome(outcome: LogoutResult | { __rejected: true }): LogoutRoutingResult {
  if ('outcome' in outcome && outcome.outcome === 'completed') {
    return { navigateToAuth: true, errorMessage: null };
  }
  if ('outcome' in outcome && outcome.outcome === 'aborted') {
    return { navigateToAuth: false, errorMessage: null };
  }
  if ('outcome' in outcome && outcome.outcome === 'wipe_failed') {
    return { navigateToAuth: false, errorMessage: outcome.error.message || 'Falha ao encerrar sessão.' };
  }
  return { navigateToAuth: false, errorMessage: 'Falha ao encerrar sessão. Tente novamente.' };
}

/**
 * Coordinates a single in-flight requestLogout() call (Property 15):
 * concurrent triggers while a call is pending collapse to that one call.
 */
export function createLogoutCoordinator(logoutManager: LogoutManager) {
  let pending: Promise<LogoutResult> | null = null;

  return {
    async requestLogout(state: LocalState): Promise<LogoutRoutingResult> {
      if (pending) {
        // Ignore this trigger; caller should not await a second call.
        return { navigateToAuth: false, errorMessage: null };
      }
      pending = logoutManager.requestLogout(state);
      try {
        const result = await pending;
        return resolveLogoutOutcome(result);
      } catch {
        return resolveLogoutOutcome({ __rejected: true });
      } finally {
        pending = null;
      }
    },
    isPending(): boolean {
      return pending !== null;
    },
  };
}
