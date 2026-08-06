import type { AuthManager, RestoreSessionResult, SignInResult } from '../auth/AuthManager';
import type { SessionStore } from '../auth/sessionStore';
import { restoreSessionAndPropagate } from '../auth/sessionProducers';

export type BootstrapPhase = 'auth' | 'authenticated';

/**
 * Pure decision function: maps restoreSession's settled outcome to a phase.
 * Property 9: renders Dashboard iff the outcome is exactly { navigateTo: 'dashboard' };
 * every other outcome (auth, reject, throw, unexpected value) resolves to 'auth'.
 */
export function resolvePhaseFromRestoreOutcome(
  outcome: RestoreSessionResult | { __rejected: true }
): BootstrapPhase {
  if ('navigateTo' in outcome && outcome.navigateTo === 'dashboard') {
    return 'authenticated';
  }
  return 'auth';
}

/** Runs restoreSession (with session propagation) and resolves to a BootstrapPhase, never throwing. */
export async function runBootstrapRouting(
  authManager: AuthManager,
  sessionStore: SessionStore
): Promise<BootstrapPhase> {
  try {
    const result = await restoreSessionAndPropagate(authManager, sessionStore);
    return resolvePhaseFromRestoreOutcome(result);
  } catch {
    return resolvePhaseFromRestoreOutcome({ __rejected: true });
  }
}

/**
 * Pure decision function for Property 10: maps signIn's settled outcome to
 * whether the navigator should move to Dashboard, staying on Auth otherwise
 * with a non-empty error message.
 */
export function resolveSignInOutcome(
  outcome: SignInResult | { __rejected: true }
): { navigateToDashboard: boolean; errorMessage: string | null } {
  if ('success' in outcome && outcome.success) {
    return { navigateToDashboard: true, errorMessage: null };
  }
  if ('success' in outcome && !outcome.success) {
    return { navigateToDashboard: false, errorMessage: outcome.error.message || 'Falha ao entrar.' };
  }
  return { navigateToDashboard: false, errorMessage: 'Falha ao entrar. Tente novamente.' };
}
