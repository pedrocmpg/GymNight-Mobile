/**
 * Rótulos do conteúdo de exercício no idioma ativo.
 *
 * O banco guarda nome em PT (`name`) e EN (`name_en`); grupo muscular e
 * equipamento ficam só em PT e são traduzidos aqui por dicionário.
 * Valor sem tradução conhecida cai no PT — melhor que sumir da tela.
 */
import type { AppLanguage } from './language';

export interface ExerciseNameFields {
  name: string;
  nameEn?: string | null;
}

export function exerciseName(exercise: ExerciseNameFields, language: AppLanguage): string {
  if (language === 'en' && exercise.nameEn) return exercise.nameEn;
  return exercise.name;
}

const MUSCLE_GROUP_EN: Record<string, string> = {
  Peito: 'Chest',
  Costas: 'Back',
  Ombros: 'Shoulders',
  Bíceps: 'Biceps',
  Tríceps: 'Triceps',
  Pernas: 'Legs',
  Abdômen: 'Abs',
};

const EQUIPMENT_EN: Record<string, string> = {
  Barra: 'Barbell',
  'Barra EZ': 'EZ bar',
  'Barra hexagonal': 'Trap bar',
  Halter: 'Dumbbell',
  Polia: 'Cable',
  Máquina: 'Machine',
  'Máquina (trenó)': 'Sled machine',
  Smith: 'Smith machine',
  'Peso corporal': 'Body weight',
  Elástico: 'Band',
  Kettlebell: 'Kettlebell',
  'Com carga': 'Weighted',
  'Roda abdominal': 'Wheel roller',
};

export function muscleGroupLabel(group: string, language: AppLanguage): string {
  return language === 'en' ? MUSCLE_GROUP_EN[group] ?? group : group;
}

export function equipmentLabel(equipment: string, language: AppLanguage): string {
  return language === 'en' ? EQUIPMENT_EN[equipment] ?? equipment : equipment;
}

/** "Peito · Barra" — subtítulo curto de uma linha de exercício. */
export function exerciseSubtitle(
  exercise: { primaryGroup?: string | null; equipment?: string | null },
  language: AppLanguage,
): string | undefined {
  const parts: string[] = [];
  if (exercise.primaryGroup) parts.push(muscleGroupLabel(exercise.primaryGroup, language));
  if (exercise.equipment) parts.push(equipmentLabel(exercise.equipment, language));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
