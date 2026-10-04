/**
 * ActiveSessionScreen — o treino em andamento.
 *
 * Header FIXO (voltar · timer ao vivo · contador) com a barra de progresso
 * logo abaixo, o conteúdo rolando no meio e o CTA "Finalizar treino" num
 * rodapé fixo na zona do polegar.
 *
 * DOIS MODOS:
 *   - grade  — sessão com treino definido. As linhas já vêm montadas a partir
 *              de `series_target`, cada uma pré-preenchida com o que o usuário
 *              levantou na MESMA série da última vez ("fantasma", apagado).
 *              Marcar o check grava. Repetir a carga anterior é um toque.
 *   - livre  — sessão sem treino (freestyle). Não há lista de exercícios para
 *              montar grade, então usa o formulário de registro avulso.
 *
 * O fantasma é feature NOVA, não port: o desktop usa placeholder fixo "0"/"10-12"
 * (active_workout.py:622,629) e nunca consulta o histórico.
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii, layout } from '../../designSystem/tokens';
import { haptic } from '../../designSystem/haptics';
import { useEnterAnimation } from '../../designSystem/motion';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { CellInput } from '../../designSystem/components/CellInput';
import { Chip } from '../../designSystem/components/Chip';
import { ConfirmSheet } from '../../designSystem/components/ConfirmSheet';
import { Input } from '../../designSystem/components/Input';
import { ProgressBar } from '../../designSystem/components/ProgressBar';
import { Screen } from '../../designSystem/components/Screen';
import { ScreenHeader } from '../../designSystem/components/ScreenHeader';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
import { SetCheckButton } from '../../designSystem/components/SetCheckButton';
import { SetTypeBadge, nextSetType } from '../../designSystem/components/SetTypeBadge';
import {
  buildSetGrid,
  countGridProgress,
  validateSetEntry,
  type GridLoggedSet,
  type GridWorkoutExercise,
} from './setGrid';
import { CardioSection, type CardioSectionEntry } from './CardioSection';
import type { CardioFormValue } from '../CardioScreen/CardioForm';

export type ActiveSessionCardioEntry = CardioSectionEntry;

export interface ActiveSessionLoggedSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  completedAt?: number;
  error?: string;
  /** 'N' | 'W' | 'D' | 'F' (Wave 6). Ausente equivale a 'N'. */
  setType?: string;
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
  onLogSet: (exerciseId: string, weight: number, reps: number, setType?: string) => void;
  onEndSession: () => void;
  /** Nome do treino, exibido como título. Ausente = treino livre. */
  workoutName?: string | null;
  /** Séries da última sessão do mesmo treino. */
  previousSessionSets?: ActiveSessionPreviousSet[];
  /** Liga a grade. Sem isto (ou sem exercícios) a tela usa o formulário livre. */
  hasWorkout?: boolean;
  /** Volta ao Dashboard. Sem isto, o header não mostra "Voltar". */
  onBack?: () => void;
  /** Entradas de cardio da sessão (Wave 9) — nunca contam no contador de séries. */
  cardioEntries?: ActiveSessionCardioEntry[];
  onAddCardio?: (value: CardioFormValue) => void;
  onRemoveCardio?: (cardioLogId: string) => void;
  /** Peso do usuário para a estimativa de calorias de cardio; default 70. */
  weightKg?: number;
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
  cardioEntries = [],
  onAddCardio,
  onRemoveCardio,
  weightKg = 70,
}: ActiveSessionProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - session.started_at);
  const [exerciseId, setExerciseId] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [finalElapsed, setFinalElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const summaryEnter = useEnterAnimation(showSummary);

  // Edições do usuário nas linhas da grade, por `exerciseId:index`. Uma chave
  // presente aqui deixou de ser fantasma — o valor passou a ser dele.
  const [edits, setEdits] = useState<Record<string, { weight?: string; reps?: string }>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, { weight: boolean; reps: boolean }>>({});
  // Tipo de série escolhido ANTES de gravar (N/W/D/F) — some da linha depois
  // que ela é logada, quando o tipo real gravado passa a mandar.
  const [pendingSetTypes, setPendingSetTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - session.started_at);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session.started_at]);

  useEffect(() => {
    if (showSummary) haptic('success');
  }, [showSummary]);

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
        setType: set.setType,
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
      haptic('warning');
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
    onLogSet(exId, result.weight, result.reps, pendingSetTypes[key] ?? 'N');
  };

  const handleCycleSetType = (key: string, currentType: string) => {
    setPendingSetTypes((prev) => ({ ...prev, [key]: nextSetType(currentType) }));
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
    const cardioMinutes = cardioEntries.reduce((sum, e) => sum + e.durationMin, 0);
    const cardioPse =
      cardioEntries.length > 0
        ? (cardioEntries.reduce((sum, e) => sum + e.pse, 0) / cardioEntries.length).toFixed(1)
        : '';

    return (
      <Screen
        edges={['top', 'bottom']}
        testID="session-summary"
        contentStyle={styles.summaryContent}
        footer={
          <Button
            label="Voltar para treinos"
            icon="home"
            onPress={onEndSession}
            testID="summary-back-button"
          />
        }
      >
        <Animated.View style={[styles.summaryBody, summaryEnter]}>
          <View style={styles.summaryBadge}>
            <FontAwesome5 name="check" size={28} color={colors.primary} solid />
          </View>
          <View style={styles.summaryHeading}>
            <Text style={styles.summaryTitle} testID="summary-title" accessibilityRole="header">
              Treino concluído
            </Text>
            <Text style={styles.summarySubtitle}>{workoutName ?? 'Treino livre'}</Text>
          </View>

          <Card style={styles.summaryMetrics}>
            <SummaryMetric value={`${totalVolume}kg`} label="Volume" testID="summary-volume" />
            <View style={styles.summaryDivider} />
            <SummaryMetric
              value={formatSummaryDuration(finalElapsed)}
              label="Duração"
              testID="summary-duration"
            />
            <View style={styles.summaryDivider} />
            <SummaryMetric value={String(loggedSets.length)} label="Séries" testID="summary-sets" />
          </Card>

          {cardioEntries.length > 0 && (
            <Card style={styles.summaryMetrics}>
              <SummaryMetric
                value={`${cardioMinutes}min`}
                label="Cardio"
                testID="summary-cardio-duration"
              />
              <View style={styles.summaryDivider} />
              <SummaryMetric value={cardioPse} label="PSE médio" testID="summary-cardio-pse" />
            </Card>
          )}
        </Animated.View>
      </Screen>
    );
  }

  const header = (
    <View>
      <ScreenHeader
        onBack={onBack ? handleBackPress : undefined}
        testID="active-session-header"
        title={
          <View style={styles.timerRow}>
            <View style={styles.liveDot} />
            <Text style={styles.timer} testID="session-timer">
              {formatElapsedTime(elapsed)}
            </Text>
          </View>
        }
        right={
          <Text style={styles.counter} testID="set-counter">
            {useGrid ? `${progress.completed}/${progress.total} séries` : `${loggedSets.length} séries`}
          </Text>
        }
      />
      {useGrid ? (
        <View style={styles.progressWrap}>
          <ProgressBar value={progress.ratio} testID="session-progress" />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen
      edges={['top', 'bottom']}
      testID="active-session-screen"
      scrollTestID="logged-sets-list"
      header={header}
      title={workoutName ?? 'Treino livre'}
      titleTestID="workout-title"
      footer={
        <View testID="session-footer">
          <Button
            label="Finalizar treino"
            icon="flag-checkered"
            onPress={handleFinish}
            testID="end-session-button"
            accessibilityLabel="Finalizar treino"
          />
        </View>
      }
    >
      {useGrid ? (
        <View style={styles.exerciseList}>
          {grid.map((exercise) => {
            const isComplete =
              exercise.totalCount > 0 && exercise.completedCount === exercise.totalCount;
            return (
              <Card
                key={exercise.exerciseId}
                style={styles.exerciseCard}
                testID={`exercise-card-${exercise.exerciseId}`}
              >
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName} numberOfLines={2}>
                    {exercise.name}
                  </Text>
                  <View style={styles.exerciseCountWrap}>
                    {isComplete ? (
                      <FontAwesome5 name="check" size={11} color={colors.success} solid />
                    ) : null}
                    <Text
                      style={[styles.exerciseCount, isComplete && styles.exerciseCountDone]}
                      testID={`exercise-count-${exercise.exerciseId}`}
                    >
                      {exercise.completedCount}/{exercise.totalCount}
                    </Text>
                  </View>
                </View>

                <View style={styles.setRow}>
                  <Text style={[styles.columnLabel, styles.colNumber]}>Série</Text>
                  <View style={styles.colType} />
                  <Text style={[styles.columnLabel, styles.colField]}>kg</Text>
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
                  const setType = row.isLogged ? row.setType : (pendingSetTypes[key] ?? 'N');

                  return (
                    <View
                      key={key}
                      style={[styles.setRow, styles.setRowBody]}
                      testID={`set-row-${exercise.exerciseId}-${index}`}
                    >
                      <Text
                        style={[
                          styles.setNumber,
                          styles.colNumber,
                          row.isLogged && styles.setNumberDone,
                        ]}
                      >
                        {row.setNumber}
                      </Text>
                      <View style={styles.colType}>
                        <SetTypeBadge
                          testID={`set-type-${exercise.exerciseId}-${index}`}
                          setType={setType}
                          disabled={row.isLogged}
                          accessibilityLabel={`Tipo da série ${row.setNumber}: ${setType}. Toque para trocar.`}
                          onPress={() => handleCycleSetType(key, setType)}
                        />
                      </View>
                      <View style={styles.colField}>
                        <CellInput
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
                        <CellInput
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
            );
          })}
        </View>
      ) : (
        <View style={styles.freestyle}>
          <Card style={styles.metricsCard} testID="volume-summary">
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Volume total</Text>
              <Text style={styles.metricValue} testID="volume-value">
                {totalVolume} kg
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Séries</Text>
              <Text style={styles.metricValue}>{loggedSets.length}</Text>
            </View>
          </Card>

          {loggedSets.length > 0 && (
            <Card padding="none">
              {loggedSets.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.loggedSet, index < loggedSets.length - 1 && styles.loggedSetDivider]}
                  testID={`logged-set-${item.id}`}
                >
                  <View style={styles.loggedSetLine}>
                    <Text style={styles.loggedSetText} testID={`set-info-${item.id}`}>
                      {item.exerciseName} — {item.weight}kg × {item.reps}
                    </Text>
                    <FontAwesome5
                      name={item.error ? 'exclamation-circle' : 'check'}
                      size={12}
                      color={item.error ? colors.error : colors.success}
                      solid
                    />
                  </View>
                  {item.error && (
                    <Text style={styles.errorText} testID={`set-error-${item.id}`}>
                      {item.error}
                    </Text>
                  )}
                </View>
              ))}
            </Card>
          )}

          <View style={styles.loggerSection}>
            <SectionTitle>Registrar série</SectionTitle>
            <Card style={styles.logForm} testID="set-logger-form">
              <ScrollView
                horizontal
                testID="exercise-picker"
                style={styles.exercisePicker}
                contentContainerStyle={styles.exercisePickerContent}
                showsHorizontalScrollIndicator={false}
              >
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
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Input
                    testID="weight-input"
                    label="Peso (kg)"
                    placeholder="0"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    accessibilityLabel="Peso"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Input
                    testID="reps-input"
                    label="Repetições"
                    placeholder="10"
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="numeric"
                    accessibilityLabel="Repetições"
                  />
                </View>
              </View>
              <Button
                label="Registrar série"
                icon="plus"
                variant="secondary"
                haptic="medium"
                onPress={handleLogSet}
                testID="log-set-button"
                accessibilityLabel="Registrar série"
              />
            </Card>
          </View>
        </View>
      )}

      {onAddCardio && onRemoveCardio && (
        <CardioSection
          entries={cardioEntries}
          onAdd={onAddCardio}
          onRemove={onRemoveCardio}
          weightKg={weightKg}
        />
      )}

      <ConfirmSheet
        visible={showExitConfirm}
        testID="exit-confirm"
        title="Sair do treino?"
        message="A sessão continua aberta — você pode retomá-la pelo Dashboard."
        confirmLabel="Sair"
        cancelLabel="Continuar treinando"
        onConfirm={() => {
          setShowExitConfirm(false);
          onBack?.();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </Screen>
  );
}

function SummaryMetric({ value, label, testID }: { value: string; label: string; testID: string }) {
  return (
    <View style={styles.metric} testID={testID}>
      <Text style={styles.summaryValue} testID={`${testID}-value`}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const LIVE_DOT_SIZE = 6;
const SUMMARY_BADGE_SIZE = 64;
const COL_NUMBER_WIDTH = 32;
const COL_TYPE_WIDTH = 28;

const styles = StyleSheet.create({
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: LIVE_DOT_SIZE,
    height: LIVE_DOT_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  timer: {
    ...typography.numeric,
    color: colors.primaryText,
  },
  counter: {
    ...typography.caption,
    color: colors.secondaryText,
  },
  progressWrap: {
    paddingBottom: spacing.xs,
  },
  exerciseList: {
    gap: spacing.md,
  },
  exerciseCard: {
    gap: spacing.xs,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  exerciseName: {
    ...typography.h3,
    color: colors.primaryText,
    flex: 1,
  },
  exerciseCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  exerciseCount: {
    ...typography.captionStrong,
    color: colors.secondaryText,
  },
  exerciseCountDone: {
    color: colors.success,
  },
  columnLabel: {
    ...typography.caption,
    color: colors.tertiaryText,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  setRowBody: {
    minHeight: layout.controlHeight.md,
  },
  colNumber: {
    width: COL_NUMBER_WIDTH,
    textAlign: 'center',
  },
  colType: {
    width: COL_TYPE_WIDTH,
    alignItems: 'center',
  },
  colField: {
    flex: 1,
  },
  colCheck: {
    width: layout.hitTarget,
    alignItems: 'center',
  },
  setNumber: {
    ...typography.numeric,
    color: colors.secondaryText,
  },
  setNumberDone: {
    color: colors.tertiaryText,
  },
  // --- Modo livre (freestyle) ---
  freestyle: {
    gap: spacing.md,
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.secondaryText,
  },
  metricValue: {
    ...typography.stat,
    color: colors.primaryText,
  },
  loggedSet: {
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  loggedSetDivider: {
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.divider,
  },
  loggedSetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  loggedSetText: {
    ...typography.bodyMedium,
    color: colors.primaryText,
    flex: 1,
  },
  errorText: {
    ...typography.footnote,
    color: colors.error,
  },
  loggerSection: {
    gap: layout.blockGap,
  },
  logForm: {
    gap: spacing.md,
  },
  exercisePicker: {
    flexGrow: 0,
  },
  exercisePickerContent: {
    gap: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputHalf: {
    flex: 1,
  },
  // --- Resumo ---
  summaryContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  summaryBody: {
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  summaryBadge: {
    alignSelf: 'center',
    width: SUMMARY_BADGE_SIZE,
    height: SUMMARY_BADGE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeading: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  summaryTitle: {
    ...typography.display,
    color: colors.primaryText,
    textAlign: 'center',
  },
  summarySubtitle: {
    ...typography.body,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  summaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  summaryDivider: {
    width: layout.hairline,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  summaryValue: {
    ...typography.stat,
    color: colors.primaryText,
    textAlign: 'center',
  },
});
