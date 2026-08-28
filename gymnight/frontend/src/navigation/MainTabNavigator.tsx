import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { SyncEngine } from '../sync/SyncEngine';
import type { LogoutManager } from '../auth/LogoutManager';
import { colors, typography, spacing, glow } from '../designSystem/tokens';
import { DashboardScreenContainer } from './containers/DashboardScreenContainer';
import { ProgressScreenContainer } from './containers/ProgressScreenContainer';

export type MainTabParamList = {
  Treinos: undefined;
  Progresso: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Ícone de aba. Os nomes são os mesmos que o desktop usa na navegação
 * (`fa5s.home` / `fa5s.chart-line`); a aba ativa ganha o glow neon.
 */
function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <View style={focused ? glow(colors.primary, 14, 0.5) : undefined}>
      <FontAwesome5 name={name} size={20} color={color} solid />
    </View>
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
 *
 * O desktop usa pílulas horizontais no topo (window.py:331), mas a tab bar
 * inferior é decisão deliberada do mobile — o que mudou aqui é só a estética.
 */
export function MainTabNavigator(props: MainTabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Treinos"
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
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
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chart-line" color={color} focused={focused} />
          ),
        }}
      >
        {() => <ProgressScreenContainer userId={props.userId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
  },
  tabLabel: {
    ...typography.caption,
  },
});
