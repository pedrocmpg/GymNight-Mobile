/**
 * CellInput — célula numérica compacta da grade de séries (peso / reps).
 *
 * Preenchida em cardAlt, número tabular centralizado. Foco pinta a borda de
 * lima; erro pinta de vermelho e tinge o fundo. Série gravada ("locked")
 * perde a superfície e vira texto — o check ao lado já diz que está feita.
 */

import React, { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, layout } from '../tokens';

export interface CellInputProps extends Omit<TextInputProps, 'style'> {
  /** Pinta a borda de vermelho. */
  hasError?: boolean;
  /**
   * Exibe o texto apagado. Marca o valor como referência da sessão anterior
   * ("fantasma"), e não como algo que o usuário digitou nesta sessão. Ao editar
   * o campo, quem chama deve desligar esta flag — o valor passou a ser dele.
   */
  isGhost?: boolean;
  /** Trava o campo (série já gravada). Mantém o texto legível, sem cursor. */
  isLocked?: boolean;
  testID?: string;
}

export function CellInput({
  hasError = false,
  isGhost = false,
  isLocked = false,
  testID,
  onFocus,
  onBlur,
  ...rest
}: CellInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      testID={testID}
      placeholderTextColor={colors.tertiaryText}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      editable={!isLocked && rest.editable !== false}
      style={[
        styles.input,
        isGhost && styles.ghost,
        isLocked && styles.locked,
        isFocused && styles.focused,
        hasError && styles.errored,
      ]}
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
    ...typography.numeric,
    // lineHeight num TextInput desalinha o texto verticalmente no Android.
    lineHeight: undefined,
    height: layout.hitTarget,
    backgroundColor: colors.cardAlt,
    color: colors.primaryText,
    borderWidth: layout.hairline,
    borderColor: 'transparent',
    borderRadius: radii.sm,
    paddingVertical: 0,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
  },
  focused: {
    borderColor: colors.primary,
  },
  errored: {
    borderColor: colors.error,
    backgroundColor: colors.errorTint,
  },
  // Valor da sessão anterior: legível, mas visivelmente "não é seu ainda".
  ghost: {
    color: colors.tertiaryText,
  },
  locked: {
    backgroundColor: 'transparent',
    color: colors.primaryText,
  },
});
