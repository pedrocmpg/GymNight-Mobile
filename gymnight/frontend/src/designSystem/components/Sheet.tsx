/**
 * Sheet — painel que sobe da borda de baixo sobre um scrim escuro. É o único
 * lugar do app que usa `Modal` diretamente (formulário de cardio, conta,
 * confirmações via ConfirmSheet).
 *
 * O scrim faz fade (animationType do Modal) e o painel sobe `sheetOffset` px
 * com Animated — desligado com "Reduzir movimento". Tocar no scrim fecha.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, motion, radii, spacing, typography } from '../tokens';
import { isReduceMotionEnabled } from '../motion';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** testID do Modal. */
  testID?: string;
  /** testID do painel. */
  panelTestID?: string;
}

export function Sheet({ visible, onClose, title, children, testID, panelTestID }: SheetProps) {
  const insets = useSafeAreaInsets();
  const offset = useRef(new Animated.Value(motion.sheetOffset)).current;

  useEffect(() => {
    if (!visible) return;
    if (isReduceMotionEnabled()) {
      offset.setValue(0);
      return;
    }
    offset.setValue(motion.sheetOffset);
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: motion.duration.slow,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, offset]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          testID={testID ? `${testID}-scrim` : undefined}
        />
        <Animated.View
          style={[
            styles.panel,
            { paddingBottom: insets.bottom + spacing.md, transform: [{ translateY: offset }] },
          ]}
          testID={panelTestID}
        >
          <View style={styles.grabber} />
          {title ? (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: layout.hairline,
    borderColor: colors.border,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.xs,
    gap: spacing.md,
    maxHeight: '92%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.mutedText,
    marginBottom: spacing.xxs,
  },
  title: {
    ...typography.h2,
    color: colors.primaryText,
  },
});
