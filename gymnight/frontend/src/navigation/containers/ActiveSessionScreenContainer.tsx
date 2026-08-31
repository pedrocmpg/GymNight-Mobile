import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveSessionScreen } from '../../screens/ActiveSessionScreen/ActiveSessionScreen';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { useObserveActiveSession } from '../../hooks/useObserveActiveSession';
import { useObserveExerciseCatalog } from '../../hooks/useObserveExerciseCatalog';
import { createLoggedSet, persistLoggedSetWithIsolation } from '../../screens/ActiveSessionScreen/sessionLifecycle';
import { endSessionWithPersistence } from '../../screens/ActiveSessionScreen/endSessionWithPersistence';
import database from '../../db/database';
import { createActiveSessionDatabaseProvider, createExerciseCatalogDatabaseProvider } from '../watermelonProviders';
import { colors } from '../../designSystem/tokens';

export interface ActiveSessionScreenContainerProps {
  route: { params: { sessionId: string } };
  onSessionEnded: () => void;
  /** Sai da sessão sem encerrá-la (o "← Voltar" do header, com confirmação). */
  onBack?: () => void;
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
  const {
    session,
    loggedSets,
    totalVolume,
    workoutExercises,
    previousSessionSets,
    workoutName,
  } = useObserveActiveSession(sessionId, provider);
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
      <SafeAreaView style={styles.notFoundContainer} edges={['top']} testID="session-not-found">
        <EmptyState
          message="Sessão não encontrada."
          actionLabel="Voltar"
          onAction={props.onSessionEnded}
          testID="session-not-found-empty"
        />
      </SafeAreaView>
    );
  }

  // Prefer the exercises belonging to this session's workout; fall back to the
  // full catalog for freestyle sessions (no workoutId) or empty workouts.
  const hasWorkout = workoutExercises.length > 0;
  // O catálogo não tem alvos: sem treino definido a grade não se monta e a tela
  // cai no formulário livre, que é o comportamento pretendido.
  const exerciseOptions = hasWorkout
    ? workoutExercises
    : catalogExercises.map((e) => ({ id: e.id, name: e.name }));
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
        completedAt: s.completedAt,
      }))}
      totalVolume={totalVolume}
      exerciseOptions={exerciseOptions}
      onLogSet={handleLogSet}
      onEndSession={handleEndSession}
      workoutName={workoutName}
      hasWorkout={hasWorkout}
      previousSessionSets={previousSessionSets.map((s) => ({
        id: s.id,
        exerciseId: s.exerciseId,
        weight: s.weight,
        repetitions: s.repetitions,
        completedAt: s.completedAt,
      }))}
      onBack={props.onBack}
    />
  );
}

const styles = StyleSheet.create({
  notFoundContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
});
