/**
 * CardioForm — formulário compartilhado de registro de cardio (Wave 9,
 * PARIDADE-05-CARDIO.md §4.1). Usado tanto dentro do treino ativo quanto no
 * cardio avulso — mesma tela, mesmos campos, na ordem do desktop: tipo (com
 * busca), duração, distância (opcional), PSE, e a estimativa de calorias ao
 * vivo. Vive dentro de um Sheet, por isso rola por conta própria.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, layout } from '../../designSystem/tokens';
import { Input } from '../../designSystem/components/Input';
import { Button } from '../../designSystem/components/Button';
import { ListRow } from '../../designSystem/components/ListRow';
import { Touchable } from '../../designSystem/components/Touchable';
import { filterExercises } from '../WorkoutCreatorScreen/exerciseSearch';
import { CARDIO_TYPES } from './cardioTypes';
import { isValidCardioDuration, isValidCardioDistance, pseLabelFor, estimateCardioCalories } from './cardioDomain';

export interface CardioFormValue {
  cardioType: string;
  durationMin: number;
  distanceKm: number | null;
  pse: number;
}

export interface CardioFormProps {
  onSave: (value: CardioFormValue) => void;
  onCancel: () => void;
  /** Peso do usuário para a estimativa de calorias ao vivo; default 70 (unificado com a musculação). */
  weightKg?: number;
}

const PSE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);
const PSE_LEGEND = ['Leve', 'Moderado', 'Intenso', 'Máximo'] as const;
const TYPE_LIST_MAX_HEIGHT = 220;

const SEARCHABLE_TYPES = CARDIO_TYPES.map((t) => ({ id: t.name, name: t.name }));

export function CardioForm({ onSave, onCancel, weightKg = 70 }: CardioFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeName, setSelectedTypeName] = useState<string | null>(null);
  const [durationText, setDurationText] = useState('');
  const [distanceText, setDistanceText] = useState('');
  const [pse, setPse] = useState(5);

  const visibleTypes = filterExercises(SEARCHABLE_TYPES, searchQuery);
  const selectedType = CARDIO_TYPES.find((t) => t.name === selectedTypeName) ?? null;

  const duration = Number(durationText.replace(',', '.'));
  const distance = distanceText.trim() === '' ? null : Number(distanceText.replace(',', '.'));

  const durationOk = isValidCardioDuration(duration);
  const distanceOk = isValidCardioDistance(distance);
  const canSave = selectedTypeName !== null && durationOk && distanceOk;

  const liveCalories = durationOk ? estimateCardioCalories(duration, pse, weightKg) : 0;
  const pseLabel = pseLabelFor(pse).label;

  const handleSave = () => {
    if (!canSave || selectedTypeName === null) return;
    onSave({ cardioType: selectedTypeName, durationMin: duration, distanceKm: distance, pse });
  };

  return (
    <ScrollView
      testID="cardio-form"
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.field}>
        <Input
          testID="cardio-type-search"
          label="Tipo de cardio"
          placeholder="Buscar: corrida, bike, natação…"
          value={selectedTypeName ?? searchQuery}
          onChangeText={(v) => {
            setSearchQuery(v);
            setSelectedTypeName(null);
          }}
          accessibilityLabel="Buscar tipo de cardio"
        />

        {selectedTypeName === null && (
          <ScrollView style={styles.typeList} testID="cardio-type-list" nestedScrollEnabled>
            {visibleTypes.map((type, index) => (
              <ListRow
                key={type.id}
                testID={`cardio-type-option-${type.id}`}
                title={type.name}
                divider={index < visibleTypes.length - 1}
                onPress={() => {
                  setSelectedTypeName(type.id);
                  setSearchQuery('');
                }}
              />
            ))}
            {visibleTypes.length === 0 && (
              <Text style={styles.noResultsText} testID="cardio-type-no-results">
                Nenhum tipo encontrado.
              </Text>
            )}
          </ScrollView>
        )}

        {selectedType && (
          <Text style={styles.selectedTypeDescription} testID="cardio-selected-type-description">
            {selectedType.description}
          </Text>
        )}
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Input
            testID="cardio-duration-input"
            label="Duração (min)"
            value={durationText}
            onChangeText={setDurationText}
            keyboardType="numeric"
            placeholder="30"
            accessibilityLabel="Duração em minutos"
          />
        </View>
        <View style={styles.fieldHalf}>
          <Input
            testID="cardio-distance-input"
            label="Distância (km)"
            value={distanceText}
            onChangeText={setDistanceText}
            keyboardType="numeric"
            placeholder="opcional"
            accessibilityLabel="Distância em quilômetros"
          />
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.pseHeader}>
          <Text style={styles.fieldLabel}>Intensidade (PSE)</Text>
          <Text style={styles.pseValue}>
            {pse} · {pseLabel}
          </Text>
        </View>
        <View style={styles.pseTrack}>
          {PSE_VALUES.map((value) => {
            const selected = pse === value;
            return (
              <Touchable
                key={value}
                testID={`cardio-pse-${value}`}
                style={[styles.pseCell, selected && styles.pseCellSelected]}
                onPress={() => setPse(value)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`PSE ${value}`}
              >
                <Text style={[styles.pseCellText, selected && styles.pseCellTextSelected]}>
                  {value}
                </Text>
              </Touchable>
            );
          })}
        </View>
        <View style={styles.pseLegendRow}>
          {PSE_LEGEND.map((label) => (
            <Text
              key={label}
              style={[styles.pseLegendText, label === pseLabel && styles.pseLegendTextActive]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.calorieRow} testID="cardio-calorie-estimate">
        <Text style={styles.calorieLabel}>Estimativa de calorias</Text>
        <Text style={styles.calorieValue}>{liveCalories} kcal</Text>
      </View>

      <View style={styles.actionsRow}>
        <Button
          label="Cancelar"
          variant="ghost"
          onPress={onCancel}
          style={styles.cancelButton}
          testID="cardio-cancel-button"
        />
        <Button
          label="Adicionar"
          icon="plus"
          onPress={handleSave}
          disabled={!canSave}
          style={styles.saveButton}
          testID="cardio-save-button"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.secondaryText,
  },
  typeList: {
    maxHeight: TYPE_LIST_MAX_HEIGHT,
    backgroundColor: colors.card,
    borderRadius: radii.md,
  },
  noResultsText: {
    ...typography.footnote,
    color: colors.tertiaryText,
    padding: spacing.md,
    textAlign: 'center',
  },
  selectedTypeDescription: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  pseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pseValue: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  pseTrack: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  pseCell: {
    flex: 1,
    height: layout.hitTarget,
    borderRadius: radii.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pseCellSelected: {
    backgroundColor: colors.primary,
  },
  pseCellText: {
    ...typography.numeric,
    color: colors.secondaryText,
  },
  pseCellTextSelected: {
    color: colors.onPrimary,
  },
  pseLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pseLegendText: {
    ...typography.caption,
    color: colors.tertiaryText,
  },
  pseLegendTextActive: {
    color: colors.primaryText,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  calorieLabel: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  calorieValue: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
