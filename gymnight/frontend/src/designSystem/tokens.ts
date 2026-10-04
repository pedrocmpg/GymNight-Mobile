/**
 * Design_Token_Module — Single source of truth for all visual tokens.
 *
 * Identidade "minimal premium" (REDESIGN-04): preto em camadas, uma hairline,
 * texto em hierarquia com contraste AA e o lima #a2ff00 como acento RARO.
 * Dark-mode only: nenhum token de light-mode é definido, exportado ou incluído.
 *
 * Regras do lima (`colors.primary`):
 *   1. No máximo UM CTA primário por tela.
 *   2. Estado ativo/selecionado (chip, switch, série concluída, dia treinado).
 *   3. Destaque de dado (linha do gráfico, delta positivo, PR).
 *   Nunca em ícones decorativos, títulos, timer ou tint da tab bar.
 *
 * Profundidade vem dos degraus de superfície (background → surface → card →
 * cardAlt) + uma hairline — sem sombras nem glow.
 *
 * Todas as telas e componentes DEVEM importar destes tokens em vez de
 * declarar literais de cor / espaçamento / tipografia / raio.
 */
import type { TextStyle } from 'react-native';

export const colors = {
  background: '#0a0a0a',      // L0 — fundo do app (igual ao splash do app.json)
  surface: '#111113',         // chrome: tab bar, footers fixos, sheets
  card: '#18181b',            // L1 — cards de conteúdo
  cardAlt: '#222226',         // L2 — inputs, chips, controles não marcados
  border: '#2a2a2e',          // hairline de 1px
  divider: 'rgba(255, 255, 255, 0.06)', // separador de linhas dentro de card

  primary: '#a2ff00',         // lima da marca — acento raro (ver regras acima)
  onPrimary: '#000000',       // texto/ícone sobre superfície lima
  primaryTint: 'rgba(162, 255, 0, 0.12)', // halo de sucesso, banner de PR

  primaryText: '#f4f4f5',     // ~18:1 sobre o fundo
  secondaryText: '#a1a1aa',   // ~7.7:1 — subtítulos, labels
  tertiaryText: '#71717a',    // ~4:1 — unidades, placeholders, inativos (nunca corpo)
  mutedText: '#3f3f46',       // decorativo apenas

  success: '#84cc16',
  successTint: 'rgba(132, 204, 22, 0.14)',
  error: '#f87171',
  errorTint: 'rgba(248, 113, 113, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.64)', // scrim de sheets
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
  ml: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
} as const;

export const radii = {
  xs: 4,    // progress bar, badges mínimos
  sm: 8,    // células da grade de séries, segmentos do PSE
  md: 12,   // botões, inputs, icon buttons
  lg: 16,   // cards
  xl: 24,   // topo dos sheets
  pill: 999,
} as const;

/** Medidas semânticas de layout — nenhuma tela declara número mágico. */
export const layout = {
  gutter: spacing.ml,          // margem horizontal de TODA tela
  sectionGap: spacing.xl,      // entre blocos de topo
  blockGap: spacing.sm,        // título de seção → conteúdo
  cardPadding: spacing.md,
  rowMinHeight: 56,
  controlHeight: { sm: 36, md: 52 },
  hitTarget: 44,
  hairline: 1,
} as const;

/**
 * Famílias da Inter. No Android o `fontWeight` é IGNORADO quando há
 * `fontFamily` customizada — por isso o peso vira parte do nome da família.
 * Nunca combinar `fontFamily` destes tokens com `fontWeight`.
 */
export const fonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

// Fora do `as const`: dentro dele vira tupla readonly, que o TextStyle rejeita.
const tabularNums: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8, fontFamily: fonts.semibold },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontFamily: fonts.semibold },
  h2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontFamily: fonts.semibold },
  h3: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontFamily: fonts.regular },
  bodyMedium: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontFamily: fonts.medium },
  bodyStrong: { fontSize: 15, lineHeight: 22, letterSpacing: -0.1, fontFamily: fonts.semibold },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontFamily: fonts.regular },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontFamily: fonts.medium },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, fontFamily: fonts.medium },
  captionStrong: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, fontFamily: fonts.semibold },
  tab: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2, fontFamily: fonts.medium },
  metricXL: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.5,
    fontFamily: fonts.light,
    fontVariant: tabularNums,
  },
  stat: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontFamily: fonts.medium,
    fontVariant: tabularNums,
  },
  statUnit: { fontSize: 15, lineHeight: 20, letterSpacing: 0, fontFamily: fonts.regular },
  numeric: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fonts.medium,
    fontVariant: tabularNums,
  },
} as const;

/** Durações e parâmetros de microinteração — ver designSystem/motion.ts. */
export const motion = {
  duration: { fast: 120, base: 200, slow: 300 },
  pressScale: 0.97,
  /** Distância (px) que o painel do sheet percorre ao entrar. */
  sheetOffset: 32,
} as const;
