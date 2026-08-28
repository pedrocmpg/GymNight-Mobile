/**
 * Component tests for ProgressBar — o preenchimento é percentual e o valor
 * é clampado no próprio componente.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ProgressBar } from '../ProgressBar';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

function widthOf(value: number): unknown {
  const { getByTestId } = render(<ProgressBar value={value} testID="p" />);
  return flatten(getByTestId('p-fill').props.style).width;
}

describe('ProgressBar', () => {
  it('renders a 4px track in the border color', () => {
    const { getByTestId } = render(<ProgressBar value={0.5} testID="p" />);
    const style = flatten(getByTestId('p').props.style);
    expect(style.height).toBe(4);
    expect(style.backgroundColor).toBe(colors.border);
  });

  it('fills proportionally, in green', () => {
    const { getByTestId } = render(<ProgressBar value={0.42} testID="p" />);
    const fill = flatten(getByTestId('p-fill').props.style);
    expect(fill.width).toBe('42%');
    expect(fill.backgroundColor).toBe(colors.primary);
  });

  it.each([
    [0, '0%'],
    [1, '100%'],
    [-5, '0%'],
    [7, '100%'],
  ])('clamps %p to %s', (value, expected) => {
    expect(widthOf(value)).toBe(expected);
  });

  it('treats NaN as empty rather than crashing', () => {
    expect(widthOf(Number.NaN)).toBe('0%');
  });

  it('reports progress to assistive tech', () => {
    const { getByTestId } = render(<ProgressBar value={0.25} testID="p" />);
    expect(getByTestId('p').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 25 });
  });
});
