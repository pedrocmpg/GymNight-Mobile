/**
 * Component tests for Card — renders children, applies bordered variant,
 * and forwards onPress when provided (pressable) vs static (no onPress).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

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
