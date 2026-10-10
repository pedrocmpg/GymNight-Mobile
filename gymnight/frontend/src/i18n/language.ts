/**
 * Idioma do app, guardado no aparelho.
 *
 * Por ora só o conteúdo dos exercícios (nome, grupo muscular, equipamento)
 * muda com ele; o resto da interface continua em PT. A preferência é local
 * (não vai para `users`): vale antes do login, que é o que a tradução do app
 * inteiro vai precisar, e não toca no sync.
 *
 * Mesmo padrão de sync/lastPulledAt.ts: expo-secure-store como persistência.
 */
import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'pt' | 'en';

export const DEFAULT_LANGUAGE: AppLanguage = 'pt';
export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['pt', 'en'];

const STORAGE_KEY = 'gymnight.language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'pt' || value === 'en';
}

/** Idioma salvo, ou o padrão quando nada (ou algo inválido) foi salvo. */
export async function loadLanguage(): Promise<AppLanguage> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return isAppLanguage(raw) ? raw : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export async function saveLanguage(language: AppLanguage): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, language);
}
