/**
 * Structural test: exactly five uniquely named, non-duplicate routes
 * (Requirement 5.2). Wave 8 acrescentou `Onboarding`, entre Auth e Main.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('App_Navigator route names', () => {
  it('declares exactly five uniquely named routes with no duplicates', () => {
    const content = fs.readFileSync(path.join(__dirname, '../AppNavigator.tsx'), 'utf-8');

    const typeMatch = content.match(/RootStackParamList\s*=\s*\{([\s\S]*?)\};/);
    expect(typeMatch).not.toBeNull();

    const routeNames = Array.from((typeMatch as RegExpMatchArray)[1].matchAll(/^\s*(\w+):/gm)).map(
      (m) => m[1]
    );

    expect(routeNames).toEqual(['Auth', 'Onboarding', 'Main', 'WorkoutCreator', 'ActiveSession']);
    expect(new Set(routeNames).size).toBe(routeNames.length);

    const screenNameMatches = Array.from(content.matchAll(/<Stack\.Screen name="(\w+)"/g)).map(
      (m) => m[1]
    );
    expect(new Set(screenNameMatches).size).toBe(screenNameMatches.length);
    expect(screenNameMatches.sort()).toEqual([...routeNames].sort());
  });
});
