/**
 * WorkoutCreatorScreen Component
 *
 * Cria (ou edita) um treino: nome, e quais exercícios do catálogo entram,
 * cada um com a meta de séries/reps/peso. Uses Design_Tokens exclusively.
 *
 * Layout (REDESIGN-04 + catálogo de 500):
 *   header fixo  — "‹ Voltar" · [lixeira, só no modo edição]
 *   lista        — título, nome, busca e filtros como cabeçalho de uma
 *                  FlatList (500 exercícios não cabem num ScrollView); cada
 *                  linha tem a miniatura do exercício — JPG estática, que
 *                  vira a animação quando o exercício entra no treino.
 *                  Tocar na linha alterna a seleção e revela as metas; tocar
 *                  na miniatura abre o ExerciseDetailSheet
 *   rodapé fixo  — "Salvar treino", o único CTA lima da tela
 *
 * Props:
 * - isLoading: whether data is still loading (e.g., exercise catalog being fetched)
 * - exercises: array of exercises available in the catalog
 * - error: validation error message (e.g., invalid workout name) or null
 * - onSave: callback invoked with (name, exerciseInputs) when the user saves a valid workout
 * - onBack: quando presente, o header mostra o botão de voltar
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Switch, StyleSheet, FlatList, ScrollView } from 'react-native';
import { colors, typography, spacing, layout, radii } from '../../designSystem/tokens';
import { animateLayout } from '../../designSystem/motion';
import { haptic } from '../../designSystem/haptics';
import { Button } from '../../designSystem/components/Button';
import { Chip } from '../../designSystem/components/Chip';
import { ConfirmSheet } from '../../designSystem/components/ConfirmSheet';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { IconButton } from '../../designSystem/components/IconButton';
import { Input } from '../../designSystem/components/Input';
import { ListRow } from '../../designSystem/components/ListRow';
import { LoadingState } from '../../designSystem/components/LoadingState';
import { Screen } from '../../designSystem/components/Screen';
import { ScreenHeader } from '../../designSystem/components/ScreenHeader';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
import { ExerciseThumb } from '../../components/exercise/ExerciseThumb';
import {
  ExerciseDetailSheet,
  type ExerciseDetails,
} from '../../components/exercise/ExerciseDetailSheet';
import { useLanguage } from '../../i18n/LanguageContext';
import { exerciseName, exerciseSubtitle, muscleGroupLabel } from '../../i18n/exerciseLabels';
import { buildExerciseInputs, canSaveWorkout, type SelectedExerciseEntry } from './workoutCreatorSelection';
import type { ExerciseInput } from './saveWorkoutWithExercises';
import { filterExercises } from './exerciseSearch';

export interface WorkoutCreatorExercise extends ExerciseDetails {
  id: string;
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

/** Filtro da lista: todos, só os já adicionados, ou um grupo muscular (nome em PT). */
type ListFilter = { kind: 'all' } | { kind: 'selected' } | { kind: 'group'; group: string };

/** Mesma ordem do catálogo muscular (seed do backend). */
const MUSCLE_GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Abdômen'];

const THUMB_SIZE = 48;

const EMPTY_SELECTION: SelectionState = {
  checked: false,
  seriesTarget: '',
  repsTarget: '',
  weightTarget: '',
};

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
  const { language } = useLanguage();
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
  const [filter, setFilter] = useState<ListFilter>({ kind: 'all' });
  const [detailExercise, setDetailExercise] = useState<WorkoutCreatorExercise | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = mode === 'edit';

  const getState = (id: string): SelectionState => selection[id] ?? EMPTY_SELECTION;

  // A busca e os filtros só afetam o que é EXIBIDO — a seleção/validação
  // continua sobre o catálogo inteiro, então filtrar não descarta o que já
  // foi marcado antes.
  const sortedExercises = useMemo(
    () =>
      [...exercises].sort((a, b) =>
        exerciseName(a, language).localeCompare(exerciseName(b, language), language),
      ),
    [exercises, language],
  );
  const visibleExercises = useMemo(() => {
    const byFilter = sortedExercises.filter((e) => {
      if (filter.kind === 'selected') return selection[e.id]?.checked === true;
      if (filter.kind === 'group') return e.primaryGroup === filter.group;
      return true;
    });
    return filterExercises(byFilter, searchQuery);
  }, [sortedExercises, filter, selection, searchQuery]);

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

  const setState = (id: string, patch: Partial<SelectionState>) => {
    setSelection((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_SELECTION), ...patch },
    }));
  };

  const toggle = (id: string, checked: boolean) => {
    haptic('selection');
    animateLayout();
    setState(id, { checked });
  };

  const entries: SelectedExerciseEntry[] = exercises.map((e) => toEntry(e.id, getState(e.id)));
  const canSave = canSaveWorkout(workoutName, entries);
  const selectedCount = exercises.filter((e) => getState(e.id).checked).length;

  const handleSave = () => {
    if (!canSave) return;
    onSave(workoutName, buildExerciseInputs(entries));
  };

  const filterChips: Array<{ key: string; label: string; value: ListFilter }> = [
    { key: 'all', label: 'Todos', value: { kind: 'all' } },
    { key: 'selected', label: `Adicionados (${selectedCount})`, value: { kind: 'selected' } },
    ...MUSCLE_GROUPS.map((group) => ({
      key: group,
      label: muscleGroupLabel(group, language),
      value: { kind: 'group', group } as ListFilter,
    })),
  ];
  const isFilterSelected = (value: ListFilter) =>
    value.kind === filter.kind &&
    (value.kind !== 'group' || (filter.kind === 'group' && filter.group === value.group));

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {isEdit ? 'Editar treino' : 'Criar treino'}
        </Text>
        <Text style={styles.subtitle}>Escolha os exercícios e defina séries, repetições e carga.</Text>
      </View>

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

        {/* Busca (Wave 8), em PT e EN — 500 exercícios no catálogo. */}
        <Input
          testID="exercise-search-input"
          placeholder="Buscar exercício…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Buscar exercício"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyboardShouldPersistTaps="handled"
          testID="exercise-filter-chips"
        >
          {filterChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              selected={isFilterSelected(chip.value)}
              onPress={() => setFilter(chip.value)}
              testID={`exercise-filter-${chip.key}`}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderExercise = ({ item: exercise, index }: { item: WorkoutCreatorExercise; index: number }) => {
    const state = getState(exercise.id);
    const name = exerciseName(exercise, language);
    const isFirst = index === 0;
    const isLast = index === visibleExercises.length - 1;
    return (
      <View style={[styles.rowCard, isFirst && styles.rowCardFirst, isLast && styles.rowCardLast]}>
        <ListRow
          testID={`exercise-row-${exercise.id}`}
          title={name}
          subtitle={exerciseSubtitle(exercise, language)}
          divider={!isLast}
          onPress={() => toggle(exercise.id, !state.checked)}
          accessibilityLabel={`${state.checked ? 'Remover' : 'Adicionar'} ${name}`}
          leading={
            <ExerciseThumb
              mediaKey={exercise.mediaKey}
              size={THUMB_SIZE}
              animated={state.checked}
              onPress={() => setDetailExercise(exercise)}
              accessibilityLabel={`Ver ${name}`}
              testID={`exercise-thumb-${exercise.id}`}
            />
          }
          trailing={
            <Switch
              testID={`exercise-toggle-${exercise.id}`}
              value={state.checked}
              onValueChange={(checked) => toggle(exercise.id, checked)}
              trackColor={{ true: colors.primary, false: colors.cardAlt }}
              thumbColor={colors.primaryText}
              ios_backgroundColor={colors.cardAlt}
              style={styles.switch}
              accessibilityLabel={`Selecionar ${name}`}
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
                  accessibilityLabel={`Séries para ${name}`}
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
                  accessibilityLabel={`Repetições para ${name}`}
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
                  accessibilityLabel={`Peso para ${name}`}
                />
              </View>
            </View>
          ) : undefined}
        </ListRow>
      </View>
    );
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      testID="workout-creator-screen"
      header={header}
      scroll={false}
      contentStyle={styles.screenContent}
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
      <FlatList
        testID="exercise-selection-list"
        data={visibleExercises}
        keyExtractor={(exercise) => exercise.id}
        renderItem={renderExercise}
        // `selection`/`language` mudam o conteúdo das linhas sem mudar `data`.
        extraData={[selection, language]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.noResultsText} testID="exercise-search-no-results">
            Nenhum exercício encontrado.
          </Text>
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        style={styles.list}
      />

      <ExerciseDetailSheet exercise={detailExercise} onClose={() => setDetailExercise(null)} />

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
  // A FlatList faz a rolagem e encosta nas bordas laterais da casca; o
  // gutter volta como padding do conteúdo da lista.
  screenContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listHeader: {
    gap: layout.sectionGap,
    paddingBottom: layout.blockGap,
  },
  titleBlock: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.title,
    color: colors.primaryText,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  block: {
    gap: layout.blockGap,
  },
  filterRow: {
    gap: spacing.xs,
  },
  rowCard: {
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  rowCardFirst: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  rowCardLast: {
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
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
