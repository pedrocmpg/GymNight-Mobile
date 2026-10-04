/**
 * Touchable — base de todo elemento pressionável do design system.
 *
 *   feedback="scale"      encolhe para motion.pressScale (botões, chips, checks)
 *   feedback="highlight"  pinta o fundo de cardAlt enquanto pressionado (linhas)
 *   feedback="none"       só o toque
 *
 * Um único elemento host carrega testID, style, disabled e accessibilityState —
 * os testes leem essas props direto do nó retornado por getByTestId. Não usar
 * style-função (`({pressed}) => …`): o mock de testes nunca a chama.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, motion } from '../tokens';
import { haptic as fireHaptic, type HapticKind } from '../haptics';
import { isReduceMotionEnabled } from '../motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TouchableFeedback = 'scale' | 'highlight' | 'none';

export interface TouchableProps {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  feedback?: TouchableFeedback;
  /** Feedback tátil disparado a cada press efetivo (não dispara se disabled). */
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | Insets;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
}

export function Touchable({
  children,
  onPress,
  disabled = false,
  feedback = 'scale',
  haptic,
  style,
  hitSlop,
  testID,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: TouchableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const animateScale = (toValue: number) => {
    if (feedback !== 'scale' || isReduceMotionEnabled()) return;
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressIn = () => {
    if (disabled) return;
    if (feedback === 'highlight') setPressed(true);
    animateScale(motion.pressScale);
  };

  const handlePressOut = () => {
    if (feedback === 'highlight') setPressed(false);
    animateScale(1);
  };

  // O Pressable mockado nos testes ignora `disabled`, então o bloqueio é explícito.
  const handlePress = () => {
    if (disabled || !onPress) return;
    if (haptic) fireHaptic(haptic);
    onPress();
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState ?? (disabled ? { disabled } : undefined)}
      style={[
        style,
        feedback === 'highlight' && pressed && styles.highlight,
        feedback === 'scale' && { transform: [{ scale }] },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  highlight: {
    backgroundColor: colors.cardAlt,
  },
});
