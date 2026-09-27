import { schema } from '../schema';

/**
 * `schema.tables`/`table.columns` tipam como `Readonly<TableSchema>` cujo
 * shape confunde o TS ao encadear `.find(...)` diretamente (erro pré-existente
 * "has no call signatures"). Um shape mínimo local, via `unknown`, evita
 * replicar o erro em cada `it()` sem mexer no tipo real do schema nem usar
 * `any` (proibido pelo eslint).
 */
interface TestColumn {
  name: string;
  isOptional?: boolean;
  isIndexed?: boolean;
}

interface TestTable {
  name: string;
  columns: TestColumn[];
}

function findTable(name: string): TestTable {
  const table = (schema.tables as unknown as TestTable[]).find((t) => t.name === name);
  if (!table) throw new Error(`table not found in schema: ${name}`);
  return table;
}

function findColumn(table: TestTable, name: string): TestColumn {
  const column = table.columns.find((c) => c.name === name);
  if (!column) throw new Error(`column not found: ${name}`);
  return column;
}

describe('WatermelonDB Schema', () => {
  it('should have version 3 (v3: onboarding — tempo de treino)', () => {
    expect(schema.version).toBe(3);
  });

  it('should define exactly 10 tables', () => {
    expect(schema.tables).toHaveLength(10);
  });

  it('should include all required table names', () => {
    const tableNames = (schema.tables as unknown as TestTable[]).map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('exercises');
    expect(tableNames).toContain('workouts');
    expect(tableNames).toContain('workout_exercises');
    expect(tableNames).toContain('workout_sessions');
    expect(tableNames).toContain('logged_sets');
    expect(tableNames).toContain('muscle_groups');
    expect(tableNames).toContain('exercise_muscle_map');
    expect(tableNames).toContain('exercise_met_values');
    expect(tableNames).toContain('cardio_logs');
  });

  it('users table should have the correct columns', () => {
    const columnNames = findTable('users').columns.map((c) => c.name);
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('weight');
    expect(columnNames).toContain('height');
    expect(columnNames).toContain('birth_date');
    expect(columnNames).toContain('gender');
    expect(columnNames).toContain('goal');
    expect(columnNames).toContain('training_time');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('workouts table should have description (Wave 8)', () => {
    const columnNames = findTable('workouts').columns.map((c) => c.name);
    expect(columnNames).toContain('description');
  });

  it('workout_exercises table should have order_index (Wave 8)', () => {
    const columnNames = findTable('workout_exercises').columns.map((c) => c.name);
    expect(columnNames).toContain('order_index');
  });

  it('logged_sets table should have set_type (Wave 6)', () => {
    const columnNames = findTable('logged_sets').columns.map((c) => c.name);
    expect(columnNames).toContain('set_type');
  });

  it('muscle_groups table should have name', () => {
    const columnNames = findTable('muscle_groups').columns.map((c) => c.name);
    expect(columnNames).toContain('name');
  });

  it('exercise_muscle_map should have exercise_id and muscle_group_id indexed, and contribution', () => {
    const table = findTable('exercise_muscle_map');
    expect(findColumn(table, 'exercise_id').isIndexed).toBe(true);
    expect(findColumn(table, 'muscle_group_id').isIndexed).toBe(true);
    expect(findColumn(table, 'contribution')).toBeTruthy();
  });

  it('exercise_met_values should have exercise_id indexed and met_value', () => {
    const table = findTable('exercise_met_values');
    expect(findColumn(table, 'exercise_id').isIndexed).toBe(true);
    expect(findColumn(table, 'met_value')).toBeTruthy();
  });

  it('cardio_logs should have session_id indexed and distance_km optional', () => {
    const table = findTable('cardio_logs');
    expect(findColumn(table, 'session_id').isIndexed).toBe(true);
    expect(findColumn(table, 'distance_km').isOptional).toBe(true);
  });

  it('workouts table should have user_id indexed', () => {
    expect(findColumn(findTable('workouts'), 'user_id').isIndexed).toBe(true);
  });

  it('workout_exercises table should have workout_id and exercise_id indexed', () => {
    const table = findTable('workout_exercises');
    expect(findColumn(table, 'workout_id').isIndexed).toBe(true);
    expect(findColumn(table, 'exercise_id').isIndexed).toBe(true);
  });

  it('workout_sessions should have workout_id as optional', () => {
    expect(findColumn(findTable('workout_sessions'), 'workout_id').isOptional).toBe(true);
  });

  it('logged_sets should have session_id and exercise_id indexed', () => {
    const table = findTable('logged_sets');
    expect(findColumn(table, 'session_id').isIndexed).toBe(true);
    expect(findColumn(table, 'exercise_id').isIndexed).toBe(true);
  });
});
