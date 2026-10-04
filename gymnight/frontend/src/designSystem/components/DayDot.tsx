/**
 * DayDot — um dia da semana na faixa de atividade.
 *
 *   rótulo do dia (como recebido, ex.: "Seg") acima
 *   ativo:   círculo lima com raio escuro
 *   inativo: círculo cardAlt vazio
 *   hoje:    anel fino ao redor + rótulo em destaque
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../tokens';

const DOT_SIZE = 36;

export interface DayDotProps {
  /** Nome curto do dia — ex.: 'Seg'. Renderizado como recebido. */
  day: string;
  active: boolean;
  isToday?: boolean;
  testID?: string;
}

export function DayDot({ day, active, isToday = false, testID }: DayDotProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.label, isToday && styles.labelToday]}>{day}</Text>
      <View
        style={[styles.dot, active ? styles.active : styles.inactive, isToday && styles.today]}
        accessibilityLabel={`${day}: ${active ? 'treinou' : 'sem treino'}`}
      >
        {active ? <FontAwesome5 name="bolt" size={14} color={colors.onPrimary} solid /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.primary,
  },
  inactive: {
    backgroundColor: colors.cardAlt,
  },
  today: {
    borderWidth: 1.5,
    borderColor: colors.secondaryText,
  },
  label: {
    ...typography.caption,
    color: colors.tertiaryText,
  },
  labelToday: {
    color: colors.primaryText,
  },
});
