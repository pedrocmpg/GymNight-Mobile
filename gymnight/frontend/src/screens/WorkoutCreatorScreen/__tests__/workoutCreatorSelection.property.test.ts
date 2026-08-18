import fc from 'fast-check';
import { buildExerciseInputs, canSaveWorkout, SelectedExerciseEntry } from '../workoutCreatorSelection';

/**
 * Property: buildExerciseInputs keeps only entries with complete, positive targets;
 * canSaveWorkout requires a valid name AND at least one such entry.
 */

const positiveTargetArb = fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true });
const invalidTargetArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(0),
  fc.float({ min: Math.fround(-1000), max: 0, noNaN: true }),
);

const validEntryArb: fc.Arbitrary<SelectedExerciseEntry> = fc.record({
  exerciseId: fc.uuid(),
  seriesTarget: positiveTargetArb,
  repsTarget: positiveTargetArb,
  weightTarget: positiveTargetArb,
});

const invalidEntryArb: fc.Arbitrary<SelectedExerciseEntry> = fc.record({
  exerciseId: fc.uuid(),
  seriesTarget: invalidTargetArb,
  repsTarget: positiveTargetArb,
  weightTarget: positiveTargetArb,
});

describe('buildExerciseInputs', () => {
  it('keeps every entry when all have complete, positive targets', () => {
    fc.assert(
      fc.property(fc.array(validEntryArb, { minLength: 1, maxLength: 10 }), (entries) => {
        const result = buildExerciseInputs(entries);
        expect(result).toHaveLength(entries.length);
        result.forEach((input, i) => {
          expect(input.exerciseId).toBe(entries[i].exerciseId);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('drops entries with incomplete/invalid targets, keeps valid ones', () => {
    fc.assert(
      fc.property(
        fc.array(validEntryArb, { minLength: 1, maxLength: 5 }),
        fc.array(invalidEntryArb, { minLength: 1, maxLength: 5 }),
        (validEntries, invalidEntries) => {
          const result = buildExerciseInputs([...validEntries, ...invalidEntries]);
          expect(result).toHaveLength(validEntries.length);
          const resultIds = new Set(result.map((r) => r.exerciseId));
          validEntries.forEach((e) => expect(resultIds.has(e.exerciseId)).toBe(true));
          invalidEntries.forEach((e) => expect(resultIds.has(e.exerciseId)).toBe(false));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns an empty array when no entries are selected', () => {
    expect(buildExerciseInputs([])).toEqual([]);
  });
});

describe('canSaveWorkout', () => {
  it('is true iff the name is non-blank AND at least one entry has complete valid targets', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.oneof(validEntryArb, invalidEntryArb), { maxLength: 10 }),
        (name, entries) => {
          const expected = name.trim().length > 0 && buildExerciseInputs(entries).length > 0;
          expect(canSaveWorkout(name, entries)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('is false for a blank name even with valid entries', () => {
    fc.assert(
      fc.property(fc.array(validEntryArb, { minLength: 1, maxLength: 5 }), (entries) => {
        expect(canSaveWorkout('   ', entries)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});
