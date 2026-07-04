/**
 * Mock do expo-secure-store para testes.
 * Armazena valores em memória sem criptografia real.
 */

const store: Map<string, string> = new Map();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

/** Helper para testes: limpa o store entre testes */
export function __resetStore(): void {
  store.clear();
}
