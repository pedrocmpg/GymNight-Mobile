/**
 * StatCard — uma métrica: rótulo discreto em cima, número grande tabular,
 * unidade apagada na linha de base e delta opcional.
 *
 *   ┌─────────────────────────┐
 *   │ ◦ Volume total           │  ícone + rótulo em tons neutros
 *   │ 12.400 kg                │  número protagonista
 *   │ ↑ 20%                    │  delta (opcional)
 *   └─────────────────────────┘
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Card } from './Card';
import { DeltaBadge } from './DeltaBadge';
import { colors, typography, spacing } from '../tokens';

export interface StatCardProps {
  /** Nome do ícone FontAwesome5 (estilo solid). */
  icon: string;
  title: string;
  value: string;
  unit?: string;
  /**
   * Variação percentual contra o período anterior (Wave 7 — Estatísticas).
   * Ausente = sem slot de delta (comportamento original, Dashboard). `0` é um
   * delta válido (ex: primeiro período de uso) e ainda mostra o badge.
   */
  deltaPct?: number;
  testID?: string;
}

export function StatCard({ icon, title, value, unit, deltaPct, testID }: StatCardProps) {
  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.header}>
        <FontAwesome5 name={icon} size={12} color={colors.tertiaryText} solid />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {deltaPct !== undefined && (
        <DeltaBadge value={deltaPct} testID={testID ? `${testID}-delta` : undefined} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.caption,
    color: colors.secondaryText,
    flexShrink: 1,
  },
  // `alignItems: 'baseline'` assenta a unidade na linha de base do número.
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  value: {
    ...typography.stat,
    color: colors.primaryText,
    flexShrink: 1,
  },
  unit: {
    ...typography.statUnit,
    color: colors.tertiaryText,
  },
});
