import type { GymAiClient, GymAiMessage, GymAiResult } from './GymAiClient';

/** Cliente determinístico para testes e desenvolvimento sem backend. */
export function createMockGymAiClient(result?: GymAiResult): GymAiClient {
  return {
    async sendMessage(history: GymAiMessage[]): Promise<GymAiResult> {
      if (result) return result;
      const last = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
      return { success: true, reply: `[mock] Recebi: ${last}` };
    },
  };
}
