/**
 * Smoke test: valida que Jest, React Native Testing Library e fast-check
 * estão corretamente configurados e executam sem backend real ou SQLite.
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import { MockDatabase } from '@/test/mocks/watermelondb';
import * as SecureStore from '@/test/mocks/expoSecureStore';
import NetInfo from '@/test/mocks/netinfo';

describe('Test Environment Setup', () => {
  it('Jest executes correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check executes with minimum 100 runs via fcAssert', () => {
    let runs = 0;
    fcAssert(
      fcProperty(fc.integer(), (n) => {
        runs++;
        return typeof n === 'number';
      }),
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });

  it('fast-check enforces minimum numRuns even if lower value is passed', () => {
    let runs = 0;
    fcAssert(
      fcProperty(fc.integer(), (n) => {
        runs++;
        return Number.isFinite(n);
      }),
      { numRuns: 10 }, // Should be overridden to 100
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });

  it('fast-check allows numRuns higher than minimum', () => {
    let runs = 0;
    fcAssert(
      fcProperty(fc.integer(), (n) => {
        runs++;
        return typeof n === 'number';
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
  });

  it('WatermelonDB mock works without real SQLite', async () => {
    const db = new MockDatabase();
    const collection = db.get('workouts');

    // Pre-seed data
    collection.seed([
      { id: '1', name: 'Push Day' },
      { id: '2', name: 'Pull Day' },
    ]);

    const results = await collection.query().fetch();
    expect(results).toHaveLength(2);
    expect(results[0]._raw.name).toBe('Push Day');
  });

  it('expo-secure-store mock works without real Keychain', async () => {
    await SecureStore.setItemAsync('token', 'abc123');
    const value = await SecureStore.getItemAsync('token');
    expect(value).toBe('abc123');

    await SecureStore.deleteItemAsync('token');
    const deleted = await SecureStore.getItemAsync('token');
    expect(deleted).toBeNull();
  });

  it('netinfo mock works without real network', async () => {
    const state = await NetInfo.fetch();
    expect(state.isConnected).toBe(true);

    // Simulate going offline
    NetInfo.__setNetInfoState({ isConnected: false });
    const offlineState = await NetInfo.fetch();
    expect(offlineState.isConnected).toBe(false);

    NetInfo.__reset();
  });
});
