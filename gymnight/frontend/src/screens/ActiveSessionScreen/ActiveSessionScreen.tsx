/**
 * ActiveSessionScreen — Wave 4.
 *
 * Estrutura portada de active_workout.py (`_build_workout_page` 65-197 e
 * `_create_exercise_card` 544-652): header com voltar + contador, título em
 * caixa alta, ProgressBar, um Card por exercício com a grade de séries, e
 * rodapé FIXO fora do scroll com "Finalizar Treino".
 *
 * DOIS MODOS:
 *   - grade  — sessão com treino definido. As linhas já vêm montadas a partir
 *              de `series_target`, cada uma pré-preenchida com o que o usuário
 *              levantou na MESMA série da última vez ("fantasma", em cinza).
 *              Marcar o check grava. Repetir a carga anterior é um toque.
 *   - livre  — sessão sem treino (freestyle). Não há lista de exercícios para
 *              montar grade, então mantém o formulário histórico da tela,
 *              reestilizado com os tokens novos.
 *
 * O fantasma é feature NOVA, não port: o desktop usa placeholder fixo "0"/"10-12"
 * (active_workout.py:622,629) e nunca consulta o histórico.
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { IconBadge } from '../../designSystem/components/IconBadge';
import { ProgressBar } from '../../designSystem/components/ProgressBar';
import { ScreenHeader } from '../../designSystem/components/ScreenHeader';
import { SetCheckButton } from '../../designSystem/components/SetCheckButton';
import { UnderlineInput } from '../../designSystem/components/UnderlineInput';
import { Chip } from '../../designSystem/components/Chip';
import {
  buildSetGrid,
  countGridProgress,
  validateSetEntry,
  type GridLoggedSet,
  type GridWorkoutExercise,
} from './setGrid';

export interface ActiveSessionLoggedSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  completedAt?: number;
  error?: string;
}

export interface ActiveSessionExerciseOption {
  id: string;
  name: string;
  seriesTarget?: number;
  repsTarget?: number;
  weightTarget?: number;
}

/** Série da última sessão encerrada — origem do valor fantasma. */
export interface ActiveSessionPreviousSet {
  id: string;
  exerciseId: string;
  weight: number;
  repetitions: number;
  completedAt: number;
}

export interface ActiveSessionProps {
  session: { id: string; started_at: number };
  loggedSets: ActiveSessionLoggedSet[];
  totalVolume: number;
  exerciseOptions: ActiveSessionExerciseOption[];
  onLogSet: (exerciseId: string, weight: number, reps: number) => void;
  onEndSession: () => void;
  /** Nome do treino, exibido em caixa alta. Ausente = treino livre. */
  workoutName?: string | null;
  /** Séries da última sessão do mesmo treino. */
  previousSessionSets?: ActiveSessionPreviousSet[];
  /** Liga a grade. Sem isto (ou sem exercícios) a tela usa o formulário livre. */
  hasWorkout?: boolean;
  /** Volta ao Dashboard. Sem isto, o header não mostra "Voltar". */
  onBack?: () => void;
}

function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Duração no formato MM:SS do resumo (active_workout.py:812). */
function formatSummaryDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** Texto do campo, ou string vazia quando não há referência nenhuma. */
function toFieldText(value: number | null): string {
  return value === null ? '' : String(value);
}

interface RowKey {
  exerciseId: string;
  index: number;
}

function rowKeyOf({ exerciseId, index }: RowKey): string {
  return `${exerciseId}:${index}`;
}

export function ActiveSessionScreen({
  session,
  loggedSets,
  totalVolume,
  exerciseOptions,
  onLogSet,
  onEndSession,
  workoutName = null,
  previousSessionSets = [],
  hasWorkout = false,
  onBack,
}: ActiveSessionProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - session.started_at);
  const [exerciseId, setExerciseId] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [finalElapsed, setFinalElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edições do usuário nas linhas da grade, por `exerciseId:index`. Uma chave
  // presente aqui deixou de ser fantasma — o valor passou a ser dele.
  const [edits, setEdits] = useState<Record<string, { weight?: string; reps?: string }>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, { weight: boolean; reps: boolean }>>({});

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - session.started_at);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session.started_at]);

  const gridExercises: GridWorkoutExercise[] = useMemo(
    () =>
      exerciseOptions.map((option) => ({
        id: option.id,
        name: option.name,
        seriesTarget: option.seriesTarget ?? 0,
        repsTarget: option.repsTarget ?? 0,
        weightTarget: option.weightTarget ?? 0,
      })),
    [exerciseOptions],
  );

  const currentSets: GridLoggedSet[] = useMemo(
    () =>
      loggedSets.map((set, index) => ({
        id: set.id,
        exerciseId: set.exerciseId,
        weight: set.weight,
        repetitions: set.reps,
        // Sem completedAt a ordem de chegada é a ordem de execução.
        completedAt: set.completedAt ?? index,
      })),
    [loggedSets],
  );

  const grid = useMemo(
    () => buildSetGrid(gridExercises, currentSets, previousSessionSets),
    [gridExercises, currentSets, previousSessionSets],
  );

  const progress = useMemo(() => countGridProgress(grid), [grid]);

  // A grade só existe com treino definido E exercícios com séries planejadas.
  const useGrid = hasWorkout && progress.total > 0;

  const handleLogSet = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (exerciseId && !isNaN(w) && !isNaN(r)) {
      onLogSet(exerciseId, w, r);
    }
  };

  const handleToggleSet = (
    key: string,
    exId: string,
    displayWeight: number | null,
    displayReps: number | null,
  ) => {
    const edit = edits[key] ?? {};
    // O fantasma conta como preenchido: confirmar a carga anterior sem digitar
    // é justamente o ponto da grade.
    const weightText = edit.weight ?? toFieldText(displayWeight);
    const repsText = edit.reps ?? toFieldText(displayReps);
    const result = validateSetEntry(weightText, repsText);

    if (!result.valid) {
      setRowErrors((prev) => ({
        ...prev,
        [key]: { weight: result.weightError, reps: result.repsError },
      }));
      return;
    }

    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    onLogSet(exId, result.weight, result.reps);
  };

  const handleFinish = () => {
    setFinalElapsed(Date.now() - session.started_at);
    setShowSummary(true);
  };

  const handleBackPress = () => {
    if (!onBack) return;
    setShowExitConfirm(true);
  };

  if (showSummary) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="session-summary">
        <ScrollView contentContainerStyle={styles.summaryContent}>
          <Text style={styles.summaryTrophy}>🏆</Text>
          <Text style={styles.summaryTitle} testID="summary-title">
            TREINO CONCLUÍDO!
          </Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCards}>
            <SummaryCard
              icon="weight-hanging"
              value={`${totalVolume}kg`}
              label="Volume"
              testID="summary-volume"
            />
            <SummaryCard
              icon="clock"
              value={formatSummaryDuration(finalElapsed)}
              label="Duração"
              testID="summary-duration"
            />
            <SummaryCard
              icon="layer-group"
              value={String(loggedSets.length)}
              label="Séries"
              testID="summary-sets"
            />
          </View>
          <Button
            label="Voltar para Treinos"
            icon="home"
            onPress={onEndSession}
            testID="summary-back-button"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="active-session-screen">
      <View style={styles.body}>
        <ScreenHeader
          onBack={onBack ? handleBackPress : undefined}
          testID="active-session-header"
          right={
            <View style={styles.headerRight}>
              <Text style={styles.headerTimer} testID="session-timer">
                {formatElapsedTime(elapsed)}
              </Text>
              <Text style={styles.headerCounter} testID="set-counter">
                {useGrid
                  ? `${progress.completed}/${progress.total} séries`
                  : `${loggedSets.length} séries`}
              </Text>
            </View>
          }
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          testID="logged-sets-list"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title} testID="workout-title">
            {(workoutName ?? 'Treino Livre').toUpperCase()}
          </Text>

          {useGrid ? (
            <>
              <ProgressBar value={progress.ratio} testID="session-progress" />
              {grid.map((exercise) => (
                <Card
                  key={exercise.exerciseId}
                  glow
                  style={styles.exerciseCard}
                  testID={`exercise-card-${exercise.exerciseId}`}
                >
                  <View style={styles.exerciseHeader}>
                    <IconBadge glyph="◈" />
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {exercise.name.toUpperCase()}
                    </Text>
                    <Text
                      style={styles.exerciseCount}
                      testID={`exercise-count-${exercise.exerciseId}`}
                    >
                      {exercise.completedCount}/{exercise.totalCount}
                    </Text>
                  </View>

                  <View style={styles.columnHeader}>
                    <Text style={[styles.columnLabel, styles.colNumber]}>Série</Text>
                    <Text style={[styles.columnLabel, styles.colField]}>Peso (kg)</Text>
                    <Text style={[styles.columnLabel, styles.colField]}>Reps</Text>
                    <View style={styles.colCheck} />
                  </View>

                  {exercise.rows.map((row, index) => {
                    const key = rowKeyOf({ exerciseId: exercise.exerciseId, index });
                    const edit = edits[key] ?? {};
                    const errors = rowErrors[key];
                    const weightText = edit.weight ?? toFieldText(row.weight);
                    const repsText = edit.reps ?? toFieldText(row.reps);
                    // Fantasma só enquanto o usuário não tocou no campo.
                    const weightIsGhost = row.source === 'ghost' && edit.weight === undefined;
                    const repsIsGhost = row.source === 'ghost' && edit.reps === undefined;

                    return (
                      <View
                        key={key}
                        style={styles.setRow}
                        testID={`set-row-${exercise.exerciseId}-${index}`}
                      >
                        <Text style={[styles.setNumber, styles.colNumber]}>{row.setNumber}</Text>
                        <View style={styles.colField}>
                          <UnderlineInput
                            testID={`set-weight-${exercise.exerciseId}-${index}`}
                            value={weightText}
                            placeholder="0"
                            keyboardType="numeric"
                            isGhost={weightIsGhost}
                            isLocked={row.isLogged}
                            hasError={errors?.weight ?? false}
                            accessibilityLabel={`Peso da série ${row.setNumber}`}
                            onChangeText={(text) =>
                              setEdits((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], weight: text },
                              }))
                            }
                          />
                        </View>
                        <View style={styles.colField}>
                          <UnderlineInput
                            testID={`set-reps-${exercise.exerciseId}-${index}`}
                            value={repsText}
                            placeholder="10-12"
                            keyboardType="numeric"
                            isGhost={repsIsGhost}
                            isLocked={row.isLogged}
                            hasError={errors?.reps ?? false}
                            accessibilityLabel={`Repetições da série ${row.setNumber}`}
                            onChangeText={(text) =>
                              setEdits((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], reps: text },
                              }))
                            }
                          />
                        </View>
                        <View style={styles.colCheck}>
                          <SetCheckButton
                            testID={`set-check-${exercise.exerciseId}-${index}`}
                            checked={row.isLogged}
                            // Série gravada não desmarca: nada some do histórico
                            // por toque acidental no meio do treino.
                            disabled={row.isLogged}
                            accessibilityLabel={`Concluir série ${row.setNumber} de ${exercise.name}`}
                            onPress={() =>
                              handleToggleSet(key, exercise.exerciseId, row.weight, row.reps)
                            }
                          />
                        </View>
                      </View>
                    );
                  })}
                </Card>
              ))}
            </>
          ) : (
            <>
              <View style={styles.volumeContainer} testID="volume-summary">
                <Text style={styles.volumeLabel}>Volume Total</Text>
                <Text style={styles.volumeValue} testID="volume-value">
                  {totalVolume} kg
                </Text>
              </View>

              {loggedSets.map((item) => (
                <View
                  key={item.id}
                  style={[styles.setItem, item.error ? styles.setItemError : null]}
                  testID={`logged-set-${item.id}`}
                >
                  <Text style={styles.setItemText} testID={`set-info-${item.id}`}>
                    {item.exerciseName} — {item.weight}kg × {item.reps}
                  </Text>
                  {item.error && (
                    <Text style={styles.errorText} testID={`set-error-${item.id}`}>
                      {item.error}
                    </Text>
                  )}
                </View>
              ))}

              <View style={styles.logForm} testID="set-logger-form">
                <ScrollView horizontal testID="exercise-picker" style={styles.exercisePicker}>
                  {exerciseOptions.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.name}
                      selected={exerciseId === option.id}
                      onPress={() => setExerciseId(option.id)}
                      testID={`exercise-option-${option.id}`}
                    />
                  ))}
                </ScrollView>
                <UnderlineInput
                  testID="weight-input"
                  placeholder="Peso (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  accessibilityLabel="Peso"
                />
                <UnderlineInput
                  testID="reps-input"
                  placeholder="Repetições"
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                  accessibilityLabel="Repetições"
                />
                <Button
                  label="Registrar Série"
                  icon="plus"
                  onPress={handleLogSet}
                  testID="log-set-button"
                  accessibilityLabel="Registrar série"
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Rodapé fixo, fora do scroll (active_workout.py:171-195) */}
      <View style={styles.footer} testID="session-footer">
        <Button
          label="Finalizar Treino"
          icon="flag-checkered"
          onPress={handleFinish}
          testID="end-session-button"
          accessibilityLabel="Finalizar treino"
        />
      </View>

      <Modal
        visible={showExitConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
        testID="exit-confirm-modal"
      >
        <View style={styles.overlay}>
          <View style={styles.confirmCard} testID="exit-confirm-card">
            <FontAwesome5 name="question-circle" size={48} color={colors.primary} solid />
            <Text style={styles.confirmText}>Abandonar o treino atual?</Text>
            <View style={styles.confirmActions}>
              <Button
                label="Não"
                variant="ghost"
                onPress={() => setShowExitConfirm(false)}
                style={styles.confirmButton}
                testID="exit-confirm-no"
              />
              <Button
                label="Sim"
                onPress={() => {
                  setShowExitConfirm(false);
                  onBack?.();
                }}
                style={styles.confirmButton}
                testID="exit-confirm-yes"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  testID,
}: {
  icon: string;
  value: string;
  label: string;
  testID: string;
}) {
  return (
    <Card glow style={styles.summaryCard} testID={testID}>
      <FontAwesome5 name={icon} size={28} color={colors.primary} solid />
      <Text style={styles.summaryValue} testID={`${testID}-value`}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTimer: {
    color: colors.primary,
    ...typography.bodyBold,
  },
  headerCounter: {
    color: colors.secondaryText,
    ...typography.sub,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.primaryText,
    ...typography.h1,
  },
  exerciseCard: {
    padding: spacing.lg,
    // O desktop usa gap 14 (active_workout.py:566); sem token equivalente,
    // fica no vizinho da escala em vez de criar um valor paralelo.
    gap: spacing.sm,
    // gap 32 entre cards (active_workout.py:132)
    marginBottom: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseName: {
    flex: 1,
    color: colors.primaryText,
    ...typography.h2,
  },
  exerciseCount: {
    color: colors.primary,
    ...typography.h3,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  columnLabel: {
    color: colors.secondaryText,
    ...typography.sub,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  colNumber: {
    width: 40,
    textAlign: 'center',
  },
  colField: {
    flex: 5,
  },
  colCheck: {
    width: 52,
    alignItems: 'center',
  },
  setNumber: {
    color: colors.primary,
    ...typography.setNumber,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  // --- Modo livre (freestyle) ---
  volumeContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  volumeLabel: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  volumeValue: {
    color: colors.primaryText,
    ...typography.bodyBold,
  },
  setItem: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  setItemError: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  setItemText: {
    color: colors.primaryText,
    ...typography.body,
  },
  errorText: {
    color: colors.error,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  logForm: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exercisePicker: {
    flexGrow: 0,
  },
  // --- Overlay de saída (active_workout.py:960) ---
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
  // --- Resumo (active_workout.py:778) ---
  summaryContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryTrophy: {
    // Emoji do resumo (active_workout.py:790): usa o maior token da escala
    // dobrado, em vez de um literal solto.
    ...typography.h1,
    fontSize: typography.h1.fontSize * 2,
    textAlign: 'center',
  },
  summaryTitle: {
    color: colors.primary,
    ...typography.h2,
    textAlign: 'center',
  },
  summaryDivider: {
    height: 2,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
  },
  summaryCards: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryValue: {
    color: colors.primaryText,
    ...typography.h3,
    textAlign: 'center',
  },
  summaryLabel: {
    color: colors.secondaryText,
    ...typography.sub,
  },
});
