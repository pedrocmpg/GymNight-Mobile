const TRANSFORM = {
  '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
};
const TRANSFORM_IGNORE_PATTERNS = [
  'node_modules/(?!(react-native|@react-native|@react-native-community|expo|@expo|zustand|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-svg)/)',
];

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'react-native',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: [
        '**/__tests__/**/*.{ts,tsx}',
        '**/*.{test,spec}.{ts,tsx}',
      ],
      // Este diretório roda com o WatermelonDB REAL (LokiJSAdapter), não o mock —
      // ver o projeto 'integration-realdb' abaixo. Precisa ficar fora do projeto
      // 'unit' para não colidir com o moduleNameMapper que força o mock.
      testPathIgnorePatterns: ['<rootDir>/src/db/__integration__/'],
      transform: TRANSFORM,
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Mock native modules that are unavailable in the test environment
        '^@nozbe/watermelondb$': '<rootDir>/src/test/mocks/watermelondb.ts',
        '^@nozbe/watermelondb/(.*)$': '<rootDir>/src/test/mocks/watermelondb.ts',
        '^expo-secure-store$': '<rootDir>/src/test/mocks/expoSecureStore.ts',
        '^@react-native-community/netinfo$': '<rootDir>/src/test/mocks/netinfo.ts',
        '^react-native$': '<rootDir>/src/test/mocks/reactNative.ts',
        '^react-native-svg$': '<rootDir>/src/test/mocks/reactNativeSvg.ts',
        '^react-native-safe-area-context$': '<rootDir>/src/test/mocks/reactNativeSafeAreaContext.ts',
        '^@expo/vector-icons$': '<rootDir>/src/test/mocks/expoVectorIcons.ts',
        '^@expo/vector-icons/(.*)$': '<rootDir>/src/test/mocks/expoVectorIcons.ts',
      },
      transformIgnorePatterns: TRANSFORM_IGNORE_PATTERNS,
      setupFiles: [
        '<rootDir>/src/test/mocks/expoFont.ts',
        '<rootDir>/src/test/setup.ts',
      ],
    },
    {
      // Prova que a migration v1→v2 de verdade (schemaMigrations + LokiJSAdapter,
      // mesmo motor de migração usado pelo SQLiteAdapter em produção) preserva
      // dados existentes — o mock de @nozbe/watermelondb usado no projeto 'unit'
      // não executa migrations reais, então não consegue provar isso
      // (PARIDADE-02-CATALOGO-MUSCULAR.md, gate crítico da Wave 6).
      displayName: 'integration-realdb',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/db/__integration__'],
      testMatch: ['**/*.test.ts'],
      transform: TRANSFORM,
      transformIgnorePatterns: TRANSFORM_IGNORE_PATTERNS,
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      setupFiles: [
        '<rootDir>/src/test/setup.ts',
      ],
    },
  ],
};
