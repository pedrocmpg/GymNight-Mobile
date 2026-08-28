/**
 * Wave 3 — a estrutura nova do Dashboard, portada de dashboard.py `_build`.
 *
 * Cobre o que o DashboardScreen.component.test.tsx não cobria: hero com
 * saudação e perfil, grade 2×2 de métricas, atividade semanal segunda→domingo,
 * card de treinos recentes e a rota "+ Novo" para o WorkoutCreator.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  DashboardScreen,
  type DashboardScreenProps,
  type DashboardWorkout,
  type DashboardRecentSession,
} from '../DashboardScreen';

function makeWorkout(
  overrides: Partial<DashboardWorkout> & { id: string; name: string },
): DashboardWorkout {
  return {
    exerciseCount: 0,
    avgSessionDurationMs: null,
    lastTrainedDaysAgo: null,
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<DashboardRecentSession> & { id: string },
): DashboardRecentSession {
  return {
    workoutName: null,
    startedAt: Date.now(),
    durationMs: null,
    totalVolume: 0,
    ...overrides,
  };
}

function renderScreen(overrides: Partial<DashboardScreenProps> = {}) {
  const props: DashboardScreenProps = {
    isOnline: true,
    isLoading: false,
    workouts: [],
    weeklyStreak: [false, false, false, false, false, false, false],
    syncStatus: 'synced',
    onCreateWorkout: jest.fn(),
    onStartSession: jest.fn(),
    onLogout: jest.fn(),
    ...overrides,
  };
  return { ...render(<DashboardScreen {...props} />), props };
}

describe('DashboardScreen — Hero', () => {
  it('renderiza o hero mesmo sem perfil carregado', () => {
    const { getByTestId, queryByTestId } = renderScreen({ profile: null });
    expect(getByTestId('dashboard-hero')).toBeTruthy();
    // Sem perfil não há subtítulo — nada de "nullkg".
    expect(queryByTestId('hero-subtitle')).toBeNull();
  });

  it('mostra o nome do usuário em caixa alta na saudação', () => {
    const { getByText } = renderScreen({
      profile: { name: 'Pedro', weight: 78, height: 180 },
    });
    expect(getByText(', PEDRO')).toBeTruthy();
  });

  it('compõe o subtítulo como peso · altura', () => {
    const { getByTestId } = renderScreen({
      profile: { name: 'Pedro', weight: 78, height: 180 },
    });
    expect(getByTestId('hero-subtitle').props.children).toBe('78kg · 180cm');
  });

  it('omite o campo nulo junto com o separador', () => {
    const { getByTestId } = renderScreen({
      profile: { name: 'Pedro', weight: 78, height: null },
    });
    expect(getByTestId('hero-subtitle').props.children).toBe('78kg');
  });

  it('não renderiza o subtítulo quando peso e altura são nulos', () => {
    const { queryByTestId } = renderScreen({
      profile: { name: 'Pedro', weight: null, height: null },
    });
    expect(queryByTestId('hero-subtitle')).toBeNull();
  });
});

describe('DashboardScreen — Grade de métricas', () => {
  it('renderiza os quatro StatCards', () => {
    const { getByTestId } = renderScreen();
    for (const id of [
      'stat-training-days',
      'stat-total-volume',
      'stat-total-sets',
      'stat-week-streak',
    ]) {
      expect(getByTestId(id)).toBeTruthy();
    }
  });

  it('mostra zeros quando stats não é fornecido', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('dashboard-stats')).toBeTruthy();
  });

  it('formata o volume acima de 1000 no padrão do desktop', () => {
    const { getByText } = renderScreen({
      stats: { trainingDaysThisWeek: 4, totalVolume: 12400, totalSets: 86, weekStreak: 3 },
    });
    expect(getByText('12.4k')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
    expect(getByText('86')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });
});

describe('DashboardScreen — Atividade semanal', () => {
  it('renderiza 7 DayDot', () => {
    const { getByTestId } = renderScreen();
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`streak-day-${i}`)).toBeTruthy();
    }
  });

  it('exibe os dias começando na segunda, como o desktop', () => {
    const { getByText } = renderScreen();
    expect(getByText('SEG')).toBeTruthy();
    expect(getByText('DOM')).toBeTruthy();
  });

  // O weeklyStreak chega indexado por domingo=0; a tela reordena para
  // segunda→domingo. Um streak só-domingo precisa acender o ÚLTIMO ponto.
  it('reordena o streak de domingo=0 para segunda→domingo', () => {
    const sundayOnly = [true, false, false, false, false, false, false];
    // O DayDot ativo rotula a si mesmo pelo accessibilityLabel.
    const { getByLabelText } = renderScreen({ weeklyStreak: sundayOnly });
    expect(getByLabelText('Dom: treinou')).toBeTruthy();
    expect(getByLabelText('Seg: sem treino')).toBeTruthy();
  });

  it('acende a segunda quando o índice 1 (segunda) está marcado', () => {
    const mondayOnly = [false, true, false, false, false, false, false];
    const { getByLabelText } = renderScreen({ weeklyStreak: mondayOnly });
    expect(getByLabelText('Seg: treinou')).toBeTruthy();
    expect(getByLabelText('Dom: sem treino')).toBeTruthy();
  });
});

describe('DashboardScreen — Treinos recentes', () => {
  it('mostra a mensagem de vazio quando não há sessões', () => {
    const { getByTestId } = renderScreen({ recentSessions: [] });
    expect(getByTestId('recent-sessions-empty')).toBeTruthy();
  });

  it('lista as sessões recebidas', () => {
    const { getByTestId } = renderScreen({
      recentSessions: [
        makeSession({ id: 's1', workoutName: 'Treino A' }),
        makeSession({ id: 's2', workoutName: 'Treino B' }),
      ],
    });
    expect(getByTestId('recent-session-s1')).toBeTruthy();
    expect(getByTestId('recent-session-s2')).toBeTruthy();
  });

  it('rotula sessão sem treino associado como "Treino livre"', () => {
    const { getByText } = renderScreen({
      recentSessions: [makeSession({ id: 's1', workoutName: null })],
    });
    expect(getByText('Treino livre')).toBeTruthy();
  });

  it('mostra o volume à direita quando houve carga', () => {
    const { getByText } = renderScreen({
      recentSessions: [makeSession({ id: 's1', totalVolume: 4200, durationMs: 60000 })],
    });
    expect(getByText('4.2k kg')).toBeTruthy();
  });

  it('cai para a duração quando o volume é zero', () => {
    const { getByText } = renderScreen({
      recentSessions: [makeSession({ id: 's1', totalVolume: 0, durationMs: 38 * 60000 })],
    });
    expect(getByText('38 min')).toBeTruthy();
  });
});

describe('DashboardScreen — Rota para o WorkoutCreator', () => {
  // O bug da Wave 3: com >= 1 treino criado, o único CTA para o criador ficava
  // dentro do empty state e desaparecia — não havia mais como criar um treino.
  it('mostra o botão "+ Novo" mesmo com treinos já existentes', () => {
    const { getByTestId } = renderScreen({
      workouts: [makeWorkout({ id: 'w1', name: 'Treino A' })],
    });
    expect(getByTestId('create-workout-button')).toBeTruthy();
  });

  it('chama onCreateWorkout ao tocar em "+ Novo"', () => {
    const onCreateWorkout = jest.fn();
    const { getByTestId } = renderScreen({
      workouts: [makeWorkout({ id: 'w1', name: 'Treino A' })],
      onCreateWorkout,
    });
    fireEvent.press(getByTestId('create-workout-button'));
    expect(onCreateWorkout).toHaveBeenCalledTimes(1);
  });

  it('mantém o botão "+ Novo" disponível também no empty state', () => {
    const { getByTestId } = renderScreen({ workouts: [] });
    expect(getByTestId('create-workout-button')).toBeTruthy();
    expect(getByTestId('create-workout-action')).toBeTruthy();
  });
});

describe('DashboardScreen — Logout', () => {
  it('chama onLogout ao tocar em Sair', () => {
    const onLogout = jest.fn();
    const { getByTestId } = renderScreen({ onLogout });
    fireEvent.press(getByTestId('logout-button'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
