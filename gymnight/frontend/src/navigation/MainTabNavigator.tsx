import React from 'react';
import { StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { SyncEngine } from '../sync/SyncEngine';
import type { LogoutManager } from '../auth/LogoutManager';
import { colors, typography, spacing, layout } from '../designSystem/tokens';
import { haptic } from '../designSystem/haptics';
import { DashboardScreenContainer } from './containers/DashboardScreenContainer';
import { ProgressScreenContainer } from './containers/ProgressScreenContainer';
import { StatisticsScreenContainer } from './containers/StatisticsScreenContainer';

export type MainTabParamList = {
  Treinos: undefined;
  Progresso: undefined;
  Estatísticas: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Ícone de aba. Os nomes são os mesmos que o desktop usa na navegação
 * (`fa5s.home` / `fa5s.chart-line`). Ativo/inativo muda só a cor — tint
 * monocromático; o lima fica reservado para conteúdo, não para o chrome.
 */
function TabIcon({ name, color }: { name: string; color: string }) {
  return <FontAwesome5 name={name} size={20} color={color} solid />;
}

export interface MainTabNavigatorProps {
  syncEngine: SyncEngine;
  logoutManager: LogoutManager;
  userId: string;
  onCreateWorkout: () => void;
  /** Ícone de lápis na linha do treino (Wave 8). */
  onEditWorkout: (workoutId: string) => void;
  onSessionStarted: (sessionId: string) => void;
  onLoggedOut: () => void;
}

/**
 * Bottom-tab navigator for the always-available screens (Dashboard,
 * Progress, Statistics). WorkoutCreator and ActiveSession are full-screen
 * flows that stay as sibling Stack.Screens outside this navigator (see
 * AppNavigator.tsx) — they never show the tab bar, by React Navigation's
 * default nesting rules.
 */
export function MainTabNavigator(props: MainTabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.tertiaryText,
        tabBarLabelStyle: styles.tabLabel,
      }}
      screenListeners={{
        tabPress: () => haptic('selection'),
      }}
    >
      <Tab.Screen
        name="Treinos"
        options={{
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      >
        {() => (
          <DashboardScreenContainer
            syncEngine={props.syncEngine}
            logoutManager={props.logoutManager}
            userId={props.userId}
            onCreateWorkout={props.onCreateWorkout}
            onEditWorkout={props.onEditWorkout}
            onSessionStarted={props.onSessionStarted}
            onLoggedOut={props.onLoggedOut}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Progresso"
        options={{
          tabBarIcon: ({ color }) => <TabIcon name="chart-line" color={color} />,
        }}
      >
        {() => <ProgressScreenContainer userId={props.userId} />}
      </Tab.Screen>
      <Tab.Screen
        name="Estatísticas"
        options={{
          // O desktop usa `chart-line` na aba de progresso — evitar repetir
          // (PARIDADE-03-ESTATISTICAS.md §5).
          tabBarIcon: ({ color }) => <TabIcon name="chart-pie" color={color} />,
        }}
      >
        {() => <StatisticsScreenContainer userId={props.userId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// Sem altura fixa: o bottom-tabs soma o inset de baixo (gesture nav vs.
// 3 botões) à altura natural da barra.
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: layout.hairline,
    elevation: 0,
  },
  tabItem: {
    paddingTop: spacing.xxs,
  },
  tabLabel: {
    ...typography.tab,
  },
});
