/**
 * Property 31: At most one concurrent token refresh call; queued requests dispatch only after it resolves
 *
 * **Validates: Requirements 10.4**
 *
 * For any arbitrary number of concurrent 401 responses arriving simultaneously:
 * 1. At most ONE refresh call is ever made concurrently (never 2+)
 * 2. Queued requests wait until the refresh resolves before being dispatched
 * 3. All queued requests receive the result of the single refresh call
 * 4. The coordinator never deadlocks (all promises eventually resolve)
 * 5. After the refresh completes, subsequent 401s can trigger a new refresh
 */
import * as fc from 'fast-check';
import { TokenRefreshCoordinator, RefreshResult } from '../TokenRefreshCoordinator';

// --- Helpers ---

/**
 * Creates a controllable refresh function that tracks how many times it's been called
 * and allows resolving at a controlled time.
 */
function createControllableRefresh() {
  let callCount = 0;
  let resolveRef: ((result: RefreshResult) => void) | null = null;
  const called = () => callCount;

  const refreshFn = (): Promise<RefreshResult> => {
    callCount++;
    return new Promise<RefreshResult>((resolve) => {
      resolveRef = resolve;
    });
  };

  const resolve = (result: RefreshResult) => {
    if (resolveRef) {
      resolveRef(result);
      resolveRef = null;
    }
  };

  return { refreshFn, called, resolve };
}

/**
 * Creates a refresh function that resolves after a microtask delay with a given result.
 */
function createDelayedRefresh(result: RefreshResult, callTracker: { count: number }) {
  return (): Promise<RefreshResult> => {
    callTracker.count++;
    return new Promise<RefreshResult>((resolve) => {
      setTimeout(() => resolve(result), 0);
    });
  };
}

// --- Arbitraries ---

/**
 * Generates an arbitrary number of concurrent 401 requests (between 2 and 20).
 */
const arbConcurrentCount = fc.integer({ min: 2, max: 20 });

/**
 * Generates a successful refresh result with a random new access token.
 */
const arbSuccessResult: fc.Arbitrary<RefreshResult> = fc
  .string({ minLength: 8, maxLength: 64 })
  .map((token) => ({ success: true as const, newAccessToken: token }));

/**
 * Generates a failed refresh result.
 */
const arbFailureResult: fc.Arbitrary<RefreshResult> = fc
  .string({ minLength: 1, maxLength: 32 })
  .map((msg) => ({ success: false as const, error: new Error(msg) }));

/**
 * Any refresh result (success or failure).
 */
const arbRefreshResult: fc.Arbitrary<RefreshResult> = fc.oneof(arbSuccessResult, arbFailureResult);

/**
 * Generates a sequence of refresh rounds (how many times 401 triggers re-appear
 * after a previous refresh completes).
 */
const arbRefreshRounds = fc.integer({ min: 1, max: 5 });

// --- Property Tests ---

describe('Property 31: At most one concurrent token refresh call; queued requests dispatch only after it resolves', () => {
  it(
    'at most ONE refresh call is ever made concurrently (never 2+)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbConcurrentCount, arbRefreshResult, async (numConcurrent, result) => {
          const coordinator = new TokenRefreshCoordinator();
          const callTracker = { count: 0 };
          const refreshFn = createDelayedRefresh(result, callTracker);

          // Fire N concurrent refresh requests simultaneously
          const promises = Array.from({ length: numConcurrent }, () =>
            coordinator.refresh(refreshFn)
          );

          // The refresh function should have been called exactly ONCE
          // (subsequent calls are queued, not started)
          expect(callTracker.count).toBe(1);

          // Wait for all to resolve
          await Promise.all(promises);

          // After resolution, still only 1 call was made
          expect(callTracker.count).toBe(1);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'queued requests wait until the refresh resolves before being dispatched',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbConcurrentCount, async (numConcurrent) => {
          const coordinator = new TokenRefreshCoordinator();
          const { refreshFn, resolve } = createControllableRefresh();
          const resolvedFlags: boolean[] = Array(numConcurrent).fill(false);

          // Fire N concurrent refresh requests
          const promises = Array.from({ length: numConcurrent }, (_, i) =>
            coordinator.refresh(refreshFn).then((r) => {
              resolvedFlags[i] = true;
              return r;
            })
          );

          // Allow microtasks to run — none should have resolved yet
          await new Promise((r) => setTimeout(r, 10));
          expect(resolvedFlags.every((f) => f === false)).toBe(true);

          // Now resolve the refresh
          resolve({ success: true, newAccessToken: 'new-token' });

          // All should resolve
          await Promise.all(promises);
          expect(resolvedFlags.every((f) => f === true)).toBe(true);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'all queued requests receive the result of the single refresh call',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbConcurrentCount, arbRefreshResult, async (numConcurrent, expectedResult) => {
          const coordinator = new TokenRefreshCoordinator();
          const callTracker = { count: 0 };
          const refreshFn = createDelayedRefresh(expectedResult, callTracker);

          // Fire N concurrent refresh requests
          const promises = Array.from({ length: numConcurrent }, () =>
            coordinator.refresh(refreshFn)
          );

          // All should receive the same result
          const results = await Promise.all(promises);

          for (const result of results) {
            expect(result.success).toBe(expectedResult.success);
            if (result.success && expectedResult.success) {
              expect(result.newAccessToken).toBe(expectedResult.newAccessToken);
            }
          }
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'the coordinator never deadlocks (all promises eventually resolve)',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbConcurrentCount, arbRefreshResult, async (numConcurrent, result) => {
          const coordinator = new TokenRefreshCoordinator();
          const callTracker = { count: 0 };
          const refreshFn = createDelayedRefresh(result, callTracker);

          // Fire N concurrent refresh requests
          const promises = Array.from({ length: numConcurrent }, () =>
            coordinator.refresh(refreshFn)
          );

          // Use a race with a timeout to verify no deadlock.
          // All promises must resolve within a reasonable time (1 second).
          const timeout = new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), 1000)
          );

          const raceResult = await Promise.race([
            Promise.all(promises).then(() => 'resolved' as const),
            timeout,
          ]);

          expect(raceResult).toBe('resolved');

          // After resolution, the coordinator should be in a clean state
          expect(coordinator.isRefreshing()).toBe(false);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );

  it(
    'after the refresh completes, subsequent 401s can trigger a new refresh',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbRefreshRounds, arbConcurrentCount, async (rounds, numConcurrent) => {
          const coordinator = new TokenRefreshCoordinator();
          let totalCalls = 0;

          for (let round = 0; round < rounds; round++) {
            const callTracker = { count: 0 };
            const result: RefreshResult = {
              success: true,
              newAccessToken: `token-round-${round}`,
            };
            const refreshFn = createDelayedRefresh(result, callTracker);

            // Fire concurrent requests in this round
            const promises = Array.from({ length: numConcurrent }, () =>
              coordinator.refresh(refreshFn)
            );

            // Wait for all to complete
            const results = await Promise.all(promises);

            // Each round should trigger exactly 1 call
            expect(callTracker.count).toBe(1);
            totalCalls += callTracker.count;

            // All results in this round share the same token
            for (const r of results) {
              expect(r.success).toBe(true);
              if (r.success) {
                expect(r.newAccessToken).toBe(`token-round-${round}`);
              }
            }

            // After completion, coordinator is no longer refreshing
            expect(coordinator.isRefreshing()).toBe(false);
          }

          // Total calls across all rounds equals the number of rounds
          expect(totalCalls).toBe(rounds);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
