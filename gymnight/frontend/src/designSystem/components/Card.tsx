/**
 * Card — container reutilizável com fundo, borda e cantos arredondados.
 *
 * Porta o `QFrame#card` do GymNight-Desktop (theme.py:194):
 *   background: #1a1a1a; border: 2px solid #2a2a2a; border-radius: 16px;
 *
 * No desktop TODO card tem borda, por isso `bordered` tem default `true`.
 * `glow` liga o brilho neon verde, usado em stat cards e cards de exercício.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { colors, radii, spacing, glow as glowStyle } from '../tokens';

export interface CardProps {
  children: React.ReactNode;
  /** Borda de 2px. Default `true` — no desktop todo card tem borda. */
  bordered?: boolean;
  /** Glow neon verde suave. Default `false`. */
  glow?: boolean;
  /** Torna o card pressionável; quando ausente, o card é um container estático. */
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Card({
  children,
  bordered = true,
  glow = false,
  onPress,
  style,
  testID,
  accessibilityLabel,
}: CardProps) {
  const content = (
    <View
      style={[styles.card, bordered && styles.bordered, glow && glowStyle(colors.primary, 16, 0.22), style]}
      testID={testID}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={accessibilityLabel} activeOpacity={0.8}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  bordered: {
    borderWidth: 2,
    borderColor: colors.border,
  },
});
