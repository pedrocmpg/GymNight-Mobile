import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthManager } from '../auth/AuthManager';
import type { LogoutManager } from '../auth/LogoutManager';
import type { SyncEngine } from '../sync/SyncEngine';
import type { SessionStore } from '../auth/sessionStore';
import { runBootstrapRouting } from './bootstrapRouting';
import { colors } from '../designSystem/tokens';
import { AuthScreenContainer } from './containers/AuthScreenContainer';
import { MainTabNavigator } from './MainTabNavigator';
import { WorkoutCreatorScreenContainer } from './containers/WorkoutCreatorScreenContainer';
import { ActiveSessionScreenContainer } from './containers/ActiveSessionScreenContainer';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  WorkoutCreator: undefined;
  ActiveSession: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export interface AppNavigatorProps {
  authManager: AuthManager;
  syncEngine: SyncEngine;
  logoutManager: LogoutManager;
  sessionStore: SessionStore;
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
  const [phase, setPhase] = useState<'loading' | 'auth' | 'authenticated'>('loading');

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

  if (phase === 'loading') {
    return (
      <View style={styles.loadingContainer} testID="app-loading">
        <ActivityIndicator size="large" color={colors.primary} testID="app-loading-indicator" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {phase === 'auth' ? (
          <Stack.Screen name="Auth">
            {(navProps) => (
              <AuthScreenContainer
                {...navProps}
                authManager={props.authManager}
                sessionStore={props.sessionStore}
                onAuthenticated={() => setPhase('authenticated')}
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
                  onSaved={() => navProps.navigation.navigate('Main')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ActiveSession">
              {(navProps) => (
                <ActiveSessionScreenContainer
                  {...navProps}
                  onSessionEnded={() => navProps.navigation.navigate('Main')}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
