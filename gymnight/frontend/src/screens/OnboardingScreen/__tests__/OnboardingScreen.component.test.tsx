/**
 * Component tests for OnboardingScreen — os 5 passos, validação inline,
 * FIFO de objetivos, e o callback final.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OnboardingScreen } from '../OnboardingScreen';

function goToStep2(getByTestId: ReturnType<typeof render>['getByTestId'], name = 'Pedro') {
  fireEvent.changeText(getByTestId('onboarding-name-input'), name);
  fireEvent.press(getByTestId('onboarding-next-button'));
}

function goToStep3(getByTestId: ReturnType<typeof render>['getByTestId'], weight = '80', height = '178') {
  goToStep2(getByTestId);
  fireEvent.changeText(getByTestId('onboarding-weight-input'), weight);
  fireEvent.changeText(getByTestId('onboarding-height-input'), height);
  fireEvent.press(getByTestId('onboarding-next-button'));
}

function goToStep4(getByTestId: ReturnType<typeof render>['getByTestId'], gender = 'Masculino') {
  goToStep3(getByTestId);
  fireEvent.press(getByTestId(`onboarding-gender-${gender}`));
  fireEvent.press(getByTestId('onboarding-next-button'));
}

function goToStep5(getByTestId: ReturnType<typeof render>['getByTestId'], gender = 'Masculino') {
  goToStep4(getByTestId, gender);
  fireEvent.press(getByTestId('onboarding-next-button'));
}

describe('OnboardingScreen — Passo 1 (nome)', () => {
  it('começa no passo 1 com "Passo 1 de 5"', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    expect(getByTestId('onboarding-step-label').props.children.join('')).toContain('1');
  });

  it('não avança e mostra erro inline quando o nome está vazio', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    fireEvent.press(getByTestId('onboarding-next-button'));
    expect(getByTestId('onboarding-name-error')).toBeTruthy();
    expect(queryByTestId('onboarding-step-body')).toBeNull();
  });

  it('digitar depois do erro limpa o erro', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    fireEvent.press(getByTestId('onboarding-next-button'));
    expect(getByTestId('onboarding-name-error')).toBeTruthy();
    fireEvent.changeText(getByTestId('onboarding-name-input'), 'Pedro');
    expect(queryByTestId('onboarding-name-error')).toBeNull();
  });

  it('avança para o passo 2 com um nome válido', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep2(getByTestId);
    expect(getByTestId('onboarding-step-body')).toBeTruthy();
  });
});

describe('OnboardingScreen — Passo 2 (peso e altura)', () => {
  it('rejeita peso fora de 30-300 e altura fora de 100-250, com erro inline por campo', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep2(getByTestId);
    fireEvent.changeText(getByTestId('onboarding-weight-input'), '10');
    fireEvent.changeText(getByTestId('onboarding-height-input'), '400');
    fireEvent.press(getByTestId('onboarding-next-button'));

    expect(getByTestId('onboarding-weight-error')).toBeTruthy();
    expect(getByTestId('onboarding-height-error')).toBeTruthy();
  });

  it('aceita os limites exatos (30/300 kg, 100/250 cm)', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep2(getByTestId);
    fireEvent.changeText(getByTestId('onboarding-weight-input'), '30');
    fireEvent.changeText(getByTestId('onboarding-height-input'), '250');
    fireEvent.press(getByTestId('onboarding-next-button'));

    expect(queryByTestId('onboarding-weight-error')).toBeNull();
    expect(queryByTestId('onboarding-height-error')).toBeNull();
    expect(getByTestId('onboarding-step-gender')).toBeTruthy();
  });

  it('"Voltar" retorna ao passo 1 preservando o nome digitado', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep2(getByTestId, 'Pedro');
    fireEvent.press(getByTestId('onboarding-back-button'));
    expect(getByTestId('onboarding-name-input').props.value).toBe('Pedro');
  });
});

describe('OnboardingScreen — Passo 3 (gênero)', () => {
  it('não avança sem selecionar um gênero', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep3(getByTestId);
    fireEvent.press(getByTestId('onboarding-next-button'));
    expect(queryByTestId('onboarding-step-goal')).toBeNull();
  });

  it('avança para o passo 4 ao selecionar um gênero', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep4(getByTestId);
    expect(getByTestId('onboarding-step-goal')).toBeTruthy();
  });
});

describe('OnboardingScreen — Passo 4 (objetivo, FIFO)', () => {
  it('selecionar um terceiro objetivo evicta o mais antigo', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep4(getByTestId);

    fireEvent.press(getByTestId('onboarding-goal-Hipertrofia'));
    fireEvent.press(getByTestId('onboarding-goal-Saúde'));
    fireEvent.press(getByTestId('onboarding-goal-Resistência'));

    expect(queryByTestId('onboarding-goal-Hipertrofia').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('onboarding-goal-Saúde').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('onboarding-goal-Resistência').props.accessibilityState.selected).toBe(true);
  });

  it('tocar num objetivo já selecionado desmarca', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep4(getByTestId);
    fireEvent.press(getByTestId('onboarding-goal-Hipertrofia'));
    fireEvent.press(getByTestId('onboarding-goal-Hipertrofia'));
    expect(getByTestId('onboarding-goal-Hipertrofia').props.accessibilityState.selected).toBe(false);
  });

  it('avança para o passo 5 independentemente de ter selecionado algum objetivo', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={jest.fn()} />);
    goToStep5(getByTestId);
    expect(getByTestId('onboarding-step-training-time')).toBeTruthy();
  });
});

describe('OnboardingScreen — Passo 5 (tempo de treino) e conclusão', () => {
  it('não conclui sem selecionar um tempo de treino', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OnboardingScreen onComplete={onComplete} />);
    goToStep5(getByTestId);
    fireEvent.press(getByTestId('onboarding-finish-button'));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('chama onComplete com todos os dados coletados ao concluir', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OnboardingScreen onComplete={onComplete} />);
    goToStep4(getByTestId, 'Feminino');
    fireEvent.press(getByTestId('onboarding-goal-Hipertrofia'));
    fireEvent.press(getByTestId('onboarding-goal-Saúde'));
    fireEvent.press(getByTestId('onboarding-next-button'));
    fireEvent.press(getByTestId('onboarding-training-time-Até 6 meses'));
    fireEvent.press(getByTestId('onboarding-finish-button'));

    expect(onComplete).toHaveBeenCalledWith({
      name: 'Pedro',
      weight: 80,
      height: 178,
      gender: 'Feminino',
      goals: ['Hipertrofia', 'Saúde'],
      trainingTime: 'Até 6 meses',
    });
  });

  it('concluir sem selecionar nenhum objetivo é permitido (goals vazio)', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OnboardingScreen onComplete={onComplete} />);
    goToStep5(getByTestId);
    fireEvent.press(getByTestId('onboarding-training-time-Nunca treinei'));
    fireEvent.press(getByTestId('onboarding-finish-button'));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ goals: [] }));
  });

  it('o botão final fica desabilitado enquanto isSaving é true (não chama onComplete de novo)', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OnboardingScreen onComplete={onComplete} isSaving />);
    goToStep5(getByTestId);
    fireEvent.press(getByTestId('onboarding-training-time-Nunca treinei'));
    fireEvent.press(getByTestId('onboarding-finish-button'));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('mostra o erro de persistência quando error é passado', () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={jest.fn()} error="Falha ao salvar." />,
    );
    goToStep5(getByTestId);
    expect(getByText('Falha ao salvar.')).toBeTruthy();
  });
});
