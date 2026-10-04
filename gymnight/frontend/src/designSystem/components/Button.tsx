/**
 * Button — os quatro papéis de botão do app.
 *
 *   primary    lima sólido — o ÚNICO CTA principal da tela
 *   secondary  superfície cardAlt — ações de apoio ("Novo", "Cardio")
 *   ghost      só texto — cancelar, voltar, links
 *   danger     tint vermelho — ações destrutivas confirmadas
 *
 * Tamanhos: md (52, default) e sm (36). Press com escala sutil; o primary
 * dispara haptic leve por padrão.
 */

import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii, layout } from '../tokens';
import type { HapticKind } from '../haptics';
import { Touchable } from './Touchable';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Nome do ícone FontAwesome5 (estilo solid), renderizado antes do label. */
  icon?: string;
  disabled?: boolean;
  /** Troca o label por um ActivityIndicator e bloqueia o press. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Sobrescreve o haptic padrão (light no primary, nenhum nos demais); `null` desliga. */
  haptic?: HapticKind | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/** Cor do texto e do ícone por variante, no estado habilitado. */
const CONTENT_COLOR: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primaryText,
  ghost: colors.secondaryText,
  danger: colors.error,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  haptic,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const inert = disabled || loading;
  const contentColor = disabled ? colors.tertiaryText : CONTENT_COLOR[variant];
  const defaultHaptic: HapticKind | undefined = variant === 'primary' ? 'light' : undefined;
  const hapticKind = haptic === null ? undefined : (haptic ?? defaultHaptic);

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={inert}
      haptic={hapticKind}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
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
          {icon ? (
            <FontAwesome5 name={icon} size={size === 'sm' ? 12 : 14} color={contentColor} solid />
          ) : null}
          <Text
            style={[size === 'sm' ? styles.labelSm : styles.label, { color: contentColor }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    minHeight: layout.controlHeight.md,
    paddingHorizontal: spacing.lg,
  },
  sm: {
    minHeight: layout.controlHeight.sm,
    paddingHorizontal: spacing.sm,
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
    ...typography.bodyStrong,
  },
  labelSm: {
    ...typography.label,
  },

  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.cardAlt,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.errorTint,
  },

  disabled: {
    backgroundColor: colors.cardAlt,
  },
});
