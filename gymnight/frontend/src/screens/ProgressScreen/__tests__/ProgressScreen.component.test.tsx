/**
 * Component tests for ProgressScreen covering UI states and interaction.
 *
 * 1. Loading UI_State: shows loading indicator, nothing else visible.
 * 2. Empty UI_State: shows empty state when no exercise selected/no 1RM data.
 * 3. Success UI_State: renders chart + sessions list.
 * 4. PR banner appears/disappears according to isNewPersonalRecord.
 * 5. Interaction: tapping an exercise chip calls onSelectExercise.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProgressScreen, ProgressScreenProps } from '../ProgressScreen';

function renderProgressScreen(overrides: Partial<ProgressScreenProps> = {}) {
  const defaultProps: ProgressScreenProps = {
    isLoading: false,
    exercises: [],
    selectedExerciseId: null,
    oneRmSeries: [],
    isNewPersonalRecord: false,
    sessions: [],
    onSelectExercise: jest.fn(),
    ...overrides,
  };
  return { ...render(<ProgressScreen {...defaultProps} />), props: defaultProps };
}

describe('ProgressScreen — Loading UI_State', () => {
  it('shows the loading state when isLoading is true', () => {
    const { getByTestId } = renderProgressScreen({ isLoading: true });
    expect(getByTestId('progress-loading-state')).toBeTruthy();
  });

  it('does not show chart or sessions list when loading', () => {
    const { queryByTestId } = renderProgressScreen({
      isLoading: true,
      selectedExerciseId: 'e1',
      oneRmSeries: [{ timestampMs: 1, value: 100 }],
      sessions: [{ id: 's1', workoutName: 'Push', startedAt: 1, durationMs: 1000, totalVolume: 100 }],
    });
    expect(queryByTestId('one-rm-card')).toBeNull();
    expect(queryByTestId('sessions-list')).toBeNull();
  });
});

describe('ProgressScreen — Empty UI_State', () => {
  it('shows empty state when no exercise is selected', () => {
    const { getByTestId } = renderProgressScreen({ selectedExerciseId: null });
    expect(getByTestId('progress-empty-state')).toBeTruthy();
  });

  it('shows empty state when the selected exercise has no 1RM data', () => {
    const { getByTestId } = renderProgressScreen({ selectedExerciseId: 'e1', oneRmSeries: [] });
    expect(getByTestId('progress-empty-state')).toBeTruthy();
  });
});

describe('ProgressScreen — Success UI_State', () => {
  it('renders the 1RM chart when an exercise with data is selected', () => {
    const { getByTestId, queryByTestId } = renderProgressScreen({
      selectedExerciseId: 'e1',
      oneRmSeries: [{ timestampMs: 1, value: 100 }],
    });
    expect(getByTestId('one-rm-card')).toBeTruthy();
    expect(queryByTestId('progress-empty-state')).toBeNull();
  });

  it('renders the sessions list when there are sessions', () => {
    const { getByTestId } = renderProgressScreen({
      sessions: [{ id: 's1', workoutName: 'Push Day', startedAt: Date.now(), durationMs: 3000000, totalVolume: 4280 }],
    });
    expect(getByTestId('sessions-list')).toBeTruthy();
    expect(getByTestId('session-item-s1')).toBeTruthy();
  });

  it('renders exercise chips from the exercises prop', () => {
    const { getByTestId } = renderProgressScreen({
      exercises: [{ id: 'e1', name: 'Supino Reto' }, { id: 'e2', name: 'Agachamento' }],
    });
    expect(getByTestId('progress-exercise-option-e1')).toBeTruthy();
    expect(getByTestId('progress-exercise-option-e2')).toBeTruthy();
  });
});

describe('ProgressScreen — PR banner', () => {
  it('shows the PR banner when isNewPersonalRecord is true and chart is visible', () => {
    const { getByTestId } = renderProgressScreen({
      selectedExerciseId: 'e1',
      oneRmSeries: [{ timestampMs: 1, value: 100 }],
      isNewPersonalRecord: true,
    });
    expect(getByTestId('pr-banner')).toBeTruthy();
  });

  it('does not show the PR banner when isNewPersonalRecord is false', () => {
    const { queryByTestId } = renderProgressScreen({
      selectedExerciseId: 'e1',
      oneRmSeries: [{ timestampMs: 1, value: 100 }],
      isNewPersonalRecord: false,
    });
    expect(queryByTestId('pr-banner')).toBeNull();
  });

  it('does not show the PR banner when there is no chart, even if isNewPersonalRecord is true', () => {
    const { queryByTestId } = renderProgressScreen({
      selectedExerciseId: null,
      oneRmSeries: [],
      isNewPersonalRecord: true,
    });
    expect(queryByTestId('pr-banner')).toBeNull();
  });
});

describe('ProgressScreen — Interaction', () => {
  it('calls onSelectExercise with the tapped exercise id', () => {
    const onSelectExercise = jest.fn();
    const { getByTestId } = renderProgressScreen({
      exercises: [{ id: 'e1', name: 'Supino Reto' }],
      onSelectExercise,
    });
    fireEvent.press(getByTestId('progress-exercise-option-e1'));
    expect(onSelectExercise).toHaveBeenCalledWith('e1');
  });
});
