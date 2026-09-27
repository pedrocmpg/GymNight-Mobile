import fc from 'fast-check';
import { isSignUpSubmitEnabled } from '../authValidation';

/**
 * Property 38: Auth_Screen sign-up submit is enabled exactly when the
 * sign-up validation predicate holds.
 *
 * For any arbitrary email, password and confirmPassword strings:
 * 1. Sign-up is enabled IFF (email non-empty AND contains '@' AND password
 *    length >= 8 AND password === confirmPassword)
 * 2. Disabled for empty/invalid email regardless of password
 * 3. Disabled for password shorter than 8 chars regardless of email/match
 * 4. Disabled when password !== confirmPassword, even if both are valid on their own
 * 5. The predicate is pure and deterministic
 */

const validEmailArb = fc
  .tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }))
  .map(([local, domain]) => `${local}@${domain}`);

const emailWithoutAtArb = fc.string({ minLength: 1 }).filter((s) => !s.includes('@'));

const validPasswordArb = fc.string({ minLength: 8, maxLength: 40 });
const shortPasswordArb = fc.string({ minLength: 0, maxLength: 7 });

describe('Property 38: Auth_Screen sign-up submit is enabled exactly when the sign-up validation predicate holds', () => {
  test('sign-up is enabled IFF email valid, password >= 8 chars, and confirmation matches', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (email, password, confirmPassword) => {
        const result = isSignUpSubmitEnabled(email, password, confirmPassword);
        const expected =
          email.length > 0 &&
          email.includes('@') &&
          password.length >= 8 &&
          password === confirmPassword;
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  test('disabled for empty/invalid email regardless of password', () => {
    fc.assert(
      fc.property(emailWithoutAtArb, validPasswordArb, (email, password) => {
        expect(isSignUpSubmitEnabled(email, password, password)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('disabled for password shorter than 8 chars, even with matching confirmation', () => {
    fc.assert(
      fc.property(validEmailArb, shortPasswordArb, (email, password) => {
        expect(isSignUpSubmitEnabled(email, password, password)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('disabled when password and confirmPassword differ, even if both individually valid', () => {
    fc.assert(
      fc.property(
        validEmailArb,
        validPasswordArb,
        validPasswordArb,
        (email, password, confirmPassword) => {
          fc.pre(password !== confirmPassword);
          expect(isSignUpSubmitEnabled(email, password, confirmPassword)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('the predicate is pure and deterministic', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (email, password, confirmPassword) => {
          const first = isSignUpSubmitEnabled(email, password, confirmPassword);
          const second = isSignUpSubmitEnabled(email, password, confirmPassword);
          expect(first).toBe(second);
        },
      ),
      { numRuns: 100 },
    );
  });
});
