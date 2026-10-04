/**
 * REDESIGN-04 — tab bar minimalista: superfície + hairline, tint
 * monocromático, sem glow e sem altura fixa (o safe area manda).
 *
 * Inspeção estática, mesma convenção de MainTabNavigator.routes.test.ts: o
 * navegador transitivamente puxa mocks nativos profundos do @react-navigation
 * que este ambiente de teste não monta.
 */
import * as fs from 'fs';
import * as path from 'path';

const content = fs.readFileSync(path.join(__dirname, '../MainTabNavigator.tsx'), 'utf-8');

describe('Main_Tab_Navigator styling', () => {
  it('não desenha mais ícones SVG à mão', () => {
    expect(content).not.toMatch(/react-native-svg/);
    expect(content).not.toMatch(/function (Treinos|Progresso)Icon/);
  });

  it('usa os mesmos ícones FontAwesome5 que o desktop usa na navegação', () => {
    expect(content).toMatch(/from '@expo\/vector-icons'/);
    expect(content).toMatch(/name="home"/);
    expect(content).toMatch(/name="chart-line"/);
  });

  it('não usa glow neon em lugar nenhum', () => {
    expect(content).not.toMatch(/glow\(/);
  });

  it('usa a hairline superior e a superfície da paleta, sem literais de cor', () => {
    expect(content).toMatch(/borderTopColor: colors\.border/);
    expect(content).toMatch(/borderTopWidth: layout\.hairline/);
    expect(content).toMatch(/backgroundColor: colors\.surface/);
    expect(content).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('não fixa a altura da tab bar — o inset de baixo do safe area precisa entrar', () => {
    expect(content).not.toMatch(/height:/);
    expect(content).toMatch(/\.\.\.typography\.tab/);
  });

  it('usa tint monocromático (o lima é reservado ao conteúdo)', () => {
    expect(content).toMatch(/tabBarActiveTintColor: colors\.primaryText/);
    expect(content).toMatch(/tabBarInactiveTintColor: colors\.tertiaryText/);
  });

  it('faz fade entre abas e dá haptic de seleção no toque', () => {
    expect(content).toMatch(/animation: 'fade'/);
    expect(content).toMatch(/tabPress: \(\) => haptic\('selection'\)/);
  });
});
