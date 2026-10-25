/**
 * Seletor "Idioma dos exercícios" no sheet da conta (catálogo de 500).
 * O idioma vem do LanguageContext — não é prop da tela.
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { DashboardScreen, type DashboardScreenProps } from '../DashboardScreen';
import { LanguageProvider } from '../../../i18n/LanguageContext';
import { loadLanguage } from '../../../i18n/language';

const resetStore = (SecureStore as unknown as { __resetStore: () => void }).__resetStore;

function renderScreen() {
  const props: DashboardScreenProps = {
    isOnline: true,
    isLoading: false,
    workouts: [],
    weeklyStreak: [false, false, false, false, false, false, false],
    syncStatus: 'synced',
    onCreateWorkout: jest.fn(),
    onStartSession: jest.fn(),
    onLogout: jest.fn(),
  };
  return render(
    <LanguageProvider>
      <DashboardScreen {...props} />
    </LanguageProvider>,
  );
}

function isSelected(node: { props: { accessibilityState?: { selected?: boolean } } }) {
  return node.props.accessibilityState?.selected === true;
}

beforeEach(() => resetStore());

describe('DashboardScreen — idioma dos exercícios', () => {
  it('mostra o seletor no sheet da conta, com Português selecionado por padrão', async () => {
    const screen = renderScreen();
    await act(async () => {});
    expect(screen.getByTestId('language-setting')).toBeTruthy();
    expect(isSelected(screen.getByTestId('language-option-pt'))).toBe(true);
    expect(isSelected(screen.getByTestId('language-option-en'))).toBe(false);
  });

  it('tocar em English seleciona e salva o idioma', async () => {
    const screen = renderScreen();
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByTestId('language-option-en'));
    });
    expect(isSelected(screen.getByTestId('language-option-en'))).toBe(true);
    expect(isSelected(screen.getByTestId('language-option-pt'))).toBe(false);
    await expect(loadLanguage()).resolves.toBe('en');
  });
});
