/**
 * Catálogo de 500 no WorkoutCreatorScreen: miniatura estática que anima ao
 * adicionar, sheet de detalhe pela miniatura, filtros por grupo/adicionados,
 * busca em PT e EN e nomes no idioma ativo.
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import {
  WorkoutCreatorScreen,
  type WorkoutCreatorExercise,
  type WorkoutCreatorScreenProps,
} from '../WorkoutCreatorScreen';
import { LanguageProvider } from '../../../i18n/LanguageContext';
import { saveLanguage } from '../../../i18n/language';

const resetStore = (SecureStore as unknown as { __resetStore: () => void }).__resetStore;

const BENCH: WorkoutCreatorExercise = {
  id: 'bench',
  name: 'Supino reto com barra',
  nameEn: 'Barbell Bench Press',
  equipment: 'Barra',
  mediaKey: '0025',
  primaryGroup: 'Peito',
  secondaryGroups: ['Tríceps', 'Ombros'],
};

const SQUAT: WorkoutCreatorExercise = {
  id: 'squat',
  name: 'Agachamento livre com barra',
  nameEn: 'Barbell Full Squat',
  equipment: 'Barra',
  mediaKey: '0043',
  primaryGroup: 'Pernas',
  secondaryGroups: [],
};

const OLD: WorkoutCreatorExercise = { id: 'old', name: 'Exercício sem mídia' };

function renderScreen(overrides: Partial<WorkoutCreatorScreenProps> = {}) {
  const props: WorkoutCreatorScreenProps = {
    isLoading: false,
    exercises: [BENCH, SQUAT, OLD],
    error: null,
    onSave: jest.fn(),
    ...overrides,
  };
  return render(
    <LanguageProvider>
      <WorkoutCreatorScreen {...props} />
    </LanguageProvider>,
  );
}

function rowIds(screen: ReturnType<typeof renderScreen>): string[] {
  return screen
    .getAllByTestId(/^exercise-row-/)
    .map((node) => String(node.props.testID).replace('exercise-row-', ''));
}

beforeEach(() => resetStore());

describe('WorkoutCreatorScreen — miniaturas', () => {
  it('mostra a JPG estática enquanto o exercício não foi adicionado', async () => {
    const screen = renderScreen();
    await act(async () => {});
    const image = screen.getByTestId('exercise-thumb-bench-image');
    expect(image.props.autoplay).toBe(false);
    expect(screen.getByText('Peito · Barra')).toBeTruthy();
  });

  it('anima a miniatura quando o exercício entra no treino', async () => {
    const screen = renderScreen();
    await act(async () => {});
    fireEvent.press(screen.getByTestId('exercise-row-bench'));
    expect(screen.getByTestId('exercise-thumb-bench-image').props.autoplay).toBe(true);
  });

  it('exercício sem mídia mostra o ícone de fallback', async () => {
    const screen = renderScreen();
    await act(async () => {});
    expect(screen.getByTestId('exercise-thumb-old-fallback')).toBeTruthy();
  });

  it('tocar na miniatura abre o sheet de detalhe sem marcar o exercício', async () => {
    const screen = renderScreen();
    await act(async () => {});
    expect(screen.getByTestId('exercise-detail').props.visible).toBe(false);

    fireEvent.press(screen.getByTestId('exercise-thumb-bench'));

    expect(screen.getByTestId('exercise-detail').props.visible).toBe(true);
    expect(screen.getByTestId('exercise-detail-media-image').props.autoplay).toBe(true);
    expect(screen.getByTestId('exercise-detail-secondary')).toBeTruthy();
    expect(screen.getByTestId('exercise-toggle-bench').props.value).toBe(false);
  });
});

describe('WorkoutCreatorScreen — filtros e busca', () => {
  it('lista em ordem alfabética do nome exibido', async () => {
    const screen = renderScreen();
    await act(async () => {});
    expect(rowIds(screen)).toEqual(['squat', 'old', 'bench']);
  });

  it('o chip de grupo mostra só os exercícios daquele grupo principal', async () => {
    const screen = renderScreen();
    await act(async () => {});
    fireEvent.press(screen.getByTestId('exercise-filter-Pernas'));
    expect(rowIds(screen)).toEqual(['squat']);
  });

  it('o chip "Adicionados" mostra só os marcados', async () => {
    const screen = renderScreen();
    await act(async () => {});
    fireEvent.press(screen.getByTestId('exercise-row-bench'));
    fireEvent.press(screen.getByTestId('exercise-filter-selected'));
    expect(rowIds(screen)).toEqual(['bench']);
  });

  it('a busca encontra pelo nome em inglês mesmo em PT', async () => {
    const screen = renderScreen();
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('exercise-search-input'), 'bench press');
    expect(rowIds(screen)).toEqual(['bench']);
  });

  it('filtro sem resultado mostra a mensagem de vazio', async () => {
    const screen = renderScreen();
    await act(async () => {});
    fireEvent.press(screen.getByTestId('exercise-filter-Costas'));
    expect(screen.getByTestId('exercise-search-no-results')).toBeTruthy();
  });
});

describe('WorkoutCreatorScreen — idioma', () => {
  it('em EN mostra nome, grupo e equipamento em inglês', async () => {
    await saveLanguage('en');
    const screen = renderScreen();
    await act(async () => {});
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.getByText('Chest · Barbell')).toBeTruthy();
    expect(screen.getByTestId('exercise-filter-Peito')).toBeTruthy();
    expect(screen.getByText('Legs')).toBeTruthy();
  });
});
