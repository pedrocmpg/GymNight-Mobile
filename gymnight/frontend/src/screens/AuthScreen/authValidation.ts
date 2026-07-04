/**
 * Auth_Screen validation predicate.
 *
 * Controls whether the submit button is enabled.
 * Rule: email must be non-empty, contain '@', and password must be non-empty.
 *
 * This is a pure, deterministic function — same inputs always produce the same output.
 */
export function isSubmitEnabled(email: string, password: string): boolean {
  return email.length > 0 && email.includes('@') && password.length > 0;
}
