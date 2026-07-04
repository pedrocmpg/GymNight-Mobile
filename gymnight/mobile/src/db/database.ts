import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import User from './models/User';
import Exercise from './models/Exercise';
import Workout from './models/Workout';
import WorkoutExercise from './models/WorkoutExercise';
import WorkoutSession from './models/WorkoutSession';
import LoggedSet from './models/LoggedSet';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

/**
 * Instância singleton do WatermelonDB Database.
 * Esta é a ÚNICA fonte de leitura de dados de domínio no app (Requirement 1.1).
 * Nenhuma tela deve ler dados de domínio de Zustand/Context/Redux.
 */
const database = new Database({
  adapter,
  modelClasses: [User, Exercise, Workout, WorkoutExercise, WorkoutSession, LoggedSet],
});

export default database;
