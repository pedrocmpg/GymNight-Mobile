/**
 * SectionTitle — título de seção em sentence case, com metadado opcional
 * ("3 de 7 dias") e uma ação à direita.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../tokens';

export interface SectionTitleProps {
  children: string;
  /** Texto auxiliar discreto logo após o título. */
  meta?: string;
  /** Ação alinhada à direita do título (ex.: botão "Novo"). */
  right?: React.ReactNode;
  testID?: string;
}

export function SectionTitle({ children, meta, right, testID }: SectionTitleProps) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.text}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {children}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
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
  text: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.primaryText,
    flexShrink: 1,
  },
  meta: {
    ...typography.footnote,
    color: colors.tertiaryText,
  },
});
