/**
 * Testes unitários para os utilitários de cálculo de domínio.
 *
 * Verifica computeVolume, computeEstimatedOneRm, e maxOneRmPerExercise
 * como funções puras, sem dependência de Sync_Engine ou rede.
 *
 * Requirements: 19.5, 19.6, 21.3, 21.4
 */
import {
  computeVolume,
  computeEstimatedOneRm,
  maxOneRmPerExercise,
  type LoggedSetForCalc,
} from '@/hooks/domainUtils';

describe('computeVolume', () => {
  it('should return 0 for an empty array of logged sets', () => {
    expect(computeVolume([])).toBe(0);
  });

  it('should compute volume as sum of weight * repetitions for a single set', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 100, repetitions: 10, estimatedOneRm: 133.33 },
    ];
    expect(computeVolume(sets)).toBe(1000);
  });

  it('should compute volume across multiple sets and exercises', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 80, repetitions: 10, estimatedOneRm: 106.67 },
      { exerciseId: 'e2', weight: 60, repetitions: 12, estimatedOneRm: 84 },
      { exerciseId: 'e1', weight: 85, repetitions: 8, estimatedOneRm: 107.67 },
    ];
    // 80*10 + 60*12 + 85*8 = 800 + 720 + 680 = 2200
    expect(computeVolume(sets)).toBe(2200);
  });

  it('should handle sets with weight 0', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 0, repetitions: 15, estimatedOneRm: 0 },
    ];
    expect(computeVolume(sets)).toBe(0);
  });

  it('should handle sets with repetitions 0', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 100, repetitions: 0, estimatedOneRm: 100 },
    ];
    expect(computeVolume(sets)).toBe(0);
  });
});

describe('computeEstimatedOneRm', () => {
  it('should compute Epley formula: weight * (1 + reps/30)', () => {
    // 100 * (1 + 10/30) = 100 * 1.3333... = 133.333...
    expect(computeEstimatedOneRm(100, 10)).toBeCloseTo(133.333, 2);
  });

  it('should return weight when repetitions is 0 (edge case)', () => {
    // 100 * (1 + 0/30) = 100
    expect(computeEstimatedOneRm(100, 0)).toBe(100);
  });

  it('should return the explicit value when supplied, ignoring the formula', () => {
    expect(computeEstimatedOneRm(100, 10, 150)).toBe(150);
  });

  it('should return explicit value even if it is 0', () => {
    expect(computeEstimatedOneRm(100, 10, 0)).toBe(0);
  });

  it('should not use explicit when undefined', () => {
    const result = computeEstimatedOneRm(60, 5, undefined);
    // 60 * (1 + 5/30) = 60 * 1.1667 = 70
    expect(result).toBeCloseTo(70, 2);
  });

  it('should handle weight of 1 and high repetitions', () => {
    // 1 * (1 + 50/30) = 1 * 2.6667 = 2.6667
    expect(computeEstimatedOneRm(1, 50)).toBeCloseTo(2.6667, 3);
  });
});

describe('maxOneRmPerExercise', () => {
  it('should return an empty map for an empty array', () => {
    const result = maxOneRmPerExercise([]);
    expect(result.size).toBe(0);
  });

  it('should return the single value when only one set per exercise', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 100, repetitions: 10, estimatedOneRm: 133.33 },
    ];
    const result = maxOneRmPerExercise(sets);
    expect(result.get('e1')).toBe(133.33);
  });

  it('should return the maximum estimatedOneRm per exercise', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 80, repetitions: 10, estimatedOneRm: 106.67 },
      { exerciseId: 'e1', weight: 100, repetitions: 5, estimatedOneRm: 116.67 },
      { exerciseId: 'e2', weight: 60, repetitions: 12, estimatedOneRm: 84 },
      { exerciseId: 'e2', weight: 70, repetitions: 8, estimatedOneRm: 88.67 },
    ];
    const result = maxOneRmPerExercise(sets);

    expect(result.get('e1')).toBe(116.67);
    expect(result.get('e2')).toBe(88.67);
    expect(result.size).toBe(2);
  });

  it('should handle multiple exercises each with a single set', () => {
    const sets: LoggedSetForCalc[] = [
      { exerciseId: 'e1', weight: 100, repetitions: 1, estimatedOneRm: 103.33 },
      { exerciseId: 'e2', weight: 50, repetitions: 20, estimatedOneRm: 83.33 },
      { exerciseId: 'e3', weight: 200, repetitions: 1, estimatedOneRm: 206.67 },
    ];
    const result = maxOneRmPerExercise(sets);

    expect(result.size).toBe(3);
    expect(result.get('e1')).toBe(103.33);
    expect(result.get('e2')).toBe(83.33);
    expect(result.get('e3')).toBe(206.67);
  });
});
