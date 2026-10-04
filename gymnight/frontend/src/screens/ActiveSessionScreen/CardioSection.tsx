/**
 * CardioSection — "Adicionar cardio" e a lista de entradas removíveis dentro
 * do treino ativo (Wave 9, PARIDADE-05-CARDIO.md §4.2). Extraído como
 * componente próprio desde o início — o `ActiveSessionScreen` já tem dois
 * modos (grade e livre) e a seção de cardio aparece nos dois.
 *
 * ⚠️ Estas entradas NUNCA entram no contador `X/Y séries` nem na
 * ProgressBar do header — ambos continuam vindo só de `countGridProgress`
 * (setGrid.ts), que nem recebe dado de cardio como entrada.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { layout } from '../../designSystem/tokens';
import { animateLayout } from '../../designSystem/motion';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { IconBadge } from '../../designSystem/components/IconBadge';
import { IconButton } from '../../designSystem/components/IconButton';
import { ListRow } from '../../designSystem/components/ListRow';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
import { Sheet } from '../../designSystem/components/Sheet';
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
    animateLayout();
    onAdd(value);
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    animateLayout();
    onRemove(id);
  };

  return (
    <View testID="cardio-section" style={styles.section}>
      <SectionTitle
        right={
          <Button
            label="Adicionar"
            icon="plus"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => setShowForm(true)}
            testID="add-cardio-button"
            accessibilityLabel="Adicionar cardio"
          />
        }
      >
        Cardio
      </SectionTitle>

      {entries.length > 0 && (
        <Card padding="none">
          {entries.map((entry, index) => (
            <ListRow
              key={entry.id}
              testID={`cardio-entry-${entry.id}`}
              leading={<IconBadge icon="heartbeat" />}
              title={entry.cardioType}
              subtitle={`${entry.durationMin}min${formatDistance(entry.distanceKm)} · PSE ${entry.pse}`}
              value={`${estimateCardioCalories(entry.durationMin, entry.pse, weightKg)} kcal`}
              divider={index < entries.length - 1}
              trailing={
                <IconButton
                  icon="times"
                  onPress={() => handleRemove(entry.id)}
                  testID={`cardio-entry-remove-${entry.id}`}
                  accessibilityLabel={`Remover cardio ${entry.cardioType}`}
                />
              }
            />
          ))}
        </Card>
      )}

      <Sheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title="Adicionar cardio"
        testID="cardio-form-modal"
        panelTestID="cardio-form-card"
      >
        <CardioForm onSave={handleSave} onCancel={() => setShowForm(false)} weightKg={weightKg} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: layout.blockGap,
  },
});
