import React from 'react';
import { StatisticsScreen } from '../../screens/StatisticsScreen/StatisticsScreen';
import { useObserveStatistics } from '../../hooks/useObserveStatistics';
import database from '../../db/database';
import { createStatisticsDatabaseProvider } from '../watermelonProviders';

export interface StatisticsScreenContainerProps {
  userId: string;
}

/**
 * Supplies StatisticsScreen's props from live sources: radar/grid via
 * useObserveStatistics keyed by userId. Nenhum estado de UI local — a tela
 * não tem seleção nem filtro, diferente da Progress_Screen.
 */
export function StatisticsScreenContainer(props: StatisticsScreenContainerProps) {
  const provider = React.useMemo(() => createStatisticsDatabaseProvider(database), []);
  const { radarSlices, sessionCount, totalDurationMs, totalVolume, totalSets, isLoading } =
    useObserveStatistics(props.userId, provider);

  return (
    <StatisticsScreen
      isLoading={isLoading}
      radarSlices={radarSlices}
      sessionCount={sessionCount}
      totalDurationMs={totalDurationMs}
      totalVolume={totalVolume}
      totalSets={totalSets}
    />
  );
}
