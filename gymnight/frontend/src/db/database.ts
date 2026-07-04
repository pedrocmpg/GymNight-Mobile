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
  // JSI está desabilitado porque o módulo nativo `watermelondb-jsi` (@nozbe/watermelondb 0.27.1)
  // usa `JSIModulePackage`/`JSIModuleSpec`, classes removidas do React Native a partir da
  // migração para a Nova Arquitetura (RN 0.76+ não as expõe mais), o que quebra o build nativo.
  // O adapter cai para o modo bridge assíncrono padrão, que funciona normalmente.
  jsi: false,
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
