/**
 * Structural test: single Backend_Base_URL read site (Requirements 2.4, 2.5)
 *
 * Asserts backendBaseUrl is injected via deps into syncCycleRunner.ts and
 * never re-read from process.env anywhere else in src/sync.
 */
import * as fs from 'fs';
import * as path from 'path';

const SYNC_DIR = path.resolve(__dirname, '../');

function walk(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Sync module Backend_Base_URL read-site enforcement', () => {
  it('no file under src/sync reads process.env directly', () => {
    const files = walk(SYNC_DIR, ['.ts', '.tsx']);
    const offenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/process\.env/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('syncCycleRunner.ts declares backendBaseUrl as an injected dependency', () => {
    const content = fs.readFileSync(path.join(SYNC_DIR, 'syncCycleRunner.ts'), 'utf-8');
    expect(content).toMatch(/backendBaseUrl:\s*string/);
  });
});
