/**
 * Acesso às mídias embutidas do catálogo (geradas por
 * scripts/build-exercise-media.mjs). `media_key` vem do servidor; exercícios
 * sem chave, ou com chave que este build não conhece, não têm mídia.
 */
import { EXERCISE_MEDIA, type ExerciseMediaSource } from './exerciseMedia.generated';

export type { ExerciseMediaSource };

export function getExerciseMedia(
  mediaKey: string | null | undefined,
): ExerciseMediaSource | null {
  if (!mediaKey) return null;
  return EXERCISE_MEDIA[mediaKey] ?? null;
}
