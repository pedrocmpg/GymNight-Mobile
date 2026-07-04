/**
 * Property 9: Sync_Status_Indicator color always equals the exact current
 * sync state mapping.
 *
 * **Validates: Requirements 3.4, 3.6, 3.7, 15.1, 15.2, 15.3, 15.6, 17.2**
 *
 * For any arbitrary sync state:
 * 1. 'synced' always maps to colors.success (the success token)
 * 2. 'pending' always maps to colors.error (the error token)
 * 3. 'syncing' always maps to colors.primary (the primary token)
 * 4. 'offline' always maps to colors.primary (the primary token)
 * 5. The mapping is exhaustive — every possible SyncState has a defined color
 * 6. The color values always come from the Design_Token_Module (never hardcoded)
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import {
  getSyncStatusColor,
  ALL_SYNC_STATES,
  type SyncState,
} from '@/sync/SyncStatusIndicator';
import { colors } from '@/designSystem/tokens';

// ---- Arbitraries ----

/** Generates an arbitrary valid SyncState */
const arbSyncState: fc.Arbitrary<SyncState> = fc.constantFrom(
  'synced' as SyncState,
  'pending' as SyncState,
  'syncing' as SyncState,
  'offline' as SyncState,
);

// ---- Expected mapping (derived from Design_Token_Module) ----

const EXPECTED_COLOR_MAP: Record<SyncState, string> = {
  synced: colors.success,
  pending: colors.error,
  syncing: colors.primary,
  offline: colors.primary,
};

// ---- Property Tests ----

describe('Property 9: Sync_Status_Indicator color always equals the exact current sync state mapping', () => {
  it("for any sync state, getSyncStatusColor returns exactly the token from the Design_Token_Module", () => {
    fcAssert(
      fcProperty(arbSyncState, (state) => {
        const result = getSyncStatusColor(state);
        const expected = EXPECTED_COLOR_MAP[state];
        expect(result).toBe(expected);
      }),
    );
  });

  it("'synced' always maps to colors.success", () => {
    fcAssert(
      fcProperty(fc.constant('synced' as SyncState), (state) => {
        expect(getSyncStatusColor(state)).toBe(colors.success);
      }),
    );
  });

  it("'pending' always maps to colors.error", () => {
    fcAssert(
      fcProperty(fc.constant('pending' as SyncState), (state) => {
        expect(getSyncStatusColor(state)).toBe(colors.error);
      }),
    );
  });

  it("'syncing' always maps to colors.primary", () => {
    fcAssert(
      fcProperty(fc.constant('syncing' as SyncState), (state) => {
        expect(getSyncStatusColor(state)).toBe(colors.primary);
      }),
    );
  });

  it("'offline' always maps to colors.primary", () => {
    fcAssert(
      fcProperty(fc.constant('offline' as SyncState), (state) => {
        expect(getSyncStatusColor(state)).toBe(colors.primary);
      }),
    );
  });

  it('the mapping is exhaustive — every possible SyncState has a defined color', () => {
    fcAssert(
      fcProperty(arbSyncState, (state) => {
        const result = getSyncStatusColor(state);
        // Result must be a non-empty string (a valid color token)
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        // Result must be one of the known Design_Token colors
        const validColors = [colors.success, colors.error, colors.primary];
        expect(validColors).toContain(result);
      }),
    );
  });

  it('color values always come from the Design_Token_Module (match actual token values)', () => {
    fcAssert(
      fcProperty(arbSyncState, (state) => {
        const result = getSyncStatusColor(state);
        // The result must be referentially equal to a token from the colors object
        const tokenValues = Object.values(colors);
        expect(tokenValues).toContain(result);
      }),
    );
  });

  it('ALL_SYNC_STATES covers every state the arbitrary can generate', () => {
    // Verify the exported constant matches the exhaustive list
    expect(ALL_SYNC_STATES).toEqual(
      expect.arrayContaining(['synced', 'pending', 'syncing', 'offline']),
    );
    expect(ALL_SYNC_STATES).toHaveLength(4);

    // Verify every item in ALL_SYNC_STATES produces a valid color
    for (const state of ALL_SYNC_STATES) {
      const result = getSyncStatusColor(state);
      expect(result).toBe(EXPECTED_COLOR_MAP[state]);
    }
  });
});
