/**
 * Component tests for Banner — a faixa com borda esquerda colorida que
 * substitui os banners sem estilo (texto invisível) dos containers.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Banner } from '../Banner';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('Banner', () => {
  it('renders its message', () => {
    const { getByText } = render(<Banner message="Você está offline." />);
    expect(getByText('Você está offline.')).toBeTruthy();
  });

  it('defaults to the info variant — green left border', () => {
    const { getByTestId } = render(<Banner message="x" testID="b" />);
    const style = flatten(getByTestId('b').props.style);
    expect(style.borderLeftWidth).toBe(4);
    expect(style.borderLeftColor).toBe(colors.primary);
  });

  it('renders the error variant with a red left border and red text', () => {
    const { getByTestId, getByText } = render(
      <Banner message="Falha ao sair." variant="error" testID="b" />,
    );
    expect(flatten(getByTestId('b').props.style).borderLeftColor).toBe(colors.error);
    expect(flatten(getByText('Falha ao sair.').props.style).color).toBe(colors.error);
  });

  it('always paints the text explicitly — the bug it fixes was invisible text', () => {
    const { getByText } = render(<Banner message="visível" />);
    const color = flatten(getByText('visível').props.style).color;
    expect(color).toBeDefined();
    expect(color).not.toBe(colors.background);
  });

  it('announces itself as an alert', () => {
    const { getByTestId } = render(<Banner message="x" testID="b" />);
    expect(getByTestId('b').props.accessibilityRole).toBe('alert');
  });
});
