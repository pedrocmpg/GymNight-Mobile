/**
 * Card — superfície L1 (colors.card) de cantos arredondados.
 *
 * Sem borda nem sombra por padrão: a profundidade vem do degrau de superfície
 * sobre o fundo. `bordered` adiciona a hairline para quando o card fica sobre
 * outra superfície. `padding="none"` é para listas de `ListRow`, que cuidam do
 * próprio respiro.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, layout } from '../tokens';
import { Touchable } from './Touchable';

export type CardPadding = 'none' | 'md' | 'lg';

export interface CardProps {
  children: React.ReactNode;
  /** Hairline de 1px. Default `false`. */
  bordered?: boolean;
  /** Respiro interno. Default `md` (16). */
  padding?: CardPadding;
  /** Torna o card pressionável; quando ausente, o card é um container estático. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function Card({
  children,
  bordered = false,
  padding = 'md',
  onPress,
  style,
  testID,
  accessibilityLabel,
}: CardProps) {
  const content = (
    <View style={[styles.card, styles[padding], bordered && styles.bordered, style]} testID={testID}>
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {content}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  none: {},
  md: {
    padding: layout.cardPadding,
  },
  lg: {
    padding: spacing.lg,
  },
  bordered: {
    borderWidth: layout.hairline,
    borderColor: colors.border,
  },
});
