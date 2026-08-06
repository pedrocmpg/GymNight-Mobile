import React from 'react';
import { ActiveSessionScreen } from '../../screens/ActiveSessionScreen/ActiveSessionScreen';
import { useObserveActiveSession } from '../../hooks/useObserveActiveSession';
import { createLoggedSet, persistLoggedSetWithIsolation } from '../../screens/ActiveSessionScreen/sessionLifecycle';
import database from '../../db/database';
import { createActiveSessionDatabaseProvider } from '../watermelonProviders';

export interface ActiveSessionScreenContainerProps {
  route: { params: { sessionId: string } };
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
  const { session, loggedSets, totalVolume } = useObserveActiveSession(sessionId, provider);

  const handleLogSet = (exerciseId: string, weight: number, reps: number) => {
    void persistLoggedSetWithIsolation({ exerciseId, weight, reps, sessionId }, persistLoggedSet);
  };

  if (!session) return null;

  return (
    <ActiveSessionScreen
      session={{ id: session.id, started_at: session.startedAt }}
      loggedSets={loggedSets.map((s) => ({
        id: s.id,
        exerciseId: s.exerciseId,
        weight: s.weight,
        reps: s.repetitions,
      }))}
      totalVolume={totalVolume}
      onLogSet={handleLogSet}
    />
  );
}
