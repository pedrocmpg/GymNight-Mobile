/**
 * Property-Based Test — Property 51
 *
 * findLastTrainedAt/daysSince: monotonicity (the most recent finished session
 * always wins) and null when there are no finished sessions for the workoutId.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { findLastTrainedAt, daysSince, SessionForAggregation } from '@/hooks/historyDomainUtils';

describe('Property 51: findLastTrainedAt / daysSince', () => {
  it('findLastTrainedAt equals the max startedAt among finished sessions for the workout', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            startedAt: fc.integer({ min: 0, max: 2_000_000_000 }),
            finished: fc.boolean(),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (specs) => {
          const sessions: SessionForAggregation[] = specs.map((s) => ({
            id: s.id,
            workoutId: 'w1',
            startedAt: s.startedAt,
            endedAt: s.finished ? s.startedAt + 1 : null,
          }));

          const result = findLastTrainedAt(sessions, 'w1');
          const finished = sessions.filter((s) => s.endedAt !== null);

          if (finished.length === 0) return result === null;
          const expected = Math.max(...finished.map((s) => s.startedAt));
          return result === expected;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns null when there are no finished sessions for the workoutId', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
        const sessions: SessionForAggregation[] = Array.from({ length: count }, (_, i) => ({
          id: `s${i}`,
          workoutId: 'w1',
          startedAt: i,
          endedAt: null,
        }));
        return findLastTrainedAt(sessions, 'w1') === null;
      }),
      { numRuns: 50 },
    );
  });

  it('daysSince is monotonic: a more recent timestamp never yields more days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000_000 }),
        fc.integer({ min: 0, max: 1_000_000_000_000 }),
        (t1, t2) => {
          const now = () => 2_000_000_000_000;
          const [older, newer] = t1 <= t2 ? [t1, t2] : [t2, t1];
          const daysOlder = daysSince(older, now) as number;
          const daysNewer = daysSince(newer, now) as number;
          return daysNewer <= daysOlder;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('daysSince(null) is always null', () => {
    expect(daysSince(null)).toBeNull();
  });

  it('daysSince(now) is 0', () => {
    const now = () => 1_700_000_000_000;
    expect(daysSince(now(), now)).toBe(0);
  });
});
