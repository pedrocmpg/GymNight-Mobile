/**
 * Catálogo de 500 na sessão ativa: miniatura animada ao lado do nome na
 * grade, prévia do exercício escolhido no modo livre, sheet de detalhe ao
 * tocar na miniatura e nomes no idioma ativo.
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import {
  ActiveSessionScreen,
  type ActiveSessionExerciseOption,
  type ActiveSessionProps,
} from '../ActiveSessionScreen';
import { LanguageProvider } from '../../../i18n/LanguageContext';
import { saveLanguage } from '../../../i18n/language';

const resetStore = (SecureStore as unknown as { __resetStore: () => void }).__resetStore;

const BENCH: ActiveSessionExerciseOption = {
  id: 'bench',
  name: 'Supino reto com barra',
  nameEn: 'Barbell Bench Press',
  equipment: 'Barra',
  mediaKey: '0025',
  primaryGroup: 'Peito',
  secondaryGroups: ['Tríceps', 'Ombros'],
  seriesTarget: 3,
  repsTarget: 10,
  weightTarget: 40,
};

const LEGACY: ActiveSessionExerciseOption = {
  id: 'legacy',
  name: 'Exercício antigo',
  seriesTarget: 2,
  repsTarget: 10,
  weightTarget: 0,
};

function renderSession(overrides: Partial<ActiveSessionProps> = {}) {
  const props: ActiveSessionProps = {
    session: { id: 'session-1', started_at: Date.now() },
    loggedSets: [],
    totalVolume: 0,
    exerciseOptions: [BENCH, LEGACY],
    onLogSet: jest.fn(),
    onEndSession: jest.fn(),
    hasWorkout: true,
    ...overrides,
  };
  return render(
    <LanguageProvider>
      <ActiveSessionScreen {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  resetStore();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ActiveSessionScreen — modo grade', () => {
  it('mostra a miniatura animada ao lado do nome de cada exercício', async () => {
    const screen = renderSession();
    await act(async () => {});
    expect(screen.getByTestId('exercise-thumb-bench-image').props.autoplay).toBe(true);
    expect(screen.getByText('Supino reto com barra')).toBeTruthy();
  });

  it('exercício sem mídia cai no ícone de fallback', async () => {
    const screen = renderSession();
    await act(async () => {});
    expect(screen.getByTestId('exercise-thumb-legacy-fallback')).toBeTruthy();
  });

  it('tocar na miniatura abre o sheet com a animação e os músculos', async () => {
    const screen = renderSession();
    await act(async () => {});
    expect(screen.getByTestId('exercise-detail').props.visible).toBe(false);

    fireEvent.press(screen.getByTestId('exercise-thumb-bench'));

    expect(screen.getByTestId('exercise-detail').props.visible).toBe(true);
    expect(screen.getByTestId('exercise-detail-primary')).toBeTruthy();
    expect(screen.getByTestId('exercise-detail-equipment')).toBeTruthy();
  });

  it('em EN mostra o nome em inglês', async () => {
    await saveLanguage('en');
    const screen = renderSession();
    await act(async () => {});
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
  });
});

describe('ActiveSessionScreen — modo livre', () => {
  it('escolher um exercício mostra a prévia animada dele', async () => {
    const screen = renderSession({ hasWorkout: false });
    await act(async () => {});
    expect(screen.queryByTestId('selected-exercise-preview')).toBeNull();

    fireEvent.press(screen.getByTestId('exercise-option-bench'));

    expect(screen.getByTestId('selected-exercise-preview')).toBeTruthy();
    expect(screen.getByTestId('selected-exercise-thumb-image').props.autoplay).toBe(true);
    expect(screen.getByText('Peito · Barra')).toBeTruthy();

    fireEvent.press(screen.getByTestId('selected-exercise-thumb'));
    expect(screen.getByTestId('exercise-detail').props.visible).toBe(true);
  });
});
