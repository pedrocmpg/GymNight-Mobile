/**
 * Property-Based Test — Property 64
 *
 * computeVolume: séries com setType === 'W' (aquecimento) nunca entram no
 * total, em qualquer combinação com séries de outros tipos ('N', 'D', 'F',
 * ausente/'') — refactor retroativo descrito em
 * PARIDADE-02-CATALOGO-MUSCULAR.md §4.
 */
import * as fc from 'fast-check';
import { computeVolume, LoggedSetForCalc } from '@/hooks/domainUtils';

const arbNonWarmupSetType = fc.constantFrom<LoggedSetForCalc['setType']>('N', 'D', 'F', '', undefined);

const arbNonWarmupSet: fc.Arbitrary<LoggedSetForCalc> = fc.record({
  exerciseId: fc.string({ minLength: 1, maxLength: 10 }),
  weight: fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
  repetitions: fc.integer({ min: 1, max: 100 }),
  estimatedOneRm: fc.constant(0),
  setType: arbNonWarmupSetType,
});

const arbWarmupSet: fc.Arbitrary<LoggedSetForCalc> = fc.record({
  exerciseId: fc.string({ minLength: 1, maxLength: 10 }),
  weight: fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
  repetitions: fc.integer({ min: 1, max: 100 }),
  estimatedOneRm: fc.constant(0),
  setType: fc.constant<'W'>('W'),
});

describe("Property 64: computeVolume exclui setType 'W' em qualquer combinação", () => {
  it('volume de uma lista mista == volume da mesma lista sem as séries "W"', () => {
    fc.assert(
      fc.property(
        fc.array(arbNonWarmupSet, { maxLength: 20 }),
        fc.array(arbWarmupSet, { maxLength: 20 }),
        fc.array(fc.boolean(), { maxLength: 40 }), // ordem de interleaving
        (nonWarmup, warmup, interleaving) => {
          // Intercala as duas listas numa ordem arbitrária determinada por `interleaving`.
          const mixed: LoggedSetForCalc[] = [];
          let i = 0;
          let j = 0;
          for (const takeWarmup of interleaving) {
            if (takeWarmup && j < warmup.length) {
              mixed.push(warmup[j]);
              j += 1;
            } else if (i < nonWarmup.length) {
              mixed.push(nonWarmup[i]);
              i += 1;
            }
          }
          mixed.push(...nonWarmup.slice(i), ...warmup.slice(j));

          const volumeWithWarmup = computeVolume(mixed);
          const volumeWithoutWarmup = computeVolume(nonWarmup);

          const tolerance = Math.abs(volumeWithoutWarmup) * 1e-9 + 1e-9;
          return Math.abs(volumeWithWarmup - volumeWithoutWarmup) <= tolerance;
        },
      ),
      { numRuns: 150 },
    );
  });

  it('lista só com séries "W" sempre resulta em volume 0', () => {
    fc.assert(
      fc.property(fc.array(arbWarmupSet, { minLength: 1, maxLength: 30 }), (warmupSets) => {
        return computeVolume(warmupSets) === 0;
      }),
      { numRuns: 100 },
    );
  });

  it('adicionar mais séries "W" a uma lista existente nunca muda o volume', () => {
    fc.assert(
      fc.property(
        fc.array(arbNonWarmupSet, { maxLength: 20 }),
        fc.array(arbWarmupSet, { minLength: 1, maxLength: 20 }),
        (nonWarmup, extraWarmup) => {
          const before = computeVolume(nonWarmup);
          const after = computeVolume([...nonWarmup, ...extraWarmup]);
          const tolerance = Math.abs(before) * 1e-9 + 1e-9;
          return Math.abs(after - before) <= tolerance;
        },
      ),
      { numRuns: 100 },
    );
  });
});
