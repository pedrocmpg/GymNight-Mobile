import React from 'react';
import { ProgressScreen } from '../../screens/ProgressScreen/ProgressScreen';
import { useObserveHistory } from '../../hooks/useObserveHistory';
import { isNewPersonalRecord } from '../../hooks/historyDomainUtils';
import database from '../../db/database';
import { createHistoryDatabaseProvider } from '../watermelonProviders';

export interface ProgressScreenContainerProps {
  userId: string;
}

/**
 * Supplies ProgressScreen's props from live sources: exercises/sessions/1RM
 * series via useObserveHistory keyed by userId. Selected exercise (chip) and
 * new-PR detection for it are local UI state, not part of the hook — same
 * pattern as the exercise picker in ActiveSessionScreenContainer.
 */
export function ProgressScreenContainer(props: ProgressScreenContainerProps) {
  const provider = React.useMemo(() => createHistoryDatabaseProvider(database), []);
  const { exercises, sessions, oneRmSeriesByExercise, isLoading } = useObserveHistory(props.userId, provider);

  const [selectedExerciseId, setSelectedExerciseId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedExerciseId === null && exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id);
    }
  }, [exercises, selectedExerciseId]);

  const oneRmSeries = selectedExerciseId ? oneRmSeriesByExercise.get(selectedExerciseId) ?? [] : [];
  const isNewPr = isNewPersonalRecord(oneRmSeries);

  return (
    <ProgressScreen
      isLoading={isLoading}
      exercises={exercises}
      selectedExerciseId={selectedExerciseId}
      oneRmSeries={oneRmSeries.map((p) => ({ timestampMs: p.timestampMs, value: p.estimatedOneRm }))}
      isNewPersonalRecord={isNewPr}
      sessions={sessions}
      onSelectExercise={setSelectedExerciseId}
    />
  );
}
