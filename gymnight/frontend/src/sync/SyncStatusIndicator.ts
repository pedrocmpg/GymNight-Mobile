/**
 * Sync_Status_Indicator — Maps sync states to Design_Token colors.
 *
 * The color mapping MUST always reference tokens from the Design_Token_Module
 * (never hardcoded hex values) so that any token update propagates automatically.
 *
 * Mapping:
 *   'synced'  → colors.success
 *   'pending' → colors.error
 *   'syncing' → colors.primary
 *   'offline' → colors.primary
 */
import { colors } from '@/designSystem/tokens';

/**
 * All possible sync states exposed by the SyncEngine/useSyncStatus hook.
 */
export type SyncState = 'synced' | 'pending' | 'syncing' | 'offline';

/**
 * Exhaustive list of all valid SyncState values.
 * Useful for iteration and exhaustiveness checks.
 */
export const ALL_SYNC_STATES: readonly SyncState[] = [
  'synced',
  'pending',
  'syncing',
  'offline',
] as const;

/**
 * Maps a SyncState to its corresponding Design_Token color.
 *
 * This function is the single source of truth for the indicator color.
 * It references the Design_Token_Module directly — no intermediate
 * hardcoded values are used.
 */
export function getSyncStatusColor(state: SyncState): string {
  switch (state) {
    case 'synced':
      return colors.success;
    case 'pending':
      return colors.error;
    case 'syncing':
      return colors.primary;
    case 'offline':
      return colors.primary;
  }
}
