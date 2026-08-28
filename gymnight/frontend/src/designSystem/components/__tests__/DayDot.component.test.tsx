/**
 * Component tests for DayDot — o dia da semana do Dashboard. Ativo é raio
 * verde com glow forte; inativo é "—" sobre card com borda.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DayDot } from '../DayDot';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('DayDot', () => {
  it('uppercases the day label', () => {
    const { getByText } = render(<DayDot day="Seg" active={false} />);
    expect(getByText('SEG')).toBeTruthy();
  });

  it('renders inactive as a dash on the card surface, with a border', () => {
    const { getByText, getByLabelText } = render(<DayDot day="Ter" active={false} />);
    expect(getByText('—')).toBeTruthy();
    const style = flatten(getByLabelText('Ter: sem treino').props.style);
    expect(style.backgroundColor).toBe(colors.card);
    expect(style.borderWidth).toBe(1);
  });

  it('renders active as a green square with a bolt and a strong glow', () => {
    const { getByLabelText, UNSAFE_getByType, queryByText } = render(
      <DayDot day="Qua" active />,
    );
    const style = flatten(getByLabelText('Qua: treinou').props.style);
    expect(style.backgroundColor).toBe(colors.primary);
    expect(style.boxShadow).toContain('rgba(162, 255, 0, 0.55)');
    expect(UNSAFE_getByType('FontAwesome5' as never).props.name).toBe('bolt');
    expect(queryByText('—')).toBeNull();
  });

  it.each([
    [true, 'treinou'],
    [false, 'sem treino'],
  ])('is 48x48 when active=%p', (active, suffix) => {
    const { getByLabelText } = render(<DayDot day="Qui" active={active} />);
    const style = flatten(getByLabelText(`Qui: ${suffix}`).props.style);
    expect(style.width).toBe(48);
    expect(style.height).toBe(48);
  });

  it('carries no glow when inactive', () => {
    const { getByLabelText } = render(<DayDot day="Sex" active={false} />);
    expect(flatten(getByLabelText('Sex: sem treino').props.style).boxShadow).toBeUndefined();
  });
});
