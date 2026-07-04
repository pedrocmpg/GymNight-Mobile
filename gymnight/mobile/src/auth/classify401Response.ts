import { Session } from './SecureStorage';

/**
 * Possible actions after classifying a 401 response.
 */
export type Classify401Action =
  | { action: 'refresh'; refreshToken: string }
  | { action: 'invalidate_session' };

/**
 * Session state as seen by the classifier — only the refresh_token matters.
 */
export interface SessionState {
  refresh_token: string | null | undefined;
}

/**
 * Known 401 response messages from the backend (Sync_Router).
 */
const TOKEN_EXPIRED_MESSAGE = 'Token expirado';
const TOKEN_INVALID_MESSAGE = 'Token inválido';
const TOKEN_NOT_PROVIDED_MESSAGE = 'Token não fornecido';

/**
 * Classifies a 401 HTTP response and determines the correct action:
 *
 * - "Token expirado" + refresh_token present → attempt refresh
 * - "Token expirado" + no refresh_token → invalidate session
 * - "Token inválido" → invalidate session (always)
 * - "Token não fornecido" → invalidate session (always)
 * - Any other 401 message → invalidate session (conservative fallback)
 *
 * **Validates: Requirements 10.1, 10.2, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.4, 11.5**
 *
 * This function is pure and deterministic: same inputs always produce the same output.
 * Every possible combination of message + session state is handled — no unclassified state exists.
 */
export function classify401Response(
  message: string,
  sessionState: SessionState
): Classify401Action {
  if (message === TOKEN_EXPIRED_MESSAGE) {
    // Only attempt refresh if a refresh_token is present (non-null, non-undefined, non-empty)
    if (
      sessionState.refresh_token !== null &&
      sessionState.refresh_token !== undefined &&
      sessionState.refresh_token.length > 0
    ) {
      return { action: 'refresh', refreshToken: sessionState.refresh_token };
    }
    // Token expired but no refresh_token → invalidate
    return { action: 'invalidate_session' };
  }

  // Token inválido or Token não fornecido → always invalidate regardless of session state
  if (message === TOKEN_INVALID_MESSAGE || message === TOKEN_NOT_PROVIDED_MESSAGE) {
    return { action: 'invalidate_session' };
  }

  // Any other 401 message → conservative fallback: invalidate session
  return { action: 'invalidate_session' };
}
