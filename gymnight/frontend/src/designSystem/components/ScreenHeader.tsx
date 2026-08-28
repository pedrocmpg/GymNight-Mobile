/**
 * ScreenHeader — botão "← Voltar" à esquerda e um slot livre à direita.
 * Porta o header do treino ativo (active_workout.py:81-91).
 *
 * O stack raiz roda com `headerShown: false` global, então sem este
 * componente WorkoutCreatorScreen e ActiveSessionScreen não têm nenhuma
 * forma de voltar a não ser salvando/finalizando.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { spacing } from '../tokens';

export interface ScreenHeaderProps {
  /** Quando ausente, o botão de voltar não é renderizado. */
  onBack?: () => void;
  backLabel?: string;
  /** Conteúdo alinhado à direita (contador de séries, ação, etc). */
  right?: React.ReactNode;
  testID?: string;
}

export function ScreenHeader({ onBack, backLabel = 'Voltar', right, testID }: ScreenHeaderProps) {
  return (
    <View style={styles.header} testID={testID}>
      {onBack ? (
        <Button
          label={backLabel}
          onPress={onBack}
          variant="ghost"
          icon="arrow-left"
          fullWidth={false}
          style={styles.backButton}
          testID={testID ? `${testID}-back` : 'screen-header-back'}
          accessibilityLabel={backLabel}
        />
      ) : (
        <View />
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    minHeight: 40,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  right: {
    flexShrink: 1,
  },
});
