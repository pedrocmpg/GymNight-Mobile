/**
 * Screen — casca padrão de toda tela: SafeArea, fundo, gutter de 20, título
 * em sentence case e o ritmo vertical de 32 entre blocos.
 *
 *   ┌ header (fixo, opcional) ──────────────┐
 *   │ title / subtitle            titleRight │  ← primeiro item do scroll
 *   │ …children (gap: layout.sectionGap)     │
 *   └ footer (fixo, opcional) — CTA no polegar┘
 *
 * `edges` é obrigatório de propósito: cada tela decide se encosta na borda
 * de baixo (tab bar cuida dela) ou não (tela cheia com footer).
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, layout, spacing, typography } from '../tokens';

export interface ScreenProps {
  edges: Edge[];
  children?: React.ReactNode;
  /** Faixa fixa acima do conteúdo (ScreenHeader, progresso). */
  header?: React.ReactNode;
  /** Faixa fixa abaixo do conteúdo, sobre `surface` com hairline — CTA principal. */
  footer?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Conteúdo à direita do título (avatar, ação). */
  titleRight?: React.ReactNode;
  titleTestID?: string;
  /** Default `true`. Com `false`, children ocupam o espaço restante sem rolagem. */
  scroll?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Estilo extra do container de conteúdo (ex.: centralizar verticalmente). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  scrollTestID?: string;
}

export function Screen({
  edges,
  children,
  header,
  footer,
  title,
  subtitle,
  titleRight,
  titleTestID,
  scroll = true,
  refreshControl,
  contentStyle,
  testID,
  scrollTestID,
}: ScreenProps) {
  const titleBlock = title ? (
    <View style={styles.titleRow}>
      <View style={styles.titleText}>
        <Text style={styles.title} testID={titleTestID} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {titleRight ?? null}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={edges} testID={testID}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          testID={scrollTestID}
        >
          {titleBlock}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.staticContent, contentStyle]}>
          {titleBlock}
          {children}
        </View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: layout.gutter,
  },
  scrollContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: layout.sectionGap,
  },
  staticContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: layout.sectionGap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.title,
    color: colors.primaryText,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border,
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.sm,
  },
});
