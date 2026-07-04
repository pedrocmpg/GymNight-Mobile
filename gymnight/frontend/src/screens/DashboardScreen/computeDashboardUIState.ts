/**
 * computeDashboardUIState — pure function that computes which UI elements
 * should be visible on the Dashboard_Screen given connectivity and data state.
 *
 * Key invariant (Requirement 17.5): When offline AND local data is available,
 * BOTH the offline banner AND the data section are visible simultaneously —
 * the banner never replaces or hides the data.
 */

export interface DashboardUIState {
  /** Whether the offline banner should be visible */
  showOfflineBanner: boolean;
  /** Whether the data section (workouts, stats) should be visible */
  showDataSection: boolean;
  /** Whether the empty state CTA should be visible */
  showEmptyState: boolean;
  /** Whether the loading indicator should be visible */
  showLoading: boolean;
}

export interface ComputeDashboardUIStateInput {
  isOnline: boolean;
  hasData: boolean;
  isLoading: boolean;
}

/**
 * Computes which elements are visible on the Dashboard screen.
 *
 * Rules:
 * - Loading state: only loading indicator shown (no data section, no empty state, no offline banner)
 * - Offline + has data: offline banner AND data section both visible (Requirement 17.5)
 * - Offline + no data: offline banner AND empty state CTA
 * - Online + has data: data section only
 * - Online + no data: empty state CTA only
 */
export function computeDashboardUIState(input: ComputeDashboardUIStateInput): DashboardUIState {
  const { isOnline, hasData, isLoading } = input;

  if (isLoading) {
    return {
      showOfflineBanner: false,
      showDataSection: false,
      showEmptyState: false,
      showLoading: true,
    };
  }

  return {
    showOfflineBanner: !isOnline,
    showDataSection: hasData,
    showEmptyState: !hasData,
    showLoading: false,
  };
}
