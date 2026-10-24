/**
 * Interface do GymAI no app. A implementação real fala com o proxy do backend
 * (`POST /api/v1/chat`) — a chave do provedor de IA nunca vai no app. Qual
 * provedor responde (mock, Gemini...) é decisão do backend (`GYMAI_PROVIDER`).
 */
export interface GymAiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type GymAiFailure = 'offline' | 'unauthorized' | 'rate_limited' | 'unavailable';

export type GymAiResult =
  | { success: true; reply: string }
  | { success: false; reason: GymAiFailure };

export interface GymAiClient {
  /** `history` termina na mensagem do usuário a ser respondida. */
  sendMessage(history: GymAiMessage[]): Promise<GymAiResult>;
}
