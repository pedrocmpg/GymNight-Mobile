/**
 * Component tests for UnderlineInput — só a linha de base muda entre os
 * estados neutro (1px cinza), focado (2px verde) e erro (2px vermelha).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { UnderlineInput } from '../UnderlineInput';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('UnderlineInput', () => {
  it('renders a 1px neutral underline and no box', () => {
    const { getByTestId } = render(<UnderlineInput testID="u" />);
    const style = flatten(getByTestId('u').props.style);
    expect(style.borderBottomWidth).toBe(1);
    expect(style.borderBottomColor).toBe(colors.border);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderRadius).toBe(0);
  });

  it('thickens the underline to 2px green while focused', () => {
    const { getByTestId } = render(<UnderlineInput testID="u" />);
    fireEvent(getByTestId('u'), 'focus');
    const style = flatten(getByTestId('u').props.style);
    expect(style.borderBottomWidth).toBe(2);
    expect(style.borderBottomColor).toBe(colors.primary);
  });

  it('turns the underline red when hasError', () => {
    const { getByTestId } = render(<UnderlineInput testID="u" hasError />);
    const style = flatten(getByTestId('u').props.style);
    expect(style.borderBottomWidth).toBe(2);
    expect(style.borderBottomColor).toBe(colors.error);
  });

  it('lets the error win over the focus ring', () => {
    const { getByTestId } = render(<UnderlineInput testID="u" hasError />);
    fireEvent(getByTestId('u'), 'focus');
    expect(flatten(getByTestId('u').props.style).borderBottomColor).toBe(colors.error);
  });

  it('forwards TextInput props', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <UnderlineInput testID="u" placeholder="10-12" keyboardType="numeric" onChangeText={onChangeText} />,
    );
    expect(getByTestId('u').props.placeholder).toBe('10-12');
    expect(getByTestId('u').props.keyboardType).toBe('numeric');

    fireEvent.changeText(getByTestId('u'), '12');
    expect(onChangeText).toHaveBeenCalledWith('12');
  });
});
