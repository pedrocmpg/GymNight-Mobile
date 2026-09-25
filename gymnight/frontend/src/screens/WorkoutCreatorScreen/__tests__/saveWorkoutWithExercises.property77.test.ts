/**
 * Property-Based Test — Property 77
 *
 * saveWorkoutWithExercises (upsert, Wave 8): editar um treino existente NUNCA
 * duplica `workout_exercises` — a contagem final bate exatamente com a nova
 * seleção, mesmo quando ela se sobrepõe parcialmente à seleção anterior.
 *
 * Feature: PARIDADE-04-ROTINAS-PERFIL.md §1.3, property 77
 */
import * as fc from 'fast-check';
import { Q } from '@nozbe/watermelondb';
import { saveWorkoutWithExercises, type ExerciseInput } from '../saveWorkoutWithExercises';
import { makeFakeWorkoutDb } from '@/test/mocks/fakeWorkoutDb';

const exerciseInputArb: fc.Arbitrary<ExerciseInput> = fc.record({
  exerciseId: fc.uuid(),
  seriesTarget: fc.integer({ min: 1, max: 10 }),
  repsTarget: fc.integer({ min: 1, max: 30 }),
  weightTarget: fc.float({ min: Math.fround(0.5), max: Math.fround(500), noNaN: true }),
});

describe('Property 77: upsert de treino não duplica workout_exercises', () => {
  it('editar um treino existente deixa a contagem final igual à nova seleção, nunca soma com a antiga', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseInputArb, { minLength: 1, maxLength: 8 }),
        fc.array(exerciseInputArb, { minLength: 0, maxLength: 8 }),
        async (originalExercises, newExercises) => {
          const { db } = makeFakeWorkoutDb();

          const created = await saveWorkoutWithExercises('user-1', 'Treino A', originalExercises, db);
          expect(created.success).toBe(true);
          if (!created.success) return;

          const edited = await saveWorkoutWithExercises(
            'user-1',
            'Treino A (editado)',
            newExercises,
            db,
            created.workoutId,
          );
          expect(edited.success).toBe(true);
          if (!edited.success) return;

          const rows = await db
            .get('workout_exercises')
            .query(Q.where('workout_id', created.workoutId))
            .fetch();

          return rows.length === newExercises.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('editar duas vezes seguidas com a MESMA seleção nunca acumula linhas', async () => {
    const { db } = makeFakeWorkoutDb();
    const exercises: ExerciseInput[] = [
      { exerciseId: 'ex-1', seriesTarget: 3, repsTarget: 10, weightTarget: 40 },
      { exerciseId: 'ex-2', seriesTarget: 4, repsTarget: 8, weightTarget: 60 },
    ];

    const created = await saveWorkoutWithExercises('user-1', 'Treino A', exercises, db);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await saveWorkoutWithExercises('user-1', 'Treino A', exercises, db, created.workoutId);
    await saveWorkoutWithExercises('user-1', 'Treino A', exercises, db, created.workoutId);

    const rows = await db.get('workout_exercises').query(Q.where('workout_id', created.workoutId)).fetch();
    expect(rows.length).toBe(2);
  });

  it('o nome do treino é atualizado, não recriado (mesmo workoutId antes e depois)', async () => {
    const { db } = makeFakeWorkoutDb();
    const created = await saveWorkoutWithExercises(
      'user-1',
      'Nome Original',
      [{ exerciseId: 'ex-1', seriesTarget: 3, repsTarget: 10, weightTarget: 40 }],
      db,
    );
    expect(created.success).toBe(true);
    if (!created.success) return;

    const edited = await saveWorkoutWithExercises(
      'user-1',
      'Nome Novo',
      [{ exerciseId: 'ex-1', seriesTarget: 3, repsTarget: 10, weightTarget: 40 }],
      db,
      created.workoutId,
    );
    expect(edited.success).toBe(true);
    if (!edited.success) return;
    expect(edited.workoutId).toBe(created.workoutId);

    const workout = await db.get('workouts').find(created.workoutId);
    expect((workout as unknown as { _raw: { name: string } })._raw.name).toBe('Nome Novo');
  });
});
