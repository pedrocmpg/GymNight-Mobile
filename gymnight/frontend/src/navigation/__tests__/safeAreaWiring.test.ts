/**
 * Wave 2 — SafeArea aplicada em toda a casca do app.
 *
 * `react-native-safe-area-context` estava instalado desde sempre e não era
 * importado em lugar nenhum, então o conteúdo colidia com a status bar e com
 * a barra de navegação do Android. Estes testes travam a correção.
 *
 * Seguem a convenção do repo para invariantes estruturais que não dão para
 * renderizar (ver bootstrapWiring.test.ts, AppNavigator.routes.test.ts,
 * MainTabNavigator.routes.test.ts): inspeção estática do fonte.
 */
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(FRONTEND_ROOT, relativePath), 'utf-8');
}

/** As 5 telas e o edge set que cada uma precisa. */
const SCREENS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['src/screens/AuthScreen/AuthScreen.tsx', ['top']],
  ['src/screens/DashboardScreen/DashboardScreen.tsx', ['top']],
  ['src/screens/ProgressScreen/ProgressScreen.tsx', ['top']],
  ['src/screens/WorkoutCreatorScreen/WorkoutCreatorScreen.tsx', ['top']],
  // Rodapé fixo com o botão de finalizar: precisa também da borda de baixo.
  ['src/screens/ActiveSessionScreen/ActiveSessionScreen.tsx', ['top', 'bottom']],
];

describe('SafeArea wiring', () => {
  it('App.tsx envolve a navegação inteira num SafeAreaProvider', () => {
    const content = read('App.tsx');
    expect(content).toMatch(/import \{ SafeAreaProvider \} from 'react-native-safe-area-context'/);
    expect(content).toMatch(/<SafeAreaProvider>[\s\S]*<AppNavigator[\s\S]*<\/SafeAreaProvider>/);
  });

  describe.each(SCREENS)('%s', (screenPath, edges) => {
    const content = read(screenPath);

    it('importa o SafeAreaView', () => {
      expect(content).toMatch(/import \{ SafeAreaView \} from 'react-native-safe-area-context'/);
    });

    it('não deixa nenhuma raiz como <View style={styles.container}>', () => {
      expect(content).not.toMatch(/<View style=\{styles\.container\}/);
    });

    it(`declara edges={${JSON.stringify(edges)}} em toda raiz`, () => {
      const roots = Array.from(content.matchAll(/<SafeAreaView style=\{styles\.container\} edges=\{\[([^\]]*)\]\}/g));
      expect(roots.length).toBeGreaterThan(0);

      for (const root of roots) {
        const declared = root[1]
          .split(',')
          .map((s) => s.trim().replace(/^'|'$/g, ''))
          .filter(Boolean);
        expect(declared).toEqual([...edges]);
      }
    });

    it('fecha toda raiz com </SafeAreaView>', () => {
      const opened = content.match(/<SafeAreaView\b/g) ?? [];
      const closed = content.match(/<\/SafeAreaView>/g) ?? [];
      expect(closed.length).toBe(opened.length);
    });
  });

  it('o estado "sessão não encontrada" do container também respeita a SafeArea', () => {
    const content = read('src/navigation/containers/ActiveSessionScreenContainer.tsx');
    expect(content).toMatch(/import \{ SafeAreaView \} from 'react-native-safe-area-context'/);
    expect(content).toMatch(/<SafeAreaView[^>]*testID="session-not-found"/);
  });
});
