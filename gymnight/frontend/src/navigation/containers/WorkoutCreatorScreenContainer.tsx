import React, { useState, useEffect } from 'react';
import { WorkoutCreatorScreen } from '../../screens/WorkoutCreatorScreen/WorkoutCreatorScreen';
import { useObserveExerciseCatalog } from '../../hooks/useObserveExerciseCatalog';
import {
  saveWorkoutWithExercises,
  deleteWorkout,
  loadWorkoutForEditing,
  type ExerciseInput,
  type WorkoutForEditing,
} from '../../screens/WorkoutCreatorScreen/saveWorkoutWithExercises';
import database from '../../db/database';
import { createExerciseCatalogDatabaseProvider } from '../watermelonProviders';
import { resolveWorkoutSaveOutcome } from '../workoutCreatorRouting';

export interface WorkoutCreatorScreenContainerProps {
  userId: string;
  /** Presente = editar este treino; ausente = criar um novo. */
  workoutId?: string;
  onSaved: () => void;
  onBack?: () => void;
}

/**
 * Supplies WorkoutCreatorScreen's props from live sources (Requirement 5.3):
 * exercises via useObserveExerciseCatalog, onSave persisting via
 * saveWorkoutWithExercises (upsert quando `workoutId` presente — Wave 8),
 * navigating back only on success (Requirements 8.2-8.4).
 */
export function WorkoutCreatorScreenContainer(props: WorkoutCreatorScreenContainerProps) {
  const [error, setError] = useState<string | null>(null);
  const provider = React.useMemo(() => createExerciseCatalogDatabaseProvider(database), []);
  const { exercises, isLoading: isCatalogLoading } = useObserveExerciseCatalog(provider);

  // Leitura única do treino existente (modo edição) — não reativa, ver
  // loadWorkoutForEditing. `null` continua "ainda não carregou" até resolver;
  // depois disso vira o objeto (treino existe) ou permanece null (não achou).
  const [initialWorkout, setInitialWorkout] = useState<WorkoutForEditing | null>(null);
  const [isWorkoutLoading, setIsWorkoutLoading] = useState(props.workoutId !== undefined);

  useEffect(() => {
    if (!props.workoutId) return;
    let cancelled = false;
    setIsWorkoutLoading(true);
    loadWorkoutForEditing(props.workoutId, database).then((result) => {
      if (cancelled) return;
      setInitialWorkout(result);
      setIsWorkoutLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [props.workoutId]);

  const handleSave = async (name: string, exerciseInputs: ExerciseInput[]) => {
    const result = await saveWorkoutWithExercises(
      props.userId,
      name,
      exerciseInputs,
      database,
      props.workoutId,
    );

    const outcome = resolveWorkoutSaveOutcome(result);
    if (outcome.navigateBack) {
      setError(null);
      props.onSaved();
    } else {
      setError(outcome.errorMessage);
    }
  };

  const handleDelete = async () => {
    if (!props.workoutId) return;
    const result = await deleteWorkout(props.workoutId, database);
    if (result.success) {
      props.onSaved();
    } else {
      setError('Falha ao apagar o treino. Tente novamente.');
    }
  };

  return (
    <WorkoutCreatorScreen
      isLoading={isCatalogLoading || isWorkoutLoading}
      exercises={exercises}
      error={error}
      onSave={handleSave}
      onBack={props.onBack}
      mode={props.workoutId ? 'edit' : 'create'}
      initialWorkout={initialWorkout ?? undefined}
      onDelete={props.workoutId ? handleDelete : undefined}
    />
  );
}
