import { Session } from './SecureStorage';

/**
 * Represents an item in the pending sync queue.
 */
export interface PendingSyncItem {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
}

/**
 * Represents a domain record in WatermelonDB.
 */
export interface DomainRecord {
  id: string;
  table: string;
  data: Record<string, unknown>;
}

/**
 * The full local state snapshot for the logout decision.
 */
export interface LocalState {
  session: Session | null;
  domainRecords: DomainRecord[];
  pendingQueue: PendingSyncItem[];
}

/**
 * Confirmation prompt callback.
 * Returns true if user confirms, false if user declines.
 */
export type ConfirmationPrompt = () => Promise<boolean>;

/**
 * Port for Supabase session invalidation (best-effort).
 */
export interface SupabaseLogoutPort {
  invalidateSession(): Promise<void>;
}

/**
 * Port for Secure_Storage operations during logout.
 */
export interface LogoutStoragePort {
  clearSession(): Promise<void>;
}

/**
 * Port for wiping domain data during logout.
 */
export interface LogoutWipePort {
  wipeAllTablesAndCursor(): Promise<void>;
}

export type LogoutResult =
  | { outcome: 'aborted' }
  | { outcome: 'completed' }
  | { outcome: 'wipe_failed'; error: Error };

/**
 * LogoutManager handles the logout flow:
 * - If pending queue is non-empty → show confirmation prompt
 * - If user declines → abort completely (NOTHING changes)
 * - If user confirms (or queue is empty) → proceed with logout
 *
 * Key invariant (Property 32 / Requirement 12.2):
 * Declining the confirmation prompt leaves session, domain records,
 * and pending queue byte-for-byte unchanged.
 */
export class LogoutManager {
  private confirmationPrompt: ConfirmationPrompt;
  private supabase: SupabaseLogoutPort;
  private storage: LogoutStoragePort;
  private wipe: LogoutWipePort;

  constructor(deps: {
    confirmationPrompt: ConfirmationPrompt;
    supabase: SupabaseLogoutPort;
    storage: LogoutStoragePort;
    wipe: LogoutWipePort;
  }) {
    this.confirmationPrompt = deps.confirmationPrompt;
    this.supabase = deps.supabase;
    this.storage = deps.storage;
    this.wipe = deps.wipe;
  }

  /**
   * Requests logout. When the pending queue is non-empty, shows a confirmation
   * prompt. If the user declines, NOTHING happens — the function returns
   * { outcome: 'aborted' } with zero side effects.
   */
  async requestLogout(currentState: LocalState): Promise<LogoutResult> {
    // If pending queue is non-empty, require confirmation
    if (currentState.pendingQueue.length > 0) {
      const confirmed = await this.confirmationPrompt();
      if (!confirmed) {
        // User declined — abort completely, no side effects
        return { outcome: 'aborted' };
      }
    }

    // User confirmed or queue was empty — proceed with logout
    // Step 1: Best-effort Supabase invalidation
    try {
      await this.supabase.invalidateSession();
    } catch {
      // Best-effort — ignore network errors
    }

    // Step 2: Clear Secure_Storage (regardless of Supabase result)
    await this.storage.clearSession();

    // Step 3: Wipe all 6 tables + last_pulled_at, with a single retry
    try {
      await this.wipe.wipeAllTablesAndCursor();
    } catch (firstError) {
      // Retry once
      try {
        await this.wipe.wipeAllTablesAndCursor();
      } catch (retryError) {
        return {
          outcome: 'wipe_failed',
          error: retryError instanceof Error ? retryError : new Error('Wipe failed'),
        };
      }
    }

    return { outcome: 'completed' };
  }
}
