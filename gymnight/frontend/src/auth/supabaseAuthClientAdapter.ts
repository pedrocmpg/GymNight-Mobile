import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseAuthClient } from './AuthManager';

/**
 * Implements the existing SupabaseAuthClient interface (AuthManager.ts)
 * without modifying that interface (Requirement 14.3).
 *
 * The single try/catch around the whole method satisfies both the mapping
 * requirements (3.2, 3.3) and the never-throws requirement (3.4).
 */
export function createSupabaseAuthClientAdapter(client: SupabaseClient): SupabaseAuthClient {
  return {
    async signInWithPassword(credentials) {
      try {
        const { data, error } = await client.auth.signInWithPassword(credentials);

        if (error) {
          return { data: { session: null }, error: { message: error.message } };
        }

        if (!data.session) {
          return { data: { session: null }, error: null };
        }

        return {
          data: {
            session: {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              user_id: data.session.user.id,
            },
          },
          error: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { data: { session: null }, error: { message } };
      }
    },
  };
}
