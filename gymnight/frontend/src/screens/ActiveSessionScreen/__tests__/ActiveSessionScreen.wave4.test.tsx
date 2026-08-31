/**
 * Wave 4 — a grade de séries, o valor fantasma da última sessão, o overlay de
 * saída e a tela de resumo.
 *
 * O que o ActiveSessionScreen.component.test.tsx cobre é o modo LIVRE
 * (freestyle), que continua sendo o formulário histórico. Aqui é o modo GRADE.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ActiveSessionScreen,
  type ActiveSessionProps,
  type ActiveSessionExerciseOption,
  type ActiveSessionPreviousSet,
} from '../ActiveSessionScreen';
import { colors } from '../../../designSystem/tokens';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01T00:01:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

const STARTED_AT = new Date('2024-01-01T00:00:00.000Z').getTime();

/**
 * O UnderlineInput traduz isGhost/isLocked/hasError em estilo, sem repassar as
 * props ao TextInput — então a asserção é sobre o que aparece na tela.
 * `style` chega como array (possivelmente com nulls) do StyleSheet.
 */
function flatStyle(element: { props: { style?: unknown } }): Record<string, unknown> {
  const raw = element.props.style;
  const list = Array.isArray(raw) ? raw : [raw];
  return Object.assign({}, ...list.filter(Boolean).flat(Infinity).filter(Boolean));
}

/** Texto renderizado de um <Text>, que chega como array de filhos. */
function textOf(element: { props: { children?: unknown } }): string {
  const children = element.props.children;
  return (Array.isArray(children) ? children : [children]).join('');
}

function makeOption(
  overrides: Partial<ActiveSessionExerciseOption> & { id: string; name: string },
): ActiveSessionExerciseOption {
  return { seriesTarget: 3, repsTarget: 10, weightTarget: 0, ...overrides };
}

function makePrevious(
  overrides: Partial<ActiveSessionPreviousSet> & { id: string; exerciseId: string },
): ActiveSessionPreviousSet {
  return { weight: 5, repetitions: 10, completedAt: 1, ...overrides };
}

function renderGrid(overrides: Partial<ActiveSessionProps> = {}) {
  const props: ActiveSessionProps = {
    session: { id: 'session-1', started_at: STARTED_AT },
    loggedSets: [],
    totalVolume: 0,
    exerciseOptions: [makeOption({ id: 'ex1', name: 'Supino Reto' })],
    onLogSet: jest.fn(),
    onEndSession: jest.fn(),
    hasWorkout: true,
    workoutName: 'Treino A',
    previousSessionSets: [],
    ...overrides,
  };
  return { ...render(<ActiveSessionScreen {...props} />), props };
}

describe('ActiveSessionScreen — Modo grade', () => {
  it('monta uma linha por série planejada', () => {
    const { getByTestId, queryByTestId } = renderGrid();
    expect(getByTestId('set-row-ex1-0')).toBeTruthy();
    expect(getByTestId('set-row-ex1-1')).toBeTruthy();
    expect(getByTestId('set-row-ex1-2')).toBeTruthy();
    expect(queryByTestId('set-row-ex1-3')).toBeNull();
  });

  it('mostra o nome do treino em caixa alta', () => {
    const { getByTestId } = renderGrid({ workoutName: 'Treino A — Peito' });
    expect(getByTestId('workout-title').props.children).toBe('TREINO A — PEITO');
  });

  it('renderiza um card por exercício com o contador de séries', () => {
    const { getByTestId } = renderGrid({
      exerciseOptions: [
        makeOption({ id: 'ex1', name: 'Supino' }),
        makeOption({ id: 'ex2', name: 'Agachamento', seriesTarget: 2 }),
      ],
    });
    expect(getByTestId('exercise-card-ex1')).toBeTruthy();
    expect(getByTestId('exercise-card-ex2')).toBeTruthy();
    expect(textOf(getByTestId('exercise-count-ex2'))).toBe('0/2');
  });

  it('mostra o contador total de séries no header', () => {
    const { getByTestId } = renderGrid({
      exerciseOptions: [
        makeOption({ id: 'ex1', name: 'Supino', seriesTarget: 3 }),
        makeOption({ id: 'ex2', name: 'Agachamento', seriesTarget: 2 }),
      ],
    });
    expect(textOf(getByTestId('set-counter'))).toBe('0/5 séries');
  });

  it('renderiza a barra de progresso', () => {
    const { getByTestId } = renderGrid();
    expect(getByTestId('session-progress')).toBeTruthy();
  });

  it('cai no formulário livre quando não há treino definido', () => {
    const { getByTestId, queryByTestId } = renderGrid({ hasWorkout: false });
    expect(getByTestId('set-logger-form')).toBeTruthy();
    expect(queryByTestId('set-row-ex1-0')).toBeNull();
  });

  // Um treino cujos exercícios não têm series_target não tem grade para montar.
  it('cai no formulário livre quando nenhum exercício tem séries planejadas', () => {
    const { getByTestId, queryByTestId } = renderGrid({
      exerciseOptions: [makeOption({ id: 'ex1', name: 'Supino', seriesTarget: 0 })],
    });
    expect(getByTestId('set-logger-form')).toBeTruthy();
    expect(queryByTestId('set-row-ex1-0')).toBeNull();
  });
});

describe('ActiveSessionScreen — Fantasma da última sessão', () => {
  // O pedido do usuário: 5kg × 10 na semana passada aparece apagado hoje.
  it('pré-preenche a linha com o peso e reps da última sessão', () => {
    const { getByTestId } = renderGrid({
      previousSessionSets: [
        makePrevious({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10 }),
      ],
    });
    expect(getByTestId('set-weight-ex1-0').props.value).toBe('5');
    expect(getByTestId('set-reps-ex1-0').props.value).toBe('10');
  });

  it('marca o valor fantasma como apagado', () => {
    const { getByTestId } = renderGrid({
      previousSessionSets: [makePrevious({ id: 'p1', exerciseId: 'ex1' })],
    });
    expect(flatStyle(getByTestId('set-weight-ex1-0')).color).toBe(colors.secondaryText);
  });

  it('casa o fantasma pela MESMA posição de série', () => {
    const { getByTestId } = renderGrid({
      previousSessionSets: [
        makePrevious({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10, completedAt: 1 }),
        makePrevious({ id: 'p2', exerciseId: 'ex1', weight: 7, repetitions: 8, completedAt: 2 }),
      ],
    });
    expect(getByTestId('set-weight-ex1-0').props.value).toBe('5');
    expect(getByTestId('set-weight-ex1-1').props.value).toBe('7');
  });

  it('usa o alvo do treino quando nunca fez o exercício', () => {
    const { getByTestId } = renderGrid({
      exerciseOptions: [
        makeOption({ id: 'ex1', name: 'Supino', weightTarget: 40, repsTarget: 12 }),
      ],
    });
    expect(getByTestId('set-weight-ex1-0').props.value).toBe('40');
    expect(getByTestId('set-reps-ex1-0').props.value).toBe('12');
  });

  it('deixa o campo vazio quando não há histórico nem alvo', () => {
    const { getByTestId } = renderGrid({
      exerciseOptions: [
        makeOption({ id: 'ex1', name: 'Supino', weightTarget: 0, repsTarget: 0 }),
      ],
    });
    expect(getByTestId('set-weight-ex1-0').props.value).toBe('');
    expect(flatStyle(getByTestId('set-weight-ex1-0')).color).toBe(colors.primaryText);
  });

  // Ao digitar, o valor deixa de ser referência e passa a ser do usuário.
  it('tira o estado apagado quando o usuário edita o campo', () => {
    const { getByTestId } = renderGrid({
      previousSessionSets: [makePrevious({ id: 'p1', exerciseId: 'ex1' })],
    });
    fireEvent.changeText(getByTestId('set-weight-ex1-0'), '7');
    expect(getByTestId('set-weight-ex1-0').props.value).toBe('7');
    expect(flatStyle(getByTestId('set-weight-ex1-0')).color).toBe(colors.primaryText);
  });
});

describe('ActiveSessionScreen — Marcar o check grava', () => {
  it('grava o valor fantasma sem o usuário digitar nada', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderGrid({
      onLogSet,
      previousSessionSets: [
        makePrevious({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10 }),
      ],
    });
    fireEvent.press(getByTestId('set-check-ex1-0'));
    expect(onLogSet).toHaveBeenCalledWith('ex1', 5, 10);
  });

  it('grava o valor digitado quando o usuário progride', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderGrid({
      onLogSet,
      previousSessionSets: [
        makePrevious({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10 }),
      ],
    });
    fireEvent.changeText(getByTestId('set-weight-ex1-0'), '7');
    fireEvent.press(getByTestId('set-check-ex1-0'));
    expect(onLogSet).toHaveBeenCalledWith('ex1', 7, 10);
  });

  it('não grava e sinaliza erro quando o campo está vazio', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderGrid({
      onLogSet,
      exerciseOptions: [
        makeOption({ id: 'ex1', name: 'Supino', weightTarget: 0, repsTarget: 0 }),
      ],
    });
    fireEvent.press(getByTestId('set-check-ex1-0'));
    expect(onLogSet).not.toHaveBeenCalled();
    expect(flatStyle(getByTestId('set-weight-ex1-0')).borderBottomColor).toBe(colors.error);
    expect(flatStyle(getByTestId('set-reps-ex1-0')).borderBottomColor).toBe(colors.error);
  });

  it('limpa o erro depois que o campo é preenchido', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderGrid({
      onLogSet,
      exerciseOptions: [
        makeOption({ id: 'ex1', name: 'Supino', weightTarget: 0, repsTarget: 0 }),
      ],
    });
    fireEvent.press(getByTestId('set-check-ex1-0'));
    expect(flatStyle(getByTestId('set-weight-ex1-0')).borderBottomColor).toBe(colors.error);

    fireEvent.changeText(getByTestId('set-weight-ex1-0'), '80');
    fireEvent.changeText(getByTestId('set-reps-ex1-0'), '10');
    fireEvent.press(getByTestId('set-check-ex1-0'));

    expect(onLogSet).toHaveBeenCalledWith('ex1', 80, 10);
    expect(flatStyle(getByTestId('set-weight-ex1-0')).borderBottomColor).not.toBe(colors.error);
  });

  it('mostra a série já gravada como marcada e travada', () => {
    const { getByTestId } = renderGrid({
      loggedSets: [
        {
          id: 'c1',
          exerciseId: 'ex1',
          exerciseName: 'Supino Reto',
          weight: 80,
          reps: 6,
          completedAt: 10,
        },
      ],
    });
    expect(getByTestId('set-check-ex1-0').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('set-weight-ex1-0').props.value).toBe('80');
    expect(getByTestId('set-weight-ex1-0').props.editable).toBe(false);
  });

  // Decisão do usuário: série gravada não desmarca, para que nada suma do
  // histórico por toque acidental no meio do treino.
  it('não desmarca uma série já gravada', () => {
    const onLogSet = jest.fn();
    const { getByTestId } = renderGrid({
      onLogSet,
      loggedSets: [
        {
          id: 'c1',
          exerciseId: 'ex1',
          exerciseName: 'Supino Reto',
          weight: 80,
          reps: 6,
          completedAt: 10,
        },
      ],
    });
    fireEvent.press(getByTestId('set-check-ex1-0'));
    expect(onLogSet).not.toHaveBeenCalled();
  });

  it('atualiza o contador conforme as séries são gravadas', () => {
    const { getByTestId } = renderGrid({
      loggedSets: [
        {
          id: 'c1',
          exerciseId: 'ex1',
          exerciseName: 'Supino Reto',
          weight: 80,
          reps: 6,
          completedAt: 10,
        },
      ],
    });
    expect(textOf(getByTestId('set-counter'))).toBe('1/3 séries');
    expect(textOf(getByTestId('exercise-count-ex1'))).toBe('1/3');
  });
});

describe('ActiveSessionScreen — Overlay de saída', () => {
  it('não mostra o botão voltar sem onBack', () => {
    const { queryByTestId } = renderGrid();
    expect(queryByTestId('active-session-header-back')).toBeNull();
  });

  it('abre a confirmação ao tocar em Voltar, sem sair direto', () => {
    const onBack = jest.fn();
    const { getByTestId } = renderGrid({ onBack });
    fireEvent.press(getByTestId('active-session-header-back'));
    expect(getByTestId('exit-confirm-card')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('sai ao confirmar com "Sim"', () => {
    const onBack = jest.fn();
    const { getByTestId } = renderGrid({ onBack });
    fireEvent.press(getByTestId('active-session-header-back'));
    fireEvent.press(getByTestId('exit-confirm-yes'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('permanece na tela ao recusar com "Não"', () => {
    const onBack = jest.fn();
    const { getByTestId } = renderGrid({ onBack });
    fireEvent.press(getByTestId('active-session-header-back'));
    fireEvent.press(getByTestId('exit-confirm-no'));
    expect(onBack).not.toHaveBeenCalled();
    expect(getByTestId('active-session-screen')).toBeTruthy();
  });
});

describe('ActiveSessionScreen — Resumo pós-treino', () => {
  it('mostra o resumo ao finalizar', () => {
    const { getByTestId } = renderGrid();
    fireEvent.press(getByTestId('end-session-button'));
    expect(getByTestId('summary-title').props.children).toBe('TREINO CONCLUÍDO!');
  });

  it('mostra volume, duração e contagem de séries', () => {
    const { getByTestId } = renderGrid({
      totalVolume: 4200,
      loggedSets: [
        { id: 'c1', exerciseId: 'ex1', exerciseName: 'Supino', weight: 80, reps: 6, completedAt: 1 },
        { id: 'c2', exerciseId: 'ex1', exerciseName: 'Supino', weight: 80, reps: 6, completedAt: 2 },
      ],
    });
    fireEvent.press(getByTestId('end-session-button'));
    expect(getByTestId('summary-volume-value').props.children).toBe('4200kg');
    // started_at é 1 minuto antes do horário fixado no beforeEach.
    expect(getByTestId('summary-duration-value').props.children).toBe('01:00');
    expect(getByTestId('summary-sets-value').props.children).toBe('2');
  });

  it('encerra a sessão pelo botão do resumo', () => {
    const onEndSession = jest.fn();
    const { getByTestId } = renderGrid({ onEndSession });
    fireEvent.press(getByTestId('end-session-button'));
    fireEvent.press(getByTestId('summary-back-button'));
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});

describe('ActiveSessionScreen — Cronômetro no header', () => {
  it('mostra o tempo decorrido junto ao contador', () => {
    const { getByTestId } = renderGrid();
    expect(getByTestId('session-timer').props.children).toBe('00:01:00');
  });
});
