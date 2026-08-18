/**
 * Component tests for ActiveSessionScreen covering UI states and interaction.
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 *
 * 1. Error UI_State isolated by item: only the set with an error shows error UI, others remain normal
 * 2. Interaction: pressing "Registrar Série" triggers onLogSet with entered values
 * 3. Volume display: totalVolume is rendered correctly
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ActiveSessionScreen,
  ActiveSessionProps,
  ActiveSessionLoggedSet,
} from '../ActiveSessionScreen';

// Fix Date.now for timer predictability
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01T00:01:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

function renderActiveSession(overrides: Partial<ActiveSessionProps> = {}) {
  const defaultProps: ActiveSessionProps = {
    session: { id: 'session-1', started_at: new Date('2024-01-01T00:00:00.000Z').getTime() },
    loggedSets: [],
    totalVolume: 0,
    exerciseOptions: [{ id: 'ex1', name: 'Supino Reto' }, { id: 'ex2', name: 'Agachamento' }],
    onLogSet: jest.fn(),
    onEndSession: jest.fn(),
    ...overrides,
  };
  return { ...render(<ActiveSessionScreen {...defaultProps} />), props: defaultProps };
}

describe('ActiveSessionScreen — Error UI_State isolated by item', () => {
  it('shows error message only on the set that has an error', () => {
    const loggedSets: ActiveSessionLoggedSet[] = [
      { id: 'set-1', exerciseId: 'ex1', exerciseName: 'Supino Reto', weight: 80, reps: 10 },
      { id: 'set-2', exerciseId: 'ex2', exerciseName: 'Agachamento', weight: 60, reps: 12, error: 'Falha ao persistir' },
      { id: 'set-3', exerciseId: 'ex1', exerciseName: 'Supino Reto', weight: 85, reps: 8 },
    ];

    const { getByTestId, queryByTestId } = renderActiveSession({ loggedSets });

    // set-2 should have error UI
    expect(getByTestId('set-error-set-2')).toBeTruthy();
    expect(getByTestId('set-error-set-2').props.children).toBe('Falha ao persistir');

    // set-1 and set-3 should NOT have error UI
    expect(queryByTestId('set-error-set-1')).toBeNull();
    expect(queryByTestId('set-error-set-3')).toBeNull();
  });

  it('renders all sets normally when none have errors', () => {
    const loggedSets: ActiveSessionLoggedSet[] = [
      { id: 'set-1', exerciseId: 'ex1', exerciseName: 'Supino Reto', weight: 80, reps: 10 },
      { id: 'set-2', exerciseId: 'ex2', exerciseName: 'Agachamento', weight: 60, reps: 12 },
    ];

    const { queryByTestId, getByTestId } = renderActiveSession({ loggedSets });

    // Both sets render
    expect(getByTestId('logged-set-set-1')).toBeTruthy();
    expect(getByTestId('logged-set-set-2')).toBeTruthy();

    // No error on any set
    expect(queryByTestId('set-error-set-1')).toBeNull();
    expect(queryByTestId('set-error-set-2')).toBeNull();
  });

  it('shows error on multiple items independently when multiple have errors', () => {
    const loggedSets: ActiveSessionLoggedSet[] = [
      { id: 'set-1', exerciseId: 'ex1', exerciseName: 'Supino Reto', weight: 80, reps: 10, error: 'Erro 1' },
      { id: 'set-2', exerciseId: 'ex2', exerciseName: 'Agachamento', weight: 60, reps: 12 },
      { id: 'set-3', exerciseId: 'ex1', exerciseName: 'Supino Reto', weight: 85, reps: 8, error: 'Erro 3' },
    ];

    const { getByTestId, queryByTestId } = renderActiveSession({ loggedSets });

    // set-1 and set-3 have errors
    expect(getByTestId('set-error-set-1').props.children).toBe('Erro 1');
    expect(getByTestId('set-error-set-3').props.children).toBe('Erro 3');

    // set-2 has no error
    expect(queryByTestId('set-error-set-2')).toBeNull();
  });

  it('still renders set info text even when an error is present', () => {
    const loggedSets: ActiveSessionLoggedSet[] = [
      { id: 'set-1', exerciseId: 'ex1', exerciseName: 'Supino Reto', weight: 80, reps: 10, error: 'Falha' },
    ];

    const { getByTestId } = renderActiveSession({ loggedSets });

    // Set info is still displayed alongside error
    expect(getByTestId('set-info-set-1')).toBeTruthy();
    expect(getByTestId('set-error-set-1')).toBeTruthy();
  });
});

describe('ActiveSessionScreen — Interaction (log set)', () => {
  it('calls onLogSet with entered values when "Registrar Série" is pressed', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderActiveSession({ onLogSet });

    // Pick an exercise via chip, then fill in the form
    fireEvent.press(getByTestId('exercise-option-ex1'));
    fireEvent.changeText(getByTestId('weight-input'), '100');
    fireEvent.changeText(getByTestId('reps-input'), '8');

    // Press log set button
    fireEvent.press(getByTestId('log-set-button'));

    expect(onLogSet).toHaveBeenCalledTimes(1);
    expect(onLogSet).toHaveBeenCalledWith('ex1', 100, 8);
  });

  it('does not call onLogSet if no exercise is selected', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderActiveSession({ onLogSet });

    fireEvent.changeText(getByTestId('weight-input'), '100');
    fireEvent.changeText(getByTestId('reps-input'), '8');
    // no exercise chip pressed

    fireEvent.press(getByTestId('log-set-button'));

    expect(onLogSet).not.toHaveBeenCalled();
  });

  it('does not call onLogSet if weight is not a valid number', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderActiveSession({ onLogSet });

    fireEvent.press(getByTestId('exercise-option-ex1'));
    fireEvent.changeText(getByTestId('weight-input'), 'abc');
    fireEvent.changeText(getByTestId('reps-input'), '8');

    fireEvent.press(getByTestId('log-set-button'));

    expect(onLogSet).not.toHaveBeenCalled();
  });

  it('does not call onLogSet if reps is not a valid number', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderActiveSession({ onLogSet });

    fireEvent.press(getByTestId('exercise-option-ex1'));
    fireEvent.changeText(getByTestId('weight-input'), '100');
    fireEvent.changeText(getByTestId('reps-input'), '');

    fireEvent.press(getByTestId('log-set-button'));

    expect(onLogSet).not.toHaveBeenCalled();
  });
});

describe('ActiveSessionScreen — Interaction (end session)', () => {
  it('calls onEndSession when "Finalizar treino" is pressed', () => {
    const onEndSession = jest.fn();
    const { getByTestId } = renderActiveSession({ onEndSession });

    fireEvent.press(getByTestId('end-session-button'));

    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});

describe('ActiveSessionScreen — Volume display', () => {
  it('renders totalVolume correctly when zero', () => {
    const { getByTestId } = renderActiveSession({ totalVolume: 0 });
    expect(getByTestId('volume-value').props.children).toEqual([0, ' kg']);
  });

  it('renders totalVolume correctly with a positive value', () => {
    const { getByTestId } = renderActiveSession({ totalVolume: 2400 });
    expect(getByTestId('volume-value').props.children).toEqual([2400, ' kg']);
  });

  it('renders the volume summary container', () => {
    const { getByTestId } = renderActiveSession({ totalVolume: 1500 });
    expect(getByTestId('volume-summary')).toBeTruthy();
  });
});

describe('ActiveSessionScreen — Timer display', () => {
  it('shows elapsed time formatted from started_at', () => {
    // started_at is 1 minute before current time (set in beforeEach)
    const { getByTestId } = renderActiveSession();
    expect(getByTestId('session-timer').props.children).toBe('00:01:00');
  });
});
