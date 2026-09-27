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

/**
 * Auth_Screen sign-up validation predicate.
 *
 * Controls whether the "Cadastrar" button is enabled.
 * Rule: same email check as sign-in, plus password with at least 8 chars
 * and matching confirmation.
 *
 * This is a pure, deterministic function — same inputs always produce the same output.
 */
export function isSignUpSubmitEnabled(
  email: string,
  password: string,
  confirmPassword: string
): boolean {
  return (
    email.length > 0 &&
    email.includes('@') &&
    password.length >= 8 &&
    password === confirmPassword
  );
}
