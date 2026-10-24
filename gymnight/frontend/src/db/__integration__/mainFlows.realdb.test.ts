/**
 * Fluxos principais (criar treino → iniciar sessão → registrar série → ver
 * histórico) contra o WatermelonDB REAL em memória (LokiJS), sem mocks de banco.
 * Inclui o cenário offline: o push falha por rede, nada é perdido, e o próximo
 * ciclo online envia e marca os registros como sincronizados.
 * Dados 100% fictícios.
 */
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { schema } from '../schema';
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
import { saveWorkoutWithExercises, loadWorkoutForEditing, deleteWorkout } from '../../screens/WorkoutCreatorScreen/saveWorkoutWithExercises';
import { startSessionWithPersistence } from '../../screens/ActiveSessionScreen/startSessionWithPersistence';
import { endSessionWithPersistence } from '../../screens/ActiveSessionScreen/endSessionWithPersistence';
import { persistLoggedSet } from '../../screens/ActiveSessionScreen/persistLoggedSet';
import { createHistoryDatabaseProvider } from '../../navigation/watermelonProviders';
import type { ReactiveObservable } from '../../hooks/useReactiveQuery';
import { createSyncCycleRunner, type SyncHttpClient } from '../../sync/syncCycleRunner';

// O módulo real abre o SQLite nativo; os helpers recebem o banco por injeção.
jest.mock('../database', () => ({ __esModule: true, default: {} }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const MODELS = [User, Exercise, Workout, WorkoutExercise, WorkoutSession, LoggedSet, MuscleGroup, ExerciseMuscleMap, ExerciseMetValue, CardioLog];
const USER_ID = 'user-fixture-1';

let counter = 0;
function freshDb(): Database {
  counter += 1;
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    dbName: `main_flows_${Date.now()}_${counter}`,
    useWebWorker: false,
    extraLokiOptions: { autosave: false }, // sem setInterval de autosave: evita "worker process failed to exit"
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: MODELS });
}

async function seedExercise(db: Database, name: string): Promise<string> {
  const rec = await db.write(() =>
    db.get('exercises').create((r: any) => {
      r._raw.name = name;
      r._raw.created_at = Date.now();
      r._raw.updated_at = Date.now();
    }),
  );
  return rec.id;
}

function firstValue<T>(obs: ReactiveObservable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const sub = obs.subscribe({
      next: (v) => {
        resolve(v);
        setTimeout(() => sub.unsubscribe(), 0);
      },
      error: reject,
    });
  });
}

describe('fluxos principais contra WatermelonDB real em memória', () => {
  it('criar treino → sessão → registrar série → histórico', async () => {
    const db = freshDb();
    const exerciseId = await seedExercise(db, 'Supino Fixture');

    const saved = await saveWorkoutWithExercises(USER_ID, 'Treino A Fixture', [
      { exerciseId, seriesTarget: 3, repsTarget: 10, weightTarget: 20 },
    ], db);
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    expect(saved.exerciseCount).toBe(1);

    const loaded = await loadWorkoutForEditing(saved.workoutId, db);
    expect(loaded?.name).toBe('Treino A Fixture');
    expect(loaded?.exercises).toEqual([{ exerciseId, seriesTarget: 3, repsTarget: 10, weightTarget: 20 }]);

    const started = await startSessionWithPersistence(USER_ID, saved.workoutId, db);
    expect(started.success).toBe(true);
    if (!started.success) return;

    const setId = await persistLoggedSet({ sessionId: started.sessionId, exerciseId, weight: 20, reps: 10 }, db);
    const set = await db.get<LoggedSet>('logged_sets').find(setId);
    expect(set.weight).toBe(20);
    expect(set.repetitions).toBe(10);
    expect(set.estimatedOneRm).toBeCloseTo(20 * (1 + 10 / 30), 5); // Epley
    expect(set.setType).toBe('N');

    expect((await endSessionWithPersistence(started.sessionId, db)).success).toBe(true);

    const history = createHistoryDatabaseProvider(db);
    const sessions = await firstValue(history.observeAllSessions(USER_ID));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(started.sessionId);
    expect(sessions[0].endedAt).not.toBeNull();
    expect(sessions[0].workoutId).toBe(saved.workoutId);
    const sets = await firstValue(history.observeAllLoggedSets(USER_ID));
    expect(sets.map((s) => s.id)).toEqual([setId]);
    const names = await firstValue(history.observeWorkoutNames(USER_ID));
    expect(names).toEqual([{ id: saved.workoutId, name: 'Treino A Fixture' }]);
  });

  it('o histórico de outro usuário não aparece', async () => {
    const db = freshDb();
    const exerciseId = await seedExercise(db, 'Agachamento Fixture');
    const other = await startSessionWithPersistence('user-fixture-2', undefined, db);
    if (!other.success) throw other.error;
    await persistLoggedSet({ sessionId: other.sessionId, exerciseId, weight: 50, reps: 5 }, db);

    const history = createHistoryDatabaseProvider(db);
    expect(await firstValue(history.observeAllSessions(USER_ID))).toEqual([]);
    expect(await firstValue(history.observeAllLoggedSets(USER_ID))).toEqual([]);
  });

  it('apagar o treino preserva a sessão no histórico', async () => {
    const db = freshDb();
    const exerciseId = await seedExercise(db, 'Remada Fixture');
    const saved = await saveWorkoutWithExercises(USER_ID, 'Treino B Fixture', [
      { exerciseId, seriesTarget: 3, repsTarget: 8, weightTarget: 30 },
    ], db);
    if (!saved.success) throw saved.error;
    const started = await startSessionWithPersistence(USER_ID, saved.workoutId, db);
    if (!started.success) throw started.error;
    await persistLoggedSet({ sessionId: started.sessionId, exerciseId, weight: 30, reps: 8 }, db);

    expect((await deleteWorkout(saved.workoutId, db)).success).toBe(true);

    const history = createHistoryDatabaseProvider(db);
    expect(await firstValue(history.observeWorkoutNames(USER_ID))).toEqual([]);
    expect(await firstValue(history.observeAllSessions(USER_ID))).toHaveLength(1);
    expect(await firstValue(history.observeAllLoggedSets(USER_ID))).toHaveLength(1);
  });

  describe('offline', () => {
    function makeRunner(db: Database, http: SyncHttpClient) {
      return createSyncCycleRunner({
        backendBaseUrl: 'http://backend.fixture',
        http,
        authInterceptor: { attachAuthHeader: (req: any) => ({ ...req, headers: { Authorization: 'Bearer fixture' } }) } as any,
        tokenRefreshCoordinator: {} as any,
        sessionRefresher: {} as any,
        sessionStore: { getCurrentSession: () => null, set: () => undefined } as any,
        db,
      });
    }
    const pendingCount = async (db: Database) => {
      let n = 0;
      for (const t of ['workouts', 'workout_exercises', 'workout_sessions', 'logged_sets']) {
        const rows = await db.get(t).query().fetch();
        n += rows.filter((r: any) => r.syncStatus !== 'synced').length;
      }
      return n;
    };

    it('sem rede nada se perde; quando volta, envia tudo uma vez e marca como synced', async () => {
      const db = freshDb();
      const exerciseId = await seedExercise(db, 'Leg Press Fixture');

      // tudo isto acontece "offline": só o banco local é tocado
      const saved = await saveWorkoutWithExercises(USER_ID, 'Treino C Fixture', [
        { exerciseId, seriesTarget: 2, repsTarget: 12, weightTarget: 80 },
      ], db);
      if (!saved.success) throw saved.error;
      const started = await startSessionWithPersistence(USER_ID, saved.workoutId, db);
      if (!started.success) throw started.error;
      await persistLoggedSet({ sessionId: started.sessionId, exerciseId, weight: 80, reps: 12 }, db);
      const before = await pendingCount(db);
      expect(before).toBeGreaterThanOrEqual(4);

      // 1) rede fora: o ciclo aborta, tudo continua pendente
      const offline: SyncHttpClient = {
        post: jest.fn(async () => ({ kind: 'network_error' as const, error: new Error('offline') })),
        get: jest.fn(async () => ({ kind: 'network_error' as const, error: new Error('offline') })),
      };
      await makeRunner(db, offline)();
      expect(offline.post).toHaveBeenCalledTimes(1);
      expect(offline.get).not.toHaveBeenCalled();
      expect(await pendingCount(db)).toBe(before);

      // 2) rede volta: push 200 → registros viram synced
      const pushed: any[] = [];
      const online: SyncHttpClient = {
        post: jest.fn(async (_u, body) => {
          pushed.push(body);
          return { kind: 'success' as const, status: 200, body: { status: 'ok' } };
        }),
        get: jest.fn(async () => ({ kind: 'success' as const, status: 200, body: { changes: {}, timestamp: Date.now() } })),
      };
      await makeRunner(db, online)();
      const changes = pushed[0].changes;
      expect(changes.workouts.created).toHaveLength(1);
      expect(changes.workout_exercises.created).toHaveLength(1);
      expect(changes.workout_sessions.created).toHaveLength(1);
      expect(changes.logged_sets.created).toHaveLength(1);
      expect(await pendingCount(db)).toBe(0);

      // 3) próximo ciclo não reenvia nada
      await makeRunner(db, online)();
      expect(online.post).toHaveBeenCalledTimes(1);
    });
  });
});
