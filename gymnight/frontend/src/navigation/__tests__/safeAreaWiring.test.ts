/**
 * SafeArea aplicada em toda a casca do app.
 *
 * Wave 2 ligou o `react-native-safe-area-context`; o REDESIGN-04 moveu o
 * SafeAreaView para dentro do componente `Screen`, que toda tela usa como
 * raiz — então a trava agora é: (1) o Screen repassa `edges` ao SafeAreaView
 * e (2) cada tela declara o edge set certo em toda raiz `<Screen>`.
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

/** Toda tela usa a casca `Screen`; o edge set que cada uma precisa. */
const SCREENS: ReadonlyArray<readonly [string, readonly string[]]> = [
  // Tela cheia sem tab bar: conteúdo centralizado entre as duas bordas.
  ['src/screens/AuthScreen/AuthScreen.tsx', ['top', 'bottom']],
  // Abas: a tab bar cuida da borda de baixo.
  ['src/screens/DashboardScreen/DashboardScreen.tsx', ['top']],
  ['src/screens/ProgressScreen/ProgressScreen.tsx', ['top']],
  ['src/screens/StatisticsScreen/StatisticsScreen.tsx', ['top']],
  // Tela cheia com rodapé fixo (Finalizar treino): precisa da borda de baixo.
  ['src/screens/ActiveSessionScreen/ActiveSessionScreen.tsx', ['top', 'bottom']],
  // Rodapé fixo com "Salvar treino".
  ['src/screens/WorkoutCreatorScreen/WorkoutCreatorScreen.tsx', ['top', 'bottom']],
];


function parseEdges(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

describe('SafeArea wiring', () => {
  it('App.tsx envolve a navegação inteira num SafeAreaProvider', () => {
    const content = read('App.tsx');
    expect(content).toMatch(/import \{ SafeAreaProvider \} from 'react-native-safe-area-context'/);
    expect(content).toMatch(/<SafeAreaProvider>[\s\S]*<AppNavigator[\s\S]*<\/SafeAreaProvider>/);
  });

  it('Screen repassa `edges` (obrigatório) ao SafeAreaView', () => {
    const content = read('src/designSystem/components/Screen.tsx');
    expect(content).toMatch(/import \{ SafeAreaView, type Edge \} from 'react-native-safe-area-context'/);
    expect(content).toMatch(/^\s*edges: Edge\[\];/m);
    expect(content).toMatch(/<SafeAreaView style=\{styles\.container\} edges=\{edges\}/);
  });

  describe.each(SCREENS)('%s', (screenPath, edges) => {
    const content = read(screenPath);

    it('usa a casca Screen do design system', () => {
      expect(content).toMatch(/import \{ Screen \} from '\.\.\/\.\.\/designSystem\/components\/Screen'/);
      expect(content).not.toMatch(/<SafeAreaView\b/);
    });

    it(`declara edges={${JSON.stringify(edges)}} em toda raiz`, () => {
      const roots = Array.from(content.matchAll(/<Screen\b[^>]*?edges=\{\[([^\]]*)\]\}/g));
      expect(roots.length).toBeGreaterThan(0);
      for (const root of roots) {
        expect(parseEdges(root[1])).toEqual([...edges]);
      }
    });
  });


  it('o estado "sessão não encontrada" do container também respeita a SafeArea', () => {
    const content = read('src/navigation/containers/ActiveSessionScreenContainer.tsx');
    expect(content).toMatch(/import \{ SafeAreaView \} from 'react-native-safe-area-context'/);
    expect(content).toMatch(/<SafeAreaView[^>]*testID="session-not-found"/);
  });
});
