/**
 * Component tests for SetCheckButton — o quadrado 52x52 que marca a série.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SetCheckButton } from '../SetCheckButton';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('SetCheckButton', () => {
  it('is 52x52', () => {
    const { getByTestId } = render(
      <SetCheckButton checked={false} onPress={jest.fn()} testID="c" />,
    );
    const style = flatten(getByTestId('c').props.style);
    expect(style.width).toBe(52);
    expect(style.height).toBe(52);
  });

  it('renders unchecked on the alt surface, with a border', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <SetCheckButton checked={false} onPress={jest.fn()} testID="c" />,
    );
    const style = flatten(getByTestId('c').props.style);
    expect(style.backgroundColor).toBe(colors.cardAlt);
    expect(style.borderWidth).toBe(1);
    expect(UNSAFE_getByType('FontAwesome5' as never).props.color).toBe(colors.secondaryText);
  });

  it('renders checked as a green square with a black check, no border', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <SetCheckButton checked onPress={jest.fn()} testID="c" />,
    );
    const style = flatten(getByTestId('c').props.style);
    expect(style.backgroundColor).toBe(colors.primary);
    expect(style.borderWidth).toBeUndefined();
    expect(UNSAFE_getByType('FontAwesome5' as never).props.color).toBe(colors.onPrimary);
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SetCheckButton checked={false} onPress={onPress} testID="c" />,
    );
    fireEvent.press(getByTestId('c'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onPress when disabled', () => {
    // O TouchableOpacity mockado ignora `disabled`; o guard está no handler.
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SetCheckButton checked={false} onPress={onPress} disabled testID="c" />,
    );
    fireEvent.press(getByTestId('c'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the checked state to assistive tech', () => {
    const { getByTestId } = render(
      <SetCheckButton
        checked
        onPress={jest.fn()}
        testID="c"
        accessibilityLabel="Marcar série 3 como concluída"
      />,
    );
    expect(getByTestId('c').props.accessibilityState).toMatchObject({ checked: true });
    expect(getByTestId('c').props.accessibilityLabel).toBe('Marcar série 3 como concluída');
  });
});
