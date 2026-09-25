/**
 * StatisticsScreen — Wave 7. Terceira aba do mobile (o desktop tem 4
 * destinos; radar muscular + grid 2×2 de métricas com delta período-contra-
 * período, ambos sobre os últimos 30 dias fixos.
 *
 * Porta `GymNight-Desktop/src/ui/screens/statistics.py`. Nenhuma mudança de
 * schema — puramente consumidora do catálogo muscular da Wave 6.
 *
 * Validates: PARIDADE-03-ESTATISTICAS.md
 */

import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../designSystem/tokens';
import { Card } from '../../designSystem/components/Card';
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
      <SafeAreaView style={styles.container} edges={['top']} testID="statistics-screen">
        <View style={styles.loadingContainer} testID="statistics-loading-state">
          <ActivityIndicator testID="statistics-loading-indicator" size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="statistics-screen">
      <Text style={styles.title}>ESTATÍSTICAS</Text>

      <ScrollView testID="statistics-content" contentContainerStyle={styles.scrollContent}>
        <Card style={styles.radarCard} testID="muscle-radar-card">
          <View style={styles.radarWrapper}>
            <RadarChart slices={radarSlices} testID="muscle-radar-chart" />
          </View>
        </Card>

        <View style={styles.statsGrid} testID="statistics-stats-grid">
          <View style={styles.statsCell}>
            <StatCard
              icon="calendar-check"
              title="Treinamentos"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.primaryText,
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  radarCard: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  radarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
