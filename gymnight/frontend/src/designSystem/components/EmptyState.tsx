/**
 * EmptyState — mensagem centralizada com ação opcional. Unifica o padrão
 * repetido em 4 telas: "Nenhum treino encontrado.", "Catálogo de exercícios
 * vazio...", "Nenhum treino registrado ainda.", "Sessão não encontrada.".
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { colors, typography, spacing } from '../tokens';

export interface EmptyStateProps {
  message: string;
  /** Quando presente junto de `onAction`, renderiza um botão primary abaixo. */
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({ message, actionLabel, onAction, testID }: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.message}>{message}</Text>
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
  message: {
    ...typography.sub,
    color: colors.secondaryText,
    textAlign: 'center',
  },
});
