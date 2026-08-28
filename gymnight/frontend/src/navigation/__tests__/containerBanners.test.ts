/**
 * Wave 2 — os banners de erro dos containers deixam de ser invisíveis.
 *
 * Antes disto, DashboardScreenContainer renderizava assim:
 *
 *     <View testID="logout-error-banner"><Text>{error}</Text></View>
 *
 * Sem `style` nenhum: o `Text` sai na cor padrão (preta) sobre o fundo preto
 * do app — a mensagem existia na árvore, os testes a encontravam, e o usuário
 * não via absolutamente nada. O `Banner` da Wave 1 sempre pinta a cor do
 * texto (há um teste de componente cobrindo isso).
 *
 * Inspeção estática porque o container importa `db/database` no topo e não é
 * renderizável neste ambiente — os testes existentes deste container também
 * exercitam só a lógica pura (ver DashboardScreenContainer.property14).
 */
import * as fs from 'fs';
import * as path from 'path';

const CONTAINERS_DIR = path.resolve(__dirname, '../containers');

function read(file: string): string {
  return fs.readFileSync(path.join(CONTAINERS_DIR, file), 'utf-8');
}

describe('Container error banners', () => {
  const dashboard = read('DashboardScreenContainer.tsx');

  it('DashboardScreenContainer usa o componente Banner', () => {
    expect(dashboard).toMatch(/import \{ Banner \} from '\.\.\/\.\.\/designSystem\/components\/Banner'/);
  });

  it.each(['logout-error-banner', 'start-session-error-banner'])(
    '%s é um Banner de erro, não um View/Text cru',
    (testID) => {
      expect(dashboard).toMatch(
        new RegExp(`<Banner\\s+message=\\{[\\w.]+\\}\\s+variant="error"\\s+testID="${testID}"`)
      );
      expect(dashboard).not.toMatch(new RegExp(`<View testID="${testID}">`));
    }
  );

  it('nenhum container renderiza mais <Text> sem estilo dentro de um banner', () => {
    for (const file of fs.readdirSync(CONTAINERS_DIR)) {
      if (!file.endsWith('.tsx')) continue;
      const content = read(file);
      expect(content).not.toMatch(/<View testID="[^"]*banner[^"]*">\s*<Text>/);
    }
  });
});
