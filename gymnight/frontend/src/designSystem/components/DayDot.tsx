/**
 * DayDot — quadrado de 48×48 representando um dia da semana, com o label
 * abaixo. Porta o _WeekDayIcon do desktop (dashboard.py:171-199):
 *
 *   ativo:   raio (fa5s.bolt) escuro sobre #a2ff00, com glow FORTE
 *   inativo: "—" sobre #1a1a1a, borda 1px #2a2a2a
 *
 * Substitui a faixa de 7 barrinhas planas de 8px do DashboardScreen atual.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, glow } from '../tokens';

export interface DayDotProps {
  /** Nome curto do dia — ex.: 'Seg'. O componente faz .toUpperCase(). */
  day: string;
  active: boolean;
  testID?: string;
}

export function DayDot({ day, active, testID }: DayDotProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View
        style={[styles.dot, active ? [styles.active, glow(colors.primary, 20, 0.55)] : styles.inactive]}
        accessibilityLabel={`${day}: ${active ? 'treinou' : 'sem treino'}`}
      >
        {active ? (
          <FontAwesome5 name="bolt" size={20} color={colors.card} solid />
        ) : (
          <Text style={styles.dash}>—</Text>
        )}
      </View>
      <Text style={styles.label}>{day.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.primary,
  },
  inactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dash: {
    fontSize: 20,
    color: colors.mutedText,
  },
  label: {
    ...typography.caption,
    color: colors.secondaryText,
  },
});
