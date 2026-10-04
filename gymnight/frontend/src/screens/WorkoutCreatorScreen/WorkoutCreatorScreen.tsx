/**
 * WorkoutCreatorScreen Component
 *
 * Cria (ou edita) um treino: nome, e quais exercícios do catálogo entram,
 * cada um com a meta de séries/reps/peso. Uses Design_Tokens exclusively.
 *
 * Layout (REDESIGN-04):
 *   header fixo  — "‹ Voltar" · [lixeira, só no modo edição]
 *   scroll       — título, nome, busca e a lista de exercícios; tocar na
 *                  linha alterna a seleção e revela as metas
 *   rodapé fixo  — "Salvar treino", o único CTA lima da tela
 *
 * Props:
 * - isLoading: whether data is still loading (e.g., exercise catalog being fetched)
 * - exercises: array of exercises available in the catalog
 * - error: validation error message (e.g., invalid workout name) or null
 * - onSave: callback invoked with (name, exerciseInputs) when the user saves a valid workout
 * - onBack: quando presente, o header mostra o botão de voltar
 */

import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors, typography, spacing, layout } from '../../designSystem/tokens';
import { animateLayout } from '../../designSystem/motion';
import { haptic } from '../../designSystem/haptics';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { ConfirmSheet } from '../../designSystem/components/ConfirmSheet';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { IconButton } from '../../designSystem/components/IconButton';
import { Input } from '../../designSystem/components/Input';
import { ListRow } from '../../designSystem/components/ListRow';
import { LoadingState } from '../../designSystem/components/LoadingState';
import { Screen } from '../../designSystem/components/Screen';
import { ScreenHeader } from '../../designSystem/components/ScreenHeader';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
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

  const header = (
    <ScreenHeader
      onBack={onBack}
      testID="workout-creator-header"
      right={
        isEdit && onDelete && !isLoading ? (
          <IconButton
            icon="trash-alt"
            tone="danger"
            onPress={() => setShowDeleteConfirm(true)}
            testID="delete-workout-button"
            accessibilityLabel="Apagar treino"
          />
        ) : undefined
      }
    />
  );

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom']} testID="workout-creator-screen" header={header} scroll={false}>
        <LoadingState testID="loading-state" indicatorTestID="loading-indicator" />
      </Screen>
    );
  }

  // Empty catalog state
  if (exercises.length === 0) {
    return (
      <Screen edges={['top', 'bottom']} testID="workout-creator-screen" header={header} scroll={false}>
        <View style={styles.emptyContainer} testID="empty-state">
          <EmptyState
            icon="wifi"
            title="Catálogo indisponível"
            message="Catálogo de exercícios vazio. Conecte-se à rede para sincronizar."
            messageTestID="empty-message"
          />
        </View>
      </Screen>
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

  const toggle = (id: string, checked: boolean) => {
    haptic('selection');
    animateLayout();
    setState(id, { checked });
  };

  // A busca só afeta o que é EXIBIDO — a seleção/validação continua sobre o
  // catálogo inteiro, então filtrar não descarta o que já foi marcado antes.
  const entries: SelectedExerciseEntry[] = exercises.map((e) => toEntry(e.id, getState(e.id)));
  const canSave = canSaveWorkout(workoutName, entries);
  const visibleExercises = filterExercises(exercises, searchQuery);
  const selectedCount = exercises.filter((e) => getState(e.id).checked).length;

  const handleSave = () => {
    if (!canSave) return;
    onSave(workoutName, buildExerciseInputs(entries));
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      testID="workout-creator-screen"
      header={header}
      title={isEdit ? 'Editar treino' : 'Criar treino'}
      subtitle="Escolha os exercícios e defina séries, repetições e carga."
      footer={
        <Button
          testID="save-workout-button"
          label="Salvar treino"
          icon="check"
          haptic="success"
          onPress={handleSave}
          disabled={!canSave}
          accessibilityLabel="Salvar treino"
        />
      }
    >
      <View style={styles.block}>
        <Input
          testID="workout-name-input"
          label="Nome do treino"
          placeholder="Ex: Treino D — Ombro"
          value={workoutName}
          onChangeText={setWorkoutName}
          accessibilityLabel="Nome do treino"
        />
        {error && (
          <Text style={styles.errorText} testID="error-message">
            {error}
          </Text>
        )}
      </View>

      <View style={styles.block}>
        <SectionTitle meta={`${selectedCount} selecionados`}>Exercícios</SectionTitle>

        {/* Busca (Wave 8): 200 exercícios no catálogo tornam rolar a lista inteira inviável. */}
        <Input
          testID="exercise-search-input"
          placeholder="Buscar exercício…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Buscar exercício"
        />

        {visibleExercises.length === 0 ? (
          <Text style={styles.noResultsText} testID="exercise-search-no-results">
            Nenhum exercício encontrado.
          </Text>
        ) : (
          <Card padding="none" testID="exercise-selection-list">
            {visibleExercises.map((exercise, index) => {
              const state = getState(exercise.id);
              return (
                <ListRow
                  key={exercise.id}
                  testID={`exercise-row-${exercise.id}`}
                  title={exercise.name}
                  divider={index < visibleExercises.length - 1}
                  onPress={() => toggle(exercise.id, !state.checked)}
                  accessibilityLabel={`${state.checked ? 'Remover' : 'Adicionar'} ${exercise.name}`}
                  trailing={
                    <Switch
                      testID={`exercise-toggle-${exercise.id}`}
                      value={state.checked}
                      onValueChange={(checked) => toggle(exercise.id, checked)}
                      trackColor={{ true: colors.primary, false: colors.cardAlt }}
                      thumbColor={colors.primaryText}
                      ios_backgroundColor={colors.cardAlt}
                      style={styles.switch}
                      accessibilityLabel={`Selecionar ${exercise.name}`}
                    />
                  }
                >
                  {state.checked ? (
                    <View style={styles.targetsRow}>
                      <View style={styles.targetInput}>
                        <Input
                          testID={`series-input-${exercise.id}`}
                          label="Séries"
                          placeholder="3"
                          value={state.seriesTarget}
                          onChangeText={(v) => setState(exercise.id, { seriesTarget: v })}
                          keyboardType="numeric"
                          accessibilityLabel={`Séries para ${exercise.name}`}
                        />
                      </View>
                      <View style={styles.targetInput}>
                        <Input
                          testID={`reps-input-${exercise.id}`}
                          label="Reps"
                          placeholder="10"
                          value={state.repsTarget}
                          onChangeText={(v) => setState(exercise.id, { repsTarget: v })}
                          keyboardType="numeric"
                          accessibilityLabel={`Repetições para ${exercise.name}`}
                        />
                      </View>
                      <View style={styles.targetInput}>
                        <Input
                          testID={`weight-input-${exercise.id}`}
                          label="Peso (kg)"
                          placeholder="0"
                          value={state.weightTarget}
                          onChangeText={(v) => setState(exercise.id, { weightTarget: v })}
                          keyboardType="numeric"
                          accessibilityLabel={`Peso para ${exercise.name}`}
                        />
                      </View>
                    </View>
                  ) : undefined}
                </ListRow>
              );
            })}
          </Card>
        )}
      </View>

      <ConfirmSheet
        visible={showDeleteConfirm}
        testID="delete-confirm"
        tone="danger"
        title="Apagar este treino?"
        message="O histórico de sessões e séries não é afetado."
        confirmLabel="Apagar treino"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete?.();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  block: {
    gap: layout.blockGap,
  },
  errorText: {
    ...typography.footnote,
    color: colors.error,
  },
  noResultsText: {
    ...typography.footnote,
    color: colors.tertiaryText,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  switch: {
    marginRight: spacing.sm,
  },
  targetsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  targetInput: {
    flex: 1,
  },
});
