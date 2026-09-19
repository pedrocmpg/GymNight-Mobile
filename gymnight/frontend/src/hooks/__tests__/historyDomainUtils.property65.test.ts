/**
 * Property-Based Test — Property 65
 *
 * computeCaloriesBurned: fórmula exata (MET × peso × tempo / 60, tempo =
 * reps × 4s / 60), fallback MET = 5.0 quando o exercício não tem valor
 * cadastrado, aquecimento (setType === 'W') excluído, array vazio → 0.
 *
 * Fórmula fonte: GymNight-Desktop/src/core/routine.py, calculate_session_calories
 * (PARIDADE-02-CATALOGO-MUSCULAR.md §5.1).
 */
import * as fc from 'fast-check';
import { computeCaloriesBurned } from '@/hooks/historyDomainUtils';
import { LoggedSetForCalc } from '@/hooks/domainUtils';

const DEFAULT_MET = 5.0;
const SECONDS_PER_REP = 4;

function expectedCalories(
  loggedSets: LoggedSetForCalc[],
  metByExerciseId: Map<string, number>,
  weightKg: number,
): number {
  let total = 0;
  for (const set of loggedSets) {
    if (set.setType === 'W') continue;
    const met = metByExerciseId.get(set.exerciseId) ?? DEFAULT_MET;
    const timeMin = (set.repetitions * SECONDS_PER_REP) / 60;
    total += (met * weightKg * timeMin) / 60;
  }
  return total;
}

const arbExerciseId = fc.constantFrom('ex-a', 'ex-b', 'ex-c', 'ex-sem-met');
const arbSetType = fc.constantFrom<LoggedSetForCalc['setType']>('N', 'W', 'D', 'F', undefined);

const arbLoggedSet: fc.Arbitrary<LoggedSetForCalc> = fc.record({
  exerciseId: arbExerciseId,
  weight: fc.float({ min: Math.fround(0.1), max: Math.fround(300), noNaN: true }),
  repetitions: fc.integer({ min: 1, max: 50 }),
  estimatedOneRm: fc.constant(0),
  setType: arbSetType,
});

// Nunca inclui 'ex-sem-met', para provar o fallback determinístico em testes dedicados.
const arbMetMap = fc
  .array(
    fc.record({
      exerciseId: fc.constantFrom('ex-a', 'ex-b', 'ex-c'),
      met: fc.float({ min: Math.fround(1), max: Math.fround(15), noNaN: true }),
    }),
    { maxLength: 5 },
  )
  .map((entries) => new Map(entries.map((e) => [e.exerciseId, e.met])));

const arbWeightKg = fc.float({ min: Math.fround(30), max: Math.fround(200), noNaN: true });

describe('Property 65: computeCaloriesBurned — fórmula, fallback, aquecimento excluído', () => {
  it('bate com a fórmula recalculada manualmente para qualquer combinação de séries/MET/peso', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoggedSet, { maxLength: 30 }),
        arbMetMap,
        arbWeightKg,
        (loggedSets, metMap, weightKg) => {
          const result = computeCaloriesBurned(loggedSets, metMap, weightKg);
          const expected = expectedCalories(loggedSets, metMap, weightKg);
          const tolerance = Math.abs(expected) * 1e-9 + 1e-9;
          return Math.abs(result - expected) <= tolerance;
        },
      ),
      { numRuns: 150 },
    );
  });

  it('usa MET = 5.0 quando o exercício não está no mapa', () => {
    const loggedSets: LoggedSetForCalc[] = [
      { exerciseId: 'ex-sem-met', weight: 60, repetitions: 10, estimatedOneRm: 0, setType: 'N' },
    ];
    const weightKg = 70;
    const timeMin = (10 * SECONDS_PER_REP) / 60;
    const expected = (DEFAULT_MET * weightKg * timeMin) / 60;
    expect(computeCaloriesBurned(loggedSets, new Map(), weightKg)).toBeCloseTo(expected, 9);
  });

  it('peso default é 70kg quando não informado', () => {
    const loggedSets: LoggedSetForCalc[] = [
      { exerciseId: 'ex-a', weight: 60, repetitions: 10, estimatedOneRm: 0, setType: 'N' },
    ];
    const metMap = new Map([['ex-a', 8]]);
    const withDefaultWeight = computeCaloriesBurned(loggedSets, metMap);
    const withExplicit70 = computeCaloriesBurned(loggedSets, metMap, 70);
    expect(withDefaultWeight).toBeCloseTo(withExplicit70, 9);
  });

  it('séries de aquecimento (setType "W") nunca contam nas calorias', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoggedSet, { maxLength: 30 }).map((sets) =>
          sets.map((s) => ({ ...s, setType: 'W' as const })),
        ),
        arbMetMap,
        arbWeightKg,
        (warmupOnlySets, metMap, weightKg) => {
          return computeCaloriesBurned(warmupOnlySets, metMap, weightKg) === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('array vazio de séries retorna 0', () => {
    expect(computeCaloriesBurned([], new Map())).toBe(0);
  });
});
