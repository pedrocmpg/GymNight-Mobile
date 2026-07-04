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
  it('calls onSave with the workout name and exercises when save is pressed', () => {
    const onSave = jest.fn();
    const exercises = [
      { id: 'ex1', name: 'Supino Reto' },
      { id: 'ex2', name: 'Agachamento' },
    ];
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      onSave,
    });

    // Fill in the workout name
    const input = getByTestId('workout-name-input');
    fireEvent.changeText(input, 'Treino A');

    // Press save
    const saveButton = getByTestId('save-workout-button');
    fireEvent.press(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Treino A', exercises);
  });

  it('calls onSave with empty name if user does not type anything', () => {
    const onSave = jest.fn();
    const exercises = [{ id: 'ex1', name: 'Supino Reto' }];
    const { getByTestId } = renderWorkoutCreatorScreen({
      exercises,
      onSave,
    });

    const saveButton = getByTestId('save-workout-button');
    fireEvent.press(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('', exercises);
  });
});
