/**
 * StatCard — cartão de métrica do Dashboard. Porta o _StatCard do desktop
 * (dashboard.py:68-118):
 *
 *   ┌─────────────────────────┐  card #1a1a1a com borda e glow verde suave
 *   │ 🏋 Treinos esta semana   │  ícone verde 16px + título 13/500 #6b7280
 *   │                         │
 *   │ 4 dias                  │  valor 36/800 #fff + unidade 25/500 #9ca3af
 *   └─────────────────────────┘
 *
 * O adjust_font_size() do desktop é lógica de janela redimensionável e não
 * tem equivalente em celular — deliberadamente não portado.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, typography, spacing } from '../tokens';

export interface StatCardProps {
  /** Nome do ícone FontAwesome5 (estilo solid). */
  icon: string;
  title: string;
  value: string;
  unit?: string;
  testID?: string;
}

export function StatCard({ icon, title, value, unit, testID }: StatCardProps) {
  return (
    <Card glow style={styles.card} testID={testID}>
      <View style={styles.header}>
        <FontAwesome5 name={icon} size={16} color={colors.primary} solid />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.sub,
    color: colors.secondaryText,
    flexShrink: 1,
  },
  // `alignItems: 'baseline'` é o que faz a unidade assentar na linha de base
  // do número, como no desktop.
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  value: {
    ...typography.stat,
    color: colors.primaryText,
  },
  unit: {
    ...typography.statUnit,
    color: colors.tertiaryText,
  },
});
