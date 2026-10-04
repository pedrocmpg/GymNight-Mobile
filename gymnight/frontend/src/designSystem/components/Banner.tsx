/**
 * Banner — aviso em linha: superfície tingida + ícone + mensagem.
 *
 *   info     neutro (offline, "verifique seu email")
 *   error    vermelho
 *   success  lima (recorde pessoal)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../tokens';

export type BannerVariant = 'info' | 'error' | 'success';

export interface BannerProps {
  message: string;
  variant?: BannerVariant;
  testID?: string;
}

const VARIANT: Record<BannerVariant, { icon: string; color: string; background: string }> = {
  info: { icon: 'info-circle', color: colors.secondaryText, background: colors.cardAlt },
  error: { icon: 'exclamation-circle', color: colors.error, background: colors.errorTint },
  success: { icon: 'trophy', color: colors.primary, background: colors.primaryTint },
};

export function Banner({ message, variant = 'info', testID }: BannerProps) {
  const config = VARIANT[variant];
  return (
    <View
      style={[styles.banner, { backgroundColor: config.background }]}
      testID={testID}
      accessibilityRole="alert"
    >
      <FontAwesome5 name={config.icon} size={14} color={config.color} solid />
      <Text style={[styles.message, variant !== 'info' && { color: config.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  message: {
    ...typography.footnote,
    color: colors.primaryText,
    flex: 1,
  },
});
