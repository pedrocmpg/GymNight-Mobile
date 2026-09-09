/**
 * useSyncTrigger — liga os três gatilhos de `SyncEngine.requestSyncCycle()`
 * descritos no docstring de `SyncEngine.ts`:
 *
 * - Transição de conectividade estável offline→online (debounce de 2s)
 * - Timer fixo de 30s, ativo só em foreground + online
 * - Ação manual (exposta como `requestSync`, para pull-to-refresh)
 *
 * O SyncEngine já é single-flight (`cycleInProgress`), então gatilhos
 * concorrentes são inofensivos — este hook não precisa de lock próprio.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { SyncEngine } from './SyncEngine';

const OFFLINE_TO_ONLINE_DEBOUNCE_MS = 2000;
const FOREGROUND_SYNC_INTERVAL_MS = 30000;

export interface UseSyncTriggerResult {
  /** Dispara um ciclo manualmente (ex.: pull-to-refresh no Dashboard). */
  requestSync: () => void;
}

export function useSyncTrigger(syncEngine: SyncEngine): UseSyncTriggerResult {
  const wasOnlineRef = useRef(true);
  const isOnlineRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestSync = useCallback(() => {
    void syncEngine.requestSyncCycle();
  }, [syncEngine]);

  // Gatilho 1: transição offline→online, com debounce de 2s.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected === true;
      const wasOnline = wasOnlineRef.current;
      isOnlineRef.current = isOnline;
      wasOnlineRef.current = isOnline;

      if (!wasOnline && isOnline) {
        if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          requestSync();
        }, OFFLINE_TO_ONLINE_DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [requestSync]);

  // Gatilho 2: timer de 30s, existe só enquanto o app está em foreground —
  // parado em background (AppState), não só ignorado, para não gastar
  // bateria com um timer rodando à toa. O check de `isOnlineRef` dentro do
  // tick cobre o caso de o app estar em foreground mas offline.
  useEffect(() => {
    function tick() {
      if (isOnlineRef.current) requestSync();
    }
    function startInterval() {
      if (intervalRef.current !== null) return;
      intervalRef.current = setInterval(tick, FOREGROUND_SYNC_INTERVAL_MS);
    }
    function stopInterval() {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    if (AppState.currentState === 'active') startInterval();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') startInterval();
      else stopInterval();
    });

    return () => {
      subscription.remove();
      stopInterval();
    };
  }, [requestSync]);

  return { requestSync };
}
