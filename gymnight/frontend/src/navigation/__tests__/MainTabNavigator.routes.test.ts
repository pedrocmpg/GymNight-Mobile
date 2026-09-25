/**
 * Structural test: exactly three uniquely named, non-duplicate tabs, mirroring
 * AppNavigator.routes.test.ts's technique for MainTabParamList.
 *
 * Nomes de rota usam letras acentuadas ("Estatísticas") — `\w` não cobre
 * Unicode, então o parsing usa "qualquer coisa até o próximo ':'" em vez de
 * `\w+`.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('Main_Tab_Navigator route names', () => {
  it('declares exactly three uniquely named tabs with no duplicates', () => {
    const content = fs.readFileSync(path.join(__dirname, '../MainTabNavigator.tsx'), 'utf-8');

    const typeMatch = content.match(/MainTabParamList\s*=\s*\{([\s\S]*?)\};/);
    expect(typeMatch).not.toBeNull();

    const tabNames = Array.from(
      (typeMatch as RegExpMatchArray)[1].matchAll(/^\s*([^\s:]+):/gm),
    ).map((m) => m[1]);

    expect(tabNames).toEqual(['Treinos', 'Progresso', 'Estatísticas']);
    expect(new Set(tabNames).size).toBe(tabNames.length);

    const screenNameMatches = Array.from(
      content.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g),
    ).map((m) => m[1]);
    expect(new Set(screenNameMatches).size).toBe(screenNameMatches.length);
    expect(screenNameMatches.sort()).toEqual([...tabNames].sort());
  });
});
