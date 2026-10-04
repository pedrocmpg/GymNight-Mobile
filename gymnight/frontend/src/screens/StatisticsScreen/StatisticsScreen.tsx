/**
 * StatisticsScreen — Wave 7. Terceira aba do mobile: radar muscular + grade
 * 2×2 de métricas com delta período-contra-período, ambos sobre os últimos
 * 30 dias fixos.
 *
 * Porta `GymNight-Desktop/src/ui/screens/statistics.py`. Nenhuma mudança de
 * schema — puramente consumidora do catálogo muscular da Wave 6.
 *
 * Validates: PARIDADE-03-ESTATISTICAS.md
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { layout, spacing } from '../../designSystem/tokens';
import { Card } from '../../designSystem/components/Card';
import { LoadingState } from '../../designSystem/components/LoadingState';
import { Screen } from '../../designSystem/components/Screen';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
import { StatCard } from '../../designSystem/components/StatCard';
import { formatVolume } from '../../hooks/historyDomainUtils';
import { RadarChart } from './RadarChart';
import type { RadarSlice } from './computeRadarGeometry';

export interface StatisticsScreenMetric {
  value: number;
  deltaPct: number;
}

export interface StatisticsScreenProps {
  isLoading: boolean;
  radarSlices: RadarSlice[];
  sessionCount: StatisticsScreenMetric;
  totalDurationMs: StatisticsScreenMetric;
  totalVolume: StatisticsScreenMetric;
  totalSets: StatisticsScreenMetric;
}

/** "8h 20m" — arredonda para o minuto, sem exibir segundos. */
function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function StatisticsScreen({
  isLoading,
  radarSlices,
  sessionCount,
  totalDurationMs,
  totalVolume,
  totalSets,
}: StatisticsScreenProps) {
  if (isLoading) {
    return (
      <Screen edges={['top']} testID="statistics-screen" scroll={false}>
        <LoadingState
          testID="statistics-loading-state"
          indicatorTestID="statistics-loading-indicator"
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top']}
      testID="statistics-screen"
      scrollTestID="statistics-content"
      title="Estatísticas"
      subtitle="Últimos 30 dias, comparados aos 30 anteriores"
    >
      <View style={styles.block}>
        <SectionTitle>Distribuição muscular</SectionTitle>
        <Card padding="lg" style={styles.radarCard} testID="muscle-radar-card">
          <RadarChart slices={radarSlices} testID="muscle-radar-chart" />
        </Card>
      </View>

      <View style={styles.block}>
        <SectionTitle>Resumo</SectionTitle>
        <View style={styles.statsGrid} testID="statistics-stats-grid">
          <View style={styles.statsCell}>
            <StatCard
              icon="calendar-check"
              title="Treinos"
              value={String(sessionCount.value)}
              deltaPct={sessionCount.deltaPct}
              testID="stat-session-count"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="clock"
              title="Duração"
              value={formatDuration(totalDurationMs.value)}
              deltaPct={totalDurationMs.deltaPct}
              testID="stat-total-duration"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="weight-hanging"
              title="Volume"
              value={formatVolume(totalVolume.value)}
              unit="kg"
              deltaPct={totalVolume.deltaPct}
              testID="stat-statistics-volume"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="layer-group"
              title="Séries"
              value={String(totalSets.value)}
              deltaPct={totalSets.deltaPct}
              testID="stat-statistics-sets"
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: layout.blockGap,
  },
  radarCard: {
    alignItems: 'center',
  },
  // `flexBasis: '48%'` com `flexWrap` produz a grade 2×2 sem medir a tela.
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statsCell: {
    flexGrow: 1,
    flexBasis: '48%',
  },
});
