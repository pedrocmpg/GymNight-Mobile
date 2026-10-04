/**
 * Component tests for StatCard — ícone + título, valor grande e unidade
 * assentada na linha de base.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { StatCard } from '../StatCard';
import { colors, typography } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('StatCard', () => {
  it('renders title, value and unit', () => {
    const { getByText } = render(
      <StatCard icon="dumbbell" title="Treinos esta semana" value="4" unit="dias" />,
    );
    expect(getByText('Treinos esta semana')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
    expect(getByText('dias')).toBeTruthy();
  });

  it('omits the unit when not given', () => {
    const { queryByText } = render(<StatCard icon="fire" title="Streak" value="3" />);
    expect(queryByText('dias')).toBeNull();
  });

  it('renders the requested FontAwesome5 icon in a neutral tone — lime is not decoration', () => {
    const { UNSAFE_getByType } = render(
      <StatCard icon="weight-hanging" title="Volume" value="12k" />,
    );
    const icon = UNSAFE_getByType('FontAwesome5' as never);
    expect(icon.props.name).toBe('weight-hanging');
    expect(icon.props.color).toBe(colors.tertiaryText);
  });

  it('styles the value as the big stat and the unit as its lighter companion', () => {
    const { getByText } = render(
      <StatCard icon="dumbbell" title="Treinos" value="4" unit="dias" />,
    );
    const value = flatten(getByText('4').props.style);
    expect(value.fontSize).toBe(typography.stat.fontSize);
    expect(value.color).toBe(colors.primaryText);

    const unit = flatten(getByText('dias').props.style);
    expect(unit.fontSize).toBe(typography.statUnit.fontSize);
    expect(unit.color).toBe(colors.tertiaryText);
  });

  it('sits on a plain card surface — no glow, no border', () => {
    const { getByTestId } = render(
      <StatCard icon="dumbbell" title="Treinos" value="4" testID="s" />,
    );
    const style = flatten(getByTestId('s').props.style);
    expect(style.backgroundColor).toBe(colors.card);
    expect(style.boxShadow).toBeUndefined();
    expect(style.borderWidth).toBeUndefined();
  });

  describe('delta (Wave 7 — Estatísticas)', () => {
    it('omits the delta badge when deltaPct is not given', () => {
      const { queryByTestId } = render(
        <StatCard icon="dumbbell" title="Treinos" value="4" testID="s" />,
      );
      expect(queryByTestId('s-delta')).toBeNull();
    });

    it('shows the delta badge even when deltaPct is exactly 0', () => {
      const { getByTestId } = render(
        <StatCard icon="dumbbell" title="Treinos" value="4" deltaPct={0} testID="s" />,
      );
      expect(getByTestId('s-delta')).toBeTruthy();
    });

    it('renders a positive delta in green with an up arrow', () => {
      const { getByTestId, getByText } = render(
        <StatCard icon="dumbbell" title="Treinos" value="4" deltaPct={20} testID="s" />,
      );
      expect(getByText('20%')).toBeTruthy();
      const icon = getByTestId('s-delta').findByType('FontAwesome5' as never);
      expect((icon.props as { name: string }).name).toBe('arrow-up');
      expect(flatten(getByText('20%').props.style).color).toBe(colors.success);
    });

    it('renders a negative delta in red with a down arrow, magnitude without the sign', () => {
      const { getByTestId, getByText } = render(
        <StatCard icon="dumbbell" title="Treinos" value="4" deltaPct={-5} testID="s" />,
      );
      expect(getByText('5%')).toBeTruthy();
      const icon = getByTestId('s-delta').findByType('FontAwesome5' as never);
      expect((icon.props as { name: string }).name).toBe('arrow-down');
      expect(flatten(getByText('5%').props.style).color).toBe(colors.error);
    });
  });
});
