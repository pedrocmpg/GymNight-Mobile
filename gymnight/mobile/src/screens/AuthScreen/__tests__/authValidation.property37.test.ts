import fc from 'fast-check';
import { handleAuthError, AuthError } from '../handleAuthError';

/**
 * Feature: frontend-mobile-implementation
 * Property 37: Supabase auth error retains the entered email and clears the password
 *
 * **Validates: Requirements 16.4**
 *
 * For any arbitrary email/password and any auth error:
 * 1. After an auth error, the email field retains its value (user doesn't have to retype it)
 * 2. After an auth error, the password field is ALWAYS cleared (empty string)
 * 3. This holds for any error type (credential rejection, network error, any Supabase error)
 * 4. The email/password state update is deterministic based on error occurrence
 */

// Arbitrary for auth errors with realistic Supabase-like messages
const authErrorArb: fc.Arbitrary<AuthError> = fc.oneof(
  fc.constant({ message: 'Invalid login credentials' }),
  fc.constant({ message: 'Email not confirmed' }),
  fc.constant({ message: 'User not found' }),
  fc.constant({ message: 'Network request failed' }),
  fc.constant({ message: 'Request timeout' }),
  fc.constant({ message: 'Too many requests' }),
  fc.record({
    message: fc.string({ minLength: 1 }),
    code: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  }),
);

describe('Property 37: Supabase auth error retains the entered email and clears the password', () => {
  test('email field retains its value after any auth error, for any email/password', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), authErrorArb, (email, password, error) => {
        const result = handleAuthError(email, password, error);
        expect(result.email).toBe(email);
      }),
      { numRuns: 100 },
    );
  });

  test('password field is ALWAYS cleared (empty string) after any auth error', () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), authErrorArb, (email, password, error) => {
        const result = handleAuthError(email, password, error);
        expect(result.password).toBe('');
      }),
      { numRuns: 100 },
    );
  });

  test('this holds for any error type (credential rejection, network error, any Supabase error)', () => {
    // Test specifically with different error categories
    const errorCategories: AuthError[] = [
      { message: 'Invalid login credentials', code: 'invalid_credentials' },
      { message: 'Network request failed', code: 'network_error' },
      { message: 'User not found', code: 'user_not_found' },
      { message: 'Email rate limit exceeded', code: 'rate_limit' },
      { message: 'Server error', code: '500' },
      { message: 'Connection refused' },
    ];

    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.constantFrom(...errorCategories),
        (email, password, error) => {
          const result = handleAuthError(email, password, error);
          expect(result.email).toBe(email);
          expect(result.password).toBe('');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('the email/password state update is deterministic based on error occurrence', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), authErrorArb, (email, password, error) => {
        const first = handleAuthError(email, password, error);
        const second = handleAuthError(email, password, error);
        expect(first).toEqual(second);
      }),
      { numRuns: 100 },
    );
  });
});
