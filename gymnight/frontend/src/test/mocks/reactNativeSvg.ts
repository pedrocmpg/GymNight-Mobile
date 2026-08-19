/**
 * Mock mínimo do react-native-svg para testes unitários e de componente.
 * Evita carregar binários nativos durante a execução de testes.
 *
 * Components are strings — the react-native preset's test renderer treats string
 * element types as host components, which is exactly what
 * @testing-library/react-native needs.
 */

export const Svg = 'Svg';
export const Path = 'Path';
export const Circle = 'Circle';
export const Line = 'Line';
export const G = 'G';
export const Defs = 'Defs';
export const LinearGradient = 'LinearGradient';
export const Stop = 'Stop';
export const Rect = 'Rect';

export default Svg;
