import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'gymnight_session';

export interface Session {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

/**
 * Persists the session to expo-secure-store.
 */
export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

/**
 * Loads the session from expo-secure-store.
 * Returns null if no session is stored or if the stored value is not parseable.
 */
export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/**
 * Clears the session from expo-secure-store.
 */
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
