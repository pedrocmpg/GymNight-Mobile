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
 */
export function StartupErrorScreen({ offending }: StartupErrorScreenProps) {
  return (
    <View style={styles.container} testID="startup-error-screen">
      <Text style={styles.title}>Configuração inválida</Text>
      <Text style={styles.subtitle}>As seguintes variáveis de ambiente estão ausentes ou inválidas:</Text>
      {offending.map((name) => (
        <Text key={name} style={styles.item} testID={`offending-${name}`}>
          {name}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
  },
  title: {
    color: colors.error,
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.secondaryText,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  item: {
    color: colors.primaryText,
    ...typography.body,
    fontWeight: '700',
  },
});
