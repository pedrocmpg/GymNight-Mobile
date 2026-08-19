/**
 * Card — container reutilizável com fundo surface, cantos arredondados e padding
 * padrão, com borda sutil opcional. Base visual compartilhada entre DashboardScreen
 * (cards de treino) e ProgressScreen (card do gráfico, resumos de sessão).
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { colors, radii, spacing } from '../tokens';

export interface CardProps {
  children: React.ReactNode;
  /** Exibe uma borda sutil ao redor do card (default: false). */
  bordered?: boolean;
  /** Torna o card pressionável; quando ausente, o card é um container estático. */
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Card({ children, bordered = false, onPress, style, testID, accessibilityLabel }: CardProps) {
  const content = (
    <View style={[styles.card, bordered && styles.bordered, style]} testID={testID}>
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  bordered: {
    borderWidth: 1,
    borderColor: 'rgba(154, 165, 177, 0.2)',
  },
});
