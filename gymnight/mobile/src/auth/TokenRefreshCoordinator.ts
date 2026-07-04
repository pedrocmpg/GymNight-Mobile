/**
 * TokenRefreshCoordinator
 *
 * Ensures at most ONE concurrent token refresh call (mutex/lock pattern).
 * While a refresh is in progress, subsequent requests are queued and dispatched
 * only after the refresh completes (success or failure). All queued waiters
 * receive the result of the single refresh call.
 *
 * After the refresh completes, the coordinator resets, allowing subsequent 401s
 * to trigger a new refresh.
 *
 * **Validates: Requirement 10.4**
 */

export type RefreshResult = { success: true; newAccessToken: string } | { success: false; error: unknown };

export type RefreshFn = () => Promise<RefreshResult>;

export class TokenRefreshCoordinator {
  private refreshInProgress: Promise<RefreshResult> | null = null;
  private activeRefreshCount = 0;

  /**
   * Returns the current number of active refresh calls.
   * Used for testing to verify the "at most one" invariant.
   */
  getActiveRefreshCount(): number {
    return this.activeRefreshCount;
  }

  /**
   * Returns whether a refresh is currently in progress.
   */
  isRefreshing(): boolean {
    return this.refreshInProgress !== null;
  }

  /**
   * Coordinates a token refresh call.
   *
   * - If no refresh is in progress, starts one using the provided refreshFn.
   * - If a refresh IS in progress, queues the caller to wait for the ongoing refresh.
   * - All callers receive the same RefreshResult from the single refresh call.
   * - After the refresh completes, the coordinator resets for future 401s.
   */
  async refresh(refreshFn: RefreshFn): Promise<RefreshResult> {
    if (this.refreshInProgress !== null) {
      // A refresh is already in progress — queue this caller to wait for it
      return this.refreshInProgress;
    }

    // No refresh in progress — start one
    this.activeRefreshCount++;
    this.refreshInProgress = this.executeRefresh(refreshFn);

    try {
      const result = await this.refreshInProgress;
      return result;
    } finally {
      // Reset after the refresh completes, allowing subsequent 401s to trigger a new refresh
      this.refreshInProgress = null;
      this.activeRefreshCount--;
    }
  }

  /**
   * Executes the actual refresh call. This method is separated to allow
   * the promise to be shared among all queued callers.
   */
  private async executeRefresh(refreshFn: RefreshFn): Promise<RefreshResult> {
    try {
      return await refreshFn();
    } catch (error) {
      return { success: false, error };
    }
  }
}
