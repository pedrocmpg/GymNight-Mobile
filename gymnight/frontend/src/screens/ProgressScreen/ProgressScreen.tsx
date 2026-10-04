/**
 * ProgressScreen Component
 *
 * Evolução por exercício: seletor de exercício em chips, o 1RM estimado como
 * número protagonista com o gráfico logo abaixo, um banner de recorde quando
 * aplicável e as sessões recentes. Uses Design_Tokens exclusively.
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
import { colors, typography, spacing, layout } from '../../designSystem/tokens';
import { Banner } from '../../designSystem/components/Banner';
import { Card } from '../../designSystem/components/Card';
import { Chip } from '../../designSystem/components/Chip';
import { DeltaBadge } from '../../designSystem/components/DeltaBadge';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { ListRow } from '../../designSystem/components/ListRow';
import { LoadingState } from '../../designSystem/components/LoadingState';
import { Screen } from '../../designSystem/components/Screen';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
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
      <Screen edges={['top']} testID="progress-screen" scroll={false}>
        <LoadingState
          testID="progress-loading-state"
          indicatorTestID="progress-loading-indicator"
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top']}
      testID="progress-screen"
      scrollTestID="progress-content"
      title="Progresso"
      subtitle="Evolução do 1RM estimado por exercício"
    >
      {exercises.length > 0 && (
        <ScrollView
          horizontal
          testID="exercise-selector"
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          showsHorizontalScrollIndicator={false}
        >
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

      {uiState.showEmptyState && (
        <EmptyState
          testID="progress-empty-state"
          icon="chart-line"
          message={
            exercises.length === 0
              ? 'Nenhum exercício registrado ainda.'
              : 'Sem dados de 1RM para este exercício ainda.'
          }
        />
      )}

      {(uiState.showChart || uiState.showPrBanner) && (
        <View style={styles.block}>
          {uiState.showPrBanner && (
            <Banner variant="success" message="Novo recorde pessoal!" testID="pr-banner" />
          )}

          {uiState.showChart && (
            <Card testID="one-rm-card" style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={styles.chartHeading}>
                  <Text style={styles.chartLabel}>1RM estimado</Text>
                  <Text style={styles.chartValue} testID="one-rm-value">
                    {latestOneRm?.toFixed(1)} kg
                  </Text>
                </View>
                {delta !== null && <DeltaBadge value={delta} format="kg" testID="one-rm-delta" />}
              </View>
              <OneRmChart series={oneRmSeries} testID="one-rm-chart" />
            </Card>
          )}
        </View>
      )}

      {uiState.showSessionsList && (
        <View style={styles.block} testID="sessions-list">
          <SectionTitle>Sessões recentes</SectionTitle>
          <Card padding="none">
            {sessions.map((session, index) => (
              <ListRow
                key={session.id}
                testID={`session-item-${session.id}`}
                title={session.workoutName ?? 'Treino livre'}
                subtitle={`${formatRelativeDate(session.startedAt)} · ${formatDuration(session.durationMs)}`}
                value={`${session.totalVolume.toLocaleString('pt-BR')} kg`}
                divider={index < sessions.length - 1}
              />
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Os chips sangram até a borda da tela e ficam colados ao título.
  chipRow: {
    marginHorizontal: -layout.gutter,
    marginTop: -spacing.md,
    flexGrow: 0,
  },
  chipRowContent: {
    paddingHorizontal: layout.gutter,
    gap: spacing.xs,
  },
  block: {
    gap: layout.blockGap,
  },
  chartCard: {
    gap: spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartHeading: {
    gap: spacing.xxs,
  },
  chartLabel: {
    ...typography.caption,
    color: colors.secondaryText,
  },
  chartValue: {
    ...typography.metricXL,
    color: colors.primaryText,
  },
});
