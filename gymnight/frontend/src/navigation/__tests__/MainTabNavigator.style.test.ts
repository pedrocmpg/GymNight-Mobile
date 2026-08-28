/**
 * Wave 2 — estética da tab bar alinhada ao GymNight-Desktop.
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

  it('aplica o glow neon só no ícone da aba ativa', () => {
    expect(content).toMatch(/focused \? glow\(colors\.primary, 14, 0\.5\) : undefined/);
  });

  it('usa a borda superior e a superfície da paleta, sem literais de cor', () => {
    expect(content).toMatch(/borderTopColor: colors\.border/);
    expect(content).toMatch(/borderTopWidth: 1/);
    expect(content).toMatch(/backgroundColor: colors\.surface/);
    expect(content).not.toMatch(/rgba\(154, 165, 177/);
  });

  it('dá altura fixa à tab bar e tipografia da escala nova ao label', () => {
    expect(content).toMatch(/height: 62/);
    expect(content).toMatch(/\.\.\.typography\.caption/);
  });

  it('mantém as cores ativa/inativa vindas dos tokens', () => {
    expect(content).toMatch(/tabBarActiveTintColor: colors\.primary/);
    expect(content).toMatch(/tabBarInactiveTintColor: colors\.secondaryText/);
  });
});
