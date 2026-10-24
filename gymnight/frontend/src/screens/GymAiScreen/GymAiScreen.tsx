/**
 * GymAiScreen — chat com o GymAI. Apresentacional: o histórico e o envio ficam
 * no container (histórico só em memória; some ao fechar o app).
 */

import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, layout, radii, spacing, typography } from '../../designSystem/tokens';
import { Banner } from '../../designSystem/components/Banner';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { IconButton } from '../../designSystem/components/IconButton';
import { Screen } from '../../designSystem/components/Screen';
import { Input } from '../../designSystem/components/Input';
import type { GymAiFailure, GymAiMessage } from '../../gymai/GymAiClient';

export const GYMAI_FAILURE_MESSAGES: Record<GymAiFailure, string> = {
  offline: 'Sem conexão. Verifique a internet e tente de novo.',
  rate_limited: 'Muitas perguntas em pouco tempo. Aguarde um instante e tente de novo.',
  unauthorized: 'Sua sessão expirou. Entre novamente para falar com o GymAI.',
  unavailable: 'O GymAI está indisponível agora. Tente novamente em instantes.',
};

export interface GymAiScreenProps {
  messages: GymAiMessage[];
  isLoading: boolean;
  failure: GymAiFailure | null;
  onSend: (text: string) => void;
}

export function GymAiScreen({ messages, isLoading, failure, onSend }: GymAiScreenProps) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !isLoading;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        edges={['top']}
        testID="gymai-screen"
        scrollTestID="gymai-messages"
        title="GymAI"
        subtitle="Tire dúvidas sobre treino e evolução"
        footer={
          <View style={styles.composer}>
            <View style={styles.flex}>
              <Input
                testID="gymai-input"
                value={draft}
                onChangeText={setDraft}
                placeholder="Pergunte ao GymAI"
                returnKeyType="send"
                onSubmitEditing={submit}
                editable={!isLoading}
              />
            </View>
            <IconButton
              icon="paper-plane"
              variant="filled"
              accessibilityLabel="Enviar"
              onPress={submit}
              disabled={!canSend}
              testID="gymai-send"
            />
          </View>
        }
      >
        {messages.length === 0 && !isLoading ? (
          <EmptyState
            testID="gymai-empty"
            icon="comment-dots"
            title="Converse com o GymAI"
            message="Pergunte sobre exercícios, divisão de treino ou progressão de carga."
          />
        ) : null}

        {messages.map((m, index) => (
          <View
            key={index}
            style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}
            testID={`gymai-message-${m.role}`}
          >
            <Text style={styles.bubbleText}>{m.content}</Text>
          </View>
        ))}

        {isLoading ? (
          <View style={[styles.bubble, styles.assistantBubble, styles.typing]} testID="gymai-loading">
            <FontAwesome5 name="ellipsis-h" size={14} color={colors.tertiaryText} solid />
            <Text style={styles.typingText}>GymAI está respondendo…</Text>
          </View>
        ) : null}

        {failure ? (
          <Banner
            testID={`gymai-error-${failure}`}
            variant={failure === 'offline' ? 'info' : 'error'}
            message={GYMAI_FAILURE_MESSAGES[failure]}
          />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: layout.cardPadding,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.cardAlt,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
  },
  bubbleText: {
    ...typography.body,
    color: colors.primaryText,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typingText: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
});
