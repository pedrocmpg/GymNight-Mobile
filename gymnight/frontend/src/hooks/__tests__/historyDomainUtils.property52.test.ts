/**
 * Property-Based Test — Property 52
 *
 * buildOneRmTimeSeries: output is always sorted by increasing time, contains only
 * points for the requested exerciseId, and its length equals the number of logged
 * sets for that exercise.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { buildOneRmTimeSeries } from '@/hooks/historyDomainUtils';

const arbLoggedSet = fc.record({
  exerciseId: fc.constantFrom('ex1', 'ex2', 'ex3'),
  estimatedOneRm: fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
  completedAt: fc.integer({ min: 0, max: 2_000_000_000 }),
});

describe('Property 52: buildOneRmTimeSeries', () => {
  it('output is sorted by increasing timestampMs', () => {
    fc.assert(
      fc.property(fc.array(arbLoggedSet, { maxLength: 50 }), fc.constantFrom('ex1', 'ex2', 'ex3'), (sets, exerciseId) => {
        const series = buildOneRmTimeSeries(sets, exerciseId);
        for (let i = 1; i < series.length; i++) {
          if (series[i].timestampMs < series[i - 1].timestampMs) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('contains only points matching the requested exerciseId', () => {
    fc.assert(
      fc.property(fc.array(arbLoggedSet, { maxLength: 50 }), fc.constantFrom('ex1', 'ex2', 'ex3'), (sets, exerciseId) => {
        const series = buildOneRmTimeSeries(sets, exerciseId);
        const expectedValues = new Set(
          sets.filter((s) => s.exerciseId === exerciseId).map((s) => s.estimatedOneRm),
        );
        return series.every((p) => expectedValues.has(p.estimatedOneRm));
      }),
      { numRuns: 200 },
    );
  });

  it('length equals the number of logged sets for that exercise', () => {
    fc.assert(
      fc.property(fc.array(arbLoggedSet, { maxLength: 50 }), fc.constantFrom('ex1', 'ex2', 'ex3'), (sets, exerciseId) => {
        const series = buildOneRmTimeSeries(sets, exerciseId);
        const expectedLength = sets.filter((s) => s.exerciseId === exerciseId).length;
        return series.length === expectedLength;
      }),
      { numRuns: 200 },
    );
  });

  it('empty input returns an empty array', () => {
    expect(buildOneRmTimeSeries([], 'ex1')).toEqual([]);
  });
});
