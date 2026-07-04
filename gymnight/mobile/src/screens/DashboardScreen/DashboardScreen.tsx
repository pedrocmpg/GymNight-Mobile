/**
 * DashboardScreen Component
 *
 * Displays the user's workout dashboard with UI states for loading, empty, offline, and success.
 * Uses Design_Tokens exclusively for styling.
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether data is still loading (first emission pending)
 * - workouts: array of workout summaries to display
 * - syncStatus: current sync engine state
 * - onCreateWorkout: callback invoked when the user taps the CTA to create a workout
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
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { type SyncState } from '../../sync/SyncStatusIndicator';

export interface DashboardWorkout {
  id: string;
  name: string;
}

export interface DashboardScreenProps {
  isOnline: boolean;
  isLoading: boolean;
  workouts: DashboardWorkout[];
  syncStatus: SyncState;
  onCreateWorkout: () => void;
}

export function DashboardScreen({
  isOnline,
  isLoading,
  workouts,
  syncStatus,
  onCreateWorkout,
}: DashboardScreenProps) {
  const hasData = workouts.length > 0;

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <View style={styles.container} testID="dashboard-screen">
        <View style={styles.loadingContainer} testID="loading-state">
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="dashboard-screen">
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner} testID="offline-banner">
          <Text style={styles.offlineBannerText}>
            Você está offline. Dados locais disponíveis.
          </Text>
        </View>
      )}

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

      {/* Success: Workout List */}
      {hasData && (
        <ScrollView testID="workout-list">
          {workouts.map((item) => (
            <View
              key={item.id}
              style={styles.workoutCard}
              testID={`workout-item-${item.id}`}
            >
              <Text style={styles.workoutName}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}
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
  workoutCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  workoutName: {
    color: colors.primaryText,
    ...typography.body,
  },
});
