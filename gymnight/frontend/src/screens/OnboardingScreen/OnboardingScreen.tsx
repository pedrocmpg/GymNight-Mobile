/**
 * OnboardingScreen — wizard de 5 passos (nome, peso+altura, gênero,
 * objetivo, tempo de treino), com barra de progresso. Porta
 * `GymNight-Desktop/src/ui/screens/setup.py` (Wave 8, PARIDADE-04-ROTINAS-
 * PERFIL.md §2); o passo de tempo de treino é adicional, fora do desktop.
 *
 * Diferença deliberada do desktop: lá os dados vão para um arquivo solto
 * `user_data.json`; aqui o container grava na tabela `users` — esta tela só
 * coleta os dados e chama `onComplete` uma vez ao final.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../designSystem/tokens';
import { Input } from '../../designSystem/components/Input';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { Chip } from '../../designSystem/components/Chip';
import { ProgressBar } from '../../designSystem/components/ProgressBar';
import {
  isValidName,
  isValidWeight,
  isValidHeight,
  toggleGoalFifo,
  GOAL_OPTIONS,
  GENDER_OPTIONS,
  TRAINING_TIME_OPTIONS,
} from './onboardingDomain';
import type { OnboardingProfileData } from './saveOnboardingProfile';

export interface OnboardingScreenProps {
  onComplete: (data: OnboardingProfileData) => void;
  /** Enquanto salva o perfil, desabilita o botão final para evitar duplo toque. */
  isSaving?: boolean;
  /** Erro de persistência (ex: falha de escrita local) — não é erro de validação de campo. */
  error?: string | null;
}

const TOTAL_STEPS = 5;

export function OnboardingScreen({ onComplete, isSaving = false, error = null }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [weightError, setWeightError] = useState(false);
  const [heightError, setHeightError] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [trainingTime, setTrainingTime] = useState<string | null>(null);

  const handleNext = () => {
    if (step === 1) {
      if (!isValidName(name)) {
        setNameError(true);
        return;
      }
      setNameError(false);
      setStep(2);
      return;
    }
    if (step === 2) {
      const weight = Number(weightText.replace(',', '.'));
      const height = Number(heightText.replace(',', '.'));
      const weightOk = isValidWeight(weight);
      const heightOk = isValidHeight(height);
      setWeightError(!weightOk);
      setHeightError(!heightOk);
      if (!weightOk || !heightOk) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (gender === null) return;
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    if (isSaving) return;
    if (trainingTime === null) return;
    const weight = Number(weightText.replace(',', '.'));
    const height = Number(heightText.replace(',', '.'));
    // Já validado nos passos 1-3; gender só chega aqui não-nulo (guard do passo 3).
    onComplete({
      name,
      weight,
      height,
      gender: gender as string,
      goals,
      trainingTime,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="onboarding-screen">
      <View style={styles.header}>
        <Text style={styles.stepLabel} testID="onboarding-step-label">
          Passo {step} de {TOTAL_STEPS}
        </Text>
        <ProgressBar value={step / TOTAL_STEPS} testID="onboarding-progress" />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View testID="onboarding-step-name">
            <Text style={styles.title}>QUAL É O SEU NOME?</Text>
            <Input
              testID="onboarding-name-input"
              placeholder="Seu nome"
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(false);
              }}
              accessibilityLabel="Nome"
            />
            {nameError && (
              <Text style={styles.errorText} testID="onboarding-name-error">
                Nome é obrigatório.
              </Text>
            )}
          </View>
        )}

        {step === 2 && (
          <View testID="onboarding-step-body">
            <Text style={styles.title}>PESO E ALTURA</Text>
            <Input
              testID="onboarding-weight-input"
              label="Peso (kg)"
              placeholder="Ex: 75"
              value={weightText}
              onChangeText={(v) => {
                setWeightText(v);
                if (weightError) setWeightError(false);
              }}
              keyboardType="numeric"
              accessibilityLabel="Peso em quilogramas"
            />
            {weightError && (
              <Text style={styles.errorText} testID="onboarding-weight-error">
                Peso deve estar entre 30 e 300 kg.
              </Text>
            )}
            <View style={styles.fieldSpacer} />
            <Input
              testID="onboarding-height-input"
              label="Altura (cm)"
              placeholder="Ex: 178"
              value={heightText}
              onChangeText={(v) => {
                setHeightText(v);
                if (heightError) setHeightError(false);
              }}
              keyboardType="numeric"
              accessibilityLabel="Altura em centímetros"
            />
            {heightError && (
              <Text style={styles.errorText} testID="onboarding-height-error">
                Altura deve estar entre 100 e 250 cm.
              </Text>
            )}
          </View>
        )}

        {step === 3 && (
          <View testID="onboarding-step-gender">
            <Text style={styles.title}>GÊNERO</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  testID={`onboarding-gender-${option}`}
                  label={option}
                  selected={gender === option}
                  onPress={() => setGender(option)}
                />
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View testID="onboarding-step-goal">
            <Text style={styles.title}>OBJETIVO</Text>
            <Text style={styles.subtitle}>Escolha até 2 — escolher um terceiro troca o mais antigo.</Text>
            {GOAL_OPTIONS.map((option) => {
              const selected = goals.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  testID={`onboarding-goal-${option.id}`}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Selecionar objetivo ${option.label}`}
                  onPress={() => setGoals((prev) => toggleGoalFifo(prev, option.id))}
                >
                  <Card bordered style={styles.goalCard}>
                    <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.goalDescription}>{option.description}</Text>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 5 && (
          <View testID="onboarding-step-training-time">
            <Text style={styles.title}>HÁ QUANTO TEMPO VOCÊ TREINA?</Text>
            <View style={styles.chipRow}>
              {TRAINING_TIME_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  testID={`onboarding-training-time-${option}`}
                  label={option}
                  selected={trainingTime === option}
                  onPress={() => setTrainingTime(option)}
                />
              ))}
            </View>
          </View>
        )}

        {error && (
          <Text style={styles.errorText} testID="onboarding-save-error">
            {error}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <Button
            testID="onboarding-back-button"
            label="Voltar"
            variant="ghost"
            onPress={handleBack}
            style={styles.footerButton}
          />
        )}
        {step < TOTAL_STEPS ? (
          <Button
            testID="onboarding-next-button"
            label="Próximo"
            onPress={handleNext}
            style={styles.footerButton}
          />
        ) : (
          <Button
            testID="onboarding-finish-button"
            label="Concluir"
            onPress={handleFinish}
            disabled={isSaving}
            style={styles.footerButton}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  stepLabel: {
    color: colors.secondaryText,
    ...typography.caption,
  },
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.primaryText,
    ...typography.h2,
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.secondaryText,
    ...typography.sub,
    marginBottom: spacing.sm,
  },
  fieldSpacer: {
    height: spacing.sm,
  },
  errorText: {
    color: colors.error,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  goalCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalLabel: {
    color: colors.primaryText,
    ...typography.bodyBold,
  },
  goalLabelSelected: {
    color: colors.primary,
  },
  goalDescription: {
    color: colors.secondaryText,
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
