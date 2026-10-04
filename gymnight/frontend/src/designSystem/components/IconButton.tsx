/**
 * IconButton — ação só com ícone (editar, remover, fechar), com alvo de toque
 * de 44×44 mesmo quando o ícone é pequeno.
 */

import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, layout, radii } from '../tokens';
import type { HapticKind } from '../haptics';
import { Touchable } from './Touchable';

export interface IconButtonProps {
  /** Nome do ícone FontAwesome5 (estilo solid). */
  icon: string;
  onPress: () => void;
  /** Obrigatório: sem texto visível, é a única descrição para leitores de tela. */
  accessibilityLabel: string;
  tone?: 'default' | 'danger';
  /** `filled` desenha a superfície cardAlt atrás do ícone. */
  variant?: 'plain' | 'filled';
  size?: number;
  disabled?: boolean;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'default',
  variant = 'plain',
  size = 16,
  disabled = false,
  haptic,
  style,
  testID,
}: IconButtonProps) {
  let color: string = tone === 'danger' ? colors.error : colors.secondaryText;
  if (disabled) color = colors.mutedText;

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, variant === 'filled' && styles.filled, style]}
    >
      <FontAwesome5 name={icon} size={size} color={color} solid />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.hitTarget,
    height: layout.hitTarget,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    backgroundColor: colors.cardAlt,
  },
});
