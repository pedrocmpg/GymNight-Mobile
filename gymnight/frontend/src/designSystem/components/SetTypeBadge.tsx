/**
 * SetTypeBadge — seletor discreto do tipo de série (N/W/D/F), Wave 6
 * (PARIDADE-02-CATALOGO-MUSCULAR.md §4.4). Um toque cicla N → W → D → F → N.
 *
 * 'N' (normal) é o caso esmagadoramente comum e não pode custar atenção
 * extra: fica quase invisível (texto apagado, sem fundo). Qualquer outro
 * tipo ganha destaque (fundo `cardAlt`, texto branco) para ficar claro que a
 * série foi marcada como diferente do padrão.
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../tokens';
import { Touchable } from './Touchable';

export type SetType = 'N' | 'W' | 'D' | 'F';

const CYCLE: SetType[] = ['N', 'W', 'D', 'F'];

/** Próximo tipo no ciclo N → W → D → F → N. Tipo desconhecido cai em 'N'. */
export function nextSetType(current: string): SetType {
  const index = CYCLE.indexOf(current as SetType);
  return CYCLE[(index + 1) % CYCLE.length];
}

export interface SetTypeBadgeProps {
  setType: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function SetTypeBadge({
  setType,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
}: SetTypeBadgeProps) {
  const isDefault = setType === 'N';

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      // 28px visíveis + 8px de folga em cada lado = alvo de 44.
      hitSlop={spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.badge, isDefault ? styles.badgeDefault : styles.badgeMarked]}
    >
      <Text style={isDefault ? styles.textDefault : styles.textMarked}>{setType}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDefault: {
    backgroundColor: 'transparent',
  },
  badgeMarked: {
    backgroundColor: colors.cardAlt,
  },
  textDefault: {
    color: colors.mutedText,
    ...typography.captionStrong,
  },
  textMarked: {
    color: colors.primaryText,
    ...typography.captionStrong,
  },
});
