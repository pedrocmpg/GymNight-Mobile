import { schema } from '../schema';

describe('WatermelonDB Schema', () => {
  it('should have version 1', () => {
    expect(schema.version).toBe(1);
  });

  it('should define exactly 6 tables', () => {
    expect(schema.tables).toHaveLength(6);
  });

  it('should include all required table names', () => {
    const tableNames = schema.tables.map((t: any) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('exercises');
    expect(tableNames).toContain('workouts');
    expect(tableNames).toContain('workout_exercises');
    expect(tableNames).toContain('workout_sessions');
    expect(tableNames).toContain('logged_sets');
  });

  it('users table should have the correct columns', () => {
    const usersTable = schema.tables.find((t: any) => t.name === 'users');
    const columnNames = usersTable.columns.map((c: any) => c.name);
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('weight');
    expect(columnNames).toContain('height');
    expect(columnNames).toContain('birth_date');
    expect(columnNames).toContain('gender');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('workouts table should have user_id indexed', () => {
    const workoutsTable = schema.tables.find((t: any) => t.name === 'workouts');
    const userIdCol = workoutsTable.columns.find((c: any) => c.name === 'user_id');
    expect(userIdCol.isIndexed).toBe(true);
  });

  it('workout_exercises table should have workout_id and exercise_id indexed', () => {
    const table = schema.tables.find((t: any) => t.name === 'workout_exercises');
    const workoutIdCol = table.columns.find((c: any) => c.name === 'workout_id');
    const exerciseIdCol = table.columns.find((c: any) => c.name === 'exercise_id');
    expect(workoutIdCol.isIndexed).toBe(true);
    expect(exerciseIdCol.isIndexed).toBe(true);
  });

  it('workout_sessions should have workout_id as optional', () => {
    const table = schema.tables.find((t: any) => t.name === 'workout_sessions');
    const workoutIdCol = table.columns.find((c: any) => c.name === 'workout_id');
    expect(workoutIdCol.isOptional).toBe(true);
  });

  it('logged_sets should have session_id and exercise_id indexed', () => {
    const table = schema.tables.find((t: any) => t.name === 'logged_sets');
    const sessionIdCol = table.columns.find((c: any) => c.name === 'session_id');
    const exerciseIdCol = table.columns.find((c: any) => c.name === 'exercise_id');
    expect(sessionIdCol.isIndexed).toBe(true);
    expect(exerciseIdCol.isIndexed).toBe(true);
  });
});
