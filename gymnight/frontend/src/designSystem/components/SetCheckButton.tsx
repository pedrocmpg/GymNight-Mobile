/**
 * SetCheckButton — conclui (grava) uma série. Desmarcado é uma célula
 * neutra; marcado vira lima — é o momento de recompensa do treino, por isso
 * o haptic médio.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, layout, radii } from '../tokens';
import { Touchable } from './Touchable';

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
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic={checked ? 'selection' : 'medium'}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      style={[styles.button, checked ? styles.checked : styles.unchecked]}
    >
      <FontAwesome5
        name="check"
        size={16}
        color={checked ? colors.onPrimary : colors.tertiaryText}
        solid
      />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.hitTarget,
    height: layout.hitTarget,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: colors.primary,
  },
  unchecked: {
    backgroundColor: colors.cardAlt,
  },
});
