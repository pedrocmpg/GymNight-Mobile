import fc from 'fast-check';
import { computeProgressUIState } from '../computeProgressUIState';

/**
 * Feature: dashboard-history-progress
 * Property 54: Progress screen UI state invariants — mirrors
 * computeDashboardUIState/Property 38's shape for the new screen.
 *
 * For any combination of loading/selection/data state:
 * 1. Loading always takes precedence — nothing else renders while loading.
 * 2. The chart only shows when an exercise is selected AND it has 1RM data.
 * 3. The PR banner only shows alongside a visible chart.
 * 4. The sessions list is independent of exercise selection.
 */

const inputArb = fc.record({
  isLoading: fc.boolean(),
  hasSelectedExercise: fc.boolean(),
  hasOneRmData: fc.boolean(),
  isNewPersonalRecord: fc.boolean(),
  hasSessions: fc.boolean(),
});

describe('Property 54: computeProgressUIState invariants', () => {
  test('loading always takes precedence over every other section', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = computeProgressUIState({ ...input, isLoading: true });
        expect(state.showLoading).toBe(true);
        expect(state.showEmptyState).toBe(false);
        expect(state.showChart).toBe(false);
        expect(state.showPrBanner).toBe(false);
        expect(state.showSessionsList).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('chart shows iff an exercise is selected AND it has 1RM data', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = computeProgressUIState({ ...input, isLoading: false });
        const expected = input.hasSelectedExercise && input.hasOneRmData;
        expect(state.showChart).toBe(expected);
        expect(state.showEmptyState).toBe(!expected);
      }),
      { numRuns: 200 },
    );
  });

  test('PR banner never shows without a visible chart', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = computeProgressUIState({ ...input, isLoading: false });
        if (state.showPrBanner) {
          expect(state.showChart).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  test('PR banner shows exactly when chart is visible AND isNewPersonalRecord is true', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = computeProgressUIState({ ...input, isLoading: false });
        const expected = state.showChart && input.isNewPersonalRecord;
        expect(state.showPrBanner).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  test('sessions list visibility depends only on hasSessions, independent of exercise selection', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const state = computeProgressUIState({ ...input, isLoading: false });
        expect(state.showSessionsList).toBe(input.hasSessions);
      }),
      { numRuns: 200 },
    );
  });
});
