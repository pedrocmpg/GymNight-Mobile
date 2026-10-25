/**
 * Mock do expo-image para testes: o componente vira um host string, como o
 * `Image` do mock de react-native, e os testes leem `props.source`/`autoplay`.
 *
 * Registrado em jest.config.js (moduleNameMapper).
 */
export const Image = 'ExpoImage';
