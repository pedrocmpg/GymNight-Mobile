/**
 * WatermelonDB schema migrations.
 *
 * Sem isto, bumpar `schema.ts.version` sem um array `schemaMigrations([...])`
 * correspondente faz o WatermelonDB APAGAR o banco local do usuário no
 * primeiro boot da nova versão — todo treino, toda sessão, todo registro,
 * perdidos silenciosamente (PARIDADE-02-CATALOGO-MUSCULAR.md §1).
 *
 * Migrations são cumulativas e nunca editadas depois de publicadas — uma
 * nova versão de schema sempre ganha uma migration nova, nunca uma
 * alteração numa já existente.
 *
 * v1 → v2 (Wave 6, a única migration de toda a série PARIDADE): carrega de
 * uma vez o schema das waves 6–9 — músculos/MET (6), mais as colunas
 * dormentes de goal/description/order_index/cardio_logs (8–9), que ficam
 * sem consumidor até essas waves rodarem. Um caminho de upgrade só para
 * testar, ao custo de schema sem uso imediato por algumas waves.
 *
 * Colunas novas não-opcionais (`workouts.description`, `workout_exercises.
 * order_index`, `logged_sets.set_type`) recebem o zero-value do WatermelonDB
 * em linhas existentes ('' / 0) — não precisam de tratamento especial: ''
 * para description já É o valor certo, 0 para order_index idem, e '' para
 * set_type é tratado como 'N' em todo lugar que lê o campo (nunca é 'W',
 * então entra no volume como sempre entrou).
 */
import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'users',
          columns: [{ name: 'goal', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'workouts',
          columns: [{ name: 'description', type: 'string' }],
        }),
        addColumns({
          table: 'workout_exercises',
          columns: [{ name: 'order_index', type: 'number' }],
        }),
        addColumns({
          table: 'logged_sets',
          columns: [{ name: 'set_type', type: 'string' }],
        }),
        createTable({
          name: 'muscle_groups',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'exercise_muscle_map',
          columns: [
            { name: 'exercise_id', type: 'string', isIndexed: true },
            { name: 'muscle_group_id', type: 'string', isIndexed: true },
            { name: 'contribution', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'exercise_met_values',
          columns: [
            { name: 'exercise_id', type: 'string', isIndexed: true },
            { name: 'met_value', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
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
    },
  ],
});
