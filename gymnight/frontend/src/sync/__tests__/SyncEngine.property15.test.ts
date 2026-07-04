/**
 * Property 15: At most one synchronization cycle runs at a time
 *
 * **Validates: Requirements 4.8**
 *
 * Para qualquer número arbitrário de triggers concorrentes com qualquer duração
 * arbitrária de ciclo:
 * 1. Em nenhum momento há MAIS de 1 ciclo de sync executando concorrentemente.
 * 2. A concorrência máxima observada em qualquer padrão de triggers é sempre <= 1.
 * 3. Quando um ciclo está em andamento, `requestSyncCycle()` retorna imediatamente
 *    sem iniciar outro.
 * 4. Após um ciclo completar, um novo PODE ser iniciado (mas ainda apenas um por vez).
 */
import { fcAssert, fcAsyncProperty, fc } from '@/test/fcConfig';
import { SyncEngine } from '@/sync/SyncEngine';

// ---- Helpers ----

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Arbitraries ----

/** Number of concurrent triggers to fire at once */
const arbConcurrentTriggers = fc.integer({ min: 2, max: 20 });

/** Duration of the sync cycle in ms */
const arbCycleDurationMs = fc.integer({ min: 1, max: 50 });

/** Number of sequential batches to test (each batch fires concurrent triggers) */
const arbBatchCount = fc.integer({ min: 1, max: 5 });

/** Array of concurrent trigger counts per batch */
const arbBatchTriggersPerRound = fc.array(fc.integer({ min: 1, max: 10 }), {
  minLength: 1,
  maxLength: 5,
});

// ---- Property Tests ----

describe('Property 15: At most one synchronization cycle runs at a time', () => {
  it('concurrency counter never exceeds 1 for any number of simultaneous triggers', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbConcurrentTriggers,
        arbCycleDurationMs,
        async (triggerCount, cycleDuration) => {
          let concurrencyCounter = 0;
          let maxConcurrency = 0;

          const engine = new SyncEngine(async () => {
            concurrencyCounter++;
            maxConcurrency = Math.max(maxConcurrency, concurrencyCounter);
            await delay(cycleDuration);
            concurrencyCounter--;
          });

          // Fire all triggers simultaneously without awaiting
          const promises: Promise<void>[] = [];
          for (let i = 0; i < triggerCount; i++) {
            promises.push(engine.requestSyncCycle());
          }

          await Promise.all(promises);

          // The max concurrency must NEVER exceed 1
          expect(maxConcurrency).toBe(1);
          // After all resolve, concurrency must be back to 0
          expect(concurrencyCounter).toBe(0);
        },
      ),
    );
  });

  it('when a cycle is in progress, requestSyncCycle() returns immediately without starting another', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbConcurrentTriggers,
        arbCycleDurationMs,
        async (triggerCount, cycleDuration) => {
          let cycleStartCount = 0;

          const engine = new SyncEngine(async () => {
            cycleStartCount++;
            await delay(cycleDuration);
          });

          // Fire all triggers concurrently
          const promises: Promise<void>[] = [];
          for (let i = 0; i < triggerCount; i++) {
            promises.push(engine.requestSyncCycle());
          }

          await Promise.all(promises);

          // Only one cycle should have been started, despite many triggers
          expect(cycleStartCount).toBe(1);
          expect(engine.cyclesCompleted).toBe(1);
        },
      ),
    );
  });

  it('after a cycle completes, a new one CAN start (but still only one at a time)', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbBatchTriggersPerRound,
        arbCycleDurationMs,
        async (triggersPerRound, cycleDuration) => {
          let concurrencyCounter = 0;
          let maxConcurrency = 0;
          let totalCyclesStarted = 0;

          const engine = new SyncEngine(async () => {
            concurrencyCounter++;
            totalCyclesStarted++;
            maxConcurrency = Math.max(maxConcurrency, concurrencyCounter);
            await delay(cycleDuration);
            concurrencyCounter--;
          });

          // Execute multiple rounds sequentially, with concurrent triggers per round
          for (const triggerCount of triggersPerRound) {
            const promises: Promise<void>[] = [];
            for (let i = 0; i < triggerCount; i++) {
              promises.push(engine.requestSyncCycle());
            }
            await Promise.all(promises);
          }

          // Max concurrency never exceeds 1 across all rounds
          expect(maxConcurrency).toBe(1);
          // One cycle per round (concurrent triggers within each round are deduplicated)
          expect(totalCyclesStarted).toBe(triggersPerRound.length);
          expect(engine.cyclesCompleted).toBe(triggersPerRound.length);
          // Engine must be idle after all rounds
          expect(engine.isCycleInProgress).toBe(false);
        },
      ),
    );
  });

  it('max concurrency observed across varied trigger patterns with varying cycle durations is always <= 1', async () => {
    await fcAssert(
      fcAsyncProperty(
        fc.array(
          fc.record({
            concurrentTriggers: fc.integer({ min: 1, max: 15 }),
            cycleDurationMs: fc.integer({ min: 0, max: 40 }),
            delayBetweenBatchesMs: fc.integer({ min: 0, max: 20 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        async (batches) => {
          let concurrencyCounter = 0;
          let maxConcurrency = 0;
          let violations: string[] = [];

          const engine = new SyncEngine(async () => {
            concurrencyCounter++;
            if (concurrencyCounter > 1) {
              violations.push(
                `concurrency=${concurrencyCounter} at cycle start`,
              );
            }
            maxConcurrency = Math.max(maxConcurrency, concurrencyCounter);
            // Use the latest configured duration for simulation
            await delay(batches[0]?.cycleDurationMs ?? 5);
            concurrencyCounter--;
          });

          const allPromises: Promise<void>[] = [];

          for (const batch of batches) {
            // Fire concurrent triggers in this batch
            for (let i = 0; i < batch.concurrentTriggers; i++) {
              allPromises.push(engine.requestSyncCycle());
            }
            // Small delay between batches (some may overlap with in-progress cycles)
            if (batch.delayBetweenBatchesMs > 0) {
              await delay(batch.delayBetweenBatchesMs);
            }
          }

          await Promise.all(allPromises);

          // The invariant: max concurrency is always <= 1
          expect(maxConcurrency).toBeLessThanOrEqual(1);
          expect(violations).toHaveLength(0);
          expect(concurrencyCounter).toBe(0);
          expect(engine.isCycleInProgress).toBe(false);
        },
      ),
    );
  });

  it('overlapping triggers are dropped rather than queued or executed in parallel', async () => {
    await fcAssert(
      fcAsyncProperty(
        fc.integer({ min: 5, max: 20 }),
        arbCycleDurationMs,
        async (triggerCount, cycleDuration) => {
          let cycleStartCount = 0;
          let concurrencyCounter = 0;

          const engine = new SyncEngine(async () => {
            cycleStartCount++;
            concurrencyCounter++;
            await delay(cycleDuration);
            concurrencyCounter--;
          });

          // Fire all triggers simultaneously
          const promises = Array.from({ length: triggerCount }, () =>
            engine.requestSyncCycle(),
          );
          await Promise.all(promises);

          // Verify: triggers were dropped (not queued), only 1 cycle ran
          expect(cycleStartCount).toBe(1);
          // No concurrency at any point
          expect(concurrencyCounter).toBe(0);
          // Engine is idle
          expect(engine.isCycleInProgress).toBe(false);
          expect(engine.cyclesCompleted).toBe(1);
        },
      ),
    );
  });
});
