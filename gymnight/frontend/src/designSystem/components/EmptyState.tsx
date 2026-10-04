/**
 * EmptyState — estado vazio: ícone discreto, título opcional, mensagem e um
 * CTA primário opcional.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, typography, spacing } from '../tokens';

export interface EmptyStateProps {
  message: string;
  /** Ícone FontAwesome5 acima do texto. */
  icon?: string;
  title?: string;
  /** Quando presente junto de `onAction`, renderiza um botão primary abaixo. */
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  /** testID da mensagem, para quem precisa ler o texto exibido. */
  messageTestID?: string;
}

export function EmptyState({
  message,
  icon,
  title,
  actionLabel,
  onAction,
  testID,
  messageTestID,
}: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      {icon ? <FontAwesome5 name={icon} size={28} color={colors.tertiaryText} solid /> : null}
      <View style={styles.text}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.message} testID={messageTestID}>
          {message}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          testID={testID ? `${testID}-action` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  text: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.h3,
    color: colors.primaryText,
    textAlign: 'center',
  },
  message: {
    ...typography.footnote,
    color: colors.secondaryText,
    textAlign: 'center',
  },
});
