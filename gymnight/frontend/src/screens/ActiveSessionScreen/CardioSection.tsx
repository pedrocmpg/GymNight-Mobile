/**
 * CardioSection — "+ Cardio" e a lista de entradas removíveis dentro do
 * treino ativo (Wave 9, PARIDADE-05-CARDIO.md §4.2). Extraído como
 * componente próprio desde o início — o `ActiveSessionScreen` já tem dois
 * modos (grade e livre) e a seção de cardio aparece nos dois; empurrar isso
 * para dentro do componente principal o deixaria grande demais.
 *
 * ⚠️ Estas entradas NUNCA entram no contador `X/Y séries` nem na
 * ProgressBar do header — ambos continuam vindo só de `countGridProgress`
 * (setGrid.ts), que nem recebe dado de cardio como entrada.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { Card } from '../../designSystem/components/Card';
import { IconBadge } from '../../designSystem/components/IconBadge';
import { CardioForm, type CardioFormValue } from '../CardioScreen/CardioForm';
import { estimateCardioCalories } from '../CardioScreen/cardioDomain';

export interface CardioSectionEntry {
  id: string;
  cardioType: string;
  durationMin: number;
  distanceKm: number | null;
  pse: number;
}

export interface CardioSectionProps {
  entries: CardioSectionEntry[];
  onAdd: (value: CardioFormValue) => void;
  onRemove: (id: string) => void;
  /** Peso do usuário para a estimativa de calorias; default 70 (unificado com a musculação). */
  weightKg?: number;
}

function formatDistance(distanceKm: number | null): string {
  return distanceKm !== null ? ` · ${distanceKm}km` : '';
}

export function CardioSection({ entries, onAdd, onRemove, weightKg = 70 }: CardioSectionProps) {
  const [showForm, setShowForm] = useState(false);

  const handleSave = (value: CardioFormValue) => {
    onAdd(value);
    setShowForm(false);
  };

  return (
    <View testID="cardio-section">
      <View style={styles.header}>
        <Text style={styles.title}>CARDIO</Text>
        <TouchableOpacity
          testID="add-cardio-button"
          onPress={() => setShowForm(true)}
          style={styles.addButton}
          accessibilityLabel="Adicionar cardio"
        >
          <FontAwesome5 name="plus" size={12} color={colors.primary} solid />
          <Text style={styles.addButtonText}>Cardio</Text>
        </TouchableOpacity>
      </View>

      {entries.map((entry) => (
        <Card key={entry.id} bordered={false} style={styles.entryCard} testID={`cardio-entry-${entry.id}`}>
          <IconBadge icon="heartbeat" size={36} />
          <View style={styles.entryBody}>
            <Text style={styles.entryName} numberOfLines={1}>
              {entry.cardioType}
            </Text>
            <Text style={styles.entryMeta}>
              {entry.durationMin}min{formatDistance(entry.distanceKm)} · PSE {entry.pse}
            </Text>
          </View>
          <Text style={styles.entryCalories} testID={`cardio-entry-calories-${entry.id}`}>
            {estimateCardioCalories(entry.durationMin, entry.pse, weightKg)} kcal
          </Text>
          <TouchableOpacity
            testID={`cardio-entry-remove-${entry.id}`}
            onPress={() => onRemove(entry.id)}
            style={styles.removeButton}
            accessibilityLabel={`Remover cardio ${entry.cardioType}`}
          >
            <FontAwesome5 name="times" size={16} color={colors.secondaryText} solid />
          </TouchableOpacity>
        </Card>
      ))}

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)} testID="cardio-form-modal">
        <View style={styles.overlay}>
          <View style={styles.formCard} testID="cardio-form-card">
            <CardioForm onSave={handleSave} onCancel={() => setShowForm(false)} weightKg={weightKg} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.primaryText,
    ...typography.h3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  addButtonText: {
    color: colors.primary,
    ...typography.captionBold,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardAlt,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  entryBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  entryName: {
    color: colors.primaryText,
    ...typography.bodyBold,
  },
  entryMeta: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  entryCalories: {
    color: colors.primary,
    ...typography.captionBold,
  },
  removeButton: {
    padding: spacing.xxs,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  formCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
});
