import React from 'react';
import { GymAiScreen } from '../../screens/GymAiScreen/GymAiScreen';
import type { GymAiClient, GymAiFailure, GymAiMessage } from '../../gymai/GymAiClient';

export interface GymAiScreenContainerProps {
  client: GymAiClient;
}

/**
 * Mantém o histórico da conversa em memória e envia cada pergunta ao cliente
 * injetado. Falhas não entram no histórico — a pergunta fica nele, então um
 * novo envio repete o contexto.
 */
export function GymAiScreenContainer({ client }: GymAiScreenContainerProps) {
  const [messages, setMessages] = React.useState<GymAiMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [failure, setFailure] = React.useState<GymAiFailure | null>(null);
  const inFlight = React.useRef(false);

  const handleSend = React.useCallback(
    async (text: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const history: GymAiMessage[] = [...messages, { role: 'user', content: text }];
      setMessages(history);
      setFailure(null);
      setIsLoading(true);
      try {
        const result = await client.sendMessage(history);
        if (result.success) {
          setMessages([...history, { role: 'assistant', content: result.reply }]);
        } else {
          setFailure(result.reason);
        }
      } catch {
        setFailure('unavailable');
      } finally {
        inFlight.current = false;
        setIsLoading(false);
      }
    },
    [client, messages],
  );

  return (
    <GymAiScreen
      messages={messages}
      isLoading={isLoading}
      failure={failure}
      onSend={(text) => void handleSend(text)}
    />
  );
}
