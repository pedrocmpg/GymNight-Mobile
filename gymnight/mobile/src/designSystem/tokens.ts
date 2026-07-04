/**
 * Design_Token_Module — Single source of truth for all visual tokens.
 *
 * This module defines ONLY a dark-mode token set.
 * No light-mode tokens are defined, exported, or included.
 *
 * All screens and components MUST import tokens from this module
 * rather than declaring literal color/spacing/typography/border-radius values.
 */

export const colors = {
  background: '#0B0E11',
  surface: '#151A21',
  primary: '#39FF14',       // neon accent
  primaryText: '#F5F7FA',
  secondaryText: '#9AA5B1',
  success: '#00E38C',
  error: '#FF3B5C',
} as const;

export const typography = {
  heading: { fontSize: 24, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 16,
} as const;
