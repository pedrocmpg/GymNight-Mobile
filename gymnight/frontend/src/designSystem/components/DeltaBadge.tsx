/**
 * DeltaBadge — variação contra o período anterior: seta + valor absoluto,
 * tint verde quando ≥ 0 e vermelho quando < 0.
 *
 *   format="percent"  → "20%"   (StatCard)
 *   format="kg"       → "2.5 kg" (1RM na Progress)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../tokens';

export interface DeltaBadgeProps {
  value: number;
  format?: 'percent' | 'kg';
  testID?: string;
}

function formatDelta(value: number, format: 'percent' | 'kg'): string {
  const abs = Math.abs(value);
  return format === 'percent' ? `${abs.toFixed(0)}%` : `${abs.toFixed(1)} kg`;
}

export function DeltaBadge({ value, format = 'percent', testID }: DeltaBadgeProps) {
  const isPositive = value >= 0;
  const color = isPositive ? colors.success : colors.error;

  return (
    <View
      style={[styles.badge, isPositive ? styles.positive : styles.negative]}
      testID={testID}
      accessibilityLabel={`${isPositive ? 'Alta' : 'Queda'} de ${formatDelta(value, format)}`}
    >
      <FontAwesome5 name={isPositive ? 'arrow-up' : 'arrow-down'} size={9} color={color} solid />
      <Text style={[styles.text, { color }]}>{formatDelta(value, format)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    borderRadius: radii.pill,
    paddingVertical: spacing.xxs / 2,
    paddingHorizontal: spacing.xs,
  },
  positive: {
    backgroundColor: colors.successTint,
  },
  negative: {
    backgroundColor: colors.errorTint,
  },
  text: {
    ...typography.captionStrong,
  },
});
