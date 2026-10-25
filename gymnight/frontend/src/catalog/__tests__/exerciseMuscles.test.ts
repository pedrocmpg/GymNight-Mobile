import { buildExerciseMuscleIndex } from '../exerciseMuscles';

const GROUPS = [
  { id: 'g1', name: 'Peito' },
  { id: 'g2', name: 'Tríceps' },
  { id: 'g3', name: 'Ombros' },
];

describe('buildExerciseMuscleIndex', () => {
  it('uses the biggest contribution as the primary group', () => {
    const index = buildExerciseMuscleIndex(
      [
        { exerciseId: 'e1', muscleGroupId: 'g2', contribution: 0.15 },
        { exerciseId: 'e1', muscleGroupId: 'g1', contribution: 0.7 },
        { exerciseId: 'e1', muscleGroupId: 'g3', contribution: 0.15 },
      ],
      GROUPS,
    );
    expect(index.get('e1')).toEqual({ primaryGroup: 'Peito', secondaryGroups: ['Ombros', 'Tríceps'] });
  });

  it('orders secondaries by contribution before name', () => {
    const index = buildExerciseMuscleIndex(
      [
        { exerciseId: 'e1', muscleGroupId: 'g1', contribution: 0.6 },
        { exerciseId: 'e1', muscleGroupId: 'g3', contribution: 0.1 },
        { exerciseId: 'e1', muscleGroupId: 'g2', contribution: 0.3 },
      ],
      GROUPS,
    );
    expect(index.get('e1')?.secondaryGroups).toEqual(['Tríceps', 'Ombros']);
  });

  it('has a single primary and no secondaries for 100% exercises', () => {
    const index = buildExerciseMuscleIndex(
      [{ exerciseId: 'e1', muscleGroupId: 'g1', contribution: 1 }],
      GROUPS,
    );
    expect(index.get('e1')).toEqual({ primaryGroup: 'Peito', secondaryGroups: [] });
  });

  it('ignores rows whose muscle group has not synced yet', () => {
    const index = buildExerciseMuscleIndex(
      [{ exerciseId: 'e1', muscleGroupId: 'unknown', contribution: 1 }],
      GROUPS,
    );
    expect(index.has('e1')).toBe(false);
  });
});
