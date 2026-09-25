/**
 * Component tests for StatisticsScreen — loading state, radar card, e o grid
 * 2×2 de métricas com delta (Wave 7).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StatisticsScreen, type StatisticsScreenMetric } from '../StatisticsScreen';
import type { RadarSlice } from '../computeRadarGeometry';

function metric(value: number, deltaPct: number): StatisticsScreenMetric {
  return { value, deltaPct };
}

const RADAR_SLICES: RadarSlice[] = [
  { label: 'Peito', value: 100 },
  { label: 'Costas', value: 80 },
  { label: 'Ombros', value: 40 },
  { label: 'Braços', value: 60 },
  { label: 'Pernas', value: 120 },
  { label: 'Core', value: 20 },
];

function renderScreen(overrides: Partial<React.ComponentProps<typeof StatisticsScreen>> = {}) {
  return render(
    <StatisticsScreen
      isLoading={false}
      radarSlices={RADAR_SLICES}
      sessionCount={metric(12, 20)}
      totalDurationMs={metric(8 * 3600_000 + 20 * 60_000, 12)}
      totalVolume={metric(42_500, -5)}
      totalSets={metric(186, 8)}
      {...overrides}
    />,
  );
}

describe('StatisticsScreen', () => {
  it('shows the loading indicator and nothing else while isLoading', () => {
    const { getByTestId, queryByTestId } = renderScreen({ isLoading: true });
    expect(getByTestId('statistics-loading-indicator')).toBeTruthy();
    expect(queryByTestId('muscle-radar-card')).toBeNull();
    expect(queryByTestId('statistics-stats-grid')).toBeNull();
  });

  it('shows the title in uppercase', () => {
    const { getByText } = renderScreen();
    expect(getByText('ESTATÍSTICAS')).toBeTruthy();
  });

  it('renders the muscle radar chart', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('muscle-radar-chart')).toBeTruthy();
  });

  it('renders the four stat cards with the right values', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('stat-session-count')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();

    expect(getByTestId('stat-total-duration')).toBeTruthy();
    expect(getByText('8h 20m')).toBeTruthy();

    expect(getByTestId('stat-statistics-volume')).toBeTruthy();
    expect(getByText('42.5k')).toBeTruthy();

    expect(getByTestId('stat-statistics-sets')).toBeTruthy();
    expect(getByText('186')).toBeTruthy();
  });

  it('shows a positive delta badge for session count and a negative one for volume', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('stat-session-count-delta')).toBeTruthy();
    expect(getByTestId('stat-statistics-volume-delta')).toBeTruthy();
  });

  it('formats a duration under one hour without the hours segment', () => {
    const { getByText } = renderScreen({ totalDurationMs: metric(25 * 60_000, 0) });
    expect(getByText('25m')).toBeTruthy();
  });

  it('formats zero duration as "0m"', () => {
    const { getByText } = renderScreen({ totalDurationMs: metric(0, 0) });
    expect(getByText('0m')).toBeTruthy();
  });
});
