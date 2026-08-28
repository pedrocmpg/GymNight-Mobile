/**
 * Input — campo de texto com label e estado de erro.
 *
 * Porta o QLineEdit do desktop (theme.py:130-140):
 *   background: #1a1a1a; color: #ffffff; border: 2px solid #2a2a2a;
 *   border-radius: 10px; padding: 12px 18px; font-size: 15px;
 *   :focus { border-color: #a2ff00; }
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../tokens';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Renderizado acima do campo, em typography.label. */
  label?: string;
  /** Pinta a borda de vermelho e exibe a mensagem abaixo do campo. */
  error?: string;
  testID?: string;
}

export function Input({ label, error, testID, onFocus, onBlur, ...rest }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.secondaryText}
        selectionColor={colors.primary}
        style={[styles.input, isFocused && styles.focused, !!error && styles.errored]}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {error ? (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.primaryText,
  },
  input: {
    backgroundColor: colors.card,
    color: colors.primaryText,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  focused: {
    borderColor: colors.primary,
  },
  errored: {
    borderColor: colors.error,
  },
  error: {
    ...typography.sub,
    color: colors.error,
  },
});
