/**
 * Property 30: 401 responses and refresh outcomes are classified and handled consistently across all cases
 *
 * **Validates: Requirements 10.1, 10.2, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.4, 11.5**
 *
 * For any arbitrary 401 response message and session state, the classify401Response function:
 * 1. "Token expirado" with refresh_token present ALWAYS triggers refresh (never invalidate)
 * 2. "Token expirado" without refresh_token ALWAYS triggers invalidate (never refresh)
 * 3. "Token inválido" ALWAYS triggers invalidate regardless of refresh_token presence
 * 4. "Token não fornecido" ALWAYS triggers invalidate regardless of refresh_token presence
 * 5. Any unmapped 401 message ALWAYS triggers invalidate (conservative fallback)
 * 6. The classification is deterministic: same inputs always produce same output
 * 7. Every possible input is handled — no unclassified state exists
 */
import * as fc from 'fast-check';
import { classify401Response, Classify401Action, SessionState } from '../classify401Response';

// --- Arbitraries ---

/**
 * Generates a non-empty refresh token string (present in storage).
 */
const arbRefreshToken = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.length > 0);

/**
 * Generates a session state with a valid refresh_token present.
 */
const arbSessionWithRefreshToken: fc.Arbitrary<SessionState> = arbRefreshToken.map(
  (token) => ({ refresh_token: token })
);

/**
 * Generates a session state WITHOUT a valid refresh_token (null, undefined, or empty string).
 */
const arbSessionWithoutRefreshToken: fc.Arbitrary<SessionState> = fc.oneof(
  fc.constant({ refresh_token: null } as SessionState),
  fc.constant({ refresh_token: undefined } as SessionState),
  fc.constant({ refresh_token: '' } as SessionState)
);

/**
 * Any session state (with or without refresh_token).
 */
const arbAnySessionState: fc.Arbitrary<SessionState> = fc.oneof(
  arbSessionWithRefreshToken,
  arbSessionWithoutRefreshToken
);

/**
 * Known 401 messages from the backend.
 */
const KNOWN_MESSAGES = ['Token expirado', 'Token inválido', 'Token não fornecido'];

/**
 * Generates an arbitrary 401 message that is NOT one of the known messages.
 * This exercises the conservative fallback path.
 */
const arbUnmappedMessage: fc.Arbitrary<string> = fc
  .string({ minLength: 0, maxLength: 128 })
  .filter((s) => !KNOWN_MESSAGES.includes(s));

/**
 * Any arbitrary string (represents any possible 401 message).
 */
const arbAnyMessage: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 128 });

// --- Property Tests ---

describe('Property 30: 401 responses and refresh outcomes are classified and handled consistently across all cases', () => {
  it(
    '"Token expirado" with refresh_token present ALWAYS triggers refresh (never invalidate)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSessionWithRefreshToken, async (sessionState) => {
          const result = classify401Response('Token expirado', sessionState);

          // Must always be refresh action
          expect(result.action).toBe('refresh');
          // Must include the refresh token from session
          expect(result).toHaveProperty('refreshToken');
          expect((result as { action: 'refresh'; refreshToken: string }).refreshToken).toBe(
            sessionState.refresh_token
          );
          // Must NEVER be invalidate
          expect(result.action).not.toBe('invalidate_session');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    '"Token expirado" without refresh_token ALWAYS triggers invalidate (never refresh)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSessionWithoutRefreshToken, async (sessionState) => {
          const result = classify401Response('Token expirado', sessionState);

          // Must always be invalidate
          expect(result.action).toBe('invalidate_session');
          // Must NEVER be refresh
          expect(result.action).not.toBe('refresh');
          // Must not have a refreshToken property
          expect(result).not.toHaveProperty('refreshToken');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    '"Token inválido" ALWAYS triggers invalidate regardless of refresh_token presence',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbAnySessionState, async (sessionState) => {
          const result = classify401Response('Token inválido', sessionState);

          // Must always be invalidate regardless of session state
          expect(result.action).toBe('invalidate_session');
          expect(result).not.toHaveProperty('refreshToken');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    '"Token não fornecido" ALWAYS triggers invalidate regardless of refresh_token presence',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbAnySessionState, async (sessionState) => {
          const result = classify401Response('Token não fornecido', sessionState);

          // Must always be invalidate regardless of session state
          expect(result.action).toBe('invalidate_session');
          expect(result).not.toHaveProperty('refreshToken');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'any unmapped 401 message ALWAYS triggers invalidate (conservative fallback)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbUnmappedMessage, arbAnySessionState, async (message, sessionState) => {
          const result = classify401Response(message, sessionState);

          // Conservative fallback: always invalidate for unknown messages
          expect(result.action).toBe('invalidate_session');
          expect(result).not.toHaveProperty('refreshToken');
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'classification is deterministic: same inputs always produce same output',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbAnyMessage, arbAnySessionState, async (message, sessionState) => {
          // Call the function multiple times with identical inputs
          const result1 = classify401Response(message, sessionState);
          const result2 = classify401Response(message, sessionState);
          const result3 = classify401Response(message, sessionState);

          // All calls must produce identical output
          expect(result1).toEqual(result2);
          expect(result2).toEqual(result3);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'every possible input is handled — no unclassified state exists (action is always valid)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbAnyMessage, arbAnySessionState, async (message, sessionState) => {
          const result = classify401Response(message, sessionState);

          // Result must always be a valid action (never undefined, null, or unknown)
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
          expect(result.action).toBeDefined();

          // Action must be one of the two valid actions
          expect(['refresh', 'invalidate_session']).toContain(result.action);

          // If action is refresh, refreshToken must be a non-empty string
          if (result.action === 'refresh') {
            const refreshResult = result as { action: 'refresh'; refreshToken: string };
            expect(typeof refreshResult.refreshToken).toBe('string');
            expect(refreshResult.refreshToken.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
