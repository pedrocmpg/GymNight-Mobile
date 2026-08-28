/**
 * Mock mínimo do @expo/vector-icons para testes unitários e de componente.
 * O pacote real toca o RNVectorIconsManager nativo já no import, o que
 * quebra a suíte inteira fora do device.
 *
 * Os componentes são strings — o renderer do preset react-native trata
 * elementos string como host components, que é o que o
 * @testing-library/react-native precisa. O `name` do ícone continua
 * chegando como prop, então os testes podem asseverar qual ícone foi pedido.
 */

export const FontAwesome5 = 'FontAwesome5';
export const FontAwesome = 'FontAwesome';
export const Ionicons = 'Ionicons';
export const MaterialIcons = 'MaterialIcons';
export const MaterialCommunityIcons = 'MaterialCommunityIcons';
export const Feather = 'Feather';
export const AntDesign = 'AntDesign';

export default {
  FontAwesome5,
  FontAwesome,
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
  AntDesign,
};
