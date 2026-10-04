/**
 * Component tests for ListRow — texto, valor, chevron, trailing fora da área
 * pressionável e divider opcional.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ListRow } from '../ListRow';

describe('ListRow', () => {
  it('renders title, subtitle and value', () => {
    const { getByText } = render(<ListRow title="Treino A" subtitle="6 exercícios" value="hoje" />);
    expect(getByText('Treino A')).toBeTruthy();
    expect(getByText('6 exercícios')).toBeTruthy();
    expect(getByText('hoje')).toBeTruthy();
  });

  it('is pressable through its testID when onPress is given', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ListRow title="Treino A" onPress={onPress} testID="row" accessibilityLabel="Abrir Treino A" />,
    );
    fireEvent.press(getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('row').props.accessibilityLabel).toBe('Abrir Treino A');
  });

  it('keeps the trailing slot outside the pressable area', () => {
    const onRowPress = jest.fn();
    const onTrailingPress = jest.fn();
    const { getByText } = render(
      <ListRow
        title="Treino A"
        onPress={onRowPress}
        trailing={<Text onPress={onTrailingPress}>editar</Text>}
      />,
    );
    fireEvent.press(getByText('editar'));
    expect(onTrailingPress).toHaveBeenCalledTimes(1);
    expect(onRowPress).not.toHaveBeenCalled();
  });

  it('shows a chevron only when asked', () => {
    const { UNSAFE_queryByType, rerender } = render(<ListRow title="A" />);
    expect(UNSAFE_queryByType('FontAwesome5' as never)).toBeNull();
    rerender(<ListRow title="A" showChevron />);
    expect(UNSAFE_queryByType('FontAwesome5' as never)?.props.name).toBe('chevron-right');
  });

  it('renders expanded children below the row', () => {
    const { getByText } = render(
      <ListRow title="Supino">
        <Text>3 séries</Text>
      </ListRow>,
    );
    expect(getByText('3 séries')).toBeTruthy();
  });
});
