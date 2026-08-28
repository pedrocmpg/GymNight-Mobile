/**
 * DashboardScreen Component
 *
 * Displays the user's workout dashboard with UI states for loading, empty, offline, and success.
 * Uses Design_Tokens exclusively for styling.
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether data is still loading (first emission pending)
 * - workouts: array of workout summaries to display (with rich per-workout stats)
 * - weeklyStreak: 7 booleans, index 0 = Sunday of the current week; true = trained (finished session) that day
 * - syncStatus: current sync engine state
 * - onCreateWorkout: callback invoked when the user taps the CTA to create a workout
 * - onStartSession: callback invoked with a workout's id when the user taps it to start a session
 * - onLogout: callback invoked when the user logs out
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { StatRow } from '../../designSystem/components/StatRow';
import { type SyncState } from '../../sync/SyncStatusIndicator';

export interface DashboardWorkout {
  id: string;
  name: string;
  exerciseCount: number;
  avgSessionDurationMs: number | null;
  lastTrainedDaysAgo: number | null;
}

export interface DashboardScreenProps {
  isOnline: boolean;
  isLoading: boolean;
  workouts: DashboardWorkout[];
  weeklyStreak: boolean[];
  syncStatus: SyncState;
  onCreateWorkout: () => void;
  onStartSession: (workoutId: string) => void;
  onLogout: () => void;
}

function formatAvgDuration(ms: number | null): string {
  if (ms === null) return '—';
  return `${Math.round(ms / 60000)} min`;
}

function formatLastTrained(daysAgo: number | null): string {
  if (daysAgo === null) return 'nunca';
  if (daysAgo === 0) return 'hoje';
  if (daysAgo === 1) return 'ontem';
  return `há ${daysAgo} dias`;
}

export function DashboardScreen({
  isOnline,
  isLoading,
  workouts,
  weeklyStreak,
  syncStatus,
  onCreateWorkout,
  onStartSession,
  onLogout,
}: DashboardScreenProps) {
  const hasData = workouts.length > 0;

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="dashboard-screen">
        <View style={styles.loadingContainer} testID="loading-state">
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="dashboard-screen">
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner} testID="offline-banner">
          <Text style={styles.offlineBannerText}>
            Você está offline. Dados locais disponíveis.
          </Text>
        </View>
      )}

      {/* Weekly streak strip */}
      <View style={styles.streakContainer} testID="weekly-streak">
        {weeklyStreak.map((trained, index) => (
          <View
            key={index}
            testID={`streak-day-${index}`}
            style={[styles.streakBar, trained ? styles.streakBarActive : styles.streakBarInactive]}
          />
        ))}
      </View>

      {/* Empty State */}
      {!hasData && (
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
          <TouchableOpacity
            testID="create-workout-cta"
            style={styles.ctaButton}
            onPress={onCreateWorkout}
            accessibilityLabel="Criar primeiro treino"
          >
            <Text style={styles.ctaButtonText}>Criar primeiro treino</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Success: Workout List — tapping a workout starts a session for it */}
      {hasData && (
        <ScrollView testID="workout-list">
          {workouts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.workoutCard}
              testID={`workout-item-${item.id}`}
              onPress={() => onStartSession(item.id)}
              accessibilityLabel={`Iniciar sessão de ${item.name}`}
            >
              <Text style={styles.workoutName}>{item.name}</Text>
              <View style={styles.workoutStatsRow}>
                <StatRow
                  testID={`workout-stat-exercises-${item.id}`}
                  label="no treino"
                  value={`${item.exerciseCount} exercícios`}
                />
                <StatRow
                  testID={`workout-stat-duration-${item.id}`}
                  align="center"
                  label="média"
                  value={formatAvgDuration(item.avgSessionDurationMs)}
                />
                <StatRow
                  testID={`workout-stat-last-trained-${item.id}`}
                  align="flex-end"
                  label="último treino"
                  value={formatLastTrained(item.lastTrainedDaysAgo)}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Logout */}
      <TouchableOpacity
        testID="logout-button"
        style={styles.logoutButton}
        onPress={onLogout}
        accessibilityLabel="Sair"
      >
        <Text style={styles.logoutButtonText}>Sair</Text>
      </TouchableOpacity>
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
  offlineBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  offlineBannerText: {
    color: colors.primary,
    ...typography.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.secondaryText,
    ...typography.body,
    marginBottom: spacing.md,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: colors.background,
    ...typography.body,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logoutButtonText: {
    color: colors.error,
    ...typography.body,
    fontWeight: '700',
  },
  workoutCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  workoutName: {
    color: colors.primaryText,
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakContainer: {
    flexDirection: 'row',
    gap: spacing.xs / 2,
    marginBottom: spacing.sm,
  },
  streakBar: {
    flex: 1,
    height: 8,
    borderRadius: radii.sm,
  },
  streakBarActive: {
    backgroundColor: colors.primary,
  },
  streakBarInactive: {
    backgroundColor: colors.surface,
  },
});
