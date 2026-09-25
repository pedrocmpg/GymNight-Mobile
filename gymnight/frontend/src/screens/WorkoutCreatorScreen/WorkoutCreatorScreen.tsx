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
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { ScreenHeader } from '../../designSystem/components/ScreenHeader';
import { Input } from '../../designSystem/components/Input';
import { Card } from '../../designSystem/components/Card';
import { Button } from '../../designSystem/components/Button';
import { buildExerciseInputs, canSaveWorkout, type SelectedExerciseEntry } from './workoutCreatorSelection';
import type { ExerciseInput } from './saveWorkoutWithExercises';
import { filterExercises } from './exerciseSearch';

export interface WorkoutCreatorExercise {
  id: string;
  name: string;
}

export interface WorkoutCreatorInitialData {
  name: string;
  exercises: ExerciseInput[];
}

export interface WorkoutCreatorScreenProps {
  isLoading: boolean;
  exercises: WorkoutCreatorExercise[];
  error: string | null;
  onSave: (name: string, exercises: ExerciseInput[]) => void;
  onBack?: () => void;
  /**
   * 'edit' pré-preenche nome/seleção a partir de `initialWorkout` e mostra
   * "Apagar treino" — MESMA tela do create, generalizada por estado inicial
   * (PARIDADE-04-ROTINAS-PERFIL.md §1.2: nunca duas telas com a mesma
   * validação divergindo no primeiro ajuste feito só de um lado). Default 'create'.
   */
  mode?: 'create' | 'edit';
  /** Só relevante em modo 'edit'. Lido apenas no mount (useState lazy init). */
  initialWorkout?: WorkoutCreatorInitialData;
  /** Presente em modo 'edit' com onDelete definido = mostra o botão de apagar. */
  onDelete?: () => void;
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
  mode = 'create',
  initialWorkout,
  onDelete,
}: WorkoutCreatorScreenProps) {
  const [workoutName, setWorkoutName] = useState(() => initialWorkout?.name ?? '');
  const [selection, setSelection] = useState<Record<string, SelectionState>>(() => {
    const initial: Record<string, SelectionState> = {};
    for (const ex of initialWorkout?.exercises ?? []) {
      initial[ex.exerciseId] = {
        checked: true,
        seriesTarget: String(ex.seriesTarget),
        repsTarget: String(ex.repsTarget),
        weightTarget: String(ex.weightTarget),
      };
    }
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = mode === 'edit';

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

  // A busca só afeta o que é EXIBIDO — a seleção/validação continua sobre o
  // catálogo inteiro, então filtrar não descarta o que já foi marcado antes.
  const entries: SelectedExerciseEntry[] = exercises.map((e) => toEntry(e.id, getState(e.id)));
  const canSave = canSaveWorkout(workoutName, entries);
  const visibleExercises = filterExercises(exercises, searchQuery);

  const handleSave = () => {
    if (!canSave) return;
    onSave(workoutName, buildExerciseInputs(entries));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="workout-creator-screen">
      <ScreenHeader onBack={onBack} testID="workout-creator-header" />

      <Text style={styles.title}>{isEdit ? 'EDITAR TREINO' : 'CRIAR TREINO'}</Text>
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

      {/* Busca (Wave 8): 200 exercícios no catálogo tornam rolar a lista inteira inviável. */}
      <Input
        testID="exercise-search-input"
        placeholder="Buscar exercício..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        accessibilityLabel="Buscar exercício"
      />

      {/* Exercise selection list */}
      <ScrollView style={styles.exerciseList} testID="exercise-selection-list">
        {visibleExercises.length === 0 && (
          <Text style={styles.noResultsText} testID="exercise-search-no-results">
            Nenhum exercício encontrado.
          </Text>
        )}
        {visibleExercises.map((exercise) => {
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

      {isEdit && onDelete && (
        <Button
          testID="delete-workout-button"
          label="Apagar Treino"
          variant="danger"
          onPress={() => setShowDeleteConfirm(true)}
          accessibilityLabel="Apagar treino"
          style={styles.deleteButton}
        />
      )}

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
        testID="delete-confirm-modal"
      >
        <View style={styles.overlay}>
          <View style={styles.confirmCard} testID="delete-confirm-card">
            <FontAwesome5 name="trash-alt" size={48} color={colors.error} solid />
            <Text style={styles.confirmText}>
              Apagar este treino? O histórico de sessões e séries não é afetado.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                label="Não"
                variant="ghost"
                onPress={() => setShowDeleteConfirm(false)}
                style={styles.confirmButton}
                testID="delete-confirm-no"
              />
              <Button
                label="Sim, apagar"
                variant="danger"
                onPress={() => {
                  setShowDeleteConfirm(false);
                  onDelete?.();
                }}
                style={styles.confirmButton}
                testID="delete-confirm-yes"
              />
            </View>
          </View>
        </View>
      </Modal>
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
  noResultsText: {
    color: colors.secondaryText,
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.lg,
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
  deleteButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  // --- Overlay de confirmação (mesmo padrão de ActiveSessionScreen) ---
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  confirmText: {
    color: colors.primaryText,
    ...typography.h3,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  confirmButton: {
    flex: 1,
  },
});
