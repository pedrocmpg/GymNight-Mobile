/**
 * Property-Based Test — Property 3
 *
 * Derived selectors are pure recomputations of the latest emission.
 *
 * **Validates: Requirements 1.7**
 *
 * For any arbitrary sequence of emissions (arrays of LoggedSets):
 * 1. Purity: Given the same emission, derived values are always identical
 * 2. Determinism: Derivations do not depend on call order, external state, or time
 * 3. Idempotency: Recomputing multiple times with the same input always produces the same result
 * 4. No mutation: Derivation functions do not modify their input arrays
 * 5. Consistency: totalVolume always equals sum(weight * reps) and
 *    maxOneRmByExercise always equals the per-exercise max
 *
 * Tests the pure domain functions (computeVolume, maxOneRmPerExercise) directly
 * with fast-check to prove they satisfy the property universally.
 */
import * as fc from 'fast-check';
import {
  computeVolume,
  maxOneRmPerExercise,
  type LoggedSetForCalc,
} from '@/hooks/domainUtils';

// --- Arbitraries ---

/** Arbitrary exerciseId: small set to increase collisions for per-exercise grouping */
const arbExerciseId = fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), {
  minLength: 1,
  maxLength: 4,
});

/** Arbitrary positive weight (bounded to avoid overflow) */
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

/** Arbitrary array of LoggedSetForCalc (may be empty, simulating emissions) */
const arbEmission = fc.array(arbLoggedSet, { minLength: 0, maxLength: 50 });

/** Arbitrary sequence of emissions (multiple arrays, simulating a stream) */
const arbEmissions = fc.array(arbEmission, { minLength: 1, maxLength: 10 });

// --- Helpers ---

/** Deep-clone a LoggedSetForCalc array to detect mutations */
function deepClone(sets: LoggedSetForCalc[]): LoggedSetForCalc[] {
  return sets.map((s) => ({ ...s }));
}

/** Compare two Maps for value equality */
function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, val] of a) {
    if (b.get(key) !== val) return false;
  }
  return true;
}

// --- Tests ---

describe('Property 3: Derived selectors are pure recomputations of the latest emission', () => {
  /**
   * Property 3a — Purity: Given the same emission (same LoggedSets array),
   * the derived values (volume, maxOneRm) are always identical.
   *
   * **Validates: Requirements 1.7**
   */
  it('same emission always produces identical derived values (purity)', () => {
    fc.assert(
      fc.property(arbEmission, (emission) => {
        const vol1 = computeVolume(emission);
        const vol2 = computeVolume(emission);

        if (vol1 !== vol2) return false;

        const map1 = maxOneRmPerExercise(emission);
        const map2 = maxOneRmPerExercise(emission);

        return mapsEqual(map1, map2);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3b — Determinism: The derivation does not depend on call order,
   * external state, or time — only on the latest emission.
   *
   * We verify this by computing derivations on multiple emissions in different
   * orders and confirming that the result for each emission depends only on
   * its content, not on which other emissions were processed before/after it.
   *
   * **Validates: Requirements 1.7**
   */
  it('derivations depend only on input, not on call order or prior emissions (determinism)', () => {
    fc.assert(
      fc.property(arbEmissions, (emissions) => {
        // Compute derivations in forward order
        const forwardVolumes = emissions.map((e) => computeVolume(e));
        const forwardMaps = emissions.map((e) => maxOneRmPerExercise(e));

        // Compute derivations in reverse order
        const reversed = [...emissions].reverse();
        const reverseVolumes = reversed.map((e) => computeVolume(e));
        const reverseMaps = reversed.map((e) => maxOneRmPerExercise(e));

        // Re-reverse to compare in original order
        reverseVolumes.reverse();
        reverseMaps.reverse();

        for (let i = 0; i < emissions.length; i++) {
          if (forwardVolumes[i] !== reverseVolumes[i]) return false;
          if (!mapsEqual(forwardMaps[i], reverseMaps[i])) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3c — Idempotency: Recomputing the derivation multiple times
   * with the same input always produces the same result.
   *
   * **Validates: Requirements 1.7**
   */
  it('recomputing N times with same input produces identical results (idempotency)', () => {
    fc.assert(
      fc.property(arbEmission, fc.integer({ min: 3, max: 10 }), (emission, n) => {
        const volumes: number[] = [];
        const maps: Map<string, number>[] = [];

        for (let i = 0; i < n; i++) {
          volumes.push(computeVolume(emission));
          maps.push(maxOneRmPerExercise(emission));
        }

        // All volumes must be identical
        for (let i = 1; i < n; i++) {
          if (volumes[i] !== volumes[0]) return false;
          if (!mapsEqual(maps[i], maps[0])) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3d — No mutation: The derivation functions do not modify their
   * input arrays.
   *
   * **Validates: Requirements 1.7**
   */
  it('derivation functions do not mutate their input arrays (no mutation)', () => {
    fc.assert(
      fc.property(arbEmission, (emission) => {
        const before = deepClone(emission);

        // Call derivation functions
        computeVolume(emission);
        maxOneRmPerExercise(emission);

        // Verify no mutation occurred
        if (emission.length !== before.length) return false;
        for (let i = 0; i < emission.length; i++) {
          if (emission[i].exerciseId !== before[i].exerciseId) return false;
          if (emission[i].weight !== before[i].weight) return false;
          if (emission[i].repetitions !== before[i].repetitions) return false;
          if (emission[i].estimatedOneRm !== before[i].estimatedOneRm) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3e — Consistency: For any emission, totalVolume always equals
   * sum(weight * reps) and maxOneRmByExercise always equals the per-exercise max.
   *
   * **Validates: Requirements 1.7**
   */
  it('totalVolume equals sum(weight*reps) and maxOneRmByExercise equals per-exercise max (consistency)', () => {
    fc.assert(
      fc.property(arbEmission, (emission) => {
        // Verify computeVolume matches manual calculation
        const expectedVolume = emission.reduce(
          (sum, s) => sum + s.weight * s.repetitions,
          0,
        );
        const actualVolume = computeVolume(emission);
        const volTolerance = Math.abs(expectedVolume) * 1e-10 + 1e-10;
        if (Math.abs(actualVolume - expectedVolume) > volTolerance) return false;

        // Verify maxOneRmPerExercise matches manual calculation
        const expectedMax = new Map<string, number>();
        for (const s of emission) {
          const current = expectedMax.get(s.exerciseId) ?? -Infinity;
          expectedMax.set(s.exerciseId, Math.max(current, s.estimatedOneRm));
        }
        const actualMax = maxOneRmPerExercise(emission);

        return mapsEqual(actualMax, expectedMax);
      }),
      { numRuns: 100 },
    );
  });
});
