/**
 * Property-Based Test — Property 72
 *
 * groupMuscleVolumeIntoCategories: agrupamento exato de statistics.py:120-131
 * — Bíceps + Tríceps somam em "Braços", Abdômen vira "Core", e nada se perde
 * na soma (todo volume de entrada aparece em alguma categoria de saída,
 * quando o nome do grupo é reconhecido).
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §2.1, property 72
 */
import * as fc from 'fast-check';
import {
  RADAR_CATEGORIES,
  groupMuscleVolumeIntoCategories,
} from '@/hooks/domainUtils';

const MUSCLE_GROUP_NAMES = [
  'Peito',
  'Costas',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Pernas',
  'Abdômen',
] as const;

const arbVolume = fc.float({ min: 0, max: Math.fround(10000), noNaN: true });

const arbVolumeByMuscleGroup = fc
  .uniqueArray(fc.constantFrom(...MUSCLE_GROUP_NAMES), { minLength: 1, maxLength: 7 })
  .chain((names) =>
    fc.tuple(...names.map(() => arbVolume)).map((volumes) => {
      const volumeByMuscleGroupId = new Map<string, number>();
      const muscleGroupNameById = new Map<string, string>();
      names.forEach((name, i) => {
        const id = `group-${name}`;
        volumeByMuscleGroupId.set(id, volumes[i]);
        muscleGroupNameById.set(id, name);
      });
      return { volumeByMuscleGroupId, muscleGroupNameById, names, volumes };
    }),
  );

describe('Property 72: groupMuscleVolumeIntoCategories — Bíceps+Tríceps -> Braços, Abdômen -> Core', () => {
  it('always returns exactly the 6 RADAR_CATEGORIES keys, even with a partial catalog', () => {
    fc.assert(
      fc.property(arbVolumeByMuscleGroup, ({ volumeByMuscleGroupId, muscleGroupNameById }) => {
        const result = groupMuscleVolumeIntoCategories(volumeByMuscleGroupId, muscleGroupNameById);
        return (
          result.size === RADAR_CATEGORIES.length &&
          RADAR_CATEGORIES.every((c) => result.has(c))
        );
      }),
      { numRuns: 100 },
    );
  });

  it('nothing is lost: total volume in equals total volume out', () => {
    fc.assert(
      fc.property(arbVolumeByMuscleGroup, ({ volumeByMuscleGroupId, muscleGroupNameById, volumes }) => {
        const result = groupMuscleVolumeIntoCategories(volumeByMuscleGroupId, muscleGroupNameById);
        const totalIn = volumes.reduce((sum, v) => sum + v, 0);
        const totalOut = [...result.values()].reduce((sum, v) => sum + v, 0);
        return Math.abs(totalIn - totalOut) < 1e-6;
      }),
      { numRuns: 100 },
    );
  });

  it('Bíceps and Tríceps volumes sum exactly into "Braços"', () => {
    const volumeByMuscleGroupId = new Map([
      ['g-biceps', 100],
      ['g-triceps', 50],
    ]);
    const muscleGroupNameById = new Map([
      ['g-biceps', 'Bíceps'],
      ['g-triceps', 'Tríceps'],
    ]);
    const result = groupMuscleVolumeIntoCategories(volumeByMuscleGroupId, muscleGroupNameById);
    expect(result.get('Braços')).toBe(150);
  });

  it('Abdômen is renamed to "Core", 1:1', () => {
    const volumeByMuscleGroupId = new Map([['g-abdomen', 77]]);
    const muscleGroupNameById = new Map([['g-abdomen', 'Abdômen']]);
    const result = groupMuscleVolumeIntoCategories(volumeByMuscleGroupId, muscleGroupNameById);
    expect(result.get('Core')).toBe(77);
  });

  it('Peito, Costas, Ombros and Pernas pass through unchanged (1:1 category)', () => {
    const volumeByMuscleGroupId = new Map([
      ['g-peito', 10],
      ['g-costas', 20],
      ['g-ombros', 30],
      ['g-pernas', 40],
    ]);
    const muscleGroupNameById = new Map([
      ['g-peito', 'Peito'],
      ['g-costas', 'Costas'],
      ['g-ombros', 'Ombros'],
      ['g-pernas', 'Pernas'],
    ]);
    const result = groupMuscleVolumeIntoCategories(volumeByMuscleGroupId, muscleGroupNameById);
    expect(result.get('Peito')).toBe(10);
    expect(result.get('Costas')).toBe(20);
    expect(result.get('Ombros')).toBe(30);
    expect(result.get('Pernas')).toBe(40);
  });

  it('empty input yields all 6 categories at 0, not an empty map', () => {
    const result = groupMuscleVolumeIntoCategories(new Map(), new Map());
    expect(result.size).toBe(6);
    for (const category of RADAR_CATEGORIES) {
      expect(result.get(category)).toBe(0);
    }
  });

  it('unrecognized muscle group names are ignored, never thrown or summed', () => {
    const volumeByMuscleGroupId = new Map([['g-unknown', 999]]);
    const muscleGroupNameById = new Map([['g-unknown', 'Grupo Inventado']]);
    const result = groupMuscleVolumeIntoCategories(volumeByMuscleGroupId, muscleGroupNameById);
    const total = [...result.values()].reduce((sum, v) => sum + v, 0);
    expect(total).toBe(0);
  });
});
