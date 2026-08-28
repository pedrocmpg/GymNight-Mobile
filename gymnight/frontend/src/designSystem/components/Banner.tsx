/**
 * Banner — faixa de aviso com borda esquerda colorida de 4px. Unifica o
 * padrão de banner offline/erro que hoje está copiado em AuthScreen e
 * DashboardScreen.
 *
 * Resolve um bug real: os banners de erro dos containers (por exemplo o
 * testID `logout-error-banner` do DashboardScreenContainer) renderizam
 * <View><Text>{...}</Text></View> sem estilo nenhum — ou seja, texto preto
 * padrão sobre fundo preto, invisível.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../tokens';

export type BannerVariant = 'info' | 'error';

export interface BannerProps {
  message: string;
  variant?: BannerVariant;
  testID?: string;
}

export function Banner({ message, variant = 'info', testID }: BannerProps) {
  return (
    <View
      style={[styles.banner, variant === 'error' ? styles.error : styles.info]}
      testID={testID}
      accessibilityRole="alert"
    >
      <Text style={[styles.message, variant === 'error' && styles.errorMessage]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderLeftWidth: 4,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  info: {
    backgroundColor: colors.primaryTint,
    borderLeftColor: colors.primary,
  },
  error: {
    backgroundColor: colors.errorBg,
    borderLeftColor: colors.error,
  },
  message: {
    ...typography.sub,
    color: colors.primaryText,
  },
  errorMessage: {
    color: colors.error,
  },
});
