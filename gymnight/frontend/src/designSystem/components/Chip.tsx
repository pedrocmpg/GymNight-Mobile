/**
 * Chip — pill selecionável (seletor de exercício, filtros).
 *
 * Não selecionado: superfície cardAlt, texto secundário, sem borda.
 * Selecionado: lima com texto preto. Toque dá haptic de seleção.
 * Sem margem própria — o container pai define o espaçamento com `gap`.
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, layout } from '../tokens';
import { Touchable } from './Touchable';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

export function Chip({ label, selected, onPress, testID }: ChipProps) {
  return (
    <Touchable
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Selecionar ${label}`}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.controlHeight.sm,
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    color: colors.secondaryText,
  },
  chipTextSelected: {
    ...typography.captionStrong,
    fontSize: typography.label.fontSize,
    color: colors.onPrimary,
  },
});
