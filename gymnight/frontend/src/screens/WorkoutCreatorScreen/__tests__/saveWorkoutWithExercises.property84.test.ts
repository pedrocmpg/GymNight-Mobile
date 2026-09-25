/**
 * Property-Based Test — Property 84
 *
 * `order_index`: a ordem de seleção sobrevive ao round-trip de salvar
 * (saveWorkoutWithExercises) e reabrir (loadWorkoutForEditing) — antes desta
 * wave a ordem de exibição dependia da ordem de retorno da query, sem
 * garantia nenhuma (PARIDADE-04-ROTINAS-PERFIL.md §1.5).
 *
 * Feature: PARIDADE-04-ROTINAS-PERFIL.md §1.5, property 84
 */
import * as fc from 'fast-check';
import {
  saveWorkoutWithExercises,
  loadWorkoutForEditing,
  type ExerciseInput,
} from '../saveWorkoutWithExercises';
import { makeFakeWorkoutDb } from '@/test/mocks/fakeWorkoutDb';

const exerciseInputArb: fc.Arbitrary<ExerciseInput> = fc.record({
  exerciseId: fc.uuid(),
  seriesTarget: fc.integer({ min: 1, max: 10 }),
  repsTarget: fc.integer({ min: 1, max: 30 }),
  weightTarget: fc.float({ min: Math.fround(0.5), max: Math.fround(500), noNaN: true }),
});

// exerciseId único por entrada — sem isso, duas entradas com o mesmo
// exerciseId tornariam a ordem ambígua para o teste (não para o código).
const uniqueExercisesArb = fc
  .uniqueArray(exerciseInputArb, { minLength: 1, maxLength: 10, selector: (e) => e.exerciseId })
  // fc.uniqueArray pode reordenar internamente; o que importa aqui é a ordem
  // do array final, que é exatamente o que passamos para save/load.
  .map((arr) => arr);

describe('Property 84: order_index sobrevive ao round-trip de salvar e reabrir', () => {
  it('a ordem dos exerciseIds ao reabrir é IDÊNTICA à ordem em que foram salvos (criação)', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueExercisesArb, async (exercises) => {
        const { db } = makeFakeWorkoutDb();

        const created = await saveWorkoutWithExercises('user-1', 'Treino A', exercises, db);
        expect(created.success).toBe(true);
        if (!created.success) return;

        const loaded = await loadWorkoutForEditing(created.workoutId, db);
        expect(loaded).not.toBeNull();

        const originalOrder = exercises.map((e) => e.exerciseId);
        const loadedOrder = loaded!.exercises.map((e) => e.exerciseId);
        return JSON.stringify(originalOrder) === JSON.stringify(loadedOrder);
      }),
      { numRuns: 100 },
    );
  });

  it('a ordem sobrevive também depois de uma EDIÇÃO (nova seleção, nova ordem)', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueExercisesArb, uniqueExercisesArb, async (firstOrder, secondOrder) => {
        const { db } = makeFakeWorkoutDb();

        const created = await saveWorkoutWithExercises('user-1', 'Treino A', firstOrder, db);
        expect(created.success).toBe(true);
        if (!created.success) return;

        const edited = await saveWorkoutWithExercises(
          'user-1',
          'Treino A',
          secondOrder,
          db,
          created.workoutId,
        );
        expect(edited.success).toBe(true);

        const loaded = await loadWorkoutForEditing(created.workoutId, db);
        const loadedOrder = loaded!.exercises.map((e) => e.exerciseId);
        return JSON.stringify(secondOrder.map((e) => e.exerciseId)) === JSON.stringify(loadedOrder);
      }),
      { numRuns: 100 },
    );
  });

  it('caso concreto: 3 exercícios em ordem específica reabrem na mesma ordem', async () => {
    const { db } = makeFakeWorkoutDb();
    const exercises: ExerciseInput[] = [
      { exerciseId: 'ex-c', seriesTarget: 3, repsTarget: 10, weightTarget: 40 },
      { exerciseId: 'ex-a', seriesTarget: 4, repsTarget: 8, weightTarget: 60 },
      { exerciseId: 'ex-b', seriesTarget: 3, repsTarget: 12, weightTarget: 20 },
    ];

    const created = await saveWorkoutWithExercises('user-1', 'Treino A', exercises, db);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const loaded = await loadWorkoutForEditing(created.workoutId, db);
    expect(loaded!.exercises.map((e) => e.exerciseId)).toEqual(['ex-c', 'ex-a', 'ex-b']);
  });

  it('loadWorkoutForEditing devolve null para um workoutId inexistente', async () => {
    const { db } = makeFakeWorkoutDb();
    const loaded = await loadWorkoutForEditing('nao-existe', db);
    expect(loaded).toBeNull();
  });
});
