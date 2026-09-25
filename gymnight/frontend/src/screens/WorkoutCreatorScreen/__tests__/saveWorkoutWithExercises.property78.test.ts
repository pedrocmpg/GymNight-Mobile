/**
 * Property-Based Test — Property 78
 *
 * saveWorkoutWithExercises (upsert, Wave 8): remover um exercício de um
 * treino NUNCA apaga o histórico de `logged_sets` daquele exercício —
 * `logged_sets` referencia `exercise_id`, não `workout_exercise_id`
 * (PARIDADE-04-ROTINAS-PERFIL.md §1.3).
 *
 * Feature: PARIDADE-04-ROTINAS-PERFIL.md §1.3, property 78
 */
import * as fc from 'fast-check';
import { saveWorkoutWithExercises, type ExerciseInput } from '../saveWorkoutWithExercises';
import { makeFakeWorkoutDb, type FakeRecord } from '@/test/mocks/fakeWorkoutDb';

const exerciseInputArb: fc.Arbitrary<ExerciseInput> = fc.record({
  exerciseId: fc.uuid(),
  seriesTarget: fc.integer({ min: 1, max: 10 }),
  repsTarget: fc.integer({ min: 1, max: 30 }),
  weightTarget: fc.float({ min: Math.fround(0.5), max: Math.fround(500), noNaN: true }),
});

describe('Property 78: editar um treino nunca apaga logged_sets históricos', () => {
  it('removendo um exercício da seleção, as logged_sets seguem intactas (mesma quantidade e conteúdo)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseInputArb, { minLength: 2, maxLength: 8 }),
        fc.array(fc.record({ id: fc.uuid(), exerciseId: fc.uuid(), weight: fc.float({ min: 0, max: 500, noNaN: true }) }), {
          minLength: 0,
          maxLength: 10,
        }),
        async (originalExercises, loggedSetSeeds) => {
          const loggedSetRecords: FakeRecord[] = loggedSetSeeds.map((s) => ({
            id: s.id,
            _raw: { exercise_id: s.exerciseId, weight: s.weight },
          }));
          const { db, tables } = makeFakeWorkoutDb({ logged_sets: loggedSetRecords });

          const created = await saveWorkoutWithExercises('user-1', 'Treino A', originalExercises, db);
          expect(created.success).toBe(true);
          if (!created.success) return;

          // Edita removendo TODOS os exercícios (pior caso: nenhum sobrevive na seleção).
          const edited = await saveWorkoutWithExercises('user-1', 'Treino A', [], db, created.workoutId);
          expect(edited.success).toBe(true);

          const loggedSetsAfter = [...tables.logged_sets.values()];
          return (
            loggedSetsAfter.length === loggedSetRecords.length &&
            loggedSetsAfter.every((r, i) => r.id === loggedSetRecords[i]?.id)
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('caso concreto: apagar o único exercício do treino preserva as 3 séries já registradas dele', async () => {
    const loggedSets: FakeRecord[] = [
      { id: 'set-1', _raw: { exercise_id: 'ex-1', weight: 80 } },
      { id: 'set-2', _raw: { exercise_id: 'ex-1', weight: 82.5 } },
      { id: 'set-3', _raw: { exercise_id: 'ex-1', weight: 85 } },
    ];
    const { db, tables } = makeFakeWorkoutDb({ logged_sets: loggedSets });

    const created = await saveWorkoutWithExercises(
      'user-1',
      'Treino A',
      [{ exerciseId: 'ex-1', seriesTarget: 3, repsTarget: 10, weightTarget: 80 }],
      db,
    );
    expect(created.success).toBe(true);
    if (!created.success) return;

    // Edita removendo ex-1 da seleção (treino fica sem exercícios).
    const edited = await saveWorkoutWithExercises('user-1', 'Treino A', [], db, created.workoutId);
    expect(edited.success).toBe(true);

    expect(tables.logged_sets.size).toBe(3);
    expect(tables.logged_sets.get('set-1')?._raw.weight).toBe(80);
    expect(tables.logged_sets.get('set-2')?._raw.weight).toBe(82.5);
    expect(tables.logged_sets.get('set-3')?._raw.weight).toBe(85);
  });
});
