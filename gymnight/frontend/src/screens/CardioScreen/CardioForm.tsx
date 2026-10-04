/**
 * CardioForm — formulário compartilhado de registro de cardio (Wave 9,
 * PARIDADE-05-CARDIO.md §4.1). Usado tanto dentro do treino ativo quanto no
 * cardio avulso — mesma tela, mesmos campos, na ordem do desktop: tipo (com
 * busca), duração, distância (opcional), PSE, e a estimativa de calorias ao
 * vivo.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { Input } from '../../designSystem/components/Input';
import { CellInput } from '../../designSystem/components/CellInput';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
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

const PSE_LEGEND = [
  { emoji: '😌', label: 'Leve' },
  { emoji: '😊', label: 'Moderado' },
  { emoji: '😤', label: 'Intenso' },
  { emoji: '🔥', label: 'Máximo' },
];

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
  const pseLegendEntry = pseLabelFor(pse);

  const handleSave = () => {
    if (!canSave || selectedTypeName === null) return;
    onSave({ cardioType: selectedTypeName, durationMin: duration, distanceKm: distance, pse });
  };

  return (
    <View testID="cardio-form">
      <Text style={styles.sectionLabel}>Tipo de cardio</Text>
      <Input
        testID="cardio-type-search"
        placeholder="Buscar tipo de cardio..."
        value={selectedTypeName ?? searchQuery}
        onChangeText={(v) => {
          setSearchQuery(v);
          setSelectedTypeName(null);
        }}
        accessibilityLabel="Buscar tipo de cardio"
      />

      {selectedTypeName === null && (
        <ScrollView style={styles.typeList} testID="cardio-type-list">
          {visibleTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              testID={`cardio-type-option-${type.id}`}
              onPress={() => {
                setSelectedTypeName(type.id);
                setSearchQuery('');
              }}
            >
              <Text style={styles.typeOptionText}>{type.name}</Text>
            </TouchableOpacity>
          ))}
          {visibleTypes.length === 0 && (
            <Text style={styles.noResultsText} testID="cardio-type-no-results">
              Nenhum tipo encontrado.
            </Text>
          )}
        </ScrollView>
      )}

      {selectedType && (
        <Card bordered={false} style={styles.selectedTypeCard} testID="cardio-selected-type-description">
          <Text style={styles.selectedTypeDescription}>{selectedType.description}</Text>
        </Card>
      )}

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Duração (min)</Text>
          <CellInput
            testID="cardio-duration-input"
            value={durationText}
            onChangeText={setDurationText}
            keyboardType="numeric"
            accessibilityLabel="Duração em minutos"
          />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Distância (km)</Text>
          <CellInput
            testID="cardio-distance-input"
            value={distanceText}
            onChangeText={setDistanceText}
            keyboardType="numeric"
            placeholder="opcional"
            accessibilityLabel="Distância em quilômetros"
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Intensidade (PSE) — {pse} · {pseLegendEntry.emoji} {pseLegendEntry.label}</Text>
      <View style={styles.pseRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
          <TouchableOpacity
            key={value}
            testID={`cardio-pse-${value}`}
            style={[styles.pseChip, pse === value && styles.pseChipSelected]}
            onPress={() => setPse(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: pse === value }}
            accessibilityLabel={`PSE ${value}`}
          >
            <Text style={[styles.pseChipText, pse === value && styles.pseChipTextSelected]}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.pseLegendRow}>
        {PSE_LEGEND.map((item) => (
          <Text key={item.label} style={styles.pseLegendText}>
            {item.emoji} {item.label}
          </Text>
        ))}
      </View>

      <Card style={styles.calorieCard} testID="cardio-calorie-estimate">
        <Text style={styles.calorieLabel}>Estimativa de calorias</Text>
        <Text style={styles.calorieValue}>{liveCalories} kcal</Text>
      </Card>

      <View style={styles.actionsRow}>
        <Button label="Cancelar" variant="ghost" onPress={onCancel} style={styles.actionButton} testID="cardio-cancel-button" />
        <Button
          label="Adicionar"
          onPress={handleSave}
          disabled={!canSave}
          style={styles.actionButton}
          testID="cardio-save-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.secondaryText,
    ...typography.captionBold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  typeOptionText: {
    color: colors.primaryText,
    ...typography.body,
    padding: spacing.sm,
  },
  noResultsText: {
    color: colors.secondaryText,
    ...typography.body,
    padding: spacing.sm,
    textAlign: 'center',
  },
  selectedTypeCard: {
    backgroundColor: colors.cardAlt,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  selectedTypeDescription: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.secondaryText,
    ...typography.caption,
    marginBottom: spacing.xxs,
  },
  pseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
  },
  pseChip: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pseChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pseChipText: {
    color: colors.primaryText,
    ...typography.caption,
  },
  pseChipTextSelected: {
    color: colors.onPrimary,
    fontFamily: typography.captionBold.fontFamily,
  },
  pseLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  pseLegendText: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  calorieCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  calorieLabel: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  calorieValue: {
    color: colors.primary,
    ...typography.h3,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
