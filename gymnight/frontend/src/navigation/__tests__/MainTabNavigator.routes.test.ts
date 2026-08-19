/**
 * Structural test: exactly two uniquely named, non-duplicate tabs, mirroring
 * AppNavigator.routes.test.ts's technique for MainTabParamList.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('Main_Tab_Navigator route names', () => {
  it('declares exactly two uniquely named tabs with no duplicates', () => {
    const content = fs.readFileSync(path.join(__dirname, '../MainTabNavigator.tsx'), 'utf-8');

    const typeMatch = content.match(/MainTabParamList\s*=\s*\{([\s\S]*?)\};/);
    expect(typeMatch).not.toBeNull();

    const tabNames = Array.from((typeMatch as RegExpMatchArray)[1].matchAll(/^\s*(\w+):/gm)).map(
      (m) => m[1]
    );

    expect(tabNames).toEqual(['Treinos', 'Progresso']);
    expect(new Set(tabNames).size).toBe(tabNames.length);

    const screenNameMatches = Array.from(content.matchAll(/<Tab\.Screen\s+name="(\w+)"/g)).map(
      (m) => m[1]
    );
    expect(new Set(screenNameMatches).size).toBe(screenNameMatches.length);
    expect(screenNameMatches.sort()).toEqual([...tabNames].sort());
  });
});
