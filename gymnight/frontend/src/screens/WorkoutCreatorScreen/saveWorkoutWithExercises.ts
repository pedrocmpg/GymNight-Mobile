import { Database, Q } from '@nozbe/watermelondb';
import database from '../../db/database';

export interface ExerciseInput {
  exerciseId: string;
  seriesTarget: number;
  repsTarget: number;
  weightTarget: number;
}

export type SaveWorkoutResult =
  | { success: true; workoutId: string; exerciseCount: number }
  | { success: false; error: Error };

export type DeleteWorkoutResult = { success: true } | { success: false; error: Error };

export interface WorkoutForEditing {
  name: string;
  exercises: ExerciseInput[];
}

/**
 * Carrega um Workout existente e suas WorkoutExercise, ORDENADAS por
 * `order_index`, para pré-preencher o `WorkoutCreatorScreen` em modo edição.
 * Leitura única (não reativa) — a tela de edição é um fluxo de abrir, editar
 * e salvar, não uma visualização ao vivo de mudanças externas concorrentes.
 *
 * Devolve `null` quando o treino não existe (ex: apagado por outro
 * dispositivo entre o toque no lápis e a tela abrir).
 *
 * Validates: PARIDADE-04-ROTINAS-PERFIL.md — property 84 (ordem sobrevive ao round-trip)
 */
export async function loadWorkoutForEditing(
  workoutId: string,
  db: Database = database,
): Promise<WorkoutForEditing | null> {
  try {
    const workout = (await db.get('workouts').find(workoutId)) as unknown as {
      _raw: { name: string };
    };
    const rows = (await db
      .get('workout_exercises')
      .query(Q.where('workout_id', workoutId))
      .fetch()) as unknown as Array<{
      _raw: {
        exercise_id: string;
        series_target: number;
        reps_target: number;
        weight_target: number;
        order_index: number;
      };
    }>;

    const exercises = [...rows]
      .sort((a, b) => a._raw.order_index - b._raw.order_index)
      .map((r) => ({
        exerciseId: r._raw.exercise_id,
        seriesTarget: r._raw.series_target,
        repsTarget: r._raw.reps_target,
        weightTarget: r._raw.weight_target,
      }));

    return { name: workout._raw.name, exercises };
  } catch {
    // .find() rejeita quando o registro não existe (ainda não chegou pelo
    // sync, ou foi apagado) — degrada para null, igual observeWorkoutName.
    return null;
  }
}

/**
 * Cria OU atualiza (upsert) um Workout e suas WorkoutExercise atomicamente
 * dentro de um único `database.write(...)`.
 *
 * Sem `workoutId`: cria um Workout novo (comportamento original).
 * Com `workoutId`: atualiza o nome e substitui TODAS as linhas de
 * `workout_exercises` — "atomic replace", igual ao `RoutineManager.
 * update_routine_template` do desktop (PARIDADE-04-ROTINAS-PERFIL.md §1.3).
 *
 * ⚠️ As linhas antigas são removidas com `markAsDeleted()` (tombstone), nunca
 * `destroyPermanently()` — senão a exclusão nunca sincroniza para o backend.
 * `logged_sets` referencia `exercise_id`, não `workout_exercise_id`, então
 * substituir a seleção de exercícios NUNCA apaga histórico de série alguma.
 *
 * `order_index` grava a ordem de seleção (índice no array `exercises`) —
 * antes desta wave a ordem de exibição dependia da ordem de retorno da
 * query, sem garantia nenhuma.
 *
 * Se qualquer parte falhar, a transação inteira é revertida pelo WatermelonDB
 * — nenhum estado parcial é observável.
 *
 * @param userId - ID do usuário dono do treino (só usado ao CRIAR)
 * @param workoutName - Nome do treino
 * @param exercises - Exercícios selecionados, na ordem de exibição
 * @param db - Instância do banco (injeção para testes)
 * @param workoutId - Presente = editar este treino; ausente = criar um novo
 *
 * @see Requirement 18.3 — Persist Workout and WorkoutExercises in a single local transaction
 * Validates: PARIDADE-04-ROTINAS-PERFIL.md — properties 77, 78, 84
 */
export async function saveWorkoutWithExercises(
  userId: string,
  workoutName: string,
  exercises: ExerciseInput[],
  db: Database = database,
  workoutId?: string,
): Promise<SaveWorkoutResult> {
  try {
    const result = await db.write(async () => {
      const workoutsCollection = db.get('workouts');
      let workout: {
        id: string;
        update: (fn: (r: { _raw: { name: string; updated_at: number } }) => void) => Promise<unknown>;
      };

      if (workoutId) {
        workout = (await workoutsCollection.find(workoutId)) as unknown as typeof workout;
        await workout.update((record) => {
          record._raw.name = workoutName;
          record._raw.updated_at = Date.now();
        });

        const existingExercises = await db
          .get('workout_exercises')
          .query(Q.where('workout_id', workoutId))
          .fetch();
        for (const record of existingExercises) {
          await (record as { markAsDeleted: () => Promise<void> }).markAsDeleted();
        }
      } else {
        workout = (await workoutsCollection.create((record: any) => {
          record._raw.user_id = userId;
          record._raw.name = workoutName;
          record._raw.created_at = Date.now();
          record._raw.updated_at = Date.now();
        })) as unknown as typeof workout;
      }

      const workoutExercisesCollection = db.get('workout_exercises');
      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        await workoutExercisesCollection.create((record: any) => {
          record._raw.workout_id = workout.id;
          record._raw.exercise_id = exercise.exerciseId;
          record._raw.series_target = exercise.seriesTarget;
          record._raw.reps_target = exercise.repsTarget;
          record._raw.weight_target = exercise.weightTarget;
          record._raw.order_index = i;
          record._raw.created_at = Date.now();
          record._raw.updated_at = Date.now();
        });
      }

      return { workoutId: workout.id, exerciseCount: exercises.length };
    });

    return { success: true, workoutId: result.workoutId, exerciseCount: result.exerciseCount };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Apaga um Workout e suas WorkoutExercise (tombstone, nunca hard-delete).
 *
 * `workout_sessions.workout_id` é `SET NULL` no backend (não cascade) — o
 * histórico de sessões e séries sobrevive à exclusão do treino
 * (PARIDADE-04-ROTINAS-PERFIL.md §1.4). `workout_exercises` é marcado como
 * apagado aqui mesmo (client-side) em vez de esperar o cascade do backend
 * ecoar de volta no próximo pull, para a UI local ficar consistente na hora.
 */
export async function deleteWorkout(
  workoutId: string,
  db: Database = database,
): Promise<DeleteWorkoutResult> {
  try {
    await db.write(async () => {
      const workout = await db.get('workouts').find(workoutId);
      const workoutExercises = await db
        .get('workout_exercises')
        .query(Q.where('workout_id', workoutId))
        .fetch();
      for (const record of workoutExercises) {
        await (record as { markAsDeleted: () => Promise<void> }).markAsDeleted();
      }
      await (workout as { markAsDeleted: () => Promise<void> }).markAsDeleted();
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
