/**
 * Tema do React Navigation derivado dos tokens. Sem ele o container usa o
 * DefaultTheme (claro) e pisca branco por baixo das transições de stack.
 */
import { DarkTheme, type Theme } from '@react-navigation/native';
import { colors } from '../designSystem/tokens';

export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.primaryText,
    border: colors.border,
    notification: colors.error,
  },
};
