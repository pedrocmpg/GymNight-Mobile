/**
 * useObserveExerciseCatalog — hook de Reactive_Query para o catálogo de exercícios.
 *
 * Observa reativamente todos os Exercises disponíveis no WatermelonDB (Requirement 1.1).
 * Usado pela Workout_Creator_Screen para exibir a lista de exercícios no picker.
 *
 * Nenhum dado de domínio é copiado para Zustand/Context (Requirement 1.2, 1.3).
 * Derivações locais (filtro/sort) devem ser feitas com useMemo (Requirement 1.7).
 *
 * Validates: Requirements 1.4, 1.7, 18.4
 */

import { useMemo } from 'react';
import {
  useReactiveQuery,
  type ReactiveObservable,
} from './useReactiveQuery';

/**
 * Interface mínima para dados de Exercise retornados pelo hook.
 */
export interface CatalogExercise {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Resultado retornado pelo hook.
 */
export interface UseObserveExerciseCatalogResult {
  exercises: CatalogExercise[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Interface de database provider para injeção de dependência em testes.
 */
export interface ExerciseCatalogDatabaseProvider {
  observeExercises(): ReactiveObservable<CatalogExercise[]>;
}

/**
 * Hook que observa reativamente o catálogo de exercícios.
 *
 * @param provider - Provider do banco (injeção de dependência para testes)
 */
export function useObserveExerciseCatalog(
  provider: ExerciseCatalogDatabaseProvider,
): UseObserveExerciseCatalogResult {
  const result = useReactiveQuery(
    () => provider.observeExercises(),
    [provider],
  );

  // Derivação via useMemo (Requirement 1.7) — retorna array vazio se sem dados
  const exercises = useMemo(
    () => result.data ?? [],
    [result.data],
  );

  return {
    exercises,
    isLoading: result.isLoading,
    error: result.error,
  };
}
