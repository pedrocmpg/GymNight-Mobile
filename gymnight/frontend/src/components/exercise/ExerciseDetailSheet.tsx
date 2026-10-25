/**
 * ExerciseDetailSheet — a animação grande do exercício, com músculos e
 * equipamento, no idioma ativo. Aberto pela miniatura no criador de treino e
 * na sessão ativa.
 *
 * Visível enquanto `exercise` não for null. O último exercício mostrado fica
 * guardado para o conteúdo não sumir durante o fade de saída do Sheet.
 */

import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../designSystem/components/Sheet';
import { colors, spacing, typography } from '../../designSystem/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  equipmentLabel,
  exerciseName,
  muscleGroupLabel,
} from '../../i18n/exerciseLabels';
import { ExerciseThumb } from './ExerciseThumb';

export interface ExerciseDetails {
  name: string;
  nameEn?: string | null;
  equipment?: string | null;
  mediaKey?: string | null;
  primaryGroup?: string | null;
  secondaryGroups?: string[];
}

export interface ExerciseDetailSheetProps {
  exercise: ExerciseDetails | null;
  onClose: () => void;
  testID?: string;
}

const MEDIA_SIZE = 240;

export function ExerciseDetailSheet({
  exercise,
  onClose,
  testID = 'exercise-detail',
}: ExerciseDetailSheetProps) {
  const { language } = useLanguage();
  const lastExercise = useRef<ExerciseDetails | null>(exercise);
  if (exercise) lastExercise.current = exercise;
  const shown = exercise ?? lastExercise.current;

  const rows: Array<{ label: string; value: string; key: string }> = [];
  if (shown?.primaryGroup) {
    rows.push({ key: 'primary', label: 'Principal', value: muscleGroupLabel(shown.primaryGroup, language) });
  }
  if (shown?.secondaryGroups && shown.secondaryGroups.length > 0) {
    rows.push({
      key: 'secondary',
      label: 'Secundários',
      value: shown.secondaryGroups.map((g) => muscleGroupLabel(g, language)).join(', '),
    });
  }
  if (shown?.equipment) {
    rows.push({ key: 'equipment', label: 'Equipamento', value: equipmentLabel(shown.equipment, language) });
  }

  return (
    <Sheet
      visible={exercise !== null}
      onClose={onClose}
      title={shown ? exerciseName(shown, language) : undefined}
      testID={testID}
      panelTestID={`${testID}-panel`}
    >
      {shown ? (
        <View style={styles.body}>
          <View style={styles.media}>
            <ExerciseThumb
              mediaKey={shown.mediaKey}
              size={MEDIA_SIZE}
              animated
              testID={`${testID}-media`}
            />
          </View>
          {rows.length > 0 ? (
            <View style={styles.rows}>
              {rows.map((row) => (
                <View key={row.key} style={styles.row} testID={`${testID}-${row.key}`}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
  },
  media: {
    alignItems: 'center',
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  rowValue: {
    ...typography.bodyMedium,
    color: colors.primaryText,
    flexShrink: 1,
    textAlign: 'right',
  },
});
