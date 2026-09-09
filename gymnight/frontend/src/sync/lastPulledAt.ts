/**
 * lastPulledAt — Gerenciamento do cursor `last_pulled_at` para o Sync_Engine.
 *
 * Persiste o timestamp da última sincronização de pull bem-sucedida.
 * Quando nenhum cursor foi persistido (primeira sincronização), retorna null.
 *
 * O cache em memória continua sendo a fonte de leitura síncrona (todos os
 * consumidores — syncCycleRunner, logoutAdapters — esperam
 * `loadLastPulledAt()` síncrono). A persistência real vive em
 * `expo-secure-store` (mesma dependência já usada por `SecureStorage.ts`):
 * `saveLastPulledAt`/`clearLastPulledAt` escrevem lá em paralelo (fire-and-
 * forget), e `hydrateLastPulledAt()` lê de lá uma vez no bootstrap para
 * repopular o cache — assim a assinatura síncrona nunca muda.
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'gymnight.sync.lastPulledAt';

let lastPulledAtValue: number | null = null;

/**
 * Retorna o cursor persistido ou null se nenhuma sincronização pull
 * foi concluída com sucesso até agora.
 */
export function loadLastPulledAt(): number | null {
  return lastPulledAtValue;
}

/**
 * Persiste o cursor após uma sincronização pull bem-sucedida.
 * Somente deve ser chamado depois que todas as mudanças do pull
 * foram aplicadas com sucesso ao WatermelonDB (Requisito 4.5).
 */
export function saveLastPulledAt(timestamp: number): void {
  lastPulledAtValue = timestamp;
  void SecureStore.setItemAsync(STORAGE_KEY, String(timestamp));
}

/**
 * Limpa o cursor (ex.: no logout, para forçar full pull na próxima sessão).
 * Limpa memória e SecureStore — senão o cursor do usuário anterior vaza
 * para o próximo login.
 */
export function clearLastPulledAt(): void {
  lastPulledAtValue = null;
  void SecureStore.deleteItemAsync(STORAGE_KEY);
}

/**
 * Hidrata o cache em memória a partir do SecureStore. Chamar uma vez no
 * bootstrap (App.tsx), antes que qualquer gatilho de sync tenha chance real
 * de disparar o primeiro ciclo. `null`/valor não numérico persistido conta
 * como "nunca sincronizou" (mesmo efeito de não ter hidratado nada).
 */
export async function hydrateLastPulledAt(): Promise<void> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (raw === null) return;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return;
  lastPulledAtValue = parsed;
}
