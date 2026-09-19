/**
 * Property-Based Test — Property 66
 *
 * computeCaloriesBurned: monotonicidade — aumentar as repetições de uma série
 * (mantendo tudo o mais igual) nunca resulta em menos calorias. Como MET e
 * peso são sempre > 0, calorias cresce (fracamente) com reps.
 */
import * as fc from 'fast-check';
import { computeCaloriesBurned } from '@/hooks/historyDomainUtils';
import { LoggedSetForCalc } from '@/hooks/domainUtils';

const arbExerciseId = fc.constantFrom('ex-a', 'ex-b', 'ex-c');
const arbNonWarmupSetType = fc.constantFrom<LoggedSetForCalc['setType']>('N', 'D', 'F', undefined);

const arbLoggedSet: fc.Arbitrary<LoggedSetForCalc> = fc.record({
  exerciseId: arbExerciseId,
  weight: fc.float({ min: Math.fround(0.1), max: Math.fround(300), noNaN: true }),
  repetitions: fc.integer({ min: 1, max: 50 }),
  estimatedOneRm: fc.constant(0),
  setType: arbNonWarmupSetType,
});

const arbMetMap = fc
  .array(
    fc.record({
      exerciseId: arbExerciseId,
      met: fc.float({ min: Math.fround(1), max: Math.fround(15), noNaN: true }),
    }),
    { maxLength: 5 },
  )
  .map((entries) => new Map(entries.map((e) => [e.exerciseId, e.met])));

const arbWeightKg = fc.float({ min: Math.fround(30), max: Math.fround(200), noNaN: true });

describe('Property 66: computeCaloriesBurned é monotônica em repetições', () => {
  it('aumentar as repetições de uma série nunca reduz o total de calorias', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoggedSet, { maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 200 }),
        arbMetMap,
        arbWeightKg,
        (baseSets, targetIndex, repIncrease, metMap, weightKg) => {
          if (baseSets.length === 0) return true; // nada para aumentar
          const index = targetIndex % baseSets.length;

          const before = computeCaloriesBurned(baseSets, metMap, weightKg);

          const increasedSets = baseSets.map((s, i) =>
            i === index ? { ...s, repetitions: s.repetitions + repIncrease } : s,
          );
          const after = computeCaloriesBurned(increasedSets, metMap, weightKg);

          return after >= before - 1e-9;
        },
      ),
      { numRuns: 150 },
    );
  });

  it('duplicar uma série (adicionar uma cópia idêntica) nunca reduz o total', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoggedSet, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }),
        arbMetMap,
        arbWeightKg,
        (baseSets, targetIndex, metMap, weightKg) => {
          const index = targetIndex % baseSets.length;
          const before = computeCaloriesBurned(baseSets, metMap, weightKg);
          const duplicated = [...baseSets, baseSets[index]];
          const after = computeCaloriesBurned(duplicated, metMap, weightKg);
          return after >= before - 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });
});
