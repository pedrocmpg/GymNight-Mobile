/**
 * Feature: frontend-backend-integration, Property 1: Env validation reports exactly the offending variables
 * **Validates: Requirements 1.6**
 *
 * For any combination of presence/absence/emptiness/whitespace/URL-validity across
 * EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and EXPO_PUBLIC_BACKEND_BASE_URL,
 * validateEnvConfig SHALL return { valid: false, offending } where offending contains exactly
 * the names of variables that are missing, empty, whitespace-only, or (for the two URL
 * variables) not a syntactically valid absolute URL, and SHALL return { valid: true } if and
 * only if none of the three variables meet any of those conditions.
 */
import * as fc from 'fast-check';
import { validateEnvConfig } from '../env';

type VarKind = 'missing' | 'empty' | 'whitespace' | 'invalidUrl' | 'valid';

const arbVarKindFor = (name: string) =>
  name === 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
    ? fc.constantFrom<VarKind>('missing', 'empty', 'whitespace', 'valid')
    : fc.constantFrom<VarKind>('missing', 'empty', 'whitespace', 'invalidUrl', 'valid');

function valueFor(name: string, kind: VarKind): string | undefined {
  switch (kind) {
    case 'missing':
      return undefined;
    case 'empty':
      return '';
    case 'whitespace':
      return '   \t  ';
    case 'invalidUrl':
      return 'not a url';
    case 'valid':
      return name === 'EXPO_PUBLIC_SUPABASE_ANON_KEY' ? 'anon-key-123' : 'https://example.com';
  }
}

const NAMES = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_BACKEND_BASE_URL',
] as const;

const arbScenario = fc.record({
  EXPO_PUBLIC_SUPABASE_URL: arbVarKindFor('EXPO_PUBLIC_SUPABASE_URL'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: arbVarKindFor('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  EXPO_PUBLIC_BACKEND_BASE_URL: arbVarKindFor('EXPO_PUBLIC_BACKEND_BASE_URL'),
});

describe('Property 1: Env validation reports exactly the offending variables', () => {
  it('offending contains exactly the invalid names, in fixed order', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const source: Record<string, string | undefined> = {};
        const expectedOffending: string[] = [];

        for (const name of NAMES) {
          const kind = scenario[name];
          source[name] = valueFor(name, kind);
          if (kind !== 'valid') {
            expectedOffending.push(name);
          }
        }

        const result = validateEnvConfig(source);

        if (expectedOffending.length === 0) {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.offending).toEqual(expectedOffending);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('returns valid:true only when all three variables are well-formed', () => {
    const result = validateEnvConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      EXPO_PUBLIC_BACKEND_BASE_URL: 'http://192.168.0.102:8000',
    });
    expect(result).toEqual({
      valid: true,
      config: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        backendBaseUrl: 'http://192.168.0.102:8000',
      },
    });
  });
});
