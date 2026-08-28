/**
 * ProgressBar — trilho de 4px com preenchimento verde proporcional.
 * Porta o _prog_bar / _prog_fill do treino ativo (active_workout.py:121-128).
 *
 * No desktop a largura é pixel calculado porque o Qt não tem percentual;
 * aqui o percentual já resolve e é responsivo de graça.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../tokens';

export interface ProgressBarProps {
  /** Progresso de 0 a 1. Valores fora do intervalo são clampados. */
  value: number;
  testID?: string;
}

export function ProgressBar({ value, testID }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = `${clamped * 100}%` as const;

  return (
    <View
      style={styles.track}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[styles.fill, { width: percent }]}
        testID={testID ? `${testID}-fill` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
});
