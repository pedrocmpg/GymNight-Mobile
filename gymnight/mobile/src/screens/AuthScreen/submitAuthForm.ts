import { AuthManager, SignInResult } from '../../auth/AuthManager';

/**
 * Result type for the auth form submission.
 * - 'offline': device is offline, no network call was made
 * - SignInResult: result from AuthManager.signIn (success or error)
 */
export type SubmitAuthFormResult =
  | { type: 'offline' }
  | { type: 'result'; value: SignInResult };

/**
 * Guards the auth form submission behind a connectivity check.
 *
 * Requirement 16.3: IF the device is offline when the user submits the Auth_Screen form,
 * THEN the Auth_Screen SHALL display an `offline` UI_State message indicating that
 * authentication requires a network connection, without attempting the request.
 *
 * When `isOnline` is false, the function returns immediately with { type: 'offline' }
 * without invoking any method on the authManager — no Supabase call, no storage write,
 * no side effects whatsoever.
 */
export async function submitAuthForm(
  email: string,
  password: string,
  isOnline: boolean,
  authManager: AuthManager,
): Promise<SubmitAuthFormResult> {
  if (!isOnline) {
    return { type: 'offline' };
  }

  const result = await authManager.signIn(email, password);
  return { type: 'result', value: result };
}
