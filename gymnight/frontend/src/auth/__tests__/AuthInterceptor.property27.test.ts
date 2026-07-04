/**
 * Property 27: Exactly one Authorization header is attached per dispatched sync request,
 * always reflecting the latest completed session
 *
 * **Validates: Requirements 9.1, 9.2**
 *
 * For any sync request dispatched while an in-memory Session is present,
 * exactly one `Authorization: Bearer <access_token>` header SHALL be attached,
 * and its value SHALL equal the token from the most recently completed sign-in
 * or refresh, never a value captured before that update.
 *
 * We verify:
 * 1. EXACTLY ONE `Authorization` header is attached (never zero, never multiple)
 * 2. The header value is always `Bearer <access_token>` using the LATEST session's access_token
 * 3. If the session was updated between request creation and dispatch, the LATEST token is used
 * 4. The header format is always `Authorization: Bearer <token>` (never malformed)
 */
import * as fc from 'fast-check';
import { AuthInterceptor, SessionProvider, RequestLike } from '../AuthInterceptor';
import { Session } from '../SecureStorage';

// --- Arbitraries ---

const arbNonEmptyString = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

const arbAccessToken = fc
  .string({ minLength: 1, maxLength: 128 })
  .filter((s) => s.trim().length > 0);

const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: arbAccessToken,
  refresh_token: arbNonEmptyString,
  user_id: arbNonEmptyString,
});

const arbUrl = fc.webUrl();

const arbHttpMethod = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

const arbHeaders: fc.Arbitrary<Record<string, string>> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.toLowerCase() !== 'authorization'),
  arbNonEmptyString,
  { minKeys: 0, maxKeys: 5 }
);

const arbRequest: fc.Arbitrary<RequestLike> = fc.record({
  url: arbUrl,
  method: arbHttpMethod,
  headers: arbHeaders,
});

// --- Helpers ---

function createMutableSessionProvider(initialSession: Session | null): SessionProvider & {
  setSession: (s: Session | null) => void;
} {
  let currentSession = initialSession;
  return {
    getCurrentSession() {
      return currentSession;
    },
    setSession(s: Session | null) {
      currentSession = s;
    },
  };
}

function countAuthorizationHeaders(headers: Record<string, string>): number {
  return Object.keys(headers).filter((k) => k.toLowerCase() === 'authorization').length;
}

// --- Property Tests ---

describe('Property 27: Exactly one Authorization header per dispatched sync request', () => {
  it(
    'exactly one Authorization header is always attached when session is present',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbRequest, async (session, request) => {
          const provider = createMutableSessionProvider(session);
          const interceptor = new AuthInterceptor(provider);

          const result = interceptor.attachAuthHeader(request);

          // Exactly one Authorization header
          const authCount = countAuthorizationHeaders(result.headers);
          expect(authCount).toBe(1);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'the Authorization header value always equals Bearer <latest access_token>',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbRequest, async (session, request) => {
          const provider = createMutableSessionProvider(session);
          const interceptor = new AuthInterceptor(provider);

          const result = interceptor.attachAuthHeader(request);

          // The header value must be exactly `Bearer <access_token>`
          expect(result.headers.Authorization).toBe(`Bearer ${session.access_token}`);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'if session is updated between request creation and dispatch, the LATEST token is used',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSession,
          arbSession,
          arbRequest,
          async (initialSession, updatedSession, request) => {
            const provider = createMutableSessionProvider(initialSession);
            const interceptor = new AuthInterceptor(provider);

            // Simulate session being updated (e.g., by a token refresh) AFTER
            // the request was created but BEFORE dispatch (attachAuthHeader call)
            provider.setSession(updatedSession);

            const result = interceptor.attachAuthHeader(request);

            // Must reflect the LATEST (updated) session, not the initial one
            expect(result.headers.Authorization).toBe(`Bearer ${updatedSession.access_token}`);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'the header format is always "Bearer <token>" (never malformed)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbRequest, async (session, request) => {
          const provider = createMutableSessionProvider(session);
          const interceptor = new AuthInterceptor(provider);

          const result = interceptor.attachAuthHeader(request);

          const authValue = result.headers.Authorization;

          // Must start with "Bearer " followed by the token
          expect(authValue).toMatch(/^Bearer .+$/);
          // Must match exactly `Bearer <access_token>`
          expect(authValue).toBe(`Bearer ${session.access_token}`);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'pre-existing Authorization headers in the request are replaced (guarantees exactly one)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSession,
          arbRequest,
          arbNonEmptyString,
          async (session, request, existingAuthValue) => {
            // Inject a pre-existing Authorization header to ensure it gets replaced
            const requestWithAuth: RequestLike = {
              ...request,
              headers: {
                ...request.headers,
                Authorization: `Bearer ${existingAuthValue}`,
              },
            };

            const provider = createMutableSessionProvider(session);
            const interceptor = new AuthInterceptor(provider);

            const result = interceptor.attachAuthHeader(requestWithAuth);

            // Still exactly one Authorization header
            const authCount = countAuthorizationHeaders(result.headers);
            expect(authCount).toBe(1);

            // And it uses the CURRENT session, not the pre-existing value
            expect(result.headers.Authorization).toBe(`Bearer ${session.access_token}`);
          }
        ),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'throws when session is absent (no Authorization header without a session)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbRequest, async (request) => {
          const provider = createMutableSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          expect(() => interceptor.attachAuthHeader(request)).toThrow();
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
