import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { Alert } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { validateEnvConfig } from './src/config/env';
import { createSupabaseClient } from './src/auth/supabaseClient';
import { createSupabaseAuthClientAdapter } from './src/auth/supabaseAuthClientAdapter';
import { jwtTokenValidator } from './src/auth/jwtTokenValidator';
import { createSupabaseSessionRefresher } from './src/auth/supabaseSessionRefresher';
import { withSessionPropagation } from './src/auth/sessionProducers';
import { createSessionStore } from './src/auth/sessionStore';
import { AuthManager } from './src/auth/AuthManager';
import { AuthInterceptor } from './src/auth/AuthInterceptor';
import { TokenRefreshCoordinator } from './src/auth/TokenRefreshCoordinator';
import { LogoutManager } from './src/auth/LogoutManager';
import {
  createSupabaseLogoutPort,
  createLogoutStoragePort,
  createLogoutWipePort,
} from './src/auth/logoutAdapters';
import { SyncEngine } from './src/sync/SyncEngine';
import { createSyncCycleRunner } from './src/sync/syncCycleRunner';
import database from './src/db/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StartupErrorScreen } from './src/navigation/StartupErrorScreen';

/** Fetch adapter satisfying SyncHttpClient, used by the real Sync_Cycle_Runner. */
const fetchHttpClient = {
  async post(url: string, body: unknown, headers: Record<string, string>) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      return { kind: 'success' as const, status: response.status, body: await response.json().catch(() => ({})) };
    } catch (error) {
      return { kind: 'network_error' as const, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
  async get(url: string, headers: Record<string, string>) {
    try {
      const response = await fetch(url, { method: 'GET', headers });
      return { kind: 'success' as const, status: response.status, body: await response.json().catch(() => ({})) };
    } catch (error) {
      return { kind: 'network_error' as const, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

function confirmationPrompt(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Sincronizar antes de sair?',
      'Há dados pendentes de sincronização. Deseja sair mesmo assim?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sair', style: 'destructive', onPress: () => resolve(true) },
      ]
    );
  });
}

export default function App() {
  const validation = useMemo(() => validateEnvConfig(), []);

  // Cada peso da Inter e uma familia propria: no Android o `fontWeight` e
  // ignorado quando ha `fontFamily` customizada (ver designSystem/tokens.ts).
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  if (!validation.valid) {
    return <StartupErrorScreen offending={validation.offending} />;
  }

  const { config } = validation;

  // Bootstrap_Sequence: construct concrete adapters and inject them into the
  // already-implemented, already-tested Auth_Manager / Auth_Interceptor /
  // Logout_Manager / Sync_Engine (Requirements 1.6, 2.3, 2.4, 3.1, 3.5, 4.5,
  // 4.6, 5.4, 7.4, 9.1, 10.3).
  const supabaseClient = createSupabaseClient(config);
  const sessionStore = createSessionStore();

  const supabaseAuthClient = createSupabaseAuthClientAdapter(supabaseClient);
  const baseSessionRefresher = createSupabaseSessionRefresher(supabaseClient);
  const sessionRefresher = withSessionPropagation(baseSessionRefresher, sessionStore);

  const authManager = new AuthManager(supabaseAuthClient, undefined, jwtTokenValidator, sessionRefresher);
  const authInterceptor = new AuthInterceptor(sessionStore);
  const tokenRefreshCoordinator = new TokenRefreshCoordinator();

  const logoutManager = new LogoutManager({
    confirmationPrompt,
    supabase: createSupabaseLogoutPort(supabaseClient),
    storage: createLogoutStoragePort(sessionStore),
    wipe: createLogoutWipePort(database),
  });

  const syncCycleRunner = createSyncCycleRunner({
    backendBaseUrl: config.backendBaseUrl,
    http: fetchHttpClient,
    authInterceptor,
    tokenRefreshCoordinator,
    sessionRefresher,
    sessionStore,
    db: database,
  });
  const syncEngine = new SyncEngine(syncCycleRunner);

  return (
    <>
      <AppNavigator
        fontsLoaded={fontsLoaded}
        authManager={authManager}
        syncEngine={syncEngine}
        logoutManager={logoutManager}
        sessionStore={sessionStore}
      />
      <StatusBar style="light" />
    </>
  );
}
