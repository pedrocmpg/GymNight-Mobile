/**
 * Component tests for DashboardScreen covering UI states and interaction.
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 *
 * 1. Loading UI_State: shows loading indicator, no data visible
 * 2. Empty UI_State: shows empty state CTA ("Criar primeiro treino")
 * 3. Offline UI_State: shows offline banner AND data (when data exists)
 * 4. Success UI_State: renders workout list
 * 5. Interaction: pressing "Criar primeiro treino" CTA calls onCreateWorkout
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DashboardScreen, DashboardScreenProps } from '../DashboardScreen';

function renderDashboardScreen(overrides: Partial<DashboardScreenProps> = {}) {
  const defaultProps: DashboardScreenProps = {
    isOnline: true,
    isLoading: false,
    workouts: [],
    syncStatus: 'synced',
    onCreateWorkout: jest.fn(),
    ...overrides,
  };
  return { ...render(<DashboardScreen {...defaultProps} />), props: defaultProps };
}

describe('DashboardScreen — Loading UI_State', () => {
  it('shows a loading indicator when isLoading is true', () => {
    const { getByTestId } = renderDashboardScreen({ isLoading: true });
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('shows the loading state container when isLoading is true', () => {
    const { getByTestId } = renderDashboardScreen({ isLoading: true });
    expect(getByTestId('loading-state')).toBeTruthy();
  });

  it('does not show workout list when loading', () => {
    const { queryByTestId } = renderDashboardScreen({
      isLoading: true,
      workouts: [{ id: '1', name: 'Treino A' }],
    });
    expect(queryByTestId('workout-list')).toBeNull();
  });

  it('does not show empty state when loading', () => {
    const { queryByTestId } = renderDashboardScreen({ isLoading: true });
    expect(queryByTestId('empty-state')).toBeNull();
  });

  it('does not show offline banner when loading', () => {
    const { queryByTestId } = renderDashboardScreen({
      isLoading: true,
      isOnline: false,
    });
    expect(queryByTestId('offline-banner')).toBeNull();
  });
});

describe('DashboardScreen — Empty UI_State', () => {
  it('shows empty state when workouts array is empty and not loading', () => {
    const { getByTestId } = renderDashboardScreen({
      workouts: [],
      isLoading: false,
    });
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('shows the CTA button "Criar primeiro treino"', () => {
    const { getByTestId, getByText } = renderDashboardScreen({
      workouts: [],
      isLoading: false,
    });
    expect(getByTestId('create-workout-cta')).toBeTruthy();
    expect(getByText('Criar primeiro treino')).toBeTruthy();
  });

  it('does not show workout list when empty', () => {
    const { queryByTestId } = renderDashboardScreen({
      workouts: [],
      isLoading: false,
    });
    expect(queryByTestId('workout-list')).toBeNull();
  });
});

describe('DashboardScreen — Offline UI_State', () => {
  it('shows offline banner when isOnline is false and not loading', () => {
    const { getByTestId } = renderDashboardScreen({
      isOnline: false,
      isLoading: false,
      workouts: [{ id: '1', name: 'Treino A' }],
    });
    expect(getByTestId('offline-banner')).toBeTruthy();
  });

  it('shows data (workout list) simultaneously with offline banner', () => {
    const workouts = [
      { id: '1', name: 'Treino A' },
      { id: '2', name: 'Treino B' },
    ];
    const { getByTestId } = renderDashboardScreen({
      isOnline: false,
      isLoading: false,
      workouts,
    });
    // Both offline banner and workout list are visible
    expect(getByTestId('offline-banner')).toBeTruthy();
    expect(getByTestId('workout-list')).toBeTruthy();
  });

  it('does not show offline banner when isOnline is true', () => {
    const { queryByTestId } = renderDashboardScreen({
      isOnline: true,
      isLoading: false,
      workouts: [{ id: '1', name: 'Treino A' }],
    });
    expect(queryByTestId('offline-banner')).toBeNull();
  });

  it('shows empty state CTA with offline banner when offline and no data', () => {
    const { getByTestId } = renderDashboardScreen({
      isOnline: false,
      isLoading: false,
      workouts: [],
    });
    expect(getByTestId('offline-banner')).toBeTruthy();
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByTestId('create-workout-cta')).toBeTruthy();
  });
});

describe('DashboardScreen — Success UI_State', () => {
  it('renders workout list when workouts are available', () => {
    const workouts = [
      { id: '1', name: 'Treino A' },
      { id: '2', name: 'Treino B' },
      { id: '3', name: 'Treino C' },
    ];
    const { getByTestId } = renderDashboardScreen({
      workouts,
      isLoading: false,
      isOnline: true,
    });
    expect(getByTestId('workout-list')).toBeTruthy();
  });

  it('renders each workout item with correct testID', () => {
    const workouts = [
      { id: 'w1', name: 'Push Day' },
      { id: 'w2', name: 'Pull Day' },
    ];
    const { getByTestId } = renderDashboardScreen({
      workouts,
      isLoading: false,
      isOnline: true,
    });
    expect(getByTestId('workout-item-w1')).toBeTruthy();
    expect(getByTestId('workout-item-w2')).toBeTruthy();
  });

  it('displays workout names in the list', () => {
    const workouts = [{ id: '1', name: 'Leg Day' }];
    const { getByText } = renderDashboardScreen({
      workouts,
      isLoading: false,
      isOnline: true,
    });
    expect(getByText('Leg Day')).toBeTruthy();
  });

  it('does not show empty state when workouts are available', () => {
    const { queryByTestId } = renderDashboardScreen({
      workouts: [{ id: '1', name: 'Treino' }],
      isLoading: false,
    });
    expect(queryByTestId('empty-state')).toBeNull();
  });

  it('does not show loading indicator in success state', () => {
    const { queryByTestId } = renderDashboardScreen({
      workouts: [{ id: '1', name: 'Treino' }],
      isLoading: false,
    });
    expect(queryByTestId('loading-indicator')).toBeNull();
  });
});

describe('DashboardScreen — Interaction (create workout CTA)', () => {
  it('calls onCreateWorkout when "Criar primeiro treino" CTA is pressed', () => {
    const onCreateWorkout = jest.fn();
    const { getByTestId } = renderDashboardScreen({
      workouts: [],
      isLoading: false,
      onCreateWorkout,
    });

    const ctaButton = getByTestId('create-workout-cta');
    fireEvent.press(ctaButton);

    expect(onCreateWorkout).toHaveBeenCalledTimes(1);
  });

  it('calls onCreateWorkout each time CTA is pressed', () => {
    const onCreateWorkout = jest.fn();
    const { getByTestId } = renderDashboardScreen({
      workouts: [],
      isLoading: false,
      onCreateWorkout,
    });

    const ctaButton = getByTestId('create-workout-cta');
    fireEvent.press(ctaButton);
    fireEvent.press(ctaButton);
    fireEvent.press(ctaButton);

    expect(onCreateWorkout).toHaveBeenCalledTimes(3);
  });
});
