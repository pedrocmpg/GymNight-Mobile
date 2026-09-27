import { Q, type Database } from '@nozbe/watermelondb';
import type { AuthManager, RestoreSessionResult, SignInResult, SignUpResult } from '../auth/AuthManager';
import type { SessionStore } from '../auth/sessionStore';
import { restoreSessionAndPropagate } from '../auth/sessionProducers';
import database from '../db/database';

export type BootstrapPhase = 'auth' | 'onboarding' | 'authenticated';

/**
 * Pure decision function: maps restoreSession's settled outcome to auth vs.
 * authenticated. Property 9: resolves 'authenticated' iff the outcome is
 * exactly { navigateTo: 'dashboard' }; every other outcome (auth, reject,
 * throw, unexpected value) resolves to 'auth'.
 *
 * Não decide onboarding — essa fase depende do perfil local (fora do alcance
 * de uma função pura sobre só o outcome de auth), ver `needsOnboarding` e
 * `runBootstrapRouting` abaixo.
 */
export function resolvePhaseFromRestoreOutcome(
  outcome: RestoreSessionResult | { __rejected: true }
): 'auth' | 'authenticated' {
  if ('navigateTo' in outcome && outcome.navigateTo === 'dashboard') {
    return 'authenticated';
  }
  return 'auth';
}

/**
 * Pure: um perfil sem nome preenchido precisa do onboarding — o desktop
 * mostra o wizard quando `user_data.json` não existe (setup.py); o
 * equivalente no mobile é `name` vazio/ausente na tabela `users`
 * (PARIDADE-04-ROTINAS-PERFIL.md §2.4).
 */
export function needsOnboarding(profile: { name: string } | null): boolean {
  return profile === null || profile.name.trim().length === 0;
}

/** Adapter: lê o perfil local (WatermelonDB) e aplica `needsOnboarding`. */
async function checkNeedsOnboardingFromDb(userId: string, db: Database): Promise<boolean> {
  const rows = (await db.get('users').query(Q.where('id', userId)).fetch()) as unknown as Array<{
    _raw: { name: string };
  }>;
  const record = rows[0];
  return needsOnboarding(record ? { name: record._raw.name } : null);
}

/**
 * Decide entre 'onboarding' e 'authenticated' para um usuário já autenticado
 * — compartilhado pelos DOIS pontos de entrada da área autenticada:
 * `runBootstrapRouting` (restaurar sessão no cold start) e o sign-in bem
 * sucedido em `AuthScreenContainer` (via `AppNavigator`). Sem isto, um
 * usuário novo que acabou de se cadastrar pularia o onboarding no primeiro
 * login — só o próximo restart do app (via runBootstrapRouting) pegaria.
 *
 * `checkOnboarding` é injetável para testes (default: lê a tabela `users` do
 * banco real).
 */
export async function resolveAuthenticatedPhase(
  userId: string,
  checkOnboarding: (userId: string) => Promise<boolean> = (id) =>
    checkNeedsOnboardingFromDb(id, database),
): Promise<'onboarding' | 'authenticated'> {
  const needsIt = await checkOnboarding(userId);
  return needsIt ? 'onboarding' : 'authenticated';
}

/**
 * Runs restoreSession (with session propagation) and resolves to a
 * BootstrapPhase, never throwing.
 */
export async function runBootstrapRouting(
  authManager: AuthManager,
  sessionStore: SessionStore,
  checkOnboarding?: (userId: string) => Promise<boolean>,
): Promise<BootstrapPhase> {
  try {
    const result = await restoreSessionAndPropagate(authManager, sessionStore);
    const phase = resolvePhaseFromRestoreOutcome(result);
    if (phase !== 'authenticated') return phase;

    const userId = sessionStore.getCurrentSession()?.user_id;
    if (!userId) return phase;

    return resolveAuthenticatedPhase(userId, checkOnboarding);
  } catch {
    return resolvePhaseFromRestoreOutcome({ __rejected: true });
  }
}

/**
 * Pure decision function for Property 10: maps signIn's settled outcome to
 * whether the navigator should move to Dashboard, staying on Auth otherwise
 * with a non-empty error message.
 */
export function resolveSignInOutcome(
  outcome: SignInResult | { __rejected: true }
): { navigateToDashboard: boolean; errorMessage: string | null } {
  if ('success' in outcome && outcome.success) {
    return { navigateToDashboard: true, errorMessage: null };
  }
  if ('success' in outcome && !outcome.success) {
    return { navigateToDashboard: false, errorMessage: outcome.error.message || 'Falha ao entrar.' };
  }
  return { navigateToDashboard: false, errorMessage: 'Falha ao entrar. Tente novamente.' };
}

/**
 * Pure decision function for signUp's settled outcome, mirroring
 * resolveSignInOutcome. A third case exists here (absent from sign-in):
 * `confirmationRequired`, when Supabase created the account but returned no
 * session because email confirmation is pending — there is nothing to
 * navigate to yet.
 */
export function resolveSignUpOutcome(
  outcome: SignUpResult | { __rejected: true }
): {
  navigateToDashboard: boolean;
  confirmationRequired: boolean;
  errorMessage: string | null;
} {
  if ('success' in outcome && outcome.success && 'navigateTo' in outcome) {
    return { navigateToDashboard: true, confirmationRequired: false, errorMessage: null };
  }
  if ('success' in outcome && outcome.success) {
    return { navigateToDashboard: false, confirmationRequired: true, errorMessage: null };
  }
  if ('success' in outcome && !outcome.success) {
    return {
      navigateToDashboard: false,
      confirmationRequired: false,
      errorMessage: outcome.error.message || 'Falha ao cadastrar.',
    };
  }
  return {
    navigateToDashboard: false,
    confirmationRequired: false,
    errorMessage: 'Falha ao cadastrar. Tente novamente.',
  };
}
