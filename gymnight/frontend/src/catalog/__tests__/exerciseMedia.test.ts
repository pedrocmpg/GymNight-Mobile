import { getExerciseMedia } from '../exerciseMedia';
import { EXERCISE_MEDIA } from '../exerciseMedia.generated';

describe('getExerciseMedia', () => {
  it('bundles media for all 500 catalog exercises', () => {
    expect(Object.keys(EXERCISE_MEDIA)).toHaveLength(500);
  });

  it('returns the thumbnail and the animation for a known key', () => {
    const media = getExerciseMedia('0025');
    expect(media).not.toBeNull();
    expect(media?.thumb).toBeDefined();
    expect(media?.anim).toBeDefined();
  });

  it('returns null without a key or for a key this build does not know', () => {
    expect(getExerciseMedia(null)).toBeNull();
    expect(getExerciseMedia(undefined)).toBeNull();
    expect(getExerciseMedia('')).toBeNull();
    expect(getExerciseMedia('9999-nope')).toBeNull();
  });
});
