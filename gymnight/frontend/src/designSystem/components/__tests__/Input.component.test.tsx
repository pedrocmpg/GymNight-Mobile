/**
 * Component tests for Input — label, estado de foco (borda verde), estado de
 * erro (borda vermelha + mensagem) e repasse das props do TextInput.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Input } from '../Input';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('Input', () => {
  it('renders the label when given, and omits it otherwise', () => {
    const { getByText } = render(<Input label="E-mail" testID="i" />);
    expect(getByText('E-mail')).toBeTruthy();

    const { queryByText } = render(<Input testID="j" />);
    expect(queryByText('E-mail')).toBeNull();
  });

  it('starts with the neutral border', () => {
    const { getByTestId } = render(<Input testID="i" />);
    expect(flatten(getByTestId('i').props.style).borderColor).toBe(colors.border);
  });

  it('turns the border green while focused, and back on blur', () => {
    const { getByTestId } = render(<Input testID="i" />);
    fireEvent(getByTestId('i'), 'focus');
    expect(flatten(getByTestId('i').props.style).borderColor).toBe(colors.primary);

    fireEvent(getByTestId('i'), 'blur');
    expect(flatten(getByTestId('i').props.style).borderColor).toBe(colors.border);
  });

  it('shows the error message and a red border', () => {
    const { getByTestId } = render(<Input testID="i" error="Campo obrigatório" />);
    expect(flatten(getByTestId('i').props.style).borderColor).toBe(colors.error);
    expect(getByTestId('i-error').props.children).toBe('Campo obrigatório');
  });

  it('keeps the error border even while focused', () => {
    const { getByTestId } = render(<Input testID="i" error="x" />);
    fireEvent(getByTestId('i'), 'focus');
    expect(flatten(getByTestId('i').props.style).borderColor).toBe(colors.error);
  });

  it('forwards TextInput props and still calls the caller onFocus/onBlur', () => {
    const onChangeText = jest.fn();
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { getByTestId } = render(
      <Input
        testID="i"
        placeholder="Ex: Treino D"
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );
    const input = getByTestId('i');
    expect(input.props.placeholder).toBe('Ex: Treino D');

    fireEvent.changeText(input, 'abc');
    expect(onChangeText).toHaveBeenCalledWith('abc');

    fireEvent(input, 'focus');
    fireEvent(input, 'blur');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
