/**
 * Property-Based Test — Property 85
 *
 * estimateCardioCalories: buckets exatos de MET por PSE — 1-3→3 MET,
 * 4-6→6 MET, 7-8→9 MET, 9-10→12 MET — e as fronteiras exatas (3/4, 6/7, 8/9)
 * caem no lado certo (cardio_widget.py:69-86).
 */
import * as fc from 'fast-check';
import { estimateCardioCalories } from '../cardioDomain';

const WEIGHT = 70;
const DURATION_MIN = 60; // 1 hora — calorias == MET × peso, sem precisar dividir

describe('Property 85: buckets exatos de MET por PSE', () => {
  it('PSE 1-3 usa MET 3.0', () => {
    for (const pse of [1, 2, 3]) {
      expect(estimateCardioCalories(DURATION_MIN, pse, WEIGHT)).toBe(3.0 * WEIGHT);
    }
  });

  it('PSE 4-6 usa MET 6.0', () => {
    for (const pse of [4, 5, 6]) {
      expect(estimateCardioCalories(DURATION_MIN, pse, WEIGHT)).toBe(6.0 * WEIGHT);
    }
  });

  it('PSE 7-8 usa MET 9.0', () => {
    for (const pse of [7, 8]) {
      expect(estimateCardioCalories(DURATION_MIN, pse, WEIGHT)).toBe(9.0 * WEIGHT);
    }
  });

  it('PSE 9-10 usa MET 12.0', () => {
    for (const pse of [9, 10]) {
      expect(estimateCardioCalories(DURATION_MIN, pse, WEIGHT)).toBe(12.0 * WEIGHT);
    }
  });

  it('fronteira 3/4: PSE 3 e PSE 4 caem em buckets diferentes (3.0 vs 6.0 MET)', () => {
    const at3 = estimateCardioCalories(DURATION_MIN, 3, WEIGHT);
    const at4 = estimateCardioCalories(DURATION_MIN, 4, WEIGHT);
    expect(at3).toBe(3.0 * WEIGHT);
    expect(at4).toBe(6.0 * WEIGHT);
    expect(at4).toBeGreaterThan(at3);
  });

  it('fronteira 6/7: PSE 6 e PSE 7 caem em buckets diferentes (6.0 vs 9.0 MET)', () => {
    const at6 = estimateCardioCalories(DURATION_MIN, 6, WEIGHT);
    const at7 = estimateCardioCalories(DURATION_MIN, 7, WEIGHT);
    expect(at6).toBe(6.0 * WEIGHT);
    expect(at7).toBe(9.0 * WEIGHT);
    expect(at7).toBeGreaterThan(at6);
  });

  it('fronteira 8/9: PSE 8 e PSE 9 caem em buckets diferentes (9.0 vs 12.0 MET)', () => {
    const at8 = estimateCardioCalories(DURATION_MIN, 8, WEIGHT);
    const at9 = estimateCardioCalories(DURATION_MIN, 9, WEIGHT);
    expect(at8).toBe(9.0 * WEIGHT);
    expect(at9).toBe(12.0 * WEIGHT);
    expect(at9).toBeGreaterThan(at8);
  });

  it('property: para qualquer PSE de 1 a 10, o resultado bate com o bucket esperado', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), fc.float({ min: 1, max: 600, noNaN: true }), (pse, duration) => {
        const expectedMet = pse <= 3 ? 3.0 : pse <= 6 ? 6.0 : pse <= 8 ? 9.0 : 12.0;
        const expected = Math.trunc(expectedMet * WEIGHT * (duration / 60));
        return estimateCardioCalories(duration, pse, WEIGHT) === expected;
      }),
      { numRuns: 200 },
    );
  });
});
