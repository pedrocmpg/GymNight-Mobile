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
import { colors, typography, spacing, radii } from '../tokens';

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

/** Seta + percentual, verde quando ≥0 e vermelho quando <0 — mesmo par de
 * cores/tint do badge de delta do 1RM na Progress_Screen. */
function DeltaBadge({ deltaPct, testID }: { deltaPct: number; testID?: string }) {
  const isPositive = deltaPct >= 0;
  return (
    <View
      style={[styles.deltaBadge, isPositive ? styles.deltaPositive : styles.deltaNegative]}
      testID={testID}
    >
      <FontAwesome5
        name={isPositive ? 'arrow-up' : 'arrow-down'}
        size={10}
        color={isPositive ? colors.success : colors.error}
        solid
      />
      <Text style={[styles.deltaText, { color: isPositive ? colors.success : colors.error }]}>
        {Math.abs(deltaPct).toFixed(0)}%
      </Text>
    </View>
  );
}

export function StatCard({ icon, title, value, unit, deltaPct, testID }: StatCardProps) {
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
      {deltaPct !== undefined && (
        <DeltaBadge deltaPct={deltaPct} testID={testID ? `${testID}-delta` : undefined} />
      )}
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
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    borderRadius: radii.lg,
    paddingVertical: spacing.xxs / 2,
    paddingHorizontal: spacing.xs,
  },
  deltaPositive: {
    backgroundColor: colors.successTint,
  },
  deltaNegative: {
    backgroundColor: colors.errorTint,
  },
  deltaText: {
    ...typography.captionBold,
  },
});
