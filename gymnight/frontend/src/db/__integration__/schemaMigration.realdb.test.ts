/**
 * Gate crítico da Wave 6 (PARIDADE-02-CATALOGO-MUSCULAR.md §1): prova que a
 * migration real v1→v2 (schemaMigrations + motor de migração do WatermelonDB)
 * preserva dados existentes.
 *
 * Roda num projeto Jest separado (ver jest.config.js, project
 * 'integration-realdb') que NÃO aplica o mock de @nozbe/watermelondb usado no
 * resto da suíte — o mock nunca executa migrations de verdade, então não
 * consegue provar isto. Aqui usamos o pacote real com LokiJSAdapter (motor de
 * migração idêntico ao do SQLiteAdapter usado em produção; só o driver de
 * armazenamento difere, e SQLite nativo não está disponível sob Jest/Node).
 *
 * `adapter.testClone()` é a API oficial do LokiJSAdapter para isto: cria um
 * segundo adapter reaproveitando o MESMO estado em memória, mas com
 * schema/migrations diferentes — equivalente a "fechar o app v1, instalar a
 * v2, reabrir", sem precisar de arquivo real em disco.
 */
import { Database, appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

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

// Espelho exato do schema pré-Wave-6 (git show aa31fb6:.../schema.ts) — um
// congelamento histórico deliberado, não deve ser "atualizado" nunca.
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
  return `wave6_migration_test_${Date.now()}_${dbNameCounter}`;
}

/**
 * Lê o documento CRU direto da collection do Loki, sem passar pelo Model
 * (`sanitizedRaw`) — que preenche o zero-value de qualquer coluna declarada
 * em `schema.ts` mesmo que a migration nunca a tenha de fato adicionado à
 * linha armazenada. Só o acesso cru prova que o `addColumns` rodou de
 * verdade; sem isso, uma migration faltando um passo passaria despercebida
 * no LokiJSAdapter (ele é schemaless por baixo — diferente do SQLiteAdapter
 * real, onde faltar uma coluna física quebra a query com "no such column").
 */
interface RawLokiDriver {
  loki: {
    getCollection: (name: string) => {
      findOne: (query: Record<string, unknown>) => Record<string, unknown> | null;
    };
  };
}

function getRawDocument(
  adapter: LokiJSAdapter,
  table: string,
  id: string,
): Record<string, unknown> {
  const driver = (adapter as unknown as { _driver: RawLokiDriver })._driver;
  const doc = driver.loki.getCollection(table).findOne({ id });
  if (!doc) {
    throw new Error(`raw document not found: ${table}/${id}`);
  }
  return doc;
}

async function seedV1Data(dbV1: Database) {
  return dbV1.write(async () => {
    const user = await dbV1.get<User>('users').create((u) => {
      u.name = 'Pedro';
      u.email = 'pedro@example.com';
      u.weight = 80;
      u.height = 178;
    });
    const exercise = await dbV1.get<Exercise>('exercises').create((e) => {
      e.name = 'Supino Reto (Barra)';
    });
    const workout = await dbV1.get<Workout>('workouts').create((w) => {
      w.userId = user.id;
      w.name = 'Treino A';
    });
    const workoutExercise = await dbV1.get<WorkoutExercise>('workout_exercises').create((x) => {
      x.workoutId = workout.id;
      x.exerciseId = exercise.id;
      x.seriesTarget = 4;
      x.repsTarget = 10;
      x.weightTarget = 60;
    });
    const session = await dbV1.get<WorkoutSession>('workout_sessions').create((s) => {
      s.userId = user.id;
      s.workoutId = workout.id;
      s.startedAt = new Date('2026-01-01T10:00:00Z');
    });
    const loggedSet = await dbV1.get<LoggedSet>('logged_sets').create((s) => {
      s.sessionId = session.id;
      s.exerciseId = exercise.id;
      s.weight = 60;
      s.repetitions = 10;
      s.estimatedOneRm = 80;
      s.completedAt = new Date('2026-01-01T10:05:00Z');
    });

    return {
      userId: user.id,
      exerciseId: exercise.id,
      workoutId: workout.id,
      workoutExerciseId: workoutExercise.id,
      sessionId: session.id,
      loggedSetId: loggedSet.id,
    };
  });
}

describe('WatermelonDB schema migration v1 -> v2 (Wave 6, real adapter)', () => {
  it('preserva todas as linhas e colunas existentes, e zero-valora as colunas novas', async () => {
    const adapterV1 = new LokiJSAdapter({
      schema: schemaV1,
      dbName: freshDbName(),
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    const dbV1 = new Database({ adapter: adapterV1, modelClasses: V1_MODEL_CLASSES });

    const ids = await seedV1Data(dbV1);

    // Simula "fechar o app v1, instalar a v2, reabrir": mesmo estado em
    // memória, schema/migrations novos.
    const adapterV2 = await (adapterV1 as unknown as {
      testClone: (opts: object) => Promise<LokiJSAdapter>;
    }).testClone({ schema: schemaV2, migrations });
    const dbV2 = new Database({ adapter: adapterV2, modelClasses: ALL_MODEL_CLASSES });

    const migratedUser = await dbV2.get<User>('users').find(ids.userId);
    expect(migratedUser.name).toBe('Pedro');
    expect(migratedUser.email).toBe('pedro@example.com');
    expect(migratedUser.weight).toBe(80);
    expect(migratedUser.height).toBe(178);
    expect(migratedUser.goal).toBeNull();

    const migratedExercise = await dbV2.get<Exercise>('exercises').find(ids.exerciseId);
    expect(migratedExercise.name).toBe('Supino Reto (Barra)');

    const migratedWorkout = await dbV2.get<Workout>('workouts').find(ids.workoutId);
    expect(migratedWorkout.name).toBe('Treino A');
    expect(migratedWorkout.userId).toBe(ids.userId);
    expect(migratedWorkout.description).toBe('');

    const migratedWorkoutExercise = await dbV2
      .get<WorkoutExercise>('workout_exercises')
      .find(ids.workoutExerciseId);
    expect(migratedWorkoutExercise.seriesTarget).toBe(4);
    expect(migratedWorkoutExercise.repsTarget).toBe(10);
    expect(migratedWorkoutExercise.weightTarget).toBe(60);
    expect(migratedWorkoutExercise.orderIndex).toBe(0);
    // Nível cru: prova que `addColumns` de fato escreveu a coluna na linha
    // (o Model layer sozinho não provaria isto — ver getRawDocument acima).
    expect(getRawDocument(adapterV2, 'workout_exercises', ids.workoutExerciseId).order_index).toBe(
      0,
    );

    const migratedSession = await dbV2.get<WorkoutSession>('workout_sessions').find(ids.sessionId);
    expect(migratedSession.userId).toBe(ids.userId);
    expect(migratedSession.workoutId).toBe(ids.workoutId);

    const migratedSet = await dbV2.get<LoggedSet>('logged_sets').find(ids.loggedSetId);
    expect(migratedSet.weight).toBe(60);
    expect(migratedSet.repetitions).toBe(10);
    expect(migratedSet.estimatedOneRm).toBe(80);
    // Zero-value do WatermelonDB para coluna string não-opcional adicionada
    // por addColumns; tratado como 'N' em todo lugar que lê set_type.
    expect(migratedSet.setType).toBe('');
    expect(getRawDocument(adapterV2, 'logged_sets', ids.loggedSetId).set_type).toBe('');
    expect(getRawDocument(adapterV2, 'users', ids.userId).goal).toBeNull();
    expect(getRawDocument(adapterV2, 'workouts', ids.workoutId).description).toBe('');

    // Tabelas novas existem e são consultáveis (vazias — sem consumidor de
    // UI ainda, mas a Wave 6 já cadastra o schema).
    const muscleGroups = await dbV2.get('muscle_groups').query().fetch();
    expect(muscleGroups).toEqual([]);
    const cardioLogs = await dbV2.get('cardio_logs').query().fetch();
    expect(cardioLogs).toEqual([]);
  });

  it('CONTROLE: sem um caminho de migration, o motor reseta o banco (prova que o teste acima não é vácuo)', async () => {
    const adapterV1 = new LokiJSAdapter({
      schema: schemaV1,
      dbName: freshDbName(),
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    const dbV1 = new Database({ adapter: adapterV1, modelClasses: V1_MODEL_CLASSES });

    const ids = await seedV1Data(dbV1);

    // Mesmo salto de versão (1 -> 2), mas SEM passar `migrations` — é
    // exatamente o erro descrito em migrations.ts: bumpar schema.ts sem uma
    // migration correspondente. O motor não encontra caminho e reseta.
    const adapterV2NoMigrations = await (adapterV1 as unknown as {
      testClone: (opts: object) => Promise<LokiJSAdapter>;
    }).testClone({ schema: schemaV2 });
    const dbV2NoMigrations = new Database({
      adapter: adapterV2NoMigrations,
      modelClasses: ALL_MODEL_CLASSES,
    });

    await expect(dbV2NoMigrations.get<User>('users').find(ids.userId)).rejects.toThrow();
  });
});
