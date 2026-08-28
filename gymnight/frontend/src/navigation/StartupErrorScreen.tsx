import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../designSystem/tokens';

export interface StartupErrorScreenProps {
  offending: string[];
}

/**
 * Trivial presentational component (not one of the four screens governed by
 * Requirement 14) rendered in place of the navigator when env validation
 * fails at Bootstrap_Sequence (Requirement 1.6).
 *
 * Não usa SafeAreaView: renderiza fora do SafeAreaProvider (App.tsx só o
 * monta depois da validação de env passar). O conteúdo é centralizado
 * verticalmente, então não encosta na status bar.
 */
export function StartupErrorScreen({ offending }: StartupErrorScreenProps) {
  return (
    <View style={styles.container} testID="startup-error-screen">
      <Text style={styles.title}>CONFIGURAÇÃO INVÁLIDA</Text>
      <Text style={styles.subtitle}>
        As seguintes variáveis de ambiente estão ausentes ou inválidas:
      </Text>
      <View style={styles.list}>
        {offending.map((name) => (
          <Text key={name} style={styles.item} testID={`offending-${name}`}>
            {name}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.error,
    ...typography.h2,
  },
  subtitle: {
    color: colors.secondaryText,
    ...typography.body,
  },
  list: {
    backgroundColor: colors.card,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    borderRadius: spacing.xxs,
    padding: spacing.md,
    gap: spacing.xs,
  },
  item: {
    color: colors.primaryText,
    ...typography.bodyBold,
  },
});
