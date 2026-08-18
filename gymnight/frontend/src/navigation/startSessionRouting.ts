export type StartSessionPersistResult =
  | { success: true; sessionId: string }
  | { success: false; error: Error };

export type StartSessionRoutingResult =
  | { navigateToActiveSession: true; sessionId: string; errorMessage: null }
  | { navigateToActiveSession: false; sessionId: null; errorMessage: string };

/**
 * Pure decision function: maps startSessionWithPersistence's outcome to
 * whether the navigator should move to Active_Session_Screen, or stay on
 * Dashboard_Screen with an error message.
 */
export function resolveStartSessionOutcome(
  result: StartSessionPersistResult,
): StartSessionRoutingResult {
  if (result.success) {
    return { navigateToActiveSession: true, sessionId: result.sessionId, errorMessage: null };
  }
  return {
    navigateToActiveSession: false,
    sessionId: null,
    errorMessage: 'Falha ao iniciar a sessão. Tente novamente.',
  };
}
