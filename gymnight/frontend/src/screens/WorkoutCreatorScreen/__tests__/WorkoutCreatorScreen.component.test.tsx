/**
 * Component tests for WorkoutCreatorScreen covering UI states and interaction.
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 *
 * 1. Loading UI_State: shows spinner, no form visible
 * 2. Empty UI_State: shows message suggesting network connection (empty catalog)
 * 3. Error UI_State: shows name validation error message
 * 4. Interaction: filling valid name and pressing save calls onSave
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  WorkoutCreatorScreen,
  WorkoutCreatorScreenProps,
} from '../WorkoutCreatorScreen';

function renderWorkoutCreatorScreen(
  overrides: Partial<WorkoutCreatorScreenProps> = {},
) {
  const defaultProps: WorkoutCreatorScreenProps = {
    isLoading: false,
    exercises: [{ id: 'ex1', name: 'Supino Reto' }],
    error: null,
    onSave: jest.fn(),
    ...overrides,
  };
  return { ...render(<WorkoutCreatorScreen {...defaultProps} />), props: defaultProps };
}

describe('WorkoutCreatorScreen — Loading UI_State', () => {
  it('shows a loading indicator when isLoading is true', () => {
    const { getByTestId } = renderWorkoutCreatorScreen({ isLoading: true });
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('shows the loading state container when isLoading is true', () => {
    const { getByTestId } = renderWorkoutCreatorScreen({ isLoading: true });
    expect(getByTestId('loading-state')).toBeTruthy();
  });

  it('does not show the workout form when loading', () => {
    const { queryByTestId } = renderWorkoutCreatorScreen({ isLoading: true });
    expect(queryByTestId('workout-name-input')).toBeNull();
    expect(queryByTestId('save-workout-button')).toBeNull();
  });

  it('does not show empty state when loading', () => {
    const { queryByTestId } = renderWorkoutCreatorScreen({ isLoading: true });
    expect(queryByTestId('empty-state')).toBeNull();
  });
});

describe('WorkoutCreatorScreen — Empty UI_State (catálogo vazio)', () => {
  it('shows empty state when exercises array is empty and not loading', () => {
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises: [],
      isLoading: false,
    });
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('shows a message suggesting to connect to the network', () => {
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises: [],
      isLoading: false,
    });
    const message = getByTestId('empty-message');
    expect(message).toBeTruthy();
    expect(message.props.children).toContain('Conecte-se');
  });

  it('does not show the form when catalog is empty', () => {
    const { queryByTestId } = renderWorkoutCreatorScreen({
      exercises: [],
      isLoading: false,
    });
    expect(queryByTestId('workout-name-input')).toBeNull();
    expect(queryByTestId('save-workout-button')).toBeNull();
  });
});

describe('WorkoutCreatorScreen — Error UI_State', () => {
  it('shows error message when error prop is provided', () => {
    const { getByTestId, getByText } = renderWorkoutCreatorScreen({
      error: 'Nome do treino é obrigatório',
    });
    expect(getByTestId('error-message')).toBeTruthy();
    expect(getByText('Nome do treino é obrigatório')).toBeTruthy();
  });

  it('does not show error message when error is null', () => {
    const { queryByTestId } = renderWorkoutCreatorScreen({
      error: null,
    });
    expect(queryByTestId('error-message')).toBeNull();
  });
});

describe('WorkoutCreatorScreen — Interaction (save workout)', () => {
  it('calls onSave with only the selected exercise and its targets when save is pressed', () => {
    const onSave = jest.fn();
    const exercises = [
      { id: 'ex1', name: 'Supino Reto' },
      { id: 'ex2', name: 'Agachamento' },
    ];
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      onSave,
    });

    fireEvent.changeText(getByTestId('workout-name-input'), 'Treino A');

    // Select only ex1 and fill its targets — ex2 stays unselected
    fireEvent(getByTestId('exercise-toggle-ex1'), 'valueChange', true);
    fireEvent.changeText(getByTestId('series-input-ex1'), '3');
    fireEvent.changeText(getByTestId('reps-input-ex1'), '10');
    fireEvent.changeText(getByTestId('weight-input-ex1'), '80');

    fireEvent.press(getByTestId('save-workout-button'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Treino A', [
      { exerciseId: 'ex1', seriesTarget: 3, repsTarget: 10, weightTarget: 80 },
    ]);
  });

  it('excludes a toggled exercise whose targets are incomplete', () => {
    const onSave = jest.fn();
    const exercises = [
      { id: 'ex1', name: 'Supino Reto' },
      { id: 'ex2', name: 'Agachamento' },
    ];
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      onSave,
    });

    fireEvent.changeText(getByTestId('workout-name-input'), 'Treino A');

    // ex1: complete targets
    fireEvent(getByTestId('exercise-toggle-ex1'), 'valueChange', true);
    fireEvent.changeText(getByTestId('series-input-ex1'), '3');
    fireEvent.changeText(getByTestId('reps-input-ex1'), '10');
    fireEvent.changeText(getByTestId('weight-input-ex1'), '80');

    // ex2: toggled on but missing weight
    fireEvent(getByTestId('exercise-toggle-ex2'), 'valueChange', true);
    fireEvent.changeText(getByTestId('series-input-ex2'), '4');
    fireEvent.changeText(getByTestId('reps-input-ex2'), '12');

    fireEvent.press(getByTestId('save-workout-button'));

    expect(onSave).toHaveBeenCalledWith('Treino A', [
      { exerciseId: 'ex1', seriesTarget: 3, repsTarget: 10, weightTarget: 80 },
    ]);
  });

  it('disables the save button when the workout name is empty', () => {
    const onSave = jest.fn();
    const exercises = [{ id: 'ex1', name: 'Supino Reto' }];
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      onSave,
    });

    fireEvent(getByTestId('exercise-toggle-ex1'), 'valueChange', true);
    fireEvent.changeText(getByTestId('series-input-ex1'), '3');
    fireEvent.changeText(getByTestId('reps-input-ex1'), '10');
    fireEvent.changeText(getByTestId('weight-input-ex1'), '80');
    // workout-name-input left empty

    fireEvent.press(getByTestId('save-workout-button'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables the save button when no exercise is selected', () => {
    const onSave = jest.fn();
    const exercises = [{ id: 'ex1', name: 'Supino Reto' }];
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      onSave,
    });

    fireEvent.changeText(getByTestId('workout-name-input'), 'Treino A');
    // no exercise toggled

    fireEvent.press(getByTestId('save-workout-button'));

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('WorkoutCreatorScreen — Busca de exercício (Wave 8)', () => {
  it('filtra a lista exibida ao digitar, sem acento nem caixa', () => {
    const exercises = [
      { id: 'ex1', name: 'Supino Reto (Barra)' },
      { id: 'ex2', name: 'Agachamento Livre' },
      { id: 'ex3', name: 'Bíceps Rosca Direta' },
    ];
    const { getByTestId, queryByTestId } = renderWorkoutCreatorScreen({ exercises });

    fireEvent.changeText(getByTestId('exercise-search-input'), 'biceps');

    expect(queryByTestId('exercise-row-ex1')).toBeNull();
    expect(queryByTestId('exercise-row-ex2')).toBeNull();
    expect(getByTestId('exercise-row-ex3')).toBeTruthy();
  });

  it('mostra a mensagem de "nenhum exercício encontrado" quando a busca não bate com nada', () => {
    const exercises = [{ id: 'ex1', name: 'Supino Reto (Barra)' }];
    const { getByTestId, queryByTestId } = renderWorkoutCreatorScreen({ exercises });

    fireEvent.changeText(getByTestId('exercise-search-input'), 'xyz-nao-existe');

    expect(getByTestId('exercise-search-no-results')).toBeTruthy();
    expect(queryByTestId('exercise-row-ex1')).toBeNull();
  });

  it('limpar a busca depois de selecionar um exercício preserva a seleção (busca só afeta o que é exibido)', () => {
    const onSave = jest.fn();
    const exercises = [
      { id: 'ex1', name: 'Supino Reto (Barra)' },
      { id: 'ex2', name: 'Agachamento Livre' },
    ];
    const { getByTestId } = renderWorkoutCreatorScreen({ exercises, onSave });

    fireEvent.changeText(getByTestId('exercise-search-input'), 'supino');
    fireEvent(getByTestId('exercise-toggle-ex1'), 'valueChange', true);
    fireEvent.changeText(getByTestId('series-input-ex1'), '3');
    fireEvent.changeText(getByTestId('reps-input-ex1'), '10');
    fireEvent.changeText(getByTestId('weight-input-ex1'), '80');

    fireEvent.changeText(getByTestId('exercise-search-input'), '');
    fireEvent.changeText(getByTestId('workout-name-input'), 'Treino A');
    fireEvent.press(getByTestId('save-workout-button'));

    expect(onSave).toHaveBeenCalledWith('Treino A', [
      { exerciseId: 'ex1', seriesTarget: 3, repsTarget: 10, weightTarget: 80 },
    ]);
  });
});

describe('WorkoutCreatorScreen — Modo edição (Wave 8)', () => {
  it('mostra "EDITAR TREINO" e pré-preenche nome e seleção a partir de initialWorkout', () => {
    const exercises = [
      { id: 'ex1', name: 'Supino Reto (Barra)' },
      { id: 'ex2', name: 'Agachamento Livre' },
    ];
    const { getByText, getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      mode: 'edit',
      initialWorkout: {
        name: 'Treino A',
        exercises: [{ exerciseId: 'ex1', seriesTarget: 4, repsTarget: 8, weightTarget: 60 }],
      },
      onDelete: jest.fn(),
    });

    expect(getByText('EDITAR TREINO')).toBeTruthy();
    expect(getByTestId('workout-name-input').props.value).toBe('Treino A');
    expect(getByTestId('exercise-toggle-ex1').props.value).toBe(true);
    expect(getByTestId('series-input-ex1').props.value).toBe('4');
    expect(getByTestId('reps-input-ex1').props.value).toBe('8');
    expect(getByTestId('weight-input-ex1').props.value).toBe('60');
  });

  it('sem onDelete (ou fora do modo edit) não mostra o botão de apagar', () => {
    const { queryByTestId } = renderWorkoutCreatorScreen({ mode: 'create' });
    expect(queryByTestId('delete-workout-button')).toBeNull();
  });

  it('mostra "CRIAR TREINO" por default (mode ausente)', () => {
    const { getByText } = renderWorkoutCreatorScreen();
    expect(getByText('CRIAR TREINO')).toBeTruthy();
  });

  it('apagar exige confirmação: só chama onDelete depois de "Sim, apagar"', () => {
    const onDelete = jest.fn();
    const { getByTestId } = renderWorkoutCreatorScreen({
      mode: 'edit',
      onDelete,
      initialWorkout: { name: 'Treino A', exercises: [] },
    });

    fireEvent.press(getByTestId('delete-workout-button'));
    expect(getByTestId('delete-confirm-card')).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('delete-confirm-yes'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('"Não" no confirm de apagar fecha o modal sem chamar onDelete', () => {
    const onDelete = jest.fn();
    const { getByTestId } = renderWorkoutCreatorScreen({
      mode: 'edit',
      onDelete,
      initialWorkout: { name: 'Treino A', exercises: [] },
    });

    fireEvent.press(getByTestId('delete-workout-button'));
    fireEvent.press(getByTestId('delete-confirm-no'));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
