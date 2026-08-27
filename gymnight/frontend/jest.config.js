/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.{test,spec}.{ts,tsx}',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
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
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|expo|@expo|zustand|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-svg)/)',
  ],
  setupFiles: [
    '<rootDir>/src/test/mocks/expoFont.ts',
    '<rootDir>/src/test/setup.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/test/**',
    '!src/**/*.d.ts',
  ],
};
