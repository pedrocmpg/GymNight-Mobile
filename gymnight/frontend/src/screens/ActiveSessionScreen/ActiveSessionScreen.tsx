/**
 * ActiveSessionScreen Component
 *
 * Displays an active workout session with timer, logged sets, volume summary,
 * and set logging interaction. Error state is isolated per logged set item.
 * Uses Design_Tokens exclusively for styling.
 *
 * Props:
 * - session: the active session with id and started_at timestamp
 * - loggedSets: array of logged sets (each may have an isolated error)
 * - totalVolume: computed total volume to display
 * - exerciseOptions: exercises the user can pick from to log a set
 * - onLogSet: callback invoked when the user logs a new set
 * - onEndSession: callback invoked when the user finishes the workout
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';

export interface ActiveSessionLoggedSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  error?: string;
}

export interface ActiveSessionExerciseOption {
  id: string;
  name: string;
}

export interface ActiveSessionProps {
  session: { id: string; started_at: number };
  loggedSets: ActiveSessionLoggedSet[];
  totalVolume: number;
  exerciseOptions: ActiveSessionExerciseOption[];
  onLogSet: (exerciseId: string, weight: number, reps: number) => void;
  onEndSession: () => void;
}

function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function ActiveSessionScreen({
  session,
  loggedSets,
  totalVolume,
  exerciseOptions,
  onLogSet,
  onEndSession,
}: ActiveSessionProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - session.started_at);
  const [exerciseId, setExerciseId] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - session.started_at);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session.started_at]);

  const handleLogSet = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (exerciseId && !isNaN(w) && !isNaN(r)) {
      onLogSet(exerciseId, w, r);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="active-session-screen">
      {/* Timer */}
      <Text style={styles.timer} testID="session-timer">
        {formatElapsedTime(elapsed)}
      </Text>

      {/* Volume Summary */}
      <View style={styles.volumeContainer} testID="volume-summary">
        <Text style={styles.volumeLabel}>Volume Total</Text>
        <Text style={styles.volumeValue} testID="volume-value">
          {totalVolume} kg
        </Text>
      </View>

      {/* Logged Sets List */}
      <ScrollView style={styles.setList} testID="logged-sets-list">
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
      </ScrollView>

      {/* Set Logger Form */}
      <View style={styles.logForm} testID="set-logger-form">
        <ScrollView horizontal testID="exercise-picker" style={styles.exercisePicker}>
          {exerciseOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              testID={`exercise-option-${option.id}`}
              style={[
                styles.exerciseChip,
                exerciseId === option.id ? styles.exerciseChipSelected : null,
              ]}
              onPress={() => setExerciseId(option.id)}
              accessibilityLabel={`Selecionar ${option.name}`}
            >
              <Text
                style={[
                  styles.exerciseChipText,
                  exerciseId === option.id ? styles.exerciseChipTextSelected : null,
                ]}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          testID="weight-input"
          style={styles.input}
          placeholder="Peso (kg)"
          placeholderTextColor={colors.secondaryText}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          accessibilityLabel="Peso"
        />
        <TextInput
          testID="reps-input"
          style={styles.input}
          placeholder="Repetições"
          placeholderTextColor={colors.secondaryText}
          value={reps}
          onChangeText={setReps}
          keyboardType="numeric"
          accessibilityLabel="Repetições"
        />
        <TouchableOpacity
          testID="log-set-button"
          style={styles.logButton}
          onPress={handleLogSet}
          accessibilityLabel="Registrar série"
        >
          <Text style={styles.logButtonText}>Registrar Série</Text>
        </TouchableOpacity>
      </View>

      {/* End Session */}
      <TouchableOpacity
        testID="end-session-button"
        style={styles.endSessionButton}
        onPress={onEndSession}
        accessibilityLabel="Finalizar treino"
      >
        <Text style={styles.endSessionButtonText}>Finalizar treino</Text>
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
  timer: {
    color: colors.primary,
    ...typography.heading,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  volumeContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  volumeLabel: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  volumeValue: {
    color: colors.primaryText,
    ...typography.body,
    fontWeight: '700',
  },
  setList: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  setItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
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
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  exercisePicker: {
    marginBottom: spacing.xs,
  },
  exerciseChip: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
  },
  exerciseChipSelected: {
    backgroundColor: colors.primary,
  },
  exerciseChipText: {
    color: colors.primaryText,
    ...typography.caption,
  },
  exerciseChipTextSelected: {
    color: colors.background,
    fontWeight: '700',
  },
  endSessionButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  endSessionButtonText: {
    color: colors.error,
    ...typography.body,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.background,
    color: colors.primaryText,
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    ...typography.body,
  },
  logButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  logButtonText: {
    color: colors.background,
    ...typography.body,
    fontWeight: '700',
  },
});
