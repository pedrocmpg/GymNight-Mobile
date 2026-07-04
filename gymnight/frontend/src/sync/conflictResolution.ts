/**
 * conflictResolution — Resolução de conflitos per-column para o Sync_Engine.
 *
 * Implementa Requisito 6.1: quando o pull retorna um registro `updated` cujo
 * `id` também existe na Pending_Sync_Queue local como `updated`, o merge
 * é feito por coluna usando `_changed`:
 *   - Colunas listadas em `_changed` (modificadas localmente) → valor LOCAL vence
 *   - Demais colunas → valor REMOTO (pull) vence
 *   - `_status` permanece `'updated'` para que as colunas locais sejam enviadas
 *     no próximo push
 *   - `_changed` é preservado intacto
 */

/**
 * Registro local com metadados de sync.
 * `_changed` lista as colunas que foram modificadas localmente.
 */
export interface LocalRecord {
  id: string;
  _status: 'updated' | 'created' | 'deleted';
  _changed: string;
  [key: string]: unknown;
}

/**
 * Tombstone recebido no pull — representa um registro deletado no servidor.
 * Contém apenas o id do registro a ser removido.
 */
export interface Tombstone {
  id: string;
}

/**
 * Resultado da resolução de conflito com tombstone.
 */
export interface TombstoneResolution {
  action: 'delete';
  id: string;
}

/**
 * Resultado da resolução de conflito quando a deleção local vence dados entrantes.
 */
export interface LocalDeletedResolution {
  action: 'discard_pull';
  id: string;
  keepDeleted: true;
}

/**
 * Registro remoto vindo do pull — pode ter quaisquer campos.
 */
export interface RemoteRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * Resultado do merge per-column.
 */
export interface MergedRecord {
  id: string;
  _status: 'updated';
  _changed: string;
  [key: string]: unknown;
}

/**
 * Realiza o merge per-column entre um registro local (com modificações pendentes)
 * e um registro remoto recebido via pull.
 *
 * Regras:
 * 1. Colunas em `_changed` → valor do `localRecord` (local vence)
 * 2. Demais colunas → valor do `remoteRecord` (remoto vence)
 * 3. `_status` = 'updated' (permanece pendente para re-push)
 * 4. `_changed` é preservado integralmente
 *
 * @param localRecord  O registro local com `_status = 'updated'` e `_changed`
 * @param remoteRecord O registro remoto recebido no pull
 * @returns O registro merged pronto para substituir o local
 */
export function mergePerColumn(
  localRecord: LocalRecord,
  remoteRecord: RemoteRecord,
): MergedRecord {
  // Parse the _changed field (comma-separated column names)
  const changedColumns = new Set(
    localRecord._changed
      .split(',')
      .map((col) => col.trim())
      .filter((col) => col.length > 0),
  );

  // Start with all remote values as the base
  const merged: MergedRecord = {
    ...remoteRecord,
    _status: 'updated',
    _changed: localRecord._changed,
    id: localRecord.id,
  };

  // For columns listed in _changed, override with local values
  for (const col of changedColumns) {
    if (col in localRecord) {
      merged[col] = localRecord[col];
    }
  }

  return merged;
}

/**
 * Resolve o conflito entre um registro local pendente e um tombstone recebido
 * no pull.
 *
 * Implementa Requisito 6.2: quando o pull inclui um tombstone para um registro
 * que também existe na Pending_Sync_Queue local como `updated` (ou qualquer
 * status pendente), o tombstone SEMPRE vence — o registro local é deletado e
 * qualquer update pendente é descartado.
 *
 * @param localRecord  O registro local com qualquer `_status` pendente
 * @param tombstone    O tombstone recebido (apenas o id do registro deletado)
 * @returns `{ action: 'delete', id }` indicando que o registro deve ser removido
 */
export function resolveTombstoneConflict(
  localRecord: LocalRecord,
  tombstone: Tombstone,
): TombstoneResolution {
  return {
    action: 'delete',
    id: tombstone.id,
  };
}

/**
 * Resolve o conflito entre um registro local com `_status = 'deleted'` e um
 * registro incoming do pull (updated ou created).
 *
 * Implementa Requisito 6.3: quando o pull retorna um registro `updated` ou
 * `created` cujo `id` coincide com um registro local cuja `_status` é `deleted`,
 * a deleção LOCAL SEMPRE vence — os dados entrantes são descartados, o registro
 * local mantém `_status = 'deleted'` para ser incluído no próximo push
 * (propagando a deleção ao servidor).
 *
 * @param localRecord   O registro local com `_status = 'deleted'`
 * @param _pullRecord   O registro remoto recebido no pull (descartado)
 * @returns `{ action: 'discard_pull', id, keepDeleted: true }` indicando que
 *          o pull data é rejeitado e a deleção local permanece pendente
 */
export function resolveLocalDeletedConflict(
  localRecord: LocalRecord,
  _pullRecord: RemoteRecord,
): LocalDeletedResolution {
  return {
    action: 'discard_pull',
    id: localRecord.id,
    keepDeleted: true,
  };
}
