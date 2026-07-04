/**
 * WorkoutCreatorScreen Component
 *
 * Displays the workout creation form with UI states for loading, empty catalog, and error.
 * Uses Design_Tokens exclusively for styling.
 *
 * Props:
 * - isLoading: whether data is still loading (e.g., exercise catalog being fetched)
 * - exercises: array of exercises available in the catalog
 * - error: validation error message (e.g., invalid workout name) or null
 * - onSave: callback invoked with (name, exercises) when the user saves a valid workout
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';

export interface WorkoutCreatorExercise {
  id: string;
  name: string;
}

export interface WorkoutCreatorScreenProps {
  isLoading: boolean;
  exercises: WorkoutCreatorExercise[];
  error: string | null;
  onSave: (name: string, exercises: WorkoutCreatorExercise[]) => void;
}

export function WorkoutCreatorScreen({
  isLoading,
  exercises,
  error,
  onSave,
}: WorkoutCreatorScreenProps) {
  const [workoutName, setWorkoutName] = useState('');

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <View style={styles.container} testID="workout-creator-screen">
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

  // Empty catalog state
  if (exercises.length === 0) {
    return (
      <View style={styles.container} testID="workout-creator-screen">
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText} testID="empty-message">
            Catálogo de exercícios vazio. Conecte-se à rede para sincronizar.
          </Text>
        </View>
      </View>
    );
  }

  const handleSave = () => {
    onSave(workoutName, exercises);
  };

  return (
    <View style={styles.container} testID="workout-creator-screen">
      {/* Workout Name Input */}
      <TextInput
        testID="workout-name-input"
        style={styles.nameInput}
        placeholder="Nome do treino"
        placeholderTextColor={colors.secondaryText}
        value={workoutName}
        onChangeText={setWorkoutName}
        accessibilityLabel="Nome do treino"
      />

      {/* Error message */}
      {error && (
        <Text style={styles.errorText} testID="error-message">
          {error}
        </Text>
      )}

      {/* Save Button */}
      <TouchableOpacity
        testID="save-workout-button"
        style={styles.saveButton}
        onPress={handleSave}
        accessibilityLabel="Salvar treino"
      >
        <Text style={styles.saveButtonText}>Salvar</Text>
      </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.secondaryText,
    ...typography.body,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: colors.surface,
    color: colors.primaryText,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...typography.body,
  },
  errorText: {
    color: colors.error,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.background,
    ...typography.body,
    fontWeight: '700',
  },
});
