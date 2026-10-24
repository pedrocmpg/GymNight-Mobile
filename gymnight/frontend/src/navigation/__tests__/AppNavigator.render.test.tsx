/**
 * Renderiza o AppNavigator de verdade (react-test-renderer) em cada fase de
 * bootstrap e percorre o fluxo Main → WorkoutCreator / ActiveSession → Main,
 * incluindo o setup (Onboarding). Navegadores e containers pesados são
 * substituídos por dublês; o que se testa é a escolha de tela por fase e a
 * fiação de callbacks/parâmetros.
 */
import React from 'react';
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native';
import { AppNavigator } from '../AppNavigator';
import * as bootstrap from '../bootstrapRouting';
import { createMockGymAiClient } from '../../gymai/mockGymAiClient';
import type { GymAiResult } from '../../gymai/GymAiClient';

jest.mock('@react-navigation/native', () => require('../../test/mocks/fakeNavigators').fakeNavigationNative);
jest.mock('@react-navigation/native-stack', () => require('../../test/mocks/fakeNavigators').fakeNativeStack);
jest.mock('@react-navigation/bottom-tabs', () => require('../../test/mocks/fakeNavigators').fakeBottomTabs);
jest.mock('../bootstrapRouting', () => ({
  runBootstrapRouting: jest.fn(),
  resolveAuthenticatedPhase: jest.fn(),
}));

const mockProps: Record<string, any> = {};
function mockContainer(name: string) {
  const React = require('react');
  return (props: any) => {
    mockProps[name] = props;
    return React.createElement('Text', { testID: name }, name);
  };
}
jest.mock('../containers/AuthScreenContainer', () => ({ AuthScreenContainer: mockContainer('auth') }));
jest.mock('../containers/OnboardingScreenContainer', () => ({ OnboardingScreenContainer: mockContainer('onboarding') }));
jest.mock('../containers/DashboardScreenContainer', () => ({ DashboardScreenContainer: mockContainer('dashboard') }));
jest.mock('../containers/ProgressScreenContainer', () => ({ ProgressScreenContainer: mockContainer('progress') }));
jest.mock('../containers/StatisticsScreenContainer', () => ({ StatisticsScreenContainer: mockContainer('statistics') }));
jest.mock('../containers/WorkoutCreatorScreenContainer', () => ({ WorkoutCreatorScreenContainer: mockContainer('creator') }));
jest.mock('../containers/ActiveSessionScreenContainer', () => ({ ActiveSessionScreenContainer: mockContainer('session') }));

const runBootstrap = bootstrap.runBootstrapRouting as jest.Mock;
const resolveAuthenticated = bootstrap.resolveAuthenticatedPhase as jest.Mock;

const sessionStore = { getCurrentSession: () => ({ user_id: 'user-test-1' }) };
const navProps = {
  authManager: {},
  syncEngine: {},
  logoutManager: {},
  sessionStore,
  gymAiClient: createMockGymAiClient(),
} as any;

async function mount(phase: string, extra: Record<string, unknown> = {}): Promise<RenderAPI> {
  runBootstrap.mockResolvedValue(phase);
  const tree = render(<AppNavigator {...navProps} {...extra} />);
  await act(async () => undefined); // drena o runBootstrapRouting
  return tree;
}
const SCREEN_IDS = ['auth', 'onboarding', 'dashboard', 'progress', 'statistics', 'gymai-screen', 'creator', 'session'];
const TABS = ['dashboard', 'progress', 'statistics', 'gymai-screen'];
const ids = (tree: RenderAPI) => SCREEN_IDS.filter((id) => tree.queryAllByTestId(id).length > 0);
const isLoading = (tree: RenderAPI) => tree.queryAllByTestId('app-loading').length > 0;

describe('AppNavigator (renderizado)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockProps)) delete mockProps[k];
  });

  it('mostra o loading enquanto o bootstrap resolve e enquanto as fontes não carregaram', async () => {
    runBootstrap.mockReturnValue(new Promise(() => undefined));
    const tree = render(<AppNavigator {...navProps} />);
    await act(async () => undefined);
    expect(isLoading(tree)).toBe(true);

    const fonts = await mount('authenticated', { fontsLoaded: false });
    expect(isLoading(fonts)).toBe(true);
    expect(ids(fonts)).toEqual([]);
  });

  it('fase auth renderiza só a tela de login', async () => {
    const tree = await mount('auth');
    expect(ids(tree)).toEqual(['auth']);
  });

  it('login bem-sucedido leva ao setup (onboarding) e depois às abas', async () => {
    const tree = await mount('auth');
    resolveAuthenticated.mockResolvedValue('onboarding');
    await act(async () => {
      await mockProps.auth.onAuthenticated();
    });
    expect(resolveAuthenticated).toHaveBeenCalledWith('user-test-1');
    expect(ids(tree)).toEqual(['onboarding']);

    await act(async () => {
      mockProps.onboarding.onCompleted();
    });
    expect(ids(tree)).toEqual(TABS);
  });

  it('fase onboarding renderiza o setup', async () => {
    const tree = await mount('onboarding');
    expect(ids(tree)).toEqual(['onboarding']);
  });

  it('fase authenticated renderiza as quatro abas com o userId da sessão', async () => {
    const tree = await mount('authenticated');
    expect(ids(tree)).toEqual(TABS);
    expect(mockProps.dashboard.userId).toBe('user-test-1');
    expect(mockProps.progress.userId).toBe('user-test-1');
    expect(mockProps.statistics.userId).toBe('user-test-1');
  });

  it('criar treino abre o criador e voltar/salvar retorna às abas', async () => {
    const tree = await mount('authenticated');
    await act(async () => mockProps.dashboard.onCreateWorkout());
    expect(ids(tree)).toEqual(['creator']);
    expect(mockProps.creator.workoutId).toBeUndefined();

    await act(async () => mockProps.creator.onSaved());
    expect(ids(tree)).toEqual(TABS);

    await act(async () => mockProps.dashboard.onCreateWorkout());
    await act(async () => mockProps.creator.onBack());
    expect(ids(tree)).toEqual(TABS);
  });

  it('editar treino repassa o workoutId ao criador', async () => {
    const tree = await mount('authenticated');
    await act(async () => mockProps.dashboard.onEditWorkout('workout-test-9'));
    expect(ids(tree)).toEqual(['creator']);
    expect(mockProps.creator.workoutId).toBe('workout-test-9');
  });

  it('iniciar sessão abre a sessão ativa; sair ou encerrar volta às abas', async () => {
    const tree = await mount('authenticated');
    await act(async () => mockProps.dashboard.onSessionStarted('session-test-3'));
    expect(ids(tree)).toEqual(['session']);
    expect(mockProps.session.route.params).toEqual({ sessionId: 'session-test-3' });

    await act(async () => mockProps.session.onBack());
    expect(ids(tree)).toEqual(TABS);

    await act(async () => mockProps.dashboard.onSessionStarted('session-test-4'));
    await act(async () => mockProps.session.onSessionEnded());
    expect(ids(tree)).toEqual(TABS);
  });

  it('logout nas abas volta para a tela de login', async () => {
    const tree = await mount('authenticated');
    await act(async () => mockProps.dashboard.onLoggedOut());
    expect(ids(tree)).toEqual(['auth']);
  });

  describe('aba GymAI', () => {
    async function mountChat(result?: GymAiResult) {
      return mount('authenticated', { gymAiClient: createMockGymAiClient(result) });
    }
    async function ask(tree: RenderAPI, text: string) {
      fireEvent.changeText(tree.getByTestId('gymai-input'), text);
      await act(async () => {
        fireEvent.press(tree.getByTestId('gymai-send'));
      });
    }

    it('começa vazia, com o envio desabilitado', async () => {
      const tree = await mountChat();
      expect(tree.queryAllByTestId('gymai-empty')).toHaveLength(1);
      expect(tree.getByTestId('gymai-send').props.accessibilityState.disabled).toBe(true);
    });

    it('sucesso: mantém pergunta e resposta no histórico em memória', async () => {
      const tree = await mountChat();
      await ask(tree, 'Quanto descansar entre séries?');
      expect(tree.getByTestId('gymai-message-user')).toBeTruthy();
      expect(tree.getByText('[mock] Recebi: Quanto descansar entre séries?')).toBeTruthy();
      expect(tree.queryAllByTestId('gymai-empty')).toHaveLength(0);
      expect(tree.queryAllByTestId('gymai-loading')).toHaveLength(0);

      await ask(tree, 'E para hipertrofia?');
      expect(tree.getAllByTestId('gymai-message-user')).toHaveLength(2);
      expect(tree.getAllByTestId('gymai-message-assistant')).toHaveLength(2);
    });

    it('mostra o estado de carregando até o cliente responder', async () => {
      let resolve!: (r: GymAiResult) => void;
      const pending = new Promise<GymAiResult>((r) => (resolve = r));
      const tree = await mount('authenticated', { gymAiClient: { sendMessage: () => pending } });
      await ask(tree, 'Oi');
      expect(tree.queryAllByTestId('gymai-loading')).toHaveLength(1);
      expect(tree.getByTestId('gymai-send').props.accessibilityState.disabled).toBe(true);
      await act(async () => resolve({ success: true, reply: 'Olá!' }));
      expect(tree.queryAllByTestId('gymai-loading')).toHaveLength(0);
      expect(tree.getByText('Olá!')).toBeTruthy();
    });

    it('offline: avisa e mantém a pergunta no histórico', async () => {
      const tree = await mountChat({ success: false, reason: 'offline' });
      await ask(tree, 'Oi');
      expect(tree.queryAllByTestId('gymai-error-offline')).toHaveLength(1);
      expect(tree.getAllByTestId('gymai-message-user')).toHaveLength(1);
      expect(tree.queryAllByTestId('gymai-message-assistant')).toHaveLength(0);
    });

    it('rate_limited: avisa do limite de requisições', async () => {
      const tree = await mountChat({ success: false, reason: 'rate_limited' });
      await ask(tree, 'Oi');
      expect(tree.queryAllByTestId('gymai-error-rate_limited')).toHaveLength(1);
      expect(tree.getByText(/Muitas perguntas/)).toBeTruthy();
    });

    it('um novo envio bem-sucedido limpa o aviso de erro', async () => {
      const sendMessage = jest
        .fn()
        .mockResolvedValueOnce({ success: false, reason: 'offline' })
        .mockResolvedValueOnce({ success: true, reply: 'Voltei' });
      const tree = await mount('authenticated', { gymAiClient: { sendMessage } });
      await ask(tree, 'Oi');
      await ask(tree, 'De novo');
      expect(tree.queryAllByTestId('gymai-error-offline')).toHaveLength(0);
      expect(tree.getByText('Voltei')).toBeTruthy();
      expect(sendMessage.mock.calls[1][0].map((m: any) => m.content)).toEqual(['Oi', 'De novo']);
    });
  });
});
