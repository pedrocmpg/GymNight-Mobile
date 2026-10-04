/**
 * Component tests for Sheet + ConfirmSheet — testIDs derivados (os mesmos dos
 * modais que substituíram), callbacks e o haptic de aviso no tom destrutivo.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ConfirmSheet } from '../ConfirmSheet';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('renders title and children inside the panel, and closes on the scrim', () => {
    const onClose = jest.fn();
    const { getByText, getByTestId } = render(
      <Sheet visible onClose={onClose} title="Conta" testID="s" panelTestID="s-panel">
        <Text>conteúdo</Text>
      </Sheet>,
    );
    expect(getByTestId('s').props.visible).toBe(true);
    expect(getByTestId('s-panel')).toBeTruthy();
    expect(getByText('Conta')).toBeTruthy();
    expect(getByText('conteúdo')).toBeTruthy();
    fireEvent.press(getByTestId('s-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmSheet', () => {
  function renderSheet(overrides: Partial<React.ComponentProps<typeof ConfirmSheet>> = {}) {
    const props = {
      visible: true,
      title: 'Abandonar treino?',
      message: 'A sessão continua salva.',
      confirmLabel: 'Abandonar',
      cancelLabel: 'Continuar',
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
      testID: 'exit-confirm',
      ...overrides,
    };
    return { props, ...render(<ConfirmSheet {...props} />) };
  }

  it('derives the modal/card/yes/no testIDs from its base testID', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('exit-confirm-modal')).toBeTruthy();
    expect(getByTestId('exit-confirm-card')).toBeTruthy();
    expect(getByTestId('exit-confirm-yes')).toBeTruthy();
    expect(getByTestId('exit-confirm-no')).toBeTruthy();
  });

  it('wires confirm and cancel', () => {
    const { getByTestId, props } = renderSheet();
    fireEvent.press(getByTestId('exit-confirm-yes'));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('exit-confirm-no'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('warns with a haptic only when the action is destructive', () => {
    (Haptics.notificationAsync as jest.Mock).mockClear();
    renderSheet();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    renderSheet({ tone: 'danger' });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
  });
});
