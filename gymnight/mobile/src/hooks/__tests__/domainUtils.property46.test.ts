/**
 * Property-Based Test — Property 46
 *
 * Volume and per-exercise max estimated_one_rm always equal their exact
 * aggregate definitions, recomputed without network calls.
 *
 * **Validates: Requirements 17.6, 19.6, 21.4**
 *
 * Uses fast-check to generate arbitrary arrays of LoggedSetForCalc objects
 * and verifies that computeVolume and maxOneRmPerExercise produce correct results.
 */
import * as fc from 'fast-check';
import {
  computeVolume,
  maxOneRmPerExercise,
  LoggedSetForCalc,
} from '@/hooks/domainUtils';

// --- Arbitraries ---

/** Arbitrary exerciseId: short alphanumeric string simulating UUIDs */
const arbExerciseId = fc.string({ minLength: 1, maxLength: 12 });

/** Arbitrary positive weight (> 0, bounded to avoid overflow) */
const arbWeight = fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true });

/** Arbitrary positive repetitions (integer >= 1) */
const arbRepetitions = fc.integer({ min: 1, max: 100 });

/** Arbitrary estimatedOneRm (>= 0, bounded) */
const arbEstimatedOneRm = fc.float({ min: 0, max: Math.fround(1000), noNaN: true });

/** Arbitrary LoggedSetForCalc */
const arbLoggedSet: fc.Arbitrary<LoggedSetForCalc> = fc.record({
  exerciseId: arbExerciseId,
  weight: arbWeight,
  repetitions: arbRepetitions,
  estimatedOneRm: arbEstimatedOneRm,
});

/** Arbitrary non-empty array of LoggedSetForCalc */
const arbLoggedSetsNonEmpty = fc.array(arbLoggedSet, { minLength: 1, maxLength: 50 });

/** Arbitrary array of LoggedSetForCalc (may be empty) */
const arbLoggedSets = fc.array(arbLoggedSet, { minLength: 0, maxLength: 50 });

describe('Property 46: Volume and per-exercise max 1RM', () => {
  /**
   * Property 46a: For any non-empty array of LoggedSets, computeVolume equals
   * the manually recomputed sum of weight * repetitions.
   *
   * **Validates: Requirements 17.6, 19.6, 21.4**
   */
  it('computeVolume equals sum(weight * repetitions) for non-empty arrays', () => {
    fc.assert(
      fc.property(arbLoggedSetsNonEmpty, (sets) => {
        const result = computeVolume(sets);
        const expected = sets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);

        // Floating-point tolerance
        const tolerance = Math.abs(expected) * 1e-10 + 1e-10;
        return Math.abs(result - expected) <= tolerance;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 46b: For any array of LoggedSets, maxOneRmPerExercise returns a Map
   * where each exerciseId maps to exactly the maximum estimatedOneRm among that
   * exercise's sets.
   *
   * **Validates: Requirements 17.6, 19.6, 21.4**
   */
  it('maxOneRmPerExercise returns max estimatedOneRm per exerciseId', () => {
    fc.assert(
      fc.property(arbLoggedSets, (sets) => {
        const result = maxOneRmPerExercise(sets);

        // Manually compute expected max per exercise
        const expected = new Map<string, number>();
        for (const s of sets) {
          const current = expected.get(s.exerciseId) ?? -Infinity;
          expected.set(s.exerciseId, Math.max(current, s.estimatedOneRm));
        }

        // Same number of keys
        if (result.size !== expected.size) return false;

        // Each key matches
        for (const [exerciseId, maxVal] of expected) {
          const resultVal = result.get(exerciseId);
          if (resultVal === undefined) return false;
          if (resultVal !== maxVal) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 46c: Both functions are pure — same inputs always produce same outputs.
   *
   * **Validates: Requirements 17.6, 19.6, 21.4**
   */
  it('computeVolume and maxOneRmPerExercise are pure functions', () => {
    fc.assert(
      fc.property(arbLoggedSets, (sets) => {
        // computeVolume purity
        const vol1 = computeVolume(sets);
        const vol2 = computeVolume(sets);
        if (vol1 !== vol2) return false;

        // maxOneRmPerExercise purity
        const map1 = maxOneRmPerExercise(sets);
        const map2 = maxOneRmPerExercise(sets);

        if (map1.size !== map2.size) return false;
        for (const [key, val] of map1) {
          if (map2.get(key) !== val) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 46d: Empty array edge case — computeVolume returns 0,
   * maxOneRmPerExercise returns empty Map.
   *
   * **Validates: Requirements 17.6, 19.6, 21.4**
   */
  it('empty array: computeVolume returns 0, maxOneRmPerExercise returns empty Map', () => {
    fc.assert(
      fc.property(fc.constant([]), (emptyArr: LoggedSetForCalc[]) => {
        const volume = computeVolume(emptyArr);
        const maxMap = maxOneRmPerExercise(emptyArr);

        return volume === 0 && maxMap.size === 0;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 46e: The functions never throw for any valid input.
   *
   * **Validates: Requirements 17.6, 19.6, 21.4**
   */
  it('functions never throw for any valid LoggedSetForCalc input', () => {
    fc.assert(
      fc.property(arbLoggedSets, (sets) => {
        try {
          computeVolume(sets);
          maxOneRmPerExercise(sets);
          return true;
        } catch {
          return false;
        }
      }),
      { numRuns: 100 },
    );
  });
});
