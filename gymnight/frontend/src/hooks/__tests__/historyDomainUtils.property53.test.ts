/**
 * Property-Based Test — Property 53
 *
 * isNewPersonalRecord returns true iff the last point in the series is strictly
 * greater than the max of all previous points. Empty and single-point series are
 * never considered a "new" PR.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { isNewPersonalRecord, OneRmDataPoint } from '@/hooks/historyDomainUtils';

const arbSeries = fc.array(
  fc.record({
    timestampMs: fc.integer({ min: 0, max: 2_000_000_000 }),
    estimatedOneRm: fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
  }),
  { maxLength: 50 },
);

describe('Property 53: isNewPersonalRecord', () => {
  it('true iff last point is strictly greater than the max of all previous points', () => {
    fc.assert(
      fc.property(arbSeries, (series: OneRmDataPoint[]) => {
        const result = isNewPersonalRecord(series);
        if (series.length < 2) return result === false;

        const last = series[series.length - 1];
        const previousMax = series
          .slice(0, -1)
          .reduce((max, p) => Math.max(max, p.estimatedOneRm), -Infinity);

        return result === last.estimatedOneRm > previousMax;
      }),
      { numRuns: 200 },
    );
  });

  it('empty series is never a new PR', () => {
    expect(isNewPersonalRecord([])).toBe(false);
  });

  it('single-point series is never a new PR', () => {
    expect(isNewPersonalRecord([{ timestampMs: 0, estimatedOneRm: 100 }])).toBe(false);
  });

  it('a strictly increasing series always ends in a new PR', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: Math.fround(100), noNaN: true }), { minLength: 2, maxLength: 20 }),
        (deltas) => {
          let running = 0;
          const series: OneRmDataPoint[] = deltas.map((d, i) => {
            running += Math.abs(d) + 1;
            return { timestampMs: i, estimatedOneRm: running };
          });
          return isNewPersonalRecord(series) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a tie with the previous max is never a new PR (strictly greater required)', () => {
    const series: OneRmDataPoint[] = [
      { timestampMs: 0, estimatedOneRm: 100 },
      { timestampMs: 1, estimatedOneRm: 100 },
    ];
    expect(isNewPersonalRecord(series)).toBe(false);
  });
});
