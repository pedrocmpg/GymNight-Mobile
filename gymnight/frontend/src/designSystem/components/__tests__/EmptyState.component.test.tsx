/**
 * Component tests for EmptyState — mensagem centralizada com ação opcional.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { EmptyState } from '../EmptyState';
import { colors } from '../../tokens';

function flatten(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[StyleSheet.flatten(style)].flat(Infinity).filter(Boolean));
}

describe('EmptyState', () => {
  it('renders its message centered in the secondary color', () => {
    const { getByText } = render(<EmptyState message="Nenhum treino encontrado." />);
    const style = flatten(getByText('Nenhum treino encontrado.').props.style);
    expect(style.textAlign).toBe('center');
    expect(style.color).toBe(colors.secondaryText);
  });

  it('renders no action button by default', () => {
    const { queryByTestId } = render(<EmptyState message="x" testID="e" />);
    expect(queryByTestId('e-action')).toBeNull();
  });

  it('renders the action and fires onAction', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState message="x" actionLabel="Criar treino" onAction={onAction} />,
    );
    fireEvent.press(getByText('Criar treino'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('needs both actionLabel and onAction to render the button', () => {
    const { queryByText: noHandler } = render(
      <EmptyState message="x" actionLabel="Criar treino" />,
    );
    expect(noHandler('Criar treino')).toBeNull();

    const { queryByTestId } = render(
      <EmptyState message="x" onAction={jest.fn()} testID="e" />,
    );
    expect(queryByTestId('e-action')).toBeNull();
  });
});
