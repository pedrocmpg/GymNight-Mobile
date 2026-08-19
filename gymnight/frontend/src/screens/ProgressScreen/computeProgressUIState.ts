/**
 * computeProgressUIState — pure function that computes which UI elements should
 * be visible on the Progress_Screen given loading/selection/data state.
 *
 * Mirrors computeDashboardUIState.ts's shape: loading always takes precedence;
 * the PR banner and the recent-sessions list are independent and may coexist
 * with the chart section.
 */

export interface ProgressUIState {
  /** Whether the loading indicator should be visible (nothing else renders). */
  showLoading: boolean;
  /** Whether the empty state (no exercise selected, or selected exercise has no data) is visible. */
  showEmptyState: boolean;
  /** Whether the 1RM chart section should be visible. */
  showChart: boolean;
  /** Whether the "new personal record" banner should be visible. */
  showPrBanner: boolean;
  /** Whether the recent-sessions list should be visible. */
  showSessionsList: boolean;
}

export interface ComputeProgressUIStateInput {
  isLoading: boolean;
  hasSelectedExercise: boolean;
  hasOneRmData: boolean;
  isNewPersonalRecord: boolean;
  hasSessions: boolean;
}

/**
 * Computes which elements are visible on the Progress screen.
 *
 * Rules:
 * - Loading state: only the loading indicator is shown.
 * - No exercise selected, or selected exercise has no 1RM data: empty state instead of chart.
 * - Chart and PR banner are independent — PR banner only shows when the chart has data.
 * - The recent-sessions list is independent of exercise selection — it always shows
 *   when there are sessions, even while the chart is in its empty state.
 */
export function computeProgressUIState(input: ComputeProgressUIStateInput): ProgressUIState {
  const { isLoading, hasSelectedExercise, hasOneRmData, isNewPersonalRecord, hasSessions } = input;

  if (isLoading) {
    return {
      showLoading: true,
      showEmptyState: false,
      showChart: false,
      showPrBanner: false,
      showSessionsList: false,
    };
  }

  const showChart = hasSelectedExercise && hasOneRmData;

  return {
    showLoading: false,
    showEmptyState: !showChart,
    showChart,
    showPrBanner: showChart && isNewPersonalRecord,
    showSessionsList: hasSessions,
  };
}
