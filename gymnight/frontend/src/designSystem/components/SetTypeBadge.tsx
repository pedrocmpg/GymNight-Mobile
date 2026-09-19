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
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radii, typography } from '../tokens';

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
  const handlePress = () => {
    if (disabled) return;
    onPress();
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.badge, isDefault ? styles.badgeDefault : styles.badgeMarked]}
    >
      <Text style={isDefault ? styles.textDefault : styles.textMarked}>{setType}</Text>
    </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  textDefault: {
    color: colors.mutedText,
    ...typography.caption,
  },
  textMarked: {
    color: colors.primaryText,
    ...typography.caption,
  },
});
