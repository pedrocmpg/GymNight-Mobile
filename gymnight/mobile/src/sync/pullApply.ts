/**
 * pullApply — Aplicação atômica de mudanças de pull no armazenamento local.
 *
 * Implementa Requisito 4.5: aplica todas as mudanças (created/updated/deleted)
 * e só avança `last_pulled_at` APÓS sucesso completo.
 *
 * Implementa Requisito 6.4: se qualquer erro não-transiente ocorrer durante
 * a aplicação, aborta atomicamente — nenhuma mudança parcial persiste e
 * `last_pulled_at` NÃO é avançado.
 */

import type { SyncableTable, RawRecord } from './syncAdapters';

/** Mudanças de uma tabela no pull response */
export interface TablePullChanges {
  created: RawRecord[];
  updated: RawRecord[];
  deleted: string[];
}

/** Resposta do endpoint de pull */
export interface PullResponse {
  changes: {
    [table: string]: TablePullChanges;
  };
  timestamp: number;
}

/** Interface de armazenamento — abstração sobre o store local */
export interface StorageAdapter {
  /**
   * Aplica uma única mudança ao store.
   * Lança erro se a aplicação falhar (ex.: schema mismatch, payload malformado).
   */
  applyChange(
    table: string,
    operation: 'create' | 'update' | 'delete',
    data: RawRecord | string,
  ): void;

  /**
   * Retorna o `last_pulled_at` atualmente persistido.
   */
  getLastPulledAt(): number | null;

  /**
   * Persiste o novo `last_pulled_at`.
   */
  setLastPulledAt(timestamp: number): void;

  /**
   * Cria um snapshot do estado atual para rollback atômico.
   */
  createSnapshot(): unknown;

  /**
   * Restaura o estado a partir de um snapshot (rollback atômico).
   */
  restoreSnapshot(snapshot: unknown): void;
}

/** Resultado da aplicação do pull */
export interface ApplyPullResult {
  success: boolean;
  error?: Error;
}

/**
 * Aplica as mudanças de um pull response ao armazenamento local de forma atômica.
 *
 * - Cria um snapshot antes de iniciar
 * - Aplica todas as mudanças (created/updated/deleted) de todas as tabelas
 * - Se TUDO der certo: avança `last_pulled_at` para `response.timestamp`
 * - Se QUALQUER mudança falhar com erro não-transiente: restaura o snapshot
 *   (nenhuma mudança parcial) e NÃO avança `last_pulled_at`
 *
 * Garantias:
 * 1. Sucesso: todas as mudanças aplicadas E `last_pulled_at` avançado
 * 2. Falha: NENHUMA mudança aplicada E `last_pulled_at` inalterado
 * 3. Nunca existe estado parcialmente aplicado
 */
export function applyPullChanges(
  response: PullResponse,
  storage: StorageAdapter,
): ApplyPullResult {
  // Cria snapshot para possível rollback
  const snapshot = storage.createSnapshot();

  try {
    // Aplica todas as mudanças de todas as tabelas
    for (const [table, changes] of Object.entries(response.changes)) {
      // Aplica created
      for (const record of changes.created) {
        storage.applyChange(table, 'create', record);
      }

      // Aplica updated
      for (const record of changes.updated) {
        storage.applyChange(table, 'update', record);
      }

      // Aplica deleted
      for (const id of changes.deleted) {
        storage.applyChange(table, 'delete', id);
      }
    }

    // Tudo aplicado com sucesso — avança last_pulled_at
    storage.setLastPulledAt(response.timestamp);

    return { success: true };
  } catch (error) {
    // Erro não-transiente: restaura snapshot (rollback atômico)
    storage.restoreSnapshot(snapshot);

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
