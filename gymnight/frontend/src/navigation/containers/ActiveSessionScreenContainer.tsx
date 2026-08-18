import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ActiveSessionScreen } from '../../screens/ActiveSessionScreen/ActiveSessionScreen';
import { useObserveActiveSession } from '../../hooks/useObserveActiveSession';
import { useObserveExerciseCatalog } from '../../hooks/useObserveExerciseCatalog';
import { createLoggedSet, persistLoggedSetWithIsolation } from '../../screens/ActiveSessionScreen/sessionLifecycle';
import { endSessionWithPersistence } from '../../screens/ActiveSessionScreen/endSessionWithPersistence';
import database from '../../db/database';
import { createActiveSessionDatabaseProvider, createExerciseCatalogDatabaseProvider } from '../watermelonProviders';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';

export interface ActiveSessionScreenContainerProps {
  route: { params: { sessionId: string } };
  onSessionEnded: () => void;
}

async function persistLoggedSet(data: {
  exerciseId: string;
  weight: number;
  reps: number;
  sessionId: string;
}): Promise<string> {
  const loggedSet = createLoggedSet(data.sessionId, data.exerciseId, data.weight, data.reps);
  const record = await database.write(async () => {
    return database.get('logged_sets').create((r: any) => {
      r._raw.session_id = loggedSet.session_id;
      r._raw.exercise_id = loggedSet.exercise_id;
      r._raw.weight = loggedSet.weight;
      r._raw.repetitions = loggedSet.repetitions;
      r._raw.estimated_one_rm = loggedSet.estimated_one_rm;
      r._raw.completed_at = loggedSet.completed_at;
      r._raw.created_at = Date.now();
      r._raw.updated_at = Date.now();
    });
  });
  return record.id;
}

/**
 * Supplies ActiveSessionScreen's props from live sources (Requirement 5.3):
 * session/loggedSets/totalVolume via useObserveActiveSession keyed by
 * route.params.sessionId, onLogSet via sessionLifecycle + isolated persistence.
 */
export function ActiveSessionScreenContainer(props: ActiveSessionScreenContainerProps) {
  const sessionId = props.route.params.sessionId;
  const provider = React.useMemo(() => createActiveSessionDatabaseProvider(database), []);
  const catalogProvider = React.useMemo(() => createExerciseCatalogDatabaseProvider(database), []);
  const { session, loggedSets, totalVolume, workoutExercises } = useObserveActiveSession(sessionId, provider);
  const { exercises: catalogExercises } = useObserveExerciseCatalog(catalogProvider);

  const handleLogSet = (exerciseId: string, weight: number, reps: number) => {
    void persistLoggedSetWithIsolation({ exerciseId, weight, reps, sessionId }, persistLoggedSet);
  };

  const handleEndSession = async () => {
    const result = await endSessionWithPersistence(sessionId);
    if (result.success) {
      props.onSessionEnded();
    }
  };

  if (!session) {
    return (
      <View style={styles.notFoundContainer} testID="session-not-found">
        <Text style={styles.notFoundText}>Sessão não encontrada.</Text>
        <TouchableOpacity
          testID="session-not-found-back-button"
          style={styles.backButton}
          onPress={props.onSessionEnded}
          accessibilityLabel="Voltar ao início"
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prefer the exercises belonging to this session's workout; fall back to the
  // full catalog for freestyle sessions (no workoutId) or empty workouts.
  const exerciseOptions = workoutExercises.length > 0 ? workoutExercises : catalogExercises;
  const nameById = new Map(exerciseOptions.map((e) => [e.id, e.name]));

  return (
    <ActiveSessionScreen
      session={{ id: session.id, started_at: session.startedAt }}
      loggedSets={loggedSets.map((s) => ({
        id: s.id,
        exerciseId: s.exerciseId,
        exerciseName: nameById.get(s.exerciseId) ?? s.exerciseId,
        weight: s.weight,
        reps: s.repetitions,
      }))}
      totalVolume={totalVolume}
      exerciseOptions={exerciseOptions}
      onLogSet={handleLogSet}
      onEndSession={handleEndSession}
    />
  );
}

const styles = StyleSheet.create({
  notFoundContainer: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    color: colors.secondaryText,
    ...typography.body,
    marginBottom: spacing.md,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.background,
    ...typography.body,
    fontWeight: '700',
  },
});
