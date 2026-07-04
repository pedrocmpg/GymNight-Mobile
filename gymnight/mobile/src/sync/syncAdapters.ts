/**
 * Sync Adapters — construção de payloads de push e pull,
 * e marcação de registros após sincronização bem-sucedida.
 *
 * A função buildPushPayload transforma registros pendentes (com _status)
 * no formato esperado pela API POST /api/v1/sync/push.
 *
 * A função markRecordsAsSynced atualiza o estado da coleção local após
 * um push bem-sucedido (HTTP 200 { status: "ok" }).
 */

/** Tabelas sincronizáveis do GymNight */
export type SyncableTable =
  | 'users'
  | 'exercises'
  | 'workouts'
  | 'workout_exercises'
  | 'workout_sessions'
  | 'logged_sets';

/** Status de um registro pendente de sincronização */
export type SyncStatus = 'created' | 'updated' | 'deleted' | 'synced' | 'quarantined';

/** Registro bruto com seus campos e metadados de sync */
export interface PendingRecord {
  id: string;
  _status: SyncStatus;
  _table: SyncableTable;
  [key: string]: unknown;
}

/** Shape de cada tabela no payload de push */
export interface TableChanges {
  created: RawRecord[];
  updated: RawRecord[];
  deleted: string[];
}

/** Registro bruto sem metadados de sync (_status, _table) */
export type RawRecord = Record<string, unknown>;

/** Payload completo enviado ao POST /api/v1/sync/push */
export interface PushPayload {
  changes: {
    [table: string]: TableChanges;
  };
}

/**
 * Constrói o payload de push agrupando registros pendentes por tabela.
 *
 * - Registros com _status = 'created' vão para o array `created` (como raw, sem _status/_table)
 * - Registros com _status = 'updated' vão para o array `updated` (como raw, sem _status/_table)
 * - Registros com _status = 'deleted' vão para o array `deleted` (apenas o id)
 * - Tabelas sem registros pendentes são omitidas do payload
 */
export function buildPushPayload(pendingRecords: PendingRecord[]): PushPayload {
  const changes: PushPayload['changes'] = {};

  for (const record of pendingRecords) {
    const { _status, _table, ...rawFields } = record;

    if (!changes[_table]) {
      changes[_table] = { created: [], updated: [], deleted: [] };
    }

    const tableChanges = changes[_table];

    switch (_status) {
      case 'created':
        tableChanges.created.push(rawFields);
        break;
      case 'updated':
        tableChanges.updated.push(rawFields);
        break;
      case 'deleted':
        tableChanges.deleted.push(record.id);
        break;
    }
  }

  return { changes };
}

/**
 * Resultado da marcação de registros após push bem-sucedido.
 * Contém a coleção atualizada (registros que permanecem).
 */
export interface MarkSyncedResult {
  /** Coleção atualizada — registros com _status ajustado ou removidos */
  collection: PendingRecord[];
}

/**
 * Marca registros como sincronizados após um push bem-sucedido (HTTP 200 { status: "ok" }).
 *
 * - Registros com _status = 'created' ou 'updated' que estejam no `pushedRecords`
 *   passam a ter _status = 'synced'
 * - Registros com _status = 'deleted' que estejam no `pushedRecords` são removidos
 *   da coleção (tombstone consumido)
 * - Registros NÃO presentes no `pushedRecords` permanecem inalterados
 *
 * A identificação é feita por `id` — um registro é considerado "enviado no push"
 * se seu id aparece no array `pushedRecords`.
 *
 * A função é idempotente: chamá-la múltiplas vezes com o mesmo input produz
 * o mesmo resultado.
 */
export function markRecordsAsSynced(
  allRecords: PendingRecord[],
  pushedRecords: PendingRecord[],
): MarkSyncedResult {
  const pushedIds = new Set(pushedRecords.map((r) => r.id));

  const collection: PendingRecord[] = [];

  for (const record of allRecords) {
    if (!pushedIds.has(record.id)) {
      // Record was NOT in the push — keep it unchanged
      collection.push(record);
      continue;
    }

    // Record was in the push
    if (record._status === 'deleted') {
      // Deleted records are removed from the collection
      continue;
    }

    // Created/Updated records become synced
    if (record._status === 'created' || record._status === 'updated') {
      collection.push({ ...record, _status: 'synced' });
    } else {
      // Already synced (idempotent case) — keep as-is
      collection.push(record);
    }
  }

  return { collection };
}

/**
 * Resultado da quarentena de registros rejeitados com HTTP 403.
 */
export interface QuarantineResult {
  /** Coleção atualizada — registros rejeitados marcados como quarantined, demais inalterados */
  collection: PendingRecord[];
  /** IDs dos registros colocados em quarentena (para fins de diagnóstico/logging) */
  quarantinedIds: string[];
}

/**
 * Coloca em quarentena registros rejeitados por um push HTTP 403.
 *
 * - Registros cujo id aparece no `rejectedRecords` têm _status atualizado para 'quarantined'
 *   → eles NÃO serão re-enviados em próximos ciclos
 * - Os dados dos registros rejeitados são PRESERVADOS na coleção (não são excluídos)
 * - Registros NÃO presentes no `rejectedRecords` permanecem inalterados
 * - Retorna os ids dos registros colocados em quarentena para fins de diagnóstico
 *
 * A função é idempotente: chamá-la múltiplas vezes com o mesmo input produz
 * o mesmo resultado.
 */
export function quarantineRejectedPayload(
  allRecords: PendingRecord[],
  rejectedRecords: PendingRecord[],
): QuarantineResult {
  const rejectedIds = new Set(rejectedRecords.map((r) => r.id));
  const quarantinedIds: string[] = [];

  const collection: PendingRecord[] = allRecords.map((record) => {
    if (rejectedIds.has(record.id)) {
      quarantinedIds.push(record.id);
      return { ...record, _status: 'quarantined' as SyncStatus };
    }
    return record;
  });

  return { collection, quarantinedIds };
}
