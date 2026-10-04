/**
 * ScreenHeader — barra de navegação de telas empilhadas (fora das abas):
 * "‹ Voltar" à esquerda, título opcional ao centro, ação à direita.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { colors, layout, spacing, typography } from '../tokens';

export interface ScreenHeaderProps {
  /** Quando ausente, o botão de voltar não é renderizado. */
  onBack?: () => void;
  backLabel?: string;
  /** Título curto centralizado (ou conteúdo próprio, ex.: timer). */
  title?: React.ReactNode;
  /** Conteúdo alinhado à direita (contador de séries, ação, etc). */
  right?: React.ReactNode;
  testID?: string;
}

export function ScreenHeader({
  onBack,
  backLabel = 'Voltar',
  title,
  right,
  testID,
}: ScreenHeaderProps) {
  return (
    <View style={styles.header} testID={testID}>
      <View style={[styles.side, styles.left]}>
        {onBack ? (
          <Button
            label={backLabel}
            onPress={onBack}
            variant="ghost"
            size="sm"
            icon="chevron-left"
            fullWidth={false}
            style={styles.backButton}
            testID={testID ? `${testID}-back` : 'screen-header-back'}
            accessibilityLabel={backLabel}
          />
        ) : null}
      </View>
      <View style={styles.center}>
        {typeof title === 'string' ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          (title ?? null)
        )}
      </View>
      <View style={[styles.side, styles.right]}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.controlHeight.md,
    gap: spacing.xs,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    justifyContent: 'flex-start',
  },
  right: {
    justifyContent: 'flex-end',
  },
  center: {
    flexShrink: 1,
    alignItems: 'center',
  },
  // O ghost já não tem superfície; puxar para a borda alinha o chevron ao gutter.
  backButton: {
    paddingHorizontal: 0,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
});
