/**
 * Button — cobre os quatro estilos de botão do GymNight-Desktop.
 *
 *   primary       QPushButton          (theme.py:91)
 *   ghost         QPushButton#ghost    (theme.py:106)
 *   danger        QPushButton#danger   (theme.py:118)
 *   outlineAccent add_ex_btn           (active_workout.py:103)
 *
 * Substitui os botões copiados e colados nas 5 telas.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../tokens';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outlineAccent';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Nome do ícone FontAwesome5 (estilo solid), renderizado antes do label. */
  icon?: string;
  disabled?: boolean;
  /** Troca o label por um ActivityIndicator e bloqueia o press. */
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/** Cor do texto e do ícone por variante, no estado habilitado. */
const CONTENT_COLOR: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  ghost: colors.secondaryText,
  danger: colors.error,
  outlineAccent: colors.primary,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const inert = disabled || loading;

  // O TouchableOpacity mockado nos testes ignora a prop `disabled`, então o
  // bloqueio precisa ser explícito aqui dentro.
  const handlePress = () => {
    if (inert) return;
    onPress();
  };

  const contentColor = disabled ? colors.secondaryText : CONTENT_COLOR[variant];

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={inert}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert }}
      style={[
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} testID={testID ? `${testID}-loading` : undefined} />
      ) : (
        <View style={styles.content}>
          {icon ? <FontAwesome5 name={icon} size={14} color={contentColor} solid /> : null}
          <Text style={[styles.label, styles[`${variant}Label`], { color: contentColor }]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.bodyBold,
  },

  primary: {
    backgroundColor: colors.primary,
  },
  primaryLabel: {},

  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border,
  },
  ghostLabel: {},

  danger: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.error,
  },
  dangerLabel: {},

  outlineAccent: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineAccentLabel: {
    ...typography.sub,
    fontFamily: typography.bodyBold.fontFamily,
  },

  disabled: {
    backgroundColor: colors.cardAlt,
    borderWidth: 0,
  },
});
