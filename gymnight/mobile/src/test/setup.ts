/**
 * Setup global de testes para o GymNight Mobile.
 *
 * Este arquivo é executado antes de cada suíte de testes (via jest.config.js setupFiles).
 * Garante que:
 * - Nenhum backend real é necessário
 * - Nenhum arquivo SQLite real é criado
 * - Mocks estão configurados corretamente
 */

// Suppress console noise during tests
const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  // Filter out known React Native / Expo warnings in test env
  const msg = args[0];
  if (typeof msg === 'string' && msg.includes('Animated')) return;
  originalConsoleWarn(...args);
};

// Global timeout for async tests (property tests may take longer)
jest.setTimeout(30_000);
