/**
 * Handles the auth form field state after a Supabase authentication error.
 *
 * Requirement 16.4: After an auth error, the email field retains its value
 * (user doesn't have to retype it) and the password field is ALWAYS cleared.
 *
 * This is a pure, deterministic function — same inputs always produce the same output.
 * The error type/message is irrelevant: any error causes the same field behavior.
 */

export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthFieldState {
  email: string;
  password: string;
}

/**
 * Given the current email, current password, and any auth error,
 * returns the new field state: email is retained, password is cleared.
 *
 * This holds for any error type (credential rejection, network error,
 * any Supabase error).
 */
export function handleAuthError(
  currentEmail: string,
  _currentPassword: string,
  _error: AuthError,
): AuthFieldState {
  return {
    email: currentEmail,
    password: '',
  };
}
