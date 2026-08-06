/**
 * Structural test: exactly four uniquely named, non-duplicate routes (Requirement 5.2)
 */
import * as fs from 'fs';
import * as path from 'path';

describe('App_Navigator route names', () => {
  it('declares exactly four uniquely named routes with no duplicates', () => {
    const content = fs.readFileSync(path.join(__dirname, '../AppNavigator.tsx'), 'utf-8');

    const typeMatch = content.match(/RootStackParamList\s*=\s*\{([\s\S]*?)\};/);
    expect(typeMatch).not.toBeNull();

    const routeNames = Array.from((typeMatch as RegExpMatchArray)[1].matchAll(/^\s*(\w+):/gm)).map(
      (m) => m[1]
    );

    expect(routeNames).toEqual(['Auth', 'Dashboard', 'WorkoutCreator', 'ActiveSession']);
    expect(new Set(routeNames).size).toBe(routeNames.length);

    const screenNameMatches = Array.from(content.matchAll(/<Stack\.Screen name="(\w+)"/g)).map(
      (m) => m[1]
    );
    expect(new Set(screenNameMatches).size).toBe(screenNameMatches.length);
    expect(screenNameMatches.sort()).toEqual([...routeNames].sort());
  });
});
