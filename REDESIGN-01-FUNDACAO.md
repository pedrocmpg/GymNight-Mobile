# Wave 0 — Fundação: tokens, fonte, ícones e assets

> Parte de [`REDESIGN-VISUAL.md`](REDESIGN-VISUAL.md). Executar **antes** das outras waves.
> Todos os caminhos são relativos a `gymnight/frontend/` salvo indicação contrária.

## ✅ Concluída em 2026-08-27

Commits: `b203c77` (deps) · `24fd846` (tokens) · `c1d351d` (Inter) · `7b769de` (assets + app.json).
Resultado: **106 suites / 538 testes**, 100% verde.

**Três desvios em relação ao que está especificado abaixo:**

1. **`success` = `#65a30d`** (`C_GREEN_DK`), não `#a2ff00`. Era a saída recomendada pela própria §6 deste documento, para não quebrar o assert de cores distintas do `tokens.test.ts`.
2. **`heading`, `metric`, `captionBold` e `successTint` foram mantidos** como aliases marcados `@deprecated`. A spec mandava renomear `heading` → `h1`, mas `ProgressScreen`, `ActiveSessionScreen` e `StartupErrorScreen` ainda os consomem — removê-los agora quebraria o build antes das waves 2–5 existirem. Saem quando essas telas forem migradas.
3. **Hero em 1080×207**, não 1080×400. O original é 2341×448 (proporção ~5,2:1); forçar 400 de altura distorceria a imagem. A redução de peso que importava aconteceu: 1,8 MB → 319 KB.

**Dois extras não previstos, necessários para a suíte rodar:**
- `src/test/mocks/expoVectorIcons.ts` — o `@expo/vector-icons` toca o `RNVectorIconsManager` nativo já no import e derruba a suíte inteira fora do device.
- `ImageBackground` e `useWindowDimensions` adicionados ao `src/test/mocks/reactNative.ts`.

**Nota:** a suíte de tela não quebrou como esta spec previa — nenhuma delas asseverava literais de cor.

⚠️ O `expo-font` entrou como config plugin no `app.json`, então a próxima execução em device exige **rebuild nativo** (`npx expo run:android --clean`).

---

Esta wave quebra testes de propósito (mudança de tokens). Corrigir antes de seguir para a Wave 1.

---

## 1. A paleta de origem (verbatim do desktop)

Fonte: `c:\Users\User\Documents\Projetos\GymNight-Desktop\src\ui\theme.py`, linhas 10–38.

```python
C_BG            = "#0a0a0a"   # fundo da janela — mais escuro para contraste neon
C_SURFACE       = "#0f0f0f"   # superfície principal
C_CARD          = "#1a1a1a"   # cards gerais — visivelmente mais claro que o fundo
C_STAT_CARD     = "#1a1a1a"   # stat cards — cor própria, independente do fundo
C_CARD2         = "#222222"   # hover e inputs dentro dos cards

C_BORDER        = "#2a2a2a"

C_GREEN         = "#a2ff00"
C_GREEN_ACTIVE  = "#b5f542"   # hover / destaque
C_GREEN_DK      = "#65a30d"
C_GREEN_BG      = "#1a2e0a"
C_ACCENT_MUTED  = "#1a3a00"   # seleção suave
C_GREEN_GLOW    = "rgba(162, 255, 0, 0.5)"  # cor do glow neon

C_TEXT          = "#ffffff"
C_TEXT2         = "#6b7280"
C_TEXT3         = "#6b7280"

C_RED           = "#ef4444"
C_RED_BG        = "#2a0a0a"

RADIUS_SM = 6
RADIUS_MD = 10
RADIUS_LG = 16
```

E a escala tipográfica, de `theme.py` linhas 185–191:

```css
QLabel#h1       { font-size: 36px; font-weight: 800; color: #ffffff; }
QLabel#h2       { font-size: 26px; font-weight: 700; color: #ffffff; }
QLabel#h3       { font-size: 18px; font-weight: 700; color: #ffffff; }
QLabel#sub      { font-size: 14px; color: #6b7280; }
QLabel#green    { color: #a2ff00; font-weight: 700; }
QLabel#stat_val { font-size: 36px; font-weight: 800; color: #ffffff; }
QLabel#stat_lbl { font-size: 13px; color: #6b7280; }
```

Corpo padrão do desktop: `font-size: 15px`, família `'Inter', 'Segoe UI', sans-serif` (`theme.py:46,54,59`).

---

## 2. `src/designSystem/tokens.ts` — reescrever

Este arquivo é a **fonte única de verdade** de todo valor visual do app. Continua **dark-only** — não adicionar tokens de tema claro, há um teste que valida isso.

```ts
/**
 * Design_Token_Module — Single source of truth for all visual tokens.
 *
 * Paleta portada do GymNight-Desktop (src/ui/theme.py). Dark-mode only:
 * nenhum token de light-mode é definido, exportado ou incluído.
 *
 * Todas as telas e componentes DEVEM importar destes tokens em vez de
 * declarar literais de cor / espaçamento / tipografia / raio.
 */
import { Platform } from 'react-native';

export const colors = {
  background: '#0a0a0a',      // C_BG      — fundo da tela
  surface: '#0f0f0f',         // C_SURFACE — tab bar, faixas fixas
  card: '#1a1a1a',            // C_CARD    — cards e stat cards
  cardAlt: '#222222',         // C_CARD2   — inputs dentro de card, estado hover
  border: '#2a2a2a',          // C_BORDER

  primary: '#a2ff00',         // C_GREEN
  primaryHover: '#b5f542',    // C_GREEN_ACTIVE
  primaryDark: '#65a30d',     // C_GREEN_DK — estado pressed
  primaryBg: '#1a2e0a',       // C_GREEN_BG — fundo de badge/ícone
  primaryMuted: '#1a3a00',    // C_ACCENT_MUTED — seleção suave
  onPrimary: '#000000',       // texto/ícone sobre superfície verde

  primaryText: '#ffffff',     // C_TEXT
  secondaryText: '#6b7280',   // C_TEXT2 / C_TEXT3
  tertiaryText: '#9ca3af',    // unidades nos stat cards (dashboard.py:111)

  success: '#a2ff00',
  error: '#ef4444',           // C_RED
  errorBg: '#2a0a0a',         // C_RED_BG

  primaryTint: 'rgba(162, 255, 0, 0.12)',   // hover de botão outline
  errorTint: 'rgba(239, 68, 68, 0.14)',
  overlay: 'rgba(0, 0, 0, 0.85)',           // active_workout.py:964
} as const;

/**
 * ⚠️ ORDEM IMPORTA: tokens.test.ts valida que Object.values(spacing) é
 * estritamente crescente. Novos valores entram na posição correta.
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radii = {
  sm: 6,    // RADIUS_SM
  md: 10,   // RADIUS_MD
  lg: 16,   // RADIUS_LG
  pill: 999,
} as const;

/**
 * Famílias da Inter. No Android o `fontWeight` é IGNORADO quando há
 * `fontFamily` customizada — por isso o peso vira parte do nome da família.
 * Ver §3 deste documento.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

export const typography = {
  h1:        { fontSize: 36, fontFamily: fonts.extraBold },  // QLabel#h1
  h2:        { fontSize: 26, fontFamily: fonts.bold },       // QLabel#h2
  h3:        { fontSize: 18, fontFamily: fonts.bold },       // QLabel#h3
  body:      { fontSize: 15, fontFamily: fonts.regular },    // corpo padrão QSS
  bodyBold:  { fontSize: 15, fontFamily: fonts.bold },
  label:     { fontSize: 14, fontFamily: fonts.bold },       // labels de formulário
  sub:       { fontSize: 13, fontFamily: fonts.medium },     // QLabel#sub / #stat_lbl
  caption:   { fontSize: 12, fontFamily: fonts.medium },
  stat:      { fontSize: 36, fontFamily: fonts.extraBold },  // QLabel#stat_val
  statUnit:  { fontSize: 25, fontFamily: fonts.medium },     // dashboard.py:111
  setNumber: { fontSize: 20, fontFamily: fonts.black },      // active_workout.py:613
} as const;

/**
 * Equivalente ao neon_glow() do desktop (theme.py:249).
 *
 * `boxShadow` é suportado no RN 0.76 com a New Architecture ligada
 * (app.json já tem "newArchEnabled": true). Os campos shadow*/elevation
 * ficam como degradação para o caso de a New Arch estar desligada.
 */
export function glow(
  color: string = colors.primary,
  radius: number = 20,
  opacity: number = 0.35,
) {
  const rgba = hexToRgba(color, opacity);
  return {
    boxShadow: `0px 0px ${radius}px ${rgba}`,
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius / 2,
    shadowOffset: { width: 0, height: 0 },
    ...Platform.select({ android: { elevation: 6 }, default: {} }),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

### Intensidades de glow a usar

O desktop varia muito o glow por contexto. Equivalências práticas:

| Contexto | Desktop | Usar no mobile |
|---|---|---|
| Card genérico, stat card | `neon_glow(blur=20, opacity=60)` | `glow(colors.primary, 16, 0.22)` |
| Card de exercício | `neon_glow(blur=81, opacity=405)` | `glow(colors.primary, 24, 0.30)` |
| Dia ativo da semana | `neon_glow(blur=60, opacity=400)` | `glow(colors.primary, 20, 0.55)` |
| Ícone da aba ativa | `neon_glow(blur=68, opacity=486)` | `glow(colors.primary, 14, 0.50)` |

_(O desktop passa `opacity` acima de 255 porque o `neon_glow` multiplica por 0.37 internamente — os números não são diretamente comparáveis, use a coluna da direita.)_

---

## 3. Fonte Inter

### Instalação

```bash
cd gymnight/frontend
npx expo install expo-font @expo-google-fonts/inter
```

### ⚠️ Gotcha crítico — pesos no Android

No React Native, **o Android ignora `fontWeight` quando existe `fontFamily` customizada**. Definir `{ fontFamily: 'Inter', fontWeight: '800' }` renderiza em peso normal no Android. Cada peso precisa ser uma família própria:

```
Inter_400Regular  Inter_500Medium  Inter_700Bold  Inter_800ExtraBold  Inter_900Black
```

Por isso os tokens de `typography` acima carregam `fontFamily` e **nunca** `fontWeight`. Ao reestilizar as telas, **remover todo `fontWeight`** que sobrar dos estilos antigos — se ficar, no iOS ele briga com a família e no Android é ruído morto.

### Carregamento em `App.tsx`

```tsx
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

// dentro do componente raiz:
const [fontsLoaded] = useFonts({
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
});

if (!fontsLoaded) {
  // reaproveitar o mesmo gate de loading do bootstrap
  return <BootstrapLoading />;
}
```

O `AppNavigator.tsx` já tem um gate de `phase === 'loading'` que renderiza um `ActivityIndicator` de tela cheia. Combinar os dois gates em vez de criar um terceiro — o app não deve piscar duas telas de loading em sequência.

### Mock para os testes

Criar `src/test/mocks/expoFont.ts` seguindo o padrão do `src/test/mocks/reactNativeSvg.ts` que já existe:

```ts
// useFonts sempre resolvido; loadAsync no-op.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: () => true,
}));

jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
  Inter_900Black: 'Inter_900Black',
}));
```

Registrar em `jest.config.js` (`setupFiles`) junto com os mocks existentes.

---

## 4. Ícones

O desktop usa `qtawesome` com FontAwesome 5 Solid. O mobile hoje tem **zero biblioteca de ícones** — só dois SVGs desenhados à mão no `MainTabNavigator.tsx`.

Usar **`@expo/vector-icons`**, que já vem junto com o pacote `expo` (não precisa instalar nada). Importar `FontAwesome5`:

```tsx
import { FontAwesome5 } from '@expo/vector-icons';
<FontAwesome5 name="dumbbell" size={16} color={colors.primary} solid />
```

Mapeamento 1:1 dos ícones usados no desktop:

| Uso | Desktop (`qtawesome`) | `@expo/vector-icons` |
|---|---|---|
| Treinos esta semana | `fa5s.dumbbell` | `dumbbell` |
| Volume total | `fa5s.weight` | `weight-hanging` |
| Streak / Progresso | `fa5s.chart-line` | `chart-line` |
| Calorias _(não usado — ver Wave 3)_ | `fa5s.fire` | `fire` |
| Dia treinado | `fa5s.bolt` | `bolt` |
| Adicionar | `fa5s.plus` | `plus` |
| Voltar | `fa5s.arrow-left` | `arrow-left` |
| Finalizar treino | `fa5s.flag-checkered` | `flag-checkered` |
| Check de série | `fa5s.check` | `check` |
| Cardio | `fa5s.heartbeat` | `heartbeat` |
| Confirmação | `fa5s.question-circle` | `question-circle` |
| Home / aba Treinos | `fa5s.home` | `home` |

Sempre passar `solid` — o FA5 Solid é o estilo que o desktop usa.

---

## 5. Assets

### Hero banner

```bash
cp "c:/Users/User/Documents/Projetos/GymNight-Desktop/assets/images/FUNDO HEADER.png" \
   "c:/Users/User/Documents/Projetos/GymNight-Mobile/gymnight/frontend/assets/hero-header.png"
```

⚠️ Duas coisas:
- **Renomear sem espaço** (`FUNDO HEADER.png` → `hero-header.png`). Espaço em nome de asset causa problema no bundler e no Gradle.
- **Redimensionar para ~1080×400.** O original tem **1,8 MB**, foi feito para janela de desktop. Vai inteiro para o bundle do APK se não for reduzido.

### `app.json`

Duas cores de fundo estão em `#0D0D0D`, que nunca bateu nem com a paleta antiga nem com a nova. Alinhar com `colors.background`:

```jsonc
{
  "expo": {
    "splash": { "backgroundColor": "#0a0a0a" },        // era #0D0D0D
    "android": {
      "adaptiveIcon": { "backgroundColor": "#0a0a0a" } // era #0D0D0D
    }
  }
}
```

O resto do `app.json` fica igual — `userInterfaceStyle: "dark"` e `newArchEnabled: true` já estão certos (a New Arch é o que faz o `boxShadow` do `glow()` funcionar).

---

## 6. Testes desta wave

`src/designSystem/tokens.test.ts` valida três coisas que precisam continuar verdadeiras:

1. **Chaves de cor obrigatórias existem e são distintas entre si**: `background`, `surface`, `primary`, `primaryText`, `secondaryText`, `success`, `error`.
   ⚠️ Na paleta nova, `success` e `primary` são **ambos** `#a2ff00`. Isso **quebra** o teste de distinção. Duas saídas: dar a `success` um valor próprio (sugestão: `#65a30d`, o `C_GREEN_DK`, que o desktop usa como estado positivo/pressed), ou afrouxar o teste. **Preferir dar valor próprio** — manter o teste como guarda-corpo.
2. **`Object.values(spacing)` estritamente crescente**, todos `>= 4`. A escala nova (`4, 8, 12, 16, 24, 32, 40`) satisfaz — só não reordenar as chaves.
3. **Nenhuma chave contendo indicadores de light mode**: `light`, `Light`, `LIGHT`, `lightMode`, `lightBackground`, `lightSurface`, `lightPrimary`, `lightText`, `theme`, `Theme`, `mode`, `variant`, `darkMode`.
   ⚠️ Nada de nomear um token de `theme` ou `variant`. `cardAlt` e `primaryHover` estão seguros.

Também é validado que `typography` tem as chaves `heading`, `body` e `caption`. A escala nova renomeia `heading` → `h1`. **Atualizar esse teste** para as chaves novas (ou manter um alias `heading: typography.h1`).

Depois desta wave, `npm test` vai acusar falha em todas as suites de tela que fazem assert em cores literais. É esperado — essas suites são corrigidas nas waves 3–5. Se quiser manter a suíte verde entre waves, rodar com `--testPathIgnorePatterns` nas telas ainda não migradas.
