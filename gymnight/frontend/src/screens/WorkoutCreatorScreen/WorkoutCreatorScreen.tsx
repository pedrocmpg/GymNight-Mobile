/**
 * WorkoutCreatorScreen Component
 *
 * Displays the workout creation form with UI states for loading, empty catalog, and error.
 * Lets the user pick which catalog exercises go into the workout and set a
 * series/reps/weight target for each selected exercise.
 * Uses Design_Tokens exclusively for styling.
 *
 * Porta `workouts.py` `_build_create_page` (REDESIGN-03-TELAS.md §5.1).
 *
 * Props:
 * - isLoading: whether data is still loading (e.g., exercise catalog being fetched)
 * - exercises: array of exercises available in the catalog
 * - error: validation error message (e.g., invalid workout name) or null
 * - onSave: callback invoked with (name, exerciseInputs) when the user saves a valid workout
 * - onBack: quando presente, mostra o ScreenHeader com botão de voltar — antes desta wave
 *   a única forma de sair da tela era salvando (headerShown: false no stack raiz).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { ScreenHeader } from '../../designSystem/components/ScreenHeader';
import { Input } from '../../designSystem/components/Input';
import { Card } from '../../designSystem/components/Card';
import { Button } from '../../designSystem/components/Button';
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
  onBack?: () => void;
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
  onBack,
}: WorkoutCreatorScreenProps) {
  const [workoutName, setWorkoutName] = useState('');
  const [selection, setSelection] = useState<Record<string, SelectionState>>({});

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="workout-creator-screen">
        <ScreenHeader onBack={onBack} testID="workout-creator-header" />
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
        <ScreenHeader onBack={onBack} testID="workout-creator-header" />
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
      <ScreenHeader onBack={onBack} testID="workout-creator-header" />

      <Text style={styles.title}>CRIAR TREINO</Text>
      <Text style={styles.subtitle}>
        Monte seu treino personalizado com exercícios, séries e repetições.
      </Text>

      {/* Workout Name Input */}
      <Input
        testID="workout-name-input"
        label="Nome do treino"
        placeholder="Ex: Treino D — Ombro"
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
            <Card
              key={exercise.id}
              bordered={false}
              style={styles.exerciseRow}
              testID={`exercise-row-${exercise.id}`}
            >
              <View style={styles.exerciseRowHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Switch
                  testID={`exercise-toggle-${exercise.id}`}
                  value={state.checked}
                  onValueChange={(checked) => setState(exercise.id, { checked })}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.primaryText}
                  accessibilityLabel={`Selecionar ${exercise.name}`}
                />
              </View>
              {state.checked && (
                <View style={styles.targetsBlock}>
                  <View style={styles.targetsHeaderRow}>
                    <Text style={styles.targetsColumnLabel}>Séries</Text>
                    <Text style={styles.targetsColumnLabel}>Reps</Text>
                    <Text style={styles.targetsColumnLabel}>Peso (kg)</Text>
                  </View>
                  <View style={styles.targetsRow}>
                    <View style={styles.targetInputWrapper}>
                      <Input
                        testID={`series-input-${exercise.id}`}
                        value={state.seriesTarget}
                        onChangeText={(v) => setState(exercise.id, { seriesTarget: v })}
                        keyboardType="numeric"
                        accessibilityLabel={`Séries para ${exercise.name}`}
                      />
                    </View>
                    <View style={styles.targetInputWrapper}>
                      <Input
                        testID={`reps-input-${exercise.id}`}
                        value={state.repsTarget}
                        onChangeText={(v) => setState(exercise.id, { repsTarget: v })}
                        keyboardType="numeric"
                        accessibilityLabel={`Repetições para ${exercise.name}`}
                      />
                    </View>
                    <View style={styles.targetInputWrapper}>
                      <Input
                        testID={`weight-input-${exercise.id}`}
                        value={state.weightTarget}
                        onChangeText={(v) => setState(exercise.id, { weightTarget: v })}
                        keyboardType="numeric"
                        accessibilityLabel={`Peso para ${exercise.name}`}
                      />
                    </View>
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>

      {/* Save Button */}
      <Button
        testID="save-workout-button"
        label="Salvar"
        onPress={handleSave}
        disabled={!canSave}
        accessibilityLabel="Salvar treino"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
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
  title: {
    ...typography.h2,
    color: colors.primaryText,
  },
  subtitle: {
    ...typography.sub,
    color: colors.secondaryText,
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  exerciseList: {
    flex: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  exerciseRow: {
    backgroundColor: colors.cardAlt,
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
  targetsBlock: {
    marginTop: spacing.sm,
  },
  targetsHeaderRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  targetsColumnLabel: {
    flex: 1,
    ...typography.captionBold,
    color: colors.secondaryText,
  },
  targetsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  targetInputWrapper: {
    flex: 1,
  },
});
