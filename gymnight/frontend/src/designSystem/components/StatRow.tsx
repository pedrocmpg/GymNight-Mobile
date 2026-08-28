/**
 * StatRow — par label/valor com tipografia caption/metric, usado nos cards ricos
 * do Dashboard (nº de exercícios, duração média, última vez treinado) e nos
 * resumos de sessão da ProgressScreen (volume, duração).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../tokens';

export interface StatRowProps {
  label: string;
  value: string;
  /** Alinhamento do bloco label+valor dentro do espaço disponível. */
  align?: 'flex-start' | 'center' | 'flex-end';
  testID?: string;
}

export function StatRow({ label, value, align = 'flex-start', testID }: StatRowProps) {
  return (
    <View style={[styles.container, { alignItems: align }]} testID={testID}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: spacing.xxs / 2,
  },
  value: {
    color: colors.primaryText,
    ...typography.bodyBold,
  },
  label: {
    color: colors.secondaryText,
    ...typography.caption,
  },
});
