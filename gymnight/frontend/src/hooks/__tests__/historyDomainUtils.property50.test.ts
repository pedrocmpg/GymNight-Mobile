/**
 * Property-Based Test — Property 50
 *
 * computeAverageSessionDuration always returns a value between the min and max of
 * the finished durations for a workout; unfinished sessions (endedAt === null)
 * never enter the average; empty or all-unfinished input returns null.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { computeAverageSessionDuration, SessionForAggregation } from '@/hooks/historyDomainUtils';

const arbSession = (workoutId: string | null): fc.Arbitrary<SessionForAggregation> =>
  fc.record({
    id: fc.uuid(),
    workoutId: fc.constant(workoutId),
    startedAt: fc.integer({ min: 0, max: 1_000_000_000 }),
    endedAt: fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: null }),
  }).map((s) => ({
    ...s,
    endedAt: s.endedAt === null ? null : s.startedAt + Math.abs(s.endedAt) + 1,
  }));

describe('Property 50: computeAverageSessionDuration', () => {
  it('result is always between min and max of finished durations for the workout', () => {
    fc.assert(
      fc.property(fc.array(arbSession('w1'), { minLength: 1, maxLength: 30 }), (sessions) => {
        const result = computeAverageSessionDuration(sessions, 'w1');
        const finishedDurations = sessions
          .filter((s) => s.endedAt !== null)
          .map((s) => (s.endedAt as number) - s.startedAt);

        if (finishedDurations.length === 0) {
          return result === null;
        }

        const min = Math.min(...finishedDurations);
        const max = Math.max(...finishedDurations);
        return result !== null && result >= min - 1e-9 && result <= max + 1e-9;
      }),
      { numRuns: 200 },
    );
  });

  it('unfinished sessions (endedAt=null) never enter the average', () => {
    fc.assert(
      fc.property(
        fc.array(arbSession('w1'), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (finishedSessions, unfinishedCount) => {
          const allFinished = finishedSessions.map((s) => ({
            ...s,
            endedAt: s.startedAt + 1000,
          }));
          const withUnfinished = [
            ...allFinished,
            ...Array.from({ length: unfinishedCount }, (_, i) => ({
              id: `unfinished-${i}`,
              workoutId: 'w1',
              startedAt: 999_999_999 + i,
              endedAt: null,
            })),
          ];

          const withoutUnfinished = computeAverageSessionDuration(allFinished, 'w1');
          const withUnfinishedResult = computeAverageSessionDuration(withUnfinished, 'w1');

          return withoutUnfinished === withUnfinishedResult;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty array or all-unfinished sessions return null', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
        const sessions: SessionForAggregation[] = Array.from({ length: count }, (_, i) => ({
          id: `s${i}`,
          workoutId: 'w1',
          startedAt: i,
          endedAt: null,
        }));
        return computeAverageSessionDuration(sessions, 'w1') === null;
      }),
      { numRuns: 50 },
    );
  });

  it('filters strictly by workoutId, including null (freestyle sessions)', () => {
    const sessions: SessionForAggregation[] = [
      { id: 's1', workoutId: 'w1', startedAt: 0, endedAt: 1000 },
      { id: 's2', workoutId: 'w2', startedAt: 0, endedAt: 5000 },
      { id: 's3', workoutId: null, startedAt: 0, endedAt: 2000 },
    ];

    expect(computeAverageSessionDuration(sessions, 'w1')).toBe(1000);
    expect(computeAverageSessionDuration(sessions, 'w2')).toBe(5000);
    expect(computeAverageSessionDuration(sessions, null)).toBe(2000);
  });
});
