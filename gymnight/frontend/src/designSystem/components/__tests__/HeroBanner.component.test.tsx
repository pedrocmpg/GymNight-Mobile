/**
 * Component tests for HeroBanner — a imagem de fundo com os quatro degradês
 * pretos das bordas, portados do _HeroBanner do desktop.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';
import { HeroBanner } from '../HeroBanner';
import { colors, radii } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('HeroBanner', () => {
  it('renders the overlaid children', () => {
    const { getByText } = render(
      <HeroBanner>
        <Text>BOM TREINO, PEDRO</Text>
      </HeroBanner>,
    );
    expect(getByText('BOM TREINO, PEDRO')).toBeTruthy();
  });

  it('covers the area with rounded corners at the default height', () => {
    const { getByTestId } = render(
      <HeroBanner testID="hero">
        <Text>x</Text>
      </HeroBanner>,
    );
    const banner = getByTestId('hero');
    const style = flatten(banner.props.style);
    expect(style.height).toBe(180);
    expect(style.borderRadius).toBe(radii.lg);
    expect(style.overflow).toBe('hidden');
    expect(banner.props.resizeMode).toBe('cover');
  });

  it('honours a custom height', () => {
    const { getByTestId } = render(
      <HeroBanner testID="hero" height={240}>
        <Text>x</Text>
      </HeroBanner>,
    );
    expect(flatten(getByTestId('hero').props.style).height).toBe(240);
  });

  it('paints four edge scrims — left, right, top and bottom', () => {
    const { UNSAFE_getAllByType } = render(
      <HeroBanner>
        <Text>x</Text>
      </HeroBanner>,
    );
    const gradients = UNSAFE_getAllByType('LinearGradient' as never);
    expect(gradients).toHaveLength(4);
    expect(gradients.map((g) => g.props.id)).toEqual([
      'heroLeft',
      'heroRight',
      'heroTop',
      'heroBottom',
    ]);
  });

  it('fades each scrim from black at the edge to transparent inward', () => {
    const { UNSAFE_getAllByType } = render(
      <HeroBanner>
        <Text>x</Text>
      </HeroBanner>,
    );
    const stops = UNSAFE_getAllByType('Stop' as never);
    expect(stops).toHaveLength(8);
    for (const stop of stops) {
      expect(stop.props.stopColor).toBe(colors.scrim);
    }
    expect(stops.filter((s) => s.props.stopOpacity === 0)).toHaveLength(4);
  });
});
