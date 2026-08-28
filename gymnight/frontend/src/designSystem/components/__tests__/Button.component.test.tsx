/**
 * Component tests for Button — as quatro variantes, o ícone opcional, e os
 * dois estados que bloqueiam o press (disabled e loading).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from '../Button';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('Button', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Entrar" onPress={onPress} />);
    fireEvent.press(getByText('Entrar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('defaults to the primary variant — green background, black label', () => {
    const { getByTestId, getByText } = render(
      <Button label="Salvar" onPress={jest.fn()} testID="btn" />,
    );
    expect(flatten(getByTestId('btn').props.style).backgroundColor).toBe(colors.primary);
    expect(flatten(getByText('Salvar').props.style).color).toBe(colors.onPrimary);
  });

  it.each([
    ['ghost', colors.border, colors.secondaryText],
    ['danger', colors.error, colors.error],
    ['outlineAccent', colors.primary, colors.primary],
  ] as const)('renders the %s variant transparent with its own border', (variant, borderColor, textColor) => {
    const { getByTestId, getByText } = render(
      <Button label="X" onPress={jest.fn()} variant={variant} testID="btn" />,
    );
    const style = flatten(getByTestId('btn').props.style);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe(borderColor);
    expect(flatten(getByText('X').props.style).color).toBe(textColor);
  });

  it('does NOT call onPress when disabled', () => {
    // O TouchableOpacity mockado ignora a prop `disabled`, então o guard
    // precisa estar dentro do handler — é isso que este teste protege.
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Salvar" onPress={onPress} disabled />);
    fireEvent.press(getByText('Salvar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('greys the surface out when disabled', () => {
    const { getByTestId, getByText } = render(
      <Button label="Salvar" onPress={jest.fn()} disabled testID="btn" />,
    );
    expect(flatten(getByTestId('btn').props.style).backgroundColor).toBe(colors.cardAlt);
    expect(flatten(getByText('Salvar').props.style).color).toBe(colors.secondaryText);
  });

  it('swaps the label for a spinner while loading, and blocks the press', () => {
    const onPress = jest.fn();
    const { queryByText, getByTestId } = render(
      <Button label="Salvar" onPress={onPress} loading testID="btn" />,
    );
    expect(queryByText('Salvar')).toBeNull();
    expect(getByTestId('btn-loading')).toBeTruthy();

    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders the FontAwesome5 icon when one is given', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Novo" onPress={jest.fn()} icon="plus" />,
    );
    expect(UNSAFE_getByType('FontAwesome5' as never).props.name).toBe('plus');
  });

  it('falls back to the label as the accessibility label', () => {
    const { getByLabelText } = render(<Button label="Finalizar" onPress={jest.fn()} />);
    expect(getByLabelText('Finalizar')).toBeTruthy();
  });
});
