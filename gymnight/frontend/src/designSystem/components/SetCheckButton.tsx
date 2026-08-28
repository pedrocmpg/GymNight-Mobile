/**
 * SetCheckButton — quadrado de 52×52 que marca uma série como concluída.
 * Porta o _style_check do desktop (active_workout.py:654-660):
 *
 *   marcado:    check #000000 sobre #a2ff00, radius 10, sem borda
 *   desmarcado: check #6b7280 sobre #222222, radius 10, borda 1px #2a2a2a
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, radii } from '../tokens';

export interface SetCheckButtonProps {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function SetCheckButton({
  checked,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
}: SetCheckButtonProps) {
  // O TouchableOpacity mockado nos testes ignora a prop `disabled`.
  const handlePress = () => {
    if (disabled) return;
    onPress();
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      style={[styles.button, checked ? styles.checked : styles.unchecked]}
    >
      <FontAwesome5
        name="check"
        size={18}
        color={checked ? colors.onPrimary : colors.secondaryText}
        solid
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: colors.primary,
  },
  unchecked: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
