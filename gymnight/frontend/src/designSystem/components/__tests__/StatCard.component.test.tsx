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

  it('renders the requested FontAwesome5 icon in the accent color', () => {
    const { UNSAFE_getByType } = render(
      <StatCard icon="weight-hanging" title="Volume" value="12k" />,
    );
    const icon = UNSAFE_getByType('FontAwesome5' as never);
    expect(icon.props.name).toBe('weight-hanging');
    expect(icon.props.color).toBe(colors.primary);
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

  it('carries the neon glow of the desktop stat cards', () => {
    const { getByTestId } = render(
      <StatCard icon="dumbbell" title="Treinos" value="4" testID="s" />,
    );
    expect(flatten(getByTestId('s').props.style).boxShadow).toContain('rgba(162, 255, 0,');
  });
});
