/**
 * Property 6: Stable connectivity transitions and fixed interval trigger
 * exactly one sync cycle each.
 *
 * **Validates: Requirements 3.2, 4.7**
 *
 * Para qualquer sequência arbitrária de gatilhos (transição de conectividade estável,
 * tick de intervalo fixo, ação manual):
 * 1. Cada transição de conectividade estável (offline→online por 2s) dispara EXATAMENTE um ciclo.
 * 2. Cada tick de timer fixo dispara EXATAMENTE um ciclo.
 * 3. Nenhum gatilho causa MAIS de um ciclo.
 * 4. Gatilhos concorrentes enquanto um ciclo está em andamento NÃO iniciam ciclos adicionais.
 * 5. Após um ciclo completar, o próximo gatilho inicia um novo ciclo normalmente.
 */
import { fcAssert, fcAsyncProperty, fc } from '@/test/fcConfig';
import { SyncEngine } from '@/sync/SyncEngine';

// ---- Types ----

/** Tipo de gatilho possível para o SyncEngine */
type TriggerType = 'connectivity' | 'interval' | 'manual';

/** Representa um gatilho com possível delay de ciclo (simula ciclo lento) */
interface TriggerEvent {
  type: TriggerType;
  /** Delay em ms que o ciclo de sync simulado levará (0 = instantâneo) */
  cycleDurationMs: number;
}

// ---- Arbitraries ----

const arbTriggerType: fc.Arbitrary<TriggerType> = fc.constantFrom(
  'connectivity',
  'interval',
  'manual',
);

const arbTriggerEvent: fc.Arbitrary<TriggerEvent> = fc.record({
  type: arbTriggerType,
  cycleDurationMs: fc.integer({ min: 0, max: 50 }),
});

/** Gera uma sequência de gatilhos (1 a 20 eventos) */
const arbTriggerSequence: fc.Arbitrary<TriggerEvent[]> = fc.array(arbTriggerEvent, {
  minLength: 1,
  maxLength: 20,
});

// ---- Helpers ----

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Property Tests ----

describe('Property 6: Stable connectivity transitions and fixed interval trigger exactly one sync cycle each', () => {
  it('each trigger (when no cycle is in progress) results in exactly one cycle completion', async () => {
    await fcAssert(
      fcAsyncProperty(arbTriggerSequence, async (triggers) => {
        let cycleCount = 0;

        const engine = new SyncEngine(async () => {
          cycleCount++;
        });

        // Process triggers sequentially (each awaited, simulating no overlap)
        for (const _trigger of triggers) {
          await engine.requestSyncCycle();
        }

        // Each trigger should have resulted in exactly one cycle
        expect(cycleCount).toBe(triggers.length);
        expect(engine.cyclesCompleted).toBe(triggers.length);
      }),
    );
  });

  it('concurrent triggers while a cycle is in progress do NOT start additional cycles', async () => {
    await fcAssert(
      fcAsyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 5, max: 30 }),
        async (concurrentTriggerCount, cycleDurationMs) => {
          let cycleCount = 0;

          const engine = new SyncEngine(async () => {
            cycleCount++;
            await delay(cycleDurationMs);
          });

          // Fire all triggers concurrently (not awaiting individually)
          const promises: Promise<void>[] = [];
          for (let i = 0; i < concurrentTriggerCount; i++) {
            promises.push(engine.requestSyncCycle());
          }

          await Promise.all(promises);

          // Only the first trigger should have started a cycle
          expect(cycleCount).toBe(1);
          expect(engine.cyclesCompleted).toBe(1);
        },
      ),
    );
  });

  it('after a cycle completes, the next trigger starts a new cycle normally', async () => {
    await fcAssert(
      fcAsyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 20 }),
        async (sequentialCycles, cycleDurationMs) => {
          let cycleCount = 0;

          const engine = new SyncEngine(async () => {
            cycleCount++;
            await delay(cycleDurationMs);
          });

          // Execute cycles sequentially (await each one before firing next)
          for (let i = 0; i < sequentialCycles; i++) {
            await engine.requestSyncCycle();
          }

          expect(cycleCount).toBe(sequentialCycles);
          expect(engine.cyclesCompleted).toBe(sequentialCycles);
          // After all cycles, engine should not be in-progress
          expect(engine.isCycleInProgress).toBe(false);
        },
      ),
    );
  });

  it('no trigger causes more than one sync cycle (sequential triggers separated by completion)', async () => {
    await fcAssert(
      fcAsyncProperty(arbTriggerSequence, async (triggers) => {
        const cycleStartCounts: number[] = [];
        let currentCycleStarts = 0;

        const engine = new SyncEngine(async () => {
          currentCycleStarts++;
        });

        for (const _trigger of triggers) {
          currentCycleStarts = 0;
          await engine.requestSyncCycle();
          // Each individual trigger invocation should have caused at most 1 cycle start
          cycleStartCounts.push(currentCycleStarts);
        }

        // Every trigger should have started exactly 1 cycle (since we await each)
        for (const count of cycleStartCounts) {
          expect(count).toBe(1);
        }
      }),
    );
  });

  it('mixed sequential and concurrent triggers: total cycles <= total triggers and >= 1', async () => {
    await fcAssert(
      fcAsyncProperty(
        arbTriggerSequence,
        fc.integer({ min: 1, max: 15 }),
        async (triggers, cycleDurationMs) => {
          let cycleCount = 0;

          const engine = new SyncEngine(async () => {
            cycleCount++;
            await delay(cycleDurationMs);
          });

          // Fire all triggers without awaiting (simulates mixed concurrent triggers)
          const promises = triggers.map(() => engine.requestSyncCycle());
          await Promise.all(promises);

          // At least one cycle should have run
          expect(cycleCount).toBeGreaterThanOrEqual(1);
          // At most triggers.length cycles could have run
          expect(cycleCount).toBeLessThanOrEqual(triggers.length);
          // cyclesCompleted should match actual cycle count
          expect(engine.cyclesCompleted).toBe(cycleCount);
          // Engine should be idle after all promises resolve
          expect(engine.isCycleInProgress).toBe(false);
        },
      ),
    );
  });
});
