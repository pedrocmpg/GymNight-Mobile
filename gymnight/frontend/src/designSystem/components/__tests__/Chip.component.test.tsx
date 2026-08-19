/**
 * Component tests for Chip — renders label, reflects selected state, and
 * calls onPress when tapped.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from '../Chip';

describe('Chip', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Chip label="Supino Reto" selected={false} onPress={jest.fn()} />);
    expect(getByText('Supino Reto')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Chip label="Agachamento" selected={false} onPress={onPress} testID="chip-1" />,
    );
    fireEvent.press(getByTestId('chip-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityState.selected reflecting the selected prop', () => {
    const { getByTestId, rerender } = render(
      <Chip label="Terra" selected={false} onPress={jest.fn()} testID="chip-2" />,
    );
    expect(getByTestId('chip-2').props.accessibilityState.selected).toBe(false);

    rerender(<Chip label="Terra" selected onPress={jest.fn()} testID="chip-2" />);
    expect(getByTestId('chip-2').props.accessibilityState.selected).toBe(true);
  });
});
