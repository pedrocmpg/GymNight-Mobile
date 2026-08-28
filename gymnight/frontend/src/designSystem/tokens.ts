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
  mutedText: '#3a3a3a',       // "—" do dia sem treino (dashboard.py:190)

  // C_GREEN_DK: valor próprio para não colidir com `primary` — tokens.test.ts
  // exige que as chaves obrigatórias sejam distintas entre si.
  success: '#65a30d',
  error: '#ef4444',           // C_RED
  errorBg: '#2a0a0a',         // C_RED_BG

  primaryTint: 'rgba(162, 255, 0, 0.12)',   // hover de botão outline
  successTint: 'rgba(101, 163, 13, 0.14)',
  errorTint: 'rgba(239, 68, 68, 0.14)',
  overlay: 'rgba(0, 0, 0, 0.85)',           // active_workout.py:964
  scrim: '#000000',                         // degrades do hero (dashboard.py:44)
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
 * Nunca combinar `fontFamily` destes tokens com `fontWeight`.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

export const typography = {
  h1: { fontSize: 36, fontFamily: fonts.extraBold },         // QLabel#h1
  h2: { fontSize: 26, fontFamily: fonts.bold },              // QLabel#h2
  h3: { fontSize: 18, fontFamily: fonts.bold },              // QLabel#h3
  body: { fontSize: 15, fontFamily: fonts.regular },         // corpo padrão QSS
  bodyBold: { fontSize: 15, fontFamily: fonts.bold },
  label: { fontSize: 14, fontFamily: fonts.bold },           // labels de formulário
  sub: { fontSize: 13, fontFamily: fonts.medium },           // QLabel#sub / #stat_lbl
  caption: { fontSize: 12, fontFamily: fonts.medium },
  captionBold: { fontSize: 12, fontFamily: fonts.bold },
  stat: { fontSize: 36, fontFamily: fonts.extraBold },       // QLabel#stat_val
  statUnit: { fontSize: 25, fontFamily: fonts.medium },      // dashboard.py:111
  setNumber: { fontSize: 20, fontFamily: fonts.black },      // active_workout.py:613

  /** @deprecated Aliases da escala antiga; migrar para h1/stat nas waves 2–5. */
  heading: { fontSize: 26, fontFamily: fonts.bold },
  metric: { fontSize: 36, fontFamily: fonts.extraBold },
} as const;

/**
 * Equivalente ao neon_glow() do desktop (theme.py:249).
 *
 * `boxShadow` é suportado no RN 0.76 com a New Architecture ligada
 * (app.json já tem "newArchEnabled": true). Os campos shadow* / elevation
 * ficam como degradação para o caso de a New Arch estar desligada.
 */
export function glow(
  color: string = colors.primary,
  radius: number = 20,
  opacity: number = 0.35
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
