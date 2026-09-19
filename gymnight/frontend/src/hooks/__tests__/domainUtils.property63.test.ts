/**
 * Property-Based Test — Property 63
 *
 * computeMuscleVolume: para cada grupo muscular, o volume é exatamente
 * Σ(weight × repetitions × contribution) das séries do exercício mapeado
 * para aquele grupo, EXCLUINDO séries de aquecimento (setType === 'W').
 *
 * Validates: PARIDADE-02-CATALOGO-MUSCULAR.md §6, property 63
 */
import * as fc from 'fast-check';
import {
  computeMuscleVolume,
  ExerciseMuscleContribution,
  LoggedSetForCalc,
} from '@/hooks/domainUtils';

const arbExerciseId = fc.constantFrom('ex-a', 'ex-b', 'ex-c');
const arbMuscleGroupId = fc.constantFrom('peito', 'costas', 'pernas');
const arbSetType = fc.constantFrom<LoggedSetForCalc['setType']>('N', 'W', 'D', 'F', undefined);

const arbLoggedSet: fc.Arbitrary<LoggedSetForCalc> = fc.record({
  exerciseId: arbExerciseId,
  weight: fc.float({ min: Math.fround(0.1), max: Math.fround(300), noNaN: true }),
  repetitions: fc.integer({ min: 1, max: 50 }),
  estimatedOneRm: fc.constant(0),
  setType: arbSetType,
});

const arbContribution: fc.Arbitrary<ExerciseMuscleContribution> = fc.record({
  exerciseId: arbExerciseId,
  muscleGroupId: arbMuscleGroupId,
  contribution: fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }),
});

function recompute(
  loggedSets: LoggedSetForCalc[],
  muscleMap: ExerciseMuscleContribution[],
): Map<string, number> {
  const expected = new Map<string, number>();
  for (const set of loggedSets) {
    if (set.setType === 'W') continue;
    for (const entry of muscleMap) {
      if (entry.exerciseId !== set.exerciseId) continue;
      const contribVolume = set.weight * set.repetitions * entry.contribution;
      expected.set(entry.muscleGroupId, (expected.get(entry.muscleGroupId) ?? 0) + contribVolume);
    }
  }
  return expected;
}

describe('Property 63: computeMuscleVolume = Σ(weight × reps × contribution) por grupo, sem aquecimento', () => {
  it('bate com a soma recalculada manualmente, para qualquer combinação de séries e mapa muscular', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoggedSet, { maxLength: 30 }),
        fc.array(arbContribution, { maxLength: 10 }),
        (loggedSets, muscleMap) => {
          const result = computeMuscleVolume(loggedSets, muscleMap);
          const expected = recompute(loggedSets, muscleMap);

          if (result.size !== expected.size) return false;
          for (const [group, volume] of expected) {
            const got = result.get(group);
            if (got === undefined) return false;
            const tolerance = Math.abs(volume) * 1e-9 + 1e-9;
            if (Math.abs(got - volume) > tolerance) return false;
          }
          return true;
        },
      ),
      { numRuns: 150 },
    );
  });

  it('séries de aquecimento (setType "W") nunca contribuem para nenhum grupo', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoggedSet, { maxLength: 30 }).map((sets) =>
          sets.map((s) => ({ ...s, setType: 'W' as const })),
        ),
        fc.array(arbContribution, { maxLength: 10 }),
        (warmupOnlySets, muscleMap) => {
          const result = computeMuscleVolume(warmupOnlySets, muscleMap);
          return result.size === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('exercício sem entrada em muscleMap não contribui para nenhum grupo', () => {
    const loggedSets: LoggedSetForCalc[] = [
      { exerciseId: 'unmapped', weight: 100, repetitions: 10, estimatedOneRm: 0, setType: 'N' },
    ];
    expect(computeMuscleVolume(loggedSets, []).size).toBe(0);
  });

  it('array vazio de séries retorna Map vazio', () => {
    const muscleMap: ExerciseMuscleContribution[] = [
      { exerciseId: 'ex-a', muscleGroupId: 'peito', contribution: 0.5 },
    ];
    expect(computeMuscleVolume([], muscleMap).size).toBe(0);
  });
});
