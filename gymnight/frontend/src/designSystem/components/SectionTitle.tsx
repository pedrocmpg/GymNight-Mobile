/**
 * SectionTitle — título de seção em CAIXA ALTA, com slot opcional à direita.
 * Porta o QLabel#h3 e os títulos "ATIVIDADE SEMANAL" / "TREINOS RECENTES"
 * (dashboard.py:329,351).
 *
 * O .toUpperCase() é feito aqui dentro, para que nenhum call site precise
 * lembrar disso.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../tokens';

export interface SectionTitleProps {
  children: string;
  /** Ação alinhada à direita do título (ex.: botão "+ Novo"). */
  right?: React.ReactNode;
  testID?: string;
}

export function SectionTitle({ children, right, testID }: SectionTitleProps) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.title}>{children.toUpperCase()}</Text>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.primaryText,
    flexShrink: 1,
  },
});
