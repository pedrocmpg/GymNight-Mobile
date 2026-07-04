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
 * - onLogSet: callback invoked when the user logs a new set
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
import { colors, typography, spacing, radii } from '../../designSystem/tokens';

export interface ActiveSessionLoggedSet {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  error?: string;
}

export interface ActiveSessionProps {
  session: { id: string; started_at: number };
  loggedSets: ActiveSessionLoggedSet[];
  totalVolume: number;
  onLogSet: (exerciseId: string, weight: number, reps: number) => void;
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
  onLogSet,
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
    <View style={styles.container} testID="active-session-screen">
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
              {item.exerciseId} — {item.weight}kg × {item.reps}
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
        <TextInput
          testID="exercise-id-input"
          style={styles.input}
          placeholder="Exercício ID"
          placeholderTextColor={colors.secondaryText}
          value={exerciseId}
          onChangeText={setExerciseId}
          accessibilityLabel="Exercício ID"
        />
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
    </View>
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
