/**
 * ConfirmSheet — confirmação de uma ação (normalmente destrutiva) num Sheet.
 *
 * Os testIDs derivam de `testID`: `${t}-modal`, `${t}-card`, `${t}-yes`,
 * `${t}-no` — os mesmos dos modais que este componente substituiu.
 * Botões empilhados, confirmar primeiro; cancelar é ghost.
 */

import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../tokens';
import { haptic } from '../haptics';
import { Button } from './Button';
import { Sheet } from './Sheet';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  testID: string;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onCancel,
  testID,
}: ConfirmSheetProps) {
  useEffect(() => {
    if (visible && tone === 'danger') haptic('warning');
  }, [visible, tone]);

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      testID={`${testID}-modal`}
      panelTestID={`${testID}-card`}
    >
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={confirmLabel}
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onPress={onConfirm}
          testID={`${testID}-yes`}
        />
        <Button label={cancelLabel} variant="ghost" onPress={onCancel} testID={`${testID}-no`} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
    color: colors.secondaryText,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
