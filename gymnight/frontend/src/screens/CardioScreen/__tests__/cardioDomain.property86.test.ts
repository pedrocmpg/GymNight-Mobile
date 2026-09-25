/**
 * Property-Based Test — Property 86
 *
 * estimateCardioCalories: monotonicidade — mais duração nunca resulta em
 * menos calorias (MET e peso são sempre > 0); o resultado é sempre TRUNCADO
 * (nunca arredondado), verbatim do `int()` do desktop.
 */
import * as fc from 'fast-check';
import { estimateCardioCalories } from '../cardioDomain';

describe('Property 86: monotonicidade em duração; resultado truncado', () => {
  it('aumentar a duração nunca reduz as calorias, para qualquer PSE/peso', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.float({ min: 1, max: 300, noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(300), noNaN: true }),
        fc.float({ min: 30, max: 300, noNaN: true }),
        (pse, baseDuration, extraDuration, weightKg) => {
          const before = estimateCardioCalories(baseDuration, pse, weightKg);
          const after = estimateCardioCalories(baseDuration + extraDuration, pse, weightKg);
          return after >= before;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('o resultado é sempre um inteiro (truncado), nunca uma fração', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: 30, max: 300, noNaN: true }),
        (pse, duration, weightKg) => {
          const result = estimateCardioCalories(duration, pse, weightKg);
          return Number.isInteger(result);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('trunca em vez de arredondar: 3.5 calorias exatas viram 3, nunca 4', () => {
    // 3.0 MET × 70kg × (1/60)h = 3.5 calorias -> trunca para 3, não arredonda para 4.
    expect(estimateCardioCalories(1, 1, 70)).toBe(3);
  });

  it('duração 0 sempre produz 0 calorias, para qualquer PSE/peso', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.float({ min: 30, max: 300, noNaN: true }),
        (pse, weightKg) => estimateCardioCalories(0, pse, weightKg) === 0,
      ),
      { numRuns: 100 },
    );
  });

  it('aumentar o PSE (mudando de bucket) nunca reduz as calorias, duração/peso fixos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.float({ min: 1, max: 300, noNaN: true }),
        fc.float({ min: 30, max: 300, noNaN: true }),
        (pse, duration, weightKg) => {
          const before = estimateCardioCalories(duration, pse, weightKg);
          const after = estimateCardioCalories(duration, pse + 1, weightKg);
          return after >= before;
        },
      ),
      { numRuns: 200 },
    );
  });
});
