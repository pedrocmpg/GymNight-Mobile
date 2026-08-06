/**
 * Structural test: secret hygiene (Requirements 2.1, 1.4)
 *
 * Asserts no literal Supabase/backend URL or key values exist hardcoded in
 * source files under src/, and that .env.example lists the three expected
 * keys with placeholder (non-functional) values.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../');
const FRONTEND_DIR = path.resolve(__dirname, '../../../');

function walk(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// Real-looking Supabase project ref pattern: https://<20-char-ref>.supabase.co
const REAL_SUPABASE_URL_PATTERN = /https?:\/\/[a-z0-9]{15,}\.supabase\.co/i;
// A JWT-shaped anon key (three base64url segments separated by dots), long enough to be real
const JWT_SHAPED_KEY_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;

describe('Secret hygiene', () => {
  const sourceFiles = walk(SRC_DIR, ['.ts', '.tsx', '.js', '.jsx', '.json']);

  it('contains no hardcoded real Supabase URL or JWT-shaped anon key', () => {
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(REAL_SUPABASE_URL_PATTERN.test(content)).toBe(false);
      expect(JWT_SHAPED_KEY_PATTERN.test(content)).toBe(false);
    }
  });

  it('.env.example exists with the three expected keys and placeholder values', () => {
    const envExamplePath = path.join(FRONTEND_DIR, '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf-8');
    expect(content).toMatch(/EXPO_PUBLIC_SUPABASE_URL=/);
    expect(content).toMatch(/EXPO_PUBLIC_SUPABASE_ANON_KEY=/);
    expect(content).toMatch(/EXPO_PUBLIC_BACKEND_BASE_URL=/);

    // Placeholder values must not be real/functional
    expect(REAL_SUPABASE_URL_PATTERN.test(content)).toBe(false);
    expect(JWT_SHAPED_KEY_PATTERN.test(content)).toBe(false);
  });

  it('.gitignore excludes local .env files but keeps .env.example tracked', () => {
    const gitignorePath = path.join(FRONTEND_DIR, '..', '..', '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toMatch(/^\.env$/m);
    expect(content).toMatch(/!\.env\.example/);
  });
});
