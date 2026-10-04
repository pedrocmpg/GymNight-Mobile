/**
 * Component tests for DeltaBadge — formato percentual e em kg, cor e seta
 * pelo sinal, magnitude sem sinal.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DeltaBadge } from '../DeltaBadge';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('DeltaBadge', () => {
  it('formats a positive percent in green with an up arrow', () => {
    const { getByText, UNSAFE_getByType } = render(<DeltaBadge value={19.6} />);
    expect(getByText('20%')).toBeTruthy();
    expect(flatten(getByText('20%').props.style).color).toBe(colors.success);
    expect(UNSAFE_getByType('FontAwesome5' as never).props.name).toBe('arrow-up');
  });

  it('formats a negative kg delta in red, magnitude without the sign', () => {
    const { getByText, getByTestId, UNSAFE_getByType } = render(
      <DeltaBadge value={-2.5} format="kg" testID="d" />,
    );
    expect(getByText('2.5 kg')).toBeTruthy();
    expect(flatten(getByTestId('d').props.style).backgroundColor).toBe(colors.errorTint);
    expect(UNSAFE_getByType('FontAwesome5' as never).props.name).toBe('arrow-down');
  });

  it('treats zero as a non-negative change', () => {
    const { getByText } = render(<DeltaBadge value={0} />);
    expect(flatten(getByText('0%').props.style).color).toBe(colors.success);
  });
});
