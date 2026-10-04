/**
 * Component tests for DayDot — o dia da semana do Dashboard. Ativo é um
 * círculo lima com raio; inativo é um círculo vazio em cardAlt; hoje ganha
 * um anel fino.
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
  it('renders the day label as given (sentence case)', () => {
    const { getByText, queryByText } = render(<DayDot day="Seg" active={false} />);
    expect(getByText('Seg')).toBeTruthy();
    expect(queryByText('SEG')).toBeNull();
  });

  it('renders inactive as an empty circle on the alt surface', () => {
    const { getByLabelText, UNSAFE_queryByType } = render(<DayDot day="Ter" active={false} />);
    const style = flatten(getByLabelText('Ter: sem treino').props.style);
    expect(style.backgroundColor).toBe(colors.cardAlt);
    expect(style.borderWidth).toBeUndefined();
    expect(UNSAFE_queryByType('FontAwesome5' as never)).toBeNull();
  });

  it('renders active as a lime circle with a bolt — no glow', () => {
    const { getByLabelText, UNSAFE_getByType } = render(<DayDot day="Qua" active />);
    const style = flatten(getByLabelText('Qua: treinou').props.style);
    expect(style.backgroundColor).toBe(colors.primary);
    expect(style.boxShadow).toBeUndefined();
    expect(UNSAFE_getByType('FontAwesome5' as never).props.name).toBe('bolt');
  });

  it.each([
    [true, 'treinou'],
    [false, 'sem treino'],
  ])('is a 36px circle when active=%p', (active, suffix) => {
    const { getByLabelText } = render(<DayDot day="Qui" active={active} />);
    const style = flatten(getByLabelText(`Qui: ${suffix}`).props.style);
    expect(style.width).toBe(36);
    expect(style.height).toBe(36);
  });

  it('rings today and highlights its label', () => {
    const { getByLabelText, getByText } = render(<DayDot day="Sex" active={false} isToday />);
    const style = flatten(getByLabelText('Sex: sem treino').props.style);
    expect(style.borderColor).toBe(colors.secondaryText);
    expect(flatten(getByText('Sex').props.style).color).toBe(colors.primaryText);
  });
});
