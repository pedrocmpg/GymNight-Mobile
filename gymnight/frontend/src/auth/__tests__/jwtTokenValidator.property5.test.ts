/**
 * Feature: frontend-backend-integration, Property 5: Token expiration matches the exp-claim comparison, and undecodable tokens are always expired
 * **Validates: Requirements 4.1, 4.2**
 */
import * as fc from 'fast-check';
import { jwtTokenValidator } from '../jwtTokenValidator';

function base64UrlEncode(json: string): string {
  const base64 = Buffer.from(json, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

describe('Property 5: JWT expiration matches exp-claim comparison', () => {
  it('well-formed token with exp: expired iff now >= exp', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4102444800 }), (exp) => {
        const token = makeToken({ exp, sub: 'user-1' });
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expected = nowSeconds >= exp;
        expect(jwtTokenValidator.isExpired(token)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('token with no exp claim is always expired', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.string()), (payload) => {
        const sanitized = { ...payload };
        delete (sanitized as any).exp;
        const token = makeToken(sanitized);
        expect(jwtTokenValidator.isExpired(token)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('token with non-numeric exp claim is always expired', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.boolean(), fc.constant(null)), (expValue) => {
        const token = makeToken({ exp: expValue });
        expect(jwtTokenValidator.isExpired(token)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('syntactically malformed tokens are always expired', () => {
    fc.assert(
      fc.property(fc.string(), (garbage) => {
        // Ensure it doesn't accidentally look like a 3-part JWT with valid base64/JSON
        const malformed = garbage.includes('.') ? garbage : `${garbage}.notbase64json`;
        expect(jwtTokenValidator.isExpired(malformed)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
