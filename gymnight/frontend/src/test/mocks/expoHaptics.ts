/**
 * Mock do expo-haptics para testes unitários e de componente.
 *
 * Toda chamada resolve imediatamente; os testes podem inspecionar
 * `selectionAsync` / `impactAsync` / `notificationAsync` como jest.fn().
 *
 * Registrado em jest.config.js (moduleNameMapper).
 */

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Soft = 'soft',
  Rigid = 'rigid',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export const selectionAsync = jest.fn().mockResolvedValue(undefined);
export const impactAsync = jest.fn().mockResolvedValue(undefined);
export const notificationAsync = jest.fn().mockResolvedValue(undefined);
