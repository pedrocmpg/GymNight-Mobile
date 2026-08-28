/**
 * IconBadge — quadrado verde-escuro com um ícone ou glifo centralizado.
 * Porta o `ex_icon` do card de exercício (active_workout.py:555-558):
 * 44×44, background #1a2e0a, border-radius 10px, glifo ◈ em 20px.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, radii } from '../tokens';

export interface IconBadgeProps {
  /** Nome do ícone FontAwesome5 (estilo solid). Tem precedência sobre `glyph`. */
  icon?: string;
  /** Fallback textual quando não há ícone — ex.: '◈'. */
  glyph?: string;
  size?: number;
  testID?: string;
}

export function IconBadge({ icon, glyph = '◈', size = 44, testID }: IconBadgeProps) {
  return (
    <View
      style={[styles.badge, { width: size, height: size }]}
      testID={testID}
      // Decorativo: o significado vem sempre do texto ao lado do badge.
      accessibilityRole="none"
    >
      {icon ? (
        <FontAwesome5 name={icon} size={size * 0.45} color={colors.primary} solid />
      ) : (
        <Text style={[styles.glyph, { fontSize: size * 0.45 }]}>{glyph}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primaryBg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: colors.primary,
  },
});
