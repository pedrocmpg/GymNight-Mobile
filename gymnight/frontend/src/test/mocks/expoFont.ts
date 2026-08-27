/**
 * Mock do carregamento de fontes para testes unitários e de componente.
 *
 * `useFonts` resolve imediatamente como carregado, para que nenhum teste
 * precise esperar o gate de fonte do App.tsx. Os módulos da Inter viram
 * strings — é exatamente o que `expo-font` recebe em runtime no web e o
 * que os tokens de tipografia comparam.
 *
 * Registrado em jest.config.js (setupFiles).
 */

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: () => true,
}));

jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
  Inter_900Black: 'Inter_900Black',
}));

export {};
