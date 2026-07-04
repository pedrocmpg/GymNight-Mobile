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
export const Alert = {
  alert: jest.fn(),
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
  Switch,
  Modal,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
};
