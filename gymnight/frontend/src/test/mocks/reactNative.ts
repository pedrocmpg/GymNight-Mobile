/**
 * Mock mínimo do React Native para testes unitários e de componente.
 * Evita carregar binários nativos durante a execução de testes.
 *
 * Components are strings — the react-native preset's test renderer treats string
 * element types as host components, which is exactly what
 * @testing-library/react-native needs.
 */

export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const ActivityIndicator = 'ActivityIndicator';
export const Pressable = 'Pressable';
export const Image = 'Image';
export const ImageBackground = 'ImageBackground';
export const Switch = 'Switch';
export const Modal = 'Modal';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
const absoluteFill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  absoluteFill,
  absoluteFillObject: absoluteFill,
  hairlineWidth: 1,
};
export const Platform = {
  OS: 'ios',
  select: (options: Record<string, unknown>) => options.ios ?? options.default,
};
export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
};
export const useWindowDimensions = () => ({ width: 375, height: 812, scale: 2, fontScale: 1 });
export const Alert = {
  alert: jest.fn(),
};
/**
 * Animações terminam de forma síncrona: `start(cb)` chama o callback na hora
 * com `{ finished: true }`, como o RN faz ao fim de uma animação real.
 */
const _animation = () => ({
  start: (cb?: (result: { finished: boolean }) => void) => cb?.({ finished: true }),
  stop: () => {},
  reset: () => {},
});
class AnimatedValue {
  _value: number;
  constructor(value = 0) {
    this._value = value;
  }
  setValue(value: number) {
    this._value = value;
  }
  interpolate() {
    return this;
  }
  stopAnimation(cb?: (value: number) => void) {
    cb?.(this._value);
  }
}
export const Animated = {
  createAnimatedComponent: <T,>(component: T): T => component,
  Value: AnimatedValue,
  timing: _animation,
  spring: _animation,
  parallel: _animation,
  sequence: _animation,
  loop: _animation,
  delay: _animation,
  View: 'Animated.View',
  Text: 'Animated.Text',
};
const _identityEasing = (t: unknown) => t;
export const Easing = {
  linear: _identityEasing,
  ease: _identityEasing,
  cubic: _identityEasing,
  quad: _identityEasing,
  out: (fn: unknown) => fn,
  in: (fn: unknown) => fn,
  inOut: (fn: unknown) => fn,
  bezier: () => _identityEasing,
};
export const LayoutAnimation = {
  configureNext: jest.fn(),
  create: (duration: number, type?: string, property?: string) => ({ duration, type, property }),
  Types: { easeInEaseOut: 'easeInEaseOut', linear: 'linear', spring: 'spring' },
  Properties: { opacity: 'opacity', scaleXY: 'scaleXY' },
  Presets: { easeInEaseOut: {}, linear: {}, spring: {} },
};
export const UIManager = {};
export const AccessibilityInfo = {
  isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};
export const RefreshControl = 'RefreshControl';

export type AppStateStatus = 'active' | 'background' | 'inactive';
type AppStateListener = (state: AppStateStatus) => void;
let _appStateCurrent: AppStateStatus = 'active';
const _appStateListeners: Set<AppStateListener> = new Set();
export const AppState = {
  get currentState(): AppStateStatus {
    return _appStateCurrent;
  },
  addEventListener: (_type: 'change', listener: AppStateListener) => {
    _appStateListeners.add(listener);
    return {
      remove: () => {
        _appStateListeners.delete(listener);
      },
    };
  },
  /** Test helper: simulate a foreground/background transition. */
  __setState: (state: AppStateStatus) => {
    _appStateCurrent = state;
    _appStateListeners.forEach((l) => l(state));
  },
  /** Test helper: reset to default (active, no listeners). */
  __reset: () => {
    _appStateCurrent = 'active';
    _appStateListeners.clear();
  },
};

export default {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Pressable,
  Image,
  ImageBackground,
  Switch,
  Modal,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  Dimensions,
  useWindowDimensions,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
  AccessibilityInfo,
  RefreshControl,
  AppState,
};
