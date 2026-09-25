/**
 * bootstrapRouting — a quarta fase, 'onboarding' (Wave 8,
 * PARIDADE-04-ROTINAS-PERFIL.md §2.4). Cobre o que
 * AppNavigator.property9.test.ts não cobre (aquele arquivo nunca semeia uma
 * sessão real, então nunca exercita o ramo de checagem de onboarding).
 */
import * as fc from 'fast-check';
import {
  needsOnboarding,
  resolveAuthenticatedPhase,
  runBootstrapRouting,
} from '../bootstrapRouting';
import { createSessionStore } from '../../auth/sessionStore';
import type { AuthManager } from '../../auth/AuthManager';

describe('needsOnboarding', () => {
  it('perfil null precisa de onboarding', () => {
    expect(needsOnboarding(null)).toBe(true);
  });

  it('nome vazio ou só espaço precisa de onboarding', () => {
    expect(needsOnboarding({ name: '' })).toBe(true);
    expect(needsOnboarding({ name: '   ' })).toBe(true);
  });

  it('qualquer nome preenchido não precisa de onboarding', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (name) => needsOnboarding({ name }) === false,
      ),
      { numRuns: 100 },
    );
  });
});

describe('resolveAuthenticatedPhase', () => {
  it('resolve "onboarding" quando checkOnboarding diz que precisa', async () => {
    const phase = await resolveAuthenticatedPhase('user-1', async () => true);
    expect(phase).toBe('onboarding');
  });

  it('resolve "authenticated" quando checkOnboarding diz que não precisa', async () => {
    const phase = await resolveAuthenticatedPhase('user-1', async () => false);
    expect(phase).toBe('authenticated');
  });

  it('repassa exatamente o userId recebido para checkOnboarding', async () => {
    let receivedUserId: string | null = null;
    await resolveAuthenticatedPhase('user-42', async (id) => {
      receivedUserId = id;
      return false;
    });
    expect(receivedUserId).toBe('user-42');
  });
});

describe('runBootstrapRouting — integra a checagem de onboarding', () => {
  function makeDashboardAuthManager(): AuthManager {
    return {
      restoreSession: async () => ({ navigateTo: 'dashboard' as const }),
    } as unknown as AuthManager;
  }

  it('sessão restaurada + onboarding pendente resolve "onboarding", não "authenticated"', async () => {
    const sessionStore = createSessionStore();
    sessionStore.set({ access_token: 't', refresh_token: 'r', user_id: 'user-1' });

    const phase = await runBootstrapRouting(makeDashboardAuthManager(), sessionStore, async () => true);
    expect(phase).toBe('onboarding');
  });

  it('sessão restaurada + perfil completo resolve "authenticated"', async () => {
    const sessionStore = createSessionStore();
    sessionStore.set({ access_token: 't', refresh_token: 'r', user_id: 'user-1' });

    const phase = await runBootstrapRouting(makeDashboardAuthManager(), sessionStore, async () => false);
    expect(phase).toBe('authenticated');
  });

  it('sem sessão restaurada (navigateTo=auth) nunca consulta checkOnboarding', async () => {
    const sessionStore = createSessionStore();
    let called = false;
    const authManager = {
      restoreSession: async () => ({ navigateTo: 'auth' as const }),
    } as unknown as AuthManager;

    const phase = await runBootstrapRouting(authManager, sessionStore, async () => {
      called = true;
      return true;
    });

    expect(phase).toBe('auth');
    expect(called).toBe(false);
  });

  it('checkOnboarding recebe exatamente o user_id da sessão restaurada', async () => {
    const sessionStore = createSessionStore();
    sessionStore.set({ access_token: 't', refresh_token: 'r', user_id: 'user-abc-123' });
    let receivedUserId: string | null = null;

    await runBootstrapRouting(makeDashboardAuthManager(), sessionStore, async (id) => {
      receivedUserId = id;
      return false;
    });

    expect(receivedUserId).toBe('user-abc-123');
  });
});
