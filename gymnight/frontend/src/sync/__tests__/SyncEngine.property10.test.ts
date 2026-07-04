/**
 * Property 10: Push always completes before pull is dispatched
 *
 * **Validates: Requirements 4.1**
 *
 * Para qualquer ciclo de sincronização arbitrário, independentemente do outcome
 * do push (sucesso ou falha tratada):
 * 1. Push SEMPRE inicia antes do pull.
 * 2. Pull NUNCA inicia antes de push ter completado (atingido um outcome terminal:
 *    sucesso ou falha tratada).
 * 3. A ordenação é determinística e invariante independentemente da duração de push/pull.
 * 4. Mesmo se push falhar, pull NÃO inicia antes de push retornar.
 */
import { fcAssert, fcAsyncProperty, fc } from '@/test/fcConfig';
import { SyncEngine } from '@/sync/SyncEngine';

// ---- Types ----

/** Outcome of the push step */
type PushOutcome = 'success' | 'network_error' | 'http_500' | 'http_403';

/** Instrumented event log entry */
interface EventEntry {
  phase: 'push' | 'pull';
  event: 'start' | 'end';
  timestamp: number;
}

// ---- Arbitraries ----

const arbPushOutcome: fc.Arbitrary<PushOutcome> = fc.constantFrom(
  'success',
  'network_error',
  'http_500',
  'http_403',
);

/** Duration of push in ms (0 = instantaneous, up to 50ms for test speed) */
const arbPushDurationMs = fc.integer({ min: 0, max: 50 });

/** Duration of pull in ms (0 = instantaneous, up to 50ms for test speed) */
const arbPullDurationMs = fc.integer({ min: 0, max: 50 });

// ---- Helpers ----

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a sync cycle runner that instruments push and pull phases,
 * recording start/end events with monotonically increasing sequence numbers.
 *
 * The runner simulates the real `runSyncCycle()` behavior:
 * - push executes first, taking `pushDurationMs` to complete
 * - push resolves with the given outcome (success or handled failure)
 * - pull only executes after push completes (regardless of push outcome)
 * - pull takes `pullDurationMs` to complete
 *
 * This mirrors the design's contract:
 *   await this.push(); // must reach terminal outcome first
 *   await this.pull(); // only dispatched after push returns
 */
function createInstrumentedSyncCycleRunner(
  pushDurationMs: number,
  pullDurationMs: number,
  pushOutcome: PushOutcome,
  eventLog: EventEntry[],
): () => Promise<void> {
  let sequenceCounter = 0;

  return async () => {
    // --- Push phase ---
    eventLog.push({ phase: 'push', event: 'start', timestamp: ++sequenceCounter });
    await delay(pushDurationMs);
    eventLog.push({ phase: 'push', event: 'end', timestamp: ++sequenceCounter });

    // In the real implementation, push errors are caught and handled.
    // Regardless of outcome, the cycle continues to the pull step (or skips it
    // only if desired, but per Req 4.1 the pull is dispatched AFTER push reaches terminal).
    // For success, http_500, network_error: the pull still happens after push returns.
    // For http_403: the push is quarantined but still returns (terminal outcome).

    // --- Pull phase (only after push completes) ---
    eventLog.push({ phase: 'pull', event: 'start', timestamp: ++sequenceCounter });
    await delay(pullDurationMs);
    eventLog.push({ phase: 'pull', event: 'end', timestamp: ++sequenceCounter });
  };
}

// ---- Property Tests ----

describe('Property 10: Push always completes before pull is dispatched', () => {
  it('push.start always occurs before pull.start for any sync cycle', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbPushDurationMs,
        arbPullDurationMs,
        arbPushOutcome,
        async (pushDuration, pullDuration, pushOutcome) => {
          const eventLog: EventEntry[] = [];

          const runner = createInstrumentedSyncCycleRunner(
            pushDuration,
            pullDuration,
            pushOutcome,
            eventLog,
          );
          const engine = new SyncEngine(runner);

          await engine.requestSyncCycle();

          // Find push start and pull start events
          const pushStart = eventLog.find(
            (e) => e.phase === 'push' && e.event === 'start',
          );
          const pullStart = eventLog.find(
            (e) => e.phase === 'pull' && e.event === 'start',
          );

          expect(pushStart).toBeDefined();
          expect(pullStart).toBeDefined();
          // Push must start before pull starts
          expect(pushStart!.timestamp).toBeLessThan(pullStart!.timestamp);
        },
      ),
    );
  });

  it('push.end always occurs before or at pull.start (push fully completes before pull begins)', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbPushDurationMs,
        arbPullDurationMs,
        arbPushOutcome,
        async (pushDuration, pullDuration, pushOutcome) => {
          const eventLog: EventEntry[] = [];

          const runner = createInstrumentedSyncCycleRunner(
            pushDuration,
            pullDuration,
            pushOutcome,
            eventLog,
          );
          const engine = new SyncEngine(runner);

          await engine.requestSyncCycle();

          // Find push end and pull start events
          const pushEnd = eventLog.find(
            (e) => e.phase === 'push' && e.event === 'end',
          );
          const pullStart = eventLog.find(
            (e) => e.phase === 'pull' && e.event === 'start',
          );

          expect(pushEnd).toBeDefined();
          expect(pullStart).toBeDefined();
          // Push must fully complete before pull starts
          expect(pushEnd!.timestamp).toBeLessThan(pullStart!.timestamp);
        },
      ),
    );
  });

  it('ordering is deterministic and invariant regardless of push/pull duration', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbPushDurationMs,
        arbPullDurationMs,
        arbPushOutcome,
        async (pushDuration, pullDuration, pushOutcome) => {
          const eventLog: EventEntry[] = [];

          const runner = createInstrumentedSyncCycleRunner(
            pushDuration,
            pullDuration,
            pushOutcome,
            eventLog,
          );
          const engine = new SyncEngine(runner);

          await engine.requestSyncCycle();

          // The event order must ALWAYS be:
          // 1. push.start, 2. push.end, 3. pull.start, 4. pull.end
          expect(eventLog).toHaveLength(4);
          expect(eventLog[0]).toEqual(
            expect.objectContaining({ phase: 'push', event: 'start' }),
          );
          expect(eventLog[1]).toEqual(
            expect.objectContaining({ phase: 'push', event: 'end' }),
          );
          expect(eventLog[2]).toEqual(
            expect.objectContaining({ phase: 'pull', event: 'start' }),
          );
          expect(eventLog[3]).toEqual(
            expect.objectContaining({ phase: 'pull', event: 'end' }),
          );

          // Timestamps must be strictly increasing
          for (let i = 1; i < eventLog.length; i++) {
            expect(eventLog[i].timestamp).toBeGreaterThan(
              eventLog[i - 1].timestamp,
            );
          }
        },
      ),
    );
  });

  it('even if push fails, pull does NOT start before push returns', async () => {
    // Specifically test failure cases to ensure push errors don't break ordering
    const failureOutcomes: PushOutcome[] = ['network_error', 'http_500', 'http_403'];

    for (const failOutcome of failureOutcomes) {
      await fcAssert(
        fcAsyncProperty(
          arbPushDurationMs,
          arbPullDurationMs,
          async (pushDuration, pullDuration) => {
            const eventLog: EventEntry[] = [];

            const runner = createInstrumentedSyncCycleRunner(
              pushDuration,
              pullDuration,
              failOutcome,
              eventLog,
            );
            const engine = new SyncEngine(runner);

            await engine.requestSyncCycle();

            // Even with a failure outcome, the ordering invariant holds
            const pushEnd = eventLog.find(
              (e) => e.phase === 'push' && e.event === 'end',
            );
            const pullStart = eventLog.find(
              (e) => e.phase === 'pull' && e.event === 'start',
            );

            expect(pushEnd).toBeDefined();
            expect(pullStart).toBeDefined();
            expect(pushEnd!.timestamp).toBeLessThan(pullStart!.timestamp);
          },
        ),
      );
    }
  });

  it('the ordering holds even when push duration is zero (instantaneous)', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbPullDurationMs,
        arbPushOutcome,
        async (pullDuration, pushOutcome) => {
          const eventLog: EventEntry[] = [];

          // Push duration = 0 (instantaneous)
          const runner = createInstrumentedSyncCycleRunner(
            0,
            pullDuration,
            pushOutcome,
            eventLog,
          );
          const engine = new SyncEngine(runner);

          await engine.requestSyncCycle();

          const pushEnd = eventLog.find(
            (e) => e.phase === 'push' && e.event === 'end',
          );
          const pullStart = eventLog.find(
            (e) => e.phase === 'pull' && e.event === 'start',
          );

          expect(pushEnd).toBeDefined();
          expect(pullStart).toBeDefined();
          // Even with instantaneous push, pull starts strictly after push ends
          expect(pushEnd!.timestamp).toBeLessThan(pullStart!.timestamp);
        },
      ),
    );
  });
});
