/**
 * Haptics — feedback tátil contido, sempre por intenção (não por API).
 *
 *   selection  tab, chip, PSE, option row, switch, tipo de série
 *   light      botão primário
 *   medium     check de série
 *   success    resumo do treino, treino salvo
 *   warning    abertura de confirmação destrutiva
 *
 * Fire-and-forget: falha do motor (aparelho sem vibração, permissão) é
 * engolida — feedback tátil nunca pode quebrar um fluxo.
 */
import * as Haptics from 'expo-haptics';

export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning';

function fire(effect: () => Promise<void>): void {
  try {
    effect().catch(() => {});
  } catch {
    // Módulo nativo ausente (build antigo sem rebuild) — ignora.
  }
}

export function haptic(kind: HapticKind): void {
  switch (kind) {
    case 'selection':
      fire(() => Haptics.selectionAsync());
      return;
    case 'light':
      fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      return;
    case 'medium':
      fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      return;
    case 'success':
      fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      return;
    case 'warning':
      fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      return;
  }
}
