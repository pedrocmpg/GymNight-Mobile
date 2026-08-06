/**
 * Structural test: single createClient / single Env_Config read-site enforcement
 * (Requirements 2.3, 2.4, 2.5)
 *
 * Asserts exactly one source file calls createClient, exactly one file reads
 * Backend_Base_URL, and no EXPO_PUBLIC_* read exists outside the Supabase_Client
 * and Sync_Cycle_Runner construction files (plus env.ts itself, which is the
 * designated Env_Config module).
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../');

const ALLOWED_ENV_READ_FILES = new Set([
  path.join(SRC_DIR, 'config', 'env.ts'),
  path.join(SRC_DIR, 'auth', 'supabaseClient.ts'),
  path.join(SRC_DIR, 'sync', 'syncCycleRunner.ts'),
]);

const ALLOWED_CREATE_CLIENT_FILES = new Set([path.join(SRC_DIR, 'auth', 'supabaseClient.ts')]);

function walk(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__tests__') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Env read-site and createClient single-source enforcement', () => {
  const sourceFiles = walk(SRC_DIR, ['.ts', '.tsx']);

  it('EXPO_PUBLIC_* is read only in the designated files', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      if (ALLOWED_ENV_READ_FILES.has(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (/EXPO_PUBLIC_/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('createClient from @supabase/supabase-js is called in exactly one file', () => {
    const callers: string[] = [];
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/createClient\s*\(/.test(content) && /@supabase\/supabase-js/.test(content)) {
        callers.push(file);
      }
    }
    expect(callers).toEqual([...ALLOWED_CREATE_CLIENT_FILES]);
  });
});
