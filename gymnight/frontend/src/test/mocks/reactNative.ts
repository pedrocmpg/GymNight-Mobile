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
export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
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
export const Animated = {
  createAnimatedComponent: <T,>(component: T): T => component,
  Value: class {
    setValue() {}
  },
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  View: 'Animated.View',
  Text: 'Animated.Text',
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
  StyleSheet,
  Platform,
  Dimensions,
  useWindowDimensions,
  Alert,
  Animated,
  RefreshControl,
  AppState,
};
