/**
 * Env_Config — reads and validates the three EXPO_PUBLIC_* variables.
 *
 * This is the ONLY file (together with supabaseClient.ts and syncCycleRunner.ts)
 * allowed to read these variables (Requirement 2.5).
 */

export interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  backendBaseUrl: string;
}

export type EnvValidationResult =
  | { valid: true; config: EnvConfig }
  | { valid: false; offending: string[] };

const ENV_VAR_NAMES = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_BACKEND_BASE_URL',
] as const;

const URL_SHAPE_REQUIRED = new Set<string>([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_BACKEND_BASE_URL',
]);

function isBlank(value: string | undefined): boolean {
  return value === undefined || value === '' || /^\s*$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Reads process.env.EXPO_PUBLIC_* and validates presence + URL-well-formedness. */
export function validateEnvConfig(
  source: Record<string, string | undefined> = process.env
): EnvValidationResult {
  const offending: string[] = [];

  for (const name of ENV_VAR_NAMES) {
    const value = source[name];

    if (isBlank(value)) {
      offending.push(name);
      continue;
    }

    if (URL_SHAPE_REQUIRED.has(name) && !isValidUrl(value as string)) {
      offending.push(name);
    }
  }

  if (offending.length > 0) {
    return { valid: false, offending };
  }

  return {
    valid: true,
    config: {
      supabaseUrl: source.EXPO_PUBLIC_SUPABASE_URL as string,
      supabaseAnonKey: source.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
      backendBaseUrl: source.EXPO_PUBLIC_BACKEND_BASE_URL as string,
    },
  };
}
