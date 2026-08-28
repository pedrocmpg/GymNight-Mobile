/**
 * Mock mínimo do react-native-safe-area-context para testes unitários e de
 * componente. O pacote real toca o TurboModule nativo já no import (via
 * InitialWindow.native.ts), o que derruba a suíte inteira fora do device.
 *
 * SafeAreaView e SafeAreaProvider viram strings — o renderer do preset
 * react-native trata elementos string como host components, que é o que o
 * @testing-library/react-native precisa. As props (`edges`, `style`,
 * `testID`) continuam chegando, então os testes seguem podendo asseverar
 * sobre elas.
 */

export const SafeAreaView = 'SafeAreaView';
export const SafeAreaProvider = 'SafeAreaProvider';
export const SafeAreaInsetsContext = {
  Provider: 'SafeAreaInsetsContext.Provider',
  Consumer: 'SafeAreaInsetsContext.Consumer',
};

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export const useSafeAreaInsets = () => ZERO_INSETS;
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
export const initialWindowMetrics = { insets: ZERO_INSETS, frame: { x: 0, y: 0, width: 375, height: 812 } };

export default {
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  useSafeAreaFrame,
  initialWindowMetrics,
};
