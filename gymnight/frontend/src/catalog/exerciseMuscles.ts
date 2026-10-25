/**
 * Resumo muscular por exercício, derivado do catálogo pull-only
 * (exercise_muscle_map + muscle_groups).
 *
 * O backend semeia a regra 70/30 (migration 011): o grupo principal é o de
 * maior contribuição, os demais são secundários. Função pura — o join é
 * feito no cliente, no mesmo espírito do resto do repo (sem Q.on()).
 */
import type { ExerciseMuscleContribution } from '../hooks/domainUtils';

export interface MuscleGroupName {
  id: string;
  name: string;
}

export interface ExerciseMuscleSummary {
  primaryGroup: string | null;
  secondaryGroups: string[];
}

export const EMPTY_MUSCLE_SUMMARY: ExerciseMuscleSummary = {
  primaryGroup: null,
  secondaryGroups: [],
};

/**
 * exerciseId -> { primaryGroup, secondaryGroups }. Secundários em ordem de
 * contribuição decrescente (empate: ordem alfabética, para ser estável).
 * Linhas cujo grupo não existe localmente (ainda não sincronizou) são
 * ignoradas.
 */
export function buildExerciseMuscleIndex(
  map: readonly ExerciseMuscleContribution[],
  groups: readonly MuscleGroupName[],
): Map<string, ExerciseMuscleSummary> {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const byExercise = new Map<string, Array<{ name: string; contribution: number }>>();

  for (const row of map) {
    const name = groupName.get(row.muscleGroupId);
    if (!name) continue;
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push({ name, contribution: row.contribution });
    byExercise.set(row.exerciseId, list);
  }

  const index = new Map<string, ExerciseMuscleSummary>();
  for (const [exerciseId, list] of byExercise) {
    const sorted = [...list].sort(
      (a, b) => b.contribution - a.contribution || a.name.localeCompare(b.name),
    );
    index.set(exerciseId, {
      primaryGroup: sorted[0].name,
      secondaryGroups: sorted.slice(1).map((g) => g.name),
    });
  }
  return index;
}
