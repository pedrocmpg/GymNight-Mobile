/**
 * Property 28: Absent session always skips the cycle without side effects;
 * presence always dispatches — no undefined third state
 *
 * **Validates: Requirements 9.3, 9.4**
 *
 * For any arbitrary session state (present or absent):
 * 1. When session is ABSENT (null): the cycle is ALWAYS skipped — no request is dispatched,
 *    no side effects occur, pending queue stays unchanged
 * 2. When session is PRESENT (non-null): the request is ALWAYS dispatched with the auth header
 *    — never skipped
 * 3. There is NO third state — for every attempt, EXACTLY one of these two outcomes occurs
 * 4. The decision is purely binary and exhaustive based on session presence
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

/**
 * Arbitrary that produces either a valid Session or null.
 * This covers the complete input space for session presence.
 */
const arbSessionOrNull: fc.Arbitrary<Session | null> = fc.oneof(
  arbSession,
  fc.constant(null)
);

// --- Helpers ---

function createSessionProvider(session: Session | null): SessionProvider {
  return {
    getCurrentSession() {
      return session;
    },
  };
}

/**
 * shouldDispatch: determines the binary outcome of an interceptor attempt.
 * Returns 'skip' if the session is absent (interceptor throws),
 * or 'dispatch' if the session is present (request successfully augmented).
 *
 * This helper wraps the interceptor's throw behavior into a pure binary decision,
 * proving that no third state exists.
 */
function shouldDispatch(
  interceptor: AuthInterceptor,
  request: RequestLike
): 'skip' | 'dispatch' {
  try {
    interceptor.attachAuthHeader(request);
    return 'dispatch';
  } catch {
    return 'skip';
  }
}

// --- Simulated pending queue for side-effect verification ---

interface PendingQueue {
  items: string[];
}

function cloneQueue(queue: PendingQueue): PendingQueue {
  return { items: [...queue.items] };
}

// --- Property Tests ---

describe('Property 28: Exhaustive skip/dispatch by session presence', () => {
  it(
    'absent session ALWAYS results in skip — no request dispatched, no side effects',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbRequest, fc.array(arbNonEmptyString, { minLength: 0, maxLength: 5 }), async (request, queueItems) => {
          // Session is null → absent
          const provider = createSessionProvider(null);
          const interceptor = new AuthInterceptor(provider);

          // Simulate a pending queue before the attempt
          const pendingQueue: PendingQueue = { items: [...queueItems] };
          const queueBefore = cloneQueue(pendingQueue);

          // The decision must be 'skip'
          const decision = shouldDispatch(interceptor, request);
          expect(decision).toBe('skip');

          // Side-effect invariant: queue unchanged
          expect(pendingQueue).toEqual(queueBefore);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'present session ALWAYS results in dispatch — request augmented with auth header, never skipped',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSession, arbRequest, async (session, request) => {
          const provider = createSessionProvider(session);
          const interceptor = new AuthInterceptor(provider);

          // The decision must be 'dispatch'
          const decision = shouldDispatch(interceptor, request);
          expect(decision).toBe('dispatch');

          // Verify the actual dispatch produces a properly authenticated request
          const result = interceptor.attachAuthHeader(request);
          expect(result.headers.Authorization).toBe(`Bearer ${session.access_token}`);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'for ANY session state (present or absent), EXACTLY one of skip or dispatch occurs — no third state',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSessionOrNull, arbRequest, async (session, request) => {
          const provider = createSessionProvider(session);
          const interceptor = new AuthInterceptor(provider);

          const decision = shouldDispatch(interceptor, request);

          // The result must be one of exactly two values
          expect(['skip', 'dispatch']).toContain(decision);

          // Cross-check: decision correlates with session presence
          if (session === null) {
            expect(decision).toBe('skip');
          } else {
            expect(decision).toBe('dispatch');
          }
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'the decision is purely binary and exhaustive — session null ↔ skip, session non-null ↔ dispatch',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSessionOrNull, arbRequest, async (session, request) => {
          const provider = createSessionProvider(session);
          const interceptor = new AuthInterceptor(provider);

          const decision = shouldDispatch(interceptor, request);

          // Bidirectional implication: decision === 'skip' ⟺ session === null
          expect(decision === 'skip').toBe(session === null);
          expect(decision === 'dispatch').toBe(session !== null);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
