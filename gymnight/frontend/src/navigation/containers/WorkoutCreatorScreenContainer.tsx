import React, { useState } from 'react';
import { WorkoutCreatorScreen } from '../../screens/WorkoutCreatorScreen/WorkoutCreatorScreen';
import { useObserveExerciseCatalog } from '../../hooks/useObserveExerciseCatalog';
import { saveWorkoutWithExercises } from '../../screens/WorkoutCreatorScreen/saveWorkoutWithExercises';
import type { ExerciseInput } from '../../screens/WorkoutCreatorScreen/saveWorkoutWithExercises';
import database from '../../db/database';
import { createExerciseCatalogDatabaseProvider } from '../watermelonProviders';
import { resolveWorkoutSaveOutcome } from '../workoutCreatorRouting';

export interface WorkoutCreatorScreenContainerProps {
  onSaved: () => void;
}

/**
 * Supplies WorkoutCreatorScreen's props from live sources (Requirement 5.3):
 * exercises via useObserveExerciseCatalog, onSave persisting via
 * saveWorkoutWithExercises, navigating back only on success (Requirements 8.2-8.4).
 */
export function WorkoutCreatorScreenContainer(props: WorkoutCreatorScreenContainerProps) {
  const [error, setError] = useState<string | null>(null);
  const provider = React.useMemo(() => createExerciseCatalogDatabaseProvider(database), []);
  const { exercises, isLoading } = useObserveExerciseCatalog(provider);

  const handleSave = async (name: string, exerciseInputs: ExerciseInput[]) => {
    const result = await saveWorkoutWithExercises(name, exerciseInputs);

    const outcome = resolveWorkoutSaveOutcome(result);
    if (outcome.navigateBack) {
      setError(null);
      props.onSaved();
    } else {
      setError(outcome.errorMessage);
    }
  };

  return (
    <WorkoutCreatorScreen isLoading={isLoading} exercises={exercises} error={error} onSave={handleSave} />
  );
}
