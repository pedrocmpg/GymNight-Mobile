/**
 * OnboardingScreen — wizard de 5 passos (nome, peso+altura, gênero,
 * objetivo, tempo de treino), com barra de progresso. Porta
 * `GymNight-Desktop/src/ui/screens/setup.py` (Wave 8, PARIDADE-04-ROTINAS-
 * PERFIL.md §2); o passo de tempo de treino é adicional, fora do desktop.
 *
 * Cada passo é uma pergunta: título grande, uma única decisão, e o avanço
 * no rodapé fixo (Voltar ghost · Próximo lima). Escolhas são linhas grandes
 * (OptionRow), não chips — alvo de toque generoso e espaço para descrição.
 *
 * Diferença deliberada do desktop: lá os dados vão para um arquivo solto
 * `user_data.json`; aqui o container grava na tabela `users` — esta tela só
 * coleta os dados e chama `onComplete` uma vez ao final.
 */

import React, { useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii, layout } from '../../designSystem/tokens';
import { useEnterAnimation } from '../../designSystem/motion';
import { Input } from '../../designSystem/components/Input';
import { Button } from '../../designSystem/components/Button';
import { ProgressBar } from '../../designSystem/components/ProgressBar';
import { Screen } from '../../designSystem/components/Screen';
import { Touchable } from '../../designSystem/components/Touchable';
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

/** Linha de escolha: label + descrição opcional, check lima quando marcada. */
function OptionRow({
  label,
  description,
  selected,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
}) {
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Text style={styles.optionDescription}>{description}</Text> : null}
      </View>
      <FontAwesome5
        name={selected ? 'check-circle' : 'circle'}
        size={18}
        color={selected ? colors.primary : colors.mutedText}
        solid={selected}
      />
    </Touchable>
  );
}

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
  const stepEnter = useEnterAnimation(step);

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

  const header = (
    <View style={styles.header}>
      <Text style={styles.stepLabel} testID="onboarding-step-label">
        Passo {step} de {TOTAL_STEPS}
      </Text>
      <ProgressBar value={step / TOTAL_STEPS} testID="onboarding-progress" />
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {step > 1 && (
        <Button
          testID="onboarding-back-button"
          label="Voltar"
          variant="ghost"
          onPress={handleBack}
          style={styles.backButton}
        />
      )}
      {step < TOTAL_STEPS ? (
        <Button
          testID="onboarding-next-button"
          label="Próximo"
          icon="arrow-right"
          onPress={handleNext}
          style={styles.nextButton}
        />
      ) : (
        <Button
          testID="onboarding-finish-button"
          label="Concluir"
          icon="check"
          onPress={handleFinish}
          disabled={isSaving}
          loading={isSaving}
          style={styles.nextButton}
        />
      )}
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']} testID="onboarding-screen" header={header} footer={footer}>
      <Animated.View style={stepEnter}>
        {step === 1 && (
          <View testID="onboarding-step-name" style={styles.step}>
            <StepHeading
              title="Qual é o seu nome?"
              subtitle="É assim que o app vai te cumprimentar."
            />
            <Input
              testID="onboarding-name-input"
              placeholder="Seu nome"
              value={name}
              autoFocus
              autoCapitalize="words"
              autoComplete="name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={handleNext}
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
          <View testID="onboarding-step-body" style={styles.step}>
            <StepHeading
              title="Peso e altura"
              subtitle="Usados para estimar calorias e acompanhar sua evolução."
            />
            <View style={styles.field}>
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
            </View>
            <View style={styles.field}>
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
          </View>
        )}

        {step === 3 && (
          <View testID="onboarding-step-gender" style={styles.step}>
            <StepHeading title="Gênero" />
            <View style={styles.options}>
              {GENDER_OPTIONS.map((option) => (
                <OptionRow
                  key={option}
                  testID={`onboarding-gender-${option}`}
                  label={option}
                  selected={gender === option}
                  onPress={() => setGender(option)}
                  accessibilityLabel={`Selecionar ${option}`}
                />
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View testID="onboarding-step-goal" style={styles.step}>
            <StepHeading
              title="Qual é o seu objetivo?"
              subtitle="Escolha até 2 — escolher um terceiro troca o mais antigo."
            />
            <View style={styles.options}>
              {GOAL_OPTIONS.map((option) => (
                <OptionRow
                  key={option.id}
                  testID={`onboarding-goal-${option.id}`}
                  label={option.label}
                  description={option.description}
                  selected={goals.includes(option.id)}
                  onPress={() => setGoals((prev) => toggleGoalFifo(prev, option.id))}
                  accessibilityLabel={`Selecionar objetivo ${option.label}`}
                />
              ))}
            </View>
          </View>
        )}

        {step === 5 && (
          <View testID="onboarding-step-training-time" style={styles.step}>
            <StepHeading title="Há quanto tempo você treina?" />
            <View style={styles.options}>
              {TRAINING_TIME_OPTIONS.map((option) => (
                <OptionRow
                  key={option}
                  testID={`onboarding-training-time-${option}`}
                  label={option}
                  selected={trainingTime === option}
                  onPress={() => setTrainingTime(option)}
                  accessibilityLabel={`Selecionar ${option}`}
                />
              ))}
            </View>
          </View>
        )}
      </Animated.View>

      {error && (
        <Text style={styles.errorText} testID="onboarding-save-error">
          {error}
        </Text>
      )}
    </Screen>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.secondaryText,
  },
  step: {
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.primaryText,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondaryText,
  },
  field: {
    gap: spacing.xs,
  },
  errorText: {
    ...typography.footnote,
    color: colors.error,
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: spacing.xxs,
  },
  optionLabel: {
    ...typography.bodyMedium,
    color: colors.primaryText,
  },
  optionDescription: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});
