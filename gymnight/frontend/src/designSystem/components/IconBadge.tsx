/**
 * IconBadge — quadrado neutro com um ícone, à esquerda de linhas de lista.
 * Decorativo: o significado vem sempre do texto ao lado.
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

export function IconBadge({ icon, glyph = '◈', size = 36, testID }: IconBadgeProps) {
  return (
    <View
      style={[styles.badge, { width: size, height: size }]}
      testID={testID}
      accessibilityRole="none"
    >
      {icon ? (
        <FontAwesome5 name={icon} size={size * 0.4} color={colors.secondaryText} solid />
      ) : (
        <Text style={[styles.glyph, { fontSize: size * 0.4 }]}>{glyph}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: colors.secondaryText,
  },
});
