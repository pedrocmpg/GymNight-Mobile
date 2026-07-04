import fc from 'fast-check';
import { isSubmitEnabled } from '../authValidation';

/**
 * Feature: frontend-mobile-implementation
 * Property 35: Auth_Screen submit is enabled exactly when the email/password validation predicate holds
 *
 * **Validates: Requirements 16.2, 16.5**
 *
 * For any arbitrary email and password strings:
 * 1. Submit is enabled IFF (email is non-empty AND email contains '@' AND password is non-empty)
 * 2. Submit is disabled for empty email (regardless of password)
 * 3. Submit is disabled for email without '@' (regardless of password)
 * 4. Submit is disabled for empty password (regardless of email)
 * 5. The predicate is pure and deterministic
 */

// Arbitrary for non-empty strings that contain '@'
const validEmailArb = fc.tuple(
  fc.string({ minLength: 1 }),
  fc.string({ minLength: 1 }),
).map(([local, domain]) => `${local}@${domain}`);

// Arbitrary for non-empty strings that do NOT contain '@'
const emailWithoutAtArb = fc.string({ minLength: 1 }).filter((s) => !s.includes('@'));

// Arbitrary for non-empty passwords
const nonEmptyPasswordArb = fc.string({ minLength: 1 });

describe('Property 35: Auth_Screen submit is enabled exactly when the email/password validation predicate holds', () => {
  test('submit is enabled IFF email is non-empty, contains "@", and password is non-empty', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (email, password) => {
        const result = isSubmitEnabled(email, password);
        const expected = email.length > 0 && email.includes('@') && password.length > 0;
        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test('submit is disabled for empty email regardless of password', () => {
    fc.assert(
      fc.property(fc.string(), (password) => {
        const result = isSubmitEnabled('', password);
        expect(result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('submit is disabled for email without "@" regardless of password', () => {
    fc.assert(
      fc.property(emailWithoutAtArb, fc.string(), (email, password) => {
        const result = isSubmitEnabled(email, password);
        expect(result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('submit is disabled for empty password regardless of valid email', () => {
    fc.assert(
      fc.property(validEmailArb, (email) => {
        const result = isSubmitEnabled(email, '');
        expect(result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('the predicate is pure and deterministic (same inputs always produce same output)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (email, password) => {
        const first = isSubmitEnabled(email, password);
        const second = isSubmitEnabled(email, password);
        expect(first).toBe(second);
      }),
      { numRuns: 100 },
    );
  });
});
