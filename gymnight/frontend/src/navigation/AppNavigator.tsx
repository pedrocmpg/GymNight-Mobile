import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthManager } from '../auth/AuthManager';
import type { LogoutManager } from '../auth/LogoutManager';
import type { SyncEngine } from '../sync/SyncEngine';
import type { SessionStore } from '../auth/sessionStore';
import { runBootstrapRouting, resolveAuthenticatedPhase } from './bootstrapRouting';
import { colors } from '../designSystem/tokens';
import { LoadingState } from '../designSystem/components/LoadingState';
import { navigationTheme } from './navigationTheme';
import { AuthScreenContainer } from './containers/AuthScreenContainer';
import { MainTabNavigator } from './MainTabNavigator';
import { WorkoutCreatorScreenContainer } from './containers/WorkoutCreatorScreenContainer';
import { ActiveSessionScreenContainer } from './containers/ActiveSessionScreenContainer';
import { OnboardingScreenContainer } from './containers/OnboardingScreenContainer';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  /** `workoutId` presente = editar um treino existente (Wave 8); ausente = criar um novo. */
  WorkoutCreator: { workoutId?: string } | undefined;
  ActiveSession: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Sessão em andamento é um modo à parte: sobe de baixo e não fecha com gesto. */
const ACTIVE_SESSION_OPTIONS = {
  animation: 'slide_from_bottom',
  gestureEnabled: false,
} as const;

export interface AppNavigatorProps {
  authManager: AuthManager;
  syncEngine: SyncEngine;
  logoutManager: LogoutManager;
  sessionStore: SessionStore;
  /**
   * Whether the Inter families have finished loading (App.tsx owns the
   * `useFonts` call). Folded into the existing bootstrap loading gate so the
   * app never shows two loading screens in sequence. Defaults to `true` so
   * existing callers and tests are unaffected.
   */
  fontsLoaded?: boolean;
}

/**
 * Root navigator. Decides, at bootstrap and on every auth transition, whether
 * the active stack is the auth stack (Auth_Screen) or the authenticated stack
 * (Main [bottom tabs: Dashboard/Progress], WorkoutCreator, ActiveSession) —
 * Requirements 5.1, 5.2, 6.1-6.4, 6.7. WorkoutCreator and ActiveSession are
 * full-screen flows kept as Stack.Screen siblings of Main so they never show
 * the tab bar (see MainTabNavigator.tsx).
 */
export function AppNavigator(props: AppNavigatorProps) {
  const [phase, setPhase] = useState<'loading' | 'auth' | 'onboarding' | 'authenticated'>('loading');

  useEffect(() => {
    let cancelled = false;
    runBootstrapRouting(props.authManager, props.sessionStore).then((resolvedPhase) => {
      if (!cancelled) setPhase(resolvedPhase);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fontsLoaded = props.fontsLoaded ?? true;

  if (phase === 'loading' || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState testID="app-loading" indicatorTestID="app-loading-indicator" />
      </View>
    );
  }

  const handleAuthenticated = async () => {
    const userId = props.sessionStore.getCurrentSession()?.user_id;
    if (!userId) {
      setPhase('authenticated');
      return;
    }
    setPhase(await resolveAuthenticatedPhase(userId));
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {phase === 'auth' ? (
          <Stack.Screen name="Auth">
            {(navProps) => (
              <AuthScreenContainer
                {...navProps}
                authManager={props.authManager}
                sessionStore={props.sessionStore}
                onAuthenticated={handleAuthenticated}
              />
            )}
          </Stack.Screen>
        ) : phase === 'onboarding' ? (
          <Stack.Screen name="Onboarding">
            {() => (
              <OnboardingScreenContainer
                sessionStore={props.sessionStore}
                onCompleted={() => setPhase('authenticated')}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main">
              {(navProps) => (
                <MainTabNavigator
                  syncEngine={props.syncEngine}
                  logoutManager={props.logoutManager}
                  userId={props.sessionStore.getCurrentSession()?.user_id ?? ''}
                  onCreateWorkout={() => navProps.navigation.navigate('WorkoutCreator')}
                  onEditWorkout={(workoutId) =>
                    navProps.navigation.navigate('WorkoutCreator', { workoutId })
                  }
                  onSessionStarted={(sessionId) =>
                    navProps.navigation.navigate('ActiveSession', { sessionId })
                  }
                  onLoggedOut={() => setPhase('auth')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="WorkoutCreator">
              {(navProps) => (
                <WorkoutCreatorScreenContainer
                  userId={props.sessionStore.getCurrentSession()?.user_id ?? ''}
                  workoutId={navProps.route.params?.workoutId}
                  onSaved={() => navProps.navigation.navigate('Main')}
                  onBack={() => navProps.navigation.navigate('Main')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ActiveSession" options={ACTIVE_SESSION_OPTIONS}>
              {(navProps) => (
                <ActiveSessionScreenContainer
                  {...navProps}
                  onSessionEnded={() => navProps.navigation.navigate('Main')}
                  // Sai da sessão SEM encerrá-la: ela continua retomável.
                  onBack={() => navProps.navigation.navigate('Main')}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
