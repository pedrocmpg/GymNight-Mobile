/**
 * Component tests for Screen + IconButton + LoadingState — a casca padrão das
 * telas e os dois primitivos menores do REDESIGN-04.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../Screen';
import { IconButton } from '../IconButton';
import { LoadingState } from '../LoadingState';
import { colors, layout } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('Screen', () => {
  it('wraps content in a SafeAreaView with the requested edges', () => {
    const { getByTestId } = render(
      <Screen edges={['top']} testID="screen">
        <Text>x</Text>
      </Screen>,
    );
    const root = getByTestId('screen');
    expect(root.props.edges).toEqual(['top']);
    expect(flatten(root.props.style).backgroundColor).toBe(colors.background);
  });

  it('renders the title, subtitle and right slot as the first scroll item', () => {
    const { getByText, getByTestId } = render(
      <Screen
        edges={['top']}
        title="Progresso"
        subtitle="Últimos 30 dias"
        titleTestID="title"
        titleRight={<Text>avatar</Text>}
        scrollTestID="scroll"
      >
        <Text>conteúdo</Text>
      </Screen>,
    );
    expect(getByTestId('title').props.children).toBe('Progresso');
    expect(getByText('Últimos 30 dias')).toBeTruthy();
    expect(getByText('avatar')).toBeTruthy();
    expect(flatten(getByTestId('scroll').props.contentContainerStyle).paddingHorizontal).toBe(
      layout.gutter,
    );
  });

  it('renders fixed header and footer outside the scroll', () => {
    const { getByText } = render(
      <Screen edges={['top', 'bottom']} header={<Text>topo</Text>} footer={<Text>cta</Text>}>
        <Text>meio</Text>
      </Screen>,
    );
    expect(getByText('topo')).toBeTruthy();
    expect(getByText('cta')).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('is a 44x44 target labelled for assistive tech', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <IconButton icon="pencil-alt" onPress={onPress} accessibilityLabel="Editar Treino A" />,
    );
    const button = getByLabelText('Editar Treino A');
    expect(flatten(button.props.style).width).toBe(layout.hitTarget);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('paints the danger tone red', () => {
    const { UNSAFE_getByType } = render(
      <IconButton icon="trash-alt" tone="danger" onPress={jest.fn()} accessibilityLabel="Apagar" />,
    );
    expect(UNSAFE_getByType('FontAwesome5' as never).props.color).toBe(colors.error);
  });
});

describe('LoadingState', () => {
  it('exposes both testIDs', () => {
    const { getByTestId } = render(<LoadingState testID="l" indicatorTestID="l-ind" />);
    expect(getByTestId('l')).toBeTruthy();
    expect(getByTestId('l-ind')).toBeTruthy();
  });
});
