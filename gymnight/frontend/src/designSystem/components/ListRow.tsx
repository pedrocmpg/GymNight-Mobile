/**
 * ListRow — linha de lista dentro de um `<Card padding="none">`.
 *
 *   [leading]  Título                     valor  ›  [trailing]
 *              subtítulo
 *   ──────────── (divider inset, opcional)
 *   [children — conteúdo expandido abaixo da linha]
 *
 * `trailing` fica FORA da área pressionável, para que um IconButton/Switch
 * ali não aninhe toques. O testID vai na área pressionável (ou na linha,
 * quando estática).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '../tokens';
import { Touchable } from './Touchable';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Chevron "›" ao fim da área pressionável — indica navegação. */
  showChevron?: boolean;
  onPress?: () => void;
  /** Separador inset abaixo da linha. Default `true`; passe `false` na última. */
  divider?: boolean;
  children?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

export function ListRow({
  title,
  subtitle,
  value,
  leading,
  trailing,
  showChevron = false,
  onPress,
  divider = true,
  children,
  testID,
  accessibilityLabel,
}: ListRowProps) {
  const body = (
    <React.Fragment>
      {leading ?? null}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {showChevron ? (
        <FontAwesome5 name="chevron-right" size={12} color={colors.tertiaryText} solid />
      ) : null}
    </React.Fragment>
  );

  const mainStyle = [styles.main, trailing ? styles.mainWithTrailing : null];

  return (
    <View>
      <View style={styles.row}>
        {onPress ? (
          <Touchable
            feedback="highlight"
            onPress={onPress}
            style={mainStyle}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          >
            {body}
          </Touchable>
        ) : (
          <View style={mainStyle} testID={testID}>
            {body}
          </View>
        )}
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
      {divider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.rowMinHeight,
    paddingVertical: spacing.sm,
    paddingHorizontal: layout.cardPadding,
  },
  mainWithTrailing: {
    paddingRight: spacing.xxs,
  },
  trailing: {
    paddingRight: spacing.xxs,
  },
  text: {
    flex: 1,
    gap: spacing.xxs / 2,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.primaryText,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  value: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  children: {
    paddingHorizontal: layout.cardPadding,
    paddingBottom: layout.cardPadding,
  },
  divider: {
    height: layout.hairline,
    backgroundColor: colors.divider,
    marginLeft: layout.cardPadding,
  },
});
