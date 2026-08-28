/**
 * Component tests for ScreenHeader — o botão de voltar (que é a única saída
 * de WorkoutCreator e ActiveSession, já que o stack roda com
 * headerShown: false) e o slot livre à direita.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader', () => {
  it('renders a back button and calls onBack when pressed', () => {
    const onBack = jest.fn();
    const { getByText } = render(<ScreenHeader onBack={onBack} />);
    fireEvent.press(getByText('Voltar'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom back label', () => {
    const { getByText } = render(<ScreenHeader onBack={jest.fn()} backLabel="Cancelar" />);
    expect(getByText('Cancelar')).toBeTruthy();
  });

  it('renders no back button when onBack is absent', () => {
    const { queryByText } = render(<ScreenHeader />);
    expect(queryByText('Voltar')).toBeNull();
  });

  it('renders the right slot', () => {
    const { getByText } = render(
      <ScreenHeader onBack={jest.fn()} right={<Text>3/12 séries</Text>} />,
    );
    expect(getByText('3/12 séries')).toBeTruthy();
  });

  it('exposes a testID on the header and on the back button', () => {
    const { getByTestId } = render(<ScreenHeader onBack={jest.fn()} testID="hdr" />);
    expect(getByTestId('hdr')).toBeTruthy();
    expect(getByTestId('hdr-back')).toBeTruthy();
  });
});
