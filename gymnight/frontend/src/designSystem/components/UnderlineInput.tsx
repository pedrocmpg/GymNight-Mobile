/**
 * UnderlineInput — campo sem caixa, só com a linha de base. É o input de
 * peso/reps das séries do treino ativo (active_workout.py:589-604):
 *
 *   background: transparent; border: none; border-bottom: 1px solid #2a2a2a;
 *   border-radius: 0; padding: 10px 8px; font-size: 15px;
 *   :focus { border-bottom: 2px solid #a2ff00; }
 *
 * No estado de erro (active_workout.py:678) a linha vira 2px vermelha.
 */

import React, { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../tokens';

export interface UnderlineInputProps extends Omit<TextInputProps, 'style'> {
  /** Pinta a linha de base de vermelho. */
  hasError?: boolean;
  testID?: string;
}

export function UnderlineInput({
  hasError = false,
  testID,
  onFocus,
  onBlur,
  ...rest
}: UnderlineInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      testID={testID}
      placeholderTextColor={colors.secondaryText}
      selectionColor={colors.primary}
      style={[styles.input, isFocused && styles.focused, hasError && styles.errored]}
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
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    backgroundColor: 'transparent',
    color: colors.primaryText,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRadius: 0,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
    ...typography.body,
  },
  focused: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  errored: {
    borderBottomWidth: 2,
    borderBottomColor: colors.error,
  },
});
