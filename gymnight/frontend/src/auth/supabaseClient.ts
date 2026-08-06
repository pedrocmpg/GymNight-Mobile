import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { EnvConfig } from '../config/env';

/**
 * The single source file permitted to call createClient (Requirement 2.3).
 * Called only after the Bootstrap_Sequence has confirmed env validity.
 */
export function createSupabaseClient(config: EnvConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}
