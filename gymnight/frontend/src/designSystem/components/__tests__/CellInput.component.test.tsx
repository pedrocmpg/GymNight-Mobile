/**
 * Component tests for CellInput — célula preenchida da grade de séries: a
 * borda muda entre neutra (transparente), focada (lima) e erro (vermelha).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { CellInput } from '../CellInput';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('CellInput', () => {
  it('renders a filled cell with an invisible hairline at rest', () => {
    const { getByTestId } = render(<CellInput testID="u" />);
    const style = flatten(getByTestId('u').props.style);
    expect(style.backgroundColor).toBe(colors.cardAlt);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe('transparent');
    expect(style.textAlign).toBe('center');
  });

  it('paints the border lime while focused', () => {
    const { getByTestId } = render(<CellInput testID="u" />);
    fireEvent(getByTestId('u'), 'focus');
    expect(flatten(getByTestId('u').props.style).borderColor).toBe(colors.primary);
  });

  it('turns the border red and tints the cell when hasError', () => {
    const { getByTestId } = render(<CellInput testID="u" hasError />);
    const style = flatten(getByTestId('u').props.style);
    expect(style.borderColor).toBe(colors.error);
    expect(style.backgroundColor).toBe(colors.errorTint);
  });

  it('lets the error win over the focus ring', () => {
    const { getByTestId } = render(<CellInput testID="u" hasError />);
    fireEvent(getByTestId('u'), 'focus');
    expect(flatten(getByTestId('u').props.style).borderColor).toBe(colors.error);
  });

  it('dims ghost values and drops the surface when locked', () => {
    const { getByTestId } = render(
      <React.Fragment>
        <CellInput testID="ghost" isGhost />
        <CellInput testID="locked" isLocked />
      </React.Fragment>,
    );
    expect(flatten(getByTestId('ghost').props.style).color).toBe(colors.tertiaryText);
    const locked = getByTestId('locked');
    expect(flatten(locked.props.style).backgroundColor).toBe('transparent');
    expect(locked.props.editable).toBe(false);
  });

  it('forwards TextInput props', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <CellInput testID="u" placeholder="10-12" keyboardType="numeric" onChangeText={onChangeText} />,
    );
    expect(getByTestId('u').props.placeholder).toBe('10-12');
    expect(getByTestId('u').props.keyboardType).toBe('numeric');
    fireEvent.changeText(getByTestId('u'), '12');
    expect(onChangeText).toHaveBeenCalledWith('12');
  });
});
