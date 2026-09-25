/**
 * Property-Based Test — Property 73
 *
 * computePeriodDelta: delta_pct = (atual - anterior) / anterior × 100, e 0
 * quando o anterior é 0 (senão divide por zero no primeiro período de uso).
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §3.2
 */
import * as fc from 'fast-check';
import { computePeriodDelta } from '@/hooks/historyDomainUtils';

describe('Property 73: computePeriodDelta', () => {
  it('matches the exact formula for any non-zero previous value', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(100000), noNaN: true }),
        fc.float({ min: Math.fround(0.0001), max: Math.fround(100000), noNaN: true }),
        (current, previous) => {
          const result = computePeriodDelta(current, previous);
          const expected = ((current - previous) / previous) * 100;
          const tolerance = Math.abs(expected) * 1e-9 + 1e-6;
          return Math.abs(result - expected) <= tolerance;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('previous == 0 always yields 0, regardless of current', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: Math.fround(100000), noNaN: true }), (current) => {
        return computePeriodDelta(current, 0) === 0;
      }),
      { numRuns: 100 },
    );
  });

  it('current == previous always yields delta 0 (when previous != 0)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0001), max: Math.fround(100000), noNaN: true }),
        (value) => Math.abs(computePeriodDelta(value, value)) < 1e-6,
      ),
      { numRuns: 100 },
    );
  });

  it('current == 0 and previous > 0 yields exactly -100%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0001), max: Math.fround(100000), noNaN: true }),
        (previous) => Math.abs(computePeriodDelta(0, previous) - -100) < 1e-6,
      ),
      { numRuns: 100 },
    );
  });
});
