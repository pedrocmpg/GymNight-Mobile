import type { AuthInterceptor } from '../auth/AuthInterceptor';
import type { SyncHttpClient } from '../sync/syncCycleRunner';
import type { GymAiClient, GymAiMessage, GymAiResult } from './GymAiClient';

export interface BackendGymAiClientDeps {
  backendBaseUrl: string;
  http: Pick<SyncHttpClient, 'post'>;
  authInterceptor: AuthInterceptor;
}

export function createBackendGymAiClient(deps: BackendGymAiClientDeps): GymAiClient {
  return {
    async sendMessage(history: GymAiMessage[]): Promise<GymAiResult> {
      let request;
      try {
        request = deps.authInterceptor.attachAuthHeader({
          url: `${deps.backendBaseUrl}/api/v1/chat`,
          method: 'POST',
          headers: {},
          body: { messages: history },
        });
      } catch {
        return { success: false, reason: 'unauthorized' };
      }

      const result = await deps.http.post(request.url, request.body, request.headers);
      if (result.kind === 'network_error') return { success: false, reason: 'offline' };

      if (result.status === 200) {
        const reply = (result.body as { reply?: unknown } | undefined)?.reply;
        return typeof reply === 'string' && reply.length > 0
          ? { success: true, reply }
          : { success: false, reason: 'unavailable' };
      }
      if (result.status === 401 || result.status === 403) return { success: false, reason: 'unauthorized' };
      if (result.status === 429) return { success: false, reason: 'rate_limited' };
      return { success: false, reason: 'unavailable' };
    },
  };
}
