/**
 * Component tests for Touchable — guard de disabled, haptic por press e o
 * realce de fundo do feedback "highlight".
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Touchable } from '../Touchable';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('Touchable', () => {
  beforeEach(() => {
    (Haptics.selectionAsync as jest.Mock).mockClear();
  });

  it('calls onPress and fires the requested haptic', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Touchable onPress={onPress} haptic="selection">
        <Text>ok</Text>
      </Touchable>,
    );
    fireEvent.press(getByText('ok'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('blocks the press and the haptic when disabled, and reports it', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Touchable onPress={onPress} haptic="selection" disabled testID="t">
        <Text>ok</Text>
      </Touchable>,
    );
    fireEvent.press(getByTestId('t'));
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(getByTestId('t').props.accessibilityState).toEqual({ disabled: true });
  });

  it('paints the pressed background with feedback="highlight"', () => {
    const { getByTestId } = render(
      <Touchable onPress={jest.fn()} feedback="highlight" testID="t">
        <Text>ok</Text>
      </Touchable>,
    );
    fireEvent(getByTestId('t'), 'pressIn');
    expect(flatten(getByTestId('t').props.style).backgroundColor).toBe(colors.cardAlt);
    fireEvent(getByTestId('t'), 'pressOut');
    expect(flatten(getByTestId('t').props.style).backgroundColor).toBeUndefined();
  });

  it('keeps testID, style and a11y props on a single host element', () => {
    const { getByTestId } = render(
      <Touchable
        onPress={jest.fn()}
        testID="t"
        style={{ width: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Ação"
      >
        <Text>ok</Text>
      </Touchable>,
    );
    const host = getByTestId('t');
    expect(flatten(host.props.style).width).toBe(10);
    expect(host.props.accessibilityRole).toBe('button');
    expect(host.props.accessibilityLabel).toBe('Ação');
  });
});
