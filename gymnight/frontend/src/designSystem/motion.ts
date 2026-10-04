/**
 * Motion — microinterações com o `Animated` / `LayoutAnimation` do próprio RN
 * (sem reanimated). Tudo respeita o "Reduzir movimento" do sistema.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutAnimation } from 'react-native';
import { motion } from './tokens';

let reduceMotionEnabled = false;
let subscribed = false;
const listeners = new Set<(value: boolean) => void>();

function setReduceMotion(value: boolean): void {
  reduceMotionEnabled = value;
  listeners.forEach((listener) => listener(value));
}

/** Uma única assinatura para o app inteiro, aberta na primeira consulta. */
function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
}

/** Leitura síncrona da preferência "Reduzir movimento" (para handlers). */
export function isReduceMotionEnabled(): boolean {
  ensureSubscribed();
  return reduceMotionEnabled;
}

/** Versão reativa de `isReduceMotionEnabled`, para efeitos de animação. */
export function useReducedMotion(): boolean {
  ensureSubscribed();
  const [reduced, setReduced] = useState(reduceMotionEnabled);

  useEffect(() => {
    listeners.add(setReduced);
    return () => {
      listeners.delete(setReduced);
    };
  }, []);

  return reduced;
}

/**
 * Anima a PRÓXIMA mudança de layout (itens entrando/saindo de uma lista,
 * seção expandindo). Chamar logo antes do setState. No-op com movimento
 * reduzido. Na New Architecture o LayoutAnimation já vem ligado — não chamar
 * `setLayoutAnimationEnabledExperimental`.
 */
export function animateLayout(): void {
  if (isReduceMotionEnabled()) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      motion.duration.base,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
}

/**
 * Fade + leve subida (8px) toda vez que `key` muda — passo de onboarding,
 * tela de resumo. Retorna o estilo para um `Animated.View`.
 */
export function useEnterAnimation(key: unknown) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.slow,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [key, reduced, progress]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
      },
    ],
  };
}
