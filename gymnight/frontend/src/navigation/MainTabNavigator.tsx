import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { SyncEngine } from '../sync/SyncEngine';
import type { LogoutManager } from '../auth/LogoutManager';
import { colors } from '../designSystem/tokens';
import { DashboardScreenContainer } from './containers/DashboardScreenContainer';
import { ProgressScreenContainer } from './containers/ProgressScreenContainer';

export type MainTabParamList = {
  Treinos: undefined;
  Progresso: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function TreinosIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

function ProgressoIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Svg>
  );
}

export interface MainTabNavigatorProps {
  syncEngine: SyncEngine;
  logoutManager: LogoutManager;
  userId: string;
  onCreateWorkout: () => void;
  onSessionStarted: (sessionId: string) => void;
  onLoggedOut: () => void;
}

/**
 * Bottom-tab navigator for the two always-available screens (Dashboard,
 * Progress). WorkoutCreator and ActiveSession are full-screen flows that stay
 * as sibling Stack.Screens outside this navigator (see AppNavigator.tsx) —
 * they never show the tab bar, by React Navigation's default nesting rules.
 */
export function MainTabNavigator(props: MainTabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: 'rgba(154, 165, 177, 0.2)' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
      }}
    >
      <Tab.Screen
        name="Treinos"
        options={{ tabBarIcon: ({ color }) => <TreinosIcon color={color} /> }}
      >
        {() => (
          <DashboardScreenContainer
            syncEngine={props.syncEngine}
            logoutManager={props.logoutManager}
            userId={props.userId}
            onCreateWorkout={props.onCreateWorkout}
            onSessionStarted={props.onSessionStarted}
            onLoggedOut={props.onLoggedOut}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Progresso"
        options={{ tabBarIcon: ({ color }) => <ProgressoIcon color={color} /> }}
      >
        {() => <ProgressScreenContainer userId={props.userId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
