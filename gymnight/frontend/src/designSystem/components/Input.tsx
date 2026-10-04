/**
 * Input — campo de texto com label e estado de erro.
 *
 * Superfície cardAlt com hairline; foco pinta a borda de lima, erro de
 * vermelho. Altura fixa de 52 alinha com o Button md.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, layout } from '../tokens';

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
        placeholderTextColor={colors.tertiaryText}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
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
    color: colors.secondaryText,
  },
  input: {
    ...typography.body,
    // lineHeight num TextInput desalinha o texto verticalmente no Android.
    lineHeight: undefined,
    height: layout.controlHeight.md,
    backgroundColor: colors.cardAlt,
    color: colors.primaryText,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: colors.primary,
  },
  errored: {
    borderColor: colors.error,
  },
  error: {
    ...typography.footnote,
    color: colors.error,
  },
});
