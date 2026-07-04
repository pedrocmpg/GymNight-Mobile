/**
 * Property-Based Test — Property 45
 *
 * estimated_one_rm always equals the Epley formula result when no explicit value is supplied.
 *
 * **Validates: Requirements 19.5, 21.3**
 *
 * Uses fast-check to generate arbitrary positive weights and repetitions to verify
 * the Epley Formula property holds universally.
 */
import * as fc from 'fast-check';
import { computeEstimatedOneRm } from '@/hooks/domainUtils';

// Arbitrary: positive weight (32-bit float, > 0)
const arbWeight = fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noNaN: true });

// Arbitrary: positive repetitions (integer >= 1)
const arbRepetitions = fc.integer({ min: 1, max: 100 });

// Arbitrary: explicit 1RM value (32-bit float, >= 0)
const arbExplicit = fc.float({ min: 0, max: Math.fround(2000), noNaN: true });

describe('Property 45: computeEstimatedOneRm — Epley Formula', () => {
  /**
   * Property 45a: When no explicit value is supplied, the result MUST equal
   * weight * (1 + repetitions / 30) (Epley formula).
   *
   * **Validates: Requirements 19.5, 21.3**
   */
  it('without explicit value, result equals weight * (1 + repetitions / 30)', () => {
    fc.assert(
      fc.property(arbWeight, arbRepetitions, (weight, repetitions) => {
        const result = computeEstimatedOneRm(weight, repetitions);
        const expected = weight * (1 + repetitions / 30);

        // Use relative tolerance for floating-point comparison
        const tolerance = Math.abs(expected) * 1e-10 + 1e-10;
        return Math.abs(result - expected) <= tolerance;
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 45b: When an explicit value IS supplied, the result MUST equal
   * exactly that explicit value (formula is bypassed).
   *
   * **Validates: Requirements 19.5, 21.3**
   */
  it('with explicit value, result equals exactly the explicit value', () => {
    fc.assert(
      fc.property(arbWeight, arbRepetitions, arbExplicit, (weight, repetitions, explicitValue) => {
        const result = computeEstimatedOneRm(weight, repetitions, explicitValue);
        return result === explicitValue;
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 45c: The function is pure — same inputs always produce same outputs.
   *
   * **Validates: Requirements 19.5, 21.3**
   */
  it('is a pure function: same inputs always produce same outputs', () => {
    fc.assert(
      fc.property(
        arbWeight,
        arbRepetitions,
        fc.option(arbExplicit, { nil: undefined }),
        (weight, repetitions, explicit) => {
          const result1 = computeEstimatedOneRm(weight, repetitions, explicit);
          const result2 = computeEstimatedOneRm(weight, repetitions, explicit);
          return result1 === result2;
        },
      ),
      { numRuns: 200 },
    );
  });
});
