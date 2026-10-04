/**
 * Component tests for Card — renders children, applies bordered variant,
 * and forwards onPress when provided (pressable) vs static (no onPress).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';
import { Card } from '../Card';
import { colors } from '../../tokens';

/** Achata o array de estilos do RN num objeto único. */
function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('Card', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <Card testID="card">
        <Text>conteúdo</Text>
      </Card>,
    );
    expect(getByText('conteúdo')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <Card testID="my-card">
        <Text>x</Text>
      </Card>,
    );
    expect(getByTestId('my-card')).toBeTruthy();
  });

  it('calls onPress when pressed, if provided', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <Card onPress={onPress} accessibilityLabel="pressable card">
        <Text>x</Text>
      </Card>,
    );
    fireEvent.press(getByLabelText('pressable card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is borderless by default — depth comes from the surface step', () => {
    const { getByTestId } = render(
      <Card testID="card">
        <Text>x</Text>
      </Card>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(colors.card);
    expect(style.borderWidth).toBeUndefined();
    expect(style.boxShadow).toBeUndefined();
  });

  it('draws a 1px hairline when bordered', () => {
    const { getByTestId } = render(
      <Card testID="card" bordered>
        <Text>x</Text>
      </Card>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.border);
  });

  it.each([
    ['md', 16],
    ['lg', 24],
  ] as const)('applies the %s padding preset', (padding, expected) => {
    const { getByTestId } = render(
      <Card testID="card" padding={padding}>
        <Text>x</Text>
      </Card>,
    );
    expect(flatten(getByTestId('card').props.style).padding).toBe(expected);
  });

  it('has no padding with padding="none" (lists of ListRow)', () => {
    const { getByTestId } = render(
      <Card testID="card" padding="none">
        <Text>x</Text>
      </Card>,
    );
    expect(flatten(getByTestId('card').props.style).padding).toBeUndefined();
  });

  it('is static (no touchable wrapper) when onPress is not provided', () => {
    const { queryByLabelText } = render(
      <Card accessibilityLabel="static card">
        <Text>x</Text>
      </Card>,
    );
    // Without onPress, there is no pressable wrapper carrying this a11y label.
    expect(queryByLabelText('static card')).toBeNull();
  });
});
