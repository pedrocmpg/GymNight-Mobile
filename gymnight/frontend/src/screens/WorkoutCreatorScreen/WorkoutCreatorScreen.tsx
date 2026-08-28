/**
 * WorkoutCreatorScreen Component
 *
 * Displays the workout creation form with UI states for loading, empty catalog, and error.
 * Lets the user pick which catalog exercises go into the workout and set a
 * series/reps/weight target for each selected exercise.
 * Uses Design_Tokens exclusively for styling.
 *
 * Props:
 * - isLoading: whether data is still loading (e.g., exercise catalog being fetched)
 * - exercises: array of exercises available in the catalog
 * - error: validation error message (e.g., invalid workout name) or null
 * - onSave: callback invoked with (name, exerciseInputs) when the user saves a valid workout
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { buildExerciseInputs, canSaveWorkout, type SelectedExerciseEntry } from './workoutCreatorSelection';
import type { ExerciseInput } from './saveWorkoutWithExercises';

export interface WorkoutCreatorExercise {
  id: string;
  name: string;
}

export interface WorkoutCreatorScreenProps {
  isLoading: boolean;
  exercises: WorkoutCreatorExercise[];
  error: string | null;
  onSave: (name: string, exercises: ExerciseInput[]) => void;
}

interface SelectionState {
  checked: boolean;
  seriesTarget: string;
  repsTarget: string;
  weightTarget: string;
}

function toEntry(exerciseId: string, state: SelectionState): SelectedExerciseEntry {
  return {
    exerciseId,
    seriesTarget: state.checked ? parseFloat(state.seriesTarget) : undefined,
    repsTarget: state.checked ? parseFloat(state.repsTarget) : undefined,
    weightTarget: state.checked ? parseFloat(state.weightTarget) : undefined,
  };
}

export function WorkoutCreatorScreen({
  isLoading,
  exercises,
  error,
  onSave,
}: WorkoutCreatorScreenProps) {
  const [workoutName, setWorkoutName] = useState('');
  const [selection, setSelection] = useState<Record<string, SelectionState>>({});

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="workout-creator-screen">
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

  // Empty catalog state
  if (exercises.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="workout-creator-screen">
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText} testID="empty-message">
            Catálogo de exercícios vazio. Conecte-se à rede para sincronizar.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getState = (id: string): SelectionState =>
    selection[id] ?? { checked: false, seriesTarget: '', repsTarget: '', weightTarget: '' };

  const setState = (id: string, patch: Partial<SelectionState>) => {
    setSelection((prev) => ({
      ...prev,
      [id]: { ...getState(id), ...patch },
    }));
  };

  const entries: SelectedExerciseEntry[] = exercises.map((e) => toEntry(e.id, getState(e.id)));
  const canSave = canSaveWorkout(workoutName, entries);

  const handleSave = () => {
    if (!canSave) return;
    onSave(workoutName, buildExerciseInputs(entries));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="workout-creator-screen">
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

      {/* Exercise selection list */}
      <ScrollView style={styles.exerciseList} testID="exercise-selection-list">
        {exercises.map((exercise) => {
          const state = getState(exercise.id);
          return (
            <View key={exercise.id} style={styles.exerciseRow} testID={`exercise-row-${exercise.id}`}>
              <View style={styles.exerciseRowHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Switch
                  testID={`exercise-toggle-${exercise.id}`}
                  value={state.checked}
                  onValueChange={(checked) => setState(exercise.id, { checked })}
                  accessibilityLabel={`Selecionar ${exercise.name}`}
                />
              </View>
              {state.checked && (
                <View style={styles.targetsRow}>
                  <TextInput
                    testID={`series-input-${exercise.id}`}
                    style={styles.targetInput}
                    placeholder="Séries"
                    placeholderTextColor={colors.secondaryText}
                    value={state.seriesTarget}
                    onChangeText={(v) => setState(exercise.id, { seriesTarget: v })}
                    keyboardType="numeric"
                    accessibilityLabel={`Séries para ${exercise.name}`}
                  />
                  <TextInput
                    testID={`reps-input-${exercise.id}`}
                    style={styles.targetInput}
                    placeholder="Reps"
                    placeholderTextColor={colors.secondaryText}
                    value={state.repsTarget}
                    onChangeText={(v) => setState(exercise.id, { repsTarget: v })}
                    keyboardType="numeric"
                    accessibilityLabel={`Repetições para ${exercise.name}`}
                  />
                  <TextInput
                    testID={`weight-input-${exercise.id}`}
                    style={styles.targetInput}
                    placeholder="Peso (kg)"
                    placeholderTextColor={colors.secondaryText}
                    value={state.weightTarget}
                    onChangeText={(v) => setState(exercise.id, { weightTarget: v })}
                    keyboardType="numeric"
                    accessibilityLabel={`Peso para ${exercise.name}`}
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Save Button */}
      <TouchableOpacity
        testID="save-workout-button"
        style={[styles.saveButton, !canSave ? styles.saveButtonDisabled : null]}
        onPress={handleSave}
        disabled={!canSave}
        accessibilityLabel="Salvar treino"
      >
        <Text style={styles.saveButtonText}>Salvar</Text>
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
  exerciseList: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  exerciseRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  exerciseRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    color: colors.primaryText,
    ...typography.body,
  },
  targetsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  targetInput: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.primaryText,
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginRight: spacing.xs,
    ...typography.body,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.surface,
  },
  saveButtonText: {
    color: colors.background,
    ...typography.body,
    fontWeight: '700',
  },
});
