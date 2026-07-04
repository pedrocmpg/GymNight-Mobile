import { Session } from './SecureStorage';

/**
 * Interface representing the provider of the current in-memory session.
 * The Auth_Interceptor reads the session at dispatch time (not captured earlier)
 * to always reflect the latest completed sign-in or token refresh.
 */
export interface SessionProvider {
  getCurrentSession(): Session | null;
}

/**
 * Minimal request shape that the AuthInterceptor can work with.
 */
export interface RequestLike {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * Request with exactly one Authorization header attached.
 */
export interface RequestWithAuth extends RequestLike {
  headers: Record<string, string> & { Authorization: string };
}

/**
 * Auth_Interceptor is responsible for attaching exactly one
 * `Authorization: Bearer <access_token>` header to every HTTP request
 * made by the Sync_Engine to the Sync_Router.
 *
 * Key invariants (Requirements 9.1, 9.2):
 * - Exactly ONE Authorization header per request (never zero, never multiple)
 * - The token is ALWAYS read at dispatch time from the SessionProvider,
 *   reflecting the latest completed sign-in or refresh
 * - The format is always `Bearer <token>`
 */
export class AuthInterceptor {
  private sessionProvider: SessionProvider;

  constructor(sessionProvider: SessionProvider) {
    this.sessionProvider = sessionProvider;
  }

  /**
   * Attaches exactly one Authorization: Bearer <access_token> header
   * to the given request, reading the token from the current session
   * at the moment this method is called (dispatch time).
   *
   * @throws Error if no session is available (caller should handle skip logic)
   */
  attachAuthHeader(request: RequestLike): RequestWithAuth {
    // Read the session at dispatch time — always the latest
    const session = this.sessionProvider.getCurrentSession();

    if (!session) {
      throw new Error('No active session available for auth header injection');
    }

    // Build a new headers object with exactly one Authorization header.
    // We deliberately strip any pre-existing Authorization header to guarantee
    // the "exactly one" invariant.
    const { Authorization: _removed, ...otherHeaders } = request.headers;

    const authHeader = `Bearer ${session.access_token}`;

    return {
      ...request,
      headers: {
        ...otherHeaders,
        Authorization: authHeader,
      },
    };
  }
}
