/**
 * Component tests for IconBadge — o quadrado verde-escuro do card de
 * exercício, com ícone FontAwesome5 ou glifo textual de fallback.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { IconBadge } from '../IconBadge';
import { colors, radii } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('IconBadge', () => {
  it('falls back to the ◈ glyph when no icon is given', () => {
    const { getByText } = render(<IconBadge testID="b" />);
    expect(getByText('◈')).toBeTruthy();
  });

  it('accepts a custom glyph', () => {
    const { getByText } = render(<IconBadge glyph="★" />);
    expect(getByText('★')).toBeTruthy();
  });

  it('prefers the FontAwesome5 icon over the glyph', () => {
    const { UNSAFE_getByType, queryByText } = render(<IconBadge icon="dumbbell" glyph="◈" />);
    expect(UNSAFE_getByType('FontAwesome5' as never).props.name).toBe('dumbbell');
    expect(queryByText('◈')).toBeNull();
  });

  it('is 44x44 with the dark-green badge background by default', () => {
    const { getByTestId } = render(<IconBadge testID="b" />);
    const style = flatten(getByTestId('b').props.style);
    expect(style.width).toBe(44);
    expect(style.height).toBe(44);
    expect(style.backgroundColor).toBe(colors.primaryBg);
    expect(style.borderRadius).toBe(radii.md);
  });

  it('honours a custom size', () => {
    const { getByTestId } = render(<IconBadge testID="b" size={60} />);
    const style = flatten(getByTestId('b').props.style);
    expect(style.width).toBe(60);
    expect(style.height).toBe(60);
  });
});
