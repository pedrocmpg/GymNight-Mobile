/**
 * Property-Based Test — Property 55
 *
 * combineHistoryObservables (the 4-way observable combiner behind
 * useObserveHistory, consumed by ProgressScreenContainer) follows the same
 * invariant as combineObservables/combineSessionObservables: it emits only
 * once every source has emitted at least once, and an error from any source
 * propagates to the combined observer.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { combineHistoryObservables } from '@/hooks/useObserveHistory';
import type { ReactiveObservable } from '@/hooks/useReactiveQuery';

function makeManualObservable<T>(): {
  observable: ReactiveObservable<T>;
  emit: (value: T) => void;
  emitError: (err: unknown) => void;
} {
  const observers: Array<{ next?: (v: T) => void; error?: (e: unknown) => void }> = [];
  return {
    observable: {
      subscribe(observer) {
        observers.push(observer);
        return { unsubscribe: () => {} };
      },
    },
    emit: (value) => observers.forEach((o) => o.next?.(value)),
    emitError: (err) => observers.forEach((o) => o.error?.(err)),
  };
}

describe('Property 55: combineHistoryObservables', () => {
  it('emits only after all 4 sources have emitted at least once, regardless of order', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([0, 1, 2, 3], { minLength: 4, maxLength: 4 }), (emitOrder) => {
        const sessions = makeManualObservable<any[]>();
        const loggedSets = makeManualObservable<any[]>();
        const exercises = makeManualObservable<any[]>();
        const workoutNames = makeManualObservable<any[]>();

        const sources = [sessions, loggedSets, exercises, workoutNames];
        const combined = combineHistoryObservables(
          sessions.observable,
          loggedSets.observable,
          exercises.observable,
          workoutNames.observable,
        );

        const emissions: any[] = [];
        combined.subscribe({ next: (v) => emissions.push(v) });

        for (let i = 0; i < emitOrder.length; i++) {
          sources[emitOrder[i]].emit([]);
          const expectedEmissions = i === emitOrder.length - 1 ? 1 : 0;
          if (emissions.length !== expectedEmissions) return false;
        }

        return emissions.length === 1;
      }),
      { numRuns: 100 },
    );
  });

  it('re-emits whenever any single source changes after the first full emission', () => {
    const sessions = makeManualObservable<any[]>();
    const loggedSets = makeManualObservable<any[]>();
    const exercises = makeManualObservable<any[]>();
    const workoutNames = makeManualObservable<any[]>();

    const combined = combineHistoryObservables(
      sessions.observable,
      loggedSets.observable,
      exercises.observable,
      workoutNames.observable,
    );

    const emissions: any[] = [];
    combined.subscribe({ next: (v) => emissions.push(v) });

    sessions.emit([1]);
    loggedSets.emit([2]);
    exercises.emit([3]);
    workoutNames.emit([4]);
    expect(emissions).toHaveLength(1);

    loggedSets.emit([2, 2]);
    expect(emissions).toHaveLength(2);
    expect(emissions[1].loggedSets).toEqual([2, 2]);
  });

  it('an error from any source propagates to the combined observer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), (errorSourceIndex) => {
        const sessions = makeManualObservable<any[]>();
        const loggedSets = makeManualObservable<any[]>();
        const exercises = makeManualObservable<any[]>();
        const workoutNames = makeManualObservable<any[]>();
        const sources = [sessions, loggedSets, exercises, workoutNames];

        const combined = combineHistoryObservables(
          sessions.observable,
          loggedSets.observable,
          exercises.observable,
          workoutNames.observable,
        );

        let receivedError: unknown = null;
        combined.subscribe({ error: (e) => { receivedError = e; } });

        const testError = new Error('boom');
        sources[errorSourceIndex].emitError(testError);

        return receivedError === testError;
      }),
      { numRuns: 50 },
    );
  });

  it('an error stops further emissions from reaching the observer', () => {
    const sessions = makeManualObservable<any[]>();
    const loggedSets = makeManualObservable<any[]>();
    const exercises = makeManualObservable<any[]>();
    const workoutNames = makeManualObservable<any[]>();

    const combined = combineHistoryObservables(
      sessions.observable,
      loggedSets.observable,
      exercises.observable,
      workoutNames.observable,
    );

    const emissions: any[] = [];
    let errorCount = 0;
    combined.subscribe({ next: (v) => emissions.push(v), error: () => { errorCount++; } });

    sessions.emitError(new Error('fail'));
    exercises.emit([1]);
    loggedSets.emit([1]);
    workoutNames.emit([1]);

    expect(emissions).toHaveLength(0);
    expect(errorCount).toBe(1);
  });
});
