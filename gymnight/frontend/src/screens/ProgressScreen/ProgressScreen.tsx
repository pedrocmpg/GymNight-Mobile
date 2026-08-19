/**
 * ProgressScreen Component
 *
 * Displays exercise progress: a selectable exercise chip row, a 1RM evolution
 * chart for the selected exercise, a "new personal record" banner when
 * applicable, and a list of recent sessions. Uses Design_Tokens exclusively.
 *
 * Props:
 * - isLoading: whether data is still loading (first emission pending)
 * - exercises: catalog of exercises to pick from
 * - selectedExerciseId: id of the currently selected exercise, or null
 * - oneRmSeries: 1RM evolution series for the selected exercise
 * - isNewPersonalRecord: whether the latest point is a new PR
 * - sessions: recent session summaries
 * - onSelectExercise: callback invoked when the user taps an exercise chip
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { Card } from '../../designSystem/components/Card';
import { Chip } from '../../designSystem/components/Chip';
import { StatRow } from '../../designSystem/components/StatRow';
import { OneRmChart } from './OneRmChart';
import { computeProgressUIState } from './computeProgressUIState';
import type { ChartPoint } from './computeChartGeometry';

export interface ProgressScreenExercise {
  id: string;
  name: string;
}

export interface ProgressScreenSession {
  id: string;
  workoutName: string | null;
  startedAt: number;
  durationMs: number | null;
  totalVolume: number;
}

export interface ProgressScreenProps {
  isLoading: boolean;
  exercises: ProgressScreenExercise[];
  selectedExerciseId: string | null;
  oneRmSeries: ChartPoint[];
  isNewPersonalRecord: boolean;
  sessions: ProgressScreenSession[];
  onSelectExercise: (exerciseId: string) => void;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return 'em andamento';
  const minutes = Math.round(durationMs / 60000);
  return `${minutes} min`;
}

function formatRelativeDate(startedAt: number): string {
  const days = Math.floor((Date.now() - startedAt) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return `há ${days} dias`;
}

export function ProgressScreen({
  isLoading,
  exercises,
  selectedExerciseId,
  oneRmSeries,
  isNewPersonalRecord,
  sessions,
  onSelectExercise,
}: ProgressScreenProps) {
  const uiState = computeProgressUIState({
    isLoading,
    hasSelectedExercise: selectedExerciseId !== null,
    hasOneRmData: oneRmSeries.length > 0,
    isNewPersonalRecord,
    hasSessions: sessions.length > 0,
  });

  const latestOneRm = oneRmSeries.length > 0 ? oneRmSeries[oneRmSeries.length - 1].value : null;
  const previousOneRm = oneRmSeries.length > 1 ? oneRmSeries[oneRmSeries.length - 2].value : null;
  const delta = latestOneRm !== null && previousOneRm !== null ? latestOneRm - previousOneRm : null;

  if (uiState.showLoading) {
    return (
      <View style={styles.container} testID="progress-screen">
        <View style={styles.loadingContainer} testID="progress-loading-state">
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="progress-screen">
      <Text style={styles.title}>Progresso</Text>

      {exercises.length > 0 && (
        <ScrollView horizontal testID="exercise-selector" style={styles.chipRow} showsHorizontalScrollIndicator={false}>
          {exercises.map((exercise) => (
            <Chip
              key={exercise.id}
              testID={`progress-exercise-option-${exercise.id}`}
              label={exercise.name}
              selected={exercise.id === selectedExerciseId}
              onPress={() => onSelectExercise(exercise.id)}
            />
          ))}
        </ScrollView>
      )}

      <ScrollView testID="progress-content">
        {uiState.showEmptyState && (
          <View style={styles.emptyContainer} testID="progress-empty-state">
            <Text style={styles.emptyText}>
              {exercises.length === 0
                ? 'Nenhum exercício registrado ainda.'
                : 'Sem dados de 1RM para este exercício ainda.'}
            </Text>
          </View>
        )}

        {uiState.showChart && (
          <Card testID="one-rm-card" style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartLabel}>1RM estimado</Text>
                <Text style={styles.chartValue} testID="one-rm-value">
                  {latestOneRm?.toFixed(1)} kg
                </Text>
              </View>
              {delta !== null && (
                <View style={[styles.deltaBadge, delta >= 0 ? styles.deltaPositive : styles.deltaNegative]}>
                  <Text style={[styles.deltaText, { color: delta >= 0 ? colors.success : colors.error }]}>
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)} kg
                  </Text>
                </View>
              )}
            </View>
            <OneRmChart series={oneRmSeries} testID="one-rm-chart" />
          </Card>
        )}

        {uiState.showPrBanner && (
          <View style={styles.prBanner} testID="pr-banner">
            <Text style={styles.prBannerText}>Novo recorde pessoal!</Text>
          </View>
        )}

        {uiState.showSessionsList && (
          <View style={styles.sessionsSection} testID="sessions-list">
            <Text style={styles.sessionsTitle}>Sessões recentes</Text>
            {sessions.map((session) => (
              <Card key={session.id} testID={`session-item-${session.id}`} style={styles.sessionCard}>
                <View style={styles.sessionRow}>
                  <View>
                    <Text style={styles.sessionName}>{session.workoutName ?? 'Treino livre'}</Text>
                    <Text style={styles.sessionDate}>
                      {formatRelativeDate(session.startedAt)} · {formatDuration(session.durationMs)}
                    </Text>
                  </View>
                  <StatRow
                    align="flex-end"
                    label="volume"
                    value={`${session.totalVolume.toLocaleString('pt-BR')} kg`}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
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
  loadingText: {
    color: colors.secondaryText,
    ...typography.body,
  },
  title: {
    color: colors.primaryText,
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  chipRow: {
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.secondaryText,
    ...typography.body,
    textAlign: 'center',
  },
  chartCard: {
    marginBottom: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  chartLabel: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  chartValue: {
    color: colors.primaryText,
    ...typography.metric,
  },
  deltaBadge: {
    borderRadius: radii.lg,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
  },
  deltaPositive: {
    backgroundColor: colors.successTint,
  },
  deltaNegative: {
    backgroundColor: colors.errorTint,
  },
  deltaText: {
    ...typography.captionBold,
  },
  prBanner: {
    backgroundColor: colors.primaryTint,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  prBannerText: {
    color: colors.primary,
    ...typography.bodyBold,
  },
  sessionsSection: {
    gap: spacing.xs,
  },
  sessionsTitle: {
    color: colors.primaryText,
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  sessionCard: {
    marginBottom: spacing.xs,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionName: {
    color: colors.primaryText,
    ...typography.bodyBold,
  },
  sessionDate: {
    color: colors.secondaryText,
    ...typography.caption,
  },
});
