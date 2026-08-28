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

  it('is bordered by default — no desktop todo card tem borda', () => {
    const { getByTestId } = render(
      <Card testID="card">
        <Text>x</Text>
      </Card>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.borderWidth).toBe(2);
    expect(style.borderColor).toBe(colors.border);
  });

  it('drops the border when bordered is explicitly false', () => {
    const { getByTestId } = render(
      <Card testID="card" bordered={false}>
        <Text>x</Text>
      </Card>,
    );
    expect(flatten(getByTestId('card').props.style).borderWidth).toBeUndefined();
  });

  it('applies a neon glow only when glow is set', () => {
    const { getByTestId: withGlow } = render(
      <Card testID="card" glow>
        <Text>x</Text>
      </Card>,
    );
    expect(flatten(withGlow('card').props.style).boxShadow).toContain('rgba(162, 255, 0,');

    const { getByTestId: without } = render(
      <Card testID="plain">
        <Text>x</Text>
      </Card>,
    );
    expect(flatten(without('plain').props.style).boxShadow).toBeUndefined();
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
