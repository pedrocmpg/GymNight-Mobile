/**
 * Property 67 (PARIDADE-02-CATALOGO-MUSCULAR.md §6): "migration — Schema v2
 * tem todas as colunas da §2, com os defaults certos", generalizada via
 * fast-check sobre valores arbitrários de linhas v1 — não importa o que
 * estava na linha antiga, as colunas novas sempre chegam com o zero-value
 * documentado em migrations.ts, nunca `undefined`/`null` inesperado.
 *
 * Roda no projeto 'integration-realdb' (ver jest.config.js) com o
 * @nozbe/watermelondb REAL — mesmo aparelho do teste irmão
 * schemaMigration.realdb.test.ts, que prova o caso fixo. Aqui variamos os
 * dados de entrada para não depender de um único exemplo manual.
 */
import { Database, appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { fc, fcAssert, fcAsyncProperty } from '@/test/fcConfig';
import { schema as schemaV2 } from '../schema';
import { migrations } from '../migrations';
import User from '../models/User';
import Exercise from '../models/Exercise';
import Workout from '../models/Workout';
import WorkoutExercise from '../models/WorkoutExercise';
import WorkoutSession from '../models/WorkoutSession';
import LoggedSet from '../models/LoggedSet';
import MuscleGroup from '../models/MuscleGroup';
import ExerciseMuscleMap from '../models/ExerciseMuscleMap';
import ExerciseMetValue from '../models/ExerciseMetValue';
import CardioLog from '../models/CardioLog';

const schemaV1 = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'weight', type: 'number', isOptional: true },
        { name: 'height', type: 'number', isOptional: true },
        { name: 'birth_date', type: 'number', isOptional: true },
        { name: 'gender', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'exercises',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'workouts',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'workout_exercises',
      columns: [
        { name: 'workout_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'series_target', type: 'number' },
        { name: 'reps_target', type: 'number' },
        { name: 'weight_target', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'workout_sessions',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'workout_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'started_at', type: 'number' },
        { name: 'ended_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'logged_sets',
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'weight', type: 'number' },
        { name: 'repetitions', type: 'number' },
        { name: 'estimated_one_rm', type: 'number' },
        { name: 'completed_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});

const V1_MODEL_CLASSES = [User, Exercise, Workout, WorkoutExercise, WorkoutSession, LoggedSet];
const ALL_MODEL_CLASSES = [
  ...V1_MODEL_CLASSES,
  MuscleGroup,
  ExerciseMuscleMap,
  ExerciseMetValue,
  CardioLog,
];

let dbNameCounter = 0;
function freshDbName(): string {
  dbNameCounter += 1;
  return `wave6_migration_property67_${Date.now()}_${dbNameCounter}`;
}

describe('Property 67: schema v2 migration - novas colunas sempre no zero-value certo', () => {
  it('para qualquer linha v1 arbitrária, as colunas novas pós-migration nunca dependem do conteúdo antigo', async () => {
    await fcAssert(
      fcAsyncProperty(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.double({ min: 30, max: 200, noNaN: true }),
        fc.string({ minLength: 1, maxLength: 60 }),
        fc.integer({ min: 1, max: 10 }),
        async (userName, workoutName, userWeight, exerciseName, seriesTarget) => {
          const adapterV1 = new LokiJSAdapter({
            schema: schemaV1,
            dbName: freshDbName(),
            useWebWorker: false,
            useIncrementalIndexedDB: false,
          });
          const dbV1 = new Database({ adapter: adapterV1, modelClasses: V1_MODEL_CLASSES });

          const { userId, workoutId, workoutExerciseId, loggedSetId } = await dbV1.write(
            async () => {
              const user = await dbV1.get<User>('users').create((u) => {
                u.name = userName;
                u.weight = userWeight;
              });
              const exercise = await dbV1.get<Exercise>('exercises').create((e) => {
                e.name = exerciseName;
              });
              const workout = await dbV1.get<Workout>('workouts').create((w) => {
                w.userId = user.id;
                w.name = workoutName;
              });
              const workoutExercise = await dbV1
                .get<WorkoutExercise>('workout_exercises')
                .create((x) => {
                  x.workoutId = workout.id;
                  x.exerciseId = exercise.id;
                  x.seriesTarget = seriesTarget;
                });
              const session = await dbV1.get<WorkoutSession>('workout_sessions').create((s) => {
                s.userId = user.id;
                s.workoutId = workout.id;
                s.startedAt = new Date();
              });
              const loggedSet = await dbV1.get<LoggedSet>('logged_sets').create((s) => {
                s.sessionId = session.id;
                s.exerciseId = exercise.id;
                s.weight = 10;
                s.repetitions = 1;
                s.estimatedOneRm = 10;
                s.completedAt = new Date();
              });
              return {
                userId: user.id,
                workoutId: workout.id,
                workoutExerciseId: workoutExercise.id,
                loggedSetId: loggedSet.id,
              };
            },
          );

          const adapterV2 = await (adapterV1 as unknown as {
            testClone: (opts: object) => Promise<LokiJSAdapter>;
          }).testClone({ schema: schemaV2, migrations });
          const dbV2 = new Database({ adapter: adapterV2, modelClasses: ALL_MODEL_CLASSES });

          const migratedUser = await dbV2.get<User>('users').find(userId);
          const migratedWorkout = await dbV2.get<Workout>('workouts').find(workoutId);
          const migratedWorkoutExercise = await dbV2
            .get<WorkoutExercise>('workout_exercises')
            .find(workoutExerciseId);
          const migratedSet = await dbV2.get<LoggedSet>('logged_sets').find(loggedSetId);

          // Dado antigo preservado, independentemente do valor sorteado.
          expect(migratedUser.name).toBe(userName);
          expect(migratedWorkout.name).toBe(workoutName);

          // Colunas novas: zero-value fixo, nunca influenciado pelo conteúdo
          // antigo da linha (migrations.ts §comentário).
          expect(migratedUser.goal).toBeNull();
          expect(migratedUser.trainingTime).toBeNull();
          expect(migratedWorkout.description).toBe('');
          expect(migratedWorkoutExercise.orderIndex).toBe(0);
          expect(migratedSet.setType).toBe('');
        },
      ),
      { numRuns: 15 },
    );
  });
});
