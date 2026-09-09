import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
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
        // v2 (Wave 8 — onboarding): até 2 objetivos, serializados "Hipertrofia,Saúde".
        { name: 'goal', type: 'string', isOptional: true },
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
        // v2 (Wave 8 — editar treino). Não-opcional: linhas antigas ganham '' na migration.
        { name: 'description', type: 'string' },
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
        // v2 (Wave 8 — ordem de exibição). Não-opcional: linhas antigas ganham 0.
        { name: 'order_index', type: 'number' },
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
        // v2 (Wave 6): 'N'|'W'|'D'|'F'. Não-opcional: linhas antigas ganham '' na
        // migration, e '' é tratado como 'N' em todo lugar que lê este campo
        // (não é 'W', então entra no volume normalmente — mesmo comportamento de
        // antes da coluna existir).
        { name: 'set_type', type: 'string' },
        { name: 'completed_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ------------------------------------------------------------------
    // v2 — Wave 6: catálogo muscular (pull-only, sem user_id)
    // ------------------------------------------------------------------
    tableSchema({
      name: 'muscle_groups',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'exercise_muscle_map',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'muscle_group_id', type: 'string', isIndexed: true },
        // 0–1, decimal (percentual de ativação convertido: 70% → 0.7).
        { name: 'contribution', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'exercise_met_values',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'met_value', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ------------------------------------------------------------------
    // v2 — criada agora, consumida na Wave 9 (cardio). Owned pelo usuário
    // indiretamente via session_id → workout_sessions.user_id.
    // ------------------------------------------------------------------
    tableSchema({
      name: 'cardio_logs',
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'cardio_type', type: 'string' },
        { name: 'duration_min', type: 'number' },
        { name: 'distance_km', type: 'number', isOptional: true },
        { name: 'pse', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
