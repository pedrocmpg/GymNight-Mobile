import fc from 'fast-check';
import { computeDashboardUIState } from '../computeDashboardUIState';

/**
 * Feature: frontend-mobile-implementation
 * Property 38: Offline banner and locally available data render simultaneously,
 * never one replacing the other
 *
 * **Validates: Requirements 17.5**
 *
 * For any arbitrary set of locally available data (workouts, sessions) AND offline state:
 * 1. The offline banner is ALWAYS visible when offline (and not loading)
 * 2. The local data is ALWAYS rendered simultaneously with the banner (not replaced by it)
 * 3. The offline state does NOT cause local data to disappear or be hidden
 * 4. Both elements coexist in the rendered output
 */

describe('Property 38: Offline banner and locally available data render simultaneously, never one replacing the other', () => {
  test(
    'when offline AND data is available, both offline banner AND data section are always visible',
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary boolean for hasData (true = has local data)
          fc.constant(false), // isOnline = false (offline)
          fc.constant(true),  // hasData = true (local data available)
          fc.constant(false), // isLoading = false (not loading)
          (isOnline, hasData, isLoading) => {
            const state = computeDashboardUIState({ isOnline, hasData, isLoading });

            // The offline banner MUST be visible
            expect(state.showOfflineBanner).toBe(true);
            // The data section MUST be visible simultaneously
            expect(state.showDataSection).toBe(true);
            // They coexist — the banner does not replace the data
            expect(state.showOfflineBanner && state.showDataSection).toBe(true);
            // Loading and empty state must not interfere
            expect(state.showLoading).toBe(false);
            expect(state.showEmptyState).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  test(
    'for any combination of isOnline=false and non-empty data, both elements are always present',
    () => {
      // Arbitrary non-empty workout/session counts to represent "has data"
      const nonEmptyDataArb = fc.record({
        workoutCount: fc.integer({ min: 1, max: 100 }),
        sessionCount: fc.integer({ min: 0, max: 100 }),
      });

      fc.assert(
        fc.property(nonEmptyDataArb, (data) => {
          // hasData is true when there's at least one workout or session
          const hasData = data.workoutCount > 0 || data.sessionCount > 0;
          const state = computeDashboardUIState({
            isOnline: false,
            hasData,
            isLoading: false,
          });

          // Offline banner must always be visible when offline
          expect(state.showOfflineBanner).toBe(true);
          // Data section must always be visible when data exists
          expect(state.showDataSection).toBe(true);
          // They coexist, neither replaces the other
          expect(state.showOfflineBanner && state.showDataSection).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );

  test(
    'offline state does NOT cause local data to disappear or be hidden for any data shape',
    () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isOnline (any connectivity state)
          fc.boolean(), // hasData (any data state)
          (isOnline, hasData) => {
            const state = computeDashboardUIState({
              isOnline,
              hasData,
              isLoading: false,
            });

            // Core invariant: if data exists, it's always shown regardless of connectivity
            if (hasData) {
              expect(state.showDataSection).toBe(true);
            }

            // Offline banner appears exactly when offline
            if (!isOnline) {
              expect(state.showOfflineBanner).toBe(true);
            } else {
              expect(state.showOfflineBanner).toBe(false);
            }

            // The offline state never causes data to vanish
            if (!isOnline && hasData) {
              expect(state.showDataSection).toBe(true);
              expect(state.showOfflineBanner).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  test(
    'offline banner and data section are never mutually exclusive (both can coexist)',
    () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isOnline
          fc.boolean(), // hasData
          fc.boolean(), // isLoading
          (isOnline, hasData, isLoading) => {
            const state = computeDashboardUIState({ isOnline, hasData, isLoading });

            // The key property: showOfflineBanner=true does NOT imply showDataSection=false
            // They can both be true simultaneously
            if (!isOnline && hasData && !isLoading) {
              // Both MUST be true — the banner never replaces data
              expect(state.showOfflineBanner).toBe(true);
              expect(state.showDataSection).toBe(true);
            }

            // Additionally, loading state takes precedence over everything
            if (isLoading) {
              expect(state.showLoading).toBe(true);
              expect(state.showOfflineBanner).toBe(false);
              expect(state.showDataSection).toBe(false);
              expect(state.showEmptyState).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
