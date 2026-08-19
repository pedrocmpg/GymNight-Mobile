/**
 * Chip — pill selecionável usado no seletor horizontal de exercício da
 * ProgressScreen. Segue o mesmo visual dos chips já existentes em
 * ActiveSessionScreen (não extraído de lá para não expandir o escopo de risco
 * sobre uma tela já em produção — ver plano).
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../tokens';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

export function Chip({ label, selected, onPress, testID }: ChipProps) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityLabel={`Selecionar ${label}`}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.primaryText,
    ...typography.caption,
  },
  chipTextSelected: {
    color: colors.background,
    fontWeight: '700',
  },
});
