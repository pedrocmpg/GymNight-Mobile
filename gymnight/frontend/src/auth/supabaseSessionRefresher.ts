import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionRefresher } from './AuthManager';

export function createSupabaseSessionRefresher(client: SupabaseClient): SessionRefresher {
  return {
    async refresh(refreshToken: string) {
      try {
        const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });

        if (error || !data.session) {
          return {
            session: null,
            error: error ? new Error(error.message) : new Error('No session returned'),
          };
        }

        return {
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user_id: data.session.user.id,
          },
          error: null,
        };
      } catch (err) {
        return { session: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
  };
}
